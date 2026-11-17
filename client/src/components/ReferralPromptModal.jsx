import { useEffect, useState } from 'react';
import Modal from './Modal';
import { storage } from '../storage';
import { sound } from '../sound';

export default function ReferralPromptModal({
  isOpen,
  onClose,
  authToken,
  onSuccess
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
      const pending = storage.get('pending_referral');
      if (pending && /^\d{6}$/.test(pending.trim())) {
        setCode(pending.trim());
      }
    }
  }, [isOpen]);

  const handleSubmit = async e => {
    e.preventDefault();
    const clean = code.trim();
    if (!clean) {
      setError('Silakan masukkan 6 digit kode referral temanmu.');
      return;
    }
    if (!/^\d{6}$/.test(clean)) {
      setError('Kode referral harus berupa 6 digit angka.');
      return;
    }

    setLoading(true);
    setError('');
    sound.playClick();

    try {
      const res = await fetch('/api/referral/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ referralCode: clean })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menerapkan kode referral.');
      }

      sound.playWin();
      storage.remove('pending_referral');
      setSuccessMsg(data.message || 'Kode referral berhasil diterapkan!');

      setTimeout(() => {
        onSuccess?.(data.user);
        onClose?.();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      size="sm"
      icon="🎁"
      title="Punya Kode Referral?"
      subtitle="Selamat datang di PlayGo! Jika kamu diajak oleh teman, masukkan 6 digit kode referral mereka di bawah."
    >
      <form onSubmit={handleSubmit} className="form" noValidate>
        <div className="card card--flat" style={{ padding: 'var(--space-3)', background: 'var(--color-bg-alt)', marginBottom: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', lineHeight: 1.4 }}>
            Teman yang mengajakmu akan otomatis mendapatkan hadiah <strong>+50 Coins</strong> setelah kamu menerapkan kodemya.
          </p>
        </div>

        <div className="field">
          <label htmlFor="ref-input-prompt">Kode Referral Teman (6 Digit Angka)</label>
          <input
            id="ref-input-prompt"
            className="input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            placeholder="Contoh: 123456"
            disabled={loading || Boolean(successMsg)}
            autoFocus
          />
        </div>

        {error && <p className="alert alert--error" role="alert">{error}</p>}
        {successMsg && <p className="alert alert--success" role="status">{successMsg}</p>}

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn--secondary"
            style={{ flex: 1 }}
            onClick={onClose}
            disabled={loading || Boolean(successMsg)}
          >
            Lewati Nanti
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            style={{ flex: 1 }}
            disabled={loading || Boolean(successMsg) || code.length !== 6}
          >
            {loading ? 'Memeriksa...' : 'Klaim Kode'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
