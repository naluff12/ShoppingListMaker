import { CSSTransition, TransitionGroup } from 'react-transition-group';
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Eye, EyeOff, Pencil, Filter, ArrowLeft, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, ShoppingBag, Star, Settings, MessageCircle } from 'lucide-react';
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
import ChatPanel from './ChatPanel';
import MemberPresencePanel from './MemberPresencePanel';
import ActivityFeedPanel from './ActivityFeedPanel';
import { useWebSocket } from './useWebSocket';
import { API_BASE_URL } from './config';
import ShoppingModeItem from './ShoppingModeItem';
import BudgetModal from './BudgetModal';
import NewProductModal from './NewProductModal';
import FamilySidebar from './FamilySidebar';
import QuickAddBar from './QuickAddBar';
import ProgressBar from './ProgressBar';
import ListSettingsSheet from './ListSettingsSheet';
import { listApi, productApi, familyApi, templateApi, storeApi } from './api';

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
    const [showListSettings, setShowListSettings] = useState(false);
    const [showFamilySidebar, setShowFamilySidebar] = useState(false);
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

    // Orden personalizado de categorías (persistido por lista) — best practice AnyList
    const [categoryOrder, setCategoryOrder] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(`shopCatOrder_${listId}`) || 'null') || [];
        } catch { return []; }
    });

    // Modals & Popovers
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [newBudget, setNewBudget] = useState('');
    const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
    const [selectedItemForPriceHistory, setSelectedItemForPriceHistory] = useState(null);
    const [budgetDetails, setBudgetDetails] = useState({ total_estimado: 0, total_comprado: 0 });
    const [viewMode, setViewMode] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'card');
    const [itemsTotalCount, setItemsTotalCount] = useState(0);
    const [purchasedItemsCount, setPurchasedItemsCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [isShoppingMode, setIsShoppingMode] = useState(false);
    const [hidePurchased, setHidePurchased] = useState(false);
    const [sortOption, setSortOption] = useState('default');
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [toast, setToast] = useState(null); // { message, type, action }
    const toastTimerRef = useRef(null);

    const showToast = (message, type = 'info', action = null) => {
        setToast({ message, type, action });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 3500);
    };

    const [showStoreUrlModal, setShowStoreUrlModal] = useState(false);
    const [storeUrlInput, setStoreUrlInput] = useState('');
    const [storeUrlLoading, setStoreUrlLoading] = useState(false);
    const [storeConnectors, setStoreConnectors] = useState([]);
    const [selectedStoreConnectorId, setSelectedStoreConnectorId] = useState(null);
    const [storePreview, setStorePreview] = useState(null);
    const [storePreviewLoading, setStorePreviewLoading] = useState(false);
    const [storePreviewError, setStorePreviewError] = useState(null);

    const sendActivityUpdate = (action, listName) => {
        if (!sendJson || !familyId) return;
        sendJson({
            type: 'activity_update',
            action,
            list_id: listId,
            list_name: listName || listDetails?.name || '',
        });
    };

    const handleToggleShoppingMode = () => {
        const nextMode = !isShoppingMode;
        setIsShoppingMode(nextMode);
        sendActivityUpdate(nextMode ? 'started_shopping' : 'stopped_shopping', listDetails?.name);
        // Recibo/resumen al terminar el modo compras (best practice: SmartCart)
        if (!nextMode) {
            const pendientes = items.filter(i => i.status === 'pendiente').length;
            const total = budgetDetails?.total_comprado || 0;
            const restante = budget > 0 ? Math.max(0, budget - total) : null;
            setTimeout(() => {
                showToast(
                    `🛒 Compra terminada: ${purchasedItemsCount} comprados, $${total.toFixed(2)} gastado${restante !== null ? `, te sobraron $${restante.toFixed(2)}` : ''}${pendientes > 0 ? ` · ${pendientes} sin comprar` : ''}`,
                    'info'
                );
            }, 300);
        }
    };

    const handleJoinActivity = (activity) => {
        if (!activity || !activity.list_id) {
            showToast('No hay una actividad disponible para unirse.', 'warning');
            return;
        }
        if (activity.list_id !== parseInt(listId)) {
            navigate(`/shopping-list/${activity.list_id}`);
            return;
        }
        if (!isShoppingMode) {
            setIsShoppingMode(true);
            sendActivityUpdate('joined_shopping', listDetails?.name);
            showToast(`Te uniste a la actividad en "${listDetails?.name}"`, 'success');
        }
    };

    const addActivityEvent = (event) => {
        setRecentEvents((prev) => {
            const next = [event, ...prev];
            return next.slice(0, 10);
        });
    };

    const buildActivityEvent = (message) => {
        if (!message) return null;
        if (message.type === 'chat_message' && message.chat_message) {
            const chat = message.chat_message;
            const author = chat.user?.nombre || chat.user?.username || 'Alguien';
            const preview = chat.message.length > 80 ? `${chat.message.slice(0, 77)}...` : chat.message;
            return { id: `activity-chat-${chat.id}`, text: `${author} escribió: "${preview}"`, ts: chat.created_at };
        }
        if (message.type === 'presence_update') {
            const actor = message.user?.nombre || message.user?.username || 'Alguien';
            const action = message.action === 'connected' ? 'se conectó' : 'se desconectó';
            return { id: `activity-presence-${Date.now()}`, text: `${actor} ${action}`, ts: new Date().toISOString() };
        }
        if (message.action === 'ITEM_CREATED') {
            return { id: `activity-item-created-${message.item_id}`, text: `Se agregó un ítem nuevo en la lista actual.`, ts: new Date().toISOString() };
        }
        if (message.action === 'ITEM_UPDATED') {
            return { id: `activity-item-updated-${message.item_id}`, text: `Un ítem fue actualizado en la lista.`, ts: new Date().toISOString() };
        }
        if (message.action === 'ITEM_DELETED') {
            return { id: `activity-item-deleted-${message.item_id}`, text: `Un ítem fue eliminado de la lista.`, ts: new Date().toISOString() };
        }
        if (message.type === 'typing') {
            const typingUser = message.user?.nombre || message.user?.username || 'Alguien';
            return { id: `activity-typing-${typingUser}-${Date.now()}`, text: `${typingUser} está escribiendo un mensaje...`, ts: new Date().toISOString() };
        }
        return null;
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
    const [recentEvents, setRecentEvents] = useState([]);
    const [privateChatRecipient, setPrivateChatRecipient] = useState(null);
    const familyId = listDetails?.calendar?.family_id || (listDetails?.calendar ? listDetails.calendar.family_id : null);
    const { lastMessage, isConnected, sendJson } = useWebSocket(familyId);

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
        const entries = Object.entries(groups).map(([category, items]) => ({ category, items }));
        // Aplicar orden personalizado (categorías conocidas primero, resto al final)
        if (categoryOrder.length > 0) {
            entries.sort((a, b) => {
                const ia = categoryOrder.indexOf(a.category);
                const ib = categoryOrder.indexOf(b.category);
                if (ia === -1 && ib === -1) return 0;
                if (ia === -1) return 1;
                if (ib === -1) return -1;
                return ia - ib;
            });
        }
        return entries;
    }, [sortedItems, groupByCategory, categoryOrder]);

    const moveCategory = (category, dir) => {
        setCategoryOrder(prev => {
            const cats = [...prev];
            const idx = cats.indexOf(category);
            if (idx === -1) {
                // Categoría aún no ordenada: añadir al final primero (orden estable)
                const all = [...cats, category];
                localStorage.setItem(`shopCatOrder_${listId}`, JSON.stringify(all));
                return all;
            }
            const target = idx + dir;
            if (target < 0 || target >= cats.length) return prev;
            [cats[idx], cats[target]] = [cats[target], cats[idx]];
            localStorage.setItem(`shopCatOrder_${listId}`, JSON.stringify(cats));
            return [...cats];
        });
    };

    const renderItemCard = (item) => (
        <CSSTransition key={item.id} timeout={400} classNames="fade">
            {isShoppingMode ? (
                <ShoppingModeItem
                    item={item}
                    onItemUpdate={handleItemUpdate}
                    onStatusChange={handleStatus}
                    loading={loading}
                    isSelected={selectedItems.has(item.id)}
                    onSelect={() => toggleItemSelection(item.id)}
                />
            ) : viewMode === 'card' ? (
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
        listApi.getFilterOptions(listId)
            .then(data => setFilterOptions(data))
            .catch(() => setFilterOptions({ categories: [], brands: [] }));
    }, [listId]);

    useEffect(() => {
        const fetchStoreConnectors = async () => {
            try {
                const data = await storeApi.getConnectors();
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
            const data = await listApi.getBudgetDetails(listId);
            setBudgetDetails(data);
        } catch (err) {
            console.error("Error fetching budget details:", err);
        }
    };

    const fetchTemplates = async () => {
        const familyId = listDetails?.calendar?.family_id;
        if (!familyId) return;
        setTemplatesLoading(true);
        try {
            const data = await familyApi.getTemplates(familyId);
            setTemplates(data);
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
            const data = await familyApi.getSuggestedProducts(familyId);
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
            const data = await familyApi.getFavoriteProducts(familyId);
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
            const updated = await productApi.toggleFavorite(product.id, !product.is_favorite);
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
            const newItem = await listApi.createItem(body);
            showToast(newItem?._merged ? `'${product.name}' ya estaba en la lista — cantidad actualizada` : `'${product.name}' agregado a la lista`, newItem?._merged ? 'info' : 'success');
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
            const newItem = await listApi.createItem(body);
            showToast(newItem?._merged ? `'${product.name}' ya estaba en la lista — cantidad actualizada` : `'${product.name}' agregado a la lista`, newItem?._merged ? 'info' : 'success');
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
            await templateApi.create({ name: templateName, description: templateDescription, list_id: parseInt(listId) });
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
            await templateApi.apply(templateId, listId);
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
            const newItem = await listApi.createItem({
                list_id: listId,
                nombre: quickAddItemName,
                cantidad: 1,
                unit: 'piezas'
            });
            showToast(newItem?._merged ? `'${quickAddItemName}' ya estaba en la lista — cantidad incrementada` : `'${quickAddItemName}' agregado a la lista`, newItem?._merged ? 'info' : 'success');
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
            const updatedList = await listApi.updateList(listId, { budget: budgetValue });
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

        const listDetailsPromise = listApi.getList(listId);
        const itemsPromise = listApi.getItems(listId, Object.fromEntries(queryParams));
        const blamePromise = listApi.getBlame(listId);
        const purchasedCountPromise = listApi.getPurchasedCount(listId);
        const totalItemsCountPromise = listApi.getItemCount(listId);

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
                    productApi.getByFamily(listData.calendar.family_id, 1, 10)
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

    // WebSocket Integration handled above

    useEffect(() => {
        if (lastMessage) {
            const event = buildActivityEvent(lastMessage);
            if (event) addActivityEvent(event);

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
            const data = await listApi.getItemBlame(itemId);
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
            const newItemResp = await listApi.createItem({
                list_id: listId,
                nombre: newItem,
                cantidad: newQuantity,
                unit: newUnit,
                precio_estimado: newPrice || null,
                brand: brand,
                category: category
            });
            showToast(newItemResp?._merged ? `'${newItem}' ya estaba en la lista — cantidad actualizada` : `'${newItem}' agregado a la lista`, newItemResp?._merged ? 'info' : 'success');

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

        const searchData = await productApi.search(listDetails.calendar.family_id, newItem);
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
            const data = await storeApi.extractProduct({
                url: storeUrlInput,
                connector_id: selectedStoreConnectorId
            });
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
            const newItem = await listApi.addByUrl({
                list_id: listId,
                url: storeUrlInput,
                connector_id: selectedStoreConnectorId,
                cantidad: newQuantity,
                unit: newUnit,
                comentario: newItemComment
            });
            setStoreUrlInput('');
            setStorePreview(null);
            setStorePreviewError(null);
            setShowStoreUrlModal(false);
            fetchListAndBlame();
            fetchBudgetDetails();
            showToast(newItem?._merged ? 'Producto ya estaba en la lista — cantidad actualizada' : 'Producto agregado desde la tienda', newItem?._merged ? 'info' : 'success');
        } catch (err) {
            showToast(err.message || 'Error al agregar desde URL', 'error');
        } finally {
            setStoreUrlLoading(false);
        }
    };

    const handleAddItemsFromModal = async (itemsToAdd) => {
        if (!listId) return;
        try {
            await listApi.bulkCreateItems(listId, itemsToAdd);
            fetchListAndBlame();
            fetchBudgetDetails();
            showToast('Productos agregados', 'success');
        } catch (err) {
            showToast(err.message || 'Error al agregar productos', 'error');
        }
    };

    const handleStatus = async (id, status) => {
        const newStatus = status === 'comprado' ? 'pendiente' : 'comprado';
        try {
            const updatedItem = await listApi.updateItem(id, { status: newStatus });
            setItems(items.map(i => i.id === id ? updatedItem : i));
            fetchBudgetDetails();
            if (newStatus === 'comprado') {
                setPurchasedItemsCount(prev => prev + 1);
            } else {
                setPurchasedItemsCount(prev => prev - 1);
            }
            if (showItemBlame === id) {
                const dataHist = await listApi.getItemBlame(id);
                setItemBlames(prev => ({ ...prev, [id]: Array.isArray(dataHist) ? dataHist : [] }));
            }
            // Undo: al marcar comprado, ofrecer deshacer (evita errores de dedo en el súper)
            if (newStatus === 'comprado') {
                showToast(`✓ ${updatedItem.nombre} marcado`, 'success', {
                    label: 'Deshacer',
                    onAction: async () => {
                        try {
                            const reverted = await listApi.updateItem(id, { status: 'pendiente' });
                            setItems(prev => prev.map(i => i.id === id ? reverted : i));
                            setPurchasedItemsCount(prev => prev - 1);
                            fetchBudgetDetails();
                        } catch (e) { console.error('Undo falló', e); }
                    }
                });
            }
        } catch (err) {
            showToast(err.message, 'error');
            fetchListAndBlame();
        }
    };

    const handleDelete = async (id) => {
        setLoading(true);
        try {
            const itemToDelete = items.find(i => i.id === id);
            await listApi.deleteItem(id);
            fetchListAndBlame();
            fetchBudgetDetails();
            // Undo: restaurar el item eliminado por error
            if (itemToDelete) {
                showToast(`🗑️ ${itemToDelete.nombre} eliminado`, 'error', {
                    label: 'Restaurar',
                    onAction: async () => {
                        try {
                            await listApi.bulkCreateItems(listId, [{
                                nombre: itemToDelete.nombre,
                                cantidad: itemToDelete.cantidad,
                                unit: itemToDelete.unit,
                                categoria: itemToDelete.categoria,
                                marca: itemToDelete.marca,
                            }]);
                            fetchListAndBlame();
                            fetchBudgetDetails();
                        } catch (e) { console.error('Restaurar falló', e); }
                    }
                });
            }
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
                listApi.updateItem(id, { status })
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
                listApi.deleteItem(id)
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
            const nuevo = await listApi.createItemBlame(itemId, { detalles: newItemComment });
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
            const nuevo = await listApi.createListBlame(listId, { detalles: newListComment });
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
                const updatedItem = await listApi.updateItem(itemId, { [field]: parsedValue });
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
            const updatedList = await listApi.updateList(listId, { status: newStatus });
            setListDetails(updatedList);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleImageUpload = async (itemId, file) => {
        if (!file) return;
        try {
            const updatedItem = await listApi.uploadItemImage(itemId, file);
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
            const updatedItem = await listApi.updateItem(itemId, data);
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
            const data = await productApi.search(listDetails.calendar.family_id, query, page, 5);
            setProducts(Array.isArray(data.items) ? data.items : []);
            setProductsPage(data.page);
            setProductsTotalPages(Math.ceil(data.total / data.size));
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
                <div className={`toast toast-${toast.type}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                    <span style={{ flex: 1 }}>{toast.message}</span>
                    {toast.action && (
                        <button
                            className="toast-action-btn"
                            onClick={() => { toast.action.onAction(); setToast(null); }}
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>
            )}

            <div className={`shopping-header-wrapper ${isShoppingMode ? 'is-sticky' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <button className="btn-premium btn-secondary" onClick={() => navigate(`/calendar?id=${listDetails?.calendar?.id}`, { state: { calendar: listDetails?.calendar } })} style={{ display: 'inline-flex', padding: '8px 16px', flexShrink: 0 }}>
                        <ArrowLeft size={18} /> <span className="hide-mobile">Volver</span>
                    </button>

                    <h1 className="sticky-list-name text-gradient" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, textAlign: 'center', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {listDetails?.name || ''}
                    </h1>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            className={`btn-premium ${isShoppingMode ? 'btn-success' : 'btn-primary'}`}
                            onClick={() => handleToggleShoppingMode()}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', flexShrink: 0 }}
                        >
                            <ShoppingBag size={18} />
                            <span className="hide-mobile">{isShoppingMode ? 'Salir' : 'Modo Comprando'}</span>
                            {!isShoppingMode && <span className="show-mobile">Modo</span>}
                        </button>
                        <button
                            className="btn-premium btn-secondary btn-compact"
                            onClick={() => setShowListSettings(true)}
                            title="Configuración de la lista"
                            aria-label="Configuración de la lista"
                            style={{ padding: '8px 12px', flexShrink: 0 }}
                        >
                            <Settings size={18} />
                        </button>
                        {familyId && (
                            <button
                                className="btn-premium btn-secondary btn-compact"
                                onClick={() => setShowFamilySidebar(true)}
                                title="Chat familiar"
                                aria-label="Chat familiar"
                                style={{ padding: '8px 12px', flexShrink: 0 }}
                            >
                                <MessageCircle size={18} />
                            </button>
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

            {/* Barra de acción rápida: siempre visible (fija abajo) */}
            <QuickAddBar
                isShoppingMode={isShoppingMode}
                quickAddInputRef={quickAddInputRef}
                value={newItem}
                onChange={(e) => {
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
                onSubmit={handleAdd}
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
                highlightedIndex={highlightedIndex}
                products={products}
                onHighlight={setHighlightedIndex}
                onSelectProduct={(p) => {
                    setNewItem(p.name);
                    if (p.last_price) { setNewPrice(p.last_price); }
                    setNewBrand(p.brand);
                    setNewCategory(p.category);
                    setProducts([]);
                }}
                onOpenPrevious={() => setShowPreviousItemsModal(true)}
                onOpenStoreUrl={() => setShowStoreUrlModal(true)}
                quickAddItemName={quickAddItemName}
                onQuickAddChange={setQuickAddItemName}
                onQuickAddSubmit={handleQuickAdd}
            />

            {familyId && (
                <FamilySidebar
                    show={showFamilySidebar}
                    onClose={() => setShowFamilySidebar(false)}
                    familyId={familyId}
                    lastMessage={lastMessage}
                    sendJson={sendJson}
                    isConnected={isConnected}
                    privateChatRecipient={privateChatRecipient}
                    setPrivateChatRecipient={setPrivateChatRecipient}
                    handleJoinActivity={handleJoinActivity}
                    recentEvents={recentEvents}
                />
            )}

            {/* Contenedor vacío (eliminé sugerencias) */}

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

            {/* Filtering and View Options (compacto) */}
            <div style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }} ref={filtersRef}>
                    <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                        <input
                            type="text"
                            className="premium-input"
                            placeholder="Buscar items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', paddingLeft: '36px' }}
                        />
                        <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    </div>
                    <button className={`btn-premium ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(!showFilters)} style={{ padding: '8px 12px', flexShrink: 0 }} title="Filtros">
                        <Filter size={18} />
                    </button>
                    <select
                        className="premium-input"
                        style={{ width: 'auto', maxWidth: '150px', flexShrink: 0 }}
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value)}
                    >
                        <option value="default">Orden</option>
                        <option value="name_asc">Nombre A→Z</option>
                        <option value="name_desc">Nombre Z→A</option>
                        <option value="qty_asc">Cantidad ↑</option>
                        <option value="qty_desc">Cantidad ↓</option>
                        <option value="price_asc">Precio ↑</option>
                        <option value="price_desc">Precio ↓</option>
                    </select>
                    {showFilters && (
                        <div className="glass-panel" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 100, width: 'min(300px, calc(100vw - 32px))', padding: '16px', boxSizing: 'border-box' }}>
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

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <button className={`btn-premium ${groupByCategory ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '6px 14px' }} onClick={() => setGroupByCategory(prev => !prev)}>
                        {groupByCategory ? 'Quitar agrupado' : 'Agrupar por categoría'}
                    </button>
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
                    <div style={{ display: 'grid', gridTemplateColumns: isShoppingMode ? '1fr' : (viewMode === 'card' ? 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))' : '1fr'), gap: '16px' }}>
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{group.category}</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                            <button
                                                className="category-move-btn"
                                                title="Mover categoría arriba (según el recorrido de tu tienda)"
                                                onClick={() => moveCategory(group.category, -1)}
                                            ><ChevronUp size={12} /></button>
                                            <button
                                                className="category-move-btn"
                                                title="Mover categoría abajo"
                                                onClick={() => moveCategory(group.category, 1)}
                                            ><ChevronDown size={12} /></button>
                                        </div>
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{group.items.length} artículos</span>
                                </div>
                                <div className="grid-mobile-stack" style={{ display: 'grid', gridTemplateColumns: viewMode === 'card' ? 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))' : '1fr', gap: '24px' }}>
                                    <TransitionGroup component={null}>
                                        {group.items.map(item => renderItemCard(item))}
                                    </TransitionGroup>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid-mobile-stack" style={{ display: 'grid', gridTemplateColumns: isShoppingMode ? '1fr' : (viewMode === 'card' ? 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))' : '1fr'), gap: isShoppingMode ? '12px' : '24px' }}>
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

            {/* Modals */}
            <PreviousItemsModal
                show={showPreviousItemsModal}
                handleClose={() => setShowPreviousItemsModal(false)}
                familyId={listDetails?.calendar?.family_id}
                listId={listId}
                handleAddItems={handleAddItemsFromModal}
            />

            {/* Budget Modal */}
            <BudgetModal
                show={showBudgetModal}
                onClose={() => setShowBudgetModal(false)}
                value={newBudget}
                onChange={setNewBudget}
                onSave={handleBudgetUpdate}
            />

            <PriceHistoryModal
                show={showPriceHistoryModal}
                handleClose={() => setShowPriceHistoryModal(false)}
                item={selectedItemForPriceHistory}
            />


            {/* New Product Modal */}
            <NewProductModal
                show={showNewProductModal}
                onClose={() => setShowNewProductModal(false)}
                productName={newItem}
                brand={modalBrand}
                onBrandChange={setModalBrand}
                category={modalCategory}
                onCategoryChange={setModalCategory}
                onAddWithoutDetails={() => {
                    setShowNewProductModal(false);
                    proceedWithAdd();
                }}
                onAddWithDetails={() => {
                    setShowNewProductModal(false);
                    proceedWithAdd(modalBrand, modalCategory);
                }}
            />

            <ImageGalleryModal
                show={showGalleryModal}
                handleClose={() => setShowGalleryModal(false)}
                handleSelectImage={handleImageSelect}
            />

            <ListSettingsSheet
                show={showListSettings}
                onClose={() => setShowListSettings(false)}
                listDetails={listDetails}
                budget={budget}
                budgetDetails={budgetDetails}
                budgetProgress={budgetProgress}
                budgetVariant={budgetVariant}
                onEditBudget={() => setShowBudgetModal(true)}
                blame={blame}
                newListComment={newListComment}
                setNewListComment={setNewListComment}
                onListCommentSubmit={handleListCommentSubmit}
                onToggleStatus={handleListStatusChange}
                onSaveTemplate={handleOpenSaveTemplateModal}
                onApplyTemplates={handleOpenTemplates}
            />

        </div>
    );
}

export default ShoppingListView;