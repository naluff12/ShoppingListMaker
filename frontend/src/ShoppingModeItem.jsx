import { Plus, Minus, Check, ShoppingCart, Info } from 'lucide-react';
import { API_BASE_URL } from './config';

const ShoppingModeItem = ({ 
    item, 
    onItemUpdate, 
    onStatusChange,
    loading 
}) => {
    const [price, setPrice] = useState(item.precio_confirmado || item.product?.last_price || '');
    const [quantity, setQuantity] = useState(item.cantidad || 1);
    const [localLoading, setLocalLoading] = useState(false);

    useEffect(() => {
        setPrice(item.precio_confirmado || item.product?.last_price || '');
        setQuantity(item.cantidad || 1);
    }, [item]);

    const handleQuantityChange = (delta) => {
        const newQty = Math.max(0.1, quantity + delta);
        setQuantity(Number(newQty.toFixed(2)));
    };

    const handleFinishPurchase = async () => {
        setLocalLoading(true);
        try {
            // Actualizamos precio y cantidad, y marcamos como comprado
            await onItemUpdate(item.id, {
                precio_confirmado: parseFloat(price) || 0,
                cantidad: quantity,
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
            <div className="item-main-info">
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
                    <div className="qty-display">
                        <input 
                            type="number" 
                            className="qty-input-manual"
                            value={quantity}
                            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                            disabled={isPurchased || localLoading}
                            step="any"
                        />
                        <span className="qty-unit">{item.unit}</span>
                    </div>
                    <button 
                        className="qty-btn" 
                        onClick={() => handleQuantityChange(1)}
                        disabled={isPurchased || localLoading}
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="price-input-group">
                    <span className="currency-symbol">$</span>
                    <input 
                        type="number" 
                        className="shopping-price-input" 
                        placeholder="Precio"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        disabled={isPurchased || localLoading}
                        step="0.01"
                    />
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
