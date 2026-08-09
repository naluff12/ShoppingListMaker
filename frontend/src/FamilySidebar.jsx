import React, { useState } from 'react';
import { MessageCircle, Users, Activity, X } from 'lucide-react';
import ChatPanel from './ChatPanel';
import MemberPresencePanel from './MemberPresencePanel';
import ActivityFeedPanel from './ActivityFeedPanel';
import './FamilySidebar.css';

// Panel lateral de la familia con tabs: Chat / Miembros / Actividad.
// Controlado por el padre: show + onClose.
function FamilySidebar({ show, onClose, familyId, lastMessage, sendJson, isConnected, privateChatRecipient, setPrivateChatRecipient, handleJoinActivity, recentEvents }) {
  const [tab, setTab] = useState('chat');

  // Al elegir un chat privado desde cualquier tab, salta al tab de chat.
  const openPrivateChat = (member) => {
    setPrivateChatRecipient(member);
    setTab('chat');
  };

  if (!show) return null;

  return (
    <div className="sidebar-overlay" onClick={onClose}>
      <div className="sidebar-content" onClick={e => e.stopPropagation()}>
        <div className="sidebar-header">
          <h3>Familia</h3>
          <button className="modal-close sidebar-close-btn" onClick={onClose} aria-label="Cerrar chat"><X size={22} /></button>
        </div>

        <div className="sidebar-tabs">
          <button className={`sidebar-tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>
            <MessageCircle size={16} /> Chat
          </button>
          <button className={`sidebar-tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>
            <Users size={16} /> Miembros
          </button>
          <button className={`sidebar-tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>
            <Activity size={16} /> Actividad
          </button>
        </div>

        <div className="sidebar-body">
          {tab === 'chat' && (
            <ChatPanel
              familyId={familyId}
              websocketMessage={lastMessage}
              sendWsEvent={sendJson}
              isConnected={isConnected}
              privateChatRecipient={privateChatRecipient}
              onSelectPrivateRecipient={openPrivateChat}
            />
          )}
          {tab === 'members' && (
            <MemberPresencePanel
              familyId={familyId}
              websocketMessage={lastMessage}
              onOpenPrivateChat={openPrivateChat}
              onJoinActivity={handleJoinActivity}
            />
          )}
          {tab === 'activity' && (
            <ActivityFeedPanel events={recentEvents} />
          )}
        </div>
      </div>
    </div>
  );
}

export default FamilySidebar;
