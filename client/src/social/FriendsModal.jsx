import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { sound } from '../sound';

function UserAvatar({ user }) {
  const val = user?.avatar;
  if (val?.startsWith('http')) {
    return <img src={val} alt="" width="38" height="38" className="social-avatar" />;
  }
  const initial = user?.name?.slice(0, 1).toUpperCase();
  return (
    <span className="social-avatar" aria-hidden="true">
      {initial || <Icon name="pawn" size={18} />}
    </span>
  );
}

export default function FriendsModal({ isOpen, onClose, currentUser, social, onOpenAuth }) {
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState('');

  const { friends, incoming, outgoing, friendsLoading, actions } = social;

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      setConfirmRemoveId('');
    }
  }, [isOpen]);

  const onAddFriend = async e => {
    e.preventDefault();
    const clean = username.trim().replace(/^@/, '');
    if (!clean || submitting) return;
    sound.playClick();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await actions.sendFriendRequest(clean);
      setUsername('');
      if (res.status === 'accepted') {
        sound.playWin();
        setFeedback({
          type: 'success',
          text: `Sekarang kamu berteman dengan ${res.user?.name || `@${clean}`}!`
        });
      } else {
        setFeedback({
          type: 'success',
          text: `Permintaan pertemanan dikirim ke @${res.user?.username || clean}.`
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async user => {
    sound.playClick();
    setBusyId(user.userId);
    setFeedback(null);
    try {
      await actions.acceptFriendRequest(user.userId);
      sound.playJoinNotification();
      setFeedback({ type: 'success', text: `${user.name} ditambahkan ke daftar teman.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyId('');
    }
  };

  const handleRemove = async (user, label) => {
    sound.playClick();
    setBusyId(user.userId);
    setFeedback(null);
    try {
      await actions.removeFriend(user.userId);
      setConfirmRemoveId('');
      if (label) setFeedback({ type: 'success', text: label });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyId('');
    }
  };

  const onlineCount = friends.filter(f => f.online).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      icon="👥"
      title="Teman"
      subtitle={
        currentUser
          ? `${friends.length} teman · ${onlineCount} sedang online`
          : 'Masuk akun untuk menambah teman dan melihat siapa yang sedang online.'
      }
    >
      {!currentUser ? (
        <div className="state-msg">
          <p>Masuk atau daftar akun JakLudo dulu untuk memakai fitur pertemanan.</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              sound.playClick();
              onClose();
              onOpenAuth?.();
            }}
          >
            Masuk atau daftar
          </button>
        </div>
      ) : (
        <div className="social-stack">
          <form className="social-inline-form" onSubmit={onAddFriend}>
            <label htmlFor="friend-username-input" className="sr-only">
              Username teman
            </label>
            <input
              id="friend-username-input"
              type="text"
              className="input"
              placeholder="Tambah teman pakai @username..."
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={submitting}
              autoComplete="off"
              autoCapitalize="none"
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !username.trim()}
            >
              {submitting ? 'Mengirim...' : 'Tambah'}
            </button>
          </form>

          {feedback && (
            <p
              className={`alert alert--${feedback.type === 'success' ? 'success' : 'error'}`}
              role={feedback.type === 'success' ? 'status' : 'alert'}
            >
              {feedback.text}
            </p>
          )}

          {incoming.length > 0 && (
            <section className="social-section" aria-labelledby="incoming-friends-title">
              <div className="section-head">
                <h3 id="incoming-friends-title" className="panel-section__title">
                  Permintaan masuk
                </h3>
                <span className="badge badge--brand">{incoming.length}</span>
              </div>
              <ul className="social-list">
                {incoming.map(u => (
                  <li key={u.userId} className="social-row">
                    <UserAvatar user={u} />
                    <div className="social-row__info">
                      <strong>{u.name}</strong>
                      <span className="muted">@{u.username}</span>
                    </div>
                    <div className="social-row__actions">
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={busyId === u.userId}
                        onClick={() => handleAccept(u)}
                      >
                        Terima
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busyId === u.userId}
                        onClick={() => handleRemove(u, `Permintaan dari @${u.username} ditolak.`)}
                      >
                        Tolak
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {outgoing.length > 0 && (
            <section className="social-section" aria-labelledby="outgoing-friends-title">
              <div className="section-head">
                <h3 id="outgoing-friends-title" className="panel-section__title">
                  Permintaan terkirim
                </h3>
                <span className="badge">{outgoing.length}</span>
              </div>
              <ul className="social-list">
                {outgoing.map(u => (
                  <li key={u.userId} className="social-row">
                    <UserAvatar user={u} />
                    <div className="social-row__info">
                      <strong>{u.name}</strong>
                      <span className="muted">@{u.username} · Menunggu konfirmasi</span>
                    </div>
                    <div className="social-row__actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busyId === u.userId}
                        onClick={() => handleRemove(u, `Permintaan ke @${u.username} dibatalkan.`)}
                      >
                        Batalkan
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="social-section" aria-labelledby="friends-list-title">
            <div className="section-head">
              <h3 id="friends-list-title" className="panel-section__title">
                Daftar teman
              </h3>
              <span className="badge">{friends.length}</span>
            </div>

            {friendsLoading && friends.length === 0 ? (
              <p className="state-msg" role="status">
                <span className="spinner" aria-hidden="true" /> Memuat daftar teman...
              </p>
            ) : friends.length === 0 ? (
              <p className="social-empty muted">
                Belum ada teman. Masukkan username temanmu di atas untuk mulai bermain bareng!
              </p>
            ) : (
              <ul className="social-list">
                {friends.map(u => (
                  <li key={u.userId} className="social-row">
                    <div className="social-avatar-wrap">
                      <UserAvatar user={u} />
                      <span
                        className={`status-dot ${u.online ? 'status-dot--online' : 'status-dot--offline'}`}
                        title={u.online ? 'Online' : 'Offline'}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="social-row__info">
                      <strong>{u.name}</strong>
                      <span className="muted">
                        @{u.username} ·{' '}
                        <span className={u.online ? 'text-online' : ''}>
                          {u.online ? 'Online' : 'Offline'}
                        </span>
                      </span>
                    </div>
                    <div className="social-row__actions">
                      {confirmRemoveId === u.userId ? (
                        <>
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            disabled={busyId === u.userId}
                            onClick={() => handleRemove(u, `${u.name} dihapus dari daftar teman.`)}
                          >
                            Ya, hapus
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            disabled={busyId === u.userId}
                            onClick={() => setConfirmRemoveId('')}
                          >
                            Batal
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          disabled={busyId === u.userId}
                          onClick={() => setConfirmRemoveId(u.userId)}
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
