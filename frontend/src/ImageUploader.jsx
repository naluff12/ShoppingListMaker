import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import './ImageUploader.css';

const ImageUploader = ({ itemId, imageUrl, onImageUpload }) => {
    const fileInputRef = useRef(null);

    const handleImageClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            onImageUpload(itemId, file);
        }
    };

    return (
        <div className="image-uploader" onClick={handleImageClick} style={{ cursor: 'pointer', width: '100%', height: '100%', minHeight: '60px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }}>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept="image/jpeg,image/png"
            />
            {imageUrl ? (
                <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                    <Upload size={20} />
                    <span style={{ fontSize: '0.75rem' }}>Subir foto</span>
                </div>
            )}
        </div>
    );
};

export default ImageUploader;
