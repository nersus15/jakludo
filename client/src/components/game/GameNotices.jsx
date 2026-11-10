import React from 'react';

// Pengumuman penting di atas papan: efek item (Force Return, perisai)
export default function GameNotices({ itemNotice, onDismissItem }) {
  if (!itemNotice) return null;
  return (
    <div className="notices" aria-live="assertive">
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
