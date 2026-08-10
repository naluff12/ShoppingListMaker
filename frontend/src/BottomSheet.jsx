import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import './BottomSheet.css';

// Bottom sheet genérico estilo móvil: overlay oscuro + panel que sube desde abajo.
// Props: show, onClose, title, children
function BottomSheet({ show, onClose, title, children }) {
  useEffect(() => {
    if (!show) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-header">
          <h3 className="bottom-sheet-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="bottom-sheet-body">
          {children}
        </div>
      </div>
    </div>
  );
}

export default BottomSheet;
