import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { isAvatarUrl } from './media';
import { sound } from '../sound';

function ProfileAvatar({ user, size = 76 }) {
  if (isAvatarUrl(user?.avatar)) {
    return (
      <img
        src={user.avatar}
        alt={`Foto profil ${user.name}`}
        width={size}
        height={size}
        className="profile-modal__avatar"
      />
    );
  }
  const initial = user?.name?.slice(0, 1).toUpperCase();
  return (
    <span className="profile-modal__avatar" aria-hidden="true">
      {initial || <Icon name="pawn" size={Math.round(size * 0.45)} />}
    </span>
  );
}

function GroupMiniAvatar({ group }) {
  if (isAvatarUrl(group?.avatar)) {
    return <img src={group.avatar} alt="" width="28" height="28" className="social-avatar social-avatar--sm" />;
  }
  return (
    <span className="social-avatar social-avatar--sm" aria-hidden="true">
      {group?.name?.slice(0, 1).toUpperCase() || 'G'}
    </span>
  );
}

function formatJoinDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '';
  }
}

export default function PlayerProfileModal({
  userId,
  isOpen,
  onClose,
  currentUser,
  social,
  onOpenChatWithFriend,
  onOpenAuth
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const avatarInputRef = useRef(null);

  const loadProfile = useCallback(async () => {
    if (!userId || !social?.actions?.getUserProfile) return;
    setLoading(true);
    setError('');
    try {
      const data = await social.actions.getUserProfile(userId);
      setProfile(data);
    } catch (err) {
      setError(err.message || 'Gagal memuat profil pemain.');
    } finally {
      setLoading(false);
    }
  }, [userId, social?.actions]);

  useEffect(() => {
    if (isOpen && userId) {
      setFeedback(null);
      setProfile(null);
      loadProfile();
    }
  }, [isOpen, userId, loadProfile]);

  const handleAddFriend = async () => {
    if (!profile?.username || busy) return;
    if (!currentUser) {
      onClose();
      onOpenAuth?.();
      return;
    }
    sound.playClick();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await social.actions.sendFriendRequest(profile.username);
      if (res.status === 'accepted') {
        sound.playWin();
        setFeedback({ type: 'success', text: `Sekarang kamu berteman dengan ${profile.name}!` });
      } else {
        setFeedback({ type: 'success', text: `Permintaan pertemanan dikirim ke @${profile.username}.` });
      }
      await loadProfile();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptFriend = async () => {
    if (!profile?.userId || busy) return;
    sound.playClick();
    setBusy(true);
    setFeedback(null);
    try {
      await social.actions.acceptFriendRequest(profile.userId);
      sound.playJoinNotification();
      setFeedback({ type: 'success', text: `${profile.name} ditambahkan ke daftar teman!` });
      await loadProfile();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleUploadOwnAvatar = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy || !social?.actions?.uploadAvatar) return;
    sound.playClick();
    setBusy(true);
    setFeedback(null);
    try {
      await social.actions.uploadAvatar(file);
      sound.playWin();
      setFeedback({ type: 'success', text: 'Foto profil kamu berhasil diperbarui!' });
      await loadProfile();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const isSelf = !!(profile?.isSelf || (currentUser && profile?.userId === currentUser.id));
  const friendship = profile?.friendshipStatus || 'none';
  const joinLabel = formatJoinDate(profile?.createdAt);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      icon="pawn"
      title={profile ? `Profil · ${profile.name}` : 'Profil Pemain'}
      subtitle={profile ? `@${profile.username}` : 'Memuat informasi pemain...'}
    >
      {loading && !profile ? (
        <p className="state-msg" role="status">
          <span className="spinner" aria-hidden="true" /> Memuat profil pemain...
        </p>
      ) : error ? (
        <div className="state-msg" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--secondary" onClick={loadProfile}>
            Coba lagi
          </button>
        </div>
      ) : profile ? (
        <div className="profile-modal">
          <div className="profile-modal__hero card">
            <div className="profile-modal__avatar-wrap">
              <ProfileAvatar user={profile} size={76} />
              <span
                className={`status-dot status-dot--lg ${
                  profile.online ? 'status-dot--online' : 'status-dot--offline'
                }`}
                title={profile.online ? 'Sedang online' : 'Offline'}
                aria-hidden="true"
              />
            </div>

            <div className="profile-modal__identity">
              <div className="profile-modal__name-row">
                <h3 className="profile-modal__name">{profile.name}</h3>
                {isSelf && <span className="badge">Kamu</span>}
                {profile.isLudoKing && (
                  <span className="badge badge--warning">
                    <Icon name="crown" size={14} /> Ludo King
                  </span>
                )}
              </div>
              <p className="muted">
                @{profile.username} ·{' '}
                <span className={profile.online ? 'text-online' : ''}>
                  {profile.online ? 'Sedang online' : 'Offline'}
                </span>
              </p>
              <div className="profile-modal__badges">
                {joinLabel && <span className="badge">Bergabung {joinLabel}</span>}
                <span className="badge">
                  <Icon name="friends" size={13} /> {profile.friendCount ?? 0} teman
                </span>
                <span className="badge">
                  <Icon name="chat" size={13} /> {profile.groupCount ?? 0} grup
                </span>
              </div>
            </div>
          </div>

          {feedback && (
            <p
              className={`alert alert--${feedback.type === 'success' ? 'success' : 'error'}`}
              role={feedback.type === 'success' ? 'status' : 'alert'}
            >
              {feedback.text}
            </p>
          )}

          <div className="profile-stats" aria-label="Statistik permainan">
            <div className="profile-stat card">
              <span className="profile-stat__label muted">Peringkat</span>
              <strong className="profile-stat__value">
                {profile.rank ? `#${profile.rank}` : '—'}
              </strong>
              <span className="profile-stat__sub muted">
                {profile.isLudoKing ? '👑 Ludo King' : 'Global'}
              </span>
            </div>
            <div className="profile-stat card">
              <span className="profile-stat__label muted">Menang</span>
              <strong className="profile-stat__value">{profile.wins ?? 0}</strong>
              <span className="profile-stat__sub muted">
                dari {profile.matchesPlayed ?? 0} main
              </span>
            </div>
            <div className="profile-stat card">
              <span className="profile-stat__label muted">Rasio Menang</span>
              <strong className="profile-stat__value">{profile.winRate ?? 0}%</strong>
              <span className="profile-stat__sub muted">Win rate</span>
            </div>
            <div className="profile-stat card">
              <span className="profile-stat__label muted">Total Poin</span>
              <strong className="profile-stat__value">
                <Icon name="diamond" size={16} /> {profile.points ?? 0}
              </strong>
              <span className="profile-stat__sub muted">Poin JakLudo</span>
            </div>
          </div>

          {Array.isArray(profile.sharedGroups) && profile.sharedGroups.length > 0 && !isSelf && (
            <section className="social-section" aria-label="Grup yang sama">
              <h4 className="panel-section__title">
                Satu grup denganmu ({profile.sharedGroups.length})
              </h4>
              <div className="profile-shared-groups">
                {profile.sharedGroups.map(g => (
                  <span key={g.id} className="badge profile-shared-group">
                    <GroupMiniAvatar group={g} />
                    <span>{g.name}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          <div className="profile-modal__actions">
            {isSelf ? (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleUploadOwnAvatar}
                  tabIndex={-1}
                />
                <button
                  type="button"
                  className="btn btn--secondary btn--block"
                  disabled={busy}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Icon name="camera" size={16} />
                  <span>{busy ? 'Mengunggah foto...' : 'Ubah foto profil'}</span>
                </button>
              </>
            ) : friendship === 'friends' ? (
              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={() => {
                  sound.playClick();
                  onOpenChatWithFriend?.(profile.userId);
                }}
              >
                <Icon name="chat" size={16} />
                <span>Kirim pesan private</span>
              </button>
            ) : friendship === 'incoming_pending' ? (
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={busy}
                onClick={handleAcceptFriend}
              >
                <Icon name="user-plus" size={16} />
                <span>{busy ? 'Memproses...' : 'Terima permintaan pertemanan'}</span>
              </button>
            ) : friendship === 'outgoing_pending' ? (
              <button type="button" className="btn btn--secondary btn--block" disabled>
                <span>Permintaan pertemanan terkirim</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={busy}
                onClick={handleAddFriend}
              >
                <Icon name="user-plus" size={16} />
                <span>{busy ? 'Mengirim...' : 'Tambah teman'}</span>
              </button>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

