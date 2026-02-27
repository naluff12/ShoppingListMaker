import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Loader } from 'lucide-react';

const PriceHistoryModal = ({ show, handleClose, item }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show && item) {
            setLoading(true);
            const token = localStorage.getItem('token');
            fetch(`/api/products/${item.product?.id}/prices`, {
                headers: { 'Authorization': 'Bearer ' + token }
            })
            .then(res => res.json())
            .then(data => {
                setHistory(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching price history:", err);
                alert("No se pudo cargar el historial de precios.");
                setLoading(false);
            });
        }
    }, [show, item]);

    if (!show) return null;

    return ReactDOM.createPortal(
        <div className="modal-backdrop" onClick={handleClose}>
            <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">Historial de Precios de {item?.nombre}</h5>
                    <button className="modal-close" onClick={handleClose}>
                        <X size={24} />
                    </button>
                </div>
                <div className="modal-body">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <Loader className="spinner" size={40} style={{ color: 'var(--primary-color)' }} />
                            <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Cargando historial...</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                        <th style={{ padding: '12px', fontWeight: 600 }}>Fecha</th>
                                        <th style={{ padding: '12px', fontWeight: 600 }}>Precio</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.length > 0 ? (
                                        history.map((record, index) => (
                                            <tr key={record.id || index} style={{ borderBottom: '1px solid var(--border-color)', background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                                <td style={{ padding: '12px' }}>{new Date(record.created_at).toLocaleString()}</td>
                                                <td style={{ padding: '12px', fontWeight: 500, color: 'var(--success-color)' }}>${parseFloat(record.price).toFixed(2)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="2" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                No hay historial de precios para este producto.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn-premium btn-secondary" onClick={handleClose}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PriceHistoryModal;
