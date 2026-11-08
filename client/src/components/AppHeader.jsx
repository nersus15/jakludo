import React, { useEffect, useRef, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import { NetworkIndicator } from './NetworkStatus';
import { sound } from '../sound';
import jakludoLogo from '../assets/jakludo-logo-sm.webp';

function soundIcon(audio) {
  if (audio.bgmMuted && audio.sfxMuted) return '🔇';
  return '🔊';
}

// Menu akun: profil, poin, peringkat, dan keluar akun
function AccountMenu({ user, onOpenLeaderboard, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = e => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = e => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = fn => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="account__trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Akun ${user.name}`}
        onClick={() => setOpen(v => !v)}
      >
        <span className="account__avatar" aria-hidden="true">{user.avatar || '🎯'}</span>
        <span className="account__name">{user.name}</span>
      </button>
      {open && (
        <div className="account__menu card">
          <div className="account__profile">
            <strong>
              {user.name} {user.isLudoKing && <span aria-label="Ludo King">👑</span>}
            </strong>
            <span className="muted">@{user.username}</span>
            <span className="badge badge--brand">💎 {user.points ?? 0} poin</span>
          </div>
          <button type="button" className="account__item" onClick={pick(onOpenLeaderboard)}>
            🏆 Peringkat pemain
          </button>
          <button type="button" className="account__item account__item--danger" onClick={pick(onLogout)}>
            Keluar akun
          </button>
        </div>
      )}
    </div>
  );
}

// Header beranda & lobby. Di HP hanya ikon 44px agar tidak melebar keluar layar.
export default function AppHeader({ user, audio, network, theme, onOpenShop, onOpenAudio, onOpenAuth, onOpenLeaderboard, onLogout }) {
  return (
    <header className="app-header">
      <div className="brand">
        <img src={jakludoLogo} alt="" width="40" height="40" className="brand__logo" />
        <span className="brand__name">
          Jak<span className="brand__accent">Ludo</span>
        </span>
      </div>

      <div className="app-header__actions">
        <NetworkIndicator {...network} />
        {user && (
          <span className="badge badge--brand app-header__points" title="Poin kamu">
            💎 {user.points ?? 0}
          </span>
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label="Toko item"
          title="Toko item"
          onClick={() => {
            sound.playClick();
            onOpenShop();
          }}
        >
          <span aria-hidden="true">🏪</span>
        </button>
        <button type="button" className="icon-btn" aria-label="Pengaturan suara" title="Pengaturan suara" onClick={onOpenAudio}>
          <span aria-hidden="true">{soundIcon(audio)}</span>
        </button>
        <ThemeToggle theme={theme} />
        {user ? (
          <AccountMenu user={user} onOpenLeaderboard={onOpenLeaderboard} onLogout={onLogout} />
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              sound.playClick();
              onOpenAuth();
            }}
          >
            Masuk
          </button>
        )}
      </div>
    </header>
  );
}
