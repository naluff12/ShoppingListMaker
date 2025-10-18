import React, { useState, useEffect } from 'react';
import { Button, Table, Modal, Form } from 'react-bootstrap';

const API_URL = 'http://localhost:8000';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({ name: '', username: '', email: '', password: '', role: 'User' });

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        console.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user) => {
    setCurrentUser(user);
    setFormData({ name: user.nombre, username: user.username, email: user.email, role: user.is_admin ? 'Admin' : 'User' });
    setShowModal(true);
  };

  const handleDelete = async (userId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        fetchUsers(); // Refresh the list
      } else {
        console.error('Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    const method = currentUser ? 'PUT' : 'POST';
    const url = currentUser ? `/api/admin/users/${currentUser.id}` : `/api/admin/users`;

    const body = {
        username: formData.username,
        email: formData.email,
        nombre: formData.name,
        is_admin: formData.role === 'Admin',
    };

    if (!currentUser) { // Only send password for new users
        body.password = formData.password;
    }


    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowModal(false);
        fetchUsers(); // Refresh the list
      } else {
        const errorData = await response.json();
        console.error('Failed to save user:', errorData.detail);
        alert('Failed to save user: ' + errorData.detail);
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving user.');
    }
  };

  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  const openAddUserModal = () => {
    setCurrentUser(null);
    setFormData({ name: '', username: '', email: '', password: '', role: 'User' });
    setShowModal(true);
  };


  return (
    <div>
      <h2>User Management</h2>
      <Button variant="primary" onClick={openAddUserModal}>Add User</Button>
      <Table striped bordered hover className="mt-3">
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.nombre}</td>
              <td>{user.username}</td>
              <td>{user.email}</td>
              <td>{user.is_admin ? 'Admin' : 'User'}</td>
              <td>
                <Button variant="warning" onClick={() => handleEdit(user)}>Edit</Button>{' '}
                <Button variant="danger" onClick={() => handleDelete(user.id)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{currentUser ? 'Edit User' : 'Add User'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="name">
              <Form.Label>Name</Form.Label>
              <Form.Control type="text" value={formData.name} onChange={handleFormChange} />
            </Form.Group>
            <Form.Group controlId="username">
              <Form.Label>Username</Form.Label>
              <Form.Control type="text" value={formData.username} onChange={handleFormChange} />
            </Form.Group>
            <Form.Group controlId="email">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={formData.email} onChange={handleFormChange} />
            </Form.Group>
            {!currentUser && (
              <Form.Group controlId="password">
                <Form.Label>Password</Form.Label>
                <Form.Control type="password" value={formData.password} onChange={handleFormChange} />
              </Form.Group>
            )}
            <Form.Group controlId="role">
              <Form.Label>Role</Form.Label>
              <Form.Control as="select" value={formData.role} onChange={handleFormChange}>
                <option>User</option>
                <option>Admin</option>
              </Form.Control>
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

export default UserManagement;
