import React, { useState, useEffect } from 'react';
import './Login.css';

function Login({ onLogin, onNoUsers, onRegister }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Check if any user exists to decide if we should show the register/setup screen.
        fetch('/api/users/me', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } })
            .catch(() => {
                // A failure here could mean a lot of things, but for simplicity,
                // we assume it might be because no users exist. A more robust check is needed.
                // This is a temporary check. The backend logic for setup is the source of truth.
            });
    }, [onNoUsers]);

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
                throw new Error('Incorrect credentials');
            }
            const data = await res.json();
            localStorage.setItem('token', data.access_token);

            const userRes = await fetch('/api/users/me', {
                headers: { 'Authorization': 'Bearer ' + data.access_token }
            });
            if (!userRes.ok) throw new Error('Could not fetch user data');
            const userData = await userRes.json();
            onLogin(userData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <h2>Login</h2>
            <form onSubmit={handleSubmit} className="login-form">
                <input
                    type="text"
                    className="form-control"
                    placeholder="Username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                />
                <input
                    type="password"
                    className="form-control"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>
            {error && <div className="login-error">{error}</div>}
            <div className="create-admin-btn">
                <button className="btn btn-link" onClick={onRegister}>¿No tienes una cuenta? Registrate</button>
            </div>
        </div>
    );
}

export default Login;
