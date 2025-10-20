import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Button, Container, Dropdown, Badge } from 'react-bootstrap';
import { Bell } from 'react-bootstrap-icons';
import toast from 'react-hot-toast';

function NavigationBar({ user, onLogout }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      } else {
        console.error('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Set up polling
      const intervalId = setInterval(fetchNotifications, 30000); // Poll every 30 seconds

      // Clean up interval on component unmount
      return () => clearInterval(intervalId);
    }
  }, [user]);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleNotificationClick = async (notification) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Mark as read only if it's not already read
      if (!notification.is_read) {
        await fetch(`/api/notifications/${notification.id}/mark-as-read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        // Refresh notifications locally for immediate UI update
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
      }

      if (notification.link) {
        const match = notification.link.match(/\/shopping-list\/(\d+)/);
        if (match) {
          const listId = match[1];
          const response = await fetch(`/api/listas/${listId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const listData = await response.json();
            navigate('/shopping-list', { state: { list: listData } });
          } else {
            toast.error('El contenido ya no está disponible.');
          }
        } else {
            navigate(notification.link);
        }
      }

    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/">Shopping List App</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {user && <Nav.Link as={Link} to="/">Home</Nav.Link>}
            {user && <Nav.Link as={Link} to="/family-panel">Panel Familiar</Nav.Link>}
            {user && user.is_admin && <Nav.Link as={Link} to="/admin">Admin Dashboard</Nav.Link>}
          </Nav>
          <Nav>
            {user ? (
              <>
                <Dropdown align="end">
                  <Dropdown.Toggle as={Nav.Link} id="dropdown-notifications" className="d-flex align-items-center">
                    <Bell size={20} />
                    {unreadCount > 0 && <Badge pill bg="danger" style={{ marginLeft: '5px' }}>{unreadCount}</Badge>}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Header>{unreadCount > 0 ? `${unreadCount} notificaciones nuevas` : 'No hay notificaciones nuevas'}</Dropdown.Header>
                    {notifications.length > 0 ? (
                      notifications.map(notification => (
                        <Dropdown.Item 
                          key={notification.id} 
                          onClick={() => handleNotificationClick(notification)}
                          className={!notification.is_read ? 'fw-bold' : ''}
                        >
                          <small>{new Date(notification.created_at).toLocaleString()}</small><br/>
                          {notification.message}
                        </Dropdown.Item>
                      ))
                    ) : (
                      <Dropdown.Item disabled>No hay notificaciones</Dropdown.Item>
                    )}
                  </Dropdown.Menu>
                </Dropdown>

                <Nav.Link as={Link} to="/profile">Perfil</Nav.Link>
                <Button variant="outline-light" onClick={handleLogout}>Logout</Button>
              </>
            ) : (
              <>
                <Nav.Link as={Link} to="/login">Login</Nav.Link>
                <Nav.Link as={Link} to="/register">Register</Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavigationBar;