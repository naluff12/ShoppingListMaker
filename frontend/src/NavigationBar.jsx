import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Button, Container, Dropdown, Badge } from 'react-bootstrap';
import { Bell, CheckCircle } from 'react-bootstrap-icons';
import toast from 'react-hot-toast';

function NavigationBar({ user, onLogout }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState({ items: [], total: 0, page: 1, size: 10 });

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
      const intervalId = setInterval(fetchNotifications, 30000);
      return () => clearInterval(intervalId);
    }
  }, [user]);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleMarkOneRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch(`/api/notifications/${notificationId}/mark-as-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setNotifications(prev => ({
        ...prev,
        items: prev.items.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      if (!notification.is_read) {
        handleMarkOneRead(notification.id);
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
            navigate(notification.link);
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

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/notifications/mark-all-as-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setNotifications(prev => {
          const updatedItems = prev.items.map(item => ({ ...item, is_read: true }));
          return { ...prev, items: updatedItems };
        });
      } else {
        console.error('Failed to mark all notifications as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setNotifications(prev => {
          const updatedItems = prev.items.filter(item => item.id !== notificationId);
          return { ...prev, items: updatedItems, total: prev.total - 1 };
        });
      } else {
        console.error('Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const unreadCount = useMemo(() => {
    return notifications.items?.filter(n => !n?.is_read).length;
  }, [notifications]);


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
                  <Dropdown.Menu className="dropdown-menu-end" style={{ maxHeight: '400px', overflowY: 'auto', minWidth: '300px', right: 0, left: 'auto' }}>
                    <Dropdown.Header style={{ whiteSpace: 'normal' }}>{unreadCount > 0 ? `${unreadCount} notificaciones nuevas` : 'No hay notificaciones nuevas'}</Dropdown.Header>
                    {notifications.items?.length > 0 ? (
                      <>
                        <Dropdown.Item as="button" onClick={handleMarkAllRead}>Marcar todas como leídas</Dropdown.Item>
                        <Dropdown.Divider />
                        {notifications.items.map(notification => (
                          <Dropdown.Item
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`d-flex justify-content-between align-items-start ${!notification.is_read ? 'fw-bold' : ''}`}
                            style={{ whiteSpace: 'normal' }}
                          >
                            <div>
                              <small>{new Date(notification.created_at).toLocaleString()}</small><br />
                              {notification.message}
                            </div>
                            <div className="d-flex flex-column ms-2">
                              <Button variant="outline-danger" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteNotification(notification.id); }}>&times;</Button>
                              {!notification.is_read &&
                                <Button variant="outline-success" size="sm" className="mt-1" onClick={(e) => { e.stopPropagation(); handleMarkOneRead(notification.id); }}><CheckCircle /></Button>
                              }
                            </div>
                          </Dropdown.Item>
                        ))}
                      </>
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