import React, { useState, useEffect } from 'react';
import { Button, Table, Modal, Form, InputGroup, FormControl, DropdownButton, Dropdown } from 'react-bootstrap';

const API_URL = 'http://localhost:8000';

function ProductManagement() {
  const [products, setProducts] = useState({ items: [], total: 0, page: 1, size: 10 });
  const [families, setFamilies] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [imageFile, setImageFile] = useState(null);

  const fetchFamilies = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/admin/families`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setFamilies(data);
      } else {
        console.error('Failed to fetch families');
      }
    } catch (error) {
      console.error('Error fetching families:', error);
    }
  };

  const fetchProducts = async (familyId, page = 1) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/families/${familyId}/products?page=${page}&size=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      } else {
        console.error('Failed to fetch products');
        setProducts({ items: [], total: 0, page: 1, size: 10 }); // Clear products on failure
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
      fetchProducts(selectedFamily.id, 1);
    } else {
      setProducts({ items: [], total: 0, page: 1, size: 10 });
    }
  }, [selectedFamily]);

  const handleEdit = (product) => {
    setCurrentProduct(product);
    setFormData({ name: product.name, description: product.description || '' });
    setImageFile(null);
    setShowModal(true);
  };

  const handleDelete = async (productId) => {
    const token = localStorage.getItem('token');
    if (!selectedFamily) return;

    try {
      const response = await fetch(`/api/families/${selectedFamily.id}/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        fetchProducts(selectedFamily.id, products.page); // Refresh the list
      } else {
        console.error('Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    if (!selectedFamily) return;

    const method = currentProduct ? 'PUT' : 'POST';
    const url = currentProduct
      ? `/api/families/${selectedFamily.id}/products/${currentProduct.id}`
      : `/api/families/${selectedFamily.id}/products`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const product = await response.json();
        if (imageFile) {
          await handleImageUpload(product.id, imageFile);
        }
        setShowModal(false);
        fetchProducts(selectedFamily.id, currentProduct ? products.page : 1); // Refresh the list
      } else {
        const errorData = await response.json();
        console.error('Failed to save product:', errorData.detail);
        alert('Failed to save product: ' + errorData.detail);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product.');
    }
  };

  const handleImageUpload = async (productId, file) => {
    if (!file) return;

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/products/${productId}/upload-image`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData,
      });
      if (!res.ok) throw new Error('Error al subir la imagen');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const openAddProductModal = () => {
    setCurrentProduct(null);
    setFormData({ name: '', description: '' });
    setImageFile(null);
    setShowModal(true);
  };

  const filteredProducts = (products.items || []).filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <h2>Product Management</h2>

      <DropdownButton
        id="dropdown-basic-button"
        title={selectedFamily ? selectedFamily.nombre : "Select a Family"}
        onSelect={(eventKey) => {
          const family = families.find(f => f.id.toString() === eventKey);
          setSelectedFamily(family);
        }}
        className="mb-3"
      >
        {families.map(family => (
          <Dropdown.Item key={family.id} eventKey={family.id}>{family.nombre}</Dropdown.Item>
        ))}
      </DropdownButton>

      {selectedFamily && (
        <>
          <Button variant="primary" onClick={openAddProductModal}>Add Product</Button>
          <InputGroup className="mt-3 mb-3">
            <FormControl
              placeholder="Search for products..."
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id}>
                  <td>
                    {product.image_url && (
                      <img
                        src={`data:image/webp;base64,${product.image_url}`}
                        alt={product.name}
                        style={{ width: 50, height: 50, objectFit: 'cover' }}
                      />
                    )}
                  </td>
                  <td>{product.name}</td>
                  <td>{product.description}</td>
                  <td>
                    <Button variant="warning" onClick={() => handleEdit(product)}>Edit</Button>{' '}
                    <Button variant="danger" onClick={() => handleDelete(product.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="d-flex justify-content-center align-items-center mt-3">
            <Button
                variant="outline-secondary"
                size="sm"
                disabled={!products.items.length || products.page <= 1}
                onClick={() => fetchProducts(selectedFamily.id, products.page - 1)}
            >
                Anterior
            </Button>
            <span className="mx-2">
                Página {products.page} de {products.total ? Math.ceil(products.total / products.size) : 1}
            </span>
            <Button
                variant="outline-secondary"
                size="sm"
                disabled={!products.items.length || products.page >= Math.ceil(products.total / products.size)}
                onClick={() => fetchProducts(selectedFamily.id, products.page + 1)}
            >
                Siguiente
            </Button>
        </div>
        </>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{currentProduct ? 'Edit Product' : 'Add Product'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="name">
              <Form.Label>Name</Form.Label>
              <Form.Control type="text" value={formData.name} onChange={handleFormChange} />
            </Form.Group>
            <Form.Group controlId="description">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={3} value={formData.description} onChange={handleFormChange} />
            </Form.Group>
            <Form.Group controlId="image">
              <Form.Label>Image</Form.Label>
              <Form.Control type="file" onChange={(e) => setImageFile(e.target.files[0])} />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
          <Button variant="primary" onClick={handleSave}>Save Changes</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default ProductManagement;
