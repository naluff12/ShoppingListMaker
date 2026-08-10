import React from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

// Modal de "Producto Nuevo" (extraído de ShoppingListView.jsx).
// Se muestra cuando el item que se agrega no existe en el catálogo familiar.
// Props: show, onClose, productName, brand, onBrandChange, category,
//        onCategoryChange, onAddWithoutDetails, onAddWithDetails
export default function NewProductModal({
    show, onClose, productName,
    brand, onBrandChange, category, onCategoryChange,
    onAddWithoutDetails, onAddWithDetails,
}) {
    if (!show) return null;
    return ReactDOM.createPortal(
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">Producto Nuevo</h5>
                    <button className="modal-close" onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <div className="alert-info" style={{ marginBottom: '24px' }}>
                        '{productName}' parece ser un producto nuevo. Si lo deseas, puedes agregar una marca y categoría para ayudar a organizarlo.
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Marca</label>
                        <input type="text" className="premium-input" value={brand} onChange={(e) => onBrandChange(e.target.value)} placeholder="Ej. Nestlé, Coca-Cola..." />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Categoría</label>
                        <input type="text" className="premium-input" value={category} onChange={(e) => onCategoryChange(e.target.value)} placeholder="Ej. Lácteos, Bebidas..." />
                    </div>
                </div>
                <div className="modal-footer" style={{ gap: '16px' }}>
                    <button className="btn-premium btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={onAddWithoutDetails}>
                        Agregar sin detalles
                    </button>
                    <button className="btn-premium btn-primary" style={{ flex: 1, padding: '10px' }} onClick={onAddWithDetails}>
                        Guardar y Agregar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
