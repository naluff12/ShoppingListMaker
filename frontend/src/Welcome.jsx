import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, ListGroup, Badge } from 'react-bootstrap';

const API_URL = 'http://localhost:8000';

function Welcome() {
    const [lastLists, setLastLists] = useState([]);
    const [lastProducts, setLastProducts] = useState([]);
    const [families, setFamilies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const [listsRes, productsRes, userRes] = await Promise.all([
                    fetch(`/api/home/last-lists`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`/api/home/last-products`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } })
                ]);

                if (listsRes.ok) {
                    const listsData = await listsRes.json();
                    setLastLists(listsData);
                }

                if (productsRes.ok) {
                    const productsData = await productsRes.json();
                    setLastProducts(productsData);
                }

                if (userRes.ok) {
                    const userData = await userRes.json();
                    setFamilies(userData.families || []);
                }
            } catch (error) {
                console.error("Failed to fetch home data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <Container className="mt-4">
            <Row>
                <Col md={8}>
                    <h1>Bienvenido</h1>
                    <p>Aquí tienes un resumen de la actividad reciente en tus familias.</p>
                </Col>
            </Row>

            <Row className="mt-4">
                <Col md={4}>
                    <Card>
                        <Card.Header>Mis Familias</Card.Header>
                        <ListGroup variant="flush">
                            {families.length > 0 ? (
                                families.map(family => (
                                    <ListGroup.Item key={family.id}>{family.nombre}</ListGroup.Item>
                                ))
                            ) : (
                                <ListGroup.Item>No perteneces a ninguna familia.</ListGroup.Item>
                            )}
                        </ListGroup>
                    </Card>
                </Col>

                <Col md={4}>
                    <Card>
                        <Card.Header>Últimas Listas Creadas</Card.Header>
                        <ListGroup variant="flush">
                            {lastLists.length > 0 ? (
                                lastLists.map(list => (
                                    <ListGroup.Item key={list.id}>
                                        {list.name} <Badge bg="secondary">{new Date(list.list_for_date).toLocaleDateString()}</Badge>
                                    </ListGroup.Item>
                                ))
                            ) : (
                                <ListGroup.Item>No hay listas recientes.</ListGroup.Item>
                            )}
                        </ListGroup>
                    </Card>
                </Col>

                <Col md={4}>
                    <Card>
                        <Card.Header>Últimos Productos Agregados</Card.Header>
                        <ListGroup variant="flush">
                            {lastProducts.length > 0 ? (
                                lastProducts.map(product => (
                                    <ListGroup.Item key={product.id}>{product.name}</ListGroup.Item>
                                ))
                            ) : (
                                <ListGroup.Item>No hay productos recientes.</ListGroup.Item>
                            )}
                        </ListGroup>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default Welcome;
