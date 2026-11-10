import React, { useEffect, useRef, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import Icon from './Icon';
import { NetworkIndicator } from './NetworkStatus';
import { sound } from '../sound';
import jakludoLogo from '../assets/jakludo-logo-sm.webp';

function soundIconName(audio) {
  if (audio.bgmMuted && audio.sfxMuted) return 'volume-off';
  return 'volume-on';
}

// Menu akun: profil, poin, teman, grup, peringkat, dan keluar akun
function AccountMenu({ user, friendBadgeCount = 0, groupBadgeCount = 0, onOpenFriends, onOpenGroups, onOpenLeaderboard, onLogout }) {
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
    fn?.();
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
        <span className="account__avatar" aria-hidden="true">
          {user.name?.slice(0, 1).toUpperCase() || <Icon name="pawn" size={16} />}
        </span>
        <span className="account__name">{user.name}</span>
      </button>
      {open && (
        <div className="account__menu card">
          <div className="account__profile">
            <strong>
              {user.name} {user.isLudoKing && <Icon name="crown" size={16} label="Ludo King" />}
            </strong>
            <span className="muted">@{user.username}</span>
            <span className="badge badge--brand">
              <Icon name="diamond" size={14} /> {user.points ?? 0} poin
            </span>
          </div>
          {onOpenFriends && (
            <button type="button" className="account__item" onClick={pick(onOpenFriends)}>
              <span className="account__item-label">
                <Icon name="friends" size={17} /> Teman
              </span>
              {friendBadgeCount > 0 && <span className="badge badge--brand">{friendBadgeCount}</span>}
            </button>
          )}
          {onOpenGroups && (
            <button type="button" className="account__item" onClick={pick(onOpenGroups)}>
              <span className="account__item-label">
                <Icon name="chat" size={17} /> Grup & Chat
              </span>
              {groupBadgeCount > 0 && <span className="badge badge--brand">{groupBadgeCount}</span>}
            </button>
          )}
          <button type="button" className="account__item" onClick={pick(onOpenLeaderboard)}>
            <span className="account__item-label">
              <Icon name="trophy" size={17} /> Peringkat pemain
            </span>
          </button>
          <button type="button" className="account__item account__item--danger" onClick={pick(onLogout)}>
            <span className="account__item-label">
              <Icon name="logout" size={17} /> Keluar akun
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// Header beranda & lobby. Di HP hanya ikon 44px agar tidak melebar keluar layar.
export default function AppHeader({
  user,
  audio,
  network,
  theme,
  friendBadgeCount = 0,
  groupBadgeCount = 0,
  onOpenFriends,
  onOpenGroups,
  onOpenShop,
  onOpenAudio,
  onOpenAuth,
  onOpenLeaderboard,
  onLogout
}) {
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
            <Icon name="diamond" size={14} /> {user.points ?? 0}
          </span>
        )}
        {onOpenFriends && (
          <button
            type="button"
            className="icon-btn"
            aria-label={friendBadgeCount > 0 ? `Teman (${friendBadgeCount} permintaan baru)` : 'Teman'}
            title="Teman"
            onClick={() => {
              sound.playClick();
              onOpenFriends();
            }}
          >
            <Icon name="friends" size={20} />
            {friendBadgeCount > 0 && (
              <span className="count-badge" aria-hidden="true">
                {friendBadgeCount}
              </span>
            )}
          </button>
        )}
        {onOpenGroups && (
          <button
            type="button"
            className="icon-btn"
            aria-label={groupBadgeCount > 0 ? `Grup & Chat (${groupBadgeCount} undangan baru)` : 'Grup & Chat'}
            title="Grup & Chat"
            onClick={() => {
              sound.playClick();
              onOpenGroups();
            }}
          >
            <Icon name="chat" size={20} />
            {groupBadgeCount > 0 && (
              <span className="count-badge" aria-hidden="true">
                {groupBadgeCount}
              </span>
            )}
          </button>
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
          <Icon name="shop" size={20} />
        </button>
        <button type="button" className="icon-btn" aria-label="Pengaturan suara" title="Pengaturan suara" onClick={onOpenAudio}>
          <Icon name={soundIconName(audio)} size={20} />
        </button>
        <ThemeToggle theme={theme} />
        {user ? (
          <AccountMenu
            user={user}
            friendBadgeCount={friendBadgeCount}
            groupBadgeCount={groupBadgeCount}
            onOpenFriends={onOpenFriends}
            onOpenGroups={onOpenGroups}
            onOpenLeaderboard={onOpenLeaderboard}
            onLogout={onLogout}
          />
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
