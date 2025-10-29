import React from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import './Skeleton.css';

const ShoppingItemCardSkeleton = () => {
    return (
        <Card className="mb-3 shadow-sm">
            <Card.Header className="d-flex justify-content-between align-items-center">
                <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
                <div className="skeleton skeleton-switch"></div>
            </Card.Header>
            <Card.Body>
                <Row>
                    <Col xs={4} md={3} className="d-flex align-items-center justify-content-center">
                        <div className="skeleton skeleton-image"></div>
                    </Col>
                    <Col xs={8} md={9}>
                        <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
                        <div className="skeleton skeleton-text"></div>
                        <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
                        <div className="d-flex align-items-center mt-3">
                            <div className="skeleton skeleton-button"></div>
                            <div className="skeleton skeleton-button"></div>
                            <div className="skeleton skeleton-button"></div>
                        </div>
                    </Col>
                </Row>
            </Card.Body>
            <Card.Footer>
                <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
            </Card.Footer>
        </Card>
    );
};

export default ShoppingItemCardSkeleton;
