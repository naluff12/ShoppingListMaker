import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Search, X, Loader } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const WebImageSearchModal = ({ show, handleClose, productName, productId, onImageSelected }) => {
    const [query, setQuery] = useState(productName || '');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingStage, setLoadingStage] = useState(''); // '', 'searching', 'downloading', 'saving'
    const [error, setError] = useState(null);
    const abortControllerRef = React.useRef(null);

    useEffect(() => {
        if (show && productName) {
            setQuery(productName);
            setError(null);
            handleSearch(productName);
        } else if (!show) {
            setResults([]);
            setError(null);
        }
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [show, productName]);

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setLoading(false);
            setError('Proceso cancelado por el usuario.');
        }
    };

    const handleSearch = async (searchQuery = query) => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setLoadingStage('searching');
        setError(null);
        const token = localStorage.getItem('token');
        
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
            const response = await fetch(`/api/images/search?q=${encodeURIComponent(searchQuery)}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                setResults(await response.json());
            } else {
                setError('Error al buscar imágenes. Intenta de nuevo.');
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                if (loading) setError('La búsqueda tardó demasiado o fue cancelada.');
            } else {
                console.error('Error searching images:', err);
                setError('Error de conexión al buscar imágenes.');
            }
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleSelectImage = async (imageUrl) => {
        if (!productId) {
            // Preview mode for new products
            onImageSelected({ shared_image: { file_path: imageUrl }, isPreview: true });
            handleClose();
            return;
        }

        setLoading(true);
        setLoadingStage('downloading');
        setError(null);
        const token = localStorage.getItem('token');
        
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), 65000);

        try {
            const response = await fetch(`/api/products/${productId}/image-from-url`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ image_url: imageUrl }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                const updatedProduct = await response.json();
                onImageSelected(updatedProduct);
                handleClose();
            } else {
                const errData = await response.json().catch(() => ({}));
                setError(errData.detail || 'No se pudo procesar la imagen seleccionada.');
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                if (loading) setError('La descarga de la imagen tardó demasiado o fue cancelada.');
            } else {
                console.error('Error selecting image:', err);
                setError('Error de conexión al procesar la imagen.');
            }
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    };

    if (!show) return null;

    return ReactDOM.createPortal(
        <div className="modal-backdrop" onClick={handleClose}>
            <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">Buscar Imagen para "{productName}"</h5>
                    <button className="modal-close" onClick={handleClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                        <input 
                            type="text" 
                            className="premium-input" 
                            style={{ flex: 1 }} 
                            placeholder="Buscar imagen..." 
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleSearch()}
                        />
                        <button className="btn-premium btn-primary" onClick={() => handleSearch()} disabled={loading}>
                            <Search size={20} />
                        </button>
                    </div>

                    {error && (
                        <div className="glass-panel" style={{ padding: '12px', marginBottom: '20px', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', textAlign: 'center', fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    )}

                    {loading && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '16px' }}>
                            <div className="animate-spin" style={{ color: 'var(--primary-color)' }}>
                                <Loader size={48} />
                            </div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '1.1rem' }}>
                                {loadingStage === 'searching' && 'Buscando imágenes...'}
                                {loadingStage === 'downloading' && 'Procesando y guardando imagen...'}
                                {!loadingStage && 'Cargando...'}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                {loadingStage === 'downloading' && 'Esto puede tardar unos segundos dependiendo del servidor externo.'}
                            </div>
                            <button className="btn-premium btn-secondary" onClick={handleCancel} style={{ marginTop: '8px', padding: '8px 20px', fontSize: '0.9rem' }}>
                                Cancelar
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {!loading && results.map(img => (
                            <div 
                                key={img.id} 
                                className="glass-panel" 
                                style={{ padding: '4px', cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.2s' }}
                                onClick={() => handleSelectImage(img.largeImageURL)}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                            >
                                <img src={img.previewURL} alt="Resultado" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }} />
                            </div>
                        ))}
                    </div>

                    {!loading && results.length === 0 && query && (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                            No se encontraron imágenes. Intenta con otro término.
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn-premium btn-secondary" onClick={handleClose}>Cerrar</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default WebImageSearchModal;
