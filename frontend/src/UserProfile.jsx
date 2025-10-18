import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Card, Alert } from 'react-bootstrap';

const API_URL = 'http://localhost:8000';

function UserProfile() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', email: '' });
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchUserProfile = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setFormData({ nombre: data.nombre, email: data.email });
      } else {
        console.error('Failed to fetch user profile');
        setMessage({ type: 'danger', text: 'Failed to fetch user profile.' });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setMessage({ type: 'danger', text: 'An error occurred while fetching your profile.' });
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        fetchUserProfile(); // Refresh user data
      } else {
        const errorData = await response.json();
        setMessage({ type: 'danger', text: `Failed to update profile: ${errorData.detail}` });
      }
    } catch (error) {
      setMessage({ type: 'danger', text: 'An error occurred while updating your profile.' });
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'danger', text: "New passwords don't match!" });
      return;
    }
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/users/me/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ current_password: passwordData.current_password, new_password: passwordData.new_password }),
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'danger', text: `Failed to change password: ${errorData.detail}` });
      }
    } catch (error) {
      setMessage({ type: 'danger', text: 'An error occurred while changing your password.' });
    }
  };

  const handleFormChange = (e, formSetter) => {
    const { id, value } = e.target;
    formSetter(prev => ({ ...prev, [id]: value }));
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <Container className="mt-4">
      <Row>
        <Col md={{ span: 8, offset: 2 }}>
          {message.text && <Alert variant={message.type}>{message.text}</Alert>}
          <Card>
            <Card.Body>
              <Card.Title>User Profile</Card.Title>
              <Form onSubmit={handleProfileUpdate}>
                <Form.Group controlId="nombre">
                  <Form.Label>Name</Form.Label>
                  <Form.Control type="text" value={formData.nombre} onChange={(e) => handleFormChange(e, setFormData)} />
                </Form.Group>
                <Form.Group controlId="email" className="mt-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={formData.email} onChange={(e) => handleFormChange(e, setFormData)} />
                </Form.Group>
                <Button variant="primary" type="submit" className="mt-3">Update Profile</Button>
              </Form>
            </Card.Body>
          </Card>

          <Card className="mt-4">
            <Card.Body>
              <Card.Title>Change Password</Card.Title>
              <Form onSubmit={handlePasswordChange}>
                <Form.Group controlId="current_password">
                  <Form.Label>Current Password</Form.Label>
                  <Form.Control type="password" value={passwordData.current_password} onChange={(e) => handleFormChange(e, setPasswordData)} />
                </Form.Group>
                <Form.Group controlId="new_password" className="mt-3">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control type="password" value={passwordData.new_password} onChange={(e) => handleFormChange(e, setPasswordData)} />
                </Form.Group>
                <Form.Group controlId="confirm_password" className="mt-3">
                  <Form.Label>Confirm New Password</Form.Label>
                  <Form.Control type="password" value={passwordData.confirm_password} onChange={(e) => handleFormChange(e, setPasswordData)} />
                </Form.Group>
                <Button variant="danger" type="submit" className="mt-3">Change Password</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default UserProfile;