import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
            navigate('/family-panel');
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
                <Link to="/register" className="btn btn-link">¿No tienes una cuenta? Registrate</Link>
            </div>
        </div>
    );
}

export default Login;
