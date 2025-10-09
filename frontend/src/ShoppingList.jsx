import React, { useState, useEffect } from 'react';

import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { Button, Card } from 'react-bootstrap';

function ShoppingList({ user }) {
    const [lists, setLists] = useState([]);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch(`/lists/user/${user}`)
            .then(res => res.json())
            .then(data => setLists(data))
            .catch(() => setLists([]));
    }, [user]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/lists/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, user })
            });
            if (!res.ok) throw new Error('Error al crear la lista');
            const newList = await res.json();
            setLists(lists.concat(newList));
            setName('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="mx-auto mt-5 p-4" style={{ maxWidth: 600 }}>
            <h2 className="mb-4">Lista de Compras de {user}</h2>
            <form onSubmit={handleCreate} className="mb-3 d-flex">
                <input
                    type="text"
                    className="form-control me-2"
                    placeholder="Nombre de la lista"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                />
                <Button type="submit" variant="primary" disabled={loading}>Crear lista</Button>
            </form>
            {error && <div className="alert alert-danger mt-2">{error}</div>}
            <ul className="list-group mt-3">
                <TransitionGroup>
                    {lists.map(list => (
                        <CSSTransition key={list.id} timeout={400} classNames="fade">
                            <li className="list-group-item">{list.name}</li>
                        </CSSTransition>
                    ))}
                </TransitionGroup>
            </ul>
        </Card>
    );
}

export default ShoppingList;
