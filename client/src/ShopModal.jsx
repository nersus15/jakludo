import React, { useState } from 'react';
import Modal from './components/Modal';
import { sound } from './sound';
import { storage } from './storage';
import { useItemCatalogState } from './items';

export default function ShopModal({ isOpen, onClose, currentUser, onUpdateUser, authToken }) {
  const [buying, setBuying] = useState(null);
  const [injecting, setInjecting] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [feedback, setFeedback] = useState(null);
  const catalog = useItemCatalogState();

  const points = currentUser?.points ?? 0;
  const owned = currentUser?.inventory || {};
  const isSeliron = currentUser?.username?.toLowerCase() === 'seliron_id';

  const injectDiamonds = async amount => {
    const num = Number(amount);
    if (!Number.isInteger(num) || num <= 0) return;
    setInjecting(true);
    setFeedback(null);
    sound.playClick();
    try {
      const res = await fetch('/api/shop/inject-diamonds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken || storage.get('token')}` },
        body: JSON.stringify({ amount: num })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal inject diamond.');
      sound.playShopPurchase();
      setFeedback({
        type: 'success',
        message: `✨ Berhasil inject ${num.toLocaleString('id-ID')} Diamond! Saldo sekarang: ${(data.user?.points ?? (points + num)).toLocaleString('id-ID')} poin.`
      });
      if (data.user) onUpdateUser?.(data.user);
      setCustomAmount('');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setInjecting(false);
    }
  };

  const buy = async item => {
    setBuying(item.id);
    setFeedback(null);
    sound.playClick();
    try {
      const res = await fetch('/api/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken || storage.get('token')}` },
        body: JSON.stringify({ itemId: item.id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Pembelian gagal. Coba lagi.');
      sound.playShopPurchase();
      setFeedback({ type: 'success', message: `${item.name} berhasil dibeli. Sisa poin: ${data.user?.points ?? points - item.price}.` });
      if (data.user) onUpdateUser?.(data.user);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBuying(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      icon="🏪"
      title="Toko item"
      subtitle={currentUser ? `Saldo Poin / Diamond: ${points.toLocaleString('id-ID')} 💎` : 'Masuk dulu untuk membeli item.'}
    >
      {feedback && (
        <p className={`alert alert--${feedback.type === 'success' ? 'success' : 'error'} shop__feedback`} role={feedback.type === 'success' ? 'status' : 'alert'}>
          {feedback.message}
        </p>
      )}

      {isSeliron && (
        <section className="shop__inject card" aria-labelledby="inject-title">
          <div className="shop-inject__head">
            <span className="shop-inject__badge">👑 KHUSUS USERNAME SELIRON_ID</span>
            <h3 id="inject-title">⚡ Inject Diamond (Poin Toko)</h3>
            <p className="muted">Tambah saldo Diamond instan untuk membeli semua item toko sepuasnya.</p>
          </div>
          <div className="shop-inject__actions">
            <div className="shop-inject__presets">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={injecting}
                onClick={() => injectDiamonds(500)}
              >
                +500 💎
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={injecting}
                onClick={() => injectDiamonds(1000)}
              >
                +1.000 💎
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={injecting}
                onClick={() => injectDiamonds(5000)}
              >
                +5.000 💎
              </button>
            </div>
            <form
              className="shop-inject__custom"
              onSubmit={e => {
                e.preventDefault();
                const amt = parseInt(customAmount, 10);
                if (amt > 0) injectDiamonds(amt);
              }}
            >
              <input
                type="number"
                min="1"
                max="100000"
                placeholder="Jumlah kustom..."
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                disabled={injecting}
                className="input input--sm"
              />
              <button
                type="submit"
                className="btn btn--primary btn--sm"
                disabled={injecting || !customAmount || parseInt(customAmount, 10) <= 0}
              >
                {injecting ? 'Injecting...' : '⚡ Inject 💎'}
              </button>
            </form>
          </div>
        </section>
      )}

      {catalog.status === 'loading' && (
        <p className="state-msg" role="status"><span className="spinner" aria-hidden="true" /> Memuat item...</p>
      )}
      {catalog.status === 'error' && (
        <div className="state-msg" role="alert">
          <p>Daftar item gagal dimuat.</p>
          <button type="button" className="btn btn--secondary" onClick={catalog.retry}>Coba lagi</button>
        </div>
      )}
      {catalog.status === 'ready' && catalog.items.length === 0 && (
        <p className="state-msg">Belum ada item di toko.</p>
      )}

      <ul className="shop__items">
        {catalog.items.map(item => {
          const affordable = points >= item.price;
          return (
            <li key={item.id} className="shop-item card">
              <div className="shop-item__head">
                <span className="shop-item__icon" aria-hidden="true">{item.icon}</span>
                <div>
                  <h3>{item.name}</h3>
                  <p className="muted">{item.kind === 'active' ? 'Dipakai manual di giliranmu' : 'Bekerja otomatis'} · dimiliki {owned[item.id] || 0}</p>
                </div>
              </div>
              <p className="shop-item__desc">{item.description}</p>
              {item.highlight && <p className="shop-item__note">{item.highlight}</p>}
              <div className="shop-item__buy">
                <span className="shop-item__price">💎 {item.price} poin</span>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!currentUser || !affordable || buying === item.id}
                  onClick={() => buy(item)}
                >
                  {buying === item.id ? 'Membeli...' : !currentUser ? 'Masuk dulu' : affordable ? `Beli ${item.name}` : 'Poin kurang'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="shop__earn" aria-labelledby="earn-title">
        <h3 id="earn-title">Cara dapat poin</h3>
        <ul>
          <li>Menang pertandingan: <strong>+25 poin</strong></li>
          <li>Ikut pertandingan sampai selesai: <strong>+5 poin</strong></li>
          <li>Bonus akun baru: <strong>200 poin</strong></li>
        </ul>
        <p className="muted">Poin hanya dihitung untuk pertandingan bersama minimal satu pemain lain (bukan hanya bot).</p>
      </section>
    </Modal>
  );
}
