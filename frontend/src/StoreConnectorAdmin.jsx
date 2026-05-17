import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Link, Globe, Code, Shield, Activity } from 'lucide-react';

const StoreConnectorAdmin = ({ apiBaseUrl }) => {
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  const initialFormState = {
    name: '',
    domain_match: '',
    response_type: 'html',
    json_name_path: '',
    json_price_path: '',
    json_image_path: '',
    json_description_path: '',
    html_name_selector: '',
    html_price_selector: '',
    html_image_selector: '',
    html_image_attribute: 'src',
    html_description_selector: '',
    is_active: true,
    is_default: false
  };

  const fetchConnectors = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/admin/store-connectors`);
      if (!response.ok) throw new Error('Error al cargar conectores');
      const data = await response.json();
      setConnectors(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectors();
  }, []);

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setEditForm({ ...initialFormState });
  };

  const startEdit = (connector) => {
    setIsAdding(false);
    setEditingId(connector.id);
    setEditForm({ ...connector });
    setTestUrl('');
    setTestResult(null);
    setTestError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const isUpdate = editingId !== null;
    const url = isUpdate
      ? `${apiBaseUrl}/admin/store-connectors/${editingId}`
      : `${apiBaseUrl}/admin/store-connectors`;

    try {
      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });
      if (!response.ok) throw new Error('Error al guardar el conector');
      await fetchConnectors();
      setIsAdding(false);
      setEditingId(null);
      setEditForm(null);
      setTestUrl('');
      setTestResult(null);
      setTestError(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const runTestConnector = async () => {
    if (!testUrl.trim()) return;
    setTestLoading(true);
    setTestError(null);
    setTestResult(null);

    try {
      const response = await fetch(`${apiBaseUrl}/admin/store-connectors/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: testUrl,
          connector_id: editingId,
          config: editingId ? null : editForm
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Error al probar el conector');
      }
      const data = await response.json();
      setTestResult(data);
    } catch (err) {
      setTestError(err.message || 'Error al probar el conector');
    } finally {
      setTestLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este conector?')) return;
    try {
      const response = await fetch(`${apiBaseUrl}/admin/store-connectors/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Error al eliminar el conector');
      await fetchConnectors();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Cargando conectores...</div>;
  if (error) return <div className="p-8 text-center" style={{ color: 'var(--danger-color)' }}>{error}</div>;

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link className="text-gradient" />
          Conectores de Tiendas
        </h2>
        {!isAdding && editingId === null && (
          <button onClick={startAdd} className="btn-premium btn-primary">
            <Plus size={20} /> Nuevo Conector
          </button>
        )}
      </div>

      {(isAdding || editingId !== null) && (
        <form onSubmit={handleSave} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>
            {isAdding ? 'Agregar Conector' : 'Editar Conector'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nombre</label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                className="premium-input"
                placeholder="Ej. Tienda Ejemplo"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Dominio</label>
              <input
                value={editForm.domain_match}
                onChange={(e) => setEditForm({ ...editForm, domain_match: e.target.value })}
                className="premium-input"
                placeholder="Ej. tienda.com"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tipo de respuesta</label>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={editForm.response_type === 'json'}
                    onChange={() => setEditForm({ ...editForm, response_type: 'json' })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>JSON</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={editForm.response_type === 'html'}
                    onChange={() => setEditForm({ ...editForm, response_type: 'html' })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>HTML</span>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                Activo
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editForm.is_default}
                  onChange={(e) => setEditForm({ ...editForm, is_default: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                Por defecto
              </label>
            </div>
          </div>

          {editForm.response_type === 'json' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.05)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ruta nombre</label>
                <input
                  value={editForm.json_name_path}
                  onChange={(e) => setEditForm({ ...editForm, json_name_path: e.target.value })}
                  className="premium-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ruta precio</label>
                <input
                  value={editForm.json_price_path}
                  onChange={(e) => setEditForm({ ...editForm, json_price_path: e.target.value })}
                  className="premium-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ruta imagen</label>
                <input
                  value={editForm.json_image_path}
                  onChange={(e) => setEditForm({ ...editForm, json_image_path: e.target.value })}
                  className="premium-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ruta descripción</label>
                <input
                  value={editForm.json_description_path}
                  onChange={(e) => setEditForm({ ...editForm, json_description_path: e.target.value })}
                  className="premium-input"
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.05)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selector nombre</label>
                <input
                  value={editForm.html_name_selector}
                  onChange={(e) => setEditForm({ ...editForm, html_name_selector: e.target.value })}
                  className="premium-input"
                  placeholder="Ej. .product-title"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selector precio</label>
                <input
                  value={editForm.html_price_selector}
                  onChange={(e) => setEditForm({ ...editForm, html_price_selector: e.target.value })}
                  className="premium-input"
                  placeholder="Ej. .product-price"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selector imagen</label>
                <input
                  value={editForm.html_image_selector}
                  onChange={(e) => setEditForm({ ...editForm, html_image_selector: e.target.value })}
                  className="premium-input"
                  placeholder="Ej. .product-image img"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Atributo imagen</label>
                <input
                  value={editForm.html_image_attribute}
                  onChange={(e) => setEditForm({ ...editForm, html_image_attribute: e.target.value })}
                  className="premium-input"
                  placeholder="src o style"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selector descripción</label>
                <input
                  value={editForm.html_description_selector}
                  onChange={(e) => setEditForm({ ...editForm, html_description_selector: e.target.value })}
                  className="premium-input"
                  placeholder="Ej. .product-description"
                />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>URL de prueba</label>
                <input
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="premium-input"
                  placeholder="https://www.tutienda.com/producto/123"
                />
              </div>
              <button
                type="button"
                className="btn-premium btn-secondary"
                onClick={runTestConnector}
                disabled={testLoading || !testUrl.trim()}
                style={{ padding: '10px 18px' }}
              >
                {testLoading ? 'Probando...' : 'Probar conector'}
              </button>
            </div>

            {testError && (
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(220, 38, 38, 0.12)', color: 'var(--danger-color)' }}>
                {testError}
              </div>
            )}

            {testResult && (
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px' }}>
                  <div>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Resultado de prueba</p>
                    <p style={{ margin: 0 }}><strong>Nombre:</strong> {testResult.data?.name || 'No extraído'}</p>
                    <p style={{ margin: 0 }}><strong>Precio:</strong> {testResult.data?.price != null ? `\$${testResult.data.price}` : 'No extraído'}</p>
                    <p style={{ margin: 0 }}><strong>Tienda:</strong> {testResult.data?.store_name || 'No extraído'}</p>
                  </div>
                  {testResult.data?.image_url && (
                    <div style={{ minWidth: '120px', minHeight: '120px', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                      <img src={testResult.data.image_url} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'end', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => { setEditingId(null); setIsAdding(false); setEditForm(null); setTestUrl(''); setTestResult(null); setTestError(null); }}
                className="btn-premium btn-secondary"
              >
                Cancelar
              </button>
              <button type="submit" className="btn-premium btn-primary">Guardar Conector</button>
            </div>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {connectors.length === 0 && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '60px', borderStyle: 'dashed' }}>
            <Globe size={48} style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No hay conectores configurados.</p>
          </div>
        )}

        {connectors.map((connector) => (
          <div key={connector.id} className="glass-panel animate-fade-in" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', borderRadius: '50%', background: connector.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139,148,158,0.1)', color: connector.is_active ? 'var(--success-color)' : 'var(--text-muted)' }}>
                <Link size={28} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h4 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {connector.name}
                  {connector.is_default && <span style={{ fontSize: '0.7rem', background: 'var(--primary-glow)', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--primary-color)' }}>POR DEFECTO</span>}
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Dominio: {connector.domain_match || 'Cualquiera'} • Tipo: {connector.response_type.toUpperCase()}
                </p>
                {connector.response_type === 'json' ? (
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Nombre: {connector.json_name_path || '—'} · Precio: {connector.json_price_path || '—'} · Imagen: {connector.json_image_path || '—'}</p>
                ) : (
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Nombre: {connector.html_name_selector || '—'} · Precio: {connector.html_price_selector || '—'} · Imagen: {connector.html_image_selector || '—'}</p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-premium btn-secondary" style={{ padding: '10px' }} onClick={() => startEdit(connector)}>
                <Edit2 size={20} />
              </button>
              <button type="button" className="btn-premium btn-danger" style={{ padding: '10px' }} onClick={() => handleDelete(connector.id)}>
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StoreConnectorAdmin;
