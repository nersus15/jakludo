import React from 'react';
import Icon from './components/Icon';
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
            <span className="inventory__icon" aria-hidden="true">
              <Icon name={item.icon || item.id} size={20} />
            </span>
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
export function ActiveItemActions({ catalog, player, enabled, targetingItemId, onToggleTarget, onUse }) {
  if (!enabled) return null;
  const usable = catalog.filter(item => item.kind === 'active' && itemStock(player, item.id).count > 0);

  return usable.map(item => {
    const stock = itemStock(player, item.id);
    const isTargeting = targetingItemId === item.id;
    // Alasan dari server (canUse item), mis. belum ada bidakmu di luar markas
    const blocked = stock.blocked;
    return (
      <section key={item.id} className="action-card card" aria-label={item.name}>
        <div className="action-card__head">
          <span className="action-card__icon" aria-hidden="true">
            <Icon name={item.icon || item.id} size={22} />
          </span>
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
            disabled={!!blocked}
            onClick={() => {
              sound.playClick();
              if (item.target) onToggleTarget(isTargeting ? null : item.id);
              else onUse(item.id, null);
            }}
          >
            {isTargeting ? 'Batal pilih target' : `Pakai ${item.name}`}
          </button>
        </div>
        {blocked && <p className="action-card__hint">Belum bisa dipakai: {blocked}</p>}
        {isTargeting && !blocked && <p className="action-card__hint">Ketuk bidak lawan di lintasan untuk memakai {item.name}.</p>}
      </section>
    );
  });
}
