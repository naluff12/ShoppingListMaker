import React from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

// Modal de presupuesto (extraído de ShoppingListView.jsx).
// Props: show, onClose, value, onChange, onSave
export default function BudgetModal({ show, onClose, value, onChange, onSave }) {
    if (!show) return null;
    return ReactDOM.createPortal(
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">Establecer Presupuesto</h5>
                    <button className="modal-close" onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Monto del Presupuesto</label>
                    <div style={{ display: 'flex', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--text-secondary)' }}>$</div>
                        <input
                            type="number"
                            className="premium-input"
                            style={{ paddingLeft: '32px' }}
                            placeholder="Ej: 500.00"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn-premium btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn-premium btn-primary" onClick={onSave}>Guardar Presupuesto</button>
                </div>
            </div>
        </div>,
        document.body
    );
}
