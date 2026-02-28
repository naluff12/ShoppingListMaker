import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Package, Plus, Search, Filter, Edit2, Trash2, History, Image as ImageIcon, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import PriceHistoryModal from './PriceHistoryModal';
import ImageGalleryModal from './ImageGalleryModal';
import WebImageSearchModal from './WebImageSearchModal';
import { useWebSocket } from './useWebSocket';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function ProductManagement() {
  const [products, setProducts] = useState({ items: [], total: 0, page: 1, size: 10 });
  const [families, setFamilies] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', category: '', brand: '', last_price: '', image_url: '', family_id: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ category: '', brand: '' });
  const [imageFile, setImageFile] = useState(null);
  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState(null);
  const [showImageGalleryModal, setShowImageGalleryModal] = useState(false);
  const [selectedImageFromGallery, setSelectedImageFromGallery] = useState(null);
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);
  
  const { lastMessage } = useWebSocket(selectedFamily?.id);

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'product_update' && lastMessage.action === 'image_updated') {
      fetchProducts(selectedFamily.id, products.page, searchTerm, filters.category, filters.brand);
    }
  }, [lastMessage]);

  const fetchFamilies = async () => {
    const token = localStorage.getItem('token');
    try {
      // First figure out if the user is an admin
      const meResponse = await fetch('/api/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
      let isSuperuser = false;
      if (meResponse.ok) {
        const meData = await meResponse.json();
        isSuperuser = meData.is_admin;
        setIsAdmin(isSuperuser);
      }

      const response = await fetch(`/api/families/my`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        let f = await response.json();
        if (isSuperuser) {
          f.unshift({ id: 'all', nombre: 'Todas las Familias (Global)' });
        }
        setFamilies(f);
      }
    } catch (error) {
      console.error('Error fetching families:', error);
    }
  };

  const fetchProducts = async (familyId, page = 1, query = '', category = '', brand = '') => {
    const token = localStorage.getItem('token');
    let url = `/api/families/${familyId}/products?page=${page}&size=10`;
    
    // For admin global view
    if (familyId === 'all') {
      url = `/api/admin/products/all?page=${page}&size=10`;
    }

    const queryParams = new URLSearchParams();
    if (query) {
      if (familyId === 'all') {
         url = `/api/admin/products/all?q=${encodeURIComponent(query)}&page=${page}&size=10`;
      } else {
         url = `/api/products/search?family_id=${familyId}&q=${encodeURIComponent(query)}&page=${page}&size=10`;
      }
    } else {
      if (category) queryParams.append('category', category);
      if (brand) queryParams.append('brand', brand);
      const queryString = queryParams.toString();
      if (queryString) url += `&${queryString}`;
    }
    
    try {
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        setProducts(await response.json());
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchFilterOptions = async (familyId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/families/${familyId}/filters`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        setFilterOptions(await response.json());
      }
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const [filterOptions, setFilterOptions] = useState({ categories: [], brands: [] });

  useEffect(() => {
    fetchFamilies();
  }, []);

  useEffect(() => {
    if (families.length > 0 && !selectedFamily) {
      setSelectedFamily(families[0]);
      fetchProducts(families[0].id);
      fetchFilterOptions(families[0].id);
    }
  }, [families]);

  const handleFamilyChange = (family) => {
    setSelectedFamily(family);
    setShowFamilyDropdown(false);
    fetchProducts(family.id, 1, searchTerm);
    fetchFilterOptions(family.id);
  };

  const handleEdit = (product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      brand: product.brand || '',
      last_price: product.last_price || '',
      image_url: product.shared_image ? product.shared_image.file_path : '',
      family_id: product.family_id
    });
    setImageFile(null);
    setSelectedImageFromGallery(null);
    setShowModal(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
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
    
    let shared_image_id = currentProduct?.shared_image_id;

    // Handle image upload if there's a new file
    if (imageFile) {
      const imageData = new FormData();
      imageData.append('file', imageFile);
      try {
        const uploadRes = await fetch(`/api/images/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: imageData
        });
        if (uploadRes.ok) {
          const uploadedImage = await uploadRes.json();
          shared_image_id = uploadedImage.id;
        }
      } catch (err) {
        console.error('Error uploading image:', err);
      }
    } else if (selectedImageFromGallery) {
      shared_image_id = selectedImageFromGallery.id;
    } else if (formData.image_from_url) {
      // If an image was selected from search for a NEW product
      try {
        const imageRes = await persistImageFromUrl(null, formData.image_from_url);
        if (imageRes) shared_image_id = imageRes.id || imageRes.shared_image?.id;
      } catch (err) {
        console.error('Error persisting searched image:', err);
      }
    }

    const payload = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      brand: formData.brand,
      last_price: parseFloat(formData.last_price) || 0,
      family_id: formData.family_id,
      shared_image_id: shared_image_id
    };

    const url = currentProduct ? `/api/products/${currentProduct.id}` : `/api/products`;
    const method = currentProduct ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setShowModal(false);
        fetchProducts(selectedFamily.id, products.page, searchTerm, filters.category, filters.brand);
      }
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const persistImageFromUrl = async (productId, imageUrl) => {
    const token = localStorage.getItem('token');
    const url = productId ? `/api/products/${productId}/image-from-url` : `/api/images/from-url`;
    try {
      const res = await fetch(url, {
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
 
  const openAddProductModal = () => {
    setCurrentProduct(null);
    setFormData({ 
      name: '', 
      description: '', 
      category: '', 
      brand: '', 
      last_price: '', 
      image_url: '',
      family_id: selectedFamily.id === 'all' ? (families.find(f => f.id !== 'all')?.id || '') : selectedFamily.id
    });
    setImageFile(null);
    setSelectedImageFromGallery(null);
    setShowModal(true);
  };

  const handleShowPriceHistory = (product) => {
    setSelectedProductForHistory({ product: product, nombre: product.name });
    setShowPriceHistoryModal(true);
  };

  return (
    <div className="product-management">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Gestión de Productos</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <button 
              className="btn-premium btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={() => setShowFamilyDropdown(!showFamilyDropdown)}
            >
              {selectedFamily ? selectedFamily.nombre : 'Seleccionar Familia'} <ChevronDown size={18} />
            </button>
            {showFamilyDropdown && (
              <div 
                className="glass-panel" 
                style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  zIndex: 9999, 
                  minWidth: '220px', 
                  marginTop: '8px', 
                  padding: '8px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)'
                }}
              >
                {families.map(f => (
                  <div 
                    key={f.id} 
                    className="dropdown-item" 
                    style={{ 
                      padding: '12px 16px', 
                      cursor: 'pointer', 
                      borderRadius: '8px',
                      background: selectedFamily?.id === f.id ? 'var(--primary-glow)' : 'transparent',
                      color: '#ffffff',
                      fontWeight: selectedFamily?.id === f.id ? '600' : '400',
                      transition: 'all 0.2s ease',
                      borderBottom: 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = selectedFamily?.id === f.id ? 'var(--primary-glow)' : 'transparent'}
                    onClick={() => {
                        handleFamilyChange(f);
                        setShowFamilyDropdown(false);
                    }}
                  >
                    {f.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button 
            className="btn-premium btn-primary" 
            onClick={openAddProductModal}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={20} /> Nuevo Producto
          </button>
        </div>
      </div>

        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>
          <div style={{ minWidth: '800px' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '16px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={18} />
              <input 
                type="text" 
                className="premium-input" 
                style={{ paddingLeft: '44px', width: '100%', borderRadius: '20px' }} 
                placeholder="Buscar productos..." 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (selectedFamily) fetchProducts(selectedFamily.id, 1, e.target.value, filters.category, filters.brand);
                }}
              />
            </div>
            <div style={{ minWidth: '150px' }}>
              <select 
                className="premium-input" 
                style={{ width: '100%', borderRadius: '20px', paddingLeft: '16px' }}
                value={filters.category}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, category: e.target.value }));
                  if (selectedFamily) fetchProducts(selectedFamily.id, 1, searchTerm, e.target.value, filters.brand);
                }}
              >
                <option value="">Todas las Categorías</option>
                {filterOptions.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ minWidth: '150px' }}>
              <select 
                className="premium-input" 
                style={{ width: '100%', borderRadius: '20px', paddingLeft: '16px' }}
                value={filters.brand}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, brand: e.target.value }));
                  if (selectedFamily) fetchProducts(selectedFamily.id, 1, searchTerm, filters.category, e.target.value);
                }}
              >
                <option value="">Todas las Marcas</option>
                {filterOptions.brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="premium-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                <tr>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Producto</th>
                  {selectedFamily?.id === 'all' && (
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Familia (ID)</th>
                  )}
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Categoría</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Marca</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)' }}>Último Precio</th>
                  <th style={{ padding: '16px 24px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.items.map(product => (
                  <tr key={product.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <img 
                          src={product.shared_image ? `${API_BASE_URL}${product.shared_image.file_path}` : '/img_placeholder.png'} 
                          alt={product.name} 
                          style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                        />
                        <span style={{ fontWeight: '500', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{product.name}</span>
                      </div>
                    </td>
                    {selectedFamily?.id === 'all' && (
                       <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                         {product.family ? product.family.nombre : `Family #${product.family_id}`}
                       </td>
                    )}
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                      {product.category ? <span style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', fontSize: '0.85rem' }}>{product.category}</span> : '-'}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{product.brand || '-'}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '600', color: 'var(--primary-color)' }}>
                      ${product.last_price?.toFixed(2) || '0.00'}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          style={{ cursor: 'pointer', border: 'none', background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                          onClick={() => handleShowPriceHistory(product)} 
                          title="Historial de Precios"
                        >
                          <History size={18} color="#60a5fa" />
                        </button>
                        <button 
                          style={{ cursor: 'pointer', border: 'none', background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                          onClick={() => handleEdit(product)} 
                          title="Editar"
                        >
                          <Edit2 size={18} color="#3b82f6" />
                        </button>
                        <button 
                          style={{ cursor: 'pointer', border: 'none', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                          onClick={() => handleDelete(product.id)} 
                          title="Eliminar"
                        >
                          <Trash2 size={18} color="#ef4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
          </table>
        </div>

        {products.total > products.size && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Mostrando {products.items.length} de {products.total} productos
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-premium btn-secondary" 
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px' }}
                disabled={products.page === 1}
                onClick={() => fetchProducts(selectedFamily.id, products.page - 1, searchTerm, filters.category, filters.brand)}
              >
                <ChevronLeft size={18} /> Anterior
              </button>
              <button 
                className="btn-premium btn-secondary" 
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '20px' }}
                disabled={products.page >= Math.ceil(products.total / products.size)}
                onClick={() => fetchProducts(selectedFamily.id, products.page + 1, searchTerm, filters.category, filters.brand)}
              >
                Siguiente <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>


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
                {selectedFamily.id === 'all' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label htmlFor="family_id" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Familia</label>
                    <select 
                      id="family_id" 
                      className="premium-input" 
                      style={{ width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} 
                      value={formData.family_id || ''} 
                      onChange={handleFormChange}
                      required
                    >
                      <option value="" disabled>Seleccionar Familia</option>
                      {families.filter(f => f.id !== 'all').map(f => (
                        <option key={f.id} value={f.id}>{f.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
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
                      src={formData.image_url ? (formData.image_url.startsWith('http') || formData.image_url.startsWith('blob') || formData.image_url.startsWith('data:') ? formData.image_url : `${API_BASE_URL}${formData.image_url}`) : '/img_placeholder.png'} 
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
                        onClick={() => setShowImageSearch(true)}
                      >
                        <Search size={16} /> Buscar en línea
                      </button>
                    </div>
                  </div>
                </div>
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

      {showImageGalleryModal && ReactDOM.createPortal(
        <ImageGalleryModal
          show={showImageGalleryModal}
          handleClose={() => setShowImageGalleryModal(false)}
          handleSelectImage={handleSelectImageFromGallery}
        />,
        document.body
      )}

      <WebImageSearchModal
        show={showImageSearch}
        handleClose={() => setShowImageSearch(false)}
        productName={formData.name}
        productId={currentProduct?.id}
        onImageSelected={(updatedProduct) => {
          if (updatedProduct.isPreview) {
            setFormData(prev => ({ ...prev, image_url: updatedProduct.shared_image.file_path, image_from_url: updatedProduct.shared_image.file_path }));
          } else {
            setFormData(prev => ({ ...prev, image_url: `${API_BASE_URL}${updatedProduct.shared_image.file_path}` }));
            fetchProducts(selectedFamily.id, products.page, searchTerm, filters.category, filters.brand);
          }
        }}
      />
    </div>
  );
}

export default ProductManagement;
