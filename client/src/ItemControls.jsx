import React from 'react';
import { sound } from './sound';
import { itemStock } from './items';

// Daftar item yang dimiliki pemain beserta progresnya (mis. 2/3 injakan menuju Force Return gratis)
export function InventoryChips({ catalog, player }) {
  return (
    <div className="game-inventory-chips">
      {catalog.map(item => {
        const stock = itemStock(player, item.id);
        return (
          <div
            key={item.id}
            className={`inv-chip ${stock.count ? 'has-item' : 'zero-item'}`}
            title={item.highlight || item.description}
          >
            <span className="inv-chip-emoji">{item.icon}</span>
            <div className="inv-chip-details">
              <span className="inv-chip-label">{item.name}</span>
              <strong className="inv-chip-qty">
                {stock.count} buah
                {stock.earned > 0 && <span className="inv-stomp-tag"> (+{stock.earned} gratis)</span>}
                {stock.progress && (
                  <span className="inv-stomp-tag">
                    {' '}({stock.progress.value}/{stock.progress.max})
                  </span>
                )}
              </strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Tombol item aktif (mis. Force Return) yang bisa dipakai di giliran sendiri sebelum melempar dadu
export function ActiveItemActions({ catalog, player, enabled, targetingItemId, onToggleTarget, onUse }) {
  if (!enabled) return null;
  const usable = catalog.filter(item => item.kind === 'active' && itemStock(player, item.id).count > 0);

  return usable.map(item => {
    const stock = itemStock(player, item.id);
    const isTargeting = targetingItemId === item.id;
    return (
      <div key={item.id} className="skill-control-banner force-return-control-banner">
        <div className="skill-banner-head">
          <span className="skill-bolt-anim">{item.icon}</span>
          <div className="skill-banner-text">
            <strong>{item.icon} {item.name.toUpperCase()} SIAP DIPAKAI!</strong>
            <small>
              Tersisa <strong>{stock.count}</strong>x
              {stock.earned > 0 ? ` (${stock.earned} gratis dari pertandingan ini)` : ''}
            </small>
          </div>
        </div>

        <div className="skill-banner-actions">
          <button
            type="button"
            className={`btn-use-skill btn-force-active ${isTargeting ? 'targeting-active' : ''}`}
            onClick={() => {
              sound.playClick();
              if (item.target) onToggleTarget(isTargeting ? null : item.id);
              else onUse(item.id, null);
            }}
          >
            {isTargeting ? '❌ Batal Pilih Target' : `${item.icon} Gunakan ${item.name}`}
          </button>
        </div>

        {isTargeting && (
          <div className="skill-target-help">
            🎯 <em>Klik bidak lawan manapun di arena untuk memakai {item.name}!</em>
          </div>
        )}
      </div>
    );
  });
}
