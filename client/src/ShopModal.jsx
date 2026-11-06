import React, { useState } from 'react';
import { sound } from './sound';

export default function ShopModal({ isOpen, onClose, currentUser, onUpdateUser, authToken }) {
  const [purchasing, setPurchasing] = useState(null);
  const [feedback, setFeedback] = useState(null);

  if (!isOpen) return null;

  const userPoints = currentUser?.points ?? 0;
  const userInventory = currentUser?.inventory || { blackholeShield: 0, forceReturn: 0 };

  const handleBuy = async (itemType, itemName, price) => {
    if (!currentUser) {
      setFeedback({ type: 'error', message: 'Silakan masuk atau daftar akun terlebih dahulu untuk berbelanja.' });
      return;
    }

    if (userPoints < price) {
      sound.playClick();
      setFeedback({ type: 'error', message: `Poin tidak mencukupi! Kamu memiliki ${userPoints} poin, dibutuhkan ${price} poin.` });
      return;
    }

    setPurchasing(itemType);
    setFeedback(null);
    sound.playClick();

    try {
      const token = authToken || localStorage.getItem('jakplayer_token') || localStorage.getItem('joybit_token');
      const res = await fetch('/api/shop/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ itemType, token })
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal melakukan pembelian item.');
      }

      // Mainkan efek audio sukses belanja
      sound.playShopPurchase();

      setFeedback({
        type: 'success',
        message: `✨ Berhasil membeli ${itemName}! Saldo tersisa: ${data.user?.points ?? (userPoints - price)} poin.`
      });

      if (onUpdateUser && data.user) {
        onUpdateUser(data.user);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan saat membeli.' });
    } finally {
      setPurchasing(null);
    }
  };

  const ITEMS = [
    {
      id: 'blackholeShield',
      name: 'Blackhole Shield',
      icon: '🛡️',
      price: 100,
      badge: 'Perisai Pasif Otomatis',
      badgeColor: '#3b82f6',
      description: 'Melindungi bidakmu dari sedotan Blackhole! Saat bidakmu melangkah ke petak Blackhole, perisai ini otomatis aktif sehingga bidakmu TIDAK tersedot kembali ke markas.',
      owned: userInventory.blackholeShield || 0,
      highlight: 'Otomatis aktif saat terkena Blackhole'
    },
    {
      id: 'forceReturn',
      name: 'Force Return',
      icon: '⚡',
      price: 100,
      badge: 'Skill Eliminasi Aktif',
      badgeColor: '#f59e0b',
      description: 'Kekuatan petir eliminasi instan! Setiap kali kamu sudah berhasil menginjak/memakan bidak lawan sebanyak 3 kali, kemampuan Force Return akan menyala. Pilih 1 bidak lawan di arena untuk langsung dipulangkan ke markas + bonus jalan lagi!',
      owned: userInventory.forceReturn || 0,
      highlight: 'Aktif saat sudah 3x menginjak bidak lawan'
    }
  ];

  return (
    <div className="shop-modal-overlay" onClick={onClose}>
      <div className="shop-modal-card" onClick={e => e.stopPropagation()}>
        <button type="button" className="shop-close-btn" onClick={onClose} title="Tutup Toko">
          ✕
        </button>

        {/* Modal Header */}
        <div className="shop-header">
          <div className="shop-header-title-row">
            <span className="shop-header-icon">🏪</span>
            <div>
              <h2>Toko Item JakLudo</h2>
              <p className="shop-header-sub">Tukarkan poin pertandinganmu dengan item berkekuatan sakti!</p>
            </div>
          </div>

          {/* User Points Badge */}
          <div className="shop-points-badge-box">
            <span className="shop-points-label">SALDO POIN</span>
            <div className="shop-points-val">
              <span className="shop-gem-icon">💎</span>
              <strong>{userPoints.toLocaleString('id-ID')}</strong>
              <span className="shop-pts-unit">PTS</span>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`shop-feedback-alert ${feedback.type}`}>
            <span>{feedback.type === 'success' ? '🎉' : '⚠️'}</span>
            <p>{feedback.message}</p>
          </div>
        )}

        {/* Item Cards List */}
        <div className="shop-items-grid">
          {ITEMS.map(item => {
            const canAfford = userPoints >= item.price;
            const isBuying = purchasing === item.id;

            return (
              <div key={item.id} className={`shop-item-card card-${item.id}`}>
                <div className="shop-item-top">
                  <div className="shop-item-icon-wrap">
                    <span className="shop-item-icon">{item.icon}</span>
                  </div>
                  <div className="shop-item-meta">
                    <div className="shop-item-badge" style={{ borderColor: item.badgeColor, color: item.badgeColor }}>
                      {item.badge}
                    </div>
                    <h3 className="shop-item-name">{item.name}</h3>
                    <div className="shop-item-owned-chip">
                      Dimiliki: <strong>{item.owned}</strong> buah
                    </div>
                  </div>
                </div>

                <p className="shop-item-desc">{item.description}</p>

                <div className="shop-item-highlight">
                  <span>💡</span> {item.highlight}
                </div>

                <div className="shop-item-footer">
                  <div className="shop-price-tag">
                    <span className="shop-price-gem">💎</span>
                    <strong className="shop-price-amount">{item.price}</strong>
                    <span className="shop-price-label">Poin</span>
                  </div>

                  <button
                    type="button"
                    className={`shop-buy-btn ${canAfford ? 'btn-can-afford' : 'btn-disabled'}`}
                    disabled={!currentUser || !canAfford || isBuying}
                    onClick={() => handleBuy(item.id, item.name, item.price)}
                    title={!currentUser ? 'Login terlebih dahulu' : (!canAfford ? 'Poin tidak cukup' : `Beli ${item.name}`)}
                  >
                    {isBuying ? (
                      <span className="shop-btn-loading">Memproses...</span>
                    ) : (
                      <span>🛒 Beli Item</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Petunjuk Cara Mendapatkan Poin */}
        <div className="shop-info-footer">
          <div className="shop-info-title">💡 Cara Mengumpulkan Poin JakLudo:</div>
          <div className="shop-info-pills">
            <span className="shop-info-pill">🏆 Menang Game: <strong>+25 Poin</strong></span>
            <span className="shop-info-pill">🎮 Main Pertandingan: <strong>+5 Poin</strong></span>
            <span className="shop-info-pill">🎁 Bonus Pengguna: <strong>+200 Poin</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
