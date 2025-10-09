import React, { useState } from 'react';
import SomeComponent from './SomeComponent.jsx';
import AnotherComponent from './AnotherComponent.jsx';

function CreateAdmin({ onAdminCreated }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/users/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, is_admin: true })
            });
            if (!res.ok) {
                throw new Error('Error al crear el administrador');
            }
            const data = await res.json();
            onAdminCreated({ username: data.username, isAdmin: data.is_admin });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2>Crear Usuario Administrador</h2>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Usuario"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                <button type="submit" disabled={loading}>Crear y continuar</button>
            </form>
            {error && <div style={{ color: 'red' }}>{error}</div>}
        </div>
    );
}

export default CreateAdmin;
