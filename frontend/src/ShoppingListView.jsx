import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { Button, Spinner } from 'react-bootstrap';
import React, { useState } from 'react';

function ShoppingListView({ list, onBack }) {
    const [items, setItems] = useState([]);
    const [blame, setBlame] = useState([]);
    const [newItem, setNewItem] = useState('');
    const [loading, setLoading] = useState(false);
    const [itemBlames, setItemBlames] = useState({});
    const [showItemBlame, setShowItemBlame] = useState(null);
    const [loadingItemBlame, setLoadingItemBlame] = useState(false);
    const [newItemComment, setNewItemComment] = useState('');
    const [newListComment, setNewListComment] = useState('');

    const fetchListAndBlame = () => {
        if (!list || !list.id) return;
        const token = localStorage.getItem('token');
        setLoading(true);
        fetch(`/api/listas/${list.id}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(res => res.json())
            .then(data => setItems(Array.isArray(data.items) ? data.items : []));
        fetch(`/api/blame/lista/${list.id}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(res => res.json())
            .then(data => setBlame(Array.isArray(data) ? data : []))
            .finally(() => setLoading(false));
    };

    React.useEffect(() => {
        fetchListAndBlame();
        setItemBlames({});
        setShowItemBlame(null);
    }, [list]);

    const handleShowItemBlame = async (itemId) => {
        if (showItemBlame === itemId) {
            setShowItemBlame(null);
            return;
        }
        if (itemBlames[itemId]) {
            setShowItemBlame(itemId);
            return;
        }
        setLoadingItemBlame(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/blame/item/${itemId}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const data = await res.json();
            setItemBlames(prev => ({ ...prev, [itemId]: Array.isArray(data) ? data : [] }));
            setShowItemBlame(itemId);
        } catch (err) {
            alert('Error al cargar el historial del ítem');
        } finally {
            setLoadingItemBlame(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newItem) return;
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/items/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ list_id: list.id, nombre: newItem, cantidad: '1' })
            });
            if (!res.ok) throw new Error('Error al agregar item');
            await res.json();
            setNewItem('');
            fetchListAndBlame(); // Recargar todo
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStatus = async (id, status) => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/items/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ status })
            });

            if (!res.ok) throw new Error('Error al actualizar estado');
            await res.json();

            // 🔹 Recargar la lista y el historial general
            fetchListAndBlame();

            // 🔹 Si el historial de ese ítem está abierto, actualizarlo también
            if (showItemBlame === id) {
                const resHist = await fetch(`/api/blame/item/${id}`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const dataHist = await resHist.json();
                setItemBlames(prev => ({ ...prev, [id]: Array.isArray(dataHist) ? dataHist : [] }));
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/items/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) throw new Error('Error al eliminar item');
            fetchListAndBlame(); // Recargar todo
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleItemCommentSubmit = async (itemId) => {
        if (!newItemComment) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/items/${itemId}/blames`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ detalles: newItemComment })
                });
            if (!res.ok) throw new Error('Error al agregar comentario');
            const nuevo = await res.json();
            setItemBlames(prev => ({
                ...prev,
                [itemId]: [...(prev[itemId] || []), nuevo]
            }));
            setNewItemComment('');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleListCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newListComment) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/listas/${list.id}/blames`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ detalles: newListComment })
                });
            if (!res.ok) throw new Error('Error al agregar comentario a la lista');
            const nuevo = await res.json();
            setBlame(prev => [...prev, nuevo]);
            setNewListComment('');
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="container mt-4" style={{ maxWidth: 600 }}>
            <Button variant="secondary" className="mb-3" onClick={onBack}>Volver</Button>
            <h2 className="mb-4">{list && list.name ? list.name : ''}</h2>
            <form onSubmit={handleAdd} className="mb-3 d-flex">
                <input type="text" className="form-control me-2" placeholder="Nuevo producto" value={newItem} onChange={e => setNewItem(e.target.value)} />
                <Button type="submit" variant="primary" disabled={loading}>Agregar</Button>
            </form>

            <ul className="list-group">
                <TransitionGroup>
                    {items.map(item => (
                        <CSSTransition key={item.id} timeout={400} classNames="fade">
                            <li className="list-group-item mb-2">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <b>{item.nombre}</b> <span className="text-muted">{item.creado_por ? `(${item.creado_por.username})` : ''}</span>
                                    </div>
                                    <div className="d-flex align-items-center">
                                        <select className="form-select me-2" value={item.status || 'needed'} onChange={e => handleStatus(item.id, e.target.value)} style={{ width: 130 }}>
                                            <option value="pendiente">Pendiente</option>
                                            <option value="comprado">Comprado</option>
                                            <option value="ya no se necesita">No necesario</option>
                                        </select>
                                        <Button variant="danger" size="sm" onClick={() => handleDelete(item.id)} disabled={loading}>Eliminar</Button>
                                        <Button variant="outline-info" size="sm" className="ms-2" onClick={() => handleShowItemBlame(item.id)} disabled={loadingItemBlame && showItemBlame === item.id}>
                                            {showItemBlame === item.id ? 'Ocultar' : 'Historial'}
                                            {loadingItemBlame && showItemBlame === item.id && <Spinner animation="border" size="sm" className="ms-1" />}
                                        </Button>
                                    </div>
                                </div>
                                {showItemBlame === item.id && (
                                    <div className="mt-2 ms-3">
                                        <h6>Historial del Producto</h6>
                                        {itemBlames[item.id] && itemBlames[item.id].length === 0 && <div className="text-muted">Sin historial</div>}
                                        <ul className="list-group">
                                            {itemBlames[item.id] && itemBlames[item.id].map(c => (
                                                <li key={c.id} className="list-group-item">
                                                    <b>{c.user && c.user.username ? c.user.username : 'Usuario'}</b> ({c.timestamp ? new Date(c.timestamp).toLocaleString() : ''})<br />
                                                    <small>{c.detalles}</small>
                                                </li>
                                            ))}
                                        </ul>
                                        <form onSubmit={(e) => { e.preventDefault(); handleItemCommentSubmit(item.id); }} className="mt-2 d-flex">
                                            <input type="text" className="form-control me-2" placeholder="Nuevo comentario" value={newItemComment} onChange={e => setNewItemComment(e.target.value)} />
                                            <Button type="submit" variant="primary" size="sm">Comentar</Button>
                                        </form>
                                    </div>
                                )}
                            </li>
                        </CSSTransition>
                    ))}
                </TransitionGroup>
            </ul>

            <div className="mt-4">
                <h5>Comentarios de la lista</h5>
                {blame.length === 0 && <div className="text-muted">Sin historial</div>}
                <ul className="list-group mb-3">
                    {blame.map(b => (
                        <li key={b.id} className="list-group-item">
                            <b>{b.user && b.user.username ? b.user.username : 'Usuario'}</b> {b.action} ({b.timestamp ? new Date(b.timestamp).toLocaleString() : ''})<br />
                            <small className="text-muted">{b.detalles}</small>
                        </li>
                    ))}
                </ul>
                <form onSubmit={handleListCommentSubmit} className="d-flex">
                    <input type="text" className="form-control me-2" placeholder="Nuevo comentario para la lista" value={newListComment} onChange={e => setNewListComment(e.target.value)} />
                    <Button type="submit" variant="primary" size="sm">Comentar</Button>
                </form>
            </div>
        </div>
    );
}

export default ShoppingListView;