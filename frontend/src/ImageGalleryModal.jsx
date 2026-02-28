import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { X, Loader } from 'lucide-react';
import { API_BASE_URL } from './config';
import './ImageGalleryModal.css';

const ImageGalleryModal = ({ show, handleClose, handleSelectImage }) => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (show) {
            fetchImages();
        }
    }, [show]);

    const fetchImages = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/images/gallery`);
            setImages(response.data);
        } catch (err) {
            setError('Error al cargar las imágenes de la galería.');
            console.error('Error fetching images:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleImageClick = (image) => {
        if (handleSelectImage) {
            handleSelectImage(image);
        }
        handleClose();
    };

    if (!show) return null;

    return ReactDOM.createPortal(
        <div className="modal-backdrop" onClick={handleClose}>
            <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">Seleccionar Imagen de la Galería</h5>
                    <button className="modal-close" onClick={handleClose}>
                        <X size={24} />
                    </button>
                </div>
                <div className="modal-body" style={{ overflowY: 'auto' }}>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <Loader className="spinner" size={40} style={{ color: 'var(--primary-color)' }} />
                            <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Cargando imágenes...</p>
                        </div>
                    )}
                    {error && (
                        <div className="alert-info" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', border: '1px solid rgba(239,68,68,0.3)' }}>
                            {error}
                        </div>
                    )}
                    {!loading && !error && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
                            {images.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                                    No hay imágenes en la galería.
                                </div>
                            ) : (
                                images.map((img) => (
                                    <div
                                        key={img.id}
                                        className="gallery-image-wrapper"
                                        onClick={() => handleImageClick(img)}
                                        style={{ aspectRatio: '1/1', overflow: 'hidden', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)' }}
                                    >
                                        <img 
                                            src={`${API_BASE_URL}${img.file_path}`} 
                                            alt="Gallery item"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                            className="gallery-image-hover"
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ImageGalleryModal;