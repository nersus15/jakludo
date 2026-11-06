import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import Dice3D from './Dice3D';
import LudoBoard from './LudoBoard';
import AuthModal from './AuthModal';
import LeaderboardModal from './LeaderboardModal';
import AudioSettingsModal from './AudioSettingsModal';
import { sound } from './sound';
import { triggerConfetti } from './confetti';
import { COLORS, COLOR_OFFSETS, SAFE_TRACK_INDICES, COLOR_INFO } from './boardConstants';
import jakludoLogo from './assets/jakludo-logo.jpg';
import './style.css';

const EMOJIS = ['🎲', '🔥', '👏', '😂', '😭', '👑', '⚡', '🎯'];

function App() {
  const socket = useMemo(() => io({ autoConnect: true }), []);
  const [screen, setScreen] = useState('home');
  const [name, setName] = useState('');
  const [code, setCode] = useState(new URLSearchParams(location.search).get('room') || '');
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioState, setAudioState] = useState(sound.getState());
  const [isMuted, setIsMuted] = useState(sound.isAllMuted());
  const [skillTargeting, setSkillTargeting] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(localStorage.getItem('jakplayer_token') || localStorage.getItem('joybit_token') || '');
  const [activeSessionRoom, setActiveSessionRoom] = useState(localStorage.getItem('jakplayer_active_room') || localStorage.getItem('joybit_active_room') || '');
  const [sidebarTab, setSidebarTab] = useState('score');
  const [memberNotification, setMemberNotification] = useState(null);
  const hasTriggeredWin = useRef(false);

  // Verifikasi sesi login saat pertama kali dimuat
  useEffect(() => {
    if (authToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      })
        .then(async res => {
          if (!res.ok) return {};
          const text = await res.text();
          return text ? JSON.parse(text) : {};
        })
        .then(data => {
          if (data.success && data.user) {
            setCurrentUser(data.user);
            setName(data.user.name);
          } else {
            localStorage.removeItem('jakplayer_token');
            localStorage.removeItem('joybit_token');
            setAuthToken('');
            setCurrentUser(null);
          }
        })
        .catch(() => {
          // Abaikan kesalahan koneksi sementara
        });
    }
  }, [authToken]);

  // Coba reconnect otomatis jika ada sesi room aktif yang tersimpan
  useEffect(() => {
    const savedRoom = localStorage.getItem('jakplayer_active_room') || localStorage.getItem('joybit_active_room') || new URLSearchParams(location.search).get('room');
    const savedSession = localStorage.getItem('jakplayer_session_id') || localStorage.getItem('joybit_session_id');
    if (savedRoom) {
      const token = localStorage.getItem('jakplayer_token') || localStorage.getItem('joybit_token');
      socket.emit('room:join', {
        code: savedRoom,
        sessionId: savedSession,
        token: token || authToken,
        name: currentUser?.name || name || 'Pemain'
      });
    }
  }, [socket]);

  useEffect(() => {
    socket.on('room:joined', d => {
      setPlayerId(d.playerId);
      setCode(d.code);
      if (d.sessionId) {
        localStorage.setItem('jakplayer_session_id', d.sessionId);
        localStorage.setItem('joybit_session_id', d.sessionId);
      }
      localStorage.setItem('jakplayer_active_room', d.code);
      localStorage.setItem('joybit_active_room', d.code);
      setActiveSessionRoom(d.code);
      history.replaceState({}, '', `?room=${d.code}`);
      setScreen('room');
      setError('');
      if (d.reconnected) {
        sound.playClick();
      }
    });

    socket.on('room:update', updatedRoom => {
      setRoom(updatedRoom);
      setError('');

      if (updatedRoom.winner) {
        localStorage.removeItem('jakplayer_active_room');
        localStorage.removeItem('joybit_active_room');
        setActiveSessionRoom('');
        if (!hasTriggeredWin.current) {
          hasTriggeredWin.current = true;
          sound.playWin();
          triggerConfetti();
        }
      } else {
        hasTriggeredWin.current = false;
      }

      // Cek jika pemain sendiri dinyatakan OUT
      const myP = updatedRoom.players?.find(p => p.id === playerId);
      if (myP?.isOut) {
        localStorage.removeItem('jakplayer_active_room');
        localStorage.removeItem('joybit_active_room');
        setActiveSessionRoom('');
      }
    });

    socket.on('room:reaction', reaction => {
      setReactions(prev => [...prev.slice(-8), reaction]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== reaction.id));
      }, 2600);
    });

    socket.on('room:member_joined', data => {
      sound.playJoinNotification();
      setMemberNotification({
        id: Date.now(),
        text: data.reconnected ? `${data.name} kembali masuk!` : `${data.name} bergabung ke room!`,
        avatar: data.avatar || '🎲'
      });
      setTimeout(() => {
        setMemberNotification(null);
      }, 3500);
    });

    socket.on('room:error', err => {
      setError(err);
      if (err.includes('tidak ditemukan') || err.includes('OUT') || err.includes('penuh')) {
        localStorage.removeItem('jakplayer_active_room');
        localStorage.removeItem('joybit_active_room');
        setActiveSessionRoom('');
        if (location.search.includes('room=')) {
          history.replaceState({}, '', location.pathname);
          setCode('');
        }
      }
      setTimeout(() => setError(''), 5000);
    });

    return () => {
      socket.off('room:joined');
      socket.off('room:update');
      socket.off('room:reaction');
      socket.off('room:member_joined');
      socket.off('room:error');
    };
  }, [socket, playerId]);

  useEffect(() => {
    const unsub = sound.subscribe((st) => {
      setAudioState({ ...st });
      setIsMuted(sound.isAllMuted());
    });
    return unsub;
  }, []);

  // Sinkronisasi Musik Latar (BGM): Hanya berbunyi saat permainan/di dalam room, TIDAK di landing page / menu utama
  useEffect(() => {
    const inRoom = screen === 'room';
    sound.setInRoom(inRoom);
  }, [screen]);

  const openAudioSettings = () => {
    sound.init();
    sound.playClick();
    setShowAudioModal(true);
  };

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('jakplayer_token', token);
    localStorage.setItem('joybit_token', token);
    setName(user.name);
    sound.playWin();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthToken('');
    localStorage.removeItem('jakplayer_token');
    localStorage.removeItem('joybit_token');
    localStorage.removeItem('jakplayer_active_room');
    localStorage.removeItem('joybit_active_room');
    localStorage.removeItem('jakplayer_session_id');
    localStorage.removeItem('joybit_session_id');
    setActiveSessionRoom('');
    sound.playClick();
  };

  const create = () => {
    if (!currentUser) {
      setError('Silakan masuk atau daftar akun JakLudo terlebih dahulu untuk bermain.');
      setShowAuthModal(true);
      return;
    }
    sound.playClick();
    setError('');
    const savedSession = localStorage.getItem('jakplayer_session_id') || localStorage.getItem('joybit_session_id');
    socket.emit('room:create', {
      name: currentUser.name,
      username: currentUser.username,
      token: authToken,
      sessionId: savedSession
    });
  };

  const join = targetCode => {
    const c = (typeof targetCode === 'string' && targetCode.trim() ? targetCode : null) || code;
    if (!currentUser) {
      setError('Silakan masuk atau daftar akun JakLudo terlebih dahulu untuk bermain.');
      setShowAuthModal(true);
      return;
    }
    if (!c || typeof c !== 'string' || !c.trim()) return setError('Kode room wajib diisi.');
    sound.playClick();
    setError('');
    const cleanCode = c.trim().toUpperCase();
    const savedSession = localStorage.getItem('jakplayer_session_id') || localStorage.getItem('joybit_session_id');
    socket.emit('room:join', {
      name: currentUser.name,
      username: currentUser.username,
      token: authToken,
      sessionId: savedSession,
      code: cleanCode
    });
  };

  const handleAddBot = () => {
    sound.playClick();
    socket.emit('room:add_bot');
  };

  const handleRemoveBot = () => {
    sound.playClick();
    socket.emit('room:remove_bot');
  };

  const handleToggleSafeZones = () => {
    sound.playClick();
    const currentSafe = room?.settings?.safeZones !== false;
    socket.emit('room:update_settings', { safeZones: !currentSafe });
  };

  const handleToggleBlackHole = () => {
    sound.playClick();
    const currentBH = !!room?.settings?.blackHole;
    socket.emit('room:update_settings', { blackHole: !currentBH });
  };

  const handleStartGame = () => {
    sound.playClick();
    socket.emit('game:start');
  };

  const handleRestartGame = () => {
    sound.playClick();
    socket.emit('game:restart');
  };

  const handleRollDice = () => {
    socket.emit('game:roll');
  };

  const handleMovePawn = pawnIdx => {
    socket.emit('game:move', { pawn: pawnIdx });
    setSkillTargeting(false);
  };

  const handleSelectSkillTarget = (targetPlayerId, targetPawnIdx) => {
    sound.playClick();
    socket.emit('game:use_skill', { targetPlayerId, targetPawnIdx });
    setSkillTargeting(false);
  };

  const handleAccumulateSkill = () => {
    sound.playClick();
    socket.emit('game:accumulate_skill');
    setSkillTargeting(false);
  };

  const sendReaction = emoji => {
    sound.playClick();
    socket.emit('game:reaction', { emoji });
  };

  const me = room?.players?.find(p => p.id === playerId);
  const currentTurnPlayer = room?.players?.[room.turn];
  const isTurn = currentTurnPlayer?.id === playerId;
  const invite = `${location.origin}${location.pathname}?room=${room?.code || code}`;
  const safeZonesActive = room?.settings?.safeZones !== false;
  const blackHoleActive = !!room?.settings?.blackHole;

  // Hitung bidak yang dapat dilangkahkan oleh pemain aktif (mengikuti rule 1 bidak per kotak)
  const movablePawns = useMemo(() => {
    if (!room || room.dice === null || !isTurn || room.animatingMove) return [];
    const myPawns = room.pawns[playerId] || [];
    const movable = [];
    const myColor = me?.color;
    const colorIdx = COLORS.indexOf(myColor);

    myPawns.forEach((v, idx) => {
      // 1. Dari markas (0): Bisa keluar dengan angka 6 atau 1
      if (v === 0) {
        if (room.dice === 6 || room.dice === 1) {
          // Petak start sendiri tidak boleh sudah ditempati bidak sendiri
          if (myPawns.some((ownV, ownIdx) => ownIdx !== idx && ownV === 1)) return;

          // Jika safe zone aktif, tidak boleh mendarat jika ada lawan di petak start
          if (safeZonesActive) {
            const startTrack = COLOR_OFFSETS[colorIdx];
            for (const opp of room.players) {
              if (opp.id === playerId) continue;
              const oppColorIdx = COLORS.indexOf(opp.color);
              const oppPawns = room.pawns[opp.id] || [];
              for (const oppV of oppPawns) {
                if (oppV >= 1 && oppV <= 39) {
                  const oppTrack = (COLOR_OFFSETS[oppColorIdx] + oppV - 1) % 40;
                  if (oppTrack === startTrack) return;
                }
              }
            }
          }
          movable.push(idx);
        }
      } else if (v > 0 && v < 44) {
        const next = v + room.dice;
        if (next > 44) return;
        if (next === 44) {
          movable.push(idx); // Petak finish boleh menampung semua bidak tamat
          return;
        }

        // Tidak boleh ada 2 bidak sendiri dalam satu kotak
        if (myPawns.some((ownV, ownIdx) => ownIdx !== idx && ownV === next)) return;

        // Jika di lintasan utama (1..39)
        if (next <= 39) {
          const targetTrack = (COLOR_OFFSETS[colorIdx] + next - 1) % 40;

          // Aturan: Jika bidak lawan berada di kotak base warnanya, tidak bisa diinjak lawan
          for (const opp of room.players) {
            if (opp.id === playerId || opp.isOut) continue;
            const oppColorIdx = COLORS.indexOf(opp.color);
            const oppBaseTrack = COLOR_OFFSETS[oppColorIdx];
            if (targetTrack === oppBaseTrack) {
              const oppPawns = room.pawns[opp.id] || [];
              if (oppPawns.some(oppV => oppV >= 1 && oppV <= 39 && ((COLOR_OFFSETS[oppColorIdx] + oppV - 1) % 40) === targetTrack)) {
                return; // Terhalang oleh bidak lawan yang sedang berada di kotak base warnanya!
              }
            }
          }

          const isTargetSafe = safeZonesActive && SAFE_TRACK_INDICES.includes(targetTrack);
          if (isTargetSafe) {
            for (const opp of room.players) {
              if (opp.id === playerId) continue;
              const oppColorIdx = COLORS.indexOf(opp.color);
              const oppPawns = room.pawns[opp.id] || [];
              for (const oppV of oppPawns) {
                if (oppV >= 1 && oppV <= 39) {
                  const oppTrack = (COLOR_OFFSETS[oppColorIdx] + oppV - 1) % 40;
                  if (oppTrack === targetTrack) return; // Terhalang lawan di safe zone
                }
              }
            }
          }
        }

        movable.push(idx);
      }
    });

    return movable;
  }, [room, playerId, isTurn, me, safeZonesActive]);

  // Auto-move: Jika hanya ada 1 bidak yang bisa jalan (tidak ada pilihan lain), jalankan otomatis!
  useEffect(() => {
    if (!isTurn || room?.dice === null || room?.rolling || room?.animatingMove) {
      return;
    }
    if (movablePawns.length === 1) {
      const singlePawnIdx = movablePawns[0];
      const timer = setTimeout(() => {
        handleMovePawn(singlePawnIdx);
      }, 380);
      return () => clearTimeout(timer);
    }
  }, [isTurn, room?.dice, room?.rolling, room?.animatingMove, movablePawns]);

  const handleLeaveRoom = () => {
    sound.setInRoom(false);
    sound.playClick();
    const currentCode = room?.code || code;

    // 1. Bersihkan semua sesi aktif dari localStorage
    localStorage.removeItem('jakplayer_active_room');
    localStorage.removeItem('joybit_active_room');
    localStorage.removeItem('jakplayer_session_id');
    localStorage.removeItem('joybit_session_id');
    setActiveSessionRoom('');

    // 2. Beri tahu server bahwa pemain sengaja keluar
    if (socket && currentCode) {
      socket.emit('room:leave', { code: currentCode });
    }

    // 3. Reset state client kembali ke lobby beranda
    setRoom(null);
    setCode('');
    setPlayerId('');
    setScreen('lobby');
    setError('');
    setShowStatsModal(false);

    // 4. Bersihkan URL query parameter ?room=...
    history.replaceState({}, '', location.pathname);
  };

  const copy = async () => {
    try {
      sound.playClick();
      await navigator.clipboard.writeText(invite);
      setBusy(true);
      setTimeout(() => setBusy(false), 1600);
    } catch {
      setError('Tidak dapat menyalin otomatis. Silakan salin URL dari address bar.');
    }
  };

  const renderScorecard = () => (
    <div className="players-scorecard">
      <div className="card-title">STATUS PEMAIN</div>
      <div className="scorecard-list">
        {room?.players.map(p => {
          const pawns = room?.pawns?.[p.id] || [0, 0, 0, 0];
          const atHome = pawns.filter(v => v === 0).length;
          const onTrack = pawns.filter(v => v > 0 && v < 44).length;
          const finished = pawns.filter(v => v === 44).length;
          const isCurrent = currentTurnPlayer?.id === p.id;

          return (
            <div
              key={p.id}
              className={`scorecard-item ${isCurrent ? 'active' : ''}`}
              style={{ borderLeftColor: COLOR_INFO[p.color]?.hex }}
            >
              <div className="scorecard-player-info">
                <span
                  className="player-bullet"
                  style={{ background: COLOR_INFO[p.color]?.hex }}
                />
                <strong>{p.name}</strong>
                {p.isOut && <span className="mini-badge out">❌ OUT</span>}
                {!p.isOut && p.autoPlayCount > 0 && (
                  <span className="mini-badge auto" title="Dimainkan bot otomatis">
                    🤖 Auto {p.autoPlayCount}/3
                  </span>
                )}
                {!p.isOut && !p.connected && !p.isBot && (
                  <span className="mini-badge offline" title="Koneksi terputus">
                    📶 Terputus
                  </span>
                )}
                {p.isLudoKing && <span className="mini-badge king">👑 KING</span>}
                {p.id === playerId && <span className="mini-badge">KAMU</span>}
                {p.isBot && <span className="mini-badge bot">BOT</span>}
              </div>
              <div className="scorecard-pawn-stats">
                <span title="Bidak di markas">🏠 {atHome}</span>
                <span title="Bidak di lintasan">🏃 {onTrack}</span>
                <span title="Bidak finish" className="finished-count">
                  ★ {finished}/4
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderActivityFeed = () => (
    <div className="activity-feed-card">
      <div className="card-title">LOG PERMAINAN</div>
      <div className="feed-list">
        {(room?.history || []).map(h => (
          <div key={h.id} className="feed-item">
            <span className="feed-time">{h.time}</span>
            <span className="feed-text">{h.text}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <main className="app">
      {/* Header: Saat pertandingan berlangsung, di atasnya dikosongkan kecuali kode room font kecil saja */}
      {screen === 'room' && room?.started ? (
        <div className="gameplay-minimal-header">
          <span className="gameplay-small-code">
            Room: <strong>#{room.code}</strong>
          </span>
          {blackHoleActive && (
            <span className="gameplay-small-bh">🕳️ Black Hole ON</span>
          )}
          <div className="gameplay-header-right">
            <button
              type="button"
              className="gameplay-sound-mini"
              onClick={openAudioSettings}
              title="Pengaturan Suara (Musik & SFX)"
            >
              {audioState.bgmMuted && audioState.sfxMuted ? '🔇' : (audioState.isBgmPlaying ? '🎵' : '🔊')}
            </button>
            <button
              type="button"
              className="gameplay-leave-btn"
              onClick={handleLeaveRoom}
              title="Keluar dari Room"
            >
              🚪 Keluar
            </button>
          </div>
        </div>
      ) : (
        <header>
          <div className="brand">
            <img src={jakludoLogo} alt="JakLudo Logo" className="brand-logo-img" />
            <div className="brand-titles">
              <span className="brand-text">
                Jak<span className="brand-accent">Ludo</span>
              </span>
              <span className="brand-tag">MULTIPLAYER LUDO ARENA</span>
            </div>
          </div>

          <div className="header-actions">
            {/* User Auth Profile Capsule */}
            {currentUser ? (
              <div className="user-profile-capsule">
                <span className="user-capsule-avatar">{currentUser.avatar || '🎯'}</span>
                <div className="user-capsule-text">
                  <span className="user-capsule-name">
                    {currentUser.name}
                    {currentUser.isLudoKing && <span className="capsule-king-crown" title="Ludo King">👑</span>}
                  </span>
                  <span className="user-capsule-handle">@{currentUser.username}</span>
                </div>
                <button
                  type="button"
                  className="user-capsule-logout"
                  onClick={handleLogout}
                  title="Keluar Akun"
                >
                  Keluar
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="header-login-btn"
                onClick={() => {
                  sound.playClick();
                  setShowAuthModal(true);
                }}
              >
                👤 <span className="login-btn-text">Masuk</span>
              </button>
            )}

            <button
              type="button"
              className="sound-toggle-btn"
              onClick={openAudioSettings}
              title="Pengaturan Suara (Musik & SFX)"
            >
              {audioState.bgmMuted && audioState.sfxMuted ? '🔇' : (audioState.isBgmPlaying ? '🎵' : '🔊')}
              <span className="sound-toggle-label">
                {audioState.bgmMuted && audioState.sfxMuted ? ' Mute' : (audioState.isBgmPlaying ? ' Musik' : ' Audio')}
              </span>
            </button>
          </div>
        </header>
      )}

      {/* Floating Reactions Overlay */}
      {reactions.length > 0 && (
        <div className="reactions-overlay">
          {reactions.map(r => (
            <div key={r.id} className="floating-reaction" style={{ borderColor: COLOR_INFO[r.color]?.hex }}>
              <span className="reaction-emoji">{r.emoji}</span>
              <span className="reaction-sender">{r.playerName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Toast Notifikasi Member Baru Join Room */}
      {memberNotification && (
        <div className="member-joined-toast" key={memberNotification.id}>
          <span className="member-toast-avatar">{memberNotification.avatar}</span>
          <div className="member-toast-content">
            <span className="member-toast-tag">MEMBER MASUK</span>
            <strong>{memberNotification.text}</strong>
          </div>
        </div>
      )}

      {/* Screen: Home */}
      {screen === 'home' ? (
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">JAKLUDO MULTIPLAYER ARENA</div>
            <h1>
              Play JakLudo.
              <br />
              <em>Own the game.</em>
            </h1>
            <p>
              Game Ludo multiplayer realtime seru bersama teman. Dilengkapi dadu 3D interaktif, safezone, mode black hole, dan perebutan takhta Ludo King!
            </p>

            {/* Sesi Pertandingan yang Masih Berlangsung */}
            {activeSessionRoom && (
              <div className="active-match-banner">
                <div className="active-match-left">
                  <span className="active-pulse-dot" />
                  <div>
                    <strong>Pertandingan Sedang Berlangsung!</strong>
                    <p>Kamu masih memiliki sesi aktif di Room <strong>{activeSessionRoom}</strong>.</p>
                  </div>
                </div>
                <div className="active-match-actions">
                  <button
                    type="button"
                    className="primary btn-rejoin-pulse"
                    onClick={() => join(activeSessionRoom)}
                  >
                    Lanjutkan Permainan ↗
                  </button>
                  <button
                    type="button"
                    className="btn-dismiss-session"
                    onClick={() => {
                      localStorage.removeItem('joybit_active_room');
                      setActiveSessionRoom('');
                    }}
                    title="Abaikan sesi ini"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            <div className="home-card">
              {currentUser ? (
                /* User Sudah Login */
                <div className="home-user-logged">
                  <div className="logged-profile-strip">
                    <span className="logged-avatar">{currentUser.avatar || '🎯'}</span>
                    <div className="logged-details">
                      <div className="logged-name-row">
                        <strong>{currentUser.name}</strong>
                        {currentUser.isLudoKing && (
                          <span className="home-king-badge">👑 LUDO KING</span>
                        )}
                      </div>
                      <small className="logged-handle">@{currentUser.username}</small>
                    </div>
                  </div>

                  <button className="primary btn-start-action" onClick={create}>
                    ＋ Buat Room Baru
                  </button>

                  <div className="or">
                    <span /> ATAU GABUNG DENGAN KODE <span />
                  </div>

                  <div className="join-row">
                    <input
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      placeholder="KODE ROOM"
                      maxLength="5"
                      onKeyDown={e => e.key === 'Enter' && join()}
                    />
                    <button className="secondary" onClick={() => join()}>
                      Gabung ↗
                    </button>
                  </div>
                </div>
              ) : (
                /* User Belum Login: Gerbang Personalisasi Akun */
                <div className="home-auth-gate">
                  <div className="gate-header">
                    <span className="gate-icon">🔐</span>
                    <div>
                      <strong>Personalisasi Pemain</strong>
                      <p>Wajib login untuk bermain & mencatat poin Leaderboard.</p>
                    </div>
                  </div>

                  <div className="gate-action-buttons">
                    <button
                      type="button"
                      className="btn-gate-account"
                      onClick={() => setShowAuthModal(true)}
                    >
                      <span>🔑</span>
                      <span>Masuk atau Daftar Akun JakLudo</span>
                      <span className="arrow-icon">→</span>
                    </button>
                  </div>

                  <div
                    className="gate-footer-note gate-footer-clickable"
                    onClick={() => {
                      sound.playClick();
                      setShowLeaderboardModal(true);
                    }}
                  >
                    🏆 Lihat Peringkat & Takhta: <strong>👑 LUDO KING →</strong>
                  </div>
                </div>
              )}

              {/* Tombol Leaderboard yang dipindahkan ke Home */}
              <div
                className="home-leaderboard-banner"
                onClick={() => {
                  sound.playClick();
                  setShowLeaderboardModal(true);
                }}
              >
                <div className="home-lb-left">
                  <span className="home-lb-trophy">🏆</span>
                  <div className="home-lb-info">
                    <strong>Peringkat Pemain & Ludo King</strong>
                    <small>Cek skor, win rate, dan sang penguasa arena</small>
                  </div>
                </div>
                <span className="home-lb-arrow">Buka Peringkat ↗</span>
              </div>

              {error && <div className="error">{error}</div>}
            </div>
          </div>

          <div className="art">
            <div className="orbit orbit1" />
            <div className="orbit orbit2" />
            <div className="hero-jakplayer-card">
              <img src={jakludoLogo} alt="JakLudo Brand Banner" className="hero-jakplayer-img" />
              <div className="hero-jakplayer-sub">MULTIPLAYER LUDO ARENA</div>
            </div>
            <div className="float-token red-token" />
            <div className="float-token blue-token" />
            <div className="float-token yellow-token" />
            <div className="float-token green-token" />
            <div className="art-caption">JAKLUDO ARENA</div>
          </div>
        </section>
      ) : (
        /* Screen: Room */
        <section className={`lobby ${room?.started ? 'gameplay-active' : ''}`}>
          {/* Header & Link Room HANYA tampil di Ruang Tunggu. Saat gameplay dimulai, bagian ini disembunyikan agar tampilan bersih dan fokus ke arena Ludo & dadu */}
          {!room?.started && (
            <>
              <div className="lobby-top">
                <div>
                  <div className="eyebrow">WAITING ROOM · JAKLUDO</div>
                  <h1>Ruang Tunggu</h1>
                  <p className="room-status-message">{room?.message || 'Menunggu permainan dimulai...'}</p>
                </div>
                <div className="room-code">
                  <small>KODE ROOM</small>
                  <strong>{room?.code || code}</strong>
                </div>
              </div>

              {/* Invite Bar */}
              <div className="invite">
                <div>
                  <small>LINK UNDANGAN TEMAN</small>
                  <strong>{invite}</strong>
                </div>
                <button type="button" onClick={copy}>
                  {busy ? '✓ Link Tersalin!' : 'Salin Link ↗'}
                </button>
              </div>
            </>
          )}

          {/* Lobby Waiting Players State */}
          {!room?.started ? (
            <div className="lobby-wait-section">
              {/* Konfigurasi & Rules Room */}
              <div className="room-settings-banner">
                <div className="settings-left">
                  <div className="settings-title">
                    <span>⚙️ PENGATURAN ROOM</span>
                    <span className={`mode-badge ${safeZonesActive ? 'safe-on' : 'hardcore'}`}>
                      {safeZonesActive ? 'Zona Aman: ON' : 'Hardcore: ON'}
                    </span>
                    <span className={`mode-badge ${blackHoleActive ? 'bh-on' : 'bh-off'}`}>
                      {blackHoleActive ? '🕳️ Black Hole: ON' : 'Black Hole: OFF'}
                    </span>
                  </div>
                  <p className="settings-desc">
                    {safeZonesActive
                      ? '🛡️ Zona Aman Aktif: Bidak di petak bintang terlindungi.'
                      : '⚔️ Zona Aman Nonaktif: Semua petak bintang bisa dimakan lawan!'}
                    {' '}
                    {blackHoleActive
                      ? '🕳️ Black Hole Aktif: Bidak yang menginjak lubang hitam akan tersedot kembali ke Base!'
                      : 'Lubang hitam dinonaktifkan.'}
                  </p>
                  <div className="rule-pill-note">
                    📌 <strong>Aturan Base:</strong> Bidak lawan yang berada di kotak base warnanya tidak bisa diinjak lawan!
                  </div>
                </div>

                <div className="settings-right">
                  {me?.isHost ? (
                    <div className="settings-btn-col">
                      <button
                        type="button"
                        className={`btn-setting-toggle ${safeZonesActive ? 'btn-safe' : 'btn-hardcore'}`}
                        onClick={handleToggleSafeZones}
                      >
                        {safeZonesActive ? '🛡️ Zona Aman: ON' : '⚔️ Zona Aman: OFF'}
                      </button>
                      <button
                        type="button"
                        className={`btn-setting-toggle ${blackHoleActive ? 'btn-bh-active' : 'btn-bh-inactive'}`}
                        onClick={handleToggleBlackHole}
                      >
                        {blackHoleActive ? '🕳️ Black Hole: AKTIF' : '🕳️ Black Hole: NONAKTIF'}
                      </button>
                    </div>
                  ) : (
                    <div className="setting-guest-status">
                      <div>Zona Aman: <strong>{safeZonesActive ? '🛡️ Aktif' : '⚔️ Nonaktif'}</strong></div>
                      <div>Black Hole: <strong>{blackHoleActive ? '🕳️ Aktif' : 'Nonaktif'}</strong></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Player Slots Grid */}
              <div className="players-grid">
                {[0, 1, 2, 3].map(i => {
                  const p = room?.players[i];
                  return (
                    <div className={`player-slot ${p ? 'filled' : ''}`} key={i}>
                      <div className={`avatar ${p ? p.color : 'empty'}`}>
                        {p ? p.name.slice(0, 1).toUpperCase() : '+'}
                      </div>
                      <div>
                        <div className="player-slot-name-row">
                          <strong>{p?.name || 'Slot Kosong'}</strong>
                          {p?.isLudoKing && <span className="ludo-king-tag" title="Juara Bertahan Ludo King">👑 LUDO KING</span>}
                        </div>
                        <small>
                          {p
                            ? p.username
                              ? `@${p.username}`
                              : p.isHost
                                ? 'HOST RUANGAN'
                                : p.isBot
                                  ? 'BOT KOMPUTER'
                                  : p.id === playerId
                                    ? 'KAMU'
                                    : `PEMAIN ${i + 1}`
                            : 'Menunggu pemain bergabung'}
                        </small>
                      </div>
                      {p && <span className="ready">● SIAP</span>}
                    </div>
                  );
                })}
              </div>

              <div className="lobby-controls-bar">
                <div className="lobby-count-info">
                  <strong>{room?.players?.length || 0} / 4</strong> Pemain Bergabung
                  {(room?.players?.length || 0) < 2 && (
                    <span className="min-player-warn"> (Minimal 2 pemain untuk memulai)</span>
                  )}
                </div>

                <div className="lobby-actions-group">
                  {me?.isHost && (
                    <>
                      {(room?.players?.length || 0) < 4 && (
                        <button type="button" className="btn-bot" onClick={handleAddBot}>
                          ＋ Tambah Bot
                        </button>
                      )}
                      {room?.players?.some(p => p.isBot) && (
                        <button type="button" className="btn-bot-remove" onClick={handleRemoveBot}>
                          − Hapus Bot
                        </button>
                      )}
                      <button
                        type="button"
                        className="primary"
                        disabled={(room?.players?.length || 0) < 2}
                        onClick={handleStartGame}
                      >
                        Mulai Permainan →
                      </button>
                    </>
                  )}
                  {!me?.isHost && (
                    <div className="waiting-pill">
                      Menunggu host memulai permainan<span>•••</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Game In Progress State: Hanya tampilkan arena ludo dan kocokan dadu */
            <div className="game-layout">
              <div className="game-main-row">
                {/* Board Area */}
                <div className="board-wrapper">
                  <div className="game-arena-column">
                    <LudoBoard
                      room={room}
                      myPlayerId={playerId}
                      isMyTurn={isTurn}
                      movablePawns={movablePawns}
                      onMovePawn={handleMovePawn}
                      skillTargeting={skillTargeting}
                      onSelectSkillTarget={handleSelectSkillTarget}
                    />

                    {/* Skill Ultimate Banner: Tampil saat 3 bidak finish dan pemain punya poin skill */}
                    {isTurn && (room?.pawns?.[playerId]?.filter(v => v === 44).length || 0) >= 3 && (me?.skillPoints || 0) > 0 && !room?.rolling && !room?.animatingMove && (
                      <div className="skill-control-banner">
                        <div className="skill-banner-head">
                          <span className="skill-bolt-anim">⚡</span>
                          <div className="skill-banner-text">
                            <strong>SKILL ELIMINASI AKTIF! (3 Bidak Finish)</strong>
                            <small>
                              Poin Daya: <strong>{me.skillPoints}x</strong> {me.skillPoints > 1 ? '(Terakumulasi)' : ''}
                              {me.accumulatedThisTurn ? ' · Sudah dilipatgandakan giliran ini' : ''}
                            </small>
                          </div>
                        </div>

                        <div className="skill-banner-actions">
                          <button
                            type="button"
                            className={`btn-use-skill ${skillTargeting ? 'targeting-active' : ''}`}
                            onClick={() => {
                              sound.playClick();
                              setSkillTargeting(!skillTargeting);
                            }}
                          >
                            {skillTargeting ? '❌ Batal Pilih Target' : '⚡ Gunakan Skill Eliminasi'}
                          </button>

                          {!skillTargeting && !me.accumulatedThisTurn && (
                            <button
                              type="button"
                              className="btn-accumulate-skill"
                              onClick={handleAccumulateSkill}
                              title="Poin skill akan diakumulasi 2 kali lipat jika tidak digunakan"
                            >
                              🛡️ Simpan (Lipat 2x)
                            </button>
                          )}
                        </div>

                        {skillTargeting && (
                          <div className="skill-target-help">
                            🎯 <em>Klik bidak lawan manapun di lintasan untuk mengeliminasinya kembali ke markas!</em>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mobile Controls Dock (Tampil hanya di layar HP) */}
                    <div className="mobile-controls-dock">
                      {/* Compact 3D Interactive Dice */}
                      <div className="mobile-dice-col">
                        <Dice3D
                          value={room.dice}
                          isRolling={room.rolling}
                          canRoll={isTurn && room.dice === null && !room.rolling && !room.animatingMove}
                          onRoll={handleRollDice}
                          disabled={!isTurn || room.dice !== null || room.rolling || !!room.animatingMove}
                          playerColor={currentTurnPlayer?.color}
                        />
                      </div>

                      {/* Action Bar & Quick Reactions */}
                      <div className="mobile-controls-right">
                        <div className="mobile-action-bar">
                          {isTurn ? (
                            room.animatingMove ? (
                              <div className="mobile-status-pill walking">
                                🚶 Melangkah...
                              </div>
                            ) : room.dice === null ? (
                              <button
                                type="button"
                                className="primary mobile-roll-btn"
                                disabled={room.rolling || !!room.animatingMove}
                                onClick={handleRollDice}
                              >
                                🎲 LEMPAR DADU
                              </button>
                            ) : movablePawns.length > 0 ? (
                              <div className="mobile-movable-hints">
                                <span className="mobile-hints-label">💡 Pilih:</span>
                                <div className="mobile-hints-chips-row">
                                  {movablePawns.map(pIdx => {
                                    const pVal = room.pawns[playerId]?.[pIdx] || 0;
                                    return (
                                      <button
                                        key={pIdx}
                                        type="button"
                                        className="mobile-hint-chip"
                                        onClick={() => handleMovePawn(pIdx)}
                                      >
                                        #{pIdx + 1} {pVal === 0 ? '🚀' : `+${room.dice}`}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="mobile-status-pill pass-hint">
                                Tidak ada jalan valid...
                              </div>
                            )
                          ) : room.animatingMove ? (
                            <div className="mobile-status-pill walking">
                              🚶 {currentTurnPlayer?.name} jalan...
                            </div>
                          ) : (
                            <div className="mobile-status-pill waiting">
                              ⏳ Giliran {currentTurnPlayer?.name}...
                            </div>
                          )}
                        </div>

                        {/* Quick Reactions Bar on Mobile */}
                        <div className="mobile-reactions-row">
                          {['🎲', '🔥', '👏', '😂', '👑'].map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              className="mobile-emoji-pill"
                              onClick={() => sendReaction(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="mobile-emoji-pill mobile-skor-pill"
                            onClick={() => setShowStatsModal(true)}
                            title="Buka Skor"
                          >
                            📊
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls & Kocokan Dadu Area for Desktop */}
                <div className="game-sidebar">
                  {/* 3D Interactive Animated Dice Panel */}
                  <div className="dice-control-card">
                    <div className="dice-card-header">
                      <div className="dice-turn-status-left">
                        <span
                          className="turn-avatar-badge"
                          style={{ background: COLOR_INFO[currentTurnPlayer?.color]?.hex }}
                        >
                          {currentTurnPlayer?.name?.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <span className="dice-turn-sub">
                            {isTurn ? '🔥 GILIRAN KAMU!' : 'GILIRAN SAAT INI'}
                          </span>
                          <strong className="dice-turn-name">
                            {currentTurnPlayer?.name}
                          </strong>
                        </div>
                      </div>
                      <div className="dice-card-header-actions">
                        <button
                          type="button"
                          className="stats-pill-btn"
                          onClick={() => {
                            sound.playClick();
                            setShowStatsModal(true);
                          }}
                          title="Buka Status & Log Permainan"
                        >
                          📊 Skor
                        </button>
                        {room.rolling && <span className="rolling-badge">Mengocok...</span>}
                      </div>
                    </div>

                    <div className="dice-center-stage">
                      <Dice3D
                        value={room.dice}
                        isRolling={room.rolling}
                        canRoll={isTurn && room.dice === null && !room.rolling && !room.animatingMove}
                        onRoll={handleRollDice}
                        disabled={!isTurn || room.dice !== null || room.rolling || !!room.animatingMove}
                        playerColor={currentTurnPlayer?.color}
                      />
                    </div>

                    <div className="dice-action-box">
                      {isTurn ? (
                        room.animatingMove ? (
                          <div className="dice-guide-hint walking">
                            🚶 Bidak sedang melangkah...
                          </div>
                        ) : room.dice === null ? (
                          <button
                            type="button"
                            className="primary roll-btn"
                            disabled={room.rolling || !!room.animatingMove}
                            onClick={handleRollDice}
                          >
                            🎲 LEMPAR DADU
                          </button>
                        ) : movablePawns.length > 0 ? (
                          <div className="movable-hints-box">
                            <div className="movable-hints-title">
                              💡 DAPAT ANGKA {room.dice}! PILIH BIDAK JALAN:
                            </div>
                            <div className="movable-hints-list">
                              {movablePawns.map(pIdx => {
                                const pVal = room.pawns[playerId]?.[pIdx] || 0;
                                const isExit = pVal === 0;
                                return (
                                  <button
                                    key={pIdx}
                                    type="button"
                                    className="btn-pawn-hint-chip"
                                    onClick={() => handleMovePawn(pIdx)}
                                    title={`Klik untuk melangkahkan Bidak ${pIdx + 1}`}
                                  >
                                    <span className="hint-chip-num">Bidak {pIdx + 1}</span>
                                    <span className="hint-chip-desc">{isExit ? '🚀 Keluar Base' : `🏃 Maju +${room.dice}`}</span>
                                    <span className="hint-chip-arrow">➔</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="dice-guide-hint warning">
                            Angka <strong>{room.dice}</strong> tidak ada langkah valid. Giliran berpindah...
                          </div>
                        )
                      ) : room.animatingMove ? (
                        <div className="dice-guide-hint walking">
                          🚶 {currentTurnPlayer?.name} sedang melangkah...
                        </div>
                      ) : (
                        <div className="dice-guide-hint waiting">
                          Menunggu giliran {currentTurnPlayer?.name}...
                        </div>
                      )}
                    </div>

                    {/* Integrated Quick Reactions Bar */}
                    <div className="dice-reactions-strip">
                      {EMOJIS.slice(0, 6).map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          className="emoji-btn"
                          onClick={() => sendReaction(emoji)}
                          title={`Kirim reaksi ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats & Log Bottom Sheet Drawer for Mobile */}
              {showStatsModal && (
                <div className="stats-modal-overlay" onClick={() => setShowStatsModal(false)}>
                  <div className="stats-bottom-sheet" onClick={e => e.stopPropagation()}>
                    <div className="sheet-handle" />
                    <div className="sheet-header">
                      <div className="sheet-title-group">
                        <span className="sheet-icon">📊</span>
                        <h3>Status & Log Pertandingan</h3>
                      </div>
                      <button
                        type="button"
                        className="sheet-close-btn"
                        onClick={() => setShowStatsModal(false)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="sheet-body">
                      {renderScorecard()}
                      {renderActivityFeed()}
                      <div className="sheet-footer-actions">
                        <button
                          type="button"
                          className="sheet-leave-btn"
                          onClick={handleLeaveRoom}
                        >
                          🚪 Keluar dari Room
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Winner Modal */}
          {room?.winner && (
            <div className="modal-overlay">
              <div className="winner-card">
                <div className="winner-trophy">🏆</div>
                <div className="eyebrow">JAKLUDO CHAMPION!</div>
                <h2>{room.players.find(p => p.id === room.winner)?.name} MENANG!</h2>
                <p>
                  Semua 4 bidak telah berhasil mencapai garis finish. Pertandingan JakLudo yang luar biasa!
                </p>

                <div className="winner-modal-actions">
                  {me?.isHost ? (
                    <button type="button" className="primary" onClick={handleRestartGame}>
                      🔄 Main Lagi (Mulai Ulang)
                    </button>
                  ) : (
                    <div className="waiting-pill">
                      Menunggu host untuk memulai putaran baru...
                    </div>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleLeaveRoom}
                  >
                    Keluar ke Menu Utama
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <button
            type="button"
            className="back"
            onClick={handleLeaveRoom}
          >
            ← Keluar dari Room
          </button>
        </section>
      )}

      {/* Auth Modal (SSO Google & Username/Password) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Leaderboard & Ludo King Modal */}
      <LeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        currentUser={currentUser}
        socket={socket}
      />

      {/* Pengaturan Audio Terpisah (Musik Latar BGM & SFX) */}
      <AudioSettingsModal
        isOpen={showAudioModal}
        onClose={() => setShowAudioModal(false)}
      />

      {/* Footer */}
      <footer>
        <span>© 2026 JAKLUDO · REALTIME MULTIPLAYER LUDO ARENA</span>
        <span>POWERED BY REALTIME WEBSOCKETS</span>
      </footer>
    </main>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0d14', color: '#fff', padding: 20, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#ff6200', marginBottom: 12 }}>⚠️ Terjadi Kendala Tampilan</h2>
          <p style={{ color: '#94a3b8', maxWidth: 450, marginBottom: 20 }}>
            {this.state.error?.message || 'Aplikasi mengalami kesalahan sementara.'}
          </p>
          <button
            style={{ background: '#ff6200', color: '#fff', border: 0, padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => {
              localStorage.removeItem('jakplayer_active_room');
              localStorage.removeItem('joybit_active_room');
              location.href = location.pathname;
            }}
          >
            Kembali ke Beranda JakLudo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
