import React, { useEffect, useId, useMemo, useState } from 'react';
import Modal from './components/Modal';
import Icon from './components/Icon';
import { sound } from './sound';

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Respon server tidak valid (${res.status}).`);
  }
  if (!res.ok || !data.success) throw new Error(data.error || 'Permintaan gagal. Coba lagi.');
  return data;
}

// Aturan password sama dengan validasi server (server/db.js)
const PASSWORD_RULES = [
  { key: 'length', label: 'Minimal 8 karakter', test: p => p.length >= 8 },
  { key: 'lower', label: 'Huruf kecil (a-z)', test: p => /[a-z]/.test(p) },
  { key: 'upper', label: 'Huruf besar (A-Z)', test: p => /[A-Z]/.test(p) },
  { key: 'digit', label: 'Angka (0-9)', test: p => /[0-9]/.test(p) },
  { key: 'symbol', label: 'Simbol (@, #, $, dll)', test: p => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(p) }
];

function PasswordField({ id, label, value, onChange, autoComplete, describedBy, disabled }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__with-action">
        <input
          id={id}
          className="input"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          disabled={disabled}
          required
        />
        <button type="button" className="icon-btn icon-btn--plain" aria-pressed={visible} aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'} onClick={() => setVisible(v => !v)}>
          <Icon name={visible ? 'eye-off' : 'eye'} size={18} />
        </button>
      </div>
    </div>
  );
}

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const ids = { user: useId(), pass: useId(), confirm: useId(), rules: useId(), hint: useId() };

  useEffect(() => {
    if (isOpen) {
      setError('');
      setConfirmPassword('');
    }
  }, [isOpen, tab]);

  const rules = useMemo(() => PASSWORD_RULES.map(r => ({ ...r, ok: r.test(password) })), [password]);
  const passwordOk = rules.every(r => r.ok);
  const matches = confirmPassword.length > 0 && password === confirmPassword;
  const isRegister = tab === 'register';

  const switchTab = next => {
    setTab(next);
    setError('');
  };

  const submit = async e => {
    e.preventDefault();
    const name = username.trim();
    if (!name || !password) return setError('Username dan password wajib diisi.');
    if (isRegister) {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(name)) return setError('Username 3-20 karakter: huruf, angka, atau garis bawah (_).');
      if (!passwordOk) return setError('Password belum memenuhi semua syarat di bawah.');
      if (!matches) return setError('Ketik ulang password belum sama.');
    }

    setLoading(true);
    setError('');
    sound.playClick();
    try {
      const data = await postJson(isRegister ? '/api/auth/register' : '/api/auth/login', isRegister
        ? { username: name, password, name }
        : { username: name, password });
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      icon="🎲"
      title={isRegister ? 'Daftar akun PlayGo' : 'Masuk ke PlayGo'}
      subtitle={isRegister ? 'Satu akun PlayGo untuk semua game, poin, item toko, dan peringkat.' : 'Masuk untuk memilih game, membuat room, dan mengumpulkan poin.'}
    >
      <div className="tabs" role="tablist" aria-label="Pilih masuk atau daftar">
        <button type="button" role="tab" aria-selected={!isRegister} className="tabs__tab" onClick={() => switchTab('login')}>Masuk</button>
        <button type="button" role="tab" aria-selected={isRegister} className="tabs__tab" onClick={() => switchTab('register')}>Daftar</button>
      </div>

      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={ids.user}>Username</label>
          <input
            id={ids.user}
            className="input"
            value={username}
            onChange={e => setUsername(isRegister ? e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') : e.target.value)}
            maxLength={20}
            autoComplete="username"
            autoCapitalize="none"
            aria-describedby={isRegister ? ids.hint : undefined}
            disabled={loading}
            required
          />
          {isRegister && <p id={ids.hint} className="field__hint">Huruf kecil, angka, dan garis bawah (_), 3-20 karakter.</p>}
        </div>

        <PasswordField
          id={ids.pass}
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          describedBy={isRegister ? ids.rules : undefined}
          disabled={loading}
        />

        {isRegister && (
          <>
            <ul id={ids.rules} className="checklist" aria-label="Syarat password">
              {rules.map(r => (
                <li key={r.key} className={r.ok ? 'is-ok' : ''}>
                  <span aria-hidden="true">{r.ok ? '✓' : '○'}</span> {r.label}
                  <span className="sr-only">{r.ok ? ', terpenuhi' : ', belum terpenuhi'}</span>
                </li>
              ))}
            </ul>
            <PasswordField
              id={ids.confirm}
              label="Ketik ulang password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              disabled={loading}
            />
            {confirmPassword && (
              <p className={`field__hint ${matches ? 'is-ok' : 'is-error'}`} role="status">
                {matches ? 'Password sudah sama.' : 'Password belum sama.'}
              </p>
            )}
          </>
        )}

        {error && <p className="alert alert--error" role="alert">{error}</p>}

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={loading}>
          {loading ? (isRegister ? 'Mendaftarkan...' : 'Memeriksa...') : isRegister ? 'Buat akun' : 'Masuk'}
        </button>
      </form>
    </Modal>
  );
}
