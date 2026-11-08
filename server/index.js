const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const {
  COLORS,
  COLOR_OFFSETS,
  SAFE_TRACK_INDICES,
  BLACK_HOLE_INDICES,
  FINISH,
  getTrackIndex,
  nextFreeColor,
  canPawnMove,
  getMovablePawns,
  chooseBestPawn,
  isPawnIndex
} = require('./rules');

const app = express();
// Set TRUST_PROXY=1 jika server berada di belakang Nginx agar req.ip memakai X-Forwarded-For
if (process.env.TRUST_PROXY && process.env.TRUST_PROXY !== '0') {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}
// Klien dilayani dari origin yang sama (Vite dev memakai proxy). CORS hanya dibuka bila diminta.
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : null;
if (corsOrigin) app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10kb' }));
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 16 * 1024,
  // Lebih toleran terhadap jeda jaringan HP / tunnel: koneksi baru dianggap putus
  // setelah tidak ada balasan ping selama pingInterval + pingTimeout (25 + 30 detik).
  pingInterval: 25000,
  pingTimeout: 30000,
  ...(corsOrigin ? { cors: { origin: corsOrigin } } : {})
});

const rooms = new Map();
const BOT_NAMES = { red: 'Bot Merah', green: 'Bot Hijau', yellow: 'Bot Kuning', blue: 'Bot Biru' };
const EMOJIS = ['🎲', '🔥', '👏', '😂', '😭', '👑', '⚡', '🎯'];
const ROOM_IDLE_TTL_MS = 5 * 60 * 1000;
const TURN_TIMEOUT_MS = 15000;
// Pemain yang koneksinya putus diberi waktu tersambung ulang sebelum gilirannya dimainkan sistem
const DISCONNECTED_TURN_DELAY_MS = 8000;
// Pemain yang terputus baru bisa dinyatakan OUT setelah offline selama ini (bukan karena sinyal goyang)
const OFFLINE_OUT_MS = 2 * 60 * 1000;
// Kursi di lobby ditahan selama ini setelah koneksi putus
const LOBBY_SEAT_GRACE_MS = 2 * 60 * 1000; // cukup untuk membagikan link undangan lewat aplikasi lain

const makeRoomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const makeSessionId = () => 'sess_' + crypto.randomBytes(12).toString('hex');

// ==========================================
// UTILITAS: rate limit, handler & timer yang aman
// ==========================================

function createLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, h] of hits) if (h.reset < now) hits.delete(k);
  }, windowMs).unref();
  return key => {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(key, h);
    }
    h.count++;
    return h.count <= max;
  };
}

const loginLimiter = createLimiter({ windowMs: 10 * 60 * 1000, max: 10 });
const registerLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const chatLimiter = createLimiter({ windowMs: 5000, max: 5 });
const reactionLimiter = createLimiter({ windowMs: 5000, max: 8 });

// Payload dari klien tidak bisa dipercaya: selalu objek, dan error di handler
// tidak boleh menjatuhkan proses (yang akan menghapus semua room).
function on(socket, event, handler) {
  socket.on(event, (...args) => {
    const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
    const payload = args[0] && typeof args[0] === 'object' ? args[0] : {};
    try {
      handler(payload, cb);
    } catch (err) {
      console.error(`[socket ${event}]`, err);
    }
  });
}

function roomTimeout(room, fn, ms) {
  return setTimeout(() => {
    if (rooms.get(room.code) !== room) return;
    try {
      fn();
    } catch (err) {
      console.error(`[room ${room.code}] timer error`, err);
    }
  }, ms);
}

// ==========================================
// STATE ROOM
// ==========================================

function publicPlayer(p) {
  const { sessionId, ...rest } = p; // sessionId adalah rahasia reconnect, jangan disiarkan
  return rest;
}

function publicRoom(r) {
  const current = r.players[r.turn];
  const movable = r.started && !r.winner && r.dice !== null && !r.rolling && !r.animatingMove && current
    ? getMovablePawns(r, current, r.dice)
    : [];
  return {
    code: r.code,
    host: r.host,
    players: r.players.map(publicPlayer),
    started: r.started,
    turn: r.turn,
    dice: r.dice,
    movable,
    rolling: !!r.rolling,
    animatingMove: r.animatingMove || null,
    winner: r.winner,
    pawns: r.pawns,
    message: r.message,
    lastCapture: r.lastCapture || null,
    lastBlackHole: r.lastBlackHole || null,
    lastGoal: r.lastGoal || null,
    lastSkillUse: r.lastSkillUse || null,
    lastSkillUnlock: r.lastSkillUnlock || null,
    lastShieldProtect: r.lastShieldProtect || null,
    lastForceReturnReady: r.lastForceReturnReady || null,
    lastForceReturnUse: r.lastForceReturnUse || null,
    history: r.history || [],
    settings: r.settings || { safeZones: true, blackHole: false }
  };
}

function emitRoom(room) {
  if (!room) return;
  io.to(room.code).emit('room:update', publicRoom(room));
}

function addHistory(room, text) {
  room.history.unshift({
    id: Date.now() + Math.random(),
    text,
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  });
  if (room.history.length > 15) room.history.pop();
}

function clearRoomTimers(r) {
  if (!r) return;
  for (const key of ['botTimeout', 'rollTimer', 'passTimer', 'moveTimer', 'turnTimer']) {
    if (r[key]) clearTimeout(r[key]);
    r[key] = null;
  }
}

function deleteRoom(room) {
  clearRoomTimers(room);
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
  for (const timer of room.lobbyRemovals.values()) clearTimeout(timer);
  rooms.delete(room.code);
}

function hasConnectedHuman(room) {
  return room.players.some(p => !p.isBot && p.connected && !p.left);
}

// Room yang sudah selesai atau ditinggal semua manusia dihapus setelah 5 menit
function scheduleCleanup(room) {
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
  room.cleanupTimer = setTimeout(() => {
    room.cleanupTimer = null;
    if (rooms.get(room.code) !== room) return;
    if (room.winner || !hasConnectedHuman(room)) deleteRoom(room);
  }, ROOM_IDLE_TTL_MS);
  room.cleanupTimer.unref();
}

function cancelCleanup(room) {
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
  room.cleanupTimer = null;
}

function removeLobbyPlayer(room, player) {
  room.players = room.players.filter(p => p !== player);
  delete room.pawns[player.id];
  if (!room.players.some(p => !p.isBot)) {
    deleteRoom(room);
    return;
  }
  if (room.host === player.id) reassignHost(room);
  emitRoom(room);
}

function cancelLobbyRemoval(room, player) {
  const timer = room.lobbyRemovals.get(player);
  if (timer) clearTimeout(timer);
  room.lobbyRemovals.delete(player);
}

function reassignHost(room) {
  const next = room.players.find(p => !p.isBot && p.connected && !p.left);
  if (!next) return;
  room.players.forEach(p => { p.isHost = p === next; });
  room.host = next.id;
}

function resetPlayerForGame(p) {
  p.autoPlayCount = 0;
  p.isOut = false;
  p.stompCount = 0;
  p.skillPoints = 0;
  p.skillUnlocked = false;
  p.finishedCount = 0;
  p.accumulatedThisTurn = false;
  if (p.userId) {
    const fresh = db.sanitizeUser(db.getUserById(p.userId));
    if (fresh) p.inventory = { ...fresh.inventory };
  }
}

function resetRoomEvents(r) {
  r.dice = null;
  r.rolling = false;
  r.animatingMove = null;
  r.winner = null;
  r.consecutiveSixes = 0;
  r.lastCapture = null;
  r.lastBlackHole = null;
  r.lastGoal = null;
  r.lastSkillUse = null;
  r.lastSkillUnlock = null;
  r.lastShieldProtect = null;
  r.lastForceReturnReady = null;
  r.lastForceReturnUse = null;
}

// ==========================================
// LOBBY: CREATE / JOIN / BOT
// ==========================================

function createRoom(socket, payload) {
  let code;
  do {
    code = makeRoomCode();
  } while (rooms.has(code));

  const room = {
    code,
    host: socket.id,
    players: [],
    started: false,
    turn: 0,
    pawns: {},
    message: 'Menunggu pemain bergabung...',
    history: [],
    chats: [],
    lobbyRemovals: new Map(),
    settings: { safeZones: true, blackHole: false },
    botTimeout: null,
    rollTimer: null,
    passTimer: null,
    moveTimer: null,
    turnTimer: null,
    cleanupTimer: null
  };
  resetRoomEvents(room);
  rooms.set(code, room);
  joinRoom(socket, code, payload);
}

function joinRoom(socket, code, payload) {
  const room = rooms.get(String(code || '').toUpperCase());
  if (!room) return socket.emit('room:error', 'Room tidak ditemukan. Periksa kembali kode room.');

  // Socket yang masih tercatat di room lain harus keluar dulu
  if (socket.data.room && socket.data.room !== room.code) {
    const prev = rooms.get(socket.data.room);
    if (prev) handleDeparture(socket, prev, { intentional: false });
    socket.leave(socket.data.room);
    delete socket.data.room;
  }

  const user = typeof payload.token === 'string' ? db.getUserByToken(payload.token) : null;
  const sessionId = typeof payload.sessionId === 'string' && payload.sessionId ? payload.sessionId : null;
  const rawName = typeof payload.name === 'string' ? payload.name : '';
  const finalName = user?.name || rawName.trim().slice(0, 18) || 'Pemain';

  // Reconnect hanya lewat bukti yang tidak bisa ditebak: sessionId rahasia atau token login
  const existingPlayer = room.players.find(p =>
    !p.isBot && ((sessionId && p.sessionId === sessionId) || (user && p.userId === user.id))
  );

  if (existingPlayer) {
    if (existingPlayer.isOut) {
      return socket.emit('room:error', 'Kamu telah dinyatakan OUT dari pertandingan ini.');
    }

    const oldSocketId = existingPlayer.id;
    if (oldSocketId !== socket.id) {
      // Room dibuka di tab/perangkat lain: putuskan socket lama dari room
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        oldSocket.leave(room.code);
        delete oldSocket.data.room;
        oldSocket.emit('room:error', 'Room ini dibuka di tab atau perangkat lain.');
      }
      room.pawns[socket.id] = room.pawns[oldSocketId] || [0, 0, 0, 0];
      delete room.pawns[oldSocketId];
      if (room.winner === oldSocketId) room.winner = socket.id;
    }

    existingPlayer.id = socket.id;
    existingPlayer.connected = true;
    existingPlayer.disconnectedAt = null;
    existingPlayer.autoPlayCount = 0;
    cancelLobbyRemoval(room, existingPlayer);
    if (user?.inventory) existingPlayer.inventory = { ...user.inventory };
    if (room.host === oldSocketId) {
      room.host = socket.id;
    } else if (!room.players.some(p => p.id === room.host && p.connected)) {
      reassignHost(room);
    }
    room.players.forEach(p => { p.isHost = p.id === room.host; });
    cancelCleanup(room);
    if (room.winner) scheduleCleanup(room);

    socket.join(room.code);
    socket.data.room = room.code;

    addHistory(room, `🎮 ${existingPlayer.name} kembali masuk ke dalam room.`);
    socket.emit('room:joined', {
      code: room.code,
      playerId: socket.id,
      sessionId: existingPlayer.sessionId,
      isLudoKing: existingPlayer.isLudoKing,
      reconnected: true
    });
    socket.emit('room:chats', room.chats);
    io.to(room.code).emit('room:member_joined', {
      name: existingPlayer.name,
      avatar: existingPlayer.avatar,
      playerId: socket.id,
      reconnected: true
    });
    emitRoom(room);

    if (room.started && room.players[room.turn]?.id === socket.id) {
      triggerTurn(room);
    }
    return;
  }

  if (room.started) return socket.emit('room:error', 'Permainan sudah dimulai.');
  if (room.players.length >= 4) return socket.emit('room:error', 'Room sudah penuh (maksimal 4 pemain).');

  const isKing = db.checkIsLudoKing(user?.id);
  const isFirstPlayer = room.players.length === 0;
  const player = {
    id: socket.id,
    sessionId: makeSessionId(),
    userId: user?.id || null,
    username: user?.username || null,
    name: finalName,
    avatar: user?.avatar || '🎲',
    color: nextFreeColor(room.players),
    isHost: room.host === socket.id,
    isBot: false,
    isLudoKing: isKing,
    connected: true,
    autoPlayCount: 0,
    isOut: false,
    stompCount: 0,
    inventory: {
      blackholeShield: user?.inventory?.blackholeShield || 0,
      forceReturn: user?.inventory?.forceReturn || 0
    }
  };

  room.players.push(player);
  room.pawns[socket.id] = [0, 0, 0, 0];
  socket.join(room.code);
  socket.data.room = room.code;

  addHistory(room, `${player.isLudoKing ? '👑 [Ludo King] ' : ''}${player.name} bergabung ke dalam room.`);
  socket.emit('room:joined', {
    code: room.code,
    playerId: socket.id,
    sessionId: player.sessionId,
    isLudoKing: isKing,
    reconnected: false
  });
  socket.emit('room:chats', room.chats);

  if (!isFirstPlayer) {
    io.to(room.code).emit('room:member_joined', {
      name: player.name,
      avatar: player.avatar,
      playerId: socket.id,
      reconnected: false
    });
  }

  emitRoom(room);
}

function addBot(room, hostSocketId) {
  if (!room || room.started || room.players.length >= 4 || room.host !== hostSocketId) return;
  const botId = 'bot_' + crypto.randomBytes(5).toString('hex');
  const color = nextFreeColor(room.players);
  const bot = {
    id: botId,
    name: BOT_NAMES[color],
    color,
    isHost: false,
    isBot: true,
    connected: true,
    autoPlayCount: 0,
    isOut: false,
    stompCount: 0,
    inventory: { blackholeShield: 0, forceReturn: 0 }
  };
  room.players.push(bot);
  room.pawns[botId] = [0, 0, 0, 0];
  addHistory(room, `${bot.name} ditambahkan oleh host.`);
  emitRoom(room);
}

function removeBot(room, hostSocketId) {
  if (!room || room.started || room.host !== hostSocketId) return;
  for (let i = room.players.length - 1; i > 0; i--) {
    if (room.players[i].isBot) {
      const [removed] = room.players.splice(i, 1);
      delete room.pawns[removed.id];
      addHistory(room, `${removed.name} dikeluarkan.`);
      emitRoom(room);
      return;
    }
  }
}

// Pemain keluar (intentional = klik keluar/menyerah) atau koneksi terputus
function handleDeparture(socket, r, { intentional }) {
  const departing = r.players.find(p => p.id === socket.id);
  if (!departing) return;

  if (!r.started) {
    cancelLobbyRemoval(r, departing);
    if (intentional) {
      addHistory(r, `${departing.name} keluar dari ruang tunggu.`);
      removeLobbyPlayer(r, departing);
      return;
    }
    // Koneksi putus di lobby: kursi ditahan sebentar agar bisa tersambung ulang
    departing.connected = false;
    departing.disconnectedAt = Date.now();
    addHistory(r, `⚠️ ${departing.name} terputus dari ruang tunggu, menunggu tersambung ulang...`);
    if (r.host === socket.id) reassignHost(r);
    r.lobbyRemovals.set(departing, setTimeout(() => {
      r.lobbyRemovals.delete(departing);
      if (rooms.get(r.code) !== r || r.started || departing.connected) return;
      addHistory(r, `${departing.name} meninggalkan ruang tunggu.`);
      removeLobbyPlayer(r, departing);
    }, LOBBY_SEAT_GRACE_MS));
    emitRoom(r);
    return;
  }

  departing.connected = false;

  if (intentional) {
    const wasActive = !departing.isOut;
    departing.isOut = true;
    departing.left = true;
    departing.sessionId = null;
    addHistory(r, `🚪 ${departing.name} keluar dari permainan (menyerah).`);

    if (!r.players.some(p => !p.isBot && !p.isOut)) {
      deleteRoom(r);
      return;
    }
    if (r.host === socket.id) reassignHost(r);

    if (!r.winner && wasActive) {
      const activeRemaining = r.players.filter(p => !p.isOut);
      if (activeRemaining.length === 1) {
        declareWinner(r, activeRemaining[0]);
      } else if (r.players[r.turn]?.id === departing.id) {
        advanceTurn(r);
      }
    }
  } else {
    departing.disconnectedAt = Date.now();
    addHistory(r, `⚠️ ${departing.name} keluar web/terputus (dimainkan bot sementara).`);
    if (r.host === socket.id) reassignHost(r);
    if (!r.winner && r.players[r.turn]?.id === departing.id) triggerTurn(r);
  }

  if (!hasConnectedHuman(r)) scheduleCleanup(r);
  emitRoom(r);
}

// ==========================================
// ALUR PERMAINAN
// ==========================================

function startGame(r) {
  for (const timer of r.lobbyRemovals.values()) clearTimeout(timer);
  r.lobbyRemovals.clear();
  clearRoomTimers(r);
  cancelCleanup(r);
  resetRoomEvents(r);
  r.started = true;
  r.turn = 0;
  for (const p of r.players) {
    r.pawns[p.id] = [0, 0, 0, 0];
    resetPlayerForGame(p);
  }
}

function declareWinner(room, winnerPlayer) {
  if (!room || room.winner) return;
  clearRoomTimers(room);
  room.winner = winnerPlayer.id;
  room.dice = null;
  room.message = `🏆 SELAMAT! ${winnerPlayer.name} MENANG!`;
  addHistory(room, `🎉 ${winnerPlayer.name} berhasil memenangkan pertandingan JakLudo!`);

  db.recordMatchResult({ winnerPlayerId: winnerPlayer.id, players: room.players });
  room.players.forEach(p => {
    p.isLudoKing = db.checkIsLudoKing(p.userId);
  });

  io.emit('leaderboard:update', db.getLeaderboard());
  emitRoom(room);
  scheduleCleanup(room);
}

function advanceTurn(room) {
  if (!room || !room.started || room.winner) return;
  clearRoomTimers(room);

  const activePlayers = room.players.filter(p => !p.isOut);
  if (activePlayers.length <= 1) {
    if (activePlayers.length === 1) declareWinner(room, activePlayers[0]);
    return;
  }

  let nextTurn = (room.turn + 1) % room.players.length;
  let attempts = 0;
  while (room.players[nextTurn]?.isOut && attempts < room.players.length) {
    nextTurn = (nextTurn + 1) % room.players.length;
    attempts++;
  }

  room.turn = nextTurn;
  room.dice = null;
  room.consecutiveSixes = 0;
  room.players.forEach(p => { p.accumulatedThisTurn = false; });
  const nextPlayer = room.players[room.turn];
  room.message = `Giliran ${nextPlayer.name}${nextPlayer.autoPlayCount > 0 ? ` (Auto-Play ${nextPlayer.autoPlayCount}/3)` : ''}.`;

  emitRoom(room);
  triggerTurn(room);
}

function executeAutoPlay(room, player) {
  if (!room || !room.started || room.winner || room.rolling || room.animatingMove) return;
  if (room.players[room.turn]?.id !== player.id) return;

  // OUT setelah 3x auto-play berturut-turut: langsung jika pemain online tapi diam (AFK),
  // atau jika sudah offline cukup lama. Sinyal yang goyang sebentar tidak membuat pemain OUT.
  const offlineTooLong = !player.connected && Date.now() - (player.disconnectedAt || 0) >= OFFLINE_OUT_MS;
  if ((player.autoPlayCount || 0) >= 3 && (player.connected || offlineTooLong)) {
    player.isOut = true;
    player.autoPlayCount = 3;
    addHistory(room, `❌ ${player.name} dinyatakan OUT (batas 3x auto-play tercapai tanpa respon).`);
    room.message = `❌ ${player.name} dinyatakan OUT!`;
    advanceTurn(room);
    return;
  }

  player.autoPlayCount = Math.min(3, (player.autoPlayCount || 0) + 1);
  addHistory(room, `🤖 [Auto-Play ${player.autoPlayCount}/3] Bidak ${player.name} dijalankan otomatis oleh sistem.`);

  if (room.dice === null) {
    handleRoll(room, player.id, true);
  } else {
    const bestPawn = chooseBestPawn(room, player, room.dice);
    if (bestPawn !== null) handleMove(room, player.id, bestPawn, true);
  }
}

function triggerTurn(room) {
  if (!room || !room.started || room.winner || room.rolling || room.animatingMove) return;
  const currentPlayer = room.players[room.turn];
  if (!currentPlayer) return;

  if (room.botTimeout) clearTimeout(room.botTimeout);
  if (room.turnTimer) clearTimeout(room.turnTimer);

  if (currentPlayer.isOut) {
    advanceTurn(room);
    return;
  }

  if (currentPlayer.isBot) {
    if (room.dice === null) {
      room.botTimeout = roomTimeout(room, () => {
        if (room.players[room.turn]?.id === currentPlayer.id && room.dice === null && !room.animatingMove) {
          handleRoll(room, currentPlayer.id);
        }
      }, 700);
    } else {
      const bestPawn = chooseBestPawn(room, currentPlayer, room.dice);
      if (bestPawn !== null) {
        room.botTimeout = roomTimeout(room, () => {
          if (room.players[room.turn]?.id === currentPlayer.id && room.dice !== null && !room.animatingMove) {
            handleMove(room, currentPlayer.id, bestPawn);
          }
        }, 800);
      }
    }
    return;
  }

  // Pemain manusia: online -> batas waktu 15 detik, terputus -> tunggu sebentar agar sempat tersambung ulang
  const delay = currentPlayer.connected ? TURN_TIMEOUT_MS : DISCONNECTED_TURN_DELAY_MS;
  room.turnTimer = roomTimeout(room, () => {
    if (room.players[room.turn]?.id === currentPlayer.id) executeAutoPlay(room, currentPlayer);
  }, delay);
}

function handleRoll(room, playerId, isAuto = false) {
  if (!room || !room.started || room.winner) return;
  const currentPlayer = room.players[room.turn];
  if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.isOut) return;
  if (room.dice !== null || room.rolling || room.animatingMove) return;

  if (room.turnTimer) clearTimeout(room.turnTimer);

  if (!isAuto && !currentPlayer.isBot) currentPlayer.autoPlayCount = 0;

  // Pemain yang memegang skill eliminasi tetapi memilih melempar dadu: poin skill diakumulasi 2x
  if (currentPlayer.skillUnlocked && (currentPlayer.skillPoints || 0) > 0 && !currentPlayer.accumulatedThisTurn) {
    currentPlayer.skillPoints = currentPlayer.skillPoints * 2;
    currentPlayer.accumulatedThisTurn = true;
    addHistory(room, `⚡ ${currentPlayer.name} tidak menggunakan skill giliran ini: Poin skill diakumulasi menjadi ${currentPlayer.skillPoints}x!`);
  }

  room.rolling = true;
  room.message = `${currentPlayer.name} sedang mengocok dadu...`;
  emitRoom(room);

  if (room.rollTimer) clearTimeout(room.rollTimer);
  room.rollTimer = roomTimeout(room, () => {
    room.rolling = false;
    const roll = 1 + crypto.randomInt(6);
    room.dice = roll;

    room.consecutiveSixes = roll === 6 ? (room.consecutiveSixes || 0) + 1 : 0;

    if (room.consecutiveSixes >= 3) {
      room.message = `${currentPlayer.name} dapat angka 6 tiga kali berturut-turut! Giliran hangus.`;
      addHistory(room, `${currentPlayer.name} melempar 6 (3x berturut-turut) - giliran hangus!`);
      advanceTurn(room);
      return;
    }

    const movable = getMovablePawns(room, currentPlayer, roll);

    if (movable.length === 0) {
      room.message = `${currentPlayer.name} mendapatkan angka ${roll}, tetapi tidak ada bidak yang dapat melangkah.`;
      addHistory(room, `${currentPlayer.name} melempar dadu: ${roll} (tidak ada langkah valid)`);
      emitRoom(room);
      if (room.passTimer) clearTimeout(room.passTimer);
      room.passTimer = roomTimeout(room, () => advanceTurn(room), 1300);
      return;
    }

    room.message = `${currentPlayer.name} mendapatkan angka ${roll}! Pilih bidak untuk dijalankan.`;
    addHistory(room, `${currentPlayer.name} melempar dadu: ${roll}`);
    emitRoom(room);

    if (currentPlayer.isBot || isAuto || !currentPlayer.connected) {
      const bestPawn = chooseBestPawn(room, currentPlayer, roll);
      if (bestPawn !== null) {
        room.botTimeout = roomTimeout(room, () => {
          if (room.players[room.turn]?.id === currentPlayer.id && room.dice !== null && !room.animatingMove) {
            handleMove(room, currentPlayer.id, bestPawn, isAuto);
          }
        }, 800);
      }
    } else {
      triggerTurn(room);
    }
  }, 750);
}

function handleMove(room, playerId, pawnIdx, isAuto = false) {
  if (!room || !room.started || room.winner || room.rolling || room.animatingMove) return;
  const currentPlayer = room.players[room.turn];
  if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.isOut) return;
  if (room.dice === null) return;
  if (!isPawnIndex(pawnIdx)) return;
  if (!canPawnMove(room, currentPlayer, pawnIdx, room.dice)) return;

  if (room.turnTimer) clearTimeout(room.turnTimer);
  if (!isAuto && !currentPlayer.isBot) currentPlayer.autoPlayCount = 0;

  const currentPawns = room.pawns[playerId];
  const currentVal = currentPawns[pawnIdx];
  const colorIdx = COLORS.indexOf(currentPlayer.color);
  const rollVal = room.dice;
  const newVal = currentVal === 0 ? 1 : currentVal + rollVal;
  const steps = currentVal === 0 ? 1 : rollVal;
  const safeZonesActive = room.settings?.safeZones !== false;

  room.animatingMove = {
    id: Date.now() + Math.random(),
    playerId,
    pawnIdx,
    from: currentVal,
    to: newVal,
    steps,
    color: currentPlayer.color
  };

  room.lastCapture = null;
  room.lastBlackHole = null;
  room.lastGoal = null;

  currentPawns[pawnIdx] = newVal;
  room.message = `${currentPlayer.name} memajukan bidak ${pawnIdx + 1} (${steps} langkah)...`;
  emitRoom(room);

  const stepDelay = steps * 220 + 360;

  if (room.moveTimer) clearTimeout(room.moveTimer);
  room.moveTimer = roomTimeout(room, () => {
    room.animatingMove = null;

    let captured = false;
    let capturedInfo = null;

    if (newVal >= 1 && newVal <= 39) {
      const trackPos = getTrackIndex(colorIdx, newVal);
      const isSafe = safeZonesActive && SAFE_TRACK_INDICES.includes(trackPos);

      // 1. Makan bidak lawan. Ini dicek lebih dulu, termasuk di petak Black Hole:
      //    lawan yang bertahan di sana (memakai perisai) tetap bisa dimakan dan tetap memberi bonus giliran.
      if (!isSafe) {
        for (const opponent of room.players) {
          // Bidak milik pemain yang sudah out TETAP bisa diinjak & dikembalikan ke base
          if (opponent.id === currentPlayer.id) continue;
          const oppColorIdx = COLORS.indexOf(opponent.color);
          const oppPawns = room.pawns[opponent.id];
          if (!oppPawns) continue;

          for (let j = 0; j < 4; j++) {
            const oppVal = oppPawns[j];
            if (oppVal < 1 || oppVal > 39) continue;
            const oppTrack = getTrackIndex(oppColorIdx, oppVal);
            if (oppTrack !== trackPos) continue;
            if (oppTrack === COLOR_OFFSETS[oppColorIdx]) continue; // Kebal di kotak base warnanya

            oppPawns[j] = 0;
            captured = true;
            currentPlayer.stompCount = (currentPlayer.stompCount || 0) + 1;

            capturedInfo = {
              id: Date.now() + Math.random(),
              attacker: currentPlayer.name,
              defender: opponent.name,
              color: opponent.color,
              defenderIsOut: !!opponent.isOut,
              trackPos
            };
            addHistory(room, `⚔️ ${currentPlayer.name} memakan bidak ${opponent.name}${opponent.isOut ? ' (pemain out)' : ''}! (Injakan: ${currentPlayer.stompCount})`);

            if (currentPlayer.inventory?.forceReturn > 0 && currentPlayer.stompCount >= 3) {
              room.lastForceReturnReady = {
                id: Date.now() + Math.random(),
                playerId: currentPlayer.id,
                playerName: currentPlayer.name,
                time: Date.now()
              };
              addHistory(room, `⚡ FORCE RETURN SIAP! ${currentPlayer.name} telah 3x menginjak lawan! Hak eliminasi langsung aktif!`);
            }
          }
        }
      }

      // 2. Efek Black Hole pada bidak yang baru mendarat
      if (room.settings?.blackHole && BLACK_HOLE_INDICES.includes(trackPos)) {
        if (currentPlayer.inventory?.blackholeShield > 0) {
          currentPlayer.inventory.blackholeShield -= 1;
          db.consumeUserItem({ userId: currentPlayer.userId, itemType: 'blackholeShield' });

          room.lastShieldProtect = {
            id: Date.now() + Math.random(),
            playerId,
            playerName: currentPlayer.name,
            pawnIdx,
            trackPos,
            color: currentPlayer.color,
            time: Date.now()
          };
          addHistory(room, `🛡️ BLACKHOLE SHIELD AKTIF! Bidak ${pawnIdx + 1} milik ${currentPlayer.name} terselamatkan dari Black Hole! (Sisa Perisai: ${currentPlayer.inventory.blackholeShield})`);
          room.message = `🛡️ Blackhole Shield melindungi bidak ${currentPlayer.name}! Bidak aman!`;
        } else {
          currentPawns[pawnIdx] = 0;
          room.lastBlackHole = {
            id: Date.now() + Math.random(),
            playerId,
            pawnIdx,
            trackPos,
            color: currentPlayer.color,
            time: Date.now()
          };
          addHistory(room, `🕳️ Bidak ${pawnIdx + 1} milik ${currentPlayer.name} menginjak Black Hole dan tersedot kembali ke Base!`);
          room.message = `🕳️ Bidak ${currentPlayer.name} tersedot Black Hole ke base!`;
        }
      }
    }

    if (currentPawns.every(p => p === FINISH)) {
      declareWinner(room, currentPlayer);
      return;
    }

    let goalInfo = null;
    const reachedGoal = newVal === FINISH;
    if (reachedGoal) {
      goalInfo = {
        id: Date.now() + Math.random(),
        playerId,
        playerName: currentPlayer.name,
        color: currentPlayer.color,
        pawnIdx
      };
      addHistory(room, `⭐ ${currentPlayer.name} berhasil memasukkan 1 bidak ke garis akhir!`);

      const finishedCount = currentPawns.filter(v => v === FINISH).length;
      currentPlayer.finishedCount = finishedCount;

      if (finishedCount === 3 && !currentPlayer.skillUnlocked) {
        currentPlayer.skillUnlocked = true;
        currentPlayer.skillPoints = 1;
        addHistory(room, `⚡ ${currentPlayer.name} BERHASIL MEMASUKKAN 3 BIDAK! SKILL ELIMINASI TERBUKA!`);
        room.message = `⚡ SKILL TERBUKA! ${currentPlayer.name} dapat mengeliminasi 1 bidak lawan!`;
        room.lastSkillUnlock = {
          id: Date.now() + Math.random(),
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          playerColor: currentPlayer.color,
          time: Date.now()
        };
      }
    }

    // Angka 6, bidak masuk finish, atau memakan lawan memberi bonus giliran
    const extraTurn = rollVal === 6 || reachedGoal || captured;
    room.dice = null;
    room.lastCapture = capturedInfo;
    room.lastGoal = goalInfo;

    if (extraTurn) {
      if (reachedGoal) {
        currentPlayer.accumulatedThisTurn = false;
        room.message = `🎯 Bidak masuk ke garis tengah! ${currentPlayer.name} dapat bonus giliran lempar dadu & jalan satu bidak lagi!`;
        addHistory(room, `🎯 ${currentPlayer.name} memasukkan bidak ke tengah (bonus lempar dadu & jalan lagi)!`);
      } else if (captured) {
        currentPlayer.accumulatedThisTurn = false;
        room.message = `⚔️ Bidak lawan berhasil dieliminasi! ${currentPlayer.name} dapat giliran jalan lagi sekali!${room.lastBlackHole ? ' (Bidakmu sendiri tersedot Black Hole.)' : ''}`;
        addHistory(room, `⚔️ ${currentPlayer.name} mengeliminasi bidak lawan (bonus lempar dadu & jalan lagi)!`);
      } else {
        room.message = `Dapat angka 6! ${currentPlayer.name} dapat melempar dadu sekali lagi.`;
        addHistory(room, `🎲 ${currentPlayer.name} dapat angka 6 (bonus lempar lagi)!`);
      }
      emitRoom(room);
      triggerTurn(room);
    } else {
      if (currentVal === 0 && rollVal === 1) {
        addHistory(room, `🚪 ${currentPlayer.name} keluar kotak dengan angka 1.`);
      }
      advanceTurn(room);
    }
  }, stepDelay);
}

// Validasi bersama untuk Skill Eliminasi & Force Return.
// Hanya boleh dipakai SEBELUM melempar dadu agar tidak bisa dipakai untuk mengocok ulang.
function validateEliminationTarget(socket, r, { targetPlayerId, targetPawnIdx }) {
  if (!r || !r.started || r.winner || r.rolling || r.animatingMove) return null;

  const currentPlayer = r.players[r.turn];
  if (!currentPlayer || currentPlayer.id !== socket.id || currentPlayer.isOut) {
    socket.emit('room:error', 'Sekarang bukan giliranmu.');
    return null;
  }
  if (r.dice !== null) {
    socket.emit('room:error', 'Skill hanya bisa dipakai sebelum melempar dadu.');
    return null;
  }

  const targetPlayer = typeof targetPlayerId === 'string' ? r.players.find(p => p.id === targetPlayerId) : null;
  if (!targetPlayer || targetPlayer.id === currentPlayer.id) {
    socket.emit('room:error', 'Pemain target tidak valid.');
    return null;
  }

  const oppPawns = r.pawns[targetPlayer.id];
  if (!oppPawns || !isPawnIndex(targetPawnIdx)) {
    socket.emit('room:error', 'Bidak target tidak valid.');
    return null;
  }

  const oppVal = oppPawns[targetPawnIdx];
  if (oppVal < 1 || oppVal > 39) {
    socket.emit('room:error', 'Hanya bidak lawan di lintasan yang dapat dieliminasi.');
    return null;
  }
  return { currentPlayer, targetPlayer, oppPawns };
}

// ==========================================
// SOCKET EVENTS
// ==========================================

// Log siklus koneksi agar penyebab pemain terputus bisa dilacak di log produksi.
// Alasan umum: "ping timeout" (HP tidur / tab di background / jaringan beku),
// "transport close" / "transport error" (koneksi diputus tunnel/proxy/jaringan).
function logConnection(socket, event, extra = '') {
  const ua = String(socket.handshake.headers['user-agent'] || '');
  const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';
  const transport = socket.conn?.transport?.name || '-';
  const r = rooms.get(socket.data.room);
  const player = r?.players.find(p => p.id === socket.id);
  console.log(`[conn] ${event} id=${socket.id} transport=${transport} device=${device}` +
    `${r ? ` room=${r.code}` : ''}${player ? ` player="${player.name}"` : ''}${extra}`);
}

io.on('connection', socket => {
  const connectedAt = Date.now();
  logConnection(socket, 'connect');
  socket.conn.once('upgrade', () => logConnection(socket, 'upgrade'));
  // Heartbeat Ping/Pong untuk mengukur latensi
  socket.on('network:ping', (clientTimestamp, callback) => {
    if (typeof callback === 'function') callback(clientTimestamp);
  });

  on(socket, 'room:create', payload => createRoom(socket, payload));
  on(socket, 'room:join', payload => joinRoom(socket, payload.code, payload));
  on(socket, 'leaderboard:get', () => socket.emit('leaderboard:update', db.getLeaderboard()));

  // Cek apakah user memiliki room yang masih aktif (butuh sessionId rahasia atau token)
  on(socket, 'room:check_active', ({ code, sessionId, token }, callback) => {
    if (!callback) return;
    const r = code ? rooms.get(String(code).toUpperCase()) : null;
    if (!r) return callback({ active: false });

    const user = typeof token === 'string' ? db.getUserByToken(token) : null;
    const player = r.players.find(p =>
      !p.isBot && ((typeof sessionId === 'string' && sessionId && p.sessionId === sessionId) || (user && p.userId === user.id))
    );
    if (!player) return callback({ active: false });
    callback({ active: true, started: r.started, isOut: !!player.isOut, winner: r.winner, code: r.code });
  });

  on(socket, 'room:update_settings', ({ safeZones, blackHole }) => {
    const r = rooms.get(socket.data.room);
    if (!r || r.host !== socket.id || r.started) return;
    let changed = false;
    if (typeof safeZones === 'boolean') {
      r.settings.safeZones = safeZones;
      addHistory(r, `⚙️ Host mengatur Zona Aman: ${safeZones ? 'AKTIF' : 'NONAKTIF (Hardcore)'}.`);
      changed = true;
    }
    if (typeof blackHole === 'boolean') {
      r.settings.blackHole = blackHole;
      addHistory(r, `⚙️ Host mengatur Black Hole: ${blackHole ? 'AKTIF 🕳️' : 'NONAKTIF'}.`);
      changed = true;
    }
    if (changed) emitRoom(r);
  });

  on(socket, 'room:add_bot', () => {
    const r = rooms.get(socket.data.room);
    if (r) addBot(r, socket.id);
  });

  on(socket, 'room:remove_bot', () => {
    const r = rooms.get(socket.data.room);
    if (r) removeBot(r, socket.id);
  });

  on(socket, 'game:start', () => {
    const r = rooms.get(socket.data.room);
    if (!r || r.host !== socket.id || r.started || r.players.length < 2) return;
    startGame(r);
    r.message = `Permainan dimulai! Giliran ${r.players[0].name}.`;
    addHistory(r, '🎲 Permainan dimulai!');
    emitRoom(r);
    triggerTurn(r);
  });

  // Main lagi: hanya setelah ada pemenang. Pemain yang sudah menyerah tidak diikutkan.
  on(socket, 'game:restart', () => {
    const r = rooms.get(socket.data.room);
    if (!r || r.host !== socket.id || !r.started || !r.winner) return;

    const remaining = r.players.filter(p => !p.left);
    if (remaining.length < 2) {
      return socket.emit('room:error', 'Butuh minimal 2 pemain untuk bermain lagi. Tambahkan bot atau ajak teman.');
    }
    for (const p of r.players) if (p.left) delete r.pawns[p.id];
    r.players = remaining;

    startGame(r);
    r.message = `Permainan baru dimulai! Giliran ${r.players[0].name}.`;
    addHistory(r, '🔄 Permainan di-reset.');
    emitRoom(r);
    triggerTurn(r);
  });

  on(socket, 'game:roll', () => {
    const r = rooms.get(socket.data.room);
    if (r) handleRoll(r, socket.id);
  });

  on(socket, 'game:move', ({ pawn }) => {
    const r = rooms.get(socket.data.room);
    if (r) handleMove(r, socket.id, pawn);
  });

  // Skill: eliminasi 1 bidak lawan setelah memasukkan 3 bidak secara organik
  on(socket, 'game:use_skill', payload => {
    const r = rooms.get(socket.data.room);
    const v = validateEliminationTarget(socket, r, payload);
    if (!v) return;
    const { currentPlayer, targetPlayer, oppPawns } = v;

    const finishedCount = r.pawns[currentPlayer.id].filter(x => x === FINISH).length;
    if (finishedCount < 3 || !(currentPlayer.skillPoints > 0)) {
      return socket.emit('room:error', 'Skill belum terbuka atau poin skill tidak cukup.');
    }

    oppPawns[payload.targetPawnIdx] = 0;
    currentPlayer.skillPoints = 0;
    currentPlayer.skillUnlocked = false;

    r.lastSkillUse = {
      id: Date.now() + Math.random(),
      attacker: currentPlayer.name,
      defender: targetPlayer.name,
      color: targetPlayer.color,
      targetPawnIdx: payload.targetPawnIdx
    };
    r.lastCapture = {
      id: Date.now() + Math.random(),
      attacker: currentPlayer.name,
      defender: targetPlayer.name,
      color: targetPlayer.color,
      isSkill: true
    };

    addHistory(r, `⚡ ${currentPlayer.name} MENGGUNAKAN SKILL ELIMINASI: Menendang bidak ${targetPlayer.name} kembali ke markas! Poin skill kembali ke 0.`);
    r.message = `⚡ ${currentPlayer.name} berhasil mengeliminasi bidak ${targetPlayer.name} dengan SKILL! Silakan lempar dadu.`;
    emitRoom(r);
    triggerTurn(r);
  });

  // Pemain memilih menabung skill pada giliran ini (Akumulasi 2x lipat)
  on(socket, 'game:accumulate_skill', () => {
    const r = rooms.get(socket.data.room);
    if (!r || !r.started || r.winner || r.rolling || r.animatingMove) return;

    const currentPlayer = r.players[r.turn];
    if (!currentPlayer || currentPlayer.id !== socket.id || currentPlayer.isOut) return;

    const finishedCount = (r.pawns[currentPlayer.id] || []).filter(v => v === FINISH).length;
    if (finishedCount < 3 || !(currentPlayer.skillPoints > 0)) return;

    if (!currentPlayer.accumulatedThisTurn) {
      currentPlayer.skillPoints = Math.max(1, currentPlayer.skillPoints) * 2;
      currentPlayer.accumulatedThisTurn = true;
      addHistory(r, `⚡ ${currentPlayer.name} menabung skill! Poin skill dilipatgandakan menjadi ${currentPlayer.skillPoints}x!`);
      r.message = `⚡ Poin skill ${currentPlayer.name} terakumulasi menjadi ${currentPlayer.skillPoints}x lipat!`;
      emitRoom(r);
    }
  });

  // Item Toko: Force Return (eliminasi langsung setelah 3x menginjak bidak)
  on(socket, 'game:use_force_return', payload => {
    const r = rooms.get(socket.data.room);
    const v = validateEliminationTarget(socket, r, payload);
    if (!v) return;
    const { currentPlayer, targetPlayer, oppPawns } = v;

    if (!(currentPlayer.inventory?.forceReturn > 0)) {
      return socket.emit('room:error', 'Kamu belum memiliki item Force Return. Beli di Toko seharga 100 poin!');
    }
    if ((currentPlayer.stompCount || 0) < 3) {
      return socket.emit('room:error', `Force Return memerlukan minimal 3 kali menginjak bidak lawan. Progresmu: ${currentPlayer.stompCount || 0}/3.`);
    }

    const targetPawnIdx = payload.targetPawnIdx;
    oppPawns[targetPawnIdx] = 0;
    currentPlayer.inventory.forceReturn -= 1;
    db.consumeUserItem({ userId: currentPlayer.userId, itemType: 'forceReturn' });
    currentPlayer.stompCount = Math.max(0, (currentPlayer.stompCount || 0) - 3);

    r.lastForceReturnUse = {
      id: Date.now() + Math.random(),
      attackerId: currentPlayer.id,
      attackerName: currentPlayer.name,
      defenderId: targetPlayer.id,
      defenderName: targetPlayer.name,
      color: targetPlayer.color,
      targetPawnIdx
    };
    r.lastCapture = {
      id: Date.now() + Math.random(),
      attacker: currentPlayer.name,
      defender: targetPlayer.name,
      color: targetPlayer.color,
      isForceReturn: true
    };

    addHistory(r, `⚡ FORCE RETURN! ${currentPlayer.name} melancarkan serangan eliminasi langsung terhadap bidak ${targetPawnIdx + 1} milik ${targetPlayer.name}! Bidak dipulangkan ke markas!`);
    r.message = `⚡ Force Return! ${currentPlayer.name} mengeliminasi bidak ${targetPlayer.name}! Silakan lempar dadu.`;
    emitRoom(r);
    triggerTurn(r);
  });

  on(socket, 'game:reaction', ({ emoji }) => {
    const r = rooms.get(socket.data.room);
    if (!r || !EMOJIS.includes(emoji) || !reactionLimiter(socket.id)) return;
    const player = r.players.find(p => p.id === socket.id);
    if (!player) return;
    io.to(r.code).emit('room:reaction', {
      id: Date.now() + Math.random(),
      playerId: socket.id,
      playerName: player.name,
      color: player.color,
      emoji
    });
  });

  on(socket, 'room:chat', ({ text }) => {
    const r = rooms.get(socket.data.room);
    if (!r) return;
    const player = r.players.find(p => p.id === socket.id);
    if (!player) return;

    const cleanText = String(text || '').trim().slice(0, 140);
    if (!cleanText) return;
    if (!chatLimiter(socket.id)) {
      return socket.emit('room:error', 'Terlalu cepat mengirim pesan. Tunggu sebentar.');
    }

    const chatMsg = {
      id: Date.now() + Math.random(),
      senderId: player.id,
      senderName: player.name,
      senderColor: player.color,
      text: cleanText,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };
    r.chats.push(chatMsg);
    if (r.chats.length > 50) r.chats.shift();
    io.to(r.code).emit('room:chat_message', chatMsg);
  });

  on(socket, 'room:leave', ({ code }) => {
    const roomCode = String(code || socket.data.room || '').toUpperCase();
    const r = rooms.get(roomCode);
    if (r) handleDeparture(socket, r, { intentional: true });
    socket.leave(roomCode);
    delete socket.data.room;
  });

  socket.on('disconnect', reason => {
    logConnection(socket, 'disconnect', ` reason="${reason}" after=${Math.round((Date.now() - connectedAt) / 1000)}s`);
    try {
      const r = rooms.get(socket.data.room);
      if (r) handleDeparture(socket, r, { intentional: false });
    } catch (err) {
      console.error('[socket disconnect]', err);
    }
  });
});

// ==========================================
// REST APIS: AUTHENTICATION, LEADERBOARD & SHOP
// ==========================================

app.get('/health', (_, res) => res.json({ ok: true, rooms: rooms.size }));

function bearerToken(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  if (!registerLimiter(req.ip)) {
    return res.status(429).json({ success: false, error: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.' });
  }
  const { username, password, name } = req.body || {};
  const result = await db.registerUser({ username, password, name });
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  res.json({ success: true, user: { ...result.user, isLudoKing: db.checkIsLudoKing(result.user.id) }, token: result.token });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { username, password } = req.body || {};
  const key = `${req.ip}:${String(username || '').toLowerCase()}`;
  if (!loginLimiter(key)) {
    return res.status(429).json({ success: false, error: 'Terlalu banyak percobaan login. Coba lagi dalam 10 menit.' });
  }
  const result = await db.loginUser({ username, password });
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  res.json({ success: true, user: { ...result.user, isLudoKing: db.checkIsLudoKing(result.user.id) }, token: result.token });
}));

app.post('/api/auth/logout', (req, res) => {
  db.deleteSession(bearerToken(req));
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = db.getUserByToken(bearerToken(req));
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized / Sesi telah kedaluwarsa.' });
  }
  res.json({ success: true, user: { ...db.sanitizeUser(user), isLudoKing: db.checkIsLudoKing(user.id) } });
});

app.get('/api/leaderboard', (req, res) => {
  const leaderboard = db.getLeaderboard();
  const ludoKing = leaderboard[0] && leaderboard[0].isLudoKing ? leaderboard[0] : null;
  res.json({ success: true, leaderboard, ludoKing });
});

app.get('/api/shop/items', (req, res) => {
  res.json({ success: true, items: db.SHOP_ITEMS });
});

app.post('/api/shop/buy', (req, res) => {
  const user = db.getUserByToken(bearerToken(req) || String(req.body?.token || ''));
  if (!user) {
    return res.status(401).json({ success: false, error: 'Silakan login terlebih dahulu untuk berbelanja.' });
  }

  const result = db.buyShopItem({ userId: user.id, itemType: req.body?.itemType });
  if (result.error) return res.status(400).json({ success: false, error: result.error });

  // Sinkronkan inventory jika user sedang berada di room aktif
  for (const [, r] of rooms) {
    const playerInRoom = r.players.find(p => p.userId === user.id);
    if (playerInRoom) {
      playerInRoom.inventory = { ...result.inventory };
      emitRoom(r);
    }
  }

  res.json({
    success: true,
    message: `Berhasil membeli ${result.item.name}!`,
    item: result.item,
    user: { ...result.user, isLudoKing: db.checkIsLudoKing(user.id) }
  });
});

app.use('/api', (req, res) => res.status(404).json({ success: false, error: 'Endpoint tidak ditemukan.' }));

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, error: 'Permintaan tidak valid.' });
  }
  console.error('[http]', err);
  res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server.' });
});

const dist = path.join(__dirname, '../dist');
app.use(express.static(dist));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));

// ==========================================
// PROSES: simpan data saat berhenti, jangan mati karena satu error
// ==========================================

process.on('uncaughtException', err => {
  console.error('[uncaughtException]', err);
  db.flushNow();
});
process.on('unhandledRejection', err => {
  console.error('[unhandledRejection]', err);
});
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    db.flushNow();
    process.exit(0);
  });
}

const PORT = process.env.PORT || 5172;
if (require.main === module) {
  server.listen(PORT, () => console.log(`JakLudo server listening on ${PORT}`));
}

module.exports = { server, io, rooms };
