import React, { useState, useEffect } from 'react';
import { Plus, Minus, Check, ShoppingCart, Info } from 'lucide-react';
import { API_BASE_URL } from './config';

const ShoppingModeItem = ({ 
    item, 
    onItemUpdate, 
    onStatusChange,
    loading,
    isSelected = false,
    onSelect = () => {}
}) => {
    const [price, setPrice] = useState(item.precio_confirmado ?? '');
    const [quantity, setQuantity] = useState(item.cantidad || 1);
    const [unit, setUnit] = useState(item.unit || 'piezas');
    const [localLoading, setLocalLoading] = useState(false);

    useEffect(() => {
        setPrice(item.precio_confirmado ?? '');
        setQuantity(item.cantidad || 1);
        setUnit(item.unit || 'piezas');
    }, [item]);

    const handleQuantityChange = (delta) => {
        const newQty = Math.max(0.1, quantity + delta);
        setQuantity(Number(newQty.toFixed(2)));
    };

    const handleFinishPurchase = async () => {
        setLocalLoading(true);
        try {
            // Actualizamos precio, cantidad, unidad y marcamos como comprado
            await onItemUpdate(item.id, {
                precio_confirmado: parseFloat(price) || 0,
                cantidad: quantity,
                unit,
                status: 'comprado'
            });
        } catch (error) {
            console.error("Error finishing purchase:", error);
        } finally {
            setLocalLoading(false);
        }
    };

    const isPurchased = item.status === 'comprado';

    return (
        <div className={`glass-panel shopping-mode-item ${isPurchased ? 'purchased' : ''}`}>
            <div className="item-main-info" style={{ alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={onSelect} 
                        style={{ width: '18px', height: '18px' }}
                    />
                </div>
                <div className="item-image-mini">
                    <img 
                        src={item.product?.shared_image ? `${API_BASE_URL}/api${item.product.shared_image.file_path}` : '/img_placeholder.png'} 
                        alt={item.nombre} 
                    />
                </div>
                <div className="item-text">
                    <span className="item-name">{item.nombre}</span>
                    <span className="item-subtitle">{item.product?.brand || 'Sin marca'}</span>
                </div>
            </div>

            <div className="shopping-controls">
                <div className="quantity-control-group">
                    <button 
                        className="qty-btn" 
                        onClick={() => handleQuantityChange(-1)}
                        disabled={isPurchased || localLoading}
                    >
                        <Minus size={20} />
                    </button>
                    <div className="qty-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                            type="number" 
                            className="qty-input-manual"
                            value={quantity}
                            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                            disabled={isPurchased || localLoading}
                            step="any"
                            style={{ width: '70px' }}
                        />
                        <select
                            className="premium-input"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            disabled={isPurchased || localLoading}
                            style={{ width: '90px', padding: '6px', fontSize: '0.85rem' }}
                        >
                            <option value="piezas">piezas</option>
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="L">L</option>
                            <option value="ml">ml</option>
                        </select>
                    </div>
                    <button 
                        className="qty-btn" 
                        onClick={() => handleQuantityChange(1)}
                        disabled={isPurchased || localLoading}
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="price-input-group" style={{ position: 'relative' }}>
                    <span className="currency-symbol">$</span>
                    <input 
                        type="number" 
                        className="shopping-price-input" 
                        placeholder={item.product?.last_price ? `Últ. $${item.product.last_price}` : 'Precio'}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        disabled={isPurchased || localLoading}
                        step="0.01"
                    />
                    {item.product?.last_price != null && (
                        <span style={{ position: 'absolute', bottom: '-18px', right: '0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Últ. precio: ${item.product.last_price}
                        </span>
                    )}
                </div>

                <button 
                    className={`finish-btn ${isPurchased ? 'btn-success' : 'btn-primary'}`}
                    onClick={handleFinishPurchase}
                    disabled={localLoading || isPurchased}
                >
                    {isPurchased ? <Check size={24} /> : <ShoppingCart size={24} />}
                    <span className="btn-text">{isPurchased ? 'Comprado' : 'Comprar'}</span>
                </button>
            </div>
            
            {!isPurchased && item.comentario && (
                <div className="item-note">
                    <Info size={14} />
                    <span>{item.comentario}</span>
                </div>
            )}
        </div>
    );
};

export default ShoppingModeItem;
