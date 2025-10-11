import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { Button, Spinner, Form, InputGroup } from 'react-bootstrap';
import React, { useState } from 'react';

function ShoppingListView({ list, onBack }) {
    const [items, setItems] = useState([]);
    const [listDetails, setListDetails] = useState(null);
    const [blame, setBlame] = useState([]);
    const [newItem, setNewItem] = useState('');
    const [loading, setLoading] = useState(false);
    const [itemBlames, setItemBlames] = useState({});
    const [editingPrice, setEditingPrice] = useState(null);
    const [showItemBlame, setShowItemBlame] = useState(null);
    const [loadingItemBlame, setLoadingItemBlame] = useState(false);
    const [newItemComment, setNewItemComment] = useState('');
    const [newListComment, setNewListComment] = useState('');

    const fetchListAndBlame = () => {
        if (!list || !list.id) return;
        const token = localStorage.getItem('token');
        setLoading(true);
    
        Promise.all([
            fetch(`/api/listas/${list.id}`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json()),
            fetch(`/api/blame/lista/${list.id}`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json())
        ])
            .then(([listData, blameData]) => {
                setListDetails(listData);
                setItems(Array.isArray(listData.items) ? listData.items : []);
                setBlame(Array.isArray(blameData) ? blameData : []);
            })
            .catch(err => {
                console.error("Error fetching list data:", err);
                alert("No se pudo cargar la información de la lista.");
            })
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

    const handlePriceChange = async (itemId, field, value) => {
        const parsedValue = parseFloat(value);
        if (isNaN(parsedValue)) return;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/items/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ [field]: parsedValue })
            });
            if (!res.ok) throw new Error('Error al actualizar el precio');
            const updatedItem = await res.json();
            
            // Actualizar estado localmente para una UI más rápida
            setItems(items.map(i => i.id === itemId ? updatedItem : i));

        } catch (err) {
            alert(err.message);
            fetchListAndBlame(); // Recargar si hay error para asegurar consistencia
        } finally {
            setEditingPrice(null);
        }
    };

    const handleListStatusChange = async (newStatus) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/listas/${list.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error('Error al actualizar estado de la lista');
            const updatedList = await res.json();
            setListDetails(updatedList);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleImageUpload = async (itemId, file) => {
        if (!file) return;

        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('file', file);

        // Opcional: Mostrar un spinner de carga para este item específico
        // setLoadingItemImage(itemId);

        try {
            const res = await fetch(`/api/items/${itemId}/upload-image`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData,
            });
            if (!res.ok) throw new Error('Error al subir la imagen');
            const updatedItem = await res.json();
            setItems(items.map(i => i.id === itemId ? updatedItem : i));
        } catch (err) {
            alert(err.message);
        }
    }

    return (
        <div className="container mt-4" style={{ maxWidth: 600 }}>
            <Button variant="secondary" className="mb-3" onClick={onBack}>Volver</Button>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="mb-0">{listDetails?.name || list?.name || ''}</h2>
                {listDetails && (
                    <select className="form-select w-auto" value={listDetails.status} onChange={e => handleListStatusChange(e.target.value)}>
                        <option value="pendiente">Pendiente</option>
                        <option value="revisada">Revisada</option>
                        <option value="no revisada">No Revisada</option>
                    </select>
                )}
            </div>
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
                                        <div>
                                            {item.image_url && <img src={item.image_url} alt={item.nombre} style={{ width: 50, height: 50, objectFit: 'cover', marginRight: 10, borderRadius: 4 }} />}
                                            <b>{item.nombre}</b> <span className="text-muted">{item.creado_por ? `(${item.creado_por.username})` : ''}</span>
                                        </div>
                                        <div className="d-flex align-items-center mt-2">
                                            <small className="me-3" onDoubleClick={() => setEditingPrice({ id: item.id, field: 'precio_estimado' })}>
                                                Est: ${editingPrice?.id === item.id && editingPrice?.field === 'precio_estimado' ?
                                                    <input type="number" step="0.01" defaultValue={item.precio_estimado} autoFocus onBlur={(e) => handlePriceChange(item.id, 'precio_estimado', e.target.value)} onKeyDown={e => e.key === 'Enter' && e.target.blur()} style={{ width: 70 }} />
                                                    : (item.precio_estimado || '0.00')}
                                            </small>
                                            <small onDoubleClick={() => setEditingPrice({ id: item.id, field: 'precio_confirmado' })}>
                                                Real: ${editingPrice?.id === item.id && editingPrice?.field === 'precio_confirmado' ?
                                                    <input type="number" step="0.01" defaultValue={item.precio_confirmado} autoFocus onBlur={(e) => handlePriceChange(item.id, 'precio_confirmado', e.target.value)} onKeyDown={e => e.key === 'Enter' && e.target.blur()} style={{ width: 70 }} />
                                                    : (item.precio_confirmado || '0.00')}
                                            </small>
                                        </div>
                                        {/* Placeholder for image upload */}
                                        <Form.Group controlId={`formFileSm-${item.id}`} className="mt-2">
                                            <Form.Label><small>Subir imagen (WEBP)</small></Form.Label>
                                            <Form.Control type="file" size="sm" accept="image/jpeg,image/png" onChange={(e) => handleImageUpload(item.id, e.target.files[0])} />
                                        </Form.Group>
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