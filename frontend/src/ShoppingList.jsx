import React, { useState, useEffect } from 'react';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { Plus, List } from 'lucide-react';

function ShoppingList({ user }) {
    const [lists, setLists] = useState([]);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch(`/api/lists/user/${user}`)
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
        <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto', padding: '32px' }}>
            <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <List size={28} color="var(--primary-color)" /> Lista de Compras de {user}
            </h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <input
                    type="text"
                    className="premium-input"
                    placeholder="Nombre de la lista"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    style={{ flex: 1, padding: '12px 16px' }}
                />
                <button type="submit" className="btn-premium btn-primary" disabled={loading} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                    <Plus size={18} /> Crear lista
                </button>
            </form>
            
            {error && (
                <div className="alert-info" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '24px' }}>
                    {error}
                </div>
            )}
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <TransitionGroup>
                    {lists.map(list => (
                        <CSSTransition key={list.id} timeout={400} classNames="fade">
                            <li style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                                {list.name}
                            </li>
                        </CSSTransition>
                    ))}
                </TransitionGroup>
            </ul>
        </div>
    );
}

export default ShoppingList;
