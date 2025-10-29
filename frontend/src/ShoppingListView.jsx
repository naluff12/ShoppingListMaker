import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { Button, Spinner, Form, InputGroup, Card, Badge, OverlayTrigger, Tooltip, Modal, ProgressBar, Dropdown, DropdownButton, FormControl } from 'react-bootstrap';
import React, { useState, useEffect, useMemo } from 'react';
import { Eye, EyeSlash, PlusCircle, PlusLg, PencilSquare, Funnel } from 'react-bootstrap-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import ImageUploader from './ImageUploader';
import './ShoppingListView.css'; // Importar los nuevos estilos
import PreviousItemsModal from './PreviousItemsModal'; // Importar el modal
import ShoppingItemCard from './ShoppingItemCard'; // Importar el nuevo componente
import ShoppingListItem from './ShoppingListItem';
import PriceHistoryModal from './PriceHistoryModal'; // Importar el modal de historial de precios
import ShoppingItemCardSkeleton from './ShoppingItemCardSkeleton';
import ShoppingListItemSkeleton from './ShoppingListItemSkeleton';

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
    const [newPrice, setNewPrice] = useState('');
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
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [newBudget, setNewBudget] = useState('');
    const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
    const [selectedItemForPriceHistory, setSelectedItemForPriceHistory] = useState(null);
    const [budgetDetails, setBudgetDetails] = useState({ total_estimado: 0, total_comprado: 0 });
    const [viewMode, setViewMode] = useState('card');
    const [itemsTotalCount, setItemsTotalCount] = useState(0);
    const [purchasedItemsCount, setPurchasedItemsCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState(''); // e.g., 'comprado', 'pendiente'
    const [categoryFilter, setCategoryFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [filterOptions, setFilterOptions] = useState({ categories: [], brands: [] });

    useEffect(() => {
        if (!list || !list.id) return;
        const token = localStorage.getItem('token');
        fetch(`/api/listas/${list.id}/filter-options`, { headers: { 'Authorization': 'Bearer ' + token } })
            .then(res => res.json())
            .then(data => setFilterOptions(data))
            .catch(() => setFilterOptions({ categories: [], brands: [] }));
    }, [list]);

    const fetchBudgetDetails = async () => {
        if (!list || !list.id) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/listas/${list.id}/budget-details`, { headers: { 'Authorization': 'Bearer ' + token } });
            if (res.ok) {
                const data = await res.json();
                setBudgetDetails(data);
            }
        } catch (err) {
            console.error("Error fetching budget details:", err);
        }
    };

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
            fetchBudgetDetails();
        } catch (err) {
            alert(err.message);
        } finally {
            setIsQuickAdding(false);
        }
    };

    const handleBudgetUpdate = async () => {
        const budgetValue = parseFloat(newBudget);
        if (isNaN(budgetValue) || budgetValue < 0) {
            alert("Por favor, introduce un número válido para el presupuesto.");
            return;
        }

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/listas/${list.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ budget: budgetValue })
            });
            if (!res.ok) throw new Error('Error al actualizar el presupuesto');
            const updatedList = await res.json();
            setListDetails(updatedList);
            setShowBudgetModal(false);
            setNewBudget('');
        } catch (err) {
            alert(err.message);
        }
    };

    const fetchListAndBlame = (page = 1) => {
        if (!list || !list.id) return;
        const token = localStorage.getItem('token');
        setLoading(true);

        const queryParams = new URLSearchParams({
            page: page,
            size: 10,
            search: searchTerm,
            status: statusFilter,
            category: categoryFilter,
            brand: brandFilter
        });

        const listDetailsPromise = fetch(`/api/listas/${list.id}`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json());
        const itemsPromise = fetch(`/api/listas/${list.id}/items?${queryParams.toString()}`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json());
        const blamePromise = fetch(`/api/blame/lista/${list.id}`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json());
        const purchasedCountPromise = fetch(`/api/listas/${list.id}/items?status=comprado&size=1`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json());

        Promise.all([
            listDetailsPromise,
            itemsPromise,
            blamePromise,
            purchasedCountPromise
        ])
            .then(([listData, itemsData, blameData, purchasedCountData]) => {
                setListDetails(listData);
                setItems(Array.isArray(itemsData.items) ? itemsData.items : []);
                setItemsPage(itemsData.page);
                setItemsTotalPages(Math.ceil(itemsData.total / itemsData.size));
                setItemsTotalCount(itemsData.total);
                setPurchasedItemsCount(purchasedCountData.total);
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
        const handler = setTimeout(() => {
            fetchListAndBlame();
        }, 300);
        fetchBudgetDetails();
        setItemBlames({});
        setShowItemBlame(null);
        return () => clearTimeout(handler);
    }, [list, searchTerm, statusFilter, categoryFilter, brandFilter]);

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
                body: JSON.stringify({ list_id: list.id, nombre: newItem, cantidad: newQuantity, unit: newUnit, precio_estimado: newPrice || null })
            });
            if (!res.ok) throw new Error('Error al agregar item');
            await res.json();
            setNewItem('');
            setNewQuantity(1);
            setNewUnit('piezas');
            setNewPrice('');
            fetchListAndBlame(); // Recargar todo
            fetchBudgetDetails();
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
            fetchBudgetDetails();
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
            fetchBudgetDetails();
            if (newStatus === 'comprado') {
                setPurchasedItemsCount(prev => prev + 1);
            } else {
                setPurchasedItemsCount(prev => prev - 1);
            }
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
            fetchBudgetDetails();
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

        try {
            // Solo enviar la actualización si el valor es un número válido
            if (!isNaN(parsedValue)) {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/items/${itemId}`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                        body: JSON.stringify({ [field]: parsedValue })
                    });
                if (!res.ok) throw new Error('Error al actualizar el precio');
                const updatedItem = await res.json();
                setItems(items.map(i => i.id === itemId ? updatedItem : i));
                fetchBudgetDetails();
            }
        } catch (err) {
            alert(err.message);
            fetchListAndBlame(); // Recargar en caso de error
        } finally {
            // Siempre restablecer el estado de edición para volver a mostrar la insignia
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
            fetchBudgetDetails();
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

    const handleShowPriceHistory = (item) => {
        setSelectedItemForPriceHistory(item);
        setShowPriceHistoryModal(true);
    };

    const budget = listDetails?.budget || 0;
    const budgetProgress = budget > 0 ? (budgetDetails.total_estimado / budget) * 100 : 0;
    const budgetVariant = budgetProgress > 100 ? 'danger' : budgetProgress > 75 ? 'warning' : 'success';
    const purchasedProgress = budget > 0 ? (budgetDetails.total_comprado / budget) * 100 : 0;
    const itemsProgress = itemsTotalCount > 0 ? (purchasedItemsCount / itemsTotalCount) * 100 : 0;

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

                    {/* Budget Section */}
                    <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                            <h5>Presupuesto: ${budget.toFixed(2)}</h5>
                            <Button variant="outline-primary" size="sm" onClick={() => setShowBudgetModal(true)}><PencilSquare className="me-1" /> Editar</Button>
                        </div>
                        <ProgressBar now={budgetProgress} variant={budgetVariant} label={`Estimado ${budgetProgress.toFixed(0)}%`} />
                        <div className="d-flex justify-content-between mt-1 text-muted small">
                            <span>Total Estimado: ${budgetDetails.total_estimado.toFixed(2)}</span>
                            <span>Restante: <span className={budgetDetails.total_estimado > budget ? 'text-danger' : 'text-success'}>${(budget - budgetDetails.total_estimado).toFixed(2)}</span></span>
                        </div>
                        <ProgressBar className="mt-2" now={purchasedProgress} variant="info" label={`Comprado ${purchasedProgress.toFixed(0)}%`} />
                        
                        <h5 className="mt-3">Progreso de Artículos</h5>
                        <ProgressBar now={itemsProgress} label={`${purchasedItemsCount} / ${itemsTotalCount}`} />
                    </div>
                    <hr />

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
                                            if (selected.last_price) {
                                                setNewPrice(selected.last_price);
                                            }
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
                                        <div key={p.id} className={`d-flex align-items-center p-2 hover-bg-light ${index === highlightedIndex ? "bg-light border-start border-primary border-3" : ""}`} style={{ cursor: "pointer" }} onMouseDown={() => { setNewItem(p.name); if (p.last_price) { setNewPrice(p.last_price); } setProducts([]); }} onMouseEnter={() => setHighlightedIndex(index)}>
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

                    <div className="d-flex justify-content-end gap-3">
                        <h5>Total Comprado: <Badge bg="success">${budgetDetails.total_comprado.toFixed(2)}</Badge></h5>
                    </div>
                </Card.Body>
            </Card>

            <InputGroup className="mb-3">
                <Form.Control
                    placeholder="Buscar items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <DropdownButton
                    variant="outline-secondary"
                    title={<Funnel />}
                    id="input-group-dropdown-2"
                    align="end"
                >
                    <div className="p-3" style={{ width: '250px' }}>
                        <Form.Group className="mb-3">
                            <Form.Label>Estado</Form.Label>
                            <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                <option value="">Todos</option>
                                <option value="pendiente">Pendiente</option>
                                <option value="comprado">Comprado</option>
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Categoría</Form.Label>
                            <Form.Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                                <option value="">Todas</option>
                                {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group>
                            <Form.Label>Marca</Form.Label>
                            <Form.Select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
                                <option value="">Todas</option>
                                {filterOptions.brands.map(b => <option key={b} value={b}>{b}</option>)}
                            </Form.Select>
                        </Form.Group>
                    </div>
                </DropdownButton>
            </InputGroup>

            <div className="d-flex justify-content-end mb-3">
                <Button variant="outline-secondary" size="sm" onClick={() => setViewMode('list')} active={viewMode === 'list'}>Lista</Button>
                <Button variant="outline-secondary" size="sm" onClick={() => setViewMode('card')} active={viewMode === 'card'}>Tarjetas</Button>
            </div>

            <div>
                {loading ? (
                    Array.from({ length: 5 }).map((_, index) =>
                        viewMode === 'card' ? (
                            <ShoppingItemCardSkeleton key={index} />
                        ) : (
                            <ShoppingListItemSkeleton key={index} />
                        )
                    )
                ) : (
                    <TransitionGroup>
                        {items.map(item => (
                            <CSSTransition key={item.id} timeout={400} classNames="fade">
                                {viewMode === 'card' ? (
                                    <ShoppingItemCard
                                        item={item}
                                        onStatusChange={handleStatus}
                                        onDelete={handleDelete}
                                        onImageUpload={handleImageUpload}
                                        onItemUpdate={handleItemUpdate}
                                        onPriceChange={handlePriceChange}
                                        onShowItemBlame={handleShowItemBlame}
                                        onItemCommentSubmit={handleItemCommentSubmit}
                                        onShowPriceHistory={handleShowPriceHistory}
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
                                ) : (
                                    <ShoppingListItem
                                        item={item}
                                        onStatusChange={handleStatus}
                                        onDelete={handleDelete}
                                        onImageUpload={handleImageUpload}
                                        onItemUpdate={handleItemUpdate}
                                        onPriceChange={handlePriceChange}
                                        onShowItemBlame={handleShowItemBlame}
                                        onItemCommentSubmit={handleItemCommentSubmit}
                                        onShowPriceHistory={handleShowPriceHistory}
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
                                )}
                            </CSSTransition>
                        ))}
                    </TransitionGroup>
                )}
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

            <Modal show={showBudgetModal} onHide={() => setShowBudgetModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Establecer Presupuesto</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Monto del Presupuesto</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>$</InputGroup.Text>
                            <Form.Control
                                type="number"
                                placeholder="Ej: 500.00"
                                value={newBudget}
                                onChange={(e) => setNewBudget(e.target.value)}
                                autoFocus
                            />
                        </InputGroup>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowBudgetModal(false)}>
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={handleBudgetUpdate}>
                        Guardar Presupuesto
                    </Button>
                </Modal.Footer>
            </Modal>

            <PriceHistoryModal 
                show={showPriceHistoryModal} 
                handleClose={() => setShowPriceHistoryModal(false)} 
                item={selectedItemForPriceHistory} 
            />
        </div>
    );
}

export default ShoppingListView;