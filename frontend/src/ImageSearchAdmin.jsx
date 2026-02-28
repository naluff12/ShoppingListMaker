import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Edit2, Check, X, Shield, Globe, Code, Settings, Activity } from 'lucide-react';

const ImageSearchAdmin = ({ apiBaseUrl }) => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const initialFormState = {
    name: '',
    base_url: '',
    params_config: JSON.stringify([
      { key: 'q', value: '{{q}}' },
      { key: 'page', value: '{{page}}' },
      { key: 'limit', value: '{{limit}}' }
    ]),
    results_per_page: 20,
    response_type: 'json',
    json_list_path: '',
    json_preview_path: '',
    json_large_path: '',
    image_selector: '',
    image_attribute: 'src',
    is_active: true,
    is_default: false
  };

  const [dynamicParams, setDynamicParams] = useState([]);
  const [debugResult, setDebugResult] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [testQuery, setTestQuery] = useState('tomate');

  const runDebugTest = async () => {
    try {
      setDebugLoading(true);
      setDebugResult(null);
      const response = await fetch(`${apiBaseUrl}/admin/image-search-configs/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          base_url: editForm.base_url,
          params_config: JSON.stringify(dynamicParams),
          q: testQuery,
          response_type: editForm.response_type,
          json_list_path: editForm.json_list_path,
          json_preview_path: editForm.json_preview_path,
          json_large_path: editForm.json_large_path,
          image_selector: editForm.image_selector,
          image_attribute: editForm.image_attribute
        })
      });
      const data = await response.json();
      setDebugResult(data);
    } catch (err) {
      setDebugResult({ error: err.message });
    } finally {
      setDebugLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  useEffect(() => {
    if (editForm && editForm.params_config) {
      try {
        setDynamicParams(JSON.parse(editForm.params_config));
      } catch (e) {
        setDynamicParams([]);
      }
    } else if (editForm) {
      setDynamicParams([]);
    }
  }, [editingId, isAdding]);

  const addParam = () => {
    setDynamicParams([...dynamicParams, { key: '', value: '' }]);
  };

  const removeParam = (index) => {
    const newParams = [...dynamicParams];
    newParams.splice(index, 1);
    setDynamicParams(newParams);
  };

  const updateParam = (index, field, value) => {
    const newParams = [...dynamicParams];
    newParams[index][field] = value;
    setDynamicParams(newParams);
  };

  const getPreviewUrl = () => {
    if (!editForm) return '';
    try {
      let baseUrl = editForm.base_url || 'https://api.example.com/search';
      const params = new URLSearchParams();
      const limit = editForm.results_per_page || 20;
      const context = {
        page: 1,
        limit: limit,
        start: 0,
        offset: 0,
        end: limit
      };

      const processStringWithVars = (val) => {
          if (!val) return '';
          let replaced = val.replace(/\{\{q\}\}/g, 'tomate');
          replaced = replaced.replace(/\{\{(.*?)\}\}/g, (match, expr) => {
            let replacedExpr = expr.trim();
            Object.keys(context).forEach(key => {
              replacedExpr = replacedExpr.replace(new RegExp(key, 'g'), context[key]);
            });
            if (/^[\d\s\+\-\*\/\(\)]+$/.test(replacedExpr)) {
              try {
                // eslint-disable-next-line no-eval
                return eval(replacedExpr).toString();
              } catch (e) { return match; }
            }
            return match;
          });
          return replaced;
      }
      
      baseUrl = processStringWithVars(baseUrl);

      dynamicParams.forEach(p => {
        if (p.key) {
          const val = processStringWithVars(p.value);
          params.append(p.key, val);
        }
      });
      return `${baseUrl}${params.toString() ? (baseUrl.includes('?') ? '&' : '?') + params.toString() : ''}`;
    } catch (e) {
      return 'Error en la URL';
    }
  };

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/admin/image-search-configs`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Error al cargar configuraciones');
      const data = await response.json();
      setConfigs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const isUpdate = editingId !== null;
    const url = isUpdate 
      ? `${apiBaseUrl}/admin/image-search-configs/${editingId}`
      : `${apiBaseUrl}/admin/image-search-configs`;
    
    const finalForm = {
      ...editForm,
      params_config: JSON.stringify(dynamicParams)
    };

    try {
      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(finalForm)
      });

      if (!response.ok) throw new Error('Error al guardar configuración');
      
      await fetchConfigs();
      setEditingId(null);
      setIsAdding(false);
      setEditForm(null);
      setDynamicParams([]);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este buscador?')) return;
    
    try {
      const response = await fetch(`${apiBaseUrl}/admin/image-search-configs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Error al eliminar');
      fetchConfigs();
    } catch (err) {
      alert(err.message);
    }
  };

  const startEdit = (config) => {
    setEditingId(config.id);
    setEditForm({ ...config });
    setIsAdding(false);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setEditForm({ ...initialFormState });
  };

  if (loading) return <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Settings className="text-gradient" />
          Buscadores de Imágenes
        </h2>
        {!isAdding && !editingId && (
          <button 
            onClick={startAdd}
            className="btn-premium btn-primary"
          >
            <Plus size={20} /> Nuevo Buscador
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <form onSubmit={handleSave} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>
            {isAdding ? 'Agregar Nuevo Buscador' : 'Editar Buscador'}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nombre</label>
              <input 
                value={editForm.name}
                onChange={e => setEditForm({...editForm, name: e.target.value})}
                required
                className="premium-input"
                placeholder="Ej. Pixabay, Google Mock"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Base URL (Acepta variables)</label>
              <input 
                value={editForm.base_url}
                onChange={e => setEditForm({...editForm, base_url: e.target.value})}
                required
                className="premium-input"
                placeholder="https://api.ejemplo.com/buscar/{{q}}"
              />
            </div>
          </div>

          <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '16px', borderRadius: 'var(--border-radius-md)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={16} /> Parámetros de Consulta (GET)
                </h4>
                <button 
                    type="button" 
                    onClick={addParam}
                    className="btn-premium btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                >
                    <Plus size={14} /> Añadir Parámetro
                </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {dynamicParams.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input 
                            placeholder="Llave (ej. q)"
                            value={p.key}
                            onChange={(e) => updateParam(idx, 'key', e.target.value)}
                            className="premium-input"
                            style={{ flex: 1, padding: '8px 12px' }}
                        />
                        <input 
                            placeholder="Valor (ej. {{q}})"
                            value={p.value}
                            onChange={(e) => updateParam(idx, 'value', e.target.value)}
                            className="premium-input"
                            style={{ flex: 2, padding: '8px 12px' }}
                        />
                        <button 
                            type="button" 
                            onClick={() => removeParam(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '5px' }}
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
                {dynamicParams.length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>No hay parámetros definidos.</p>
                )}
            </div>

            <div style={{ marginTop: '10px', padding: '15px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} /> Guía de Expresiones y Variables
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div>
                        <p style={{ marginBottom: '4px' }}><b>Variables (En Base URL o Params):</b></p>
                        <ul style={{ paddingLeft: '15px', margin: 0 }}>
                            <li><code>{"{{q}}"}</code>: Término de búsqueda.</li>
                            <li><code>{"{{page}}"}</code>: Número de página (1, 2, ...).</li>
                            <li><code>{"{{limit}}"}</code>: Resultados por página ({editForm.results_per_page}).</li>
                            <li><code>{"{{start}}"}</code> / <code>{"{{offset}}"}</code>: Índice inicial.</li>
                        </ul>
                    </div>
                    <div>
                        <p style={{ marginBottom: '4px' }}><b>Ejemplos de fórmulas:</b></p>
                        <ul style={{ paddingLeft: '15px', margin: 0 }}>
                            <li><code>{"{{page * limit}}"}</code>: Paginación por múltiplos.</li>
                            <li><code>{"{{(page - 1) * limit}}"}</code>: Offset basado en cero.</li>
                            <li><code>{"{{page * 24}}"}</code>: Salto fijo de 24 elementos.</li>
                        </ul>
                    </div>
                </div>
                <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                    <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>URL de Ejemplo (Pág 1):</span> <code style={{ color: 'var(--text-secondary)' }}>{getPreviewUrl()}</code>
                </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Resultados por pág.</label>
              <input 
                type="number"
                value={editForm.results_per_page}
                onChange={e => setEditForm({...editForm, results_per_page: parseInt(e.target.value) || 20})}
                className="premium-input"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tipo de Respuesta</label>
                <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                    type="radio" 
                    style={{ width: '18px', height: '18px' }}
                    checked={editForm.response_type === 'json'} 
                    onChange={() => setEditForm({...editForm, response_type: 'json'})}
                    /> <span style={{ fontSize: '0.95rem' }}>JSON</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                    type="radio" 
                    style={{ width: '18px', height: '18px' }}
                    checked={editForm.response_type === 'html'} 
                    onChange={() => setEditForm({...editForm, response_type: 'html'})}
                    /> <span style={{ fontSize: '0.95rem' }}>HTML (Scraping)</span>
                </label>
                </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {editForm.response_type === 'json' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--border-radius-md)' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Ruta Lista (ej. hits)</label>
                  <input 
                    value={editForm.json_list_path || ''}
                    onChange={e => setEditForm({...editForm, json_list_path: e.target.value})}
                    className="premium-input"
                    style={{ padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Preview (ej. previewURL)</label>
                  <input 
                    value={editForm.json_preview_path || ''}
                    onChange={e => setEditForm({...editForm, json_preview_path: e.target.value})}
                    className="premium-input"
                    style={{ padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Large (ej. largeURL)</label>
                  <input 
                    value={editForm.json_large_path || ''}
                    onChange={e => setEditForm({...editForm, json_large_path: e.target.value})}
                    className="premium-input"
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--border-radius-md)' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Clase CSS (Selector)</label>
                  <input 
                    value={editForm.image_selector || ''}
                    onChange={e => setEditForm({...editForm, image_selector: e.target.value})}
                    className="premium-input"
                    style={{ padding: '8px 12px' }}
                    placeholder="Ej. .padre .hijo"
                  />
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>Soporta jerarquías (espacios)</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Atributo (ej. src o style)</label>
                  <input 
                    value={editForm.image_attribute || ''}
                    onChange={e => setEditForm({...editForm, image_attribute: e.target.value})}
                    className="premium-input"
                    style={{ padding: '8px 12px' }}
                    placeholder="src o style"
                  />
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>Si es 'style', busca 'url(...)'</p>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '24px', padding: '4px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input 
                type="checkbox"
                style={{ width: '18px', height: '18px' }}
                checked={editForm.is_active}
                onChange={e => setEditForm({...editForm, is_active: e.target.checked})}
              /> <span style={{ fontWeight: 500 }}>Activo</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input 
                type="checkbox"
                style={{ width: '18px', height: '18px' }}
                checked={editForm.is_default}
                onChange={e => setEditForm({...editForm, is_default: e.target.checked})}
              /> <span style={{ fontWeight: 500 }}>Por Defecto</span>
            </label>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} className="text-gradient" /> Depuración (Debug Mode)
              </h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  value={testQuery}
                  onChange={e => setTestQuery(e.target.value)}
                  className="premium-input"
                  style={{ width: '150px', padding: '6px 12px', fontSize: '0.85rem' }}
                  placeholder="Término prueba"
                />
                <button 
                  type="button"
                  onClick={runDebugTest}
                  disabled={debugLoading}
                  className="btn-premium btn-secondary"
                  style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                >
                  {debugLoading ? 'Probando...' : 'Ejecutar Prueba'}
                </button>
              </div>
            </div>

            {debugResult && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p><b>URL Final construida:</b> <code style={{ color: 'var(--primary-color)' }}>{debugResult.url}</code></p>
                  <p><b>Status:</b> <span style={{ color: debugResult.status === 200 ? 'var(--success-color)' : 'var(--danger-color)' }}>{debugResult.status}</span></p>
                </div>
                
                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
                    Resultados Visuales Extraídos ({debugResult.extracted_images?.length || 0}):
                  </label>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', 
                    gap: '10px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    padding: '10px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    {debugResult.extracted_images?.map((img, idx) => (
                      <div key={idx} style={{ aspectRatio: '1/1', borderRadius: '4px', overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img 
                          src={img.previewURL} 
                          alt={`Result ${idx}`} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=Error'; }}
                        />
                      </div>
                    ))}
                    {(!debugResult.extracted_images || debugResult.extracted_images.length === 0) && (
                      <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px' }}>
                        No se extrajeron imágenes. Revisa el selector/ruta.
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Respuesta Bruta ({debugResult.is_json ? 'JSON' : 'HTML'}):
                  </label>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflow: 'auto', 
                    background: '#1e1e1e', 
                    color: '#d4d4d4', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    fontFamily: 'monospace', 
                    fontSize: '0.8rem',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {debugResult.is_json 
                        ? JSON.stringify(debugResult.data, null, 2) 
                        : debugResult.data
                      }
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'end', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <button 
              type="button"
              onClick={() => { 
                setEditingId(null); 
                setIsAdding(false); 
                setEditForm(null); 
                setDebugResult(null);
              }}
              className="btn-premium btn-secondary"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="btn-premium btn-primary"
            >
              Guardar Configuración
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {configs.map(config => (
          <div key={config.id} className="glass-panel animate-fade-in" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ padding: '12px', borderRadius: '50%', background: config.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 148, 158, 0.1)', color: config.is_active ? 'var(--success-color)' : 'var(--text-muted)' }}>
                {config.response_type === 'json' ? <Code size={28} /> : <Globe size={28} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h4 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {config.name}
                  {config.is_default && <span style={{ fontSize: '0.7rem', background: 'var(--primary-glow)', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--primary-color)' }}>PRINCIPAL</span>}
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {config.base_url}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => startEdit(config)}
                className="btn-premium btn-secondary"
                style={{ padding: '10px' }}
              >
                <Edit2 size={20} />
              </button>
              <button 
                onClick={() => handleDelete(config.id)}
                className="btn-premium btn-danger"
                style={{ padding: '10px' }}
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
        {configs.length === 0 && !isAdding && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '60px', borderStyle: 'dashed' }}>
            <Search style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} size={48} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No hay buscadores configurados.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageSearchAdmin;
