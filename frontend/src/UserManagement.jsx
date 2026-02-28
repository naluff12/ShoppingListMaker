import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Edit2, Trash2, Plus, X } from 'lucide-react';

const API_URL = 'http://localhost:8000';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({ name: '', username: '', email: '', password: '', role: 'User' });

  const fetchUsers = async () => {
    try {
      const response = await fetch(`/api/admin/users`);
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
    setFormData({ name: user.nombre, username: user.username, email: user.email, role: user.is_admin ? 'Admin' : 'User', password: '' });
    setShowModal(true);
  };

  const handleDelete = async (userId) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchUsers();
      } else {
        console.error('Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const method = currentUser ? 'PUT' : 'POST';
    const url = currentUser ? `/api/admin/users/${currentUser.id}` : `/api/admin/users`;

    const body = {
        username: formData.username,
        email: formData.email,
        nombre: formData.name,
        is_admin: formData.role === 'Admin',
    };

    if (!currentUser) {
        body.password = formData.password;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowModal(false);
        fetchUsers();
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Gestión de Usuarios</h2>
        <button className="btn-premium btn-primary" onClick={openAddUserModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Agregar Usuario
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nombre</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Usuario</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Email</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Rol</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Acciones</th>
                </tr>
            </thead>
            <tbody>
                {users.map((user, index) => (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)', background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <td style={{ padding: '12px 16px' }}>{user.nombre}</td>
                        <td style={{ padding: '12px 16px' }}>{user.username}</td>
                        <td style={{ padding: '12px 16px' }}>{user.email}</td>
                        <td style={{ padding: '12px 16px' }}>
                            <span className={`badge ${user.is_admin ? 'badge-primary' : 'badge-secondary'}`}>
                                {user.is_admin ? 'Admin' : 'Usuario'}
                            </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-premium" style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning-color)', padding: '6px' }} onClick={() => handleEdit(user)} title="Editar">
                                    <Edit2 size={16} />
                                </button>
                                <button className="btn-premium" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '6px' }} onClick={() => handleDelete(user.id)} title="Eliminar">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        {users.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No hay usuarios.</div>}
      </div>

      {showModal && ReactDOM.createPortal(
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
            <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">{currentUser ? 'Editar Usuario' : 'Agregar Usuario'}</h5>
                    <button className="modal-close" onClick={() => setShowModal(false)}><X size={24} /></button>
                </div>
                <form onSubmit={handleSave}>
                    <div className="modal-body">
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="name" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nombre</label>
                            <input type="text" id="name" className="premium-input" style={{ width: '100%' }} value={formData.name} onChange={handleFormChange} required />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="username" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Usuario</label>
                            <input type="text" id="username" className="premium-input" style={{ width: '100%' }} value={formData.username} onChange={handleFormChange} required />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Email</label>
                            <input type="email" id="email" className="premium-input" style={{ width: '100%' }} value={formData.email} onChange={handleFormChange} required />
                        </div>
                        {!currentUser && (
                            <div style={{ marginBottom: '16px' }}>
                                <label htmlFor="password" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Contraseña</label>
                                <input type="password" id="password" className="premium-input" style={{ width: '100%' }} value={formData.password} onChange={handleFormChange} required />
                            </div>
                        )}
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="role" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Rol</label>
                            <select id="role" className="premium-input" style={{ width: '100%' }} value={formData.role} onChange={handleFormChange}>
                                <option value="User">Usuario</option>
                                <option value="Admin">Admin</option>
                            </select>
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
    </div>
  );
}

export default UserManagement;
