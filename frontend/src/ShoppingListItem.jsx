import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Trash, MessageSquare, TrendingUp, MoreVertical, X, Check, Eye, Camera, Image as ImageIcon, Search } from 'lucide-react';
import ImageUploader from './ImageUploader';
import WebImageSearchModal from './WebImageSearchModal';
import { API_BASE_URL } from './config';

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
    onProductUpdate
}) => {
    const isEditing = editingItem && editingItem.id === item.id;
    const [showImageModal, setShowImageModal] = useState(false);
    const [showWebSearchModal, setShowWebSearchModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
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
        setShowDropdown(false);
    }

    const handleChangeClick = () => {
        fileInputRef.current.click();
        setShowDropdown(false);
    }

    const handleGalleryClick = () => {
        onShowGallery(item);
        setShowDropdown(false);
    }

    const priceValue = (item.precio_confirmado || item.product?.last_price || 0).toFixed(2);
    const priceBadgeClass = item.precio_confirmado ? 'badge-success' : item.product?.last_price ? 'badge-warning' : 'badge-primary';

    return (
        <div className={`glass-panel shopping-list-item-compact ${item.status === 'comprado' ? 'item-comprado' : ''}`} style={{ display: 'flex', flexDirection: 'column', padding: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Grupo Izquierdo: Checkbox, Imagen, Nombre/Detalles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <label className="switch" title={item.status === 'comprado' ? 'Marcar como pendiente' : 'Marcar como comprado'} style={{ flexShrink: 0, width: '34px', height: '18px' }}>
                        <input 
                            type="checkbox" 
                            checked={item.status === 'comprado'} 
                            onChange={() => onStatusChange(item.id, item.status)} 
                        />
                        <span className="slider round" style={{ borderRadius: '18px' }}></span>
                    </label>
                    
                    <div ref={dropdownRef} style={{ width: '48px', flexShrink: 0, position: 'relative' }}>
                        {item.product?.shared_image ? (
                            <>
                                <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                                    <img
                                        src={`${API_BASE_URL}/api${item.product.shared_image.file_path}`}
                                        alt={item.nombre}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
                                        style={{ position: 'absolute', bottom: '1px', right: '1px', background: 'rgba(0,0,0,0.7)', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', zIndex: 10 }}
                                        title="Opciones de imagen"
                                    >
                                        <MoreVertical size={12} color="white" />
                                    </button>
                                </div>

                                {showDropdown && (
                                    <div style={{ position: 'absolute', bottom: '100%', left: 0, minWidth: '160px', zIndex: 9999, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', marginBottom: '4px' }}>
                                        <div className="dropdown-item" onClick={handleViewClick} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}><Eye size={14} style={{marginRight: '8px', flexShrink: 0}} /> Ver imagen</div>
                                        <div className="dropdown-item" onClick={handleChangeClick} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}><Camera size={14} style={{marginRight: '8px', flexShrink: 0}} /> Cambiar</div>
                                        <div className="dropdown-item" onClick={() => { setShowWebSearchModal(true); setShowDropdown(false); }} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}><Search size={14} style={{marginRight: '8px', flexShrink: 0}} /> Web Search</div>
                                        <div className="dropdown-item" onClick={handleGalleryClick} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}><ImageIcon size={14} style={{marginRight: '8px', flexShrink: 0}} /> Galería</div>
                                    </div>
                                )}
                                
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                    accept="image/jpeg,image/png"
                                />
                                
                                {showImageModal && ReactDOM.createPortal(
                                    <div className="modal-backdrop" onClick={() => setShowImageModal(false)}>
                                        <div style={{ padding: '0', background: 'transparent', boxShadow: 'none', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
                                            <div style={{ position: 'relative' }}>
                                                <button className="modal-close" onClick={() => setShowImageModal(false)} style={{ position: 'absolute', top: '-40px', right: '0', color: 'white' }}>
                                                    <X size={32} />
                                                </button>
                                                <img src={`${API_BASE_URL}/api${item.product?.shared_image.file_path}`} alt="Producto" style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} />
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
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', textDecoration: item.status === 'comprado' ? 'line-through' : 'none', color: item.status === 'comprado' ? 'var(--text-muted)' : 'inherit' }} onDoubleClick={() => setEditingItem({ ...item })} title="Doble click para editar detalles">
                            {item.nombre}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {item.product?.brand || 'Sin marca'} / {item.product?.category || 'Sin categoría'}
                        </div>
                        
                        {isEditing ? (
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                                <input 
                                    type="number" 
                                    className="premium-input" 
                                    style={{ width: '50px', padding: '2px 4px', fontSize: '0.8rem' }}
                                    value={editingItem.cantidad} 
                                    onChange={(e) => setEditingItem({ ...editingItem, cantidad: parseFloat(e.target.value) || 0 })} 
                                />
                                <select 
                                    className="premium-input" 
                                    style={{ width: '70px', padding: '2px 4px', fontSize: '0.8rem' }}
                                    value={editingItem.unit} 
                                    onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                                >
                                    <option value="piezas">piezas</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="L">L</option>
                                    <option value="ml">ml</option>
                                </select>
                                <button className="btn-premium btn-primary" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => onItemUpdate(editingItem.id, { cantidad: editingItem.cantidad, unit: editingItem.unit })}>Ok</button>
                                <button className="btn-premium btn-secondary" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => setEditingItem(null)}>X</button>
                            </div>
                        ) : (
                            <div onDoubleClick={() => setEditingItem({ ...item })} title="Doble click para editar cantidad" style={{ cursor: 'pointer', marginTop: '2px', fontSize: '0.85rem' }}>
                                {item.cantidad} {item.unit}
                            </div>
                        )}
                    </div>
                </div>

                {/* Grupo Derecho: Precio y Acciones Verticales Compactas */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '4px', flexShrink: 0 }}>
                    <div onDoubleClick={() => setEditingPrice({ id: item.id, field: 'precio_confirmado' })} title="Doble click para editar precio" style={{ cursor: 'pointer' }}>
                        {editingPrice?.id === item.id && editingPrice?.field === 'precio_confirmado' ? (
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <button className="btn-premium" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info-color)', padding: '3px', borderRadius: '3px' }} onClick={() => onShowItemBlame(item.id)} disabled={loadingItemBlame && showItemBlame === item.id}>
                            <MessageSquare size={12} />
                        </button>
                        <button className="btn-premium" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)', padding: '3px', borderRadius: '3px' }} onClick={() => onShowPriceHistory(item)}>
                            <TrendingUp size={12} />
                        </button>
                        <button className="btn-premium" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '3px', borderRadius: '3px' }} onClick={() => onDelete(item.id)} disabled={loading}>
                            <Trash size={12} />
                        </button>
                    </div>
                </div>
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