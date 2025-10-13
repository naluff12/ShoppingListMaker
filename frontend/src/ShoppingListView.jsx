import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { Button, Spinner, Form, InputGroup, Card, Badge } from 'react-bootstrap';
import React, { useState, useEffect, useMemo } from 'react';

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
    const [products, setProducts] = useState([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);


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
                if (listData.calendar && listData.calendar.family_id) {
                    fetch(`/api/families/${listData.calendar.family_id}/products`, { headers: { 'Authorization': 'Bearer ' + token } })
                        .then(res => res.json())
                        .then(data => setProducts(data))
                        .catch(() => setProducts([]));
                }
            })
            .catch(err => {
                console.error("Error fetching list data:", err);
                alert("No se pudo cargar la información de la lista.");
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
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
            const res = await fetch(`/api/items/${id}`,
                {
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
            const res = await fetch(`/api/items/${id}`,
                {
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
            const res = await fetch(`/api/items/${itemId}`,
                {
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
            const res = await fetch(`/api/listas/${list.id}`,
                {
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
            const res = await fetch(`/api/items/${itemId}/upload-image`,
                {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData,
                });
            if (!res.ok) throw new Error('Error al subir la imagen');
            const updatedItem = await res.json();
            console.log(updatedItem)
            setItems(items.map(i => {
                if (i.id === itemId) {
                    return {
                        ...i,
                        product: {
                            ...i.product,
                            image_url: updatedItem.image_url
                        }
                    };
                }
                return i;
            }));
            console.log(items)
        } catch (err) {
            alert(err.message);
        }
    }

    const totalEstimado = useMemo(() => items.reduce((acc, item) => acc + (item.precio_estimado || 0), 0), [items]);
    const totalConfirmado = useMemo(() => items.reduce((acc, item) => item.status === 'comprado' ? acc + (item.precio_confirmado || item.precio_estimado || 0) : acc, 0), [items]);

    return (
        <div className="container mt-4" style={{ maxWidth: 800 }}>
            <Button variant="secondary" className="mb-3" onClick={onBack}>Volver</Button>
            <Card className="mb-4">
                <Card.Body>
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
                    {/* 🔹 AUTOCOMPLETADO CON IMÁGENES */}
{/* 🔹 AUTOCOMPLETADO CON IMÁGENES + NAVEGACIÓN */}
<Form onSubmit={handleAdd} className="mb-3 position-relative" style={{ zIndex: 10 }}>
    <InputGroup>
        <Form.Control
            type="text"
            placeholder="Nuevo producto"
            value={newItem}
            onChange={async (e) => {
                const value = e.target.value;
                setNewItem(value);
                setHighlightedIndex(-1);

                if (!value.trim() || !listDetails?.calendar?.family_id) {
                    setProducts([]);
                    return;
                }

                const token = localStorage.getItem('token');
                try {
                    const res = await fetch(
                        `/api/products/search?family_id=${listDetails.calendar.family_id}&q=${encodeURIComponent(value)}`,
                        { headers: { 'Authorization': 'Bearer ' + token } }
                    );
                    if (res.ok) {
                        const data = await res.json();
                        setProducts(Array.isArray(data) ? data : []);
                    } else {
                        setProducts([]);
                    }
                } catch {
                    setProducts([]);
                }
            }}
            onKeyDown={(e) => {
                if (products.length === 0) return;
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedIndex((prev) => (prev + 1) % products.length);
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedIndex((prev) => (prev - 1 + products.length) % products.length);
                } else if (e.key === "Enter" && highlightedIndex >= 0) {
                    e.preventDefault();
                    const selected = products[highlightedIndex];
                    if (selected) {
                        setNewItem(selected.name);
                        setProducts([]);
                    }
                }
            }}
            onFocus={(e) => {
                if (products.length > 0) e.target.parentElement.classList.add("show");
            }}
            onBlur={() => {
                setTimeout(() => {
                    const dropdown = document.querySelector(".autocomplete-dropdown");
                    if (dropdown) dropdown.style.display = "none";
                }, 200);
            }}
        />
        <Button type="submit" variant="primary" disabled={loading}>
            Agregar
        </Button>
    </InputGroup>

    {products.length > 0 && newItem.trim() !== "" && (
        <div
            className="autocomplete-dropdown position-absolute bg-white border rounded shadow-sm mt-1 w-100"
            style={{ maxHeight: "250px", overflowY: "auto" }}
        >
            {products.map((p, index) => {
                // 🔸 Función para resaltar coincidencias
                const highlightMatch = (text, query) => {
                    const regex = new RegExp(`(${query})`, "gi");
                    const parts = text.split(regex);
                    return parts.map((part, i) =>
                        part.toLowerCase() === query.toLowerCase() ? (
                            <span key={i} style={{ fontWeight: "bold", color: "#007bff" }}>
                                {part}
                            </span>
                        ) : (
                            part
                        )
                    );
                };

                return (
                    <div
                        key={p.id}
                        className={`d-flex align-items-center p-2 hover-bg-light ${
                            index === highlightedIndex ? "bg-light border-start border-primary border-3" : ""
                        }`}
                        style={{ cursor: "pointer" }}
                        onMouseDown={() => {
                            setNewItem(p.name);
                            setProducts([]);
                        }}
                        onMouseEnter={() => setHighlightedIndex(index)}
                    >
                        {p.image_url ? (
                            <img
                                src={`data:image/webp;base64,${p.image_url}`}
                                alt={p.name}
                                style={{
                                    width: 40,
                                    height: 40,
                                    objectFit: "cover",
                                    borderRadius: 4,
                                    marginRight: 10,
                                }}
                            />
                        ) : (
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    backgroundColor: "#eee",
                                    borderRadius: 4,
                                    marginRight: 10,
                                }}
                            />
                        )}
                        <span>{highlightMatch(p.name, newItem)}</span>
                    </div>
                );
            })}
        </div>
    )}
</Form>


                    <div className="d-flex justify-content-end gap-3">
                        <h5>Total Estimado: <Badge bg="info">${totalEstimado.toFixed(2)}</Badge></h5>
                        <h5>Total Comprado: <Badge bg="success">${totalConfirmado.toFixed(2)}</Badge></h5>
                    </div>
                </Card.Body>
            </Card>

            <ul className="list-group">
                <TransitionGroup>
                    {items.map(item => (
                        <CSSTransition key={item.id} timeout={400} classNames="fade">
                            <li className="list-group-item mb-2 shadow-sm">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div className="d-flex align-items-center">
                                        {item.product.image_url && <img src={`data:image/webp;base64,${item.product.image_url}`} alt={item.nombre} style={{ width: 40, height: 40, objectFit: 'cover', marginRight: 15, borderRadius: 4 }} />}
                                        <div>
                                            <b>{item.nombre}</b>
                                            <div className="text-muted small">{item.creado_por ? `agregado por ${item.creado_por.username}` : ''}</div>
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center">
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
                                        <Form.Group controlId={`formFileSm-${item.id}`} className="ms-3">
                                            <Form.Control type="file" size="sm" accept="image/jpeg,image/png" onChange={(e) => handleImageUpload(item.id, e.target.files[0])} />
                                        </Form.Group>
                                        <select className="form-select mx-2" value={item.status || 'needed'} onChange={e => handleStatus(item.id, e.target.value)} style={{ width: 130 }}>
                                            <option value="pendiente">Pendiente</option>
                                            <option value="comprado">Comprado</option>
                                            <option value="ya no se necesita">No necesario</option>
                                        </select>
                                        <Button variant="danger" size="sm" onClick={() => handleDelete(item.id)} disabled={loading}>&times;</Button>
                                        <Button variant="outline-info" size="sm" className="ms-2" onClick={() => handleShowItemBlame(item.id)} disabled={loadingItemBlame && showItemBlame === item.id}>H</Button>
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