import React from 'react';

// Pengumuman penting di atas papan: skill eliminasi terbuka dan efek item
export default function GameNotices({ skillNotice, itemNotice, onDismissSkill, onDismissItem }) {
  if (!skillNotice && !itemNotice) return null;
  return (
    <div className="notices" aria-live="assertive">
      {skillNotice && (
        <div className={`notice ${skillNotice.isMe ? 'notice--good' : 'notice--warn'}`}>
          <span className="notice__icon" aria-hidden="true">🎯</span>
          <div className="notice__text">
            <strong>{skillNotice.isMe ? 'Skill Eliminasi terbuka!' : `${skillNotice.playerName} membuka Skill Eliminasi`}</strong>
            <p>
              {skillNotice.isMe
                ? 'Tiga bidakmu sudah finish. Di giliranmu, kamu bisa memulangkan 1 bidak lawan ke markas.'
                : 'Hati-hati: satu bidakmu di lintasan bisa dipulangkan ke markas.'}
            </p>
          </div>
          <button type="button" className="icon-btn icon-btn--plain" aria-label="Tutup pengumuman" onClick={onDismissSkill}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}
      {itemNotice && (
        <div className="notice notice--item" key={itemNotice.id}>
          <span className="notice__icon" aria-hidden="true">{itemNotice.icon}</span>
          <div className="notice__text">
            <strong>{itemNotice.title}</strong>
            <p>{itemNotice.text}</p>
          </div>
          <button type="button" className="icon-btn icon-btn--plain" aria-label="Tutup pengumuman" onClick={onDismissItem}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}
    </div>
  );
}
