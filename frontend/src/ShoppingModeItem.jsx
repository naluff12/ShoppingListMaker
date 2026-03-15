import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus, Check, ShoppingCart, Info, Clock, Save } from 'lucide-react';
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
    const [saveMessage, setSaveMessage] = useState(null); // 'Guardado' / 'Guardando...'
    const saveTimeout = useRef(null);
    const saveMessageTimeout = useRef(null);

    useEffect(() => {
        setPrice(item.precio_confirmado ?? '');
        setQuantity(item.cantidad || 1);
        setUnit(item.unit || 'piezas');

        return () => {
            if (saveTimeout.current) clearTimeout(saveTimeout.current);
            if (saveMessageTimeout.current) clearTimeout(saveMessageTimeout.current);
        };
    }, [item]);

    const scheduleAutoSave = () => {
        if (isPurchased || localLoading) return;
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        if (saveMessageTimeout.current) clearTimeout(saveMessageTimeout.current);

        setSaveMessage('Guardando...');

        saveTimeout.current = setTimeout(async () => {
            await performSave();
        }, 800);
    };

    const performSave = async () => {
        if (isPurchased || localLoading) return;
        setSaveMessage('Guardando...');
        try {
            await onItemUpdate(item.id, {
                precio_confirmado: parseFloat(price) || 0,
                cantidad: quantity,
                unit
            });
            setSaveMessage('Guardado');
        } catch (error) {
            setSaveMessage('Error');
        }

        saveMessageTimeout.current = setTimeout(() => setSaveMessage(null), 1200);
    };

    const handleManualSave = () => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        performSave();
    };
    const handleQuantityChange = (delta) => {
        const newQty = Math.max(0.1, quantity + delta);
        const rounded = Number(newQty.toFixed(2));
        setQuantity(rounded);
        scheduleAutoSave();
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
                            onChange={(e) => { setUnit(e.target.value); scheduleAutoSave(); }}
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
                        onChange={(e) => { setPrice(e.target.value); scheduleAutoSave(); }}
                        disabled={isPurchased || localLoading}
                        step="0.01"
                    />
                    {saveMessage && (
                        <div style={{ position: 'absolute', bottom: '-26px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 10px', borderRadius: '999px', fontSize: '0.7rem', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {saveMessage === 'Guardado' ? <Check size={12} /> : saveMessage === 'Error' ? <Info size={12} /> : <Save size={12} />}
                            <span>{saveMessage}</span>
                        </div>
                    )}
                    {item.product?.last_price != null && (
                        <div style={{
                            position: 'absolute',
                            top: '-22px',
                            right: '0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            background: 'rgba(0,0,0,0.4)',
                            padding: '4px 8px',
                            borderRadius: '999px',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                            whiteSpace: 'nowrap',
                            maxWidth: '220px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            pointerEvents: 'none'
                        }}>
                            <Clock size={14} />
                            <span>Últ. precio: ${item.product.last_price}</span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                        className={`finish-btn ${isPurchased ? 'btn-success' : 'btn-primary'}`}
                        onClick={handleFinishPurchase}
                        disabled={localLoading || isPurchased}
                    >
                        {isPurchased ? <Check size={24} /> : <ShoppingCart size={24} />}
                        <span className="btn-text">{isPurchased ? 'Comprado' : 'Comprar'}</span>
                    </button>

                    <button 
                        className="btn-premium btn-secondary"
                        onClick={handleManualSave}
                        disabled={isPurchased || localLoading}
                        style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Guardar cambios"
                    >
                        <Save size={18} />
                        <span style={{ fontSize: '0.85rem' }}>Guardar</span>
                    </button>
                </div>
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
