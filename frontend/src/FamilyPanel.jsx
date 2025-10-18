import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Modal, Form, Dropdown, Badge, ListGroup, Spinner, Alert } from 'react-bootstrap';

const API_URL = 'http://localhost:8000';

function FamilyPanel() {
    const [families, setFamilies] = useState([]);
    const [selectedFamily, setSelectedFamily] = useState(null);
    const [calendars, setCalendars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [showCreateFamily, setShowCreateFamily] = useState(false);
    const [newFamilyName, setNewFamilyName] = useState('');

    const [showJoinFamily, setShowJoinFamily] = useState(false);
    const [joinCode, setJoinCode] = useState('');

    const [showCreateCalendar, setShowCreateCalendar] = useState(false);
    const [newCalendarName, setNewCalendarName] = useState('');

    const navigate = useNavigate();

    const fetchFamilies = useCallback(async () => {
        const token = localStorage.getItem('token');
        try {
            setLoading(true);
            const res = await fetch(`/api/families/my`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) throw new Error('Could not fetch families');
            const data = await res.json();
            setFamilies(data);
            if (data.length > 0) {
                setSelectedFamily(data[0]);
            } else {
                setSelectedFamily(null);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFamilies();
    }, [fetchFamilies]);

    useEffect(() => {
        const fetchCalendars = async () => {
            if (!selectedFamily) {
                setCalendars([]);
                return;
            }
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`/api/families/${selectedFamily.id}/calendars`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                setCalendars(Array.isArray(data) ? data : []);
            } catch (error) {
                setCalendars([]);
            }
        };

        fetchCalendars();
    }, [selectedFamily]);

    const handleCreateFamily = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/families`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ nombre: newFamilyName })
            });
            if (!res.ok) throw new Error('Failed to create family');
            setShowCreateFamily(false);
            setNewFamilyName('');
            fetchFamilies(); // Refresh the list
        } catch (err) {
            alert(err.message);
        }
    };

    const handleJoinFamily = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/families/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ code: joinCode })
            });
            if (!res.ok) throw new Error('Failed to join family');
            setShowJoinFamily(false);
            setJoinCode('');
            fetchFamilies(); // Refresh the list
        } catch (err) {
            alert(err.message);
        }
    };

    const handleCreateCalendar = async (e) => {
        e.preventDefault();
        if (!selectedFamily) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/families/${selectedFamily.id}/calendars`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ nombre: newCalendarName })
            });
            if (!res.ok) throw new Error('Error al crear calendario.');
            const newCal = await res.json();
            setCalendars([...calendars, newCal]);
            setShowCreateCalendar(false);
            setNewCalendarName('');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSelectCalendar = (calendar) => {
        navigate('/calendar', { state: { calendar } });
    };

    if (loading) {
        return <Spinner animation="border" />;
    }

    return (
        <Card className="mx-auto mt-5 p-4" style={{ maxWidth: 800 }}>
            <h2 className="mb-3">Panel de Familia</h2>

            <div className="mb-3">
                <Button variant="success" className="me-2" onClick={() => setShowCreateFamily(true)}>Crear Familia</Button>
                <Button variant="primary" onClick={() => setShowJoinFamily(true)}>Join Family</Button>
            </div>

            {families.length > 0 ? (
                <Dropdown className="mb-3" onSelect={(id) => setSelectedFamily(families.find(f => f.id.toString() === id))}>
                    <Dropdown.Toggle variant="info" id="dropdown-family">
                        Familia seleccionada: {selectedFamily ? selectedFamily.nombre : 'None'}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        {families.map(fam => (
                            <Dropdown.Item key={fam.id} eventKey={fam.id}>{fam.nombre}</Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown>
            ) : (
                <Alert variant="info">Aun no eres parte de ninguna familia. Crea una o unete a una para empezar!</Alert>
            )}

            {selectedFamily && (
                <div>
                    <Card className="mb-4">
                        <Card.Header>Detalles de la Familia</Card.Header>
                        <Card.Body>
                            <p><b>Nombre de la Familia:</b> {selectedFamily.nombre}</p>
                            <p><b>Creador:</b> {selectedFamily.owner?.username || 'N/A'}</p>
                            <p><b>Codigo de invitacion:</b> <Badge bg="secondary">{selectedFamily.code}</Badge> (Compartelo con quien quieras que pueda ver tus calendarios)</p>
                        </Card.Body>
                    </Card>

                    <h4>Calendars for {selectedFamily.nombre}</h4>
                    <Button variant="outline-success" size="sm" className="mb-2" onClick={() => setShowCreateCalendar(true)}>Crear Calendario</Button>
                    <ListGroup>
                        {calendars.map(cal => (
                            <ListGroup.Item key={cal.id} action onClick={() => handleSelectCalendar(cal)}>
                                {cal.nombre} (Creador: {cal.owner?.username || 'N/A'})
                            </ListGroup.Item>
                        ))}
                        {calendars.length === 0 && <ListGroup.Item>No hay calendarios para esta familia aun.</ListGroup.Item>}
                    </ListGroup>
                </div>
            )}

            {/* Modals */}
            <Modal show={showCreateFamily} onHide={() => setShowCreateFamily(false)}>
                <Modal.Header closeButton><Modal.Title>Create New Family</Modal.Title></Modal.Header>
                <Form onSubmit={handleCreateFamily}>
                    <Modal.Body>
                        <Form.Control type="text" placeholder="Enter family name" value={newFamilyName} onChange={e => setNewFamilyName(e.target.value)} required />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowCreateFamily(false)}>Cancelar</Button>
                        <Button variant="primary" type="submit">Create</Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            <Modal show={showJoinFamily} onHide={() => setShowJoinFamily(false)}>
                <Modal.Header closeButton><Modal.Title>Unirse a una familia.</Modal.Title></Modal.Header>
                <Form onSubmit={handleJoinFamily}>
                    <Modal.Body>
                        <Form.Control type="text" placeholder="Enter family code" value={joinCode} onChange={e => setJoinCode(e.target.value)} required />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowJoinFamily(false)}>Cancelar</Button>
                        <Button variant="primary" type="submit">Join</Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            <Modal show={showCreateCalendar} onHide={() => setShowCreateCalendar(false)}>
                <Modal.Header closeButton><Modal.Title>Crear nuevo calendario</Modal.Title></Modal.Header>
                <Form onSubmit={handleCreateCalendar}>
                    <Modal.Body>
                        <Form.Control type="text" placeholder="Enter calendar name" value={newCalendarName} onChange={e => setNewCalendarName(e.target.value)} required />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowCreateCalendar(false)}>Cancelar</Button>
                        <Button variant="primary" type="submit">Crear</Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </Card>
    );
}

export default FamilyPanel;