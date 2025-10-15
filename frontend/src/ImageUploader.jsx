import React, { useRef } from 'react';
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
        <div className="image-uploader" onClick={handleImageClick}>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept="image/jpeg,image/png"
            />
            {imageUrl ? (
                <img src={`data:image/webp;base64,${imageUrl}`} alt="" className="item-image" />
            ) : (
                <div className="image-placeholder">Subir foto</div>
            )}
        </div>
    );
};

export default ImageUploader;
