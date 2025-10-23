import React, { useState, useEffect } from 'react';
import { Modal, Button, ListGroup, Form, Row, Col, Accordion, Card, Badge } from 'react-bootstrap';

const PreviousItemsModal = ({ show, handleClose, familyId, listId, handleAddItems }) => {
    const [previousLists, setPreviousLists] = useState([]);
    const [itemsByList, setItemsByList] = useState({});
    const [selectedItems, setSelectedItems] = useState(new Map());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show && familyId) {
            setLoading(true);
            const fetchPreviousListsAndItems = async () => {
                try {
                    const now = new Date();
                    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

                    const response = await fetch(`/api/families/${familyId}/previous_lists?start_date=${startDate}&end_date=${endDate}`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const filteredLists = data.items.filter(list => list.id !== listId);
                        setPreviousLists(filteredLists);

                        const itemsPromises = filteredLists.map(list =>
                            fetch(`/api/listas/${list.id}/items?status=pendiente`, {
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                }
                            }).then(res => res.json())
                        );
                        const itemsResults = await Promise.all(itemsPromises);
                        const itemsMap = filteredLists.reduce((acc, list, index) => {
                            acc[list.id] = itemsResults[index].items;
                            return acc;
                        }, {});
                        setItemsByList(itemsMap);
                    }
                } catch (error) {
                    console.error('Error fetching previous lists and items:', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchPreviousListsAndItems();
        }
    }, [show, familyId, listId]);

    const handleSelectItem = (item) => {
        const newSelectedItems = new Map(selectedItems);
        if (newSelectedItems.has(item.id)) {
            newSelectedItems.delete(item.id);
        } else {
            newSelectedItems.set(item.id, item);
        }
        setSelectedItems(newSelectedItems);
    };

    const onAddItems = () => {
        handleAddItems(Array.from(selectedItems.values()));
        handleClose();
    };

    const totalSelected = selectedItems.size;

    return (
        <Modal show={show} onHide={handleClose} size="xl">
            <Modal.Header closeButton>
                <Modal.Title>Agregar productos no comprados de listas anteriores</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Row>
                    <Col md={8}>
                        {loading ? (
                            <p>Cargando...</p>
                        ) : (
                            <Accordion>
                                {previousLists.map(list => (
                                    itemsByList[list.id]?.length > 0 && (
                                        <Accordion.Item eventKey={list.id} key={list.id}>
                                            <Accordion.Header>{list.name} - {new Date(list.list_for_date).toLocaleDateString()}</Accordion.Header>
                                            <Accordion.Body>
                                                <ListGroup>
                                                    {itemsByList[list.id]?.map(item => (
                                                        <ListGroup.Item key={item.id}>
                                                            <Row>
                                                                <Col md={1}>
                                                                    <img src={item.product.image_url ? `data:image/webp;base64,${item.product.image_url}` : 'https://via.placeholder.com/50'} alt={item.nombre} style={{ width: 50, height: 50, objectFit: 'cover' }} />
                                                                </Col>
                                                                <Col md={9}>
                                                                    <Form.Check
                                                                        type="checkbox"
                                                                        label={`${item.nombre} (${item.cantidad} ${item.unit || ''})`}
                                                                        checked={selectedItems.has(item.id)}
                                                                        onChange={() => handleSelectItem(item)}
                                                                    />
                                                                </Col>
                                                            </Row>
                                                        </ListGroup.Item>
                                                    ))}
                                                </ListGroup>
                                            </Accordion.Body>
                                        </Accordion.Item>
                                    )
                                ))}
                            </Accordion>
                        )}
                    </Col>
                    <Col md={4}>
                        <Card>
                            <Card.Header>Productos Seleccionados <Badge bg="secondary">{totalSelected}</Badge></Card.Header>
                            <Card.Body>
                                <ListGroup variant="flush">
                                    {Array.from(selectedItems.values()).map(item => (
                                        <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-center">
                                            {item.nombre}
                                            <Button variant="danger" size="sm" onClick={() => handleSelectItem(item)}>&times;</Button>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>
                    Cancelar
                </Button>
                <Button variant="primary" onClick={onAddItems} disabled={totalSelected === 0}>
                    Agregar {totalSelected} Productos
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default PreviousItemsModal;
