import React, { useEffect, useState } from 'react';
import { UserPlus, UserX, CheckCircle2, MessageSquare, Play } from 'lucide-react';

function formatRelativeTime(value) {
    if (!value) return 'Nunca';
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'hace unos segundos';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `hace ${days} d`;
}

function MemberPresencePanel({ familyId, websocketMessage, onOpenPrivateChat, onJoinActivity }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activities, setActivities] = useState({});

    useEffect(() => {
        if (!familyId) return;
        setLoading(true);
        fetch(`/api/families/${familyId}/members-status`)
            .then((res) => res.json())
            .then((data) => {
                setMembers(Array.isArray(data) ? data : []);
            })
            .catch((err) => {
                console.error('Error loading family members', err);
                setMembers([]);
            })
            .finally(() => setLoading(false));
    }, [familyId]);

    useEffect(() => {
        if (!familyId || !websocketMessage) return;

        if (websocketMessage.type === 'presence_update') {
            setMembers((prev) => {
                const currentMembers = Array.isArray(prev) ? prev : [];
                return currentMembers.map((member) => {
                    if (member.id === websocketMessage.user?.id) {
                        return {
                            ...member,
                            is_online: websocketMessage.action === 'connected',
                            last_seen: new Date().toISOString()
                        };
                    }
                    return member;
                });
            });
        }

        if (websocketMessage.type === 'activity_update') {
            const userId = websocketMessage.user?.id;
            if (userId) {
                setActivities((prev) => ({
                    ...prev,
                    [userId]: {
                        action: websocketMessage.action,
                        list_id: websocketMessage.list_id,
                        list_name: websocketMessage.list_name,
                        timestamp: websocketMessage.timestamp
                    }
                }));
            }
        }
    }, [websocketMessage, familyId]);

    if (!familyId) return null;

    return (
        <div className="glass-panel presence-panel" style={{ minHeight: '360px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UserPlus size={18} />
                    <div>
                        <div style={{ fontWeight: 700 }}>Miembros conectados</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Presencia, estados y acceso rápido a chat privado.</div>
                    </div>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{members.filter((m) => m.is_online).length} en línea</span>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
                {loading ? (
                    <div style={{ color: 'var(--text-secondary)' }}>Cargando miembros...</div>
                ) : members.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)' }}>No se encontraron miembros.</div>
                ) : members.map((member) => {
                    const activity = activities[member.id];
                    const label = member.is_online ? 'En línea ahora' : formatRelativeTime(member.last_seen);
                    return (
                        <div key={member.id} style={{ padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{member.nombre || member.username}</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{label}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {member.is_online ? <CheckCircle2 size={18} color="var(--success-color)" /> : <UserX size={18} color="var(--text-secondary)" />}
                                </div>
                            </div>
                            {activity && (
                                <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '14px', background: 'rgba(59, 130, 246, 0.08)' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{activity.action === 'started_shopping' ? 'Comprando ahora' : 'Actividad reciente'}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Lista: {activity.list_name || 'Sin nombre'}</div>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                    className="btn-premium btn-secondary btn-compact"
                                    type="button"
                                    style={{ flex: '1 1 auto', minWidth: '120px' }}
                                    onClick={() => onOpenPrivateChat && onOpenPrivateChat(member)}
                                >
                                    <MessageSquare size={16} /> Chat privado
                                </button>
                                {activity && activity.list_id && (
                                    <button
                                        className="btn-premium btn-success btn-compact"
                                        type="button"
                                        style={{ flex: '1 1 auto', minWidth: '120px' }}
                                        onClick={() => onJoinActivity && onJoinActivity(activity)}
                                    >
                                        <Play size={16} /> Unirse
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default MemberPresencePanel;
