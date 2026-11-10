import React from 'react';
import { sound } from './sound';
import { itemStock } from './items';

// Daftar item yang dimiliki pemain
export function InventoryChips({ catalog, player }) {
  if (catalog.length === 0) return <p className="muted">Memuat item...</p>;
  return (
    <ul className="inventory">
      {catalog.map(item => {
        const stock = itemStock(player, item.id);
        return (
          <li key={item.id} className={`inventory__item ${stock.count ? 'has-stock' : ''}`} title={item.highlight || item.description}>
            <span className="inventory__icon" aria-hidden="true">{item.icon}</span>
            <span className="inventory__text">
              <strong>{item.name}</strong>
              <span className="muted">
                {stock.count} dimiliki
                {stock.earned > 0 ? ` (${stock.earned} gratis)` : ''}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Tombol item aktif (mis. Force Return) yang bisa dipakai di giliran sendiri sebelum melempar dadu
// Ada bidak lawan di lintasan (bukan di markas / jalur finish) yang bisa jadi target
function hasOpponentPawnOnTrack(room, playerId) {
  return room.players.some(p => p.id !== playerId && (room.pawns[p.id] || []).some(v => v >= 1 && v <= 39));
}

export function ActiveItemActions({ catalog, room, player, enabled, targetingItemId, onToggleTarget, onUse }) {
  if (!enabled) return null;
  const usable = catalog.filter(item => item.kind === 'active' && itemStock(player, item.id).count > 0);

  return usable.map(item => {
    const stock = itemStock(player, item.id);
    const isTargeting = targetingItemId === item.id;
    const noTarget = item.target === 'opponentPawn' && !hasOpponentPawnOnTrack(room, player?.id);
    return (
      <section key={item.id} className="action-card card" aria-label={item.name}>
        <div className="action-card__head">
          <span className="action-card__icon" aria-hidden="true">{item.icon}</span>
          <div>
            <strong>{item.name} siap dipakai</strong>
            <p className="muted">
              Tersisa {stock.count}x{stock.earned > 0 ? `, ${stock.earned} gratis dari pertandingan ini` : ''}.
            </p>
          </div>
        </div>
        <div className="action-card__buttons">
          <button
            type="button"
            className="btn btn--primary"
            aria-pressed={item.target ? isTargeting : undefined}
            disabled={noTarget}
            onClick={() => {
              sound.playClick();
              if (item.target) onToggleTarget(isTargeting ? null : item.id);
              else onUse(item.id, null);
            }}
          >
            {isTargeting ? 'Batal pilih target' : `Pakai ${item.name}`}
          </button>
        </div>
        {noTarget && <p className="action-card__hint">Belum bisa dipakai: tidak ada bidak lawan di luar markas.</p>}
        {isTargeting && !noTarget && <p className="action-card__hint">Ketuk bidak lawan di lintasan untuk memakai {item.name}.</p>}
      </section>
    );
  });
}
