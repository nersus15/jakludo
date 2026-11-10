import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { sound } from '../sound';
import { compressImage, MAX_VOICE_DURATION_MS, startVoiceRecording } from '../social/media';

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member'
};

const ROLE_BADGE_CLASS = {
  owner: 'badge badge--brand',
  admin: 'badge badge--info',
  member: 'badge'
};

const MEDAL_ICONS = { 1: 'medal-1', 2: 'medal-2', 3: 'medal-3' };

function UserAvatar({ user, className = 'social-avatar' }) {
  const val = user?.avatar;
  if (val?.startsWith('http')) {
    return <img src={val} alt="" width="36" height="36" className={className} />;
  }
  const initial = user?.name?.slice(0, 1).toUpperCase();
  return (
    <span className={className} aria-hidden="true">
      {initial || <Icon name="pawn" size={16} />}
    </span>
  );
}

// Pemutar Voice Note kustom bertema papan permainan JakLudo
function VoiceNotePlayer({ groupId, msg, token, onExpiredUrl }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(
    msg.media?.durationMs ? Math.max(1, Math.round(msg.media.durationMs / 1000)) : 0
  );
  const [useFallbackUrl, setUseFallbackUrl] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const streamSrc = `/api/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(msg.id)}/audio${
    token ? `?token=${encodeURIComponent(token)}` : ''
  }`;
  const activeSrc = useFallbackUrl && msg.media?.url ? msg.media.url : streamSrc;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;

    const onLoaded = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setTotalSec(Math.round(el.duration));
      }
      setLoadFailed(false);
    };
    const onTime = () => {
      setCurrentSec(Math.floor(el.currentTime || 0));
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setTotalSec(Math.round(el.duration));
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentSec(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);

    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    el.addEventListener('pause', onPause);
    el.addEventListener('play', onPlay);
    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('play', onPlay);
    };
  }, [activeSrc]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    setLoadFailed(false);
    try {
      await el.play();
    } catch {
      if (!useFallbackUrl && msg.media?.url) {
        setUseFallbackUrl(true);
      } else {
        setLoadFailed(true);
        onExpiredUrl?.();
      }
    }
  };

  const onSeek = e => {
    const el = audioRef.current;
    if (!el || !totalSec) return;
    const next = Number(e.target.value);
    el.currentTime = next;
    setCurrentSec(next);
  };

  const progressPct = totalSec > 0 ? Math.min(100, Math.round((currentSec / totalSec) * 100)) : 0;

  return (
    <div className="vn-player">
      <audio
        ref={audioRef}
        src={activeSrc}
        preload="metadata"
        onError={() => {
          if (!useFallbackUrl && msg.media?.url) {
            setUseFallbackUrl(true);
          } else {
            setLoadFailed(true);
            onExpiredUrl?.();
          }
        }}
      />
      <button
        type="button"
        className="vn-player__btn"
        onClick={togglePlay}
        aria-label={playing ? 'Jeda pesan suara' : 'Putar pesan suara'}
      >
        <Icon name={playing ? 'pause' : 'play'} size={16} />
      </button>
      <div className="vn-player__track">
        <input
          type="range"
          min="0"
          max={Math.max(1, totalSec)}
          step="1"
          value={Math.min(currentSec, Math.max(1, totalSec))}
          onChange={onSeek}
          className="vn-player__slider"
          aria-label="Posisi putar pesan suara"
          style={{ '--vn-pct': `${progressPct}%` }}
        />
        <div className="vn-player__meta">
          <span className="vn-player__time">
            <Icon name="mic" size={13} />
            <span>
              {formatDuration(currentSec * 1000)} / {formatDuration(totalSec * 1000 || msg.media?.durationMs || 0)}
            </span>
          </span>
          {loadFailed && <span className="vn-player__err">Ketuk ulang untuk memutar</span>}
        </div>
      </div>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function previewLastMessage(msg) {
  if (!msg) return 'Belum ada percakapan';
  const sender = msg.sender?.name ? `${msg.sender.name}: ` : '';
  if (msg.type === 'system') return msg.text || 'Info grup';
  if (msg.type === 'match') return `${sender}Match grup (${msg.match?.code || 'Room'})`;
  if (msg.type === 'image') return `${sender}[Foto]${msg.text ? ` — ${msg.text}` : ''}`;
  if (msg.type === 'audio') return `${sender}[Pesan suara]`;
  return `${sender}${msg.text}`;
}

// -------------------- Tab Chat --------------------

function GroupChatTab({ groupId, currentUser, social, onJoinMatch }) {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState('');

  // State rekaman suara
  const [recording, setRecording] = useState(false);
  const [recordElapsedMs, setRecordElapsedMs] = useState(0);
  const recorderRef = useRef(null);
  const recordTimerRef = useRef(null);

  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastMediaRefetchRef = useRef(0);
  const stickToBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const fetchInitialMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await social.actions.getMessages(groupId);
      setMessages(res.messages);
      setHasMore(res.hasMore);
      stickToBottomRef.current = true;
      scrollToBottom();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [groupId, social.actions, scrollToBottom]);

  useEffect(() => {
    fetchInitialMessages();
  }, [fetchInitialMessages]);

  // Bersihkan perekam suara jika keluar tab / komponen ditutup
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (recorderRef.current) {
        recorderRef.current.cancel();
        recorderRef.current = null;
      }
    };
  }, []);

  // Terima pesan baru dari socket secara langsung
  useEffect(() => {
    return social.subscribeGroupEvents((event, payload) => {
      if (event === 'group:message' && payload?.groupId === groupId) {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
        if (stickToBottomRef.current || payload.sender?.userId === currentUser?.id) {
          scrollToBottom();
        }
      }
    });
  }, [groupId, currentUser?.id, social, scrollToBottom]);

  const onScrollList = () => {
    const el = listRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
  };

  const loadOlder = async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    const oldestId = messages[0]?.id;
    if (!oldestId) return;
    sound.playClick();
    setLoadingOlder(true);
    setError('');
    const el = listRef.current;
    const prevScrollHeight = el ? el.scrollHeight : 0;
    try {
      const res = await social.actions.getMessages(groupId, oldestId);
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const older = res.messages.filter(m => !existingIds.has(m.id));
        return [...older, ...prev];
      });
      setHasMore(res.hasMore);
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Jika presigned URL foto/audio kedaluwarsa (±10 menit), muat ulang daftar pesan
  const handleMediaError = useCallback(() => {
    const now = Date.now();
    if (now - lastMediaRefetchRef.current < 15000) return;
    lastMediaRefetchRef.current = now;
    social.actions
      .getMessages(groupId)
      .then(res => {
        setMessages(res.messages);
        setHasMore(res.hasMore);
      })
      .catch(() => {});
  }, [groupId, social.actions]);

  const appendMessage = useCallback(
    msg => {
      if (!msg?.id) return;
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      scrollToBottom();
    },
    [scrollToBottom]
  );

  const onSendText = async e => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || sending || uploadingMedia) return;
    sound.playClick();
    setSending(true);
    setError('');
    try {
      const msg = await social.actions.sendMessage(groupId, clean);
      setText('');
      appendMessage(msg);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const onSelectPhoto = async e => {
    const rawFile = e.target.files?.[0];
    e.target.value = '';
    if (!rawFile || uploadingMedia) return;
    sound.playClick();
    setUploadingMedia(true);
    setError('');
    try {
      const compressed = await compressImage(rawFile);
      const caption = text.trim();
      const msg = await social.actions.sendMedia(groupId, {
        file: compressed.file,
        kind: 'image',
        text: caption
      });
      if (caption) setText('');
      appendMessage(msg);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingMedia(false);
    }
  };

  const sendRecordedVoice = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    recorderRef.current = null;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
    setUploadingMedia(true);
    setError('');
    try {
      const result = await rec.stop();
      if (!result) return;
      const caption = text.trim();
      const msg = await social.actions.sendMedia(groupId, {
        file: result.file,
        kind: 'audio',
        durationMs: result.durationMs,
        text: caption
      });
      if (caption) setText('');
      appendMessage(msg);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingMedia(false);
      setRecordElapsedMs(0);
    }
  }, [groupId, text, social.actions, appendMessage]);

  const onStartVoice = async () => {
    if (recording || uploadingMedia) return;
    sound.playClick();
    setError('');
    try {
      const rec = await startVoiceRecording({
        onMaxDuration: () => {
          sendRecordedVoice();
        }
      });
      recorderRef.current = rec;
      setRecording(true);
      setRecordElapsedMs(0);
      recordTimerRef.current = setInterval(() => {
        if (recorderRef.current) {
          setRecordElapsedMs(recorderRef.current.getElapsedMs());
        }
      }, 250);
    } catch (err) {
      setError(err.message);
    }
  };

  const onCancelVoice = () => {
    sound.playClick();
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
    setRecording(false);
    setRecordElapsedMs(0);
  };

  return (
    <div className="group-chat">
      <div className="group-chat__messages" ref={listRef} onScroll={onScrollList}>
        {hasMore && (
          <div className="group-chat__more">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={loadingOlder}
              onClick={loadOlder}
            >
              {loadingOlder ? 'Memuat...' : 'Muat pesan sebelumnya'}
            </button>
          </div>
        )}

        {loading && messages.length === 0 ? (
          <p className="state-msg" role="status">
            <span className="spinner" aria-hidden="true" /> Memuat obrolan...
          </p>
        ) : messages.length === 0 ? (
          <p className="state-msg muted">Belum ada pesan di grup ini. Sapa anggota grup sekarang!</p>
        ) : (
          messages.map(msg => {
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="gmsg gmsg--system">
                  <span>{msg.text}</span>
                </div>
              );
            }

            const isMe = currentUser && msg.sender?.userId === currentUser.id;

            if (msg.type === 'match') {
              const matchCode = msg.match?.code;
              return (
                <div key={msg.id} className="gmsg gmsg--match card">
                  <div className="gmsg__match-info">
                    <span className="gmsg__match-icon" aria-hidden="true">
                      <Icon name="dice" size={22} />
                    </span>
                    <div>
                      <strong>
                        {msg.sender?.name || 'Anggota'} membuat Match Grup
                      </strong>
                      <p className="muted">
                        {msg.text || 'Ayo gabung ke room match khusus grup ini!'}
                        {matchCode ? (
                          <>
                            {' · Kode '}
                            <span className="code-text">{matchCode}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {matchCode && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => onJoinMatch(matchCode)}
                    >
                      Gabung match
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div key={msg.id} className={`gmsg ${isMe ? 'gmsg--me' : 'gmsg--other'}`}>
                {!isMe && <UserAvatar user={msg.sender} className="social-avatar social-avatar--sm" />}
                <div className="gmsg__bubble">
                  <div className="gmsg__meta">
                    <strong>{isMe ? 'Kamu' : msg.sender?.name || 'Anggota'}</strong>
                    {!isMe && msg.sender?.username && (
                      <span className="muted">@{msg.sender.username}</span>
                    )}
                    <time className="gmsg__time muted">{formatTime(msg.createdAt)}</time>
                  </div>

                  {msg.type === 'image' && msg.media?.url && (
                    <button
                      type="button"
                      className="gmsg__image-btn"
                      onClick={() => setLightboxUrl(msg.media.url)}
                      aria-label="Perbesar foto"
                    >
                      <img
                        src={msg.media.url}
                        alt={msg.text || 'Foto di chat grup'}
                        loading="lazy"
                        width={msg.media.width || undefined}
                        height={msg.media.height || undefined}
                        className="gmsg__image"
                        onError={handleMediaError}
                      />
                    </button>
                  )}

                  {msg.type === 'audio' && (msg.media?.url || msg.media?.streamUrl) && (
                    <VoiceNotePlayer
                      groupId={groupId}
                      msg={msg}
                      token={social.actions.getToken?.()}
                      onExpiredUrl={handleMediaError}
                    />
                  )}

                  {msg.text && <p className="gmsg__text">{msg.text}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p className="alert alert--error group-chat__error" role="alert">
          {error}
        </p>
      )}

      {uploadingMedia && (
        <p className="group-chat__uploading muted" role="status">
          <span className="spinner" aria-hidden="true" /> Mengompres & mengunggah media...
        </p>
      )}

      {recording ? (
        <div className="group-chat__recorder" role="region" aria-label="Perekam pesan suara">
          <span className="recorder-indicator" aria-hidden="true" />
          <span className="recorder-timer">
            Merekam suara: <strong>{formatDuration(recordElapsedMs)}</strong> /{' '}
            {formatDuration(MAX_VOICE_DURATION_MS)}
          </span>
          <div className="recorder-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={onCancelVoice}>
              Batal
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={sendRecordedVoice}>
              <Icon name="send" size={16} />
              <span>Kirim suara</span>
            </button>
          </div>
        </div>
      ) : (
        <form className="group-chat__composer" onSubmit={onSendText}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onSelectPhoto}
            tabIndex={-1}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="Kirim foto"
            title={
              social.mediaEnabled
                ? 'Kirim foto (otomatis dikompres WebP)'
                : 'Fitur media belum diaktifkan di server'
            }
            disabled={!social.mediaEnabled || uploadingMedia || sending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="camera" size={20} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Rekam pesan suara"
            title={
              social.mediaEnabled
                ? 'Rekam pesan suara (maks 2 menit)'
                : 'Fitur media belum diaktifkan di server'
            }
            disabled={!social.mediaEnabled || uploadingMedia || sending}
            onClick={onStartVoice}
          >
            <Icon name="mic" size={20} />
          </button>
          <label htmlFor="group-chat-input" className="sr-only">
            Tulis pesan grup
          </label>
          <input
            id="group-chat-input"
            type="text"
            className="input"
            placeholder="Tulis pesan..."
            maxLength={1000}
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={sending || !text.trim()}
          >
            Kirim
          </button>
        </form>
      )}

      {lightboxUrl && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau foto"
          onClick={() => setLightboxUrl('')}
        >
          <button
            type="button"
            className="icon-btn lightbox__close"
            aria-label="Tutup foto"
            onClick={() => setLightboxUrl('')}
          >
            <Icon name="close" size={18} />
          </button>
          <img
            src={lightboxUrl}
            alt="Foto ukuran penuh"
            className="lightbox__img"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// -------------------- Tab Anggota --------------------

function GroupMembersTab({ detail, currentUser, social, onDetailUpdated, onGroupLeftOrDeleted }) {
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(detail?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [busyUserId, setBusyUserId] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // 'leave' | 'delete' | null
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setNewName(detail?.name || '');
  }, [detail?.name]);

  if (!detail) {
    return (
      <p className="state-msg" role="status">
        <span className="spinner" aria-hidden="true" /> Memuat anggota grup...
      </p>
    );
  }

  const myRole = detail.role;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin';
  const canRename = isOwner || isAdmin;
  const members = detail.members || [];
  const pendingInvites = detail.pendingInvites || [];
  const friends = social.friends || [];
  const memberIds = new Set(members.map(m => m.userId));
  const pendingInviteeIds = new Set(pendingInvites.map(inv => inv.invitee?.userId).filter(Boolean));

  const handleQuickInviteFriend = async friend => {
    if (!friend?.username || busyUserId === friend.userId || inviting) return;
    sound.playClick();
    setBusyUserId(friend.userId);
    setFeedback(null);
    try {
      await social.actions.inviteToGroup(detail.id, friend.username);
      setFeedback({ type: 'success', text: `Undangan grup dikirim ke ${friend.name} (@${friend.username}).` });
      onDetailUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyUserId('');
    }
  };

  const handleInvite = async e => {
    e.preventDefault();
    const clean = inviteUsername.trim().replace(/^@/, '');
    if (!clean || inviting) return;
    sound.playClick();
    setInviting(true);
    setFeedback(null);
    try {
      await social.actions.inviteToGroup(detail.id, clean);
      setInviteUsername('');
      setFeedback({ type: 'success', text: `Undangan grup dikirim ke @${clean}.` });
      onDetailUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setInviting(false);
    }
  };

  const handleRename = async e => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean || savingName) return;
    sound.playClick();
    setSavingName(true);
    setFeedback(null);
    try {
      const updated = await social.actions.renameGroup(detail.id, clean);
      setEditingName(false);
      setFeedback({ type: 'success', text: 'Nama grup berhasil diperbarui.' });
      onDetailUpdated(updated);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingName(false);
    }
  };

  const handleToggleAdmin = async member => {
    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    sound.playClick();
    setBusyUserId(member.userId);
    setFeedback(null);
    try {
      const updated = await social.actions.setMemberRole(detail.id, member.userId, nextRole);
      setFeedback({
        type: 'success',
        text:
          nextRole === 'admin'
            ? `${member.name} diangkat menjadi Admin.`
            : `${member.name} diturunkan menjadi Member.`
      });
      onDetailUpdated(updated);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyUserId('');
    }
  };

  const handleKick = async member => {
    sound.playClick();
    setBusyUserId(member.userId);
    setFeedback(null);
    try {
      await social.actions.removeMember(detail.id, member.userId);
      setFeedback({ type: 'success', text: `${member.name} dikeluarkan dari grup.` });
      onDetailUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyUserId('');
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentUser) return;
    sound.playClick();
    setBusyUserId(currentUser.id);
    setFeedback(null);
    try {
      await social.actions.removeMember(detail.id, currentUser.id);
      onGroupLeftOrDeleted('Kamu telah keluar dari grup.');
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
      setBusyUserId('');
    }
  };

  const handleDeleteGroup = async () => {
    sound.playClick();
    setBusyUserId('delete-group');
    setFeedback(null);
    try {
      await social.actions.deleteGroup(detail.id);
      onGroupLeftOrDeleted('Grup berhasil dihapus.');
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
      setBusyUserId('');
    }
  };

  return (
    <div className="social-stack">
      {feedback && (
        <p
          className={`alert alert--${feedback.type === 'success' ? 'success' : 'error'}`}
          role={feedback.type === 'success' ? 'status' : 'alert'}
        >
          {feedback.text}
        </p>
      )}

      {canRename && (
        <section className="social-section">
          {editingName ? (
            <form className="social-inline-form" onSubmit={handleRename}>
              <label htmlFor="rename-group-input" className="sr-only">
                Nama grup baru
              </label>
              <input
                id="rename-group-input"
                type="text"
                className="input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                minLength={3}
                maxLength={40}
                disabled={savingName}
                placeholder="Nama grup (3–40 karakter)"
              />
              <button
                type="submit"
                className="btn btn--primary btn--sm"
                disabled={savingName || newName.trim().length < 3}
              >
                {savingName ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={savingName}
                onClick={() => {
                  setEditingName(false);
                  setNewName(detail.name);
                }}
              >
                Batal
              </button>
            </form>
          ) : (
            <div className="group-rename-bar">
              <div>
                <span className="muted">Nama grup: </span>
                <strong>{detail.name}</strong>
              </div>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setEditingName(true)}
              >
                Ganti nama
              </button>
            </div>
          )}
        </section>
      )}

      <section className="social-section" aria-labelledby="invite-friends-list-title">
        <div className="section-head">
          <h3 id="invite-friends-list-title" className="panel-section__title">
            Undang dari daftar teman
          </h3>
          <span className="badge">{friends.length}</span>
        </div>
        {friends.length === 0 ? (
          <p className="social-empty muted">
            Belum ada teman di daftar temanmu. Kamu tetap bisa mengundang memakai username di bawah.
          </p>
        ) : (
          <ul className="social-list">
            {friends.map(f => {
              const alreadyMember = memberIds.has(f.userId);
              const alreadyPending = pendingInviteeIds.has(f.userId);
              return (
                <li key={f.userId} className="social-row">
                  <div className="social-avatar-wrap">
                    <UserAvatar user={f} />
                    <span
                      className={`status-dot ${f.online ? 'status-dot--online' : 'status-dot--offline'}`}
                      title={f.online ? 'Online' : 'Offline'}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="social-row__info">
                    <strong>{f.name}</strong>
                    <span className="muted">
                      @{f.username} · {f.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="social-row__actions">
                    {alreadyMember ? (
                      <span className="badge">Sudah anggota</span>
                    ) : alreadyPending ? (
                      <span className="badge">Menunggu</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={busyUserId === f.userId || inviting}
                        onClick={() => handleQuickInviteFriend(f)}
                      >
                        <Icon name="user-plus" size={15} />
                        <span>{busyUserId === f.userId ? 'Mengundang...' : 'Undang'}</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="social-section" aria-labelledby="invite-member-title">
        <h3 id="invite-member-title" className="panel-section__title">
          Undang via username lainnya
        </h3>
        <form className="social-inline-form" onSubmit={handleInvite}>
          <label htmlFor="group-invite-username" className="sr-only">
            Username pemain
          </label>
          <input
            id="group-invite-username"
            type="text"
            className="input"
            placeholder="Ketik @username pemain..."
            value={inviteUsername}
            onChange={e => setInviteUsername(e.target.value)}
            disabled={inviting}
            autoComplete="off"
            autoCapitalize="none"
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={inviting || !inviteUsername.trim()}
          >
            {inviting ? 'Mengundang...' : 'Undang'}
          </button>
        </form>
      </section>

      {pendingInvites.length > 0 && (
        <section className="social-section" aria-labelledby="pending-group-invites-title">
          <div className="section-head">
            <h3 id="pending-group-invites-title" className="panel-section__title">
              Undangan tertunda
            </h3>
            <span className="badge">{pendingInvites.length}</span>
          </div>
          <ul className="social-list">
            {pendingInvites.map(inv => (
              <li key={inv.id} className="social-row">
                <UserAvatar user={inv.invitee} />
                <div className="social-row__info">
                  <strong>{inv.invitee?.name}</strong>
                  <span className="muted">
                    @{inv.invitee?.username} · Diundang oleh {inv.inviter?.name || 'anggota'}
                  </span>
                </div>
                <span className="badge">Menunggu</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="social-section" aria-labelledby="group-members-title">
        <div className="section-head">
          <h3 id="group-members-title" className="panel-section__title">
            Daftar anggota
          </h3>
          <span className="badge">{members.length}</span>
        </div>
        <ul className="social-list">
          {members.map(m => {
            const isMe = currentUser && m.userId === currentUser.id;
            const canKick =
              !isMe && (isOwner || (isAdmin && m.role === 'member'));
            const canChangeRole = isOwner && !isMe && m.role !== 'owner';

            return (
              <li key={m.userId} className="social-row">
                <div className="social-avatar-wrap">
                  <UserAvatar user={m} />
                  <span
                    className={`status-dot ${m.online ? 'status-dot--online' : 'status-dot--offline'}`}
                    title={m.online ? 'Online' : 'Offline'}
                    aria-hidden="true"
                  />
                </div>
                <div className="social-row__info">
                  <strong className="social-row__title">
                    {m.name}
                    {isMe && <span className="badge">Kamu</span>}
                    <span className={ROLE_BADGE_CLASS[m.role] || 'badge'}>
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  </strong>
                  <span className="muted">
                    @{m.username} · {m.online ? 'Online' : 'Offline'}
                  </span>
                </div>
                {(canChangeRole || canKick) && (
                  <div className="social-row__actions">
                    {canChangeRole && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        disabled={busyUserId === m.userId}
                        onClick={() => handleToggleAdmin(m)}
                      >
                        {m.role === 'admin' ? 'Turunkan Admin' : 'Jadikan Admin'}
                      </button>
                    )}
                    {canKick && (
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        disabled={busyUserId === m.userId}
                        onClick={() => handleKick(m)}
                      >
                        Keluarkan
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="social-section social-danger-zone">
        {isOwner ? (
          confirmAction === 'delete' ? (
            <div className="confirm-bar">
              <span>Yakin ingin menghapus grup ini secara permanen?</span>
              <div className="social-row__actions">
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  disabled={busyUserId === 'delete-group'}
                  onClick={handleDeleteGroup}
                >
                  Ya, hapus grup
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setConfirmAction(null)}
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => setConfirmAction('delete')}
            >
              Hapus grup
            </button>
          )
        ) : confirmAction === 'leave' ? (
          <div className="confirm-bar">
            <span>Yakin ingin keluar dari grup {detail.name}?</span>
            <div className="social-row__actions">
              <button
                type="button"
                className="btn btn--danger btn--sm"
                disabled={busyUserId === currentUser?.id}
                onClick={handleLeaveGroup}
              >
                Ya, keluar grup
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setConfirmAction(null)}
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--danger btn--block"
            onClick={() => setConfirmAction('leave')}
          >
            Keluar grup
          </button>
        )}
      </section>
    </div>
  );
}

// -------------------- Tab Peringkat Grup --------------------

function GroupLeaderboardTab({ groupId, currentUser, social, onCreateGroupMatch }) {
  const [state, setState] = useState({ status: 'loading', list: [] });

  const loadLeaderboard = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading' }));
    try {
      const list = await social.actions.getGroupLeaderboard(groupId);
      setState({ status: 'ready', list });
    } catch {
      setState(s => ({ ...s, status: 'error' }));
    }
  }, [groupId, social.actions]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    return social.subscribeGroupEvents((event, payload) => {
      if (event === 'group:leaderboard' && payload?.groupId === groupId) {
        loadLeaderboard();
      }
    });
  }, [groupId, social, loadLeaderboard]);

  const { status, list } = state;

  return (
    <div className="social-stack">
      <p className="muted">
        Peringkat ini khusus hasil <strong>Match Grup</strong> (tidak mengubah poin atau peringkat global).
      </p>

      {status === 'loading' && list.length === 0 && (
        <p className="state-msg" role="status">
          <span className="spinner" aria-hidden="true" /> Memuat peringkat grup...
        </p>
      )}

      {status === 'error' && (
        <div className="state-msg" role="alert">
          <p>Peringkat grup gagal dimuat.</p>
          <button type="button" className="btn btn--secondary" onClick={loadLeaderboard}>
            Coba lagi
          </button>
        </div>
      )}

      {status === 'ready' && list.length === 0 && (
        <div className="state-msg">
          <p>Belum ada pertandingan grup yang selesai. Mulai match grup pertama sekarang!</p>
          <button type="button" className="btn btn--primary" onClick={onCreateGroupMatch}>
            <Icon name="dice" size={18} />
            <span>Buat match grup</span>
          </button>
        </div>
      )}

      {list.length > 0 && (
        <ol className="lb-list">
          {list.map(p => {
            const isMe = currentUser && p.userId === currentUser.id;
            return (
              <li
                key={p.userId}
                className={`lb-row ${isMe ? 'is-me' : ''} ${p.rank <= 3 ? 'is-top' : ''}`}
              >
                <span className="lb-row__rank">
                  {MEDAL_ICONS[p.rank] ? <Icon name={MEDAL_ICONS[p.rank]} size={22} /> : `#${p.rank}`}
                </span>
                <UserAvatar user={p} className="lb-avatar" />
                <span className="lb-row__who">
                  <strong>
                    {p.name} {isMe && <span className="badge">Kamu</span>}
                  </strong>
                  <span className="muted">
                    @{p.username} · {p.matchesPlayed} main · menang {p.winRate}%
                  </span>
                </span>
                <span className="lb-row__stats">
                  <strong>{p.wins}</strong> <span className="muted">menang</span>
                  <span className="lb-row__points">{p.points} poin</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// -------------------- Komponen Utama Grup --------------------

export default function GroupsScreen({
  isOpen,
  onClose,
  currentUser,
  social,
  gameActions,
  onOpenAuth
}) {
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'members' | 'leaderboard'
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState('');
  const [feedback, setFeedback] = useState(null);

  const { groups, groupInvites, groupsLoading, actions } = social;

  const loadDetail = useCallback(
    async id => {
      if (!id) return;
      try {
        const d = await actions.getGroup(id);
        setGroupDetail(d);
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      }
    },
    [actions]
  );

  useEffect(() => {
    if (isOpen && currentUser && activeGroupId) {
      loadDetail(activeGroupId);
    }
  }, [isOpen, currentUser, activeGroupId, loadDetail]);

  // Dengarkan perubahan grup atau penghapusan grup saat sedang dibuka
  useEffect(() => {
    return social.subscribeGroupEvents((event, payload) => {
      if (event === 'group:updated' && payload?.groupId === activeGroupId) {
        loadDetail(activeGroupId);
      }
      if (event === 'group:removed' && payload?.groupId === activeGroupId) {
        setActiveGroupId(null);
        setGroupDetail(null);
        setFeedback({ type: 'error', text: 'Grup telah dihapus atau kamu dikeluarkan dari grup.' });
      }
    });
  }, [activeGroupId, social, loadDetail]);

  const openGroup = groupId => {
    sound.playClick();
    setFeedback(null);
    setActiveGroupId(groupId);
    setActiveTab('chat');
    setGroupDetail(null);
    loadDetail(groupId);
  };

  const backToList = notice => {
    sound.playClick();
    setActiveGroupId(null);
    setGroupDetail(null);
    setFeedback(typeof notice === 'string' && notice ? { type: 'success', text: notice } : null);
  };

  const handleCreateGroup = async e => {
    e.preventDefault();
    const clean = newGroupName.trim();
    if (clean.length < 3 || creating) return;
    sound.playClick();
    setCreating(true);
    setFeedback(null);
    try {
      const created = await actions.createGroup(clean);
      setNewGroupName('');
      sound.playWin();
      setActiveGroupId(created.id);
      setGroupDetail(created);
      setActiveTab('chat');
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleAcceptInvite = async inv => {
    sound.playClick();
    setBusyInviteId(inv.id);
    setFeedback(null);
    try {
      const joined = await actions.acceptGroupInvite(inv.id);
      sound.playJoinNotification();
      if (joined?.id) {
        setActiveGroupId(joined.id);
        setGroupDetail(joined);
        setActiveTab('chat');
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyInviteId('');
    }
  };

  const handleDeclineInvite = async inv => {
    sound.playClick();
    setBusyInviteId(inv.id);
    setFeedback(null);
    try {
      await actions.declineGroupInvite(inv.id);
      setFeedback({ type: 'success', text: `Undangan grup ${inv.group?.name || ''} ditolak.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyInviteId('');
    }
  };

  const handleCreateGroupMatch = () => {
    if (!activeGroupId) return;
    gameActions.createRoom(activeGroupId);
    onClose();
  };

  const handleJoinMatch = matchCode => {
    if (!matchCode) return;
    gameActions.joinRoom(matchCode);
    onClose();
  };

  const activeSummary = groups.find(g => g.id === activeGroupId);
  const currentGroupName = groupDetail?.name || activeSummary?.name || 'Detail Grup';
  const currentGroupRole = groupDetail?.role || activeSummary?.role || 'member';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      icon="💬"
      title={activeGroupId ? currentGroupName : 'Grup & Chat'}
      subtitle={
        !currentUser
          ? 'Masuk akun untuk membuat grup, ngobrol, dan main Match Grup.'
          : activeGroupId
          ? `Peranmu: ${ROLE_LABELS[currentGroupRole] || currentGroupRole} · ${
              groupDetail?.members?.length ?? activeSummary?.memberCount ?? 1
            } anggota`
          : `${groups.length} grup diikuti · Buat grup untuk ngobrol & tanding khusus anggota`
      }
    >
      {!currentUser ? (
        <div className="state-msg">
          <p>Masuk atau daftar akun JakLudo dulu untuk bergabung ke grup dan chat bersama teman.</p>
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
      ) : activeGroupId ? (
        <div className="group-detail">
          <div className="group-detail__bar">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => backToList()}>
              <Icon name="arrow-left" size={16} />
              <span>Semua grup</span>
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={handleCreateGroupMatch}>
              <Icon name="dice" size={16} />
              <span>Buat match grup</span>
            </button>
          </div>

          <div className="tabs tabs--three" role="tablist" aria-label="Menu grup">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'chat'}
              className="tabs__tab"
              onClick={() => {
                sound.playClick();
                setActiveTab('chat');
              }}
            >
              <Icon name="chat" size={16} />
              <span>Chat</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'members'}
              className="tabs__tab"
              onClick={() => {
                sound.playClick();
                setActiveTab('members');
              }}
            >
              <Icon name="friends" size={16} />
              <span>Anggota</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'leaderboard'}
              className="tabs__tab"
              onClick={() => {
                sound.playClick();
                setActiveTab('leaderboard');
              }}
            >
              <Icon name="trophy" size={16} />
              <span>Peringkat</span>
            </button>
          </div>

          {activeTab === 'chat' && (
            <GroupChatTab
              groupId={activeGroupId}
              currentUser={currentUser}
              social={social}
              onJoinMatch={handleJoinMatch}
            />
          )}

          {activeTab === 'members' && (
            <GroupMembersTab
              detail={groupDetail}
              currentUser={currentUser}
              social={social}
              onDetailUpdated={updated => {
                if (updated && updated.id) setGroupDetail(updated);
                else loadDetail(activeGroupId);
              }}
              onGroupLeftOrDeleted={msg => backToList(msg)}
            />
          )}

          {activeTab === 'leaderboard' && (
            <GroupLeaderboardTab
              groupId={activeGroupId}
              currentUser={currentUser}
              social={social}
              onCreateGroupMatch={handleCreateGroupMatch}
            />
          )}
        </div>
      ) : (
        <div className="social-stack">
          <form className="social-inline-form" onSubmit={handleCreateGroup}>
            <label htmlFor="create-group-name" className="sr-only">
              Nama grup baru
            </label>
            <input
              id="create-group-name"
              type="text"
              className="input"
              placeholder="Nama grup baru (3–40 karakter)..."
              minLength={3}
              maxLength={40}
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              disabled={creating}
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={creating || newGroupName.trim().length < 3}
            >
              {creating ? 'Membuat...' : 'Buat grup'}
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

          {groupInvites.length > 0 && (
            <section className="social-section" aria-labelledby="group-invites-title">
              <div className="section-head">
                <h3 id="group-invites-title" className="panel-section__title">
                  Undangan grup masuk
                </h3>
                <span className="badge badge--brand">{groupInvites.length}</span>
              </div>
              <ul className="social-list">
                {groupInvites.map(inv => (
                  <li key={inv.id} className="social-row">
                    <span className="social-avatar" aria-hidden="true">
                      <Icon name="chat" size={18} />
                    </span>
                    <div className="social-row__info">
                      <strong>{inv.group?.name || 'Grup'}</strong>
                      <span className="muted">
                        {inv.group?.memberCount || 1} anggota · Diundang oleh{' '}
                        {inv.inviter?.name || `@${inv.inviter?.username}`}
                      </span>
                    </div>
                    <div className="social-row__actions">
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={busyInviteId === inv.id}
                        onClick={() => handleAcceptInvite(inv)}
                      >
                        Terima
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busyInviteId === inv.id}
                        onClick={() => handleDeclineInvite(inv)}
                      >
                        Tolak
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="social-section" aria-labelledby="my-groups-title">
            <div className="section-head">
              <h3 id="my-groups-title" className="panel-section__title">
                Grup kamu
              </h3>
              <span className="badge">{groups.length}</span>
            </div>

            {groupsLoading && groups.length === 0 ? (
              <p className="state-msg" role="status">
                <span className="spinner" aria-hidden="true" /> Memuat daftar grup...
              </p>
            ) : groups.length === 0 ? (
              <p className="social-empty muted">
                Kamu belum bergabung di grup mana pun. Buat grup baru di atas dan undang temanmu!
              </p>
            ) : (
              <ul className="social-list">
                {groups.map(g => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="group-card card"
                      onClick={() => openGroup(g.id)}
                    >
                      <span className="social-avatar" aria-hidden="true">
                        {g.name?.slice(0, 1).toUpperCase() || 'G'}
                      </span>
                      <span className="group-card__info">
                        <span className="group-card__head">
                          <strong>{g.name}</strong>
                          <span className={ROLE_BADGE_CLASS[g.role] || 'badge'}>
                            {ROLE_LABELS[g.role] || g.role}
                          </span>
                          <span className="muted group-card__count">
                            {g.memberCount} anggota
                          </span>
                        </span>
                        <span className="group-card__preview muted">
                          {previewLastMessage(g.lastMessage)}
                        </span>
                      </span>
                    </button>
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
