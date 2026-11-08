import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import Dice3D from './Dice3D';
import LudoBoard from './LudoBoard';
import AuthModal from './AuthModal';
import LeaderboardModal from './LeaderboardModal';
import AudioSettingsModal from './AudioSettingsModal';
import ShopModal from './ShopModal';
import { sound } from './sound';
import { triggerConfetti } from './confetti';
import { COLOR_INFO } from './boardConstants';
import { storage } from './storage';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { usePwaInstall } from './hooks/usePwaInstall';
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
  const [showShopModal, setShowShopModal] = useState(false);
  const [forceReturnTargeting, setForceReturnTargeting] = useState(false);
  const [itemNotice, setItemNotice] = useState(null);
  const lastShieldProtectIdRef = useRef(null);
  const lastForceReturnUseIdRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(storage.get('token'));
  const [activeSessionRoom, setActiveSessionRoom] = useState(storage.get('active_room'));
  const [sidebarTab, setSidebarTab] = useState('score');
  const [memberNotification, setMemberNotification] = useState(null);
  const hasTriggeredWin = useRef(false);

  // Fitur Chat Realtime & Skill Unlock Alert
  const [skillUnlockNotice, setSkillUnlockNotice] = useState(null);
  const lastSkillUnlockIdRef = useRef(null);
  const [chatInput, setChatInput] = useState('');
  const [showChatModal, setShowChatModal] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const [chatToast, setChatToast] = useState(null);
  const chatToastTimerRef = useRef(null);
  const chatEndRef = useRef(null);
  const mobileChatEndRef = useRef(null);
  const [chats, setChats] = useState([]);
  const showChatModalRef = useRef(false);
  showChatModalRef.current = showChatModal;

  const { ping, isConnected, isReconnecting, isSlowNetwork } = useNetworkStatus(socket);
  const { isInstalled, install: handleInstallApp, showIosInstallGuide, setShowIosInstallGuide } = usePwaInstall({
    onBeforePrompt: () => sound.playClick()
  });


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
            storage.remove('token');
            setAuthToken('');
            setCurrentUser(null);
          }
        })
        .catch(() => {
          // Abaikan kesalahan koneksi sementara
        });
    }
  }, [authToken]);

  // Gabung (ulang) ke room setiap kali socket tersambung: saat halaman dibuka (link undangan /
  // sesi tersimpan) dan setelah koneksi sempat putus, karena server memberi socket id baru.
  const rejoinRef = useRef(null);
  rejoinRef.current = () => {
    const savedRoom = storage.get('active_room') || new URLSearchParams(location.search).get('room');
    if (!savedRoom) return;
    socket.emit('room:join', {
      code: savedRoom,
      sessionId: storage.get('session_id'),
      token: storage.get('token') || authToken,
      name: currentUser?.name || name || 'Pemain'
    });
  };

  useEffect(() => {
    const onConnect = () => rejoinRef.current();
    socket.on('connect', onConnect);
    if (socket.connected) onConnect();
    return () => socket.off('connect', onConnect);
  }, [socket]);

  useEffect(() => {
    socket.on('room:joined', d => {
      setPlayerId(d.playerId);
      setCode(d.code);
      if (d.sessionId) {
        storage.set('session_id', d.sessionId);
      }
      storage.set('active_room', d.code);
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
        storage.remove('active_room');
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
        storage.remove('active_room');
        setActiveSessionRoom('');
      }
    });

    socket.on('room:chats', list => setChats(Array.isArray(list) ? list : []));

    socket.on('room:chat_message', msg => {
      setChats(prev => [...prev.slice(-49), msg]);
      if (msg.senderId === playerId) return;
      sound.playChatNotification();
      if (!showChatModalRef.current) setUnreadChats(prev => prev + 1);
      setChatToast(msg);
      if (chatToastTimerRef.current) clearTimeout(chatToastTimerRef.current);
      chatToastTimerRef.current = setTimeout(() => setChatToast(null), 4200);
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
      if (err.includes('tab atau perangkat lain')) {
        // Sesi diambil alih tab lain: jangan hapus sesi tersimpan yang kini dipakai tab tersebut
        setRoom(null);
        setChats([]);
        setScreen('home');
        return;
      }
      if (err.includes('tidak ditemukan') || err.includes('OUT') || err.includes('penuh')) {
        storage.remove('active_room');
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
      socket.off('room:chats');
      socket.off('room:chat_message');
      socket.off('room:reaction');
      socket.off('room:member_joined');
      socket.off('room:error');
    };
  }, [socket, playerId]);


  // Peringatan ke pemain lain saat ada user yang mengaktifkan Skill Eliminasi
  useEffect(() => {
    if (room?.lastSkillUnlock && room.lastSkillUnlock.id !== lastSkillUnlockIdRef.current) {
      lastSkillUnlockIdRef.current = room.lastSkillUnlock.id;
      const isMe = room.lastSkillUnlock.playerId === playerId;
      setSkillUnlockNotice({
        ...room.lastSkillUnlock,
        isMe
      });
      sound.playThunderSkill();
      const timer = setTimeout(() => {
        setSkillUnlockNotice(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [room?.lastSkillUnlock, playerId]);

  // Alert visual & audio saat Blackhole Shield aktif atau Force Return dieksekusi
  useEffect(() => {
    if (room?.lastShieldProtect && room.lastShieldProtect.id !== lastShieldProtectIdRef.current) {
      lastShieldProtectIdRef.current = room.lastShieldProtect.id;
      setItemNotice({
        type: 'shield',
        icon: '🛡️',
        title: 'PERISAI BLACKHOLE AKTIF!',
        text: `Bidak milik ${room.lastShieldProtect.playerName} terlindungi dan terselamatkan dari Black Hole!`
      });
      sound.playJoinNotification();
      const timer = setTimeout(() => setItemNotice(null), 5500);
      return () => clearTimeout(timer);
    }
  }, [room?.lastShieldProtect]);

  useEffect(() => {
    if (room?.lastForceReturnUse && room.lastForceReturnUse.id !== lastForceReturnUseIdRef.current) {
      lastForceReturnUseIdRef.current = room.lastForceReturnUse.id;
      setItemNotice({
        type: 'forceReturn',
        icon: '⚡',
        title: 'FORCE RETURN DIEKSEKUSI!',
        text: `${room.lastForceReturnUse.attackerName} melancarkan eliminasi langsung terhadap bidak ${room.lastForceReturnUse.defenderName}!`
      });
      sound.playThunderSkill();
      const timer = setTimeout(() => setItemNotice(null), 5500);
      return () => clearTimeout(timer);
    }
  }, [room?.lastForceReturnUse]);

  // Gulir ke pesan chat terbaru
  useEffect(() => {
    if (chats.length === 0) return;
    const timer = setTimeout(() => {
      if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      if (mobileChatEndRef.current) mobileChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(timer);
  }, [chats]);

  const handleSendChat = (e, customText) => {
    if (e && e.preventDefault) e.preventDefault();
    const textToSend = typeof customText === 'string' ? customText : chatInput;
    if (!textToSend || !textToSend.trim()) return;
    sound.playClick();
    socket.emit('room:chat', { text: textToSend.trim() });
    setChatInput('');
  };

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
    storage.set('token', token);
    setName(user.name);
    sound.playWin();
  };

  const handleLogout = () => {
    if (authToken) {
      fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } }).catch(() => {});
    }
    setCurrentUser(null);
    setAuthToken('');
    storage.remove('token');
    storage.remove('active_room');
    storage.remove('session_id');
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
    const savedSession = storage.get('session_id');
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
    const savedSession = storage.get('session_id');
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
    if (forceReturnTargeting) {
      socket.emit('game:use_force_return', { targetPlayerId, targetPawnIdx });
      setForceReturnTargeting(false);
    } else {
      socket.emit('game:use_skill', { targetPlayerId, targetPawnIdx });
      setSkillTargeting(false);
    }
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

  // Bidak yang boleh dijalankan dihitung server (satu sumber aturan main)
  const movablePawns = useMemo(
    () => (isTurn && room?.dice !== null && !room?.animatingMove ? room?.movable || [] : []),
    [room, isTurn]
  );

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
    storage.remove('active_room');
    storage.remove('session_id');
    setActiveSessionRoom('');

    // 2. Beri tahu server bahwa pemain sengaja keluar
    if (socket && currentCode) {
      socket.emit('room:leave', { code: currentCode });
    }

    // 3. Reset state client kembali ke landing page beranda
    sound.setInRoom(false);
    setRoom(null);
    setChats([]);
    setCode('');
    setPlayerId('');
    setScreen('home');
    setError('');
    setShowStatsModal(false);
    setShowChatModal(false);

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

  const renderChatBox = (isMobile = false) => {
    const quickChats = [
      'Semangat! 🔥',
      'GG! 👏',
      'Awas petir! ⚡',
      'Ampun bang! 😂',
      'Jangan makan bidakku! 😭',
      'Maju terus! 🚀'
    ];

    return (
      <div className={`chat-box-card ${isMobile ? 'mobile-chat-card' : ''}`}>
        <div className="chat-card-header">
          <div className="chat-header-title">
            <span>💬</span>
            <strong>Obrolan Room</strong>
            <span className="chat-count-tag">{chats.length}</span>
          </div>
          {isMobile && (
            <button
              type="button"
              className="chat-close-btn"
              onClick={() => setShowChatModal(false)}
            >
              ✕
            </button>
          )}
        </div>

        {/* Message Feed */}
        <div className="chat-messages-container">
          {chats.length === 0 ? (
            <div className="chat-empty-hint">
              <span>💬</span>
              <p>Belum ada obrolan. Kirim pesan ke teman bermain!</p>
            </div>
          ) : (
            chats.map(chat => {
              const isMe = chat.senderId === playerId;
              const senderColor = COLOR_INFO[chat.senderColor]?.hex || '#ff6200';
              return (
                <div key={chat.id} className={`chat-item ${isMe ? 'chat-me' : 'chat-other'}`}>
                  {!isMe && (
                    <span
                      className="chat-sender-avatar"
                      style={{ background: senderColor }}
                    >
                      {chat.senderName?.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="chat-bubble">
                    <div className="chat-meta">
                      <span className="chat-name" style={{ color: senderColor }}>
                        {isMe ? 'Kamu' : chat.senderName}
                      </span>
                      <span className="chat-time">{chat.time}</span>
                    </div>
                    <div className="chat-text">{chat.text}</div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={isMobile ? mobileChatEndRef : chatEndRef} />
        </div>

        {/* Quick Chat Pills */}
        <div className="quick-chat-pills-row">
          {quickChats.map(qc => (
            <button
              key={qc}
              type="button"
              className="quick-chat-pill"
              onClick={() => handleSendChat(null, qc)}
            >
              {qc}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={e => handleSendChat(e)} className="chat-input-bar">
          <input
            type="text"
            placeholder="Tulis pesan obrolan..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            maxLength={120}
            className="chat-input-box"
          />
          <button
            type="submit"
            className="chat-send-action-btn"
            disabled={!chatInput.trim()}
            title="Kirim Pesan"
          >
            ➤
          </button>
        </form>
      </div>
    );
  };

  const renderNetworkIndicator = (isCompact = false) => {
    let quality = 'excellent'; // 'excellent' | 'good' | 'poor' | 'disconnected'
    let qualityText = 'Sinyal Stabil';
    let barsCount = 4;

    if (!isConnected || isReconnecting) {
      quality = 'disconnected';
      qualityText = 'Menghubungkan Ulang...';
      barsCount = 0;
    } else if (ping === null) {
      quality = 'checking';
      qualityText = 'Memeriksa Sinyal...';
      barsCount = 2;
    } else if (ping < 100) {
      quality = 'excellent';
      qualityText = 'Sinyal Bagus & Stabil';
      barsCount = 4;
    } else if (ping < 250) {
      quality = 'good';
      qualityText = 'Sinyal Sedang';
      barsCount = 3;
    } else {
      quality = 'poor';
      qualityText = 'Sinyal Lemah / Tidak Stabil';
      barsCount = 1;
    }

    return (
      <div
        className={`network-status-capsule quality-${quality} ${isCompact ? 'compact' : ''}`}
        title={`Status Jaringan: ${qualityText} ${ping !== null && isConnected ? `(${ping}ms)` : ''}`}
      >
        <div className="network-signal-bars">
          <span className={`sig-bar bar-1 ${barsCount >= 1 ? 'bar-lit' : ''}`} />
          <span className={`sig-bar bar-2 ${barsCount >= 2 ? 'bar-lit' : ''}`} />
          <span className={`sig-bar bar-3 ${barsCount >= 3 ? 'bar-lit' : ''}`} />
          <span className={`sig-bar bar-4 ${barsCount >= 4 ? 'bar-lit' : ''}`} />
        </div>

        {/* Loading Spinner saat Reconnecting atau Sinyal Lemah */}
        {(!isConnected || isReconnecting || quality === 'poor') && (
          <span className="network-mini-spinner" />
        )}

        <span className="network-ping-text">
          {!isConnected || isReconnecting
            ? 'Menghubungkan...'
            : ping !== null
            ? `${ping}ms`
            : '...'}
        </span>
      </div>
    );
  };

  return (
    <main className="app">
      {/* Sticky Banner Loading Reconnect saat Sinyal Terputus / Tidak Stabil */}
      {(!isConnected || isReconnecting) && (
        <div className="network-reconnect-sticky-bar">
          <div className="network-reconnect-inner">
            <span className="network-reconnect-spinner" />
            <div className="network-reconnect-msg">
              <strong>⚠️ Sinyal Internet Tidak Stabil</strong>
              <span>Sedang menghubungkan kembali ke server JakLudo...</span>
            </div>
          </div>
        </div>
      )}

      {/* Header: Saat pertandingan berlangsung, di atasnya dikosongkan kecuali kode room font kecil saja */}
      {screen === 'room' && room?.started ? (
        <div className="gameplay-minimal-header">
          <div className="gameplay-header-left">
            <span className="gameplay-small-code">
              Room: <strong>#{room.code}</strong>
            </span>
            {blackHoleActive && (
              <span className="gameplay-small-bh">🕳️ Black Hole ON</span>
            )}
          </div>
          <div className="gameplay-header-right">
            {/* Indikator Sinyal & Latensi Kompak */}
            {renderNetworkIndicator(true)}
            <button
              type="button"
              className="gameplay-shop-mini"
              onClick={() => {
                sound.playClick();
                setShowShopModal(true);
              }}
              title="Buka Toko Item JakLudo"
            >
              🏪 Toko
            </button>
            {!isInstalled && (
              <button
                type="button"
                className="gameplay-install-mini"
                onClick={handleInstallApp}
                title="Pasang Aplikasi JakLudo"
              >
                📲 App
              </button>
            )}
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
            {/* Tombol Toko Item / Shop */}
            <button
              type="button"
              className="shop-nav-btn"
              onClick={() => {
                sound.playClick();
                setShowShopModal(true);
              }}
              title="Buka Toko Item JakLudo"
            >
              🏪 <span className="shop-nav-text">Toko</span>
              {currentUser && (
                <span className="shop-nav-badge">
                  💎 {currentUser.points ?? 0}
                </span>
              )}
            </button>

            {/* Tombol Pasang PWA App */}
            {!isInstalled && (
              <button
                type="button"
                className="pwa-install-header-btn"
                onClick={handleInstallApp}
                title="Pasang Aplikasi JakLudo"
              >
                📲 <span className="pwa-install-text">Pasang App</span>
              </button>
            )}

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

            {/* Indikator Kualitas Jaringan & Sinyal */}
            {renderNetworkIndicator(false)}
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

      {/* Toast Pop-Up Notifikasi Pesan Chat Baru Realtime */}
      {chatToast && (
        <div
          className="chat-toast-popup"
          key={chatToast.id}
          onClick={() => {
            sound.playClick();
            setShowChatModal(true);
            setUnreadChats(0);
            setChatToast(null);
          }}
          title="Klik untuk membuka percakapan"
        >
          <div
            className="chat-toast-avatar"
            style={{ background: COLOR_INFO[chatToast.senderColor]?.hex || '#ff6200' }}
          >
            {chatToast.senderName ? chatToast.senderName.slice(0, 1).toUpperCase() : '💬'}
          </div>
          <div className="chat-toast-body">
            <div className="chat-toast-header">
              <span
                className="chat-toast-sender"
                style={{ color: COLOR_INFO[chatToast.senderColor]?.hex || '#0f172a' }}
              >
                {chatToast.senderName}
              </span>
              <span className="chat-toast-tag">PESAN BARU</span>
            </div>
            <div className="chat-toast-text">{chatToast.text}</div>
          </div>
          <button
            type="button"
            className="chat-toast-close"
            onClick={(e) => {
              e.stopPropagation();
              setChatToast(null);
            }}
            title="Tutup Notifikasi"
          >
            ✕
          </button>
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

            {/* PWA Install Promo Strip on Home */}
            {!isInstalled && (
              <div className="pwa-home-banner">
                <div className="pwa-home-left">
                  <span className="pwa-app-icon">📲</span>
                  <div>
                    <strong>Pasang JakLudo di HP / Komputer</strong>
                    <p>Main lebih cepat, layar penuh tanpa browser bar, dan hemat kuota!</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="pwa-home-btn"
                  onClick={handleInstallApp}
                  title="Pasang Aplikasi JakLudo"
                >
                  ⚡ Pasang Gratis
                </button>
              </div>
            )}

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
                      storage.remove('active_room');
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
                      <div className="logged-sub-row">
                        <small className="logged-handle">@{currentUser.username}</small>
                        <span className="logged-points-chip">
                          💎 <strong>{currentUser.points ?? 0}</strong> Poin
                        </span>
                        <button
                          type="button"
                          className="logged-shop-btn"
                          onClick={() => {
                            sound.playClick();
                            setShowShopModal(true);
                          }}
                          title="Buka Toko Item"
                        >
                          🏪 Toko Item
                        </button>
                      </div>
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
                    {/* Alert Notifikasi Saat Ada Pemain yang Mendapatkan Skill Eliminasi */}
                    {skillUnlockNotice && (
                      <div className={`skill-unlock-alert-banner ${skillUnlockNotice.isMe ? 'alert-self' : 'alert-enemy'}`}>
                        <div className="alert-bolt-icon">⚡</div>
                        <div className="alert-content">
                          <strong>
                            {skillUnlockNotice.isMe
                              ? '⚡ SKILL ELIMINASI AKTIF! (3 Bidak Masuk Garis Akhir)'
                              : `⚠️ PERINGATAN DARURAT: ${skillUnlockNotice.playerName.toUpperCase()} MEMPEROLEH SKILL ELIMINASI!`}
                          </strong>
                          <p>
                            {skillUnlockNotice.isMe
                              ? 'Poin skill terisi! Kamu dapat mengeliminasi 1 bidak lawan di lintasan saat giliranmu!'
                              : `Bidak ${skillUnlockNotice.playerName} sudah 3 finish. Waspadalah! Bidakmu yang ada di lintasan dapat disambar petir & dieliminasi!`}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="alert-close-btn"
                          onClick={() => setSkillUnlockNotice(null)}
                          title="Tutup Peringatan"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Alert Notifikasi Item Toko (Blackhole Shield / Force Return) */}
                    {itemNotice && (
                      <div className={`skill-unlock-alert-banner alert-${itemNotice.type}`}>
                        <div className="alert-bolt-icon">{itemNotice.icon}</div>
                        <div className="alert-content">
                          <strong>{itemNotice.title}</strong>
                          <p>{itemNotice.text}</p>
                        </div>
                        <button
                          type="button"
                          className="alert-close-btn"
                          onClick={() => setItemNotice(null)}
                          title="Tutup Peringatan"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <LudoBoard
                      room={room}
                      myPlayerId={playerId}
                      isMyTurn={isTurn}
                      movablePawns={movablePawns}
                      onMovePawn={handleMovePawn}
                      skillTargeting={skillTargeting || forceReturnTargeting}
                      onSelectSkillTarget={handleSelectSkillTarget}
                    />

                    {/* Force Return Banner: Tampil saat memiliki item Force Return dan sudah minimal 3x injak */}
                    {isTurn && (me?.inventory?.forceReturn || 0) > 0 && (me?.stompCount || 0) >= 3 && room?.dice === null && !room?.rolling && !room?.animatingMove && (
                      <div className="skill-control-banner force-return-control-banner">
                        <div className="skill-banner-head">
                          <span className="skill-bolt-anim">⚡</span>
                          <div className="skill-banner-text">
                            <strong>⚡ FORCE RETURN AKTIF! (Sudah 3x Injak Bidak Lawan)</strong>
                            <small>
                              Injakan: <strong>{me.stompCount}/3</strong> · Tersisa <strong>{me.inventory.forceReturn}</strong>x item Force Return
                            </small>
                          </div>
                        </div>

                        <div className="skill-banner-actions">
                          <button
                            type="button"
                            className={`btn-use-skill btn-force-active ${forceReturnTargeting ? 'targeting-active' : ''}`}
                            onClick={() => {
                              sound.playClick();
                              setForceReturnTargeting(!forceReturnTargeting);
                              setSkillTargeting(false);
                            }}
                          >
                            {forceReturnTargeting ? '❌ Batal Pilih Target' : '⚡ Gunakan Force Return (Eliminasi Langsung)'}
                          </button>
                        </div>

                        {forceReturnTargeting && (
                          <div className="skill-target-help">
                            🎯 <em>Klik bidak lawan manapun di arena untuk langsung memulangkannya ke markas!</em>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Skill Ultimate Banner: Tampil saat 3 bidak finish dan pemain punya poin skill */}
                    {isTurn && (room?.pawns?.[playerId]?.filter(v => v === 44).length || 0) >= 3 && (me?.skillPoints || 0) > 0 && room?.dice === null && !room?.rolling && !room?.animatingMove && (
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
                            className="mobile-emoji-pill mobile-chat-pill"
                            onClick={() => {
                              sound.playClick();
                              setShowChatModal(true);
                              setUnreadChats(0);
                            }}
                            title="Buka Obrolan Room"
                          >
                            💬 {unreadChats > 0 && <span className="mobile-chat-badge">{unreadChats}</span>}
                          </button>
                          <button
                            type="button"
                            className="mobile-emoji-pill mobile-skor-pill"
                            onClick={() => setShowStatsModal(true)}
                            title="Buka Skor"
                          >
                            📊
                          </button>
                          <button
                            type="button"
                            className="mobile-emoji-pill mobile-shop-pill"
                            onClick={() => {
                              sound.playClick();
                              setShowShopModal(true);
                            }}
                            title="Buka Toko Item"
                          >
                            🏪
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

                  {/* Inventaris Item Pemain & Shortcut Toko */}
                  <div className="game-inventory-card">
                    <div className="game-inventory-header">
                      <span className="inv-title">🎒 INVENTARIS ITEM</span>
                      <button
                        type="button"
                        className="inv-shop-link-btn"
                        onClick={() => {
                          sound.playClick();
                          setShowShopModal(true);
                        }}
                        title="Buka Toko Item"
                      >
                        🏪 Buka Toko
                      </button>
                    </div>
                    <div className="game-inventory-chips">
                      <div className={`inv-chip ${me?.inventory?.blackholeShield ? 'has-item' : 'zero-item'}`} title="Melindungi otomatis dari sedotan Black Hole">
                        <span className="inv-chip-emoji">🛡️</span>
                        <div className="inv-chip-details">
                          <span className="inv-chip-label">Blackhole Shield</span>
                          <strong className="inv-chip-qty">{me?.inventory?.blackholeShield || 0} buah</strong>
                        </div>
                      </div>

                      <div className={`inv-chip ${me?.inventory?.forceReturn ? 'has-item' : 'zero-item'}`} title="Eliminasi langsung saat sudah 3x injak">
                        <span className="inv-chip-emoji">⚡</span>
                        <div className="inv-chip-details">
                          <span className="inv-chip-label">Force Return</span>
                          <strong className="inv-chip-qty">
                            {me?.inventory?.forceReturn || 0} buah
                            <span className="inv-stomp-tag">({me?.stompCount || 0}/3)</span>
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Chat Panel Realtime */}
                  {renderChatBox(false)}
                </div>
              </div>

              {/* Chat Bottom Sheet Drawer for Mobile */}
              {showChatModal && (
                <div className="stats-modal-overlay" onClick={() => setShowChatModal(false)}>
                  <div className="stats-bottom-sheet mobile-chat-sheet" onClick={e => e.stopPropagation()}>
                    <div className="sheet-handle" />
                    {renderChatBox(true)}
                  </div>
                </div>
              )}

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

      {/* Toko Item / Shop JakLudo (Blackhole Shield & Force Return) */}
      <ShopModal
        isOpen={showShopModal}
        onClose={() => setShowShopModal(false)}
        currentUser={currentUser}
        onUpdateUser={setCurrentUser}
        authToken={authToken}
      />

      {/* Modal Panduan Pasang PWA untuk iOS Safari */}
      {showIosInstallGuide && (
        <div className="modal-overlay" onClick={() => setShowIosInstallGuide(false)}>
          <div className="ios-install-card" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="sheet-close-btn"
              onClick={() => setShowIosInstallGuide(false)}
            >
              ✕
            </button>
            <div className="ios-install-icon">📲</div>
            <h3>Pasang JakLudo di iPhone / iPad</h3>
            <p>Ikuti 2 langkah mudah berikut untuk menambahkan JakLudo ke Layar Utama:</p>
            <ol className="ios-install-steps">
              <li>
                Ketuk tombol <strong>Bagikan (Share)</strong> <span className="ios-icon-box">⎋</span> di bilah bawah browser Safari.
              </li>
              <li>
                Geser ke bawah dan pilih <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong> <span className="ios-icon-box">➕</span>.
              </li>
            </ol>
            <button
              type="button"
              className="primary btn-ios-done"
              onClick={() => setShowIosInstallGuide(false)}
            >
              Mengerti, Siap Main!
            </button>
          </div>
        </div>
      )}

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
              storage.remove('active_room');
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
