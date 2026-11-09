import React, { useCallback, useEffect, useState } from 'react';
import Modal from './components/Modal';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

function Avatar({ value, name }) {
  if (value?.startsWith('http')) return <img src={value} alt="" width="36" height="36" className="lb-avatar" />;
  return <span className="lb-avatar" aria-hidden="true">{value || name?.slice(0, 1).toUpperCase() || '?'}</span>;
}

export default function LeaderboardModal({ isOpen, onClose, currentUser, socket }) {
  const [state, setState] = useState({ status: 'idle', list: [] });

  const load = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading' }));
    try {
      const res = await fetch('/api/leaderboard');
      const data = res.ok ? await res.json() : null;
      if (!data?.success) throw new Error('bad response');
      setState({ status: 'ready', list: data.leaderboard || [] });
    } catch {
      setState(s => ({ ...s, status: 'error' }));
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  // Peringkat diperbarui realtime setiap ada pertandingan selesai
  useEffect(() => {
    if (!socket) return undefined;
    const onUpdate = list => setState({ status: 'ready', list: list || [] });
    socket.on('leaderboard:update', onUpdate);
    return () => socket.off('leaderboard:update', onUpdate);
  }, [socket]);

  const { status, list } = state;
  const king = list[0]?.isLudoKing ? list[0] : null;
  const mine = currentUser ? list.find(p => p.userId === currentUser.id) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      icon="🏆"
      title="Peringkat pemain"
      subtitle="Diurutkan dari jumlah menang, lalu poin. Pemain peringkat 1 dengan minimal satu kemenangan bergelar Ludo King."
      footer={currentUser && status === 'ready' ? (
        <p className="lb-mine">
          {mine
            ? `Posisimu: #${mine.rank} · ${mine.wins} menang dari ${mine.matchesPlayed} main · ${mine.points} poin`
            : 'Kamu belum masuk peringkat. Selesaikan satu pertandingan bersama pemain lain.'}
          {mine?.isLudoKing && <strong> Kamu Ludo King saat ini 👑</strong>}
        </p>
      ) : null}
    >
      {status === 'loading' && list.length === 0 && (
        <p className="state-msg" role="status"><span className="spinner" aria-hidden="true" /> Memuat peringkat...</p>
      )}

      {status === 'error' && (
        <div className="state-msg" role="alert">
          <p>Peringkat gagal dimuat. Periksa koneksimu lalu coba lagi.</p>
          <button type="button" className="btn btn--secondary" onClick={load}>Coba lagi</button>
        </div>
      )}

      {status === 'ready' && list.length === 0 && (
        <p className="state-msg">Belum ada pemain di peringkat. Jadilah yang pertama menang!</p>
      )}

      {list.length > 0 && (
        <>
          {king && (
            <div className="lb-king">
              <span className="lb-king__crown" aria-hidden="true">👑</span>
              <div>
                <p className="muted">Ludo King saat ini</p>
                <strong>{king.name}</strong> <span className="muted">@{king.username}</span>
              </div>
            </div>
          )}
          <ol className="lb-list">
            {list.map(p => {
              const isMe = currentUser && p.userId === currentUser.id;
              return (
                <li key={p.userId} className={`lb-row ${isMe ? 'is-me' : ''} ${p.rank <= 3 ? 'is-top' : ''}`}>
                  <span className="lb-row__rank">{MEDALS[p.rank] || `#${p.rank}`}</span>
                  <Avatar value={p.avatar} name={p.name} />
                  <span className="lb-row__who">
                    <strong>
                      {p.name} {isMe && <span className="badge">Kamu</span>}
                    </strong>
                    <span className="muted">@{p.username} · menang {p.winRate}%</span>
                  </span>
                  <span className="lb-row__stats">
                    <strong>{p.wins}</strong> <span className="muted">menang</span>
                    <span className="lb-row__points">{p.points} poin</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Modal>
  );
}
