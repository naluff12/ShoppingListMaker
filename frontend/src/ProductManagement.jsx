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
  
  const { lastMessage } = useWebSocket(selectedFamily?.id);

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'product_update' && lastMessage.action === 'image_updated') {
      fetchProducts(selectedFamily.id, products.page, searchTerm, filters.category, filters.brand);
    }
  }, [lastMessage]);

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
      image_url: product.shared_image ? product.shared_image.file_path : ''
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
        const imageRes = await persistImageFromUrl(formData.image_from_url);
        if (imageRes) shared_image_id = imageRes.shared_image.id;
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
      family_id: selectedFamily.id,
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
              {selectedFamily ? selectedFamily.name : 'Seleccionar Familia'} <ChevronDown size={18} />
            </button>
            {showFamilyDropdown && (
              <div 
                className="glass-panel" 
                style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  zIndex: 1000, 
                  minWidth: '200px', 
                  marginTop: '8px', 
                  padding: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }}
              >
                {families.map(f => (
                  <div 
                    key={f.id} 
                    className="dropdown-item" 
                    style={{ 
                      padding: '10px 16px', 
                      cursor: 'pointer', 
                      borderRadius: '4px',
                      background: selectedFamily?.id === f.id ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
                    }}
                    onClick={() => handleFamilyChange(f)}
                  >
                    {f.name}
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

      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={18} />
            <input 
              type="text" 
              className="premium-input" 
              style={{ paddingLeft: '40px', width: '100%' }} 
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
              style={{ width: '100%' }}
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
              style={{ width: '100%' }}
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
          <table className="premium-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Marca</th>
                <th>Último Precio</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.items.map(product => (
                <tr key={product.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img 
                        src={product.shared_image ? `${API_BASE_URL}${product.shared_image.file_path}` : '/img_placeholder.png'} 
                        alt={product.name} 
                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                      <span>{product.name}</span>
                    </div>
                  </td>
                  <td>{product.category || '-'}</td>
                  <td>{product.brand || '-'}</td>
                  <td>${product.last_price?.toFixed(2) || '0.00'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn-icon" onClick={() => handleShowPriceHistory(product)} title="Historial de Precios"><History size={18} /></button>
                      <button className="btn-icon" onClick={() => handleEdit(product)} title="Editar"><Edit2 size={18} /></button>
                      <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(product.id)} title="Eliminar"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {products.total > products.size && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Mostrando {products.items.length} de {products.total} productos
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-premium btn-secondary" 
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
                disabled={products.page === 1}
                onClick={() => fetchProducts(selectedFamily.id, products.page - 1, searchTerm, filters.category, filters.brand)}
              >
                <ChevronLeft size={18} /> Anterior
              </button>
              <button 
                className="btn-premium btn-secondary" 
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
                disabled={products.page >= Math.ceil(products.total / products.size)}
                onClick={() => fetchProducts(selectedFamily.id, products.page + 1, searchTerm, filters.category, filters.brand)}
              >
                Siguiente <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
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
