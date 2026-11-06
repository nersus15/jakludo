import React, { useEffect, useState } from 'react';
import { sound } from './sound';

export default function LeaderboardModal({ isOpen, onClose, currentUser, socket }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [ludoKing, setLudoKing] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (data.success) {
        setLeaderboard(data.leaderboard || []);
        setLudoKing(data.ludoKing || null);
      }
    } catch (err) {
      console.error('Fetch leaderboard failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = updatedList => {
      setLeaderboard(updatedList || []);
      setLudoKing(updatedList?.[0]?.isLudoKing ? updatedList[0] : null);
    };

    socket.on('leaderboard:update', handleUpdate);
    return () => {
      socket.off('leaderboard:update', handleUpdate);
    };
  }, [socket]);

  if (!isOpen) return null;

  const top3 = leaderboard.slice(0, 3);
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];
  const rest = leaderboard.slice(3);

  const myEntry = currentUser
    ? leaderboard.find(
        p =>
          (currentUser.id && p.userId === currentUser.id) ||
          p.username?.toLowerCase() === currentUser.username?.toLowerCase()
      )
    : null;

  return (
    <div className="leaderboard-modal-overlay" onClick={onClose}>
      <div className="leaderboard-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="lb-header">
          <div className="lb-title-group">
            <span className="lb-crown-icon">👑</span>
            <div>
              <h2>JakLudo Leaderboard</h2>
              <p>Peringkat pemain terbaik & takhta juara <strong>LUDO KING</strong></p>
            </div>
          </div>
          <button type="button" className="lb-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Podium Top 3 */}
        {leaderboard.length > 0 && (
          <div className="lb-podium-container">
            {/* 2nd Place */}
            {second && (
              <div className="podium-col rank-2">
                <div className="podium-avatar silver-avatar">
                  {second.avatar?.startsWith('http') ? (
                    <img src={second.avatar} alt={second.name} />
                  ) : (
                    <span>{second.avatar || '🥈'}</span>
                  )}
                  <span className="podium-medal">🥈</span>
                </div>
                <strong className="podium-name">{second.name}</strong>
                <small className="podium-handle">@{second.username}</small>
                <div className="podium-stat-pill">
                  <span>🏆 {second.wins} Menang</span>
                  <span>{second.points} Poin</span>
                </div>
                <div className="podium-pedestal pedestal-2">
                  <span className="pedestal-rank">#2</span>
                </div>
              </div>
            )}

            {/* 1st Place - THE LUDO KING */}
            {first && (
              <div className="podium-col rank-1">
                <div className="ludo-king-crown-halo">
                  <span className="animated-crown">👑</span>
                  <div className="ludo-king-badge">LUDO KING</div>
                </div>
                <div className="podium-avatar gold-avatar king-aura">
                  {first.avatar?.startsWith('http') ? (
                    <img src={first.avatar} alt={first.name} />
                  ) : (
                    <span>{first.avatar || '👑'}</span>
                  )}
                  <span className="podium-medal gold-medal">🥇</span>
                </div>
                <strong className="podium-name king-name">{first.name}</strong>
                <small className="podium-handle king-handle">@{first.username}</small>
                <div className="podium-stat-pill king-stat-pill">
                  <span>🏆 {first.wins} Menang</span>
                  <span>⚡ {first.points} Poin</span>
                </div>
                <div className="podium-pedestal pedestal-1">
                  <span className="pedestal-rank king-pedestal-rank">#1 JUARA</span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {third && (
              <div className="podium-col rank-3">
                <div className="podium-avatar bronze-avatar">
                  {third.avatar?.startsWith('http') ? (
                    <img src={third.avatar} alt={third.name} />
                  ) : (
                    <span>{third.avatar || '🥉'}</span>
                  )}
                  <span className="podium-medal">🥉</span>
                </div>
                <strong className="podium-name">{third.name}</strong>
                <small className="podium-handle">@{third.username}</small>
                <div className="podium-stat-pill">
                  <span>🏆 {third.wins} Menang</span>
                  <span>{third.points} Poin</span>
                </div>
                <div className="podium-pedestal pedestal-3">
                  <span className="pedestal-rank">#3</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full Rankings Table / List */}
        <div className="lb-table-wrapper">
          <div className="lb-table-header">
            <span>RANK & PEMAIN</span>
            <span className="text-center lb-col-status-header">STATUS</span>
            <span className="text-right">MENANG</span>
            <span className="text-right lb-col-rate-header">WIN RATE</span>
            <span className="text-right">POIN</span>
          </div>

          <div className="lb-rows-list">
            {leaderboard.map(player => {
              const isMe =
                currentUser &&
                ((currentUser.id && player.userId === currentUser.id) ||
                  player.username?.toLowerCase() === currentUser.username?.toLowerCase());

              return (
                <div
                  key={player.userId || player.username}
                  className={`lb-row ${player.isLudoKing ? 'row-king' : ''} ${isMe ? 'row-me' : ''}`}
                >
                  <div className="lb-col-player">
                    <span className={`lb-rank-badge rank-${player.rank}`}>
                      {player.rank === 1 ? '👑 #1' : `#${player.rank}`}
                    </span>
                    <div className="lb-player-avatar">
                      {player.avatar?.startsWith('http') ? (
                        <img src={player.avatar} alt={player.name} />
                      ) : (
                        <span>{player.avatar || '🎲'}</span>
                      )}
                    </div>
                    <div className="lb-player-info">
                      <strong className="lb-player-name">
                        <span className="player-display-name">{player.name}</span>
                        {isMe && <span className="lb-badge-you">KAMU</span>}
                        {player.isLudoKing && <span className="lb-mobile-king-badge">👑 LUDO KING</span>}
                      </strong>
                      <small className="lb-player-handle">
                        @{player.username}
                        <span className="lb-mobile-rate-sub"> · WR {player.winRate}%</span>
                      </small>
                    </div>
                  </div>

                  <div className="lb-col-status text-center">
                    {player.isLudoKing ? (
                      <span className="status-king-pill">👑 LUDO KING</span>
                    ) : player.rank <= 3 ? (
                      <span className="status-elite-pill">TOP 3</span>
                    ) : (
                      <span className="status-player-pill">PEMAIN</span>
                    )}
                  </div>

                  <div className="lb-col-wins text-right">
                    <strong>{player.wins}</strong>
                    <small className="lb-played-count"> / {player.matchesPlayed}</small>
                  </div>

                  <div className="lb-col-rate text-right">
                    <span className="rate-pill">{player.winRate}%</span>
                  </div>

                  <div className="lb-col-points text-right">
                    <strong className="points-val">{player.points}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* My Position Sticky Footer */}
        {currentUser && (
          <div className="lb-my-status-bar">
            <div className="my-status-left">
              <span className="my-avatar">{currentUser.avatar || '🎯'}</span>
              <div>
                <strong>Status Akun Kamu: @{currentUser.username}</strong>
                <small>
                  {myEntry
                    ? `Peringkat #${myEntry.rank} · ${myEntry.wins} Kemenangan · ${myEntry.points} Poin`
                    : 'Belum bertanding di JakLudo Arena'}
                </small>
              </div>
            </div>
            <div className="my-status-right">
              {myEntry?.isLudoKing ? (
                <span className="badge-my-king">👑 Kamu Sang Ludo King!</span>
              ) : first && myEntry ? (
                <span className="badge-points-gap">
                  Selisih {first.points - myEntry.points} poin dari Ludo King
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

