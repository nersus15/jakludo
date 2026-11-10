import React from 'react';
import Modal from '../Modal';

const FINISH = 44;
const MEDALS = ['🥇', '🥈', '🥉'];

// Peringkat akhir: bidak finish terbanyak di atas. Jika seri: pemenang, pemain yang masih aktif,
// lalu yang bidaknya sudah berjalan paling jauh.
function rankPlayers(room) {
  return room.players
    .map(p => {
      const pawns = room.pawns?.[p.id] || [0, 0, 0, 0];
      return {
        player: p,
        finished: pawns.filter(v => v === FINISH).length,
        progress: pawns.reduce((sum, v) => sum + v, 0)
      };
    })
    .sort((a, b) =>
      b.finished - a.finished ||
      (b.player.id === room.winner) - (a.player.id === room.winner) ||
      (!!a.player.isOut) - (!!b.player.isOut) ||
      b.progress - a.progress
    );
}

// Hasil pertandingan. Host bisa memulai ulang, pemain lain menunggu atau keluar.
export default function WinnerDialog({ room, me, actions }) {
  const winner = room.players.find(p => p.id === room.winner);
  const ranking = room.winner ? rankPlayers(room) : [];
  return (
    <Modal
      isOpen={!!room.winner}
      size="sm"
      icon="🏆"
      title={winner?.id === me?.id ? 'Kamu menang!' : `${winner?.name || 'Pemain'} menang!`}
      subtitle="Peringkat berdasarkan jumlah bidak yang masuk finish."
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={actions.leaveRoom}>Kembali ke beranda</button>
          {me?.isHost && (
            <button type="button" className="btn btn--primary" onClick={actions.restartGame}>Main lagi</button>
          )}
        </>
      }
    >
      <ol className="final-ranking" aria-label="Peringkat akhir pemain">
        {ranking.map(({ player, finished }, idx) => (
          <li key={player.id} className={`final-ranking__row color-${player.color} ${player.id === me?.id ? 'is-me' : ''}`}>
            <span className="final-ranking__pos" aria-label={`Peringkat ${idx + 1}`}>{MEDALS[idx] || idx + 1}</span>
            <span className="avatar" aria-hidden="true">{player.name.slice(0, 1).toUpperCase()}</span>
            <span className="final-ranking__name">
              <strong>{player.name}</strong>
              <span className="score-row__tags">
                {player.id === me?.id && <span className="badge">Kamu</span>}
                {player.id === room.winner && <span className="badge badge--warning">Pemenang</span>}
                {player.isBot && <span className="badge">Bot</span>}
                {player.isOut && <span className="badge badge--danger">Out</span>}
              </span>
            </span>
            <strong className="final-ranking__score" title="Bidak masuk finish">★ {finished}/4</strong>
          </li>
        ))}
      </ol>
      {!me?.isHost && <p className="muted" role="status">Menunggu host memulai putaran baru...</p>}
      {me?.isHost && <p className="muted">Main lagi dengan pemain yang sama. Pemain yang sudah keluar tidak ikut.</p>}
    </Modal>
  );
}
