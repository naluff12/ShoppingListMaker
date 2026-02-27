import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, AlertCircle, CheckCircle, Save } from 'lucide-react';

const API_URL = 'http://localhost:8000';

function UserProfile() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', email: '' });
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setFormData({ nombre: data.nombre, email: data.email });
      } else {
        console.error('Failed to fetch user profile');
        setMessage({ type: 'danger', text: 'Failed to load user profile.' });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setMessage({ type: 'danger', text: 'An error occurred while loading your profile.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        fetchUserProfile();
      } else {
        const errorData = await response.json();
        setMessage({ type: 'danger', text: `Failed to update profile: ${errorData.detail}` });
      }
    } catch (error) {
      setMessage({ type: 'danger', text: 'An error occurred while updating your profile.' });
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'danger', text: "New passwords don't match!" });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return;
    }
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/users/me/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ current_password: passwordData.current_password, new_password: passwordData.new_password }),
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'danger', text: `Failed to change password: ${errorData.detail}` });
      }
    } catch (error) {
      setMessage({ type: 'danger', text: 'An error occurred while changing your password.' });
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleFormChange = (e, formSetter) => {
    const { id, value } = e.target;
    formSetter(prev => ({ ...prev, [id]: value }));
  };

  if (loading) {
    return (
      <div className="app-container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="app-container animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <h2 className="text-gradient" style={{ marginBottom: '32px', textAlign: 'center', fontSize: '2.5rem' }}>Perfil de Usuario</h2>
      
      {message.text && (
        <div className={`alert-info ${message.type === 'danger' ? 'alert-danger' : 'alert-success'}`} style={{ 
            marginBottom: '24px', 
            background: message.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            color: message.type === 'danger' ? 'var(--danger-color)' : 'var(--success-color)',
            border: `1px solid ${message.type === 'danger' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        }}>
            {message.type === 'danger' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            {message.text}
        </div>
      )}
      
      <div className="glass-panel" style={{ padding: '32px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <User size={24} color="var(--primary-color)" /> Datos Personales
        </h3>
        <form onSubmit={handleProfileUpdate}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="nombre" style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-secondary)' }}>Nombre</label>
            <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                    <User size={18} />
                </div>
                <input 
                    type="text" 
                    id="nombre" 
                    className="premium-input" 
                    style={{ paddingLeft: '40px', width: '100%' }}
                    value={formData.nombre} 
                    onChange={(e) => handleFormChange(e, setFormData)} 
                    required
                />
            </div>
          </div>
          
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-secondary)' }}>Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                    <Mail size={18} />
                </div>
                <input 
                    type="email" 
                    id="email" 
                    className="premium-input" 
                    style={{ paddingLeft: '40px', width: '100%' }}
                    value={formData.email} 
                    onChange={(e) => handleFormChange(e, setFormData)} 
                    required
                />
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-premium btn-primary" style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={18} /> Guardar Cambios
            </button>
          </div>
        </form>
      </div>

      <div className="glass-panel" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--danger-color)' }}>
            <Lock size={24} /> Cambiar Contraseña
        </h3>
        <form onSubmit={handlePasswordChange}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="current_password" style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-secondary)' }}>Contraseña Actual</label>
            <input 
                type="password" 
                id="current_password" 
                className="premium-input" 
                style={{ width: '100%' }}
                value={passwordData.current_password} 
                onChange={(e) => handleFormChange(e, setPasswordData)} 
                required
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="new_password" style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-secondary)' }}>Nueva Contraseña</label>
            <input 
                type="password" 
                id="new_password" 
                className="premium-input" 
                style={{ width: '100%' }}
                value={passwordData.new_password} 
                onChange={(e) => handleFormChange(e, setPasswordData)} 
                required
            />
          </div>
          
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="confirm_password" style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-secondary)' }}>Confirmar Nueva Contraseña</label>
            <input 
                type="password" 
                id="confirm_password" 
                className="premium-input" 
                style={{ width: '100%' }}
                value={passwordData.confirm_password} 
                onChange={(e) => handleFormChange(e, setPasswordData)} 
                required
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-premium" style={{ padding: '10px 24px', background: 'var(--danger-color)', color: 'white' }}>
                Actualizar Contraseña
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UserProfile;