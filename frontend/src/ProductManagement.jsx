import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Package, Plus, Search, Filter, Edit2, Trash2, History, Image as ImageIcon, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import PriceHistoryModal from './PriceHistoryModal';
import ImageGalleryModal from './ImageGalleryModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function ProductManagement() {
  const [products, setProducts] = useState({ items: [], total: 0, page: 1, size: 10 });
  const [families, setFamilies] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', category: '', brand: '', last_price: '', image_url: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ category: '', brand: '' });
  const [imageFile, setImageFile] = useState(null);
  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState(null);
  const [showImageGalleryModal, setShowImageGalleryModal] = useState(false);
  const [selectedImageFromGallery, setSelectedImageFromGallery] = useState(null);
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [imageSearchResults, setImageSearchResults] = useState([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);

  const fetchFamilies = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/admin/families`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        setFamilies(await response.json());
      }
    } catch (error) {
      console.error('Error fetching families:', error);
    }
  };

  const fetchProducts = async (familyId, page = 1, query = '', category = '', brand = '') => {
    const token = localStorage.getItem('token');
    let url = `/api/families/${familyId}/products?page=${page}&size=10`;
    const queryParams = new URLSearchParams();
    if (query) {
      url = `/api/products/search?family_id=${familyId}&q=${encodeURIComponent(query)}&page=${page}&size=10`;
    } else {
      if (category) queryParams.append('category', category);
      if (brand) queryParams.append('brand', brand);
    }

    if (queryParams.toString()) {
      url += `&${queryParams.toString()}`;
    }

    try {
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        setProducts(await response.json());
      } else {
        setProducts({ items: [], total: 0, page: 1, size: 10 });
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  useEffect(() => {
    fetchFamilies();
  }, []);

  useEffect(() => {
    if (selectedFamily) {
      const handler = setTimeout(() => {
        fetchProducts(selectedFamily.id, 1, searchTerm, filters.category, filters.brand);
      }, 300);
      return () => clearTimeout(handler);
    } else {
      setProducts({ items: [], total: 0, page: 1, size: 10 });
    }
  }, [selectedFamily, searchTerm, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      brand: product.brand || '',
      last_price: product.last_price || '',
      image_url: product.shared_image ? `${API_BASE_URL}${product.shared_image.file_path}` : ''
    });
    setImageFile(null);
    setSelectedImageFromGallery(product.shared_image ? { id: product.shared_image.id, file_path: product.shared_image.file_path } : null);
    setShowModal(true);
  };

  const handleDelete = async (productId) => {
    const token = localStorage.getItem('token');
    if (!selectedFamily) return;

    try {
      const response = await fetch(`/api/families/${selectedFamily.id}/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        fetchProducts(selectedFamily.id, products.page, searchTerm, filters.category, filters.brand);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!selectedFamily) return;

    const method = currentProduct ? 'PUT' : 'POST';
    const url = currentProduct
      ? `/api/families/${selectedFamily.id}/products/${currentProduct.id}`
      : `/api/families/${selectedFamily.id}/products`;

    const payload = { ...formData };
    if (payload.last_price) {
      payload.last_price = parseFloat(payload.last_price);
    } else {
      delete payload.last_price;
    }

    if (selectedImageFromGallery) {
      payload.shared_image_id = selectedImageFromGallery.id;
      delete payload.image_url;
    } else if (currentProduct && currentProduct.shared_image_id && !imageFile) {
      payload.shared_image_id = currentProduct.shared_image_id;
      delete payload.image_url;
    } else if (!imageFile) {
      payload.shared_image_id = null;
      delete payload.image_url;
    }

    if (imageFile) {
      delete payload.shared_image_id;
      delete payload.image_url;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const product = await response.json();
        if (imageFile) {
          await handleImageUpload(product.id, imageFile);
        } else if (formData.image_from_url) {
          await saveImageFromUrl(product.id, formData.image_from_url);
        }
        setShowModal(false);
        fetchProducts(selectedFamily.id, currentProduct ? products.page : 1, searchTerm, filters.category, filters.brand);
      } else {
        const errorData = await response.json();
        alert('Failed to save product: ' + errorData.detail);
      }
    } catch (error) {
      alert('Error saving product.');
    }
  };

  const handleImageUpload = async (productId, file) => {
    if (!file) return;
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/products/${productId}/upload-image`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData,
      });
      if (!res.ok) throw new Error('Error al subir la imagen');
      const updatedProduct = await res.json();
      setFormData(prev => ({ ...prev, image_url: updatedProduct.shared_image ? `${API_BASE_URL}${updatedProduct.shared_image.file_path}` : '' }));
    } catch (err) {
      alert(err.message);
    }
  };
 
  const saveImageFromUrl = async (productId, imageUrl) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/products/${productId}/image-from-url`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token 
        },
        body: JSON.stringify({ image_url: imageUrl }),
      });
      if (!res.ok) throw new Error('Error al guardar la imagen desde URL');
      return await res.json();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectImageFromGallery = (image) => {
    setSelectedImageFromGallery(image);
    setFormData(prev => ({ ...prev, image_url: `${API_BASE_URL}${image.file_path}` }));
    setShowImageGalleryModal(false);
  };
 
  const handleImageSearch = async (e) => {
    if (e) e.preventDefault();
    if (!imageSearchQuery.trim()) return;
    
    setIsSearchingImages(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/images/search?q=${encodeURIComponent(imageSearchQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setImageSearchResults(await response.json());
      }
    } catch (error) {
      console.error('Error searching images:', error);
    } finally {
      setIsSearchingImages(false);
    }
  };

  const handleSelectImageFromSearch = async (imageUrl) => {
    if (!currentProduct) {
      // If adding a new product, we just set the URL as a preview for now
      // and we'll handle the persistence after the product is created.
      // Actually, it's better to persist it once the product exists.
      // For new products, we can store it in formData.image_from_url 
      // and process it in handleSave.
      setFormData(prev => ({ ...prev, image_url: imageUrl, image_from_url: imageUrl }));
      setShowImageSearch(false);
      return;
    }

    setIsSearchingImages(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/products/${currentProduct.id}/image-from-url`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ image_url: imageUrl })
      });
      if (response.ok) {
        const updatedProduct = await response.json();
        setFormData(prev => ({ ...prev, image_url: `${API_BASE_URL}${updatedProduct.shared_image.file_path}` }));
        fetchProducts(selectedFamily.id, products.page, searchTerm, filters.category, filters.brand);
        setShowImageSearch(false);
      }
    } catch (error) {
      console.error('Error selecting image from search:', error);
    } finally {
      setIsSearchingImages(false);
    }
  };

  const openAddProductModal = () => {
    setCurrentProduct(null);
    setFormData({ name: '', description: '', category: '', brand: '', last_price: '', image_url: '' });
    setImageFile(null);
    setSelectedImageFromGallery(null);
    setShowModal(true);
  };

  const handleShowPriceHistory = (product) => {
    setSelectedProductForHistory({ product: product, nombre: product.name });
    setShowPriceHistoryModal(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Gestión de Productos</h2>
      </div>

      <div style={{ position: 'relative', marginBottom: '24px', zIndex: 100 }}>
        <div 
            className="premium-input" 
            style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--panel-bg)' }}
            onClick={() => setShowFamilyDropdown(!showFamilyDropdown)}
        >
            <span>{selectedFamily ? selectedFamily.nombre : "Seleccionar Familia..."}</span>
            <ChevronDown size={20} style={{ transition: 'transform 0.3s', transform: showFamilyDropdown ? 'rotate(180deg)' : 'rotate(0)' }} />
        </div>
        
        {showFamilyDropdown && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 9999, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', maxHeight: '300px', overflowY: 'auto' }}>
                {families.map(family => (
                    <div 
                        key={family.id} 
                        className="dropdown-item" 
                        onClick={() => { setSelectedFamily(family); setShowFamilyDropdown(false); }}
                    >
                        {family.nombre}
                    </div>
                ))}
            </div>
        )}
      </div>

      {selectedFamily && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <button className="btn-premium btn-primary" onClick={openAddProductModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} /> Agregar Producto
            </button>
            
            <div style={{ position: 'relative', flex: '1 1 250px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                    type="text" 
                    className="premium-input" 
                    placeholder="Buscar productos..." 
                    style={{ width: '100%', paddingLeft: '40px' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <Filter size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                    type="text" 
                    className="premium-input" 
                    placeholder="Categoría" 
                    name="category"
                    style={{ width: '100%', paddingLeft: '40px' }}
                    value={filters.category}
                    onChange={handleFilterChange}
                />
            </div>
            
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <Filter size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                    type="text" 
                    className="premium-input" 
                    placeholder="Marca" 
                    name="brand"
                    style={{ width: '100%', paddingLeft: '40px' }}
                    value={filters.brand}
                    onChange={handleFilterChange}
                />
            </div>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Imagen</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nombre</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Descripción</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Categoría</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Marca</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Precio M. Reciente</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {(products.items || []).map((product, index) => (
                        <tr key={product.id} style={{ borderBottom: '1px solid var(--border-color)', background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                            <td style={{ padding: '12px 16px' }}>
                                <img
                                    src={product.shared_image ? `${API_BASE_URL}${product.shared_image.file_path}` : `/img_placeholder.png`}
                                    alt={product.name}
                                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                                />
                            </td>
                            <td style={{ padding: '12px 16px' }}>{product.name}</td>
                            <td style={{ padding: '12px 16px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.description}</td>
                            <td style={{ padding: '12px 16px' }}>{product.category || '-'}</td>
                            <td style={{ padding: '12px 16px' }}>{product.brand || '-'}</td>
                            <td style={{ padding: '12px 16px' }}>{product.last_price ? `$${product.last_price.toFixed(2)}` : 'N/A'}</td>
                            <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn-premium" style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning-color)', padding: '6px' }} onClick={() => handleEdit(product)} title="Editar">
                                        <Edit2 size={16} />
                                    </button>
                                    <button className="btn-premium" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info-color)', padding: '6px' }} onClick={() => handleShowPriceHistory(product)} title="Historial">
                                        <History size={16} />
                                    </button>
                                    <button className="btn-premium" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '6px' }} onClick={() => handleDelete(product.id)} title="Eliminar">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {(!products.items || products.items.length === 0) && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No se encontraron productos.</div>}
          </div>

          {(products.total > 0 && products.items.length > 0) && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                <button 
                    className="btn-premium btn-secondary" 
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    disabled={products.page <= 1}
                    onClick={() => fetchProducts(selectedFamily.id, products.page - 1, searchTerm, filters.category, filters.brand)}
                >
                    <ChevronLeft size={18} /> Anterior
                </button>
                <span style={{ color: 'var(--text-secondary)' }}>
                    Página {products.page} de {Math.ceil(products.total / products.size)}
                </span>
                <button 
                    className="btn-premium btn-secondary" 
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    disabled={products.page >= Math.ceil(products.total / products.size)}
                    onClick={() => fetchProducts(selectedFamily.id, products.page + 1, searchTerm, filters.category, filters.brand)}
                >
                    Siguiente <ChevronRight size={18} />
                </button>
              </div>
          )}
        </div>
      )}

      {showModal && ReactDOM.createPortal(
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
            <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">{currentProduct ? 'Editar Producto' : 'Agregar Producto'}</h5>
                    <button className="modal-close" onClick={() => setShowModal(false)}><X size={24} /></button>
                </div>
                <form onSubmit={handleSave}>
                    <div className="modal-body">
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="name" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nombre</label>
                            <input type="text" id="name" className="premium-input" style={{ width: '100%' }} value={formData.name} onChange={handleFormChange} required />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="description" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Descripción</label>
                            <textarea id="description" className="premium-input" style={{ width: '100%', minHeight: '80px' }} value={formData.description} onChange={handleFormChange} />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <label htmlFor="category" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Categoría</label>
                                <input type="text" id="category" className="premium-input" style={{ width: '100%' }} value={formData.category} onChange={handleFormChange} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label htmlFor="brand" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Marca</label>
                                <input type="text" id="brand" className="premium-input" style={{ width: '100%' }} value={formData.brand} onChange={handleFormChange} />
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="last_price" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Precio</label>
                            <input type="number" id="last_price" step="0.01" className="premium-input" style={{ width: '100%' }} value={formData.last_price} onChange={handleFormChange} />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Imagen</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <img 
                                    src={formData.image_url ? (formData.image_url.startsWith('http') || formData.image_url.startsWith('blob') ? formData.image_url : `${API_BASE_URL}${formData.image_url}`) : '/img_placeholder.png'} 
                                    alt="Product" 
                                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px' }} 
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button 
                                        type="button" 
                                        className="btn-premium btn-secondary" 
                                        style={{ padding: '6px 16px', fontSize: '0.9rem' }}
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/jpeg,image/png';
                                            input.onchange = (e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    setImageFile(file);
                                                    setSelectedImageFromGallery(null);
                                                    setFormData(prev => ({ ...prev, image_url: URL.createObjectURL(file) }));
                                                }
                                            };
                                            input.click();
                                        }}
                                    >
                                        Subir nueva imagen
                                    </button>
                                    <button 
                                        type="button" 
                                        className="btn-premium" 
                                        style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info-color)', padding: '6px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
                                        onClick={() => setShowImageGalleryModal(true)}
                                    >
                                        <ImageIcon size={16} /> De la galería
                                    </button>
                                    <button 
                                        type="button" 
                                        className="btn-premium" 
                                        style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary-color)', padding: '6px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
                                        onClick={() => {
                                            setShowImageSearch(true);
                                            setImageSearchQuery(formData.name || '');
                                            if (formData.name) handleImageSearch();
                                        }}
                                    >
                                        <Search size={16} /> Buscar en línea
                                    </button>
                                </div>
                            </div>
                        </div>

                        {showImageSearch && (
                            <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px', border: '1px solid var(--primary-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h6 style={{ margin: 0, fontWeight: 600 }}>Buscador de Imágenes</h6>
                                    <button type="button" onClick={() => setShowImageSearch(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16} /></button>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    <input 
                                        type="text" 
                                        className="premium-input" 
                                        style={{ flex: 1, height: '36px', fontSize: '0.9rem' }} 
                                        placeholder="Buscar..." 
                                        value={imageSearchQuery}
                                        onChange={e => setImageSearchQuery(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && handleImageSearch(e)}
                                    />
                                    <button type="button" className="btn-premium btn-primary" style={{ padding: '0 12px' }} onClick={handleImageSearch} disabled={isSearchingImages}>
                                        {isSearchingImages ? '...' : <Search size={16} />}
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {imageSearchResults.map(img => (
                                        <div 
                                            key={img.id} 
                                            style={{ cursor: 'pointer', borderRadius: '4px', overflow: 'hidden', border: '2px solid transparent', transition: 'border-color 0.2s', position: 'relative' }}
                                            onClick={() => handleSelectImageFromSearch(img.largeImageURL)}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                                        >
                                            <img src={img.previewURL} alt="Result" style={{ width: '100%', height: '60px', objectFit: 'cover' }} />
                                        </div>
                                    ))}
                                    {imageSearchResults.length === 0 && !isSearchingImages && (
                                        <div style={{ gridColumn: 'span 4', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '12px' }}>
                                            Ingresa un término para buscar imágenes.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-premium btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                        <button type="submit" className="btn-premium btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
      )}

      {selectedProductForHistory && (
        <PriceHistoryModal
          show={showPriceHistoryModal}
          handleClose={() => setShowPriceHistoryModal(false)}
          item={selectedProductForHistory}
        />
      )}

      <ImageGalleryModal
        show={showImageGalleryModal}
        handleClose={() => setShowImageGalleryModal(false)}
        handleSelectImage={handleSelectImageFromGallery}
      />
    </div>
  );
}

export default ProductManagement;