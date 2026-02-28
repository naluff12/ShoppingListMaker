import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, User, Lock, AlertCircle } from 'lucide-react';
import './Login.css';

function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username, password })
            });
            if (!res.ok) {
                throw new Error('Credenciales incorrectas');
            }
            const data = await res.json();
            // El token ahora se gestiona automáticamente por Cookies HttpOnly

            const userRes = await fetch('/api/users/me');
            if (!userRes.ok) throw new Error('No se pudo obtener la información del usuario');
            const userData = await userRes.json();
            onLogin(userData);
            navigate('/family-panel');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-container animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h2 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Bienvenido</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Inicia sesión para continuar</p>
                </div>

                {error && (
                    <div className="alert-info" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={18} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <User size={20} />
                        </div>
                        <input
                            type="text"
                            className="premium-input"
                            placeholder="Usuario"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            style={{ width: '100%', paddingLeft: '48px', height: '50px', fontSize: '1rem' }}
                        />
                    </div>
                    <div style={{ marginBottom: '32px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <Lock size={20} />
                        </div>
                        <input
                            type="password"
                            className="premium-input"
                            placeholder="Contraseña"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            style={{ width: '100%', paddingLeft: '48px', height: '50px', fontSize: '1rem' }}
                        />
                    </div>
                    <button type="submit" className="btn-premium btn-primary" disabled={loading} style={{ width: '100%', height: '50px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {loading ? 'Iniciando...' : <><LogIn size={20} /> Iniciar Sesión</>}
                    </button>
                </form>

                <div style={{ marginTop: '32px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>¿No tienes una cuenta?</p>
                    <Link to="/register" className="btn-premium btn-secondary" style={{ display: 'inline-block', width: '100%', textDecoration: 'none' }}>
                        Regístrate
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Login;
