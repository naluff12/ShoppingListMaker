import React from 'react';
import { Sparkles, Clock3 } from 'lucide-react';

function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ActivityFeedPanel({ events = [] }) {
    return (
        <div className="glass-panel activity-feed-panel" style={{ minHeight: '360px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sparkles size={18} />
                    <div>
                        <div style={{ fontWeight: 700 }}>Feed de actividad</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Historial en vivo de compras y coordinación.</div>
                    </div>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{events.length} eventos</span>
            </div>
            {events.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', padding: '18px 0' }}>Aún no hay actividad reciente. Mantente conectado con la familia para ver las novedades en vivo.</div>
            ) : (
                <div style={{ flex: 1, display: 'grid', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
                    {events.map((event) => (
                        <div key={event.id} className="activity-item" style={{ padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <div style={{ lineHeight: 1.4 }}>{event.text}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                    <Clock3 size={14} /> {formatTime(event.ts)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ActivityFeedPanel;
