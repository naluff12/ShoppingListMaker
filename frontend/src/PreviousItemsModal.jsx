import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, ChevronDown, ChevronUp, ShoppingBag, Check } from 'lucide-react';

const PreviousItemsModal = ({ show, handleClose, familyId, listId, handleAddItems }) => {
    const [previousLists, setPreviousLists] = useState([]);
    const [itemsByList, setItemsByList] = useState({});
    const [selectedItems, setSelectedItems] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [expandedLists, setExpandedLists] = useState(new Set());

    useEffect(() => {
        if (show && familyId) {
            setLoading(true);
            const fetchPreviousListsAndItems = async () => {
                try {
                    const now = new Date();
                    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

                    const response = await fetch(`/api/families/${familyId}/previous_lists?start_date=${startDate}&end_date=${endDate}`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const filteredLists = data.items.filter(list => list.id !== listId);
                        setPreviousLists(filteredLists);

                        const itemsPromises = filteredLists.map(list =>
                            fetch(`/api/listas/${list.id}/items?status=pendiente`, {
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                }
                            }).then(res => res.json())
                        );
                        const itemsResults = await Promise.all(itemsPromises);
                        const itemsMap = filteredLists.reduce((acc, list, index) => {
                            acc[list.id] = itemsResults[index].items;
                            return acc;
                        }, {});
                        setItemsByList(itemsMap);
                        
                        // Expand the first list by default if it has items
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
            fetchPreviousListsAndItems();
        }
    }, [show, familyId, listId]);

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
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 2fr) 1fr', gap: '24px', alignItems: 'flex-start' }}>
                        
                        {/* Lists and Items Column */}
                        <div>
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                    <span className="text-gradient" style={{ fontSize: '1.2rem', fontWeight: 600 }}>Cargando...</span>
                                </div>
                            ) : previousLists.length === 0 ? (
                                <div className="alert-info">No hay listas anteriores con productos pendientes.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {previousLists.map(list => {
                                        const listItems = itemsByList[list.id] || [];
                                        if (listItems.length === 0) return null;
                                        
                                        const isExpanded = expandedLists.has(list.id);
                                        const allSelected = listItems.every(item => selectedItems.has(item.id));

                                        return (
                                            <div key={list.id} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                                                {/* Accordion Header */}
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

                                                {/* Accordion Body */}
                                                {isExpanded && (
                                                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        {listItems.map(item => {
                                                            const isSelected = selectedItems.has(item.id);
                                                            return (
                                                                <div 
                                                                    key={item.id} 
                                                                    className="list-item" 
                                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: '16px', padding: '12px', borderColor: isSelected ? 'var(--primary-glow)' : 'var(--border-color)', background: isSelected ? 'rgba(59, 130, 246, 0.05)' : '' }}
                                                                    onClick={() => handleSelectItem(item)}
                                                                >
                                                                    <div style={{ width: 50, height: 50, borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }}>
                                                                        <img
                                                                            src={item.product?.shared_image ? `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${item.product.shared_image.file_path}` : '/img_placeholder.png'}
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

                        {/* Selected Items Column */}
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
