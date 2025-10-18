import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Card } from 'react-bootstrap';

const API_URL = 'http://localhost:8000';

function Setup() {
  const [formData, setFormData] = useState({
    family_name: '',
    family_notes: '',
    admin_name: '',
    admin_email: '',
    admin_username: '',
    admin_password: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const payload = {
      family: {
        nombre: formData.family_name,
        notas: formData.family_notes,
      },
      admin: {
        nombre: formData.admin_name,
        email: formData.admin_email,
        username: formData.admin_username,
        password: formData.admin_password,
      },
    };

    try {
      const response = await fetch(`${API_URL}/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSuccess('Setup successful! You can now log in.');
        window.location.href = '/login';
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to complete setup.');
      }
    } catch (err) {
      setError('An error occurred during setup.');
      console.error(err);
    }
  };

  return (
    <Container>
      <Row className="justify-content-md-center mt-5">
        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title className="text-center">Initial Setup</Card.Title>
              <p className="text-center">Create the first family and admin user.</p>
              <Form onSubmit={handleSetup}>
                <hr />
                <h5>Family Details</h5>
                <Form.Group controlId="family_name">
                  <Form.Label>Family Name</Form.Label>
                  <Form.Control type="text" value={formData.family_name} onChange={handleFormChange} required />
                </Form.Group>
                <Form.Group controlId="family_notes">
                  <Form.Label>Family Notes</Form.Label>
                  <Form.Control as="textarea" rows={2} value={formData.family_notes} onChange={handleFormChange} />
                </Form.Group>

                <hr />
                <h5>Admin User Details</h5>
                <Form.Group controlId="admin_name">
                  <Form.Label>Name</Form.Label>
                  <Form.Control type="text" value={formData.admin_name} onChange={handleFormChange} required />
                </Form.Group>
                <Form.Group controlId="admin_email">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={formData.admin_email} onChange={handleFormChange} required />
                </Form.Group>
                <Form.Group controlId="admin_username">
                  <Form.Label>Username</Form.Label>
                  <Form.Control type="text" value={formData.admin_username} onChange={handleFormChange} required />
                </Form.Group>
                <Form.Group controlId="admin_password">
                  <Form.Label>Password</Form.Label>
                  <Form.Control type="password" value={formData.admin_password} onChange={handleFormChange} required />
                </Form.Group>

                {error && <p className="text-danger mt-3">{error}</p>}
                {success && <p className="text-success mt-3">{success}</p>}

                <Button variant="primary" type="submit" className="w-100 mt-3">Complete Setup</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Setup;
