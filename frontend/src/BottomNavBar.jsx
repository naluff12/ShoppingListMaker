import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Bell, User } from 'lucide-react';
import './BottomNavBar.css';

function BottomNavBar({ unreadCount, onToggleNotifications, isOpen, show = true }) {
  const location = useLocation();

  if (!show) return null;

  return (
    <nav className="bottom-nav">
      <Link to="/" className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <Home size={22} />
        <span>Inicio</span>
      </Link>
      <Link to="/family-panel" className={`bottom-nav-item ${location.pathname === '/family-panel' || location.pathname === '/calendar' ? 'active' : ''}`}>
        <Calendar size={22} />
        <span>Familias</span>
      </Link>
      <button
        data-nav-bell
        className={`bottom-nav-item ${isOpen ? 'active' : ''}`}
        onClick={onToggleNotifications}
        style={{ position: 'relative', background: 'none', border: 'none' }}
      >
        <Bell size={22} />
        <span>Avisos</span>
        {unreadCount > 0 && <span className="badge bottom-nav-badge">{unreadCount}</span>}
      </button>
      <Link to="/profile" className={`bottom-nav-item ${location.pathname === '/profile' ? 'active' : ''}`}>
        <User size={22} />
        <span>Perfil</span>
      </Link>
    </nav>
  );
}

export default BottomNavBar;
