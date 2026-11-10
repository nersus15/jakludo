import React from 'react';
import { isAvatarUrl } from '../../social/media';

// Status semua pemain (posisi bidak, koneksi) dan log permainan
export default function Scoreboard({ room, playerId, currentTurnPlayer }) {
  return (
    <div className="scoreboard">
      <ul className="scoreboard__players">
        {room.players.map(p => {
          const pawns = room.pawns?.[p.id] || [0, 0, 0, 0];
          const home = pawns.filter(v => v === 0).length;
          const track = pawns.filter(v => v > 0 && v < 44).length;
          const done = pawns.filter(v => v === 44).length;
          const offline = !p.isBot && p.connected === false;
          return (
            <li key={p.id} className={`score-row color-${p.color} ${currentTurnPlayer?.id === p.id ? 'is-current' : ''} ${p.isOut ? 'is-out' : ''}`}>
              {isAvatarUrl(p.avatar) ? (
                <img src={p.avatar} alt="" width="36" height="36" className="avatar avatar--img" />
              ) : (
                <span className="avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
              )}
              <span className="score-row__name">
                <strong>{p.name}</strong>
                <span className="score-row__tags">
                  {p.id === playerId && <span className="badge">Kamu</span>}
                  {p.isBot && <span className="badge">Bot</span>}
                  {p.isLudoKing && <span className="badge badge--warning">👑 King</span>}
                  {p.isOut && <span className="badge badge--danger">Out</span>}
                  {!p.isOut && offline && <span className="badge badge--danger">Terputus</span>}
                  {!p.isOut && p.autoPlayCount > 0 && <span className="badge badge--info">Auto {p.autoPlayCount}/3</span>}
                </span>
              </span>
              <span className="score-row__pawns" aria-label={`${home} di markas, ${track} di lintasan, ${done} finish`}>
                <span title="Di markas">🏠 {home}</span>
                <span title="Di lintasan">🏃 {track}</span>
                <strong title="Finish">★ {done}/4</strong>
              </span>
            </li>
          );
        })}
      </ul>

      <h3 className="scoreboard__log-title">Log permainan</h3>
      <ol className="scoreboard__log">
        {(room.history || []).map(h => (
          <li key={h.id}>
            <span className="muted">{h.time}</span> {h.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
