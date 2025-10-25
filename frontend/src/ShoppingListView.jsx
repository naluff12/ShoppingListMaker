import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { Button, Spinner, Form, InputGroup, Card, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import React, { useState, useEffect, useMemo } from 'react';
import { Eye, EyeSlash, PlusCircle, PlusLg } from 'react-bootstrap-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import ImageUploader from './ImageUploader';
import './ShoppingListView.css'; // Importar los nuevos estilos
import PreviousItemsModal from './PreviousItemsModal'; // Importar el modal
import ShoppingItemCard from './ShoppingItemCard'; // Importar el nuevo componente

const API_URL = 'http://localhost:8000';

function ShoppingListView() {
    const location = useLocation();
    const navigate = useNavigate();
    const list = location.state?.list;

    const [items, setItems] = useState([]);
    const [listDetails, setListDetails] = useState(null);
    const [blame, setBlame] = useState([]);
    const [newItem, setNewItem] = useState('');
    const [newQuantity, setNewQuantity] = useState(1);
    const [newUnit, setNewUnit] = useState('piezas');
    const [loading, setLoading] = useState(false);
    const [itemBlames, setItemBlames] = useState({});
    const [editingPrice, setEditingPrice] = useState(null);
    const [showItemBlame, setShowItemBlame] = useState(null);
    const [loadingItemBlame, setLoadingItemBlame] = useState(false);
    const [newItemComment, setNewItemComment] = useState('');
    const [newListComment, setNewListComment] = useState('');
    const [products, setProducts] = useState([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [editingItem, setEditingItem] = useState(null);
    const [itemsPage, setItemsPage] = useState(1);
    const [itemsTotalPages, setItemsTotalPages] = useState(1);
    const [productsPage, setProductsPage] = useState(1);
    const [productsTotalPages, setProductsTotalPages] = useState(1);
    const [showPreviousItemsModal, setShowPreviousItemsModal] = useState(false);
    const [quickAddItemName, setQuickAddItemName] = useState('');
    const [isQuickAdding, setIsQuickAdding] = useState(false);

    const handleQuickAdd = async (e) => {
        e.preventDefault();
        if (!quickAddItemName.trim()) return;

        setIsQuickAdding(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/items/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ 
                    list_id: list.id, 
                    nombre: quickAddItemName, 
                    cantidad: 1, // Default quantity
                    unit: 'piezas' // Default unit
                })
            });
            if (!res.ok) throw new Error('Error al agregar el producto');
            await res.json();
            setQuickAddItemName('');
            fetchListAndBlame(itemsPage); // Recargar la página actual de items
        } catch (err) {
            alert(err.message);
        } finally {
            setIsQuickAdding(false);
        }
    };

    const fetchListAndBlame = (page = 1) => {
        if (!list || !list.id) return;
        const token = localStorage.getItem('token');
        setLoading(true);

        Promise.all([
            fetch(`/api/listas/${list.id}`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json()),
            fetch(`/api/listas/${list.id}/items?page=${page}&size=10`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json()),
            fetch(`/api/blame/lista/${list.id}`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json())
        ])
            .then(([listData, itemsData, blameData]) => {
                setListDetails(listData);
                setItems(Array.isArray(itemsData.items) ? itemsData.items : []);
                setItemsPage(itemsData.page);
                setItemsTotalPages(Math.ceil(itemsData.total / itemsData.size));
                setBlame(Array.isArray(blameData) ? blameData : []);
                if (listData.calendar && listData.calendar.family_id) {
                    fetch(`/api/families/${listData.calendar.family_id}/products`, { headers: { 'Authorization': 'Bearer ' + token } })
                        .then(res => res.json())
                        .then(data => setProducts(data.items))
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
            const res = await fetch(`/api/items/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ list_id: list.id, nombre: newItem, cantidad: newQuantity, unit: newUnit })
            });
            if (!res.ok) throw new Error('Error al agregar item');
            await res.json();
            setNewItem('');
            setNewQuantity(1);
            setNewUnit('piezas');
            fetchListAndBlame(); // Recargar todo
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItemsFromModal = async (itemsToAdd) => {
        if (!list) return;
        const token = localStorage.getItem('token');
        const items = itemsToAdd.map(item => ({
            nombre: item.nombre,
            cantidad: item.cantidad,
            unit: item.unit,
            comentario: item.comentario,
            precio_estimado: item.precio_estimado,
        }));

        try {
            await fetch(`/api/listas/${list.id}/items/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ items })
            });
            fetchListAndBlame(); // Recargar todo
        } catch (err) {
            alert('Error adding items to the list.');
        }
    };

    const handleStatus = async (id, status) => {
        const newStatus = status === 'comprado' ? 'pendiente' : 'comprado';
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/items/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error('Error al actualizar estado');
            const updatedItem = await res.json();
            setItems(items.map(i => i.id === id ? updatedItem : i));
            if (showItemBlame === id) {
                const resHist = await fetch(`/api/blame/item/${id}`, { headers: { 'Authorization': 'Bearer ' + token } });
                const dataHist = await resHist.json();
                setItemBlames(prev => ({ ...prev, [id]: Array.isArray(dataHist) ? dataHist : [] }));
            }
        } catch (err) {
            alert(err.message);
            fetchListAndBlame();
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
            setItems(items.map(i => i.id === itemId ? updatedItem : i));
        } catch (err) {
            alert(err.message);
            fetchListAndBlame();
        } finally {
            setEditingPrice(null);
        }
    };

    const handleListStatusChange = async () => {
        const newStatus = listDetails.status === 'revisada' ? 'pendiente' : 'revisada';
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
        try {
            const res = await fetch(`/api/items/${itemId}/upload-image`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData,
            });
            if (!res.ok) throw new Error('Error al subir la imagen');
            const updatedItem = await res.json();
            setItems(items.map(i => i.id === itemId ? { ...i, product: { ...i.product, image_url: updatedItem.image_url } } : i));
        } catch (err) {
            alert(err.message);
        }
    }

    const handleItemUpdate = async (itemId, data) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/items/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Error al actualizar el item');
            const updatedItem = await res.json();
            setItems(items.map(i => i.id === itemId ? updatedItem : i));
            setEditingItem(null);
        } catch (err) {
            alert(err.message);
            fetchListAndBlame();
        }
    };

    const fetchProducts = async (query, page = 1) => {
        if (!query.trim() || !listDetails?.calendar?.family_id) {
            setProducts([]);
            return;
        }
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(
                `/api/products/search?family_id=${listDetails.calendar.family_id}&q=${encodeURIComponent(query)}&page=${page}&size=5`,
                { headers: { 'Authorization': 'Bearer ' + token } }
            );
            if (res.ok) {
                const data = await res.json();
                setProducts(Array.isArray(data.items) ? data.items : []);
                setProductsPage(data.page);
                setProductsTotalPages(Math.ceil(data.total / data.size));
            } else {
                setProducts([]);
            }
        } catch {
            setProducts([]);
        }
    };

    const totalComprado = useMemo(() => items.reduce((acc, item) => item.status === 'comprado' ? acc + (item.precio_confirmado || 0) * item.cantidad : acc, 0), [items]);

    return (
        <div className="container mt-4" style={{ maxWidth: 800 }}>
            <Button variant="secondary" className="mb-3" onClick={() => navigate('/calendar', { state: { calendar: listDetails.calendar } })}>Volver</Button>
            <Card className="mb-4">
                <Card.Body>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h2 className="mb-0">{listDetails?.name || list?.name || ''}</h2>
                        {listDetails && (
                            <span onClick={handleListStatusChange} style={{ cursor: 'pointer', color: listDetails.status === 'revisada' ? 'green' : 'red' }} title={listDetails.status === 'revisada' ? 'Marcar como Pendiente' : 'Marcar como Revisada'}>
                                {listDetails.status === 'revisada' ? <Eye size={24} /> : <EyeSlash size={24} />}
                            </span>
                        )}
                    </div>
                    <Form onSubmit={handleAdd} className="mb-3 position-relative" style={{ zIndex: 10 }}>
                        <InputGroup>
                            <Form.Control
                                type="text"
                                placeholder="Nuevo producto (con detalles)"
                                value={newItem}
                                onChange={async (e) => {
                                    const value = e.target.value;
                                    setNewItem(value);
                                    setHighlightedIndex(-1);
                                    setProductsPage(1);
                                    if (!value.trim() || !listDetails?.calendar?.family_id) {
                                        setProducts([]);
                                        return;
                                    }
                                    fetchProducts(value, 1);
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
                                onFocus={(e) => { if (products.length > 0) e.target.parentElement.classList.add("show"); }}
                                onBlur={() => { setTimeout(() => { const dropdown = document.querySelector(".autocomplete-dropdown"); if (dropdown) dropdown.style.display = "none"; }, 200); }}
                            />
                            <Form.Control type="number" value={newQuantity} onChange={(e) => setNewQuantity(parseFloat(e.target.value))} style={{ maxWidth: '80px' }} />
                            <Form.Select value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={{ maxWidth: '100px' }}>
                                <option value="piezas">piezas</option>
                                <option value="kg">kg</option>
                                <option value="g">g</option>
                                <option value="L">L</option>
                                <option value="ml">ml</option>
                            </Form.Select>
                            <Button type="submit" variant="primary" disabled={loading}>Agregar</Button>
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-add-previous">Agregar productos no comprados de otra lista</Tooltip>}
                            >
                                <Button variant="info" onClick={() => setShowPreviousItemsModal(true)}>
                                    <PlusCircle />
                                </Button>
                            </OverlayTrigger>
                        </InputGroup>
                        {products.length > 0 && newItem.trim() !== "" && (
                            <div className="autocomplete-dropdown position-absolute bg-white border rounded shadow-sm mt-1 w-100" style={{ maxHeight: "350px", overflowY: "auto" }} onMouseDown={(e) => e.preventDefault()}>
                                {products.map((p, index) => {
                                    const highlightMatch = (text, query) => {
                                        const regex = new RegExp(`(${query})`, "gi");
                                        const parts = text.split(regex);
                                        return parts.map((part, i) => part.toLowerCase() === query.toLowerCase() ? <span key={i} style={{ fontWeight: "bold", color: "#007bff" }}>{part}</span> : part);
                                    };
                                    return (
                                        <div key={p.id} className={`d-flex align-items-center p-2 hover-bg-light ${index === highlightedIndex ? "bg-light border-start border-primary border-3" : ""}`} style={{ cursor: "pointer" }} onMouseDown={() => { setNewItem(p.name); setProducts([]); }} onMouseEnter={() => setHighlightedIndex(index)}>
                                            {<img src={p.image_url ? `data:image/webp;base64,${p.image_url}` : '/img_placeholder.png'} alt={p.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, marginRight: 10 }} />}
                                            <span>{highlightMatch(p.name, newItem)}</span>
                                        </div>
                                    );
                                })}
                                <div className="d-flex justify-content-between p-2">
                                    <Button size="sm" disabled={productsPage <= 1} onClick={() => fetchProducts(newItem, productsPage - 1)}>Anterior</Button>
                                    <span>Página {productsPage} de {productsTotalPages}</span>
                                    <Button size="sm" disabled={productsPage >= productsTotalPages} onClick={() => fetchProducts(newItem, productsPage + 1)}>Siguiente</Button>
                                </div>
                            </div>
                        )}
                    </Form>

                    <hr />

                    <Form onSubmit={handleQuickAdd} className="mb-3">
                        <InputGroup>
                            <Form.Control
                                type="text"
                                placeholder="Añadir rápido..."
                                value={quickAddItemName}
                                onChange={(e) => setQuickAddItemName(e.target.value)}
                                disabled={isQuickAdding}
                            />
                            <Button type="submit" variant="success" disabled={isQuickAdding}>
                                {isQuickAdding ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : <PlusLg />}
                            </Button>
                        </InputGroup>
                    </Form>

                    <div className="d-flex justify-content-end gap-3">
                        <h5>Total Comprado: <Badge bg="success">${totalComprado.toFixed(2)}</Badge></h5>
                    </div>
                </Card.Body>
            </Card>

            <div>
                <TransitionGroup>
                    {items.map(item => (
                        <CSSTransition key={item.id} timeout={400} classNames="fade">
                            <ShoppingItemCard
                                item={item}
                                onStatusChange={handleStatus}
                                onDelete={handleDelete}
                                onImageUpload={handleImageUpload}
                                onItemUpdate={handleItemUpdate}
                                onPriceChange={handlePriceChange}
                                onShowItemBlame={handleShowItemBlame}
                                onItemCommentSubmit={handleItemCommentSubmit}
                                editingItem={editingItem}
                                setEditingItem={setEditingItem}
                                editingPrice={editingPrice}
                                setEditingPrice={setEditingPrice}
                                showItemBlame={showItemBlame}
                                itemBlames={itemBlames}
                                newItemComment={newItemComment}
                                setNewItemComment={setNewItemComment}
                                loadingItemBlame={loadingItemBlame}
                                loading={loading}
                            />
                        </CSSTransition>
                    ))}
                </TransitionGroup>
            </div>
            <div className="d-flex justify-content-center align-items-center mt-3">
                <Button variant="outline-secondary" size="sm" disabled={itemsPage <= 1} onClick={() => fetchListAndBlame(itemsPage - 1)}>Anterior</Button>
                <span className="mx-2">Página {itemsPage} de {itemsTotalPages}</span>
                <Button variant="outline-secondary" size="sm" disabled={itemsPage >= itemsTotalPages} onClick={() => fetchListAndBlame(itemsPage + 1)}>Siguiente</Button>
            </div>

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
            <PreviousItemsModal
                show={showPreviousItemsModal}
                handleClose={() => setShowPreviousItemsModal(false)}
                familyId={listDetails?.calendar?.family_id}
                listId={list.id}
                handleAddItems={handleAddItemsFromModal}
            />
        </div>
    );
}

export default ShoppingListView;