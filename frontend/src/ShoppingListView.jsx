import { CSSTransition, TransitionGroup } from 'react-transition-group';
import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, PlusCircle, Pencil, Filter, ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ImageUploader from './ImageUploader';
import './ShoppingListView.css';
import PreviousItemsModal from './PreviousItemsModal';
import ShoppingItemCard from './ShoppingItemCard';
import ShoppingListItem from './ShoppingListItem';
import PriceHistoryModal from './PriceHistoryModal';
import ShoppingItemCardSkeleton from './ShoppingItemCardSkeleton';
import ShoppingListItemSkeleton from './ShoppingListItemSkeleton';
import ImageGalleryModal from './ImageGalleryModal';
import { useWebSocket } from './useWebSocket';

const API_URL = 'http://localhost:8000';

function ProgressBar({ progress, variant, label }) {
    const bgColor = variant === 'danger' ? 'var(--danger-color)' : variant === 'success' ? 'var(--success-color)' : variant === 'warning' ? 'var(--warning-color)' : 'var(--info-color, #3b82f6)';
    return (
        <div style={{ position: 'relative', width: '100%', height: '24px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
            <div style={{ height: '100%', width: `${Math.min(100, progress)}%`, backgroundColor: bgColor, transition: 'width 0.3s ease' }}></div>
            {label && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{label}</div>}
        </div>
    );
}

function ShoppingListView() {
    const location = useLocation();
    const navigate = useNavigate();
    const { listId } = useParams();

    const [items, setItems] = useState([]);
    const [listDetails, setListDetails] = useState(null);
    const [blame, setBlame] = useState([]);
    const [newItem, setNewItem] = useState('');
    const [newQuantity, setNewQuantity] = useState(1);
    const [newUnit, setNewUnit] = useState('piezas');
    const [newPrice, setNewPrice] = useState('');
    const [newBrand, setNewBrand] = useState('');
    const [newCategory, setNewCategory] = useState('');
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
    
    // Modals & Popovers
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [newBudget, setNewBudget] = useState('');
    const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
    const [selectedItemForPriceHistory, setSelectedItemForPriceHistory] = useState(null);
    const [budgetDetails, setBudgetDetails] = useState({ total_estimado: 0, total_comprado: 0 });
    const [viewMode, setViewMode] = useState('card');
    const [itemsTotalCount, setItemsTotalCount] = useState(0);
    const [purchasedItemsCount, setPurchasedItemsCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Filters
    const [showFilters, setShowFilters] = useState(false);
    const filtersRef = useRef(null);
    const [statusFilter, setStatusFilter] = useState(''); 
    const [categoryFilter, setCategoryFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [filterOptions, setFilterOptions] = useState({ categories: [], brands: [] });
    
    // App Modals
    const [showNewProductModal, setShowNewProductModal] = useState(false);
    const [modalBrand, setModalBrand] = useState('');
    const [modalCategory, setModalCategory] = useState('');
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [selectedItemForGallery, setSelectedItemForGallery] = useState(null);
    
    // WebSocket setup moved down

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filtersRef.current && !filtersRef.current.contains(event.target)) {
                setShowFilters(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!listId) return;
        const token = localStorage.getItem('token');
        fetch(`/api/listas/${listId}/filter-options`, { headers: { 'Authorization': 'Bearer ' + token } })
            .then(res => res.json())
            .then(data => setFilterOptions(data))
            .catch(() => setFilterOptions({ categories: [], brands: [] }));
    }, [listId]);

    const fetchBudgetDetails = async () => {
        if (!listId) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/listas/${listId}/budget-details`, { headers: { 'Authorization': 'Bearer ' + token } });
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
                    list_id: listId,
                    nombre: quickAddItemName,
                    cantidad: 1, 
                    unit: 'piezas' 
                })
            });
            if (!res.ok) throw new Error('Error al agregar el producto');
            await res.json();
            setQuickAddItemName('');
            fetchListAndBlame(itemsPage); 
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
            const res = await fetch(`/api/listas/${listId}`, {
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
        if (!listId) return;
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

        const listDetailsPromise = fetch(`/api/listas/${listId}`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json());
        const itemsPromise = fetch(`/api/listas/${listId}/items?${queryParams.toString()}`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json());
        const blamePromise = fetch(`/api/blame/lista/${listId}`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json());
        const purchasedCountPromise = fetch(`/api/listas/${listId}/items?status=comprado&size=1`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json());
        const totalItemsCountPromise = fetch(`/api/listas/${listId}/items?size=1`, { headers: { 'Authorization': 'Bearer ' + token } }).then(res => res.json());

        Promise.all([
            listDetailsPromise,
            itemsPromise,
            blamePromise,
            purchasedCountPromise,
            totalItemsCountPromise
        ])
            .then(([listData, itemsData, blameData, purchasedCountData, totalItemsCountData]) => {
                setListDetails(listData);
                setItems(Array.isArray(itemsData.items) ? itemsData.items : []);
                setItemsPage(itemsData.page);
                setItemsTotalPages(Math.ceil(itemsData.total / itemsData.size));
                setItemsTotalCount(totalItemsCountData.total);
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
    }, [listId, searchTerm, statusFilter, categoryFilter, brandFilter]);

    // WebSocket Integration
    const familyId = listDetails?.calendar?.family_id || null;
    const { lastMessage, isConnected } = useWebSocket(familyId);

    useEffect(() => {
        if (lastMessage) {
            // Check for list-specific updates
            if (lastMessage.list_id && lastMessage.list_id === parseInt(listId)) {
                console.log("WebSocket update received for current list UI. Trigerring refresh...", lastMessage.action);
                fetchListAndBlame(itemsPage);
                fetchBudgetDetails();
            }
            // Check for global product updates that might affect our displayed items
            if (lastMessage.type === 'product_update' && lastMessage.action === 'image_updated') {
                const affectedProduct = items.find(i => i.product_id === lastMessage.product_id);
                if (affectedProduct) {
                    console.log("WebSocket product update received for an item in this list. Refreshing...");
                    fetchListAndBlame(itemsPage);
                    fetchBudgetDetails();
                }
            }
        }
    }, [lastMessage]);

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

    const proceedWithAdd = async (brand = '', category = '') => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/items/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ 
                    list_id: listId, 
                    nombre: newItem, 
                    cantidad: newQuantity, 
                    unit: newUnit, 
                    precio_estimado: newPrice || null,
                    brand: brand,
                    category: category
                })
            });
            if (!res.ok) throw new Error('Error al agregar item');
            await res.json();

            if (brand && !filterOptions.brands.includes(brand)) {
                setFilterOptions(prev => ({ ...prev, brands: [...prev.brands, brand] }));
            }
            if (category && !filterOptions.categories.includes(category)) {
                setFilterOptions(prev => ({ ...prev, categories: [...prev.categories, category] }));
            }

            setNewItem('');
            setNewQuantity(1);
            setNewUnit('piezas');
            setNewPrice('');
            setNewBrand('');
            setNewCategory('');
            fetchListAndBlame();
            fetchBudgetDetails();
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newItem) return;

        const token = localStorage.getItem('token');
        const searchRes = await fetch(`/api/products/search?family_id=${listDetails.calendar.family_id}&q=${encodeURIComponent(newItem)}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const searchData = await searchRes.json();
        
        const existingProduct = searchData.items.find(p => p.name.toLowerCase() === newItem.toLowerCase());

        if (!existingProduct) {
            setModalBrand('');
            setModalCategory('');
            setShowNewProductModal(true);
        } else {
            proceedWithAdd(existingProduct.brand, existingProduct.category);
        }
    };

    const handleAddItemsFromModal = async (itemsToAdd) => {
        if (!listId) return;
        const token = localStorage.getItem('token');
        const items = itemsToAdd.map(item => ({
            nombre: item.nombre,
            cantidad: item.cantidad,
            unit: item.unit,
            comentario: item.comentario,
            precio_estimado: item.precio_estimado,
        }));

        try {
            await fetch(`/api/listas/${listId}/items/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ items })
            });
            fetchListAndBlame(); 
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
            fetchListAndBlame(); 
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
            const res = await fetch(`/api/listas/${listId}/blames`,
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
            fetchListAndBlame(); 
        } finally {
            setEditingPrice(null);
        }
    };

    const handleListStatusChange = async () => {
        const newStatus = listDetails.status === 'revisada' ? 'pendiente' : 'revisada';
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/listas/${listId}`, {
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
            const res = await fetch(`${API_URL}/items/${itemId}/upload-image`, {
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

    const handleShowGallery = (item) => {
        setSelectedItemForGallery(item);
        setShowGalleryModal(true);
    };

    const handleImageSelect = async (image) => {
        if (!selectedItemForGallery) return;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_URL}/items/${selectedItemForGallery.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({
                    shared_image_id: image.id
                })
            });
            if (!res.ok) throw new Error('Error al actualizar la imagen del item');
            const updatedItem = await res.json();
            setItems(items.map(i => i.id === selectedItemForGallery.id ? updatedItem : i));
            setShowGalleryModal(false);
        } catch (err) {
            alert(err.message);
        }
    };

    const budget = listDetails?.budget || 0;
    const budgetProgress = budget > 0 ? (budgetDetails.total_estimado / budget) * 100 : 0;
    const budgetVariant = budgetProgress > 100 ? 'danger' : budgetProgress > 75 ? 'warning' : 'success';
    const purchasedProgress = budget > 0 ? (budgetDetails.total_comprado / budget) * 100 : 0;
    const itemsProgress = itemsTotalCount > 0 ? (purchasedItemsCount / itemsTotalCount) * 100 : 0;

    return (
        <div className="app-container animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
            
            <button className="btn-premium btn-secondary mb-4" onClick={() => navigate('/calendar', { state: { calendar: listDetails?.calendar } })} style={{ display: 'inline-flex', padding: '8px 16px' }}>
                <ArrowLeft size={18} /> Volver
            </button>
            
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 className="text-gradient" style={{ margin: 0, fontSize: '2.5rem' }}>{listDetails?.name || ''}</h2>
                    {listDetails && (
                        <div 
                            onClick={handleListStatusChange} 
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: 'var(--border-radius-md)', background: listDetails.status === 'revisada' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: listDetails.status === 'revisada' ? 'var(--success-color)' : 'var(--danger-color)', transition: 'all 0.3s ease' }} 
                            title={listDetails.status === 'revisada' ? 'Marcar como Pendiente' : 'Marcar como Revisada'}
                        >
                            {listDetails.status === 'revisada' ? <><Eye size={20} /> <span style={{ fontWeight: 600 }}>Revisada</span></> : <><EyeOff size={20} /> <span style={{ fontWeight: 600 }}>No Revisada</span></>}
                        </div>
                    )}
                </div>

                {/* Budget Section */}
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '24px', borderRadius: 'var(--border-radius-lg)', marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem' }}>Presupuesto: ${budget.toFixed(2)}</h4>
                        <button className="btn-premium btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowBudgetModal(true)}>
                            <Pencil size={16} /> Editar
                        </button>
                    </div>
                    
                    <ProgressBar progress={budgetProgress} variant={budgetVariant} label={`Estimado ${budgetProgress.toFixed(0)}%`} />
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 500 }}>Total Estimado: ${budgetDetails.total_estimado.toFixed(2)}</span>
                        <span>Restante: <span style={{ fontWeight: 600, color: budgetDetails.total_estimado > budget ? 'var(--danger-color)' : 'var(--success-color)' }}>${(budget - budgetDetails.total_estimado).toFixed(2)}</span></span>
                    </div>
                    
                    <div style={{ marginTop: '24px' }}>
                        <ProgressBar progress={purchasedProgress} variant="info" label={`Comprado ${purchasedProgress.toFixed(0)}%`} />
                    </div>
                    
                    <div style={{ marginTop: '24px' }}>
                        <h5 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Progreso de Artículos</h5>
                        <ProgressBar progress={itemsProgress} variant="success" label={`${purchasedItemsCount} / ${itemsTotalCount}`} />
                    </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border-color)', margin: '32px 0' }} />

                <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', position: 'relative', zIndex: 10 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <input
                            type="text"
                            className="premium-input"
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
                                        setNewBrand(selected.brand);
                                        setNewCategory(selected.category);
                                        setProducts([]);
                                    }
                                }
                            }}
                            onBlur={() => { setTimeout(() => { setProducts([]); }, 200); }}
                        />
                        {products.length > 0 && newItem.trim() !== "" && (
                            <div className="dropdown-menu show" style={{ position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '4px', maxHeight: "350px", overflowY: "auto", padding: '8px' }} onMouseDown={(e) => e.preventDefault()}>
                                {products.map((p, index) => {
                                    return (
                                        <div 
                                            key={p.id} 
                                            className="dropdown-item" 
                                            style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: index === highlightedIndex ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '4px', cursor: 'pointer', marginBottom: '4px' }}
                                            onMouseDown={() => { setNewItem(p.name); if (p.last_price) { setNewPrice(p.last_price); } setNewBrand(p.brand); setNewCategory(p.category); setProducts([]); }} 
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                        >
                                            <img src={p.shared_image ? `${API_URL}${p.shared_image.file_path}` : '/img_placeholder.png'} alt={p.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, marginRight: 12, background: 'rgba(255,255,255,0.05)' }} />
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{p.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.brand} / {p.category}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderTop: '1px solid var(--border-color)', marginTop: '8px' }}>
                                    <button type="button" className="btn-premium btn-secondary" style={{ padding: '2px 8px', fontSize: '0.8rem' }} disabled={productsPage <= 1} onClick={() => fetchProducts(newItem, productsPage - 1)}>Anterior</button>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Página {productsPage} de {productsTotalPages}</span>
                                    <button type="button" className="btn-premium btn-secondary" style={{ padding: '2px 8px', fontSize: '0.8rem' }} disabled={productsPage >= productsTotalPages} onClick={() => fetchProducts(newItem, productsPage + 1)}>Siguiente</button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <input type="number" className="premium-input" value={newQuantity} onChange={(e) => setNewQuantity(parseFloat(e.target.value))} style={{ width: '80px', flex: 'none' }} min="1" step="any" />
                    
                    <select className="premium-input" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={{ width: '120px', flex: 'none' }}>
                        <option value="piezas">piezas</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="L">L</option>
                        <option value="ml">ml</option>
                    </select>
                    
                    <button type="submit" className="btn-premium btn-primary" disabled={loading} style={{ padding: '8px 24px' }}>Agregar</button>
                    
                    <button type="button" className="btn-premium" style={{ background: 'var(--info-color)', padding: '8px 16px' }} title="Agregar productos no comprados de otra lista" onClick={() => setShowPreviousItemsModal(true)}>
                        <PlusCircle size={20} color="white" />
                    </button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
                    <h5 style={{ margin: 0, fontWeight: 600 }}>Total Comprado: <span className="badge" style={{ background: 'var(--success-color)', fontSize: '1.2rem', padding: '6px 12px' }}>${budgetDetails.total_comprado.toFixed(2)}</span></h5>
                </div>
            </div>

            {/* Filtering and View Options */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '300px', position: 'relative' }} ref={filtersRef}>
                    <input
                        type="text"
                        className="premium-input"
                        placeholder="Buscar items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <button className="btn-premium btn-secondary" onClick={() => setShowFilters(!showFilters)}>
                        <Filter size={20} />
                    </button>
                    
                    {showFilters && (
                        <div className="glass-panel" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 100, width: '300px', padding: '16px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Estado</label>
                                <select className="premium-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                    <option value="">Todos</option>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="comprado">Comprado</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Categoría</label>
                                <select className="premium-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                                    <option value="">Todas</option>
                                    {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Marca</label>
                                <select className="premium-input" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
                                    <option value="">Todas</option>
                                    {filterOptions.brands.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className={`btn-premium ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')} style={{ padding: '6px 16px' }}>
                        Lista
                    </button>
                    <button className={`btn-premium ${viewMode === 'card' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('card')} style={{ padding: '6px 16px' }}>
                        Tarjetas
                    </button>
                </div>
            </div>

            {/* Items List */}
            <div>
                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'card' ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr', gap: '16px' }}>
                        {Array.from({ length: 5 }).map((_, index) =>
                            viewMode === 'card' ? (
                                <ShoppingItemCardSkeleton key={index} />
                            ) : (
                                <ShoppingListItemSkeleton key={index} />
                            )
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'card' ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr', gap: '24px' }}>
                        <TransitionGroup component={null}>
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
                                            onShowGallery={handleShowGallery}
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
                                            onProductUpdate={() => fetchListAndBlame(itemsPage)}
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
                                            onShowGallery={handleShowGallery}
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
                                            onProductUpdate={() => fetchListAndBlame(itemsPage)}
                                        />
                                    )}
                                </CSSTransition>
                            ))}
                        </TransitionGroup>
                    </div>
                )}
            </div>
            
            {itemsTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '32px', gap: '16px' }}>
                    <button className="btn-premium btn-secondary" disabled={itemsPage <= 1} onClick={() => fetchListAndBlame(itemsPage - 1)} style={{ padding: '8px' }}>
                        <ChevronLeft size={20} />
                    </button>
                    <span style={{ fontWeight: 500 }}>Página {itemsPage} de {itemsTotalPages}</span>
                    <button className="btn-premium btn-secondary" disabled={itemsPage >= itemsTotalPages} onClick={() => fetchListAndBlame(itemsPage + 1)} style={{ padding: '8px' }}>
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}

            {/* List Comments */}
            <div className="glass-panel" style={{ marginTop: '48px', padding: '24px' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Comentarios de la lista</h3>
                
                {blame.length === 0 ? (
                    <div className="alert-info" style={{ marginBottom: '24px' }}>Sin historial de comentarios</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                        {blame.map(b => (
                            <div key={b.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--border-radius-md)', borderLeft: '4px solid var(--primary-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontWeight: 600 }}>{b.user && b.user.username ? b.user.username : 'Usuario'} {b.action}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{b.timestamp ? new Date(b.timestamp).toLocaleString() : ''}</span>
                                </div>
                                <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>{b.detalles}</div>
                            </div>
                        ))}
                    </div>
                )}
                
                <form onSubmit={handleListCommentSubmit} style={{ display: 'flex', gap: '12px' }}>
                    <input type="text" className="premium-input" placeholder="Nuevo comentario para la lista" value={newListComment} onChange={e => setNewListComment(e.target.value)} />
                    <button type="submit" className="btn-premium btn-primary" style={{ padding: '8px 24px' }}>Comentar</button>
                </form>
            </div>

            {/* Modals */}
            <PreviousItemsModal
                show={showPreviousItemsModal}
                handleClose={() => setShowPreviousItemsModal(false)}
                familyId={listDetails?.calendar?.family_id}
                listId={listId}
                handleAddItems={handleAddItemsFromModal}
            />

            {/* Budget Modal - Vanilla Implementation */}
            {showBudgetModal && ReactDOM.createPortal(
                <div className="modal-backdrop" onClick={() => setShowBudgetModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h5 className="modal-title">Establecer Presupuesto</h5>
                            <button className="modal-close" onClick={() => setShowBudgetModal(false)}><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Monto del Presupuesto</label>
                            <div style={{ display: 'flex', position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--text-secondary)' }}>$</div>
                                <input
                                    type="number"
                                    className="premium-input"
                                    style={{ paddingLeft: '32px' }}
                                    placeholder="Ej: 500.00"
                                    value={newBudget}
                                    onChange={(e) => setNewBudget(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-premium btn-secondary" onClick={() => setShowBudgetModal(false)}>Cancelar</button>
                            <button className="btn-premium btn-primary" onClick={handleBudgetUpdate}>Guardar Presupuesto</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <PriceHistoryModal 
                show={showPriceHistoryModal} 
                handleClose={() => setShowPriceHistoryModal(false)} 
                item={selectedItemForPriceHistory} 
            />

            {/* New Product Modal - Vanilla Implementation */}
            {showNewProductModal && ReactDOM.createPortal(
                <div className="modal-backdrop" onClick={() => setShowNewProductModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h5 className="modal-title">Producto Nuevo</h5>
                            <button className="modal-close" onClick={() => setShowNewProductModal(false)}><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="alert-info" style={{ marginBottom: '24px' }}>
                                '{newItem}' parece ser un producto nuevo. Si lo deseas, puedes agregar una marca y categoría para ayudar a organizarlo.
                            </div>
                            
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Marca</label>
                                <input type="text" className="premium-input" value={modalBrand} onChange={(e) => setModalBrand(e.target.value)} placeholder="Ej. Nestlé, Coca-Cola..." />
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Categoría</label>
                                <input type="text" className="premium-input" value={modalCategory} onChange={(e) => setModalCategory(e.target.value)} placeholder="Ej. Lácteos, Bebidas..." />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ gap: '16px' }}>
                            <button className="btn-premium btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={() => {
                                setShowNewProductModal(false);
                                proceedWithAdd();
                            }}>
                                Agregar sin detalles
                            </button>
                            <button className="btn-premium btn-primary" style={{ flex: 1, padding: '10px' }} onClick={() => {
                                setShowNewProductModal(false);
                                proceedWithAdd(modalBrand, modalCategory);
                            }}>
                                Guardar y Agregar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <ImageGalleryModal
                show={showGalleryModal}
                handleClose={() => setShowGalleryModal(false)}
                handleSelectImage={handleImageSelect}
            />

        </div>
    );
}

export default ShoppingListView;