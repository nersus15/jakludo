import React from 'react';
import Icon from './Icon';
import { sound } from '../sound';

// Notifikasi singkat yang melayang di atas layar: pemain masuk, undangan room, chat baru, dan reaksi emoji
export default function Toasts({
  error,
  memberNotice,
  roomInvite,
  chatToast,
  reactions,
  onAcceptRoomInvite,
  onDismissRoomInvite,
  onOpenChat,
  onDismissChat
}) {
  return (
    <div className="toasts" aria-live="polite">
      {error && (
        <div className="toast toast--error" role="alert">
          <span className="toast__icon" aria-hidden="true">
            <Icon name="warning" size={18} />
          </span>
          <span>{error}</span>
        </div>
      )}

      {roomInvite && (
        <div className="toast toast--invite" key={roomInvite.id} role="status">
          <div className="toast__invite-body">
            <span className="toast__icon" aria-hidden="true">
              <Icon name="dice" size={20} />
            </span>
            <span>
              <strong>{roomInvite.from?.name || 'Teman'}</strong> mengajakmu main di room{' '}
              <span className="code-text">{roomInvite.code}</span>
              {roomInvite.group?.name ? ` (${roomInvite.group.name})` : ''}
            </span>
          </div>
          <div className="toast__invite-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                sound.playClick();
                onAcceptRoomInvite?.(roomInvite.code);
              }}
            >
              Gabung
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                sound.playClick();
                onDismissRoomInvite?.();
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {memberNotice && (
        <div className="toast" key={memberNotice.id}>
          <span className="toast__icon" aria-hidden="true">{memberNotice.avatar}</span>
          <span>{memberNotice.text}</span>
        </div>
      )}

      {chatToast && (
        <div className={`toast toast--chat color-${chatToast.senderColor}`} key={chatToast.id}>
          <button
            type="button"
            className="toast__main"
            onClick={() => {
              sound.playClick();
              onOpenChat();
            }}
          >
            <span className="avatar avatar--sm" aria-hidden="true">
              {chatToast.senderName?.slice(0, 1).toUpperCase() || '?'}
            </span>
            <span className="toast__text">
              <strong className="toast__sender">{chatToast.senderName}</strong>
              <span>{chatToast.text}</span>
            </span>
          </button>
          <button type="button" className="icon-btn icon-btn--plain" aria-label="Tutup notifikasi chat" onClick={onDismissChat}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}

      {reactions.length > 0 && (
        <div className="reactions">
          {reactions.map(r => (
            <span key={r.id} className={`reaction color-${r.color}`}>
              <span className="reaction__emoji" aria-hidden="true">{r.emoji}</span>
              <span className="reaction__name">{r.playerName}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
