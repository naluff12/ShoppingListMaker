import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

function Register({ onRegistered, onBack }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [nombre, setNombre] = useState('');
    const [familyCode, setFamilyCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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

            const newUser = await res.json();
            onRegistered(newUser);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-5" style={{ maxWidth: 400 }}>
            <h2 className="mb-4">Register</h2>
            <form onSubmit={handleSubmit}>
                <input type="text" className="form-control mb-2" placeholder="Usuario" value={username} onChange={e => setUsername(e.target.value)} required />
                <input type="email" className="form-control mb-2" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} required />
                <input type="password" className="form-control mb-2" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
                <input type="text" className="form-control mb-2" placeholder="Full Name (optional)" value={nombre} onChange={e => setNombre(e.target.value)} />
                <input type="text" className="form-control mb-2" placeholder="Family Code (optional)" value={familyCode} onChange={e => setFamilyCode(e.target.value)} />
                <Button type="submit" className="w-100 mt-2" variant="primary" disabled={loading}>
                    {loading ? 'Registering...' : 'Register'}
                </Button>
            </form>
            <Button variant="secondary" className="w-100 mt-3" onClick={onBack}>Back to Login</Button>

            {error && (
                <Modal show={true} onHide={() => setError('')} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>Error</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>{error}</Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setError('')}>
                            Cerrar
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}
        </div>
    );
}

export default Register;
