import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, XCircle, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

function NavigationBar({ user, onLogout }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState({ items: [], total: 0, page: 1, size: 10 });
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
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

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        headers: { 'Authorization': `Bearer ${token}` },
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
      setShowDropdown(false);

      if (notification.link) {
        const match = notification.link.match(/\/shopping-list\/(\d+)/);
        if (match) {
          const listId = match[1];
          const response = await fetch(`/api/listas/${listId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
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
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setNotifications(prev => {
          const updatedItems = prev.items.map(item => ({ ...item, is_read: true }));
          return { ...prev, items: updatedItems };
        });
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
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setNotifications(prev => {
          const updatedItems = prev.items.filter(item => item.id !== notificationId);
          return { ...prev, items: updatedItems, total: prev.total - 1 };
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const unreadCount = useMemo(() => {
    return notifications.items?.filter(n => !n?.is_read).length;
  }, [notifications]);

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        <ShoppingCart className="text-gradient" size={28} />
        <span>Shopping<span style={{color: 'var(--primary-color)'}}>Maker</span></span>
      </Link>
      
      <div className="nav-links">
        {user ? (
          <>
            <Link to="/" className="nav-link">Inicio</Link>
            <Link to="/family-panel" className="nav-link">Familias</Link>
            {user.is_admin && <Link to="/admin" className="nav-link">Administrar</Link>}
            
            <div className="dropdown-container" ref={dropdownRef}>
              <button 
                className="btn-premium btn-secondary" 
                style={{ padding: '8px 12px', border: 'none', position: 'relative' }}
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <Bell size={20} />
                {unreadCount > 0 && <span className="badge" style={{ position: 'absolute', top: '-4px', right: '-4px' }}>{unreadCount}</span>}
              </button>

              {showDropdown && (
                <div className="dropdown-menu" style={{ display: 'flex' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
                    {unreadCount > 0 ? `${unreadCount} notificaciones nuevas` : 'Notificaciones'}
                  </div>
                  
                  {notifications.items?.length > 0 ? (
                    <>
                      <button className="dropdown-item" style={{ color: 'var(--primary-color)', justifyContent: 'center' }} onClick={handleMarkAllRead}>
                        Marcar todas como leídas
                      </button>
                      
                      {notifications.items.map(notification => (
                        <div key={notification.id} className="dropdown-item" style={{ fontWeight: !notification.is_read ? 600 : 400 }}>
                          <div onClick={() => handleNotificationClick(notification)} style={{ flex: 1 }}>
                            <small style={{ color: 'var(--text-muted)' }}>{new Date(notification.created_at).toLocaleString()}</small><br />
                            {notification.message}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteNotification(notification.id); }} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>
                              <XCircle size={16} />
                            </button>
                            {!notification.is_read &&
                              <button onClick={(e) => { e.stopPropagation(); handleMarkOneRead(notification.id); }} style={{ background: 'none', border: 'none', color: 'var(--success-color)', cursor: 'pointer' }}>
                                <CheckCircle size={16} />
                              </button>
                            }
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="dropdown-item" style={{ justifyContent: 'center', color: 'var(--text-muted)', cursor: 'default' }}>No hay notificaciones</div>
                  )}
                </div>
              )}
            </div>

            <Link to="/profile" className="nav-link">Perfil</Link>
            <button className="btn-premium btn-secondary" onClick={handleLogout}>Salir</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn-premium btn-secondary">Ingresar</Link>
            <Link to="/register" className="btn-premium btn-primary">Registrarse</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default NavigationBar;