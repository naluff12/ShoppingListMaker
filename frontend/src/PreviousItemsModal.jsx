import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, ChevronDown, ChevronUp, ShoppingBag, Check } from 'lucide-react';
import { API_BASE_URL } from './config';

const PreviousItemsModal = ({ show, handleClose, familyId, listId, handleAddItems }) => {
    const [previousLists, setPreviousLists] = useState([]);
    const [itemsByList, setItemsByList] = useState({});
    const [selectedItems, setSelectedItems] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [expandedLists, setExpandedLists] = useState(new Set());
    const [activeTab, setActiveTab] = useState('lists');
    const [productHistory, setProductHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [selectedHistoryProducts, setSelectedHistoryProducts] = useState(new Map());
    const [periodDays, setPeriodDays] = useState(90);

    useEffect(() => {
        if (show && familyId) {
            setLoading(true);
            const fetchPreviousListsAndItems = async () => {
                try {
                    const now = new Date();
                    const startDate = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
                    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

                    const response = await fetch(`/api/families/${familyId}/previous_lists?start_date=${startDate}&end_date=${endDate}`);
                    if (response.ok) {
                        const data = await response.json();
                        const filteredLists = data.items.filter(list => list.id !== listId);
                        setPreviousLists(filteredLists);

                        const itemsPromises = filteredLists.map(list =>
                            fetch(`/api/listas/${list.id}/items?status=pendiente`).then(res => res.json())
                        );
                        const itemsResults = await Promise.all(itemsPromises);
                        const itemsMap = filteredLists.reduce((acc, list, index) => {
                            acc[list.id] = itemsResults[index].items;
                            return acc;
                        }, {});
                        setItemsByList(itemsMap);
                        
                        if (filteredLists.length > 0 && itemsMap[filteredLists[0].id]?.length > 0) {
                            setExpandedLists(new Set([filteredLists[0].id]));
                        }
                    }
                } catch (error) {
                    console.error('Error fetching previous lists and items:', error);
                } finally {
                    setLoading(false);
                }
            };

            const fetchProductHistory = async () => {
                setHistoryLoading(true);
                try {
                    const response = await fetch(`/api/families/${familyId}/previous_products?days=${periodDays}`);
                    if (response.ok) {
                        const data = await response.json();
                        setProductHistory(data);
                    }
                } catch (error) {
                    console.error('Error fetching previous product history:', error);
                } finally {
                    setHistoryLoading(false);
                }
            };

            fetchPreviousListsAndItems();
            fetchProductHistory();
        }
    }, [show, familyId, listId, periodDays]);

    const handleSelectItem = (item) => {
        const newSelectedItems = new Map(selectedItems);
        if (newSelectedItems.has(item.id)) {
            newSelectedItems.delete(item.id);
        } else {
            newSelectedItems.set(item.id, item);
        }
        setSelectedItems(newSelectedItems);
    };

    const handleSelectAllFromList = (listId, e) => {
        e.stopPropagation();
        const newSelectedItems = new Map(selectedItems);
        const listItems = itemsByList[listId] || [];

        const allSelected = listItems.every(item => newSelectedItems.has(item.id));

        if (allSelected) {
            listItems.forEach(item => newSelectedItems.delete(item.id));
        } else {
            listItems.forEach(item => newSelectedItems.set(item.id, item));
        }

        setSelectedItems(newSelectedItems);
    };

    const toggleExpandList = (listId) => {
        const newExpanded = new Set(expandedLists);
        if (newExpanded.has(listId)) {
            newExpanded.delete(listId);
        } else {
            newExpanded.add(listId);
        }
        setExpandedLists(newExpanded);
    };

    const onAddItems = () => {
        handleAddItems(Array.from(selectedItems.values()));
        setSelectedItems(new Map());
        handleClose();
    };

    const handleAddHistoryProduct = async (product) => {
        const itemToAdd = {
            nombre: product.name,
            cantidad: 1,
            unit: 'piezas',
            category: product.category,
            brand: product.brand,
            precio_estimado: product.last_price ?? undefined
        };
        await handleAddItems([itemToAdd]);
    };

    const handleToggleHistoryProduct = (product) => {
        const next = new Map(selectedHistoryProducts);
        const key = `${product.product_id || product.name}-${product.brand || ''}-${product.category || ''}`;
        if (next.has(key)) next.delete(key);
        else next.set(key, product);
        setSelectedHistoryProducts(next);
    };

    const handleAddSelectedHistory = async () => {
        if (selectedHistoryProducts.size === 0) return;
        const items = Array.from(selectedHistoryProducts.values()).map(product => ({
            nombre: product.name,
            cantidad: 1,
            unit: 'piezas',
            precio_estimado: product.last_price ?? undefined,
            brand: product.brand,
            category: product.category
        }));
        await handleAddItems(items);
        setSelectedHistoryProducts(new Map());
        handleClose();
    };

    const filteredProductHistory = productHistory.filter(product => {
        const term = historySearch.trim().toLowerCase();
        if (!term) return true;
        return (
            product.name.toLowerCase().includes(term) ||
            (product.brand || '').toLowerCase().includes(term) ||
            (product.category || '').toLowerCase().includes(term)
        );
    });

    const getImageSrc = (url) => {
        if (!url) return '/img_placeholder.png';
        if (url.startsWith('http') || url.startsWith('blob') || url.startsWith('data:')) return url;
        if (url.startsWith('/api')) return `${API_BASE_URL}${url}`;
        return `${API_BASE_URL}/api${url}`;
    };

    if (!show) return null;

    const totalSelected = selectedItems.size;

    return ReactDOM.createPortal(
        <div className="modal-backdrop" onClick={handleClose}>
            <div className="modal-content" style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">Agregar productos no comprados</h5>
                    <button className="modal-close" onClick={handleClose}><X size={24} /></button>
                </div>
                
                <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className={`btn-premium ${activeTab === 'lists' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setActiveTab('lists')}
                                style={{ padding: '10px 18px' }}
                            >
                                Listas anteriores
                            </button>
                            <button
                                type="button"
                                className={`btn-premium ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setActiveTab('history')}
                                style={{ padding: '10px 18px' }}
                            >
                                Historial de productos
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Ver últimos</span>
                            <select
                                className="premium-input"
                                value={periodDays}
                                onChange={(e) => setPeriodDays(parseInt(e.target.value, 10))}
                                style={{ width: '140px' }}
                            >
                                <option value={30}>30 días</option>
                                <option value={90}>90 días</option>
                                <option value={180}>180 días</option>
                            </select>
                        </div>
                    </div>

                    {activeTab === 'lists' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 2fr) 1fr', gap: '24px', alignItems: 'flex-start' }}>
                            <div>
                                {loading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                        <span className="text-gradient" style={{ fontSize: '1.2rem', fontWeight: 600 }}>Cargando...</span>
                                    </div>
                                ) : previousLists.length === 0 ? (
                                    <div className="alert-info">No hay listas anteriores con productos pendientes en los últimos 3 meses.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {previousLists.map(list => {
                                            const listItems = itemsByList[list.id] || [];
                                            if (listItems.length === 0) return null;
                                            
                                            const isExpanded = expandedLists.has(list.id);
                                            const allSelected = listItems.every(item => selectedItems.has(item.id));

                                            return (
                                                <div key={list.id} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                                                    <div 
                                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: isExpanded ? 'rgba(0,0,0,0.2)' : 'transparent', cursor: 'pointer', borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none' }}
                                                        onClick={() => toggleExpandList(list.id)}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <ShoppingBag className="text-gradient" size={20} />
                                                            <div>
                                                                <div style={{ fontWeight: 600 }}>{list.name}</div>
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                                    {new Date(list.list_for_date).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                            <button 
                                                                className="btn-premium btn-secondary" 
                                                                style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                                                                onClick={(e) => handleSelectAllFromList(list.id, e)}
                                                            >
                                                                {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                                            </button>
                                                            {isExpanded ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                            {listItems.map(item => {
                                                                const isSelected = selectedItems.has(item.id);
                                                                return (
                                                                    <div 
                                                                        key={item.id} 
                                                                        className="list-item" 
                                                                        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', padding: '12px', border: `1px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`, borderRadius: '14px', background: isSelected ? 'rgba(59, 130, 246, 0.05)' : '' }}
                                                                        onClick={() => handleSelectItem(item)}
                                                                    >
                                                                        <div style={{ width: 50, height: 50, borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }}>
                                                                            <img
                                                                                src={getImageSrc(item.product?.shared_image?.file_path)}
                                                                                alt={item.nombre}
                                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                            />
                                                                        </div>
                                                                        
                                                                        <div style={{ flex: 1 }}>
                                                                            <div style={{ fontWeight: 500, color: isSelected ? 'var(--primary-color)' : 'var(--text-primary)' }}>{item.nombre}</div>
                                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.cantidad} {item.unit || ''}</div>
                                                                        </div>

                                                                        <div style={{ width: 24, height: 24, borderRadius: '4px', border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`, background: isSelected ? 'var(--primary-color)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            {isSelected && <Check size={16} color="white" strokeWidth={3} />}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="glass-panel" style={{ padding: '0', position: 'sticky', top: 0 }}>
                                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Seleccionados</h4>
                                    <span className="badge">{totalSelected}</span>
                                </div>
                                <div style={{ padding: '16px', maxHeight: '50vh', overflowY: 'auto' }}>
                                    {totalSelected > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {Array.from(selectedItems.values()).map(item => (
                                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(240, 246, 252, 0.05)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.9rem' }}>
                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>{item.nombre}</span>
                                                    <button 
                                                        style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                                                        onClick={() => handleSelectItem(item)}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 0, fontStyle: 'italic', fontSize: '0.9rem' }}>Ningún producto seleccionado</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 2fr) 1fr', gap: '24px' }}>
                            <div>
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        className="premium-input"
                                        placeholder="Buscar producto…"
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        style={{ flex: 1, minWidth: '220px' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn-premium btn-secondary"
                                        onClick={() => setHistorySearch('')}
                                        style={{ padding: '10px 18px' }}
                                    >
                                        Limpiar
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-premium btn-primary"
                                        onClick={handleAddSelectedHistory}
                                        disabled={selectedHistoryProducts.size === 0}
                                        style={{ padding: '10px 18px' }}
                                    >
                                        Agregar seleccionados ({selectedHistoryProducts.size})
                                    </button>
                                </div>

                                {historyLoading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                        <span className="text-gradient" style={{ fontSize: '1.2rem', fontWeight: 600 }}>Cargando historial...</span>
                                    </div>
                                ) : filteredProductHistory.length === 0 ? (
                                    <div className="alert-info">No se encontraron productos recientes en los últimos {periodDays} días.</div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '16px' }}>
                                        {filteredProductHistory.map(product => {
                                            const historyKey = `${product.product_id || product.name}-${product.brand || ''}-${product.category || ''}`;
                                            const isSelected = selectedHistoryProducts.has(historyKey);
                                            return (
                                                <div key={historyKey} className="glass-panel" style={{ padding: '16px', display: 'grid', gap: '12px', border: isSelected ? '1px solid var(--primary-color)' : '1px solid transparent', background: isSelected ? 'rgba(59, 130, 246, 0.05)' : '' }}>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
                                                            <img src={getImageSrc(product.shared_image?.file_path)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600 }}>{product.name}</div>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{product.brand || 'Marca no definida'} · {product.category || 'Categoría no definida'}</div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className={`btn-premium ${isSelected ? 'btn-secondary' : 'btn-primary'}`}
                                                            onClick={() => handleToggleHistoryProduct(product)}
                                                            style={{ whiteSpace: 'nowrap' }}
                                                        >
                                                            {isSelected ? 'Deseleccionar' : 'Seleccionar'}
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                        <div>Última vista: {new Date(product.last_seen).toLocaleDateString()}</div>
                                                        <div>Veces en listas: {product.occurrences}</div>
                                                        <div>Pendientes: {product.pending_count}</div>
                                                        <div>Comprados: {product.purchased_count}</div>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                        <div>Última lista: {product.last_list_name || 'Sin nombre'}</div>
                                                        <div>Fecha de lista: {product.last_list_date ? new Date(product.last_list_date).toLocaleDateString() : 'No disponible'}</div>
                                                    </div>
                                                    {product.last_price != null && (
                                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Último precio conocido: ${product.last_price.toFixed(2)}</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="glass-panel" style={{ padding: '24px', position: 'sticky', top: 0 }}>
                                <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Historial de productos</h4>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    Aquí verás los productos que han aparecido en compras anteriores. Usa el filtro para encontrar rápidamente productos recurrentes y agrégalos a la lista actual.
                                </p>
                                <div style={{ marginTop: '18px', display: 'grid', gap: '10px' }}>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}><strong>{productHistory.length}</strong> productos rastreados en los últimos 90 días</div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Las selecciones agregan un producto con cantidad 1 y unidad estándar, puedes ajustar luego.</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-premium btn-secondary" onClick={handleClose}>
                        Cancelar
                    </button>
                    <button className="btn-premium btn-primary" onClick={onAddItems} disabled={totalSelected === 0}>
                        Agregar {totalSelected} Productos
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PreviousItemsModal;
