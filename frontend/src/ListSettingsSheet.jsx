import React from 'react';
import { Pencil, Eye, EyeOff, Save, Layers, MessageSquare } from 'lucide-react';
import BottomSheet from './BottomSheet';
import ProgressBar from './ProgressBar';

// Panel de configuración de la lista: presupuesto, comentarios, estado y plantillas.
// Mantiene la vista principal enfocada en los items.
function ListSettingsSheet({
  show, onClose,
  listDetails, budget, budgetDetails, budgetProgress, budgetVariant,
  onEditBudget,
  blame, newListComment, setNewListComment, onListCommentSubmit,
  onToggleStatus,
  onSaveTemplate, onApplyTemplates,
}) {
  return (
    <BottomSheet show={show} onClose={onClose} title="Configuración de la lista">
      {/* Estado */}
      {listDetails && (
        <div className="settings-row">
          <div className="settings-row-label">
            <strong>Estado de la lista</strong>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {listDetails.status === 'revisada' ? 'Lista revisada y lista para comprar' : 'Lista pendiente de revisión'}
            </span>
          </div>
          <button
            className={`btn-premium ${listDetails.status === 'revisada' ? 'btn-success' : 'btn-secondary'}`}
            onClick={onToggleStatus}
            style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {listDetails.status === 'revisada' ? <><Eye size={16} /> Revisada</> : <><EyeOff size={16} /> Marcar revisada</>}
          </button>
        </div>
      )}

      {/* Presupuesto */}
      <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="settings-row-label" style={{ marginBottom: '10px' }}>
          <strong>Presupuesto</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Controla el gasto estimado de la lista</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>${budget.toFixed(2)}</span>
          <button className="btn-premium btn-secondary" style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={onEditBudget}>
            <Pencil size={15} /> Editar
          </button>
        </div>
        <ProgressBar progress={budgetProgress} variant={budgetVariant} label={`Estimado ${budgetProgress.toFixed(0)}%`} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
          <span>Total Estimado: ${budgetDetails.total_estimado?.toFixed(2)}</span>
          {budget > 0 ? (
            <span>Restante: <span style={{ fontWeight: 600, color: budgetDetails.total_estimado > budget ? 'var(--danger-color)' : 'var(--success-color)' }}>${(budget - budgetDetails.total_estimado).toFixed(2)}</span></span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Sin presupuesto definido</span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Total Comprado: <span className="badge" style={{ background: 'var(--success-color)', padding: '3px 8px' }}>${budgetDetails.total_comprado?.toFixed(2)}</span></span>
        </div>
      </div>

      {/* Plantillas */}
      <div className="settings-row">
        <div className="settings-row-label">
          <strong>Plantillas</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Reutiliza esta lista o aplica una guardada</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn-premium btn-secondary" style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={onSaveTemplate}>
            <Save size={15} /> Guardar
          </button>
          <button className="btn-premium btn-secondary" style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={onApplyTemplates}>
            <Layers size={15} /> Aplicar
          </button>
        </div>
      </div>

      {/* Comentarios */}
      <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="settings-row-label" style={{ marginBottom: '8px' }}>
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><MessageSquare size={15} /> Comentarios de la lista</strong>
        </div>
        <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
          {blame && blame.length > 0 ? (
            blame.map((b, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{b.user?.nombre || b.user?.username || 'Usuario'}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(b.created_at || b.timestamp || Date.now()).toLocaleString()}</span>
                </div>
                <span>{b.detalles || b.action || ''}</span>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '8px' }}>Sin comentarios todavía</div>
          )}
        </div>
        <form onSubmit={onListCommentSubmit} style={{ display: 'flex', gap: '8px' }}>
          <input
            className="premium-input"
            placeholder="Nuevo comentario para la lista..."
            value={newListComment}
            onChange={(e) => setNewListComment(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="submit" className="btn-premium btn-primary" style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>Comentar</button>
        </form>
      </div>
    </BottomSheet>
  );
}

export default ListSettingsSheet;
