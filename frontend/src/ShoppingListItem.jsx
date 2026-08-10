import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Trash, MessageSquare, TrendingUp, MoreVertical, X, Check, Eye, Camera, Image as ImageIcon, Search, Edit2 } from 'lucide-react';
import ImageUploader from './ImageUploader';
import WebImageSearchModal from './WebImageSearchModal';
import TruncatedText from './TruncatedText';
import { API_BASE_URL } from './config';
import { productApi } from './api';

const ShoppingListItem = ({
    item,
    onStatusChange,
    onDelete,
    onImageUpload,
    onItemUpdate,
    onPriceChange,
    onShowItemBlame,
    onItemCommentSubmit,
    onShowPriceHistory,
    onShowGallery,
    editingItem,
    setEditingItem,
    editingPrice,
    setEditingPrice,
    showItemBlame,
    itemBlames,
    newItemComment,
    setNewItemComment,
    loadingItemBlame,
    loading,
    onProductUpdate,
    isSelected = false,
    onSelect = () => {}
}) => {
    const isEditing = editingItem && editingItem.id === item.id;
    const [showImageModal, setShowImageModal] = useState(false);
    const [showWebSearchModal, setShowWebSearchModal] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const actionsMenuRef = useRef(null);
    const fileInputRef = useRef(null);

    // Candado de precio: estado local para que el check no "parpadee" al refrescar.
    const [priceLocked, setPriceLocked] = useState(!!item.product?.precio_base);
    const [pesoDraft, setPesoDraft] = useState(item.product?.peso_promedio || '');
    const [priceBaseDraft, setPriceBaseDraft] = useState(item.product?.precio_base || '');
    const [priceDraft, setPriceDraft] = useState(item.precio_confirmado ?? item.product?.last_price ?? '');
    useEffect(() => {
        setPriceLocked(!!item.product?.precio_base);
        setPesoDraft(item.product?.peso_promedio || '');
        setPriceBaseDraft(item.product?.precio_base || '');
        setPriceDraft(item.precio_confirmado ?? item.product?.last_price ?? '');
    }, [item.product?.precio_base, item.product?.peso_promedio, item.precio_confirmado]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
                setShowActionsMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            onImageUpload(item.id, file);
        }
    };

    const handleViewClick = () => {
        setShowImageModal(true);
        setShowActionsMenu(false);
    }

    const handleChangeClick = () => {
        fileInputRef.current.click();
        setShowActionsMenu(false);
    }

    const handleGalleryClick = () => {
        onShowGallery(item);
        setShowActionsMenu(false);
    }

    const priceValue = (item.precio_confirmado || item.product?.last_price || 0).toFixed(2);
    const priceBadgeClass = item.precio_confirmado ? 'badge-success' : item.product?.last_price ? 'badge-warning' : 'badge-primary';

    const getImageSrc = (url) => {
        if (!url) return '/img_placeholder.png';
        if (url.startsWith('http') || url.startsWith('blob') || url.startsWith('data:')) return url;
        if (url.startsWith('/api')) return `${API_BASE_URL}${url}`;
        return `${API_BASE_URL}/api${url}`;
    };

    // Equivalencia unidad→peso (g/pieza) para mostrar el peso aproximado en piezas.
    const formatEquivalencia = (it) => {
        const pesoPromedio = it.product?.peso_promedio;
        if (!pesoPromedio) return '';
        const unitKey = (it.unit || '').toLowerCase();
        if (unitKey === 'piezas' || unitKey === 'pieza' || unitKey === 'pza' || unitKey === 'uds') {
            const grams = (it.cantidad || 0) * pesoPromedio;
            if (grams <= 0) return '';
            return grams >= 1000 ? `${(grams / 1000).toFixed(2).replace(/\.?0+$/, '')} kg` : `${Math.round(grams)} g`;
        }
        return '';
    };

    // Cálculo en vivo del precio con candado (replica la lógica del backend):
    // cantidad+unidad → gramos → precio según base (/kg o /pieza).
    const calcPrecioVivo = () => {
        if (!priceLocked || !item.product) return null;
        const base = parseFloat(priceBaseDraft);
        if (isNaN(base) || base <= 0) return null;
        const qty = parseFloat(editingItem?.cantidad) || 0;
        const unit = String(editingItem?.unit || 'piezas').toLowerCase();
        const peso = parseFloat(pesoDraft) > 0 ? parseFloat(pesoDraft) : (item.product.peso_promedio || 0);
        const baseUnit = (item.product.precio_base_unit || 'kg').toLowerCase();

        let grams = null;
        if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(unit)) grams = qty * 1000;
        else if (['g', 'gr', 'gramos'].includes(unit)) grams = qty;
        else if (['l', 'lt', 'litro', 'litros'].includes(unit)) grams = qty * 1000;
        else if (['ml', 'mililitro', 'mililitros'].includes(unit)) grams = qty;
        else if (peso > 0) grams = qty * peso; // piezas
        if (!grams || grams <= 0) return null;

        if (baseUnit === 'pieza' || baseUnit === 'piezas' || baseUnit === 'pza') {
            if (peso <= 0) return null;
            return (grams / peso) * base;
        }
        return (grams / 1000) * base;
    };
    const precioVivo = calcPrecioVivo();

    return (
        <div className={`glass-panel shopping-list-item-compact ${item.status === 'comprado' ? 'item-comprado' : ''} ${isSelected ? 'item-selected' : ''}`} style={{ display: 'flex', flexDirection: 'column', padding: '6px', marginBottom: '6px', position: 'relative', zIndex: isEditing ? 1000 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Grupo Izquierdo: Checkbox, Imagen, Nombre/Detalles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <label className="custom-check" onClick={(e) => e.stopPropagation()}>
                        <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={onSelect} 
                        />
                        <span className="custom-check-box" style={{ width: '20px', height: '20px' }}><Check size={13} /></span>
                    </label>
                    <label className="switch" title={item.status === 'comprado' ? 'Marcar como pendiente' : 'Marcar como comprado'} style={{ flexShrink: 0, width: '34px', height: '18px' }}>
                        <input 
                            type="checkbox" 
                            checked={item.status === 'comprado'} 
                            onChange={() => onStatusChange(item.id, item.status)} 
                        />
                        <span className="slider round" style={{ borderRadius: '18px' }}></span>
                    </label>
                    
                    <div style={{ width: '40px', flexShrink: 0, position: 'relative' }}>
                        {item.product?.shared_image ? (
                            <>
                                <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                                    <img
                                        src={getImageSrc(item.product.shared_image.file_path)}
                                        alt={item.nombre}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    capture="environment"
                                />
                                
                                {showImageModal && ReactDOM.createPortal(
                                    <div className="modal-backdrop" onClick={() => setShowImageModal(false)}>
                                        <div style={{ padding: '0', background: 'transparent', boxShadow: 'none', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
                                            <div style={{ position: 'relative' }}>
                                                <button className="modal-close" onClick={() => setShowImageModal(false)} style={{ position: 'absolute', top: '-40px', right: '0', color: 'white' }}>
                                                    <X size={32} />
                                                </button>
                                                <img src={getImageSrc(item.product?.shared_image.file_path)} alt="Producto" style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} />
                                            </div>
                                        </div>
                                    </div>,
                                    document.body
                                )}

                                <WebImageSearchModal 
                                    show={showWebSearchModal}
                                    handleClose={() => setShowWebSearchModal(false)}
                                    productName={item.nombre}
                                    productId={item.product?.id}
                                    onImageSelected={(updatedProduct) => {
                                        if (onProductUpdate) onProductUpdate();
                                    }}
                                />
                            </>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', height: '100%' }}>
                                <ImageUploader itemId={item.id} imageUrl={''} onImageUpload={onImageUpload} style={{height: '30px'}} />
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setShowWebSearchModal(true); }}
                                    className="btn-premium btn-secondary"
                                    style={{ padding: '2px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', width: '100%' }}
                                    title="Buscar en línea"
                                >
                                    <Search size={10} /> Buscar
                                </button>
                                <WebImageSearchModal 
                                    show={showWebSearchModal}
                                    handleClose={() => setShowWebSearchModal(false)}
                                    productName={item.nombre}
                                    productId={item.product?.id}
                                    onImageSelected={(updatedProduct) => {
                                        if (onProductUpdate) onProductUpdate();
                                    }}
                                />
                            </div>
                        )}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: item.status === 'comprado' ? 'line-through' : 'none', color: item.status === 'comprado' ? 'var(--text-muted)' : 'inherit' }} onDoubleClick={() => setEditingItem({ ...item })} title="Doble click para editar detalles">
                            <TruncatedText text={item.nombre} maxChars={18} />
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <TruncatedText text={`${item.product?.brand || 'Sin marca'} / ${item.product?.category || 'Sin categoría'}`} maxChars={24} />
                        </div>
                        
                        {isEditing ? ReactDOM.createPortal(
                            <div className="shopping-list-edit-popover">
                                <div className="edit-modal-header">
                                    <div>
                                        <strong>Editar producto</strong>
                                        <small>{item.nombre}</small>
                                    </div>
                                    <button type="button" className="edit-modal-close" onClick={() => setEditingItem(null)} aria-label="Cerrar edición">×</button>
                                </div>

                                <div className="edit-field-group edit-quantity-group">
                                    <label>Cantidad que necesitas</label>
                                    <small>Indica cuánto quieres comprar de este producto.</small>
                                    <div className="edit-inline-fields">
                                        <input
                                            type="number"
                                            className="premium-input"
                                            aria-label="Cantidad"
                                            value={editingItem.cantidad}
                                            onChange={(e) => setEditingItem({ ...editingItem, cantidad: parseFloat(e.target.value) || 0 })}
                                        />
                                        <select
                                            className="premium-input"
                                            aria-label="Unidad de cantidad"
                                            value={editingItem.unit}
                                            onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                                        >
                                            <option value="piezas">piezas</option>
                                            <option value="kg">kg</option>
                                            <option value="g">g</option>
                                            <option value="L">L</option>
                                            <option value="ml">ml</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="edit-field-group">
                                    <label>Peso aproximado por pieza</label>
                                    <small>Solo se usa para convertir piezas a gramos o kilos. No es el precio.</small>
                                    {item.product?.id && (
                                        <div className="edit-weight-field">
                                            <input
                                                type="number"
                                                className="premium-input"
                                                aria-label="Peso aproximado por pieza en gramos"
                                                placeholder="Ej. 350"
                                                value={pesoDraft}
                                                onChange={(e) => {
                                                    setPesoDraft(e.target.value);
                                                    const val = parseFloat(e.target.value);
                                                    if (!isNaN(val) && val > 0 && item.product) {
                                                        // Guardado silencioso: sin refetch para no perder focus
                                                        productApi.update(item.product.id, { name: item.product.name, peso_promedio: val })
                                                            .catch(err => console.error('Error guardando peso', err));
                                                    }
                                                }}
                                            />
                                            <span>gramos por pieza</span>
                                        </div>
                                    )}
                                </div>

                                <div className="edit-field-group">
                                    <label>Precio base (candado)</label>
                                    <small>Activa el candado para fijar el precio por kg o por pieza y que el total se calcule solo.</small>
                                    {item.product?.id && (
                                        <label className="edit-lock-toggle">
                                            <input
                                                type="checkbox"
                                                checked={priceLocked}
                                                onChange={(e) => {
                                                    if (!item.product) return;
                                                    const willLock = e.target.checked;
                                                    setPriceLocked(willLock);
                                                    if (willLock) {
                                                        const sugerido = parseFloat(priceBaseDraft) || item.product.last_price || item.precio_confirmado || 1;
                                                        setPriceBaseDraft(sugerido);
                                                        productApi.update(item.product.id, {
                                                            name: item.product.name,
                                                            precio_base: sugerido,
                                                            precio_base_unit: item.product.precio_base_unit || 'kg'
                                                        }).catch(err => console.error('Error activando candado', err));
                                                    } else {
                                                        productApi.update(item.product.id, {
                                                            name: item.product.name,
                                                            precio_base: null,
                                                            precio_base_unit: null
                                                        }).catch(err => console.error('Error desactivando candado', err));
                                                    }
                                                }}
                                            />
                                            <span>🔒 Fijar precio por kg o por pieza</span>
                                        </label>
                                    )}
                                    {priceLocked && item.product?.id && (
                                        <div className="edit-inline-fields" style={{ marginTop: '8px' }}>
                                            <span className="edit-currency">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="premium-input"
                                                aria-label="Precio base"
                                                placeholder="Ej. 30"
                                                value={priceBaseDraft}
                                                onChange={(e) => {
                                                    setPriceBaseDraft(e.target.value);
                                                    const val = parseFloat(e.target.value);
                                                    if (!isNaN(val) && val > 0 && item.product) {
                                                        // Guardado silencioso: sin refetch para no perder focus
                                                        productApi.update(item.product.id, {
                                                            name: item.product.name,
                                                            precio_base: val,
                                                            precio_base_unit: item.product.precio_base_unit || 'kg'
                                                        }).catch(err => console.error('Error guardando precio base', err));
                                                    }
                                                }}
                                            />
                                            <select
                                                className="premium-input"
                                                aria-label="Unidad del precio base"
                                                value={item.product.precio_base_unit || 'kg'}
                                                onChange={(e) => {
                                                    if (!item.product) return;
                                                    productApi.update(item.product.id, {
                                                        name: item.product.name,
                                                        precio_base: item.product.precio_base,
                                                        precio_base_unit: e.target.value
                                                    }).catch(err => console.error('Error guardando unidad base', err));
                                                }}
                                            >
                                                <option value="kg">/ kg</option>
                                                <option value="pieza">/ pieza</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="edit-field-group">
                                    <label>Precio de compra</label>
                                    <small>{priceLocked ? 'El precio se calcula solo desde el candado.' : 'Cuánto pagaste o estimas pagar por esta cantidad.'}</small>
                                    {priceLocked ? (
                                        <div className="edit-price-locked">
                                            Total calculado: <strong>${precioVivo != null ? precioVivo.toFixed(2) : priceValue}</strong>
                                        </div>
                                    ) : (
                                        <div className="edit-inline-fields">
                                            <span className="edit-currency">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="premium-input"
                                                aria-label="Precio de compra"
                                                placeholder="Ej. 25.50"
                                                value={priceDraft}
                                                onChange={(e) => setPriceDraft(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="edit-modal-actions">
                                    <button className="btn-premium btn-secondary" onClick={() => setEditingItem(null)}>Cancelar</button>
                                    <button className="btn-premium btn-primary" onClick={() => {
                                        const payload = { cantidad: editingItem.cantidad, unit: editingItem.unit };
                                        const p = parseFloat(priceDraft);
                                        if (!isNaN(p) && priceDraft !== '') payload.precio_confirmado = p;
                                        onItemUpdate(editingItem.id, payload);
                                    }}>Guardar</button>
                                </div>
                            </div>, document.body) : (
                            <div onDoubleClick={() => setEditingItem({ ...item })} title="Doble click para editar cantidad" style={{ cursor: 'pointer', marginTop: '2px', fontSize: '0.85rem' }}>
                                {item.cantidad} {item.unit}
                                {formatEquivalencia(item) && (
                                    <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>≈ {formatEquivalencia(item)}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Grupo Derecho: Precio */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '4px', flexShrink: 0 }}>
                    <div onDoubleClick={() => !item.product?.precio_base && setEditingPrice({ id: item.id, field: 'precio_confirmado' })} title={item.product?.precio_base ? 'Precio calculado desde la base (candado)' : 'Doble click para editar precio'} style={{ cursor: 'pointer' }}>
                        {item.product?.precio_base ? (
                            <span className={`badge ${priceBadgeClass}`} style={{ fontSize: '0.7rem', padding: '1px 4px' }}>${priceValue} 🔒</span>
                        ) : editingPrice?.id === item.id && editingPrice?.field === 'precio_confirmado' ? (
                            <input
                                type="number"
                                className="premium-input"
                                step="0.01"
                                defaultValue={item.precio_confirmado || item.product?.last_price || ''}
                                autoFocus
                                onBlur={(e) => onPriceChange(item.id, 'precio_confirmado', e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                style={{ width: '60px', padding: '2px 4px', fontSize: '0.75rem' }}
                            />
                        ) : (
                            <span className={`badge ${priceBadgeClass}`} style={{ fontSize: '0.7rem', padding: '1px 4px' }}>${priceValue}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Fila de controles (debajo de la imagen/detalles) */}
            <div className="shopping-list-item-controls" style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center', position: 'relative' }} ref={actionsMenuRef}>
                <button className="btn-premium" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info-color)', width: '34px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onClick={() => onShowItemBlame(item.id)} disabled={loadingItemBlame && showItemBlame === item.id} title="Comentarios del producto">
                    <MessageSquare size={14} />
                </button>
                <button className="btn-premium" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info-color)', width: '34px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onClick={() => onShowPriceHistory(item)} title="Historial de precios">
                    <TrendingUp size={14} />
                </button>
                <button className="btn-premium" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info-color)', width: '34px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onClick={() => setEditingItem({ ...item })} title="Editar cantidad/unidad">
                    <Edit2 size={14} />
                </button>
                <button className="btn-premium" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', width: '34px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onClick={() => onDelete(item.id)} disabled={loading} title="Eliminar">
                    <Trash size={14} />
                </button>
                <button className="btn-premium btn-secondary" style={{ width: '34px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onClick={() => setShowActionsMenu(prev => !prev)} title="Opciones de imagen">
                    <MoreVertical size={14} />
                </button>
                {showActionsMenu && (
                    <div className="glass-panel" style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 8px)', zIndex: 200, minWidth: '180px', maxWidth: 'min(260px, calc(100vw - 24px))', padding: '6px', display: 'flex', flexDirection: 'column' }}>
                        {item.product?.shared_image && (
                            <div className="dropdown-item" onClick={handleViewClick} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.9rem' }}><Eye size={14} style={{ marginRight: '10px', flexShrink: 0 }} /> Ver imagen</div>
                        )}
                        {item.product?.shared_image && (
                            <div className="dropdown-item" onClick={handleChangeClick} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.9rem' }}><Camera size={14} style={{ marginRight: '10px', flexShrink: 0 }} /> Cambiar imagen</div>
                        )}
                        {!item.product?.product_url && !item.product?.store_name && (
                        <div className="dropdown-item" onClick={() => { setShowWebSearchModal(true); setShowActionsMenu(false); }} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.9rem' }}><Search size={14} style={{ marginRight: '10px', flexShrink: 0 }} /> Buscar en línea</div>
                        )}
                        <div className="dropdown-item" onClick={handleGalleryClick} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.9rem' }}><ImageIcon size={14} style={{ marginRight: '10px', flexShrink: 0 }} /> De la galería</div>
                    </div>
                )}
            </div>

            {showItemBlame === item.id && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <h6 style={{ margin: '0 0 8px 0', fontSize: '0.95rem' }}>Historial del Producto</h6>
                    {itemBlames[item.id] && itemBlames[item.id].length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sin historial</div>}
                    <div style={{ maxHeight: '100px', overflowY: 'auto', marginBottom: '12px' }}>
                        {itemBlames[item.id] && itemBlames[item.id].map(c => (
                            <div key={c.id} style={{ marginBottom: '6px', fontSize: '0.8rem', padding: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{c.user?.username || 'Usuario'}</span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{new Date(c.timestamp).toLocaleString()}</span>
                                </div>
                                <p style={{ margin: 0 }}>{c.detalles}</p>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); onItemCommentSubmit(item.id); }} style={{ display: 'flex', gap: '8px' }}>
                        <input type="text" className="premium-input" style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem' }} placeholder="Nuevo comentario..." value={newItemComment} onChange={e => setNewItemComment(e.target.value)} />
                        <button type="submit" className="btn-premium btn-primary" style={{ padding: '4px 12px', fontSize: '0.85rem' }}>Comentar</button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ShoppingListItem;