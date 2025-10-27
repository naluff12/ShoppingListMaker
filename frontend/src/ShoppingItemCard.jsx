import React from 'react';
import { Card, Button, Form, InputGroup, Row, Col, Badge, Collapse } from 'react-bootstrap';
import { Trash, ChatLeftText, GraphUp } from 'react-bootstrap-icons';
import ImageUploader from './ImageUploader';

const ShoppingItemCard = ({
    item,
    onStatusChange,
    onDelete,
    onImageUpload,
    onItemUpdate,
    onPriceChange,
    onShowItemBlame,
    onItemCommentSubmit,
    onShowPriceHistory,
    editingItem,
    setEditingItem,
    editingPrice,
    setEditingPrice,
    showItemBlame,
    itemBlames,
    newItemComment,
    setNewItemComment,
    loadingItemBlame,
    loading
}) => {

    const isEditing = editingItem && editingItem.id === item.id;

    return (
        <Card className={`mb-3 shadow-sm ${item.status === 'comprado' ? 'is-comprado' : ''}`}>
            <Card.Header className="d-flex justify-content-between align-items-center">
                <span className="fw-bold">{item.nombre}</span>
                <Form.Check
                    type="switch"
                    id={`item-status-${item.id}`}
                    checked={item.status === 'comprado'}
                    onChange={() => onStatusChange(item.id, item.status)}
                    className="status-checkbox"
                    title={item.status === 'comprado' ? 'Marcar como pendiente' : 'Marcar como comprado'}
                />
            </Card.Header>
            <Card.Body>
                <Row>
                    <Col xs={4} md={3} className="d-flex align-items-center justify-content-center">
                        <ImageUploader itemId={item.id} imageUrl={item.product.image_url} onImageUpload={onImageUpload} />
                    </Col>
                    <Col xs={8} md={9}>
                        {isEditing ? (
                            <InputGroup>
                                <Form.Control type="number" value={editingItem.cantidad} onChange={(e) => setEditingItem({ ...editingItem, cantidad: parseFloat(e.target.value) || 0 })} style={{ maxWidth: '80px' }} />
                                <Form.Select value={editingItem.unit} onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })} style={{ maxWidth: '100px' }}>
                                    <option value="piezas">piezas</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="L">L</option>
                                    <option value="ml">ml</option>
                                </Form.Select>
                                <Button variant="success" size="sm" onClick={() => onItemUpdate(editingItem.id, { cantidad: editingItem.cantidad, unit: editingItem.unit })}>Guardar</Button>
                                <Button variant="secondary" size="sm" onClick={() => setEditingItem(null)}>Cancelar</Button>
                            </InputGroup>
                        ) : (
                            <div onDoubleClick={() => setEditingItem({ ...item })} title="Doble click para editar cantidad">
                                <p className="mb-1"><b>Cantidad:</b> {item.cantidad} {item.unit}</p>
                            </div>
                        )}

                        <div onDoubleClick={() => setEditingPrice({ id: item.id, field: 'precio_confirmado' })} title="Doble click para editar precio">
                            <b>Precio:</b>
                            {editingPrice?.id === item.id && editingPrice?.field === 'precio_confirmado' ? (
                                <Form.Control
                                    type="number"
                                    step="0.01"
                                    defaultValue={item.precio_confirmado}
                                    autoFocus
                                    onBlur={(e) => onPriceChange(item.id, 'precio_confirmado', e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                    style={{ width: '80px', display: 'inline-block' }}
                                    size="sm"
                                />
                            ) : (
                                <>
                                    <Badge bg={`${item.precio_confirmado ? 'success' : item.product?.last_price ? 'warning' : 'primary'}`} className="ms-2">${(item.precio_confirmado || item.product?.last_price || 0).toFixed(2)}</Badge>
                                </>
                            )}
                        </div>

                        <div className="d-flex align-items-center mt-3">
                            <Button variant="outline-danger" size="sm" onClick={() => onDelete(item.id)} disabled={loading} className="me-2">
                                <Trash />
                            </Button>
                            <Button variant="outline-info" size="sm" className="me-2" onClick={() => onShowItemBlame(item.id)} disabled={loadingItemBlame && showItemBlame === item.id}>
                                <ChatLeftText /> <span className="d-none d-md-inline">Historial</span>
                            </Button>
                            <Button variant="outline-primary" size="sm" onClick={() => onShowPriceHistory(item)}>
                                <GraphUp /> <span className="d-none d-md-inline">Precios</span>
                            </Button>
                        </div>
                    </Col>
                </Row>
                <Collapse in={showItemBlame === item.id}>
                    <div className="mt-3 pt-3 border-top">
                        <h6>Historial del Producto</h6>
                        {itemBlames[item.id] && itemBlames[item.id].length === 0 && <div className="text-muted small">Sin historial</div>}
                        <ul className="list-unstyled">
                            {itemBlames[item.id] && itemBlames[item.id].map(c => (
                                <li key={c.id} className="mb-2 small">
                                    <Badge bg="secondary">{c.user?.username || 'Usuario'}</Badge>
                                    <span className="text-muted mx-1">({new Date(c.timestamp).toLocaleString()})</span>
                                    <p className="mb-0 ms-1">{c.detalles}</p>
                                </li>
                            ))}
                        </ul>
                        <Form onSubmit={(e) => { e.preventDefault(); onItemCommentSubmit(item.id); }} className="mt-2 d-flex">
                            <Form.Control type="text" className="me-2" placeholder="Nuevo comentario..." value={newItemComment} onChange={e => setNewItemComment(e.target.value)} size="sm" />
                            <Button type="submit" variant="primary" size="sm">Comentar</Button>
                        </Form>
                    </div>
                </Collapse>
            </Card.Body>
            <Card.Footer className="text-muted small">
                Agregado por: {item.creado_por?.username || 'desconocido'}
            </Card.Footer>
        </Card >
    );
};

export default ShoppingItemCard;