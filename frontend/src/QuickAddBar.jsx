import React, { useState, useRef, useEffect } from 'react';
import { Plus, History, Globe, Search } from 'lucide-react';
import { API_BASE_URL } from './config';
import './QuickAddBar.css';

function getImageSrc(filePath) {
  if (!filePath) return null;
  if (filePath.startsWith('http') || filePath.startsWith('blob') || filePath.startsWith('data:')) return filePath;
  if (filePath.startsWith('/api')) return `${API_BASE_URL}${filePath}`;
  return `${API_BASE_URL}/api${filePath}`;
}

function QuickAddBar({
  value, onChange, onSubmit, onKeyDown,
  highlightedIndex, products, onSelectProduct, onHighlight,
  onOpenPrevious, onOpenStoreUrl, quickAddItemName, onQuickAddChange, onQuickAddSubmit,
  isShoppingMode, quickAddInputRef,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const localRef = useRef(null);
  const inputRef = quickAddInputRef || localRef;

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inputRef]);

  const selectProduct = (p) => {
    onSelectProduct(p);
    setShowDropdown(false);
  };

  const handleSubmit = (e) => {
    onSubmit(e);
    setShowDropdown(false);
  };

  if (!isShoppingMode) {
    return (
      <div className="quick-add-bar">
        <form onSubmit={handleSubmit} className="quick-add-form" style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              type="text"
              className="premium-input"
              placeholder="Buscar o agregar producto..."
              value={value}
              onChange={(e) => { onChange(e); setShowDropdown(true); }}
              onKeyDown={onKeyDown}
              onFocus={() => setShowDropdown(true)}
              style={{ paddingLeft: '40px' }}
            />
            {showDropdown && products.length > 0 && (
              <div className="quick-add-dropdown">
                {products.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`quick-add-option ${idx === highlightedIndex ? 'highlighted' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); selectProduct(p); }}
                    onMouseEnter={() => onHighlight && onHighlight(idx)}
                  >
                    {p.shared_image?.file_path && (
                      <img
                        src={getImageSrc(p.shared_image.file_path)}
                        alt={p.name}
                        style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: 'rgba(255,255,255,0.06)' }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      {p.brand && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand}</span>}
                    </div>
                    {p.last_price && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flexShrink: 0 }}>${p.last_price.toFixed(2)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="submit" className="btn-premium btn-primary quick-add-btn" title="Agregar">
            <Plus size={18} /> <span className="quick-add-label">Agregar</span>
          </button>
          <button type="button" className="btn-premium btn-secondary quick-add-icon-btn" onClick={onOpenPrevious} title="Historial">
            <History size={18} />
          </button>
          <button type="button" className="btn-premium btn-secondary quick-add-icon-btn" onClick={onOpenStoreUrl} title="Agregar desde tienda">
            <Globe size={18} />
          </button>
        </form>
      </div>
    );
  }

  // Modo compra: quick-add minimalista + accesos rápidos
  return (
    <div className="quick-add-bar">
      <form onSubmit={onQuickAddSubmit} className="quick-add-form" style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          className="premium-input"
          placeholder="Producto rápido..."
          value={quickAddItemName}
          onChange={(e) => onQuickAddChange(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="submit" className="btn-premium btn-primary quick-add-btn" title="Agregar">
          <Plus size={18} /> <span className="quick-add-label">Agregar</span>
        </button>
        <button type="button" className="btn-premium btn-secondary quick-add-icon-btn" onClick={onOpenPrevious} title="Productos recurrentes">
          <History size={18} />
        </button>
        <button type="button" className="btn-premium btn-secondary quick-add-icon-btn" onClick={onOpenStoreUrl} title="Agregar desde tienda">
          <Globe size={18} />
        </button>
      </form>
    </div>
  );
}

export default QuickAddBar;
