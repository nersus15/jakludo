import React from 'react';
import Modal from '../Modal';

// Hasil pertandingan. Host bisa memulai ulang, pemain lain menunggu atau keluar.
export default function WinnerDialog({ room, me, actions }) {
  const winner = room.players.find(p => p.id === room.winner);
  return (
    <Modal
      isOpen={!!room.winner}
      size="sm"
      icon="🏆"
      title={winner?.id === me?.id ? 'Kamu menang!' : `${winner?.name || 'Pemain'} menang!`}
      subtitle="Keempat bidaknya sudah sampai di finish."
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={actions.leaveRoom}>Kembali ke beranda</button>
          {me?.isHost && (
            <button type="button" className="btn btn--primary" onClick={actions.restartGame}>Main lagi</button>
          )}
        </>
      }
    >
      {!me?.isHost && <p className="muted" role="status">Menunggu host memulai putaran baru...</p>}
      {me?.isHost && <p className="muted">Main lagi dengan pemain yang sama. Pemain yang sudah keluar tidak ikut.</p>}
    </Modal>
  );
}
