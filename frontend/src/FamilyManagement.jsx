import React, { useState, useEffect } from 'react';
import { Button, Table, Modal, Form } from 'react-bootstrap';

const API_URL = 'http://localhost:8000';

function FamilyManagement() {
  const [families, setFamilies] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentFamily, setCurrentFamily] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', notas: '', owner_id: '' });

  // New state for members modal
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedFamilyForMembers, setSelectedFamilyForMembers] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [nonFamilyMembers, setNonFamilyMembers] = useState([]);
  const [userToAdd, setUserToAdd] = useState('');

  const fetchFamilies = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/admin/families`, {
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

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/admin/users`, {
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
    fetchFamilies();
    fetchUsers();
  }, []);

  const handleEdit = (family) => {
    setCurrentFamily(family);
    setFormData({ nombre: family.nombre, notas: family.notas, owner_id: family.owner_id });
    setShowModal(true);
  };

  const handleDelete = async (familyId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/admin/families/${familyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        fetchFamilies(); // Refresh the list
      } else {
        const errorData = await response.json();
        console.error('Failed to delete family:', errorData.detail);
        alert('Failed to delete family: ' + errorData.detail);
      }
    } catch (error) {
      console.error('Error deleting family:', error);
      alert('Error deleting family.');
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    const method = currentFamily ? 'PUT' : 'POST';
    const url = currentFamily ? `${API_URL}/admin/families/${currentFamily.id}` : `${API_URL}/admin/families`;

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
        setShowModal(false);
        fetchFamilies(); // Refresh the list
      } else {
        const errorData = await response.json();
        console.error('Failed to save family:', errorData.detail);
        alert('Failed to save family: ' + errorData.detail);
      }
    } catch (error) {
      console.error('Error saving family:', error);
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
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/admin/families/${family.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setFamilyMembers(data.users);
        const memberIds = data.users.map(u => u.id);
        setNonFamilyMembers(users.filter(u => !memberIds.includes(u.id)));
        setShowMembersModal(true);
      } else {
        console.error('Failed to fetch family members');
      }
    } catch (error) {
      console.error('Error fetching family members:', error);
    }
  };

  const handleAddMember = async () => {
    if (!userToAdd || !selectedFamilyForMembers) return;
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/admin/families/${selectedFamilyForMembers.id}/members/${userToAdd}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/admin/families/${selectedFamilyForMembers.id}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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
      <h2>Family Management</h2>
      <Button variant="primary" onClick={openAddFamilyModal}>Add Family</Button>
      <Table striped bordered hover className="mt-3">
        <thead>
          <tr>
            <th>Name</th>
            <th>Notes</th>
            <th>Owner</th>
            <th>Members</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {families.map(family => (
            <tr key={family.id}>
              <td>{family.nombre}</td>
              <td>{family.notas ? family.notas : 'Sin notas'}</td>
              <td>{family.owner.username}</td>
              <td>{family.users?.length || 0}</td>
              <td>
                <Button variant="info" onClick={() => handleManageMembers(family)}>Manage Members</Button>{' '}
                <Button variant="warning" onClick={() => handleEdit(family)}>Edit</Button>{' '}
                <Button variant="danger" onClick={() => handleDelete(family.id)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{currentFamily ? 'Edit Family' : 'Add Family'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="nombre">
              <Form.Label>Name</Form.Label>
              <Form.Control type="text" value={formData.nombre} onChange={handleFormChange} />
            </Form.Group>
            <Form.Group controlId="notas">
              <Form.Label>Notes</Form.Label>
              <Form.Control as="textarea" rows={3} value={formData.notas} onChange={handleFormChange} />
            </Form.Group>
            <Form.Group controlId="owner_id">
              <Form.Label>Owner</Form.Label>
              <Form.Control as="select" value={formData.owner_id} onChange={handleFormChange}>
                <option value="">Select Owner</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.nombre} ({user.email})</option>
                ))}
              </Form.Control>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
          <Button variant="primary" onClick={handleSave}>Save Changes</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showMembersModal} onHide={() => setShowMembersModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Manage Members for {selectedFamilyForMembers?.nombre}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <h5>Add Member</h5>
          <Form.Group>
            <Form.Label>User</Form.Label>
            <Form.Control as="select" value={userToAdd} onChange={(e) => setUserToAdd(e.target.value)}>
              <option value="">Select User to Add</option>
              {nonFamilyMembers.map(user => (
                <option key={user.id} value={user.id}>{user.nombre} ({user.email})</option>
              ))}
            </Form.Control>
          </Form.Group>
          <Button variant="primary" onClick={handleAddMember} className="mt-2">Add Member</Button>
          <hr />
          <h5>Current Members</h5>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {familyMembers.map(member => (
                <tr key={member.id}>
                  <td>{member.nombre}</td>
                  <td>{member.email}</td>
                  <td>
                    <Button variant="danger" size="sm" onClick={() => handleRemoveMember(member.id)}>Remove</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowMembersModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default FamilyManagement;
