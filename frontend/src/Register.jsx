import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, User, Lock, Mail, Users, AlertCircle, X } from 'lucide-react';

function Register() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [nombre, setNombre] = useState('');
    const [familyCode, setFamilyCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: { username, password, email, nombre },
                    family_code: familyCode || null
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Error during registration');
            }

            navigate('/login');

        } catch (err) {
            setError(err.message);
            setShowErrorModal(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-container animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h2 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Crear Cuenta</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Únete a la plataforma hoy</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <User size={18} />
                        </div>
                        <input 
                            type="text" 
                            className="premium-input" 
                            placeholder="Usuario" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            required 
                            style={{ width: '100%', paddingLeft: '48px', height: '48px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <Mail size={18} />
                        </div>
                        <input 
                            type="email" 
                            className="premium-input" 
                            placeholder="Correo" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            required 
                            style={{ width: '100%', paddingLeft: '48px', height: '48px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <Lock size={18} />
                        </div>
                        <input 
                            type="password" 
                            className="premium-input" 
                            placeholder="Contraseña" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            required 
                            style={{ width: '100%', paddingLeft: '48px', height: '48px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <User size={18} />
                        </div>
                        <input 
                            type="text" 
                            className="premium-input" 
                            placeholder="Nombre Completo (Opcional)" 
                            value={nombre} 
                            onChange={e => setNombre(e.target.value)} 
                            style={{ width: '100%', paddingLeft: '48px', height: '48px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '32px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                            <Users size={18} />
                        </div>
                        <input 
                            type="text" 
                            className="premium-input" 
                            placeholder="Código de Familia (Opcional)" 
                            value={familyCode} 
                            onChange={e => setFamilyCode(e.target.value)} 
                            style={{ width: '100%', paddingLeft: '48px', height: '48px' }}
                        />
                    </div>

                    <button type="submit" className="btn-premium btn-primary" disabled={loading} style={{ width: '100%', height: '48px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {loading ? 'Registrando...' : <><UserPlus size={20} /> Registrarse</>}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <Link to="/login" className="btn-premium btn-secondary" style={{ display: 'inline-block', width: '100%', textDecoration: 'none', height: '48px', lineHeight: '48px', padding: '0' }}>
                        Volver al Login
                    </Link>
                </div>
            </div>

            {showErrorModal && (
                <div className="modal-backdrop">
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
                        <div style={{ color: 'var(--danger-color)', marginBottom: '16px' }}>
                            <AlertCircle size={48} style={{ margin: '0 auto' }} />
                        </div>
                        <h4 style={{ marginBottom: '16px' }}>Error en el Registro</h4>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error}</p>
                        <button className="btn-premium btn-secondary" style={{ width: '100%' }} onClick={() => setShowErrorModal(false)}>
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Register;
