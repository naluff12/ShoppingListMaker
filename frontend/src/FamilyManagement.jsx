import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Edit2, Trash2, Plus, Users, X } from 'lucide-react';

const API_URL = 'http://localhost:8000';

function FamilyManagement() {
  const [families, setFamilies] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentFamily, setCurrentFamily] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', notas: '', owner_id: '' });

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedFamilyForMembers, setSelectedFamilyForMembers] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [nonFamilyMembers, setNonFamilyMembers] = useState([]);
  const [userToAdd, setUserToAdd] = useState('');

  const fetchFamilies = async () => {
    try {
      const response = await fetch(`/api/admin/families`);
      if (response.ok) {
        setFamilies(await response.json());
      }
    } catch (error) {
      console.error('Error fetching families:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`/api/admin/users`);
      if (response.ok) {
        setUsers(await response.json());
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchFamilies();
    fetchUsers();
  }, []);

  const handleEdit = (family) => {
    setCurrentFamily(family);
    setFormData({ nombre: family.nombre, notas: family.notas || '', owner_id: family.owner_id });
    setShowModal(true);
  };

  const handleDelete = async (familyId) => {
    try {
      const response = await fetch(`/api/admin/families/${familyId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchFamilies();
      } else {
        const errorData = await response.json();
        alert('Failed to delete family: ' + errorData.detail);
      }
    } catch (error) {
      alert('Error deleting family.');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const method = currentFamily ? 'PUT' : 'POST';
    const url = currentFamily ? `/api/admin/families/${currentFamily.id}` : `/api/admin/families`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        fetchFamilies();
      } else {
        const errorData = await response.json();
        alert('Failed to save family: ' + errorData.detail);
      }
    } catch (error) {
      alert('Error saving family.');
    }
  };

  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const openAddFamilyModal = () => {
    setCurrentFamily(null);
    setFormData({ nombre: '', notas: '', owner_id: '' });
    setShowModal(true);
  };

  const handleManageMembers = async (family) => {
    setSelectedFamilyForMembers(family);
    try {
      const response = await fetch(`/api/admin/families/${family.id}`);
      if (response.ok) {
        const data = await response.json();
        setFamilyMembers(data.users);
        const memberIds = data.users.map(u => u.id);
        setNonFamilyMembers(users.filter(u => !memberIds.includes(u.id)));
        setShowMembersModal(true);
      }
    } catch (error) {
      console.error('Error fetching family members:', error);
    }
  };

  const handleAddMember = async () => {
    if (!userToAdd || !selectedFamilyForMembers) return;
    try {
      const response = await fetch(`/api/admin/families/${selectedFamilyForMembers.id}/members/${userToAdd}`, {
        method: 'POST',
      });
      if (response.ok) {
        handleManageMembers(selectedFamilyForMembers);
        fetchFamilies();
        setUserToAdd('');
      } else {
        const errorData = await response.json();
        alert('Failed to add member: ' + errorData.detail);
      }
    } catch (error) {
      alert('Error adding member.');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedFamilyForMembers) return;
    try {
      const response = await fetch(`/api/admin/families/${selectedFamilyForMembers.id}/members/${userId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        handleManageMembers(selectedFamilyForMembers);
        fetchFamilies();
      } else {
        const errorData = await response.json();
        alert('Failed to remove member: ' + errorData.detail);
      }
    } catch (error) {
      alert('Error removing member.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Gestión de Familias</h2>
        <button className="btn-premium btn-primary" onClick={openAddFamilyModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Agregar Familia
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nombre</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Notas</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Propietario</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Miembros</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Acciones</th>
                </tr>
            </thead>
            <tbody>
                {families.map((family, index) => (
                    <tr key={family.id} style={{ borderBottom: '1px solid var(--border-color)', background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <td style={{ padding: '12px 16px' }}>{family.nombre}</td>
                        <td style={{ padding: '12px 16px' }}>{family.notas || <span style={{ color: 'var(--text-secondary)' }}>Sin notas</span>}</td>
                        <td style={{ padding: '12px 16px' }}>{family.owner?.username || 'Desconocido'}</td>
                        <td style={{ padding: '12px 16px' }}>
                            <span className="badge badge-info">{family.users?.length || 0}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-premium" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info-color)', padding: '6px' }} onClick={() => handleManageMembers(family)} title="Miembros">
                                    <Users size={16} />
                                </button>
                                <button className="btn-premium" style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning-color)', padding: '6px' }} onClick={() => handleEdit(family)} title="Editar">
                                    <Edit2 size={16} />
                                </button>
                                <button className="btn-premium" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '6px' }} onClick={() => handleDelete(family.id)} title="Eliminar">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        {families.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No hay familias.</div>}
      </div>

      {showModal && ReactDOM.createPortal(
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
            <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">{currentFamily ? 'Editar Familia' : 'Agregar Familia'}</h5>
                    <button className="modal-close" onClick={() => setShowModal(false)}><X size={24} /></button>
                </div>
                <form onSubmit={handleSave}>
                    <div className="modal-body">
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="nombre" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nombre</label>
                            <input type="text" id="nombre" className="premium-input" style={{ width: '100%' }} value={formData.nombre} onChange={handleFormChange} required />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="notas" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Notas</label>
                            <textarea id="notas" className="premium-input" style={{ width: '100%', minHeight: '80px' }} value={formData.notas} onChange={handleFormChange} />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="owner_id" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Propietario</label>
                            <select id="owner_id" className="premium-input" style={{ width: '100%' }} value={formData.owner_id} onChange={handleFormChange} required>
                                <option value="">Seleccionar Propietario</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.nombre} ({user.email})</option>
                                ))}
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

      {showMembersModal && ReactDOM.createPortal(
        <div className="modal-backdrop" onClick={() => setShowMembersModal(false)}>
            <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">Miembros: {selectedFamilyForMembers?.nombre}</h5>
                    <button className="modal-close" onClick={() => setShowMembersModal(false)}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                        <select className="premium-input" style={{ flex: 1 }} value={userToAdd} onChange={(e) => setUserToAdd(e.target.value)}>
                            <option value="">Seleccionar Usuario para Agregar</option>
                            {nonFamilyMembers.map(user => (
                                <option key={user.id} value={user.id}>{user.nombre} ({user.email})</option>
                            ))}
                        </select>
                        <button className="btn-premium btn-primary" onClick={handleAddMember} disabled={!userToAdd}>Agregar</button>
                    </div>

                    <h6 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Miembros Actuales</h6>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '8px', fontWeight: 600 }}>Nombre</th>
                                <th style={{ padding: '8px', fontWeight: 600 }}>Email</th>
                                <th style={{ padding: '8px', fontWeight: 600 }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {familyMembers.map((member, index) => (
                                <tr key={member.id} style={{ borderBottom: '1px solid var(--border-color)', background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                    <td style={{ padding: '8px' }}>{member.nombre}</td>
                                    <td style={{ padding: '8px' }}>{member.email}</td>
                                    <td style={{ padding: '8px' }}>
                                        <button className="btn-premium" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleRemoveMember(member.id)}>Quitar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {familyMembers.length === 0 && <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No hay miembros en esta familia.</div>}
                </div>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default FamilyManagement;
