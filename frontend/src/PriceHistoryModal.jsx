import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Spinner } from 'react-bootstrap';

const PriceHistoryModal = ({ show, handleClose, item }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (item) {
            setLoading(true);
            const token = localStorage.getItem('token');
            fetch(`/api/products/${item.product.id}/prices`, {
                headers: { 'Authorization': 'Bearer ' + token }
            })
            .then(res => res.json())
            .then(data => {
                setHistory(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching price history:", err);
                alert("No se pudo cargar el historial de precios.");
                setLoading(false);
            });
        }
    }, [item]);

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>Historial de Precios de {item?.nombre}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {loading ? (
                    <div className="text-center">
                        <Spinner animation="border" />
                    </div>
                ) : (
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Precio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length > 0 ? (
                                history.map(record => (
                                    <tr key={record.id}>
                                        <td>{new Date(record.created_at).toLocaleString()}</td>
                                        <td>${record.price.toFixed(2)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="2" className="text-center">No hay historial de precios para este producto.</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>
                    Cerrar
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default PriceHistoryModal;
