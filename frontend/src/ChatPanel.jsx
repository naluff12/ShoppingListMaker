import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Send, MessageCircle, Circle, Sparkles, Zap, Lock } from 'lucide-react';

function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const quickActions = [
    'Estoy revisando la lista ahora mismo ✅',
    '¿Alguien puede chequear el pasillo de bebidas? 🥤',
    'Listo para pagar cuando terminen 🛒',
    'Voy por productos frescos, no los compren todavía 🥬'
];

function ChatPanel({ familyId, websocketMessage, sendWsEvent, isConnected, privateChatRecipient, onSelectPrivateRecipient }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [members, setMembers] = useState([]);
    const [statusEvents, setStatusEvents] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [chatMode, setChatMode] = useState('global');
    const [showQuickActions, setShowQuickActions] = useState(false);
    const typingTimeouts = useRef({});
    const endRef = useRef(null);

    useEffect(() => {
        if (!familyId) return;

        const fetchData = async () => {
            try {
                const [chatRes, membersRes, userRes] = await Promise.all([
                    fetch(`/api/families/${familyId}/chat-messages?limit=200`),
                    fetch(`/api/families/${familyId}/members-status`),
                    fetch('/api/users/me')
                ]);
                if (chatRes.ok) {
                    const chatData = await chatRes.json();
                    setMessages(Array.isArray(chatData) ? chatData : []);
                }
                if (membersRes.ok) {
                    const membersData = await membersRes.json();
                    setMembers(Array.isArray(membersData) ? membersData : []);
                }
                if (userRes.ok) {
                    const userData = await userRes.json();
                    setCurrentUser(userData);
                }
            } catch (err) {
                console.error('Error loading chat data', err);
            }
        };

        fetchData();
    }, [familyId]);

    const appendMessage = (message) => {
        setMessages((prev) => {
            if (prev.some((msg) => msg.id === message.id)) return prev;
            return [...prev, message];
        });
    };

    useEffect(() => {
        if (!websocketMessage || !familyId) return;

        if (websocketMessage.type === 'chat_message' && websocketMessage.chat_message) {
            appendMessage(websocketMessage.chat_message);
        }

        if (websocketMessage.type === 'presence_update') {
            const actor = websocketMessage.user?.nombre || websocketMessage.user?.username || 'Alguien';
            const actionLabel = websocketMessage.action === 'connected' ? 'se ha conectado' : 'se ha desconectado';
            setStatusEvents((prev) => [
                { id: `${websocketMessage.action}-${Date.now()}`, text: `${actor} ${actionLabel}`, ts: new Date().toISOString() },
                ...prev.slice(0, 9)
            ]);
            setMembers((prev) => prev.map((member) => {
                if (member.id === websocketMessage.user?.id) {
                    return {
                        ...member,
                        is_online: websocketMessage.action === 'connected',
                        last_seen: new Date().toISOString()
                    };
                }
                return member;
            }));
        }

        if (websocketMessage.type === 'typing') {
            const typingUser = websocketMessage.user?.nombre || websocketMessage.user?.username || 'Alguien';
            setTypingUsers((prev) => Array.from(new Set([typingUser, ...prev])));
            clearTimeout(typingTimeouts.current[typingUser]);
            typingTimeouts.current[typingUser] = setTimeout(() => {
                setTypingUsers((prev) => prev.filter((name) => name !== typingUser));
            }, 2500);
        }
    }, [websocketMessage, familyId]);

    useEffect(() => {
        if (endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages, chatMode]);

    const visibleMessages = useMemo(() => {
        if (chatMode === 'private' && privateChatRecipient && currentUser) {
            return messages.filter((msg) => msg.is_private && (
                (msg.user_id === currentUser.id && msg.recipient_id === privateChatRecipient.id) ||
                (msg.user_id === privateChatRecipient.id && msg.recipient_id === currentUser.id)
            ));
        }
        return messages.filter((msg) => !msg.is_private);
    }, [messages, chatMode, privateChatRecipient, currentUser]);

    const sendTypingSignal = () => {
        if (!familyId || !sendWsEvent) return;
        sendWsEvent({ type: 'typing' });
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !familyId) return;
        if (chatMode === 'private' && !privateChatRecipient) {
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(`/api/families/${familyId}/chat-messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: newMessage.trim(),
                    is_private: chatMode === 'private',
                    recipient_id: chatMode === 'private' ? privateChatRecipient?.id : null
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Error enviando mensaje');
            }
            const created = await response.json();
            appendMessage(created);
            setNewMessage('');
            if (sendWsEvent) sendWsEvent({ type: 'presence_ping' });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAction = (text) => {
        setNewMessage(text);
        setTimeout(handleSendMessage, 20);
    };

    const typingHint = useMemo(() => {
        if (!typingUsers.length) return null;
        if (typingUsers.length === 1) return `${typingUsers[0]} está escribiendo...`;
        return `${typingUsers.join(', ')} están escribiendo...`;
    }, [typingUsers]);

    const privateMembers = members.filter((member) => currentUser ? member.id !== currentUser.id : true);

    useEffect(() => {
        if (privateChatRecipient) {
            setChatMode('private');
        }
    }, [privateChatRecipient]);

    if (!familyId) return null;

    return (
        <div className="glass-panel chat-panel chat-panel-enhanced" style={{ display: 'flex', flexDirection: 'column', minHeight: '460px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <MessageCircle size={20} />
                    <div>
                        <div style={{ fontWeight: 700 }}>Chat familiar</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Global y privado, con actividad familiar.</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: isConnected ? 'var(--success-color)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <Sparkles size={16} /> {isConnected ? 'Conectado' : 'Desconectado'}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <button type="button" className={`btn-premium btn-compact ${chatMode === 'global' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setChatMode('global')}>
                    Global
                </button>
                <button type="button" className={`btn-premium btn-compact ${chatMode === 'private' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setChatMode('private')}>
                    Privado
                </button>
                {chatMode === 'private' && privateChatRecipient && (
                    <span style={{ alignSelf: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Chat privado con {privateChatRecipient.nombre || privateChatRecipient.username}
                    </span>
                )}
            </div>

            {chatMode === 'private' && (
                <>
                    <div className="chat-private-member-list" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '12px' }}>
                        {privateMembers.map((member) => (
                            <button
                                key={member.id}
                                type="button"
                                className={`btn-premium btn-compact ${privateChatRecipient?.id === member.id ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => onSelectPrivateRecipient(member)}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <Lock size={14} /> {member.nombre || member.username}
                                </span>
                            </button>
                        ))}
                    </div>
                    {!privateChatRecipient && (
                        <div style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Selecciona un miembro para iniciar el chat privado.
                        </div>
                    )}
                </>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Eventos recientes</span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '4px' }}>{statusEvents.length > 0 ? `${statusEvents.length} actividad` : 'Sin cambios recientes'}</span>
                </div>
                <button
                    type="button"
                    className="btn-premium btn-secondary btn-compact"
                    onClick={() => setShowQuickActions((value) => !value)}
                    style={{ whiteSpace: 'nowrap' }}
                >
                    <Zap size={14} /> {showQuickActions ? 'Ocultar acciones rápidas' : 'Mostrar acciones rápidas'}
                </button>
            </div>

            {showQuickActions && (
                <div className="chat-quick-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                    {quickActions.map((text) => (
                        <button key={text} type="button" className="btn-premium btn-secondary btn-compact" onClick={() => handleQuickAction(text)} style={{ padding: '8px 10px', fontSize: '0.8rem' }}>
                            <Zap size={14} /> {text}
                        </button>
                    ))}
                </div>
            )}

            <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: '12px', paddingRight: '4px' }}>
                {typingHint && (
                    <div className="typing-indicator" style={{ padding: '10px 14px', borderRadius: '16px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {typingHint}
                    </div>
                )}
                {visibleMessages.map((msg) => {
                    const isOwn = currentUser && msg.user_id === currentUser.id;
                    return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                            <div className={`message-bubble ${isOwn ? 'own' : 'incoming'} ${msg.is_private ? 'private' : ''}`} style={{ background: isOwn ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.08)', borderRadius: '24px', padding: '14px 18px', maxWidth: '100%', boxShadow: isOwn ? '0 8px 24px rgba(34,197,94,0.08)' : '0 8px 24px rgba(0,0,0,0.08)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{msg.user?.nombre || msg.user?.username || 'Usuario'}</span>
                                    {msg.is_private && <span style={{ fontSize: '0.72rem', color: 'var(--warning-color)', border: '1px solid rgba(249,115,22,0.28)', borderRadius: '999px', padding: '2px 8px' }}>Privado</span>}
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{msg.message}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <span>{formatTime(msg.created_at)}</span>
                                    {msg.is_private && msg.recipient && <span>Para {msg.recipient.nombre || msg.recipient.username}</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                        setNewMessage(e.target.value);
                        if (e.target.value.trim()) sendTypingSignal();
                    }}
                    placeholder={chatMode === 'private' ? 'Escribe un mensaje privado...' : 'Escribe un mensaje para la familia...'}
                    className="premium-input"
                    style={{ flex: 1, minWidth: '180px' }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                />
                <button className="btn-premium btn-primary" type="button" onClick={handleSendMessage} disabled={loading || !newMessage.trim() || (chatMode === 'private' && !privateChatRecipient)} style={{ padding: '10px 14px' }}>
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}

export default ChatPanel;
