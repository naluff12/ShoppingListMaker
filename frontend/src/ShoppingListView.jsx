import { CSSTransition, TransitionGroup } from 'react-transition-group';
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Eye, EyeOff, PlusCircle, Pencil, Filter, ArrowLeft, ChevronLeft, ChevronRight, X, ShoppingBag, Globe, Star } from 'lucide-react';
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
import { API_BASE_URL } from './config';
import ShoppingModeItem from './ShoppingModeItem';

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
    const [selectedItems, setSelectedItems] = useState(new Set());
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
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [suggestedProducts, setSuggestedProducts] = useState([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [suggestionAddLoading, setSuggestionAddLoading] = useState(null);
    const [favoriteProducts, setFavoriteProducts] = useState([]);
    const [favoritesLoading, setFavoritesLoading] = useState(false);
    const [groupByCategory, setGroupByCategory] = useState(false);
    const quickAddInputRef = useRef(null);

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
    const [isShoppingMode, setIsShoppingMode] = useState(false);
    const [hidePurchased, setHidePurchased] = useState(false);
    const [sortOption, setSortOption] = useState('default');
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [toast, setToast] = useState(null); // { message, type }
    const [showStoreUrlModal, setShowStoreUrlModal] = useState(false);
    const [storeUrlInput, setStoreUrlInput] = useState('');
    const [storeUrlLoading, setStoreUrlLoading] = useState(false);
    const [storeConnectors, setStoreConnectors] = useState([]);
    const [selectedStoreConnectorId, setSelectedStoreConnectorId] = useState(null);
    const [storePreview, setStorePreview] = useState(null);
    const [storePreviewLoading, setStorePreviewLoading] = useState(false);
    const [storePreviewError, setStorePreviewError] = useState(null);

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const visibleItems = hidePurchased ? items.filter(i => i.status !== 'comprado') : items;

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

    const sortedItems = React.useMemo(() => {
        const base = visibleItems.slice();
        const getPrice = (item) => {
            return item.precio_confirmado ?? item.product?.last_price ?? 0;
        };

        switch (sortOption) {
            case 'name_asc':
                return base.sort((a, b) => a.nombre.localeCompare(b.nombre));
            case 'name_desc':
                return base.sort((a, b) => b.nombre.localeCompare(a.nombre));
            case 'qty_asc':
                return base.sort((a, b) => (a.cantidad ?? 0) - (b.cantidad ?? 0));
            case 'qty_desc':
                return base.sort((a, b) => (b.cantidad ?? 0) - (a.cantidad ?? 0));
            case 'price_asc':
                return base.sort((a, b) => getPrice(a) - getPrice(b));
            case 'price_desc':
                return base.sort((a, b) => getPrice(b) - getPrice(a));
            default:
                return base;
        }
    }, [visibleItems, sortOption]);

    const groupedItems = React.useMemo(() => {
        if (!groupByCategory) return [];
        const groups = {};
        sortedItems.forEach(item => {
            const category = item.product?.category?.trim() || item.category?.trim() || 'Sin categoría';
            if (!groups[category]) groups[category] = [];
            groups[category].push(item);
        });
        return Object.entries(groups).map(([category, items]) => ({ category, items }));
    }, [sortedItems, groupByCategory]);

    const categorySummary = React.useMemo(() => {
        const summary = {};
        items.forEach(item => {
            const category = item.product?.category?.trim() || item.category?.trim() || 'Sin categoría';
            const qty = Number(item.cantidad ?? 1) || 1;
            const unitPrice = Number(item.precio_confirmado ?? item.product?.last_price ?? item.precio_estimado ?? 0) || 0;
            if (!summary[category]) summary[category] = { count: 0, quantity: 0, total: 0 };
            summary[category].count += 1;
            summary[category].quantity += qty;
            summary[category].total += unitPrice * qty;
        });
        return Object.entries(summary)
            .map(([category, data]) => ({ category, ...data }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [items]);

    const renderItemCard = (item) => (
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
                    isSelected={selectedItems.has(item.id)}
                    onSelect={() => toggleItemSelection(item.id)}
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
                    isSelected={selectedItems.has(item.id)}
                    onSelect={() => toggleItemSelection(item.id)}
                />
            )}
        </CSSTransition>
    );

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
        fetch(`/api/listas/${listId}/filter-options`)
            .then(res => res.json())
            .then(data => setFilterOptions(data))
            .catch(() => setFilterOptions({ categories: [], brands: [] }));
    }, [listId]);

    useEffect(() => {
        const fetchStoreConnectors = async () => {
            try {
                const res = await fetch('/api/stores/connectors?active_only=true');
                if (!res.ok) throw new Error('No se pudieron cargar los conectores');
                const data = await res.json();
                setStoreConnectors(data);
                const defaultConnector = data.find(c => c.is_default) || data[0];
                if (defaultConnector) {
                    setSelectedStoreConnectorId(defaultConnector.id);
                }
            } catch (err) {
                console.error(err);
                setStoreConnectors([]);
            }
        };
        fetchStoreConnectors();
    }, []);

    const fetchBudgetDetails = async () => {
        if (!listId) return;
        try {
            const res = await fetch(`/api/listas/${listId}/budget-details`);
            if (res.ok) {
                const data = await res.json();
                setBudgetDetails(data);
            }
        } catch (err) {
            console.error("Error fetching budget details:", err);
        }
    };

    const fetchTemplates = async () => {
        const familyId = listDetails?.calendar?.family_id;
        if (!familyId) return;
        setTemplatesLoading(true);
        try {
            const res = await fetch(`/api/families/${familyId}/templates`);
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (err) {
            console.error('Error fetching templates:', err);
        } finally {
            setTemplatesLoading(false);
        }
    };

    const fetchSuggestedProducts = async () => {
        const familyId = listDetails?.calendar?.family_id;
        if (!familyId) return;
        setSuggestionsLoading(true);
        try {
            const res = await fetch(`/api/families/${familyId}/suggested-products`);
            if (!res.ok) throw new Error('No se pudieron obtener sugerencias');
            const data = await res.json();
            setSuggestedProducts(data);
        } catch (err) {
            console.error('Error fetching suggested products:', err);
            setSuggestedProducts([]);
        } finally {
            setSuggestionsLoading(false);
        }
    };

    const fetchFavoriteProducts = async () => {
        const familyId = listDetails?.calendar?.family_id;
        if (!familyId) return;
        setFavoritesLoading(true);
        try {
            const res = await fetch(`/api/families/${familyId}/favorite-products`);
            if (!res.ok) throw new Error('No se pudieron cargar los favoritos');
            const data = await res.json();
            setFavoriteProducts(data);
        } catch (err) {
            console.error('Error fetching favorite products:', err);
            setFavoriteProducts([]);
        } finally {
            setFavoritesLoading(false);
        }
    };

    useEffect(() => {
        if (listDetails?.calendar?.family_id) {
            fetchSuggestedProducts();
            fetchFavoriteProducts();
        }
    }, [listDetails?.calendar?.family_id]);

    const handleToggleFavorite = async (product) => {
        try {
            const res = await fetch(`/api/products/${product.id}/favorite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ favorite: !product.is_favorite })
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'No se pudo actualizar el favorito');
            }
            const updated = await res.json();
            setFavoriteProducts(prev => {
                if (updated.is_favorite) {
                    return [updated, ...prev.filter(p => p.id !== updated.id)];
                }
                return prev.filter(p => p.id !== updated.id);
            });
            setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
            setSuggestedProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Error actualizando favorito', 'error');
        }
    };

    const handleAddFavorite = async (product) => {
        if (!listId) return;
        setSuggestionAddLoading(product.id);
        try {
            const body = {
                nombre: product.name,
                cantidad: 1,
                unit: 'piezas',
                list_id: parseInt(listId),
                category: product.category,
                brand: product.brand,
                precio_estimado: product.last_price ?? undefined
            };
            const res = await fetch('/api/items/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'No se pudo agregar el producto favorito');
            }
            await res.json();
            showToast(`'${product.name}' agregado a la lista`, 'success');
            fetchListAndBlame(itemsPage);
            fetchBudgetDetails();
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Error al agregar favorito', 'error');
        } finally {
            setSuggestionAddLoading(null);
        }
    };

    const handleAddSuggestedProduct = async (product) => {
        if (!listId) return;
        setSuggestionAddLoading(product.id);
        try {
            const body = {
                nombre: product.name,
                cantidad: 1,
                unit: 'piezas',
                list_id: parseInt(listId),
                category: product.category,
                brand: product.brand,
                precio_estimado: product.last_price ?? undefined
            };
            const res = await fetch('/api/items/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'No se pudo agregar el producto sugerido');
            }
            await res.json();
            showToast(`'${product.name}' agregado a la lista`, 'success');
            fetchListAndBlame(itemsPage);
            fetchBudgetDetails();
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Error al agregar sugerencia', 'error');
        } finally {
            setSuggestionAddLoading(null);
        }
    };

    const handleOpenTemplates = async () => {
        await fetchTemplates();
        setShowTemplateModal(true);
    };

    const handleSaveTemplate = async () => {
        if (!templateName.trim() || !listId) return;
        try {
            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: templateName, description: templateDescription, list_id: parseInt(listId) })
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'No se pudo guardar la plantilla');
            }
            setTemplateName('');
            setTemplateDescription('');
            setShowSaveTemplateModal(false);
            showToast('Plantilla guardada con éxito', 'success');
            await fetchTemplates();
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Error guardando la plantilla', 'danger');
        }
    };

    const handleApplyTemplate = async (templateId) => {
        if (!templateId || !listId) return;
        try {
            const res = await fetch(`/api/templates/${templateId}/apply?list_id=${listId}`, {
                method: 'POST'
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'No se pudo aplicar la plantilla');
            }
            setShowTemplateModal(false);
            showToast('Plantilla aplicada a la lista', 'success');
            fetchListAndBlame(itemsPage);
            fetchBudgetDetails();
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Error aplicando la plantilla', 'danger');
        }
    };

    const handleOpenSaveTemplateModal = () => {
        setTemplateName('');
        setTemplateDescription('');
        setShowSaveTemplateModal(true);
    };

    const handleCloseSaveTemplateModal = () => {
        setShowSaveTemplateModal(false);
    };

    const handleCloseTemplatesModal = () => {
        setShowTemplateModal(false);
    };

    const handleQuickAdd = async (e) => {
        e.preventDefault();
        if (!quickAddItemName.trim()) return;

        setIsQuickAdding(true);
        try {
            const res = await fetch(`/api/items/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            showToast(err.message, 'error');
        } finally {
            setIsQuickAdding(false);
        }
    };
    const handleBudgetUpdate = async () => {
        const budgetValue = parseFloat(newBudget);
        if (isNaN(budgetValue) || budgetValue < 0) {
            showToast("Por favor, introduce un número válido para el presupuesto.", 'error');
            return;
        }

        try {
            const res = await fetch(`/api/listas/${listId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ budget: budgetValue })
            });
            if (!res.ok) throw new Error('Error al actualizar el presupuesto');
            const updatedList = await res.json();
            setListDetails(updatedList);
            setShowBudgetModal(false);
            setNewBudget('');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const fetchListAndBlame = (page = 1) => {
        if (!listId) return;
        const effectiveStatus = isShoppingMode && hidePurchased ? 'pendiente' : statusFilter;
        const queryParams = new URLSearchParams({
            page: page,
            size: 10,
            search: searchTerm,
            status: effectiveStatus,
            category: categoryFilter,
            brand: brandFilter
        });
        setLoading(true);

        const listDetailsPromise = fetch(`/api/listas/${listId}`).then(res => res.json());
        const itemsPromise = fetch(`/api/listas/${listId}/items?${queryParams.toString()}`).then(res => res.json());
        const blamePromise = fetch(`/api/blame/lista/${listId}`).then(res => res.json());
        const purchasedCountPromise = fetch(`/api/listas/${listId}/items?status=comprado&size=1`).then(res => res.json());
        const totalItemsCountPromise = fetch(`/api/listas/${listId}/items?size=1`).then(res => res.json());

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
                setSelectedItems(new Set());
                setItemsPage(itemsData.page);
                setItemsTotalPages(Math.ceil(itemsData.total / itemsData.size));
                setItemsTotalCount(totalItemsCountData.total);
                setPurchasedItemsCount(purchasedCountData.total);
                setBlame(Array.isArray(blameData) ? blameData : []);
                if (listData.calendar && listData.calendar.family_id) {
                    fetch(`/api/families/${listData.calendar.family_id}/products`)
                        .then(res => res.json())
                        .then(data => setProducts(data.items))
                        .catch(() => setProducts([]));
                }
            })
            .catch(err => {
                console.error("Error fetching list data:", err);
                showToast("No se pudo cargar la información de la lista.", 'error');
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
    }, [listId, searchTerm, statusFilter, categoryFilter, brandFilter, hidePurchased]);

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
        try {
            const res = await fetch(`/api/blame/item/${itemId}`);
            const data = await res.json();
            setItemBlames(prev => ({ ...prev, [itemId]: Array.isArray(data) ? data : [] }));
            setShowItemBlame(itemId);
        } catch (err) {
            showToast('Error al cargar el historial del ítem', 'error');
        } finally {
            setLoadingItemBlame(false);
        }
    };

    const proceedWithAdd = async (brand = '', category = '') => {
        setLoading(true);
        try {
            const res = await fetch(`/api/items/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newItem) return;

        const searchRes = await fetch(`/api/products/search?family_id=${listDetails.calendar.family_id}&q=${encodeURIComponent(newItem)}`);
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

    const handlePreviewStoreUrl = async () => {
        if (!storeUrlInput.trim()) {
            showToast('Ingresa una URL de producto', 'error');
            return;
        }
        setStorePreviewLoading(true);
        setStorePreview(null);
        setStorePreviewError(null);
        try {
            const res = await fetch('/api/stores/extract-product', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: storeUrlInput,
                    connector_id: selectedStoreConnectorId
                })
            });
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || 'Error al obtener la vista previa');
            }
            const data = await res.json();
            setStorePreview(data);
        } catch (err) {
            setStorePreviewError(err.message || 'Error al obtener la vista previa');
        } finally {
            setStorePreviewLoading(false);
        }
    };

    const handleAddByUrl = async () => {
        if (!storeUrlInput.trim()) {
            showToast('Ingresa una URL de producto', 'error');
            return;
        }
        setStoreUrlLoading(true);
        try {
            const res = await fetch('/api/items/add-by-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    list_id: listId,
                    url: storeUrlInput,
                    connector_id: selectedStoreConnectorId,
                    cantidad: newQuantity,
                    unit: newUnit,
                    comentario: newItemComment
                })
            });
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || 'Error al agregar desde URL');
            }
            await res.json();
            setStoreUrlInput('');
            setStorePreview(null);
            setStorePreviewError(null);
            setShowStoreUrlModal(false);
            fetchListAndBlame();
            fetchBudgetDetails();
            showToast('Producto agregado desde la tienda', 'success');
        } catch (err) {
            showToast(err.message || 'Error al agregar desde URL', 'error');
        } finally {
            setStoreUrlLoading(false);
        }
    };

    const handleAddItemsFromModal = async (itemsToAdd) => {
        if (!listId) return;
        try {
            await fetch(`/api/listas/${listId}/items/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: itemsToAdd })
            });
            fetchListAndBlame();
            fetchBudgetDetails();
            showToast('Items agregados a la lista', 'success');
        } catch (err) {
            showToast('Error al agregar items a la lista', 'error');
        }
    };

    const handleStatus = async (id, status) => {
        const newStatus = status === 'comprado' ? 'pendiente' : 'comprado';
        try {
            const res = await fetch(`/api/items/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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
                const resHist = await fetch(`/api/blame/item/${id}`);
                const dataHist = await resHist.json();
                setItemBlames(prev => ({ ...prev, [id]: Array.isArray(dataHist) ? dataHist : [] }));
            }
        } catch (err) {
            showToast(err.message, 'error');
            fetchListAndBlame();
        }
    };

    const handleDelete = async (id) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/items/${id}`,
                {
                    method: 'DELETE',
                });
            if (!res.ok) throw new Error('Error al eliminar item');
            fetchListAndBlame();
            fetchBudgetDetails();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const toggleItemSelection = (id) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAllVisible = () => {
        const allIds = visibleItems.map(i => i.id);
        setSelectedItems(new Set(allIds));
    };

    const clearSelection = () => setSelectedItems(new Set());

    const bulkUpdateStatus = async (ids, status, confirmMessage, successMessage) => {
        if (!ids || ids.length === 0) return;
        if (!window.confirm(confirmMessage)) return;
        setBulkActionLoading(true);
        try {
            await Promise.all(ids.map(id =>
                fetch(`/api/items/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status })
                })
            ));
            clearSelection();
            fetchListAndBlame(itemsPage);
            fetchBudgetDetails();
            if (successMessage) showToast(successMessage, 'success');
        } catch (err) {
            showToast('Error al actualizar algunos ítems', 'error');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkMarkPurchased = () => {
        const ids = Array.from(selectedItems);
        bulkUpdateStatus(ids, 'comprado', `¿Marcar ${ids.length} artículos como comprados?`, 'Se marcaron los artículos como comprados');
    };

    const handleBulkResetPending = () => {
        const ids = Array.from(selectedItems);
        bulkUpdateStatus(ids, 'pendiente', `¿Restablecer ${ids.length} artículos a pendiente?`, 'Se restablecieron los artículos a pendiente');
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedItems);
        if (!ids.length) return;
        if (!window.confirm(`¿Eliminar ${ids.length} artículos seleccionados?`)) return;
        setBulkActionLoading(true);
        try {
            await Promise.all(ids.map(id =>
                fetch(`/api/items/${id}`, {
                    method: 'DELETE'
                })
            ));
            clearSelection();
            fetchListAndBlame(itemsPage);
            fetchBudgetDetails();
            showToast('Se eliminaron los artículos seleccionados', 'success');
        } catch (err) {
            showToast('Error al eliminar algunos ítems', 'error');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkMarkAllPurchased = () => {
        const ids = visibleItems.map(i => i.id);
        bulkUpdateStatus(ids, 'comprado', `¿Marcar todos los artículos visibles (${ids.length}) como comprados?`, 'Se marcaron todos los artículos visibles como comprados');
    };

    const handleBulkResetAllPending = () => {
        const ids = visibleItems.map(i => i.id);
        bulkUpdateStatus(ids, 'pendiente', `¿Restablecer todos los artículos visibles (${ids.length}) a pendiente?`, 'Se restablecieron todos los artículos visibles a pendiente');
    };

    const handleItemCommentSubmit = async (itemId) => {
        if (!newItemComment) return;
        try {
            const res = await fetch(`/api/items/${itemId}/blames`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
            showToast(err.message, 'error');
        }
    };

    const handleListCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newListComment) return;
        try {
            const res = await fetch(`/api/listas/${listId}/blames`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ detalles: newListComment })
                });
            if (!res.ok) throw new Error('Error al agregar comentario a la lista');
            const nuevo = await res.json();
            setBlame(prev => [...prev, nuevo]);
            setNewListComment('');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handlePriceChange = async (itemId, field, value) => {
        const parsedValue = parseFloat(value);

        try {
            if (!isNaN(parsedValue)) {
                const res = await fetch(`/api/items/${itemId}`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ [field]: parsedValue })
                    });
                if (!res.ok) throw new Error('Error al actualizar el precio');
                const updatedItem = await res.json();
                setItems(items.map(i => i.id === itemId ? updatedItem : i));
                fetchBudgetDetails();
            }
        } catch (err) {
            showToast(err.message, 'error');
            fetchListAndBlame();
        } finally {
            setEditingPrice(null);
        }
    };

    const handleListStatusChange = async () => {
        const newStatus = listDetails.status === 'revisada' ? 'pendiente' : 'revisada';
        try {
            const res = await fetch(`/api/listas/${listId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error('Error al actualizar estado de la lista');
            const updatedList = await res.json();
            setListDetails(updatedList);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleImageUpload = async (itemId, file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`${API_BASE_URL}/api/items/${itemId}/upload-image`, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) throw new Error('Error al subir la imagen');
            const updatedItem = await res.json();
            setItems(items.map(i => i.id === itemId ? updatedItem : i));
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    // Legacy compatibility: some render paths might still refer to `onImageUpload`.
    const onImageUpload = handleImageUpload;

    const handleItemUpdate = async (itemId, data) => {
        try {
            const currentItem = items.find(i => i.id === itemId);
            const res = await fetch(`/api/items/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Error al actualizar el item');
            const updatedItem = await res.json();
            setItems(items.map(i => i.id === itemId ? updatedItem : i));
            setEditingItem(null);
            fetchBudgetDetails();
            if (data.status && currentItem) {
                const wasComprado = currentItem.status === 'comprado';
                const isComprado = data.status === 'comprado';
                if (!wasComprado && isComprado) setPurchasedItemsCount(prev => prev + 1);
                else if (wasComprado && !isComprado) setPurchasedItemsCount(prev => prev - 1);
            }
        } catch (err) {
            showToast(err.message, 'error');
            fetchListAndBlame();
        }
    };

    const fetchProducts = async (query, page = 1) => {
        if (!query.trim() || !listDetails?.calendar?.family_id) {
            setProducts([]);
            return;
        }
        try {
            const res = await fetch(
                `/api/products/search?family_id=${listDetails.calendar.family_id}&q=${encodeURIComponent(query)}&page=${page}&size=5`
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

        try {
            const res = await fetch(`${API_BASE_URL}/api/items/${selectedItemForGallery.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shared_image_id: image.id
                })
            });
            if (!res.ok) throw new Error('Error al actualizar la imagen del item');
            const updatedItem = await res.json();

            // Immediately update local state
            setItems(items.map(i => i.id === selectedItemForGallery.id ? updatedItem : i));

            // Also trigger a full refresh to be safe and ensure everything is synced
            fetchListAndBlame(itemsPage);

            setShowGalleryModal(false);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const getImageSrc = (url) => {
        if (!url) return '/img_placeholder.png';
        if (url.startsWith('http') || url.startsWith('blob') || url.startsWith('data:')) return url;
        if (url.startsWith('/api')) return `${API_BASE_URL}${url}`;
        return `${API_BASE_URL}/api${url}`;
    };

    useEffect(() => {
        if (isShoppingMode) {
            document.body.classList.add('is-shopping-mode-active');
        } else {
            document.body.classList.remove('is-shopping-mode-active');
        }
        return () => document.body.classList.remove('is-shopping-mode-active');
    }, [isShoppingMode]);

    const budget = listDetails?.budget || 0;
    const budgetProgress = budget > 0 ? (budgetDetails.total_estimado / budget) * 100 : 0;
    const budgetVariant = budgetProgress > 100 ? 'danger' : budgetProgress > 75 ? 'warning' : 'success';
    const purchasedProgress = budget > 0 ? (budgetDetails.total_comprado / budget) * 100 : 0;
    const itemsProgress = itemsTotalCount > 0 ? (purchasedItemsCount / itemsTotalCount) * 100 : 0;

    return (
        <div className="app-container animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
            {toast && (
                <div className={`toast toast-${toast.type}`}>
                    {toast.message}
                </div>
            )}

            <div className={`shopping-header-wrapper ${isShoppingMode ? 'is-sticky' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <button className="btn-premium btn-secondary" onClick={() => navigate(`/calendar?id=${listDetails?.calendar?.id}`, { state: { calendar: listDetails?.calendar } })} style={{ display: 'inline-flex', padding: '8px 16px', flexShrink: 0 }}>
                        <ArrowLeft size={18} /> <span className="hide-mobile">Volver</span>
                    </button>

                    {isShoppingMode && (
                        <h1 className="sticky-list-name text-gradient" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, textAlign: 'center', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {listDetails?.name || ''}
                        </h1>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            className={`btn-premium ${isShoppingMode ? 'btn-success' : 'btn-primary'}`}
                            onClick={() => setIsShoppingMode(!isShoppingMode)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', flexShrink: 0 }}
                        >
                            <ShoppingBag size={18} />
                            <span className="hide-mobile">{isShoppingMode ? 'Salir' : 'Modo Comprando'}</span>
                            {!isShoppingMode && <span className="show-mobile">Modo</span>}
                        </button>
                        {listDetails && (
                            <>
                                <button
                                    className="btn-premium btn-secondary btn-compact"
                                    onClick={handleOpenSaveTemplateModal}
                                    style={{ padding: '8px 16px' }}
                                >
                                    Guardar plantilla
                                </button>
                                <button
                                    className="btn-premium btn-secondary btn-compact"
                                    onClick={handleOpenTemplates}
                                    style={{ padding: '8px 16px' }}
                                >
                                    Aplicar plantilla
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {isShoppingMode && (
                    <>
                        <div className="sticky-progress-container animate-slide-down">
                            <div className="sticky-progress-item">
                                <span className="sticky-progress-label">Artículos</span>
                                <div className="sticky-progress-bar-bg">
                                    <div className="sticky-progress-bar-fill success" style={{ width: `${itemsProgress}%` }}></div>
                                </div>
                                <span className="sticky-progress-value">{purchasedItemsCount}/{itemsTotalCount}</span>
                            </div>
                            <div className="sticky-progress-item">
                                <span className="sticky-progress-label">Compra</span>
                                <div className="sticky-progress-bar-bg">
                                    <div className="sticky-progress-bar-fill info" style={{ width: `${purchasedProgress}%` }}></div>
                                </div>
                                <span className="sticky-progress-value">${budgetDetails.total_comprado.toFixed(0)}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                className="btn-premium btn-compact"
                                title={hidePurchased ? 'Mostrar comprados' : 'Ocultar comprados'}
                                onClick={() => setHidePurchased(prev => !prev)}
                                disabled={bulkActionLoading}
                                style={{ padding: '8px', minWidth: '40px' }}
                            >
                                {hidePurchased ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="mobile-action-bar">
                <button className="btn-premium btn-primary" type="button" onClick={() => quickAddInputRef.current?.focus()}>
                    Agregar producto
                </button>
                <button className="btn-premium btn-secondary" type="button" onClick={handleOpenSaveTemplateModal}>
                    Guardar plantilla
                </button>
                <button className="btn-premium btn-secondary" type="button" onClick={handleOpenTemplates}>
                    Aplicar plantilla
                </button>
            </div>

            {isShoppingMode && selectedItems.size > 0 && (
                <div className="shopping-selection-toolbar">
                    <span style={{ fontWeight: 600 }}>{selectedItems.size} seleccionado{selectedItems.size === 1 ? '' : 's'}</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button className="btn-premium btn-success" onClick={handleBulkMarkPurchased} disabled={bulkActionLoading}>
                            Marcar comprados
                        </button>
                        <button className="btn-premium btn-secondary" onClick={handleBulkResetPending} disabled={bulkActionLoading}>
                            Restablecer pendientes
                        </button>
                        <button className="btn-premium btn-danger" onClick={handleBulkDelete} disabled={bulkActionLoading}>
                            Eliminar seleccionados
                        </button>
                        <button className="btn-premium btn-secondary" onClick={clearSelection} disabled={bulkActionLoading}>
                            Limpiar selección
                        </button>
                    </div>
                </div>
            )}

            {!isShoppingMode && (
                <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
                    <div className="flex-mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                        <div>
                            <h2 className="text-gradient" style={{ margin: 0, fontSize: '2.5rem' }}>{listDetails?.name || ''}</h2>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                <button className="btn-premium btn-primary" onClick={handleOpenSaveTemplateModal} style={{ padding: '8px 16px' }}>
                                    Guardar como plantilla
                                </button>
                                <button className="btn-premium btn-secondary" onClick={handleOpenTemplates} style={{ padding: '8px 16px' }}>
                                    Aplicar plantilla
                                </button>
                            </div>
                        </div>
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

                        {categorySummary.length > 0 && (
                            <div style={{ marginTop: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                    <h5 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>Resumen por categoría</h5>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Top {categorySummary.length} categorías por gasto</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '12px' }}>
                                    {categorySummary.map(category => (
                                        <div key={category.category} style={{ padding: '12px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                            <div style={{ fontWeight: 700 }}>{category.category}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0' }}>{category.count} artículo{category.count === 1 ? '' : 's'} • {category.quantity.toFixed(0)} unidad{category.quantity === 1 ? '' : 'es'}</div>
                                            <div style={{ fontWeight: 600 }}>${category.total.toFixed(2)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '32px 0' }} />

                    <form onSubmit={handleAdd} className="add-item-form" style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 10, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <input
                                ref={quickAddInputRef}
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
                                                <img src={getImageSrc(p.shared_image?.file_path)} alt={p.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, marginRight: 12, background: 'rgba(255,255,255,0.05)' }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.brand} / {p.category}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn-premium btn-compact"
                                                    style={{ minWidth: '40px', width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: p.is_favorite ? 'var(--warning-color)' : 'var(--text-secondary)' }}
                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleFavorite(p); }}
                                                    title={p.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                                                >
                                                    <Star size={18} />
                                                </button>
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

                        <input type="number" className="premium-input" value={newQuantity} onChange={(e) => setNewQuantity(parseFloat(e.target.value))} style={{ width: '80px', flex: 'none' }} min="0.001" step="any" />

                        <select className="premium-input" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={{ width: '120px', flex: 'none' }}>
                            <option value="piezas">piezas</option>
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="L">L</option>
                            <option value="ml">ml</option>
                        </select>

                        <button type="submit" className="btn-premium btn-primary" disabled={loading} style={{ padding: '8px 24px' }}>Agregar</button>
                        <button
                            type="button"
                            className="btn-premium btn-secondary"
                            style={{ background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary-color)', padding: '8px 18px' }}
                            onClick={() => setShowStoreUrlModal(true)}
                        >
                            <Globe size={18} /> Agregar desde URL
                        </button>
                        <button type="button" className="btn-premium" style={{ background: 'var(--info-color)', padding: '8px 16px' }} title="Agregar productos no comprados de otra lista" onClick={() => setShowPreviousItemsModal(true)}>
                            <PlusCircle size={20} color="white" />
                        </button>
                    </form>

                    {showStoreUrlModal && (
                        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                            <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '24px', position: 'relative' }}>
                                <button onClick={() => setShowStoreUrlModal(false)} style={{ position: 'absolute', top: '14px', right: '14px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.4rem' }}><X size={22} /></button>
                                <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Agregar producto desde URL de tienda</h3>
                                <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>Pega la URL del producto en la tienda online y el sistema intentará extraer nombre, precio e imagen.</p>
                                <input
                                    type="text"
                                    className="premium-input"
                                    placeholder="https://www.tutienda.com/producto/12345"
                                    value={storeUrlInput}
                                    onChange={(e) => setStoreUrlInput(e.target.value)}
                                    style={{ width: '100%', marginBottom: '12px' }}
                                />
                                {storeConnectors.length > 0 ? (
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
                                        <label style={{ margin: 0, minWidth: '110px', color: 'var(--text-secondary)' }}>Conector</label>
                                        <select
                                            className="premium-input"
                                            value={selectedStoreConnectorId || ''}
                                            onChange={(e) => setSelectedStoreConnectorId(e.target.value ? parseInt(e.target.value) : null)}
                                            style={{ flex: 1, minWidth: '220px' }}
                                        >
                                            {storeConnectors.map(connector => (
                                                <option key={connector.id} value={connector.id}>
                                                    {connector.name} {connector.is_default ? '(Por defecto)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
                                        No hay conectores de tienda configurados. El sistema intentará extraer el producto de forma genérica.
                                    </p>
                                )}
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                    <button className="btn-premium btn-secondary" type="button" onClick={handlePreviewStoreUrl} disabled={storePreviewLoading || !storeUrlInput.trim()} style={{ padding: '10px 18px' }}>
                                        {storePreviewLoading ? 'Obteniendo vista previa...' : 'Previsualizar'}
                                    </button>
                                    <button className="btn-premium btn-primary" onClick={handleAddByUrl} disabled={storeUrlLoading} style={{ padding: '10px 18px' }}>
                                        {storeUrlLoading ? 'Agregando...' : 'Agregar desde tienda'}
                                    </button>
                                    <button className="btn-premium btn-secondary" onClick={() => { setShowStoreUrlModal(false); setStorePreview(null); setStorePreviewError(null); }} style={{ padding: '10px 18px' }}>
                                        Cancelar
                                    </button>
                                </div>
                                {storePreviewError && (
                                    <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(220, 38, 38, 0.12)', color: 'var(--danger-color)', marginBottom: '16px' }}>
                                        {storePreviewError}
                                    </div>
                                )}
                                {storePreview && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.05)', marginBottom: '16px' }}>
                                        {storePreview.data.image_url && (
                                            <div style={{ minWidth: '120px', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                                                <img src={storePreview.data.image_url} alt={storePreview.data.name || 'Imagen de producto'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div>
                                                <strong>Nombre:</strong> {storePreview.data.name || 'No disponible'}
                                            </div>
                                            <div>
                                                <strong>Precio estimado:</strong> {storePreview.data.price != null ? `$${storePreview.data.price}` : 'No disponible'}
                                            </div>
                                            <div>
                                                <strong>Tienda:</strong> {storePreview.data.store_name || 'No disponible'}
                                            </div>
                                            {storePreview.data.description && (
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{storePreview.data.description}</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
                        <h5 style={{ margin: 0, fontWeight: 600 }}>Total Comprado: <span className="badge" style={{ background: 'var(--success-color)', fontSize: '1.2rem', padding: '6px 12px' }}>${budgetDetails.total_comprado.toFixed(2)}</span></h5>
                    </div>
                </div>
            )}

            {showSaveTemplateModal && (
                <div className="modal-backdrop" onClick={handleCloseSaveTemplateModal}>
                    <div className="modal-content" style={{ maxWidth: '520px', width: '95%', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h5 className="modal-title">Guardar lista como plantilla</h5>
                            <button className="modal-close" onClick={handleCloseSaveTemplateModal}><X size={24} /></button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nombre de plantilla</label>
                                <input className="premium-input" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ej. Compra semanal" />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Descripción (opcional)</label>
                                <textarea className="premium-input" rows={4} value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} placeholder="Lista de productos base para esta compra" />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-premium btn-secondary" onClick={handleCloseSaveTemplateModal}>Cancelar</button>
                            <button className="btn-premium btn-primary" onClick={handleSaveTemplate}>Guardar plantilla</button>
                        </div>
                    </div>
                </div>
            )}

            {showTemplateModal && (
                <div className="modal-backdrop" onClick={handleCloseTemplatesModal}>
                    <div className="modal-content" style={{ maxWidth: '900px', width: '95%', position: 'relative', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h5 className="modal-title">Aplicar plantilla</h5>
                            <button className="modal-close" onClick={handleCloseTemplatesModal}><X size={24} /></button>
                        </div>
                        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
                            {templatesLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><span className="text-gradient" style={{ fontSize: '1.2rem', fontWeight: 600 }}>Cargando plantillas...</span></div>
                            ) : templates.length === 0 ? (
                                <div className="alert-info">No hay plantillas disponibles. Guarda esta lista como plantilla y vuelve para aplicar.</div>
                            ) : (
                                <div style={{ display: 'grid', gap: '16px' }}>
                                    {templates.map(template => (
                                        <div key={template.id} className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, marginBottom: '6px' }}>{template.name}</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '6px' }}>{template.description || 'Plantilla sin descripción'}</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{template.items.length} productos</div>
                                            </div>
                                            <button className="btn-premium btn-primary" onClick={() => handleApplyTemplate(template.id)}>
                                                Aplicar plantilla
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-premium btn-secondary" onClick={handleCloseTemplatesModal}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {suggestedProducts.length > 0 || suggestionsLoading ? (
                <div className="glass-panel suggested-products-container" style={{ padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Productos sugeridos</h3>
                            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>Añade rápidamente artículos usados con frecuencia por tu familia.</p>
                        </div>
                    </div>
                    {suggestionsLoading ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando sugerencias...</div>
                    ) : suggestedProducts.length === 0 ? (
                        <div style={{ padding: '16px 0', color: 'var(--text-secondary)' }}>No hay sugerencias disponibles todavía.</div>
                    ) : (
                        <div className="suggested-products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                            {suggestedProducts.map(product => (
                                <div key={product.id} className="glass-panel suggested-card" style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ width: '52px', height: '52px', borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
                                            <img src={getImageSrc(product.shared_image?.file_path)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{product.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{product.brand || 'Marca no definida'} · {product.category || 'Categoría no definida'}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 600 }}>{product.last_price ? `$${product.last_price.toFixed(2)}` : 'Precio desconocido'}</span>
                                        <button className="btn-premium btn-primary" onClick={() => handleAddSuggestedProduct(product)} disabled={suggestionAddLoading === product.id}>
                                            {suggestionAddLoading === product.id ? 'Agregando...' : 'Agregar'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : null}

            {favoriteProducts.length > 0 || favoritesLoading ? (
                <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Favoritos rápidos</h3>
                            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>Agrega tus productos preferidos con un solo toque.</p>
                        </div>
                    </div>
                    {favoritesLoading ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando favoritos...</div>
                    ) : favoriteProducts.length === 0 ? (
                        <div style={{ padding: '16px 0', color: 'var(--text-secondary)' }}>No tienes productos marcados como favoritos aún.</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                            {favoriteProducts.map(product => (
                                <div key={product.id} className="glass-panel" style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <div style={{ width: '52px', height: '52px', borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
                                                <img src={getImageSrc(product.shared_image?.file_path)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{product.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{product.brand || 'Marca no definida'} · {product.category || 'Categoría no definida'}</div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-premium btn-secondary btn-compact"
                                            style={{ minWidth: '40px', width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning-color)' }}
                                            onClick={() => handleToggleFavorite(product)}
                                            title="Quitar de favoritos"
                                        >
                                            <Star size={18} />
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 600 }}>{product.last_price ? `$${product.last_price.toFixed(2)}` : 'Precio desconocido'}</span>
                                        <button className="btn-premium btn-primary" onClick={() => handleAddFavorite(product)} disabled={suggestionAddLoading === product.id}>
                                            {suggestionAddLoading === product.id ? 'Agregando...' : 'Agregar'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : null}

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
                    <select
                        className="premium-input"
                        style={{ width: '220px' }}
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value)}
                    >
                        <option value="default">Orden predeterminado</option>
                        <option value="name_asc">Nombre A→Z</option>
                        <option value="name_desc">Nombre Z→A</option>
                        <option value="qty_asc">Cantidad ↑</option>
                        <option value="qty_desc">Cantidad ↓</option>
                        <option value="price_asc">Precio ↑</option>
                        <option value="price_desc">Precio ↓</option>
                    </select>
                    <button className={`btn-premium ${groupByCategory ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 16px' }} onClick={() => setGroupByCategory(prev => !prev)}>
                        {groupByCategory ? 'Quitar agrupado' : 'Agrupar por categoría'}
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

                {!isShoppingMode && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className={`btn-premium ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')} style={{ padding: '6px 16px' }}>
                            Lista
                        </button>
                        <button className={`btn-premium ${viewMode === 'card' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('card')} style={{ padding: '6px 16px' }}>
                            Tarjetas
                        </button>
                    </div>
                )}
            </div>

            {selectedItems.size > 0 && (
                <div className="glass-panel" style={{ marginBottom: '16px', padding: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 600 }}>{selectedItems.size} seleccionado{selectedItems.size === 1 ? '' : 's'}</span>
                    <button className="btn-premium btn-success" onClick={handleBulkMarkPurchased} disabled={bulkActionLoading}>
                        Marcar comprados
                    </button>
                    <button className="btn-premium btn-secondary" onClick={handleBulkResetPending} disabled={bulkActionLoading}>
                        Restablecer pendientes
                    </button>
                    <button className="btn-premium btn-danger" onClick={handleBulkDelete} disabled={bulkActionLoading}>
                        Eliminar seleccionados
                    </button>
                    <button className="btn-premium btn-secondary" onClick={clearSelection} disabled={bulkActionLoading}>
                        Limpiar selección
                    </button>
                </div>
            )}

            {/* Items List */}
            <div>
                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: isShoppingMode ? '1fr' : (viewMode === 'card' ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr'), gap: '16px' }}>
                        {Array.from({ length: 5 }).map((_, index) =>
                            isShoppingMode ? (
                                <div key={index} className="glass-panel skeleton-box" style={{ height: '100px' }}></div>
                            ) : (
                                viewMode === 'card' ? (
                                    <ShoppingItemCardSkeleton key={index} />
                                ) : (
                                    <ShoppingListItemSkeleton key={index} />
                                )
                            )
                        )}
                    </div>
                ) : groupByCategory && !isShoppingMode ? (
                    <div style={{ display: 'grid', gap: '24px' }}>
                        {groupedItems.map(group => (
                            <div key={group.category} style={{ display: 'grid', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{group.category}</h4>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{group.items.length} artículos</span>
                                </div>
                                <div className="grid-mobile-stack" style={{ display: 'grid', gridTemplateColumns: viewMode === 'card' ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr', gap: '24px' }}>
                                    <TransitionGroup component={null}>
                                        {group.items.map(item => renderItemCard(item))}
                                    </TransitionGroup>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid-mobile-stack" style={{ display: 'grid', gridTemplateColumns: isShoppingMode ? '1fr' : (viewMode === 'card' ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr'), gap: isShoppingMode ? '12px' : '24px' }}>
                        <TransitionGroup component={null}>
                            {(isShoppingMode ? items : sortedItems).map(item => renderItemCard(item))}
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