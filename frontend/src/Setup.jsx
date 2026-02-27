import React, { useState } from 'react';
import { Settings, User, Mail, Lock, Home, FileText, AlertCircle, CheckCircle } from 'lucide-react';

function Setup() {
  const [formData, setFormData] = useState({
    family_name: '',
    family_notes: '',
    admin_name: '',
    admin_email: '',
    admin_username: '',
    admin_password: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const payload = {
      family: {
        nombre: formData.family_name,
        notas: formData.family_notes,
      },
      admin: {
        nombre: formData.admin_name,
        email: formData.admin_email,
        username: formData.admin_username,
        password: formData.admin_password,
      },
    };

    try {
      const response = await fetch(`/api/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSuccess('¡Configuración exitosa! Ahora puedes iniciar sesión.');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Fallo al completar la configuración.');
      }
    } catch (err) {
      setError('Ocurrió un error durante la configuración.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <Settings size={36} /> Configuración Inicial
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>Crea la primera familia y el usuario administrador.</p>
        </div>

        {error && (
            <div className="alert-info" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} /> {error}
            </div>
        )}

        {success && (
            <div className="alert-info" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-color)', border: '1px solid rgba(34, 197, 94, 0.3)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} /> {success}
            </div>
        )}

        <form onSubmit={handleSetup}>
          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary-color)' }}>
                <Home size={20} /> Detalles de la Familia
            </h4>
            <div style={{ marginBottom: '16px' }}>
                <label htmlFor="family_name" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nombre de la Familia</label>
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                        <Home size={18} />
                    </div>
                    <input type="text" id="family_name" className="premium-input" style={{ width: '100%', paddingLeft: '48px' }} value={formData.family_name} onChange={handleFormChange} required />
                </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
                <label htmlFor="family_notes" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Notas de la Familia</label>
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }}>
                        <FileText size={18} />
                    </div>
                    <textarea id="family_notes" className="premium-input" style={{ width: '100%', paddingLeft: '48px', minHeight: '80px' }} value={formData.family_notes} onChange={handleFormChange} />
                </div>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary-color)' }}>
                <User size={20} /> Detalles del Administrador
            </h4>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                    <label htmlFor="admin_name" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nombre</label>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <User size={18} />
                        </div>
                        <input type="text" id="admin_name" className="premium-input" style={{ width: '100%', paddingLeft: '48px' }} value={formData.admin_name} onChange={handleFormChange} required />
                    </div>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                    <label htmlFor="admin_email" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Correo Electrónico</label>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <Mail size={18} />
                        </div>
                        <input type="email" id="admin_email" className="premium-input" style={{ width: '100%', paddingLeft: '48px' }} value={formData.admin_email} onChange={handleFormChange} required />
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                    <label htmlFor="admin_username" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Usuario</label>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <User size={18} />
                        </div>
                        <input type="text" id="admin_username" className="premium-input" style={{ width: '100%', paddingLeft: '48px' }} value={formData.admin_username} onChange={handleFormChange} required />
                    </div>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                    <label htmlFor="admin_password" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Contraseña</label>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <Lock size={18} />
                        </div>
                        <input type="password" id="admin_password" className="premium-input" style={{ width: '100%', paddingLeft: '48px' }} value={formData.admin_password} onChange={handleFormChange} required />
                    </div>
                </div>
            </div>
          </div>

          <button type="submit" className="btn-premium btn-primary" style={{ width: '100%', height: '50px', fontSize: '1.1rem' }} disabled={loading}>
            {loading ? 'Configurando...' : 'Completar Configuración'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Setup;
