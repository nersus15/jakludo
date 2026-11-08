import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { storage } from '../storage';
import { sound } from '../sound';
import { triggerConfetti } from '../confetti';

const roomFromUrl = () => new URLSearchParams(location.search).get('room') || '';

// Koneksi socket, state room, chat, notifikasi permainan, dan semua aksi pemain
export function useGameRoom({ authToken, currentUser, onNeedLogin }) {
  // WebSocket dicoba lebih dulu (lebih stabil lewat tunnel/proxy), polling hanya cadangan
  const socket = useMemo(() => io({
    autoConnect: true,
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000
  }), []);

  const [screen, setScreen] = useState('home');
  const [code, setCode] = useState(roomFromUrl);
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState('');
  const [chats, setChats] = useState([]);
  const [unreadChats, setUnreadChats] = useState(0);
  const [chatToast, setChatToast] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [memberNotice, setMemberNotice] = useState(null);
  const [skillNotice, setSkillNotice] = useState(null);
  const [itemNotice, setItemNotice] = useState(null);
  const [skillTargeting, setSkillTargeting] = useState(false);
  // Item aktif yang sedang menunggu pemain memilih target (id item), null jika tidak ada
  const [itemTargeting, setItemTargeting] = useState(null);

  const chatOpenRef = useRef(false);
  const chatToastTimer = useRef(null);
  const errorTimer = useRef(null);
  const hasCelebrated = useRef(false);
  const lastSkillUnlockId = useRef(null);
  const lastItemEventId = useRef(null);
  // Saat baru masuk/kembali ke room, event lama (skill, item) tidak boleh diputar ulang
  const seedEvents = useRef(false);
  const playerIdRef = useRef('');
  playerIdRef.current = playerId;

  const showError = useCallback(message => {
    setError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(''), 5000);
  }, []);

  const resetRoomState = useCallback(() => {
    setRoom(null);
    setChats([]);
    setPlayerId('');
    setUnreadChats(0);
    setSkillTargeting(false);
    setItemTargeting(null);
    setScreen('home');
  }, []);

  // Gabung (ulang) ke room setiap kali socket tersambung: saat halaman dibuka (link undangan /
  // sesi tersimpan) dan setelah koneksi sempat putus, karena server memberi socket id baru.
  const rejoinRef = useRef(null);
  rejoinRef.current = () => {
    const savedRoom = storage.get('active_room') || roomFromUrl();
    if (!savedRoom) return;
    socket.emit('room:join', {
      code: savedRoom,
      sessionId: storage.get('session_id'),
      token: storage.get('token') || authToken,
      name: currentUser?.name || 'Pemain'
    });
  };

  useEffect(() => {
    const onConnect = () => rejoinRef.current();
    socket.on('connect', onConnect);
    if (socket.connected) onConnect();
    return () => socket.off('connect', onConnect);
  }, [socket]);

  useEffect(() => {
    const handlers = {
      'room:joined': d => {
        seedEvents.current = true;
        setPlayerId(d.playerId);
        setCode(d.code);
        if (d.sessionId) storage.set('session_id', d.sessionId);
        storage.set('active_room', d.code);
        history.replaceState({}, '', `?room=${d.code}`);
        setScreen('room');
        setError('');
        if (d.reconnected) sound.playClick();
      },

      'room:update': updated => {
        if (seedEvents.current) {
          seedEvents.current = false;
          lastSkillUnlockId.current = updated.lastSkillUnlock?.id ?? null;
          lastItemEventId.current = updated.lastItemEvent?.id ?? null;
          // Kembali ke room yang sudah selesai tidak perlu memutar ulang perayaan menang
          hasCelebrated.current = !!updated.winner;
        }
        setRoom(updated);

        if (updated.winner) {
          if (!hasCelebrated.current) {
            hasCelebrated.current = true;
            sound.playWin();
            triggerConfetti();
          }
        } else {
          hasCelebrated.current = false;
        }

        const me = updated.players?.find(p => p.id === playerIdRef.current);
        if (me?.isOut) storage.remove('active_room');
      },

      'room:chats': list => setChats(Array.isArray(list) ? list : []),

      'room:chat_message': msg => {
        setChats(prev => [...prev.slice(-49), msg]);
        if (msg.senderId === playerIdRef.current) return;
        sound.playChatNotification();
        if (!chatOpenRef.current) setUnreadChats(n => n + 1);
        setChatToast(msg);
        if (chatToastTimer.current) clearTimeout(chatToastTimer.current);
        chatToastTimer.current = setTimeout(() => setChatToast(null), 4200);
      },

      'room:reaction': reaction => {
        setReactions(prev => [...prev.slice(-8), reaction]);
        setTimeout(() => setReactions(prev => prev.filter(r => r.id !== reaction.id)), 2600);
      },

      'room:member_joined': data => {
        if (data.playerId === socket.id) return; // Notifikasi untuk diri sendiri tidak perlu
        sound.playJoinNotification();
        const id = Date.now() + Math.random();
        setMemberNotice({
          id,
          avatar: data.avatar || '🎲',
          text: data.reconnected ? `${data.name} kembali masuk` : `${data.name} bergabung ke room`
        });
        setTimeout(() => setMemberNotice(prev => (prev?.id === id ? null : prev)), 3500);
      },

      'room:error': err => {
        showError(err);
        if (err.includes('tab atau perangkat lain')) {
          // Sesi diambil alih tab lain: jangan hapus sesi tersimpan yang kini dipakai tab tersebut
          resetRoomState();
          return;
        }
        if (err.includes('tidak ditemukan') || err.includes('OUT') || err.includes('penuh')) {
          storage.remove('active_room');
          if (location.search.includes('room=')) {
            history.replaceState({}, '', location.pathname);
            setCode('');
          }
          // Room sudah tidak ada / tidak bisa dimasuki: jangan biarkan pemain di layar room yang basi
          resetRoomState();
        }
      }
    };

    for (const [event, fn] of Object.entries(handlers)) socket.on(event, fn);
    return () => {
      for (const [event, fn] of Object.entries(handlers)) socket.off(event, fn);
    };
  }, [socket, showError, resetRoomState]);

  // Peringatan saat ada pemain yang membuka Skill Eliminasi
  useEffect(() => {
    const event = room?.lastSkillUnlock;
    if (!event || event.id === lastSkillUnlockId.current) return undefined;
    lastSkillUnlockId.current = event.id;
    setSkillNotice({ ...event, isMe: event.playerId === playerId });
    sound.playThunderSkill();
    const timer = setTimeout(() => setSkillNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [room?.lastSkillUnlock, playerId]);

  // Pengumuman item ke semua pemain (perisai aktif, item dipakai, item gratis didapat)
  useEffect(() => {
    const event = room?.lastItemEvent;
    if (!event || event.id === lastItemEventId.current) return undefined;
    lastItemEventId.current = event.id;
    setItemNotice({ id: event.id, icon: event.icon, title: event.title, text: event.text });
    if (event.sound === 'thunder') sound.playThunderSkill();
    else sound.playJoinNotification();
    const timer = setTimeout(() => setItemNotice(null), 5500);
    return () => clearTimeout(timer);
  }, [room?.lastItemEvent]);

  // Musik latar hanya berbunyi di dalam room
  useEffect(() => {
    sound.setInRoom(screen === 'room');
  }, [screen]);

  // ---------- Turunan state ----------

  const me = room?.players?.find(p => p.id === playerId) || null;
  const currentTurnPlayer = room?.players?.[room.turn] || null;
  const isTurn = !!currentTurnPlayer && currentTurnPlayer.id === playerId;
  const canAct = isTurn && room?.dice === null && !room?.rolling && !room?.animatingMove;

  // Bidak yang boleh dijalankan dihitung server (satu sumber aturan main)
  const movablePawns = useMemo(
    () => (isTurn && room?.dice !== null && !room?.animatingMove ? room?.movable || [] : []),
    [room, isTurn]
  );

  // Mode pilih target item batal otomatis saat giliran lewat atau dadu sudah dilempar
  useEffect(() => {
    if (!isTurn || room?.dice !== null) setItemTargeting(null);
  }, [isTurn, room?.dice]);

  // ---------- Aksi ----------

  const requireLogin = () => {
    if (currentUser) return true;
    showError('Masuk atau daftar akun JakLudo dulu untuk bermain.');
    onNeedLogin?.();
    return false;
  };

  const createRoom = () => {
    if (!requireLogin()) return;
    sound.playClick();
    setError('');
    socket.emit('room:create', { name: currentUser.name, token: authToken });
  };

  const joinRoom = targetCode => {
    if (!requireLogin()) return;
    const clean = String(targetCode || code || '').trim().toUpperCase();
    if (!clean) return showError('Kode room wajib diisi.');
    sound.playClick();
    setError('');
    socket.emit('room:join', { name: currentUser.name, token: authToken, sessionId: storage.get('session_id'), code: clean });
  };

  const leaveRoom = () => {
    sound.playClick();
    const currentCode = room?.code || code;
    storage.remove('active_room', 'session_id');
    if (currentCode) socket.emit('room:leave', { code: currentCode });
    resetRoomState();
    setCode('');
    setError('');
    history.replaceState({}, '', location.pathname);
  };

  const emitWithClick = (event, payload) => {
    sound.playClick();
    socket.emit(event, payload);
  };

  const movePawn = useCallback(pawnIdx => {
    socket.emit('game:move', { pawn: pawnIdx });
    setSkillTargeting(false);
  }, [socket]);

  // Auto-move: jika hanya ada 1 bidak yang bisa jalan, jalankan otomatis
  useEffect(() => {
    if (!isTurn || room?.dice === null || room?.rolling || room?.animatingMove || movablePawns.length !== 1) return undefined;
    const timer = setTimeout(() => movePawn(movablePawns[0]), 380);
    return () => clearTimeout(timer);
  }, [isTurn, room?.dice, room?.rolling, room?.animatingMove, movablePawns, movePawn]);

  const selectTarget = (targetPlayerId, targetPawnIdx) => {
    sound.playClick();
    const target = { playerId: targetPlayerId, pawnIdx: targetPawnIdx };
    if (itemTargeting) {
      socket.emit('game:use_item', { itemId: itemTargeting, target });
      setItemTargeting(null);
    } else {
      socket.emit('game:use_skill', { target });
      setSkillTargeting(false);
    }
  };

  const actions = {
    createRoom,
    joinRoom,
    leaveRoom,
    setCode,
    addBot: () => emitWithClick('room:add_bot'),
    removeBot: () => emitWithClick('room:remove_bot'),
    toggleSafeZones: () => emitWithClick('room:update_settings', { safeZones: room?.settings?.safeZones === false }),
    toggleBlackHole: () => emitWithClick('room:update_settings', { blackHole: !room?.settings?.blackHole }),
    setBlackHoleMode: mode => emitWithClick('room:update_settings', { blackHoleMode: mode }),
    startGame: () => emitWithClick('game:start'),
    restartGame: () => emitWithClick('game:restart'),
    rollDice: () => socket.emit('game:roll'),
    movePawn,
    selectTarget,
    toggleSkillTargeting: () => {
      sound.playClick();
      setSkillTargeting(v => !v);
      setItemTargeting(null);
    },
    setItemTargeting: id => {
      setItemTargeting(id);
      setSkillTargeting(false);
    },
    useItem: itemId => socket.emit('game:use_item', { itemId }),
    accumulateSkill: () => {
      emitWithClick('game:accumulate_skill');
      setSkillTargeting(false);
    },
    sendReaction: emoji => emitWithClick('game:reaction', { emoji }),
    sendChat: text => {
      const clean = String(text || '').trim();
      if (!clean) return false;
      emitWithClick('room:chat', { text: clean });
      return true;
    },
    setChatOpen: open => {
      chatOpenRef.current = open;
      if (open) setUnreadChats(0);
    },
    dismissChatToast: () => setChatToast(null),
    dismissSkillNotice: () => setSkillNotice(null),
    dismissItemNotice: () => setItemNotice(null)
  };

  return {
    socket,
    screen,
    code,
    room,
    playerId,
    me,
    currentTurnPlayer,
    isTurn,
    canAct,
    movablePawns,
    error,
    chats,
    unreadChats,
    chatToast,
    reactions,
    memberNotice,
    skillNotice,
    itemNotice,
    skillTargeting,
    itemTargeting,
    actions
  };
}
