import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

function InviteMember({ onBack }) {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const handleSend = (e) => {
        e.preventDefault();
        setSent(true);
        setShowModal(true);
    };

    return (
        <div className="container mt-5" style={{ maxWidth: 400 }}>
            <h2 className="mb-4">Invitar miembro a la familia</h2>
            <form onSubmit={handleSend} className="mb-3">
                <input type="email" className="form-control mb-2" placeholder="Email del invitado" value={email} onChange={e => setEmail(e.target.value)} required />
                <Button type="submit" className="w-100" variant="primary">Enviar invitación</Button>
            </form>
            <Button variant="secondary" className="w-100" onClick={onBack}>Volver</Button>

            <Modal show={showModal} onHide={() => setShowModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Invitación enviada</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Se ha enviado la invitación a <b>{email}</b>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={() => { setShowModal(false); onBack(); }}>
                        Volver
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default InviteMember;
