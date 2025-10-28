import React from 'react';
import { Form, Button, Badge, Collapse, InputGroup } from 'react-bootstrap';
import { Trash, ChatLeftText, GraphUp } from 'react-bootstrap-icons';
import ImageUploader from './ImageUploader';
import './ShoppingListItem.css';

const ShoppingListItem = ({
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
        <div className={`shopping-list-item-compact ${item.status === 'comprado' ? 'is-comprado' : ''}`}>
            <div className="item-main-info-compact">
                <Form.Check
                    type="switch"
                    id={`item-status-${item.id}`}
                    checked={item.status === 'comprado'}
                    onChange={() => onStatusChange(item.id, item.status)}
                    className="status-checkbox-compact"
                    title={item.status === 'comprado' ? 'Marcar como pendiente' : 'Marcar como comprado'}
                />
                <div className="item-image-compact">
                    <ImageUploader itemId={item.id} imageUrl={item.product.image_url} onImageUpload={onImageUpload} />
                </div>
                <div className="item-details-compact">
                    <div className="item-name-compact" onDoubleClick={() => setEditingItem({ ...item })} title="Doble click para editar cantidad">
                        {item.nombre}
                    </div>
                    {isEditing ? (
                        <InputGroup size="sm" className="quantity-edit-compact">
                            <Form.Control type="number" value={editingItem.cantidad} onChange={(e) => setEditingItem({ ...editingItem, cantidad: parseFloat(e.target.value) || 0 })} />
                            <Form.Select value={editingItem.unit} onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}>
                                <option value="piezas">piezas</option>
                                <option value="kg">kg</option>
                                <option value="g">g</option>
                                <option value="L">L</option>
                                <option value="ml">ml</option>
                            </Form.Select>
                            <Button variant="success" onClick={() => onItemUpdate(editingItem.id, { cantidad: editingItem.cantidad, unit: editingItem.unit })}>Ok</Button>
                            <Button variant="secondary" onClick={() => setEditingItem(null)}>X</Button>
                        </InputGroup>
                    ) : (
                        <div className="item-quantity-compact" onDoubleClick={() => setEditingItem({ ...item })} title="Doble click para editar cantidad">
                            <span>{item.cantidad} {item.unit}</span>
                        </div>
                    )}
                </div>

                <div className="item-price-compact" onDoubleClick={() => setEditingPrice({ id: item.id, field: 'precio_confirmado' })} title="Doble click para editar precio">
                    {editingPrice?.id === item.id && editingPrice?.field === 'precio_confirmado' ? (
                        <Form.Control
                            type="number"
                            step="0.01"
                            defaultValue={item.precio_confirmado}
                            autoFocus
                            onBlur={(e) => onPriceChange(item.id, 'precio_confirmado', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                            size="sm"
                            className="price-input-compact"
                        />
                    ) : (
                        <Badge bg={`${item.precio_confirmado ? 'success' : item.product?.last_price ? 'warning' : 'primary'}`}>
                            ${(item.precio_confirmado || item.product?.last_price || 0).toFixed(2)}
                        </Badge>
                    )}
                </div>

                <div className="item-actions-compact">
                    <Button variant="outline-info" size="sm" onClick={() => onShowItemBlame(item.id)} disabled={loadingItemBlame && showItemBlame === item.id}>
                        <ChatLeftText />
                    </Button>
                    <Button variant="outline-primary" size="sm" onClick={() => onShowPriceHistory(item)}>
                        <GraphUp />
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={() => onDelete(item.id)} disabled={loading}>
                        <Trash />
                    </Button>
                </div>
            </div>
            <Collapse in={showItemBlame === item.id}>
                <div className="item-blame-details-compact">
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
        </div>
    );
};

export default ShoppingListItem;
