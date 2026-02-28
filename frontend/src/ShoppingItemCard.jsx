import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Trash, MessageSquare, TrendingUp, MoreVertical, X, Check, Eye, Camera, Image as ImageIcon, Search } from 'lucide-react';
import ImageUploader from './ImageUploader';
import WebImageSearchModal from './WebImageSearchModal';
import { API_BASE_URL } from './config';

const ShoppingItemCard = ({
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

    const getImageSrc = (url) => {
        if (!url) return '/img_placeholder.png';
        if (url.startsWith('http') || url.startsWith('blob') || url.startsWith('data:')) return url;
        if (url.startsWith('/api')) return `${API_BASE_URL}${url}`;
        return `${API_BASE_URL}/api${url}`;
    };

    return (
        <div className={`glass-panel item-card ${item.status === 'comprado' ? 'item-comprado' : ''}`}>
            <div className="item-card-header d-flex justify-content-between align-items-center">
                <span style={{ fontWeight: 600, fontSize: '1.1rem', textDecoration: item.status === 'comprado' ? 'line-through' : 'none', color: item.status === 'comprado' ? 'var(--text-muted)' : 'inherit' }}>{item.nombre}</span>
                <label className="switch" title={item.status === 'comprado' ? 'Marcar como pendiente' : 'Marcar como comprado'}>
                    <input 
                        type="checkbox" 
                        checked={item.status === 'comprado'} 
                        onChange={() => onStatusChange(item.id, item.status)} 
                    />
                    <span className="slider round"></span>
                </label>
            </div>
            
            <div className="item-card-body">
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div className="item-image-container" ref={dropdownRef} style={{ width: '100px', flexShrink: 0, position: 'relative' }}>
                        {item.product?.shared_image ? (
                            <>
                                <div style={{ width: '100px', height: '100px', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                                <img src={getImageSrc(item.product?.shared_image.file_path)} alt="Producto" style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
                                        style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', borderRadius: '50%', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', zIndex: 10 }}
                                        title="Opciones de imagen"
                                    >
                                        <MoreVertical size={16} color="white" />
                                    </button>
                                </div>

                                {showDropdown && (
                                    <div style={{ position: 'absolute', bottom: '100%', left: 0, minWidth: '170px', zIndex: 9999, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', marginBottom: '4px' }}>
                                        <div className="dropdown-item" onClick={handleViewClick} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}><Eye size={16} style={{marginRight: '8px', flexShrink: 0}} /> Ver imagen</div>
                                        <div className="dropdown-item" onClick={handleChangeClick} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}><Camera size={16} style={{marginRight: '8px', flexShrink: 0}} /> Cambiar imagen</div>
                                        <div className="dropdown-item" onClick={() => { setShowWebSearchModal(true); setShowDropdown(false); }} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}><Search size={16} style={{marginRight: '8px', flexShrink: 0}} /> Buscar en línea</div>
                                        <div className="dropdown-item" onClick={handleGalleryClick} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}><ImageIcon size={16} style={{marginRight: '8px', flexShrink: 0}} /> De la galería</div>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', width: '100%' }}>
                                <ImageUploader itemId={item.id} imageUrl={''} onImageUpload={onImageUpload} />
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setShowWebSearchModal(true); }}
                                    className="btn-premium btn-secondary"
                                    style={{ padding: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                    title="Buscar en línea"
                                >
                                    <Search size={14} /> Buscar Web
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
                    
                    <div className="item-details" style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {item.product?.brand || 'Sin marca'} / {item.product?.category || 'Sin categoría'}
                        </p>
                        
                        {isEditing ? (
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                <input 
                                    type="number" 
                                    className="premium-input" 
                                    style={{ width: '80px', padding: '6px' }}
                                    value={editingItem.cantidad} 
                                    onChange={(e) => setEditingItem({ ...editingItem, cantidad: parseFloat(e.target.value) || 0 })} 
                                />
                                <select 
                                    className="premium-input" 
                                    style={{ width: '100px', padding: '6px' }}
                                    value={editingItem.unit} 
                                    onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                                >
                                    <option value="piezas">piezas</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="L">L</option>
                                    <option value="ml">ml</option>
                                </select>
                                <button className="btn-premium btn-primary" style={{ padding: '6px 12px' }} onClick={() => onItemUpdate(editingItem.id, { cantidad: editingItem.cantidad, unit: editingItem.unit })}>Guardar</button>
                                <button className="btn-premium btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setEditingItem(null)}>Cancelar</button>
                            </div>
                        ) : (
                            <div onDoubleClick={() => setEditingItem({ ...item })} title="Doble click para editar cantidad" style={{ cursor: 'pointer', marginBottom: '8px' }}>
                                <span><b>Cantidad:</b> {item.cantidad} {item.unit}</span>
                            </div>
                        )}

                        <div onDoubleClick={() => setEditingPrice({ id: item.id, field: 'precio_confirmado' })} title="Doble click para editar precio" style={{ cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
                            <b style={{ marginRight: '8px' }}>Precio:</b>
                            {editingPrice?.id === item.id && editingPrice?.field === 'precio_confirmado' ? (
                                <input
                                    type="number"
                                    className="premium-input"
                                    step="0.01"
                                    defaultValue={item.precio_confirmado || item.product?.last_price || ''}
                                    autoFocus
                                    onBlur={(e) => onPriceChange(item.id, 'precio_confirmado', e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                    style={{ width: '100px', padding: '4px 8px' }}
                                />
                            ) : (
                                <span className={`badge ${priceBadgeClass}`}>${priceValue}</span>
                            )}
                        </div>

                        <div className="flex-mobile-stack" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button className="btn-premium" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '6px 10px' }} onClick={() => onDelete(item.id)} disabled={loading}>
                                <Trash size={16} />
                            </button>
                            <button className="btn-premium" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info-color)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => onShowItemBlame(item.id)} disabled={loadingItemBlame && showItemBlame === item.id}>
                                <MessageSquare size={16} /> <span>Historial</span>
                            </button>
                            <button className="btn-premium btn-primary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => onShowPriceHistory(item)}>
                                <TrendingUp size={16} /> <span>Precios</span>
                            </button>
                        </div>
                    </div>
                </div>

                {showItemBlame === item.id && (
                    <div className="item-history-collapse mt-3" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <h6 style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>Historial del Producto</h6>
                        {itemBlames[item.id] && itemBlames[item.id].length === 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sin historial</div>}
                        <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '12px' }}>
                            {itemBlames[item.id] && itemBlames[item.id].map(c => (
                                <div key={c.id} style={{ marginBottom: '8px', fontSize: '0.85rem', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span className="badge badge-secondary">{c.user?.username || 'Usuario'}</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{new Date(c.timestamp).toLocaleString()}</span>
                                    </div>
                                    <p style={{ margin: 0 }}>{c.detalles}</p>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); onItemCommentSubmit(item.id); }} style={{ display: 'flex', gap: '8px' }}>
                            <input type="text" className="premium-input" style={{ flex: 1, padding: '6px' }} placeholder="Nuevo comentario..." value={newItemComment} onChange={e => setNewItemComment(e.target.value)} />
                            <button type="submit" className="btn-premium btn-primary" style={{ padding: '6px 16px' }}>Comentar</button>
                        </form>
                    </div>
                )}
            </div>
            
            <div className="item-card-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Agregado por: <b>{item.creado_por?.username || 'desconocido'}</b>
            </div>
        </div>
    );
};

export default ShoppingItemCard;