import React from 'react';

function quality({ isConnected, isReconnecting, ping }) {
  if (!isConnected || isReconnecting) return { level: 'offline', bars: 0, label: 'Menghubungkan ulang' };
  if (ping === null) return { level: 'checking', bars: 2, label: 'Memeriksa sinyal' };
  if (ping < 100) return { level: 'good', bars: 4, label: 'Sinyal bagus' };
  if (ping < 250) return { level: 'fair', bars: 3, label: 'Sinyal sedang' };
  return { level: 'poor', bars: 1, label: 'Sinyal lemah' };
}

// Indikator sinyal kecil untuk header (latensi ke server)
export function NetworkIndicator(props) {
  const q = quality(props);
  const pingText = props.isConnected && !props.isReconnecting && props.ping !== null ? `${props.ping} ms` : '';
  return (
    <span className={`net net--${q.level}`} title={`${q.label}${pingText ? ` (${pingText})` : ''}`}>
      <span className="net__bars" aria-hidden="true">
        {[1, 2, 3, 4].map(n => <span key={n} className={`net__bar ${n <= q.bars ? 'is-lit' : ''}`} />)}
      </span>
      <span className="net__text">{pingText || q.label}</span>
    </span>
  );
}

// Bar peringatan di atas layar saat koneksi ke server terputus
export function ReconnectBar({ isConnected, isReconnecting }) {
  if (isConnected && !isReconnecting) return null;
  return (
    <div className="reconnect-bar" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>
        <strong>Koneksi terputus.</strong> Menyambungkan ulang ke server JakLudo...
      </span>
    </div>
  );
}
