// Masuk/keluar room: membuat room, join & reconnect, bot, dan pemain yang keluar/terputus.
const crypto = require('crypto');
const db = require('../db');
const inventory = require('./inventory');
const store = require('./store');
const engine = require('./engine');
const social = require('../social/store');
const { nextFreeColor } = require('./rules');
const { MAX_PLAYERS, BOT_NAMES } = require('./config');

const { rooms, addHistory, emitRoom } = store;

const makeRoomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const makeSessionId = () => 'sess_' + crypto.randomBytes(12).toString('hex');

function createRoom(socket, payload) {
  const groupId = typeof payload?.groupId === 'string' && payload.groupId.trim() ? payload.groupId.trim() : null;
  let creatorUser = null;
  if (groupId) {
    creatorUser = typeof payload?.token === 'string' ? db.getUserByToken(payload.token) : null;
    if (!creatorUser || !social.isGroupMember(groupId, creatorUser.id)) {
      return socket.emit('room:error', 'Kamu harus menjadi anggota grup untuk membuat match grup.');
    }
  }

  let code;
  do {
    code = makeRoomCode();
  } while (rooms.has(code));

  const room = {
    code,
    groupId,
    host: socket.id,
    players: [],
    started: false,
    turn: 0,
    pawns: {},
    message: 'Menunggu pemain bergabung...',
    history: [],
    chats: [],
    lobbyRemovals: new Map(),
    settings: { safeZones: true, blackHole: false, blackHoleMode: 'static' },
    botTimeout: null,
    rollTimer: null,
    passTimer: null,
    moveTimer: null,
    turnTimer: null,
    cleanupTimer: null
  };
  store.resetRoomEvents(room);
  rooms.set(code, room);
  joinRoom(socket, code, payload);

  if (groupId && creatorUser) {
    social.postGroupMatchMessage(groupId, creatorUser.id, code).catch(err => {
      console.error('[room group match msg]', err);
    });
  }
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
  if (user && payload.token) social.identifySocket(socket, payload.token);
  const sessionId = typeof payload.sessionId === 'string' && payload.sessionId ? payload.sessionId : null;

  // Reconnect hanya lewat bukti yang tidak bisa ditebak: sessionId rahasia atau token login
  const existingPlayer = room.players.find(p =>
    !p.isBot && ((sessionId && p.sessionId === sessionId) || (user && p.userId === user.id))
  );
  if (existingPlayer) return rejoinPlayer(socket, room, existingPlayer, user);

  if (room.groupId && (!user || !social.isGroupMember(room.groupId, user.id))) {
    return socket.emit('room:error', 'Room ini khusus untuk anggota grup.');
  }

  if (room.started) return socket.emit('room:error', 'Permainan sudah dimulai.');
  if (room.players.length >= MAX_PLAYERS) return socket.emit('room:error', `Room sudah penuh (maksimal ${MAX_PLAYERS} pemain).`);

  const rawName = typeof payload.name === 'string' ? payload.name : '';
  const isFirstPlayer = room.players.length === 0;
  const player = {
    id: socket.id,
    sessionId: makeSessionId(),
    userId: user?.id || null,
    username: user?.username || null,
    name: user?.name || rawName.trim().slice(0, 18) || 'Pemain',
    avatar: user?.avatar || '🎲',
    color: nextFreeColor(room.players),
    isHost: room.host === socket.id,
    isBot: false,
    isLudoKing: db.checkIsLudoKing(user?.id),
    connected: true,
    autoPlayCount: 0,
    isOut: false,
    items: {}
  };
  inventory.loadOwned(player, user?.inventory);

  if (isFirstPlayer) {
    room.creatorUserId = player.userId;
    room.creatorSessionId = player.sessionId;
  }
  room.players.push(player);
  room.pawns[socket.id] = [0, 0, 0, 0];
  store.cancelCleanup(room);
  socket.join(room.code);
  socket.data.room = room.code;

  addHistory(room, `${player.isLudoKing ? '👑 [Ludo King] ' : ''}${player.name} bergabung ke dalam room.`);
  socket.emit('room:joined', {
    code: room.code,
    playerId: socket.id,
    sessionId: player.sessionId,
    isLudoKing: player.isLudoKing,
    reconnected: false
  });
  socket.emit('room:chats', room.chats);

  if (!isFirstPlayer) {
    store.getIo().to(room.code).emit('room:member_joined', {
      name: player.name,
      avatar: player.avatar,
      playerId: socket.id,
      reconnected: false
    });
  }
  emitRoom(room);
}

// Pemain lama tersambung ulang (reload, sinyal putus, pindah perangkat, atau server restart)
function rejoinPlayer(socket, room, player, user) {
  if (player.isOut) {
    return socket.emit('room:error', 'Kamu telah dinyatakan OUT dari pertandingan ini.');
  }

  const oldSocketId = player.id;
  if (oldSocketId !== socket.id) {
    // Room dibuka di tab/perangkat lain: putuskan socket lama dari room
    const oldSocket = store.getIo().sockets.sockets.get(oldSocketId);
    if (oldSocket) {
      oldSocket.leave(room.code);
      delete oldSocket.data.room;
      oldSocket.emit('room:error', 'Room ini dibuka di tab atau perangkat lain.');
    }
    room.pawns[socket.id] = room.pawns[oldSocketId] || [0, 0, 0, 0];
    delete room.pawns[oldSocketId];
    if (room.winner === oldSocketId) room.winner = socket.id;
  }

  player.id = socket.id;
  player.connected = true;
  player.disconnectedAt = null;
  player.autoPlayCount = 0;
  store.cancelLobbyRemoval(room, player);
  if (user) inventory.loadOwned(player, user.inventory);

  if (room.host === oldSocketId || store.isCreator(room, player)) {
    room.host = socket.id; // Pembuat room selalu mendapatkan kembali peran host
  } else if (!room.players.some(p => p.id === room.host && p.connected)) {
    store.reassignHost(room);
  }
  room.players.forEach(p => { p.isHost = p.id === room.host; });
  store.cancelCleanup(room);
  if (room.winner) store.scheduleCleanup(room);

  socket.join(room.code);
  socket.data.room = room.code;

  addHistory(room, `🎮 ${player.name} kembali masuk ke dalam room.`);
  socket.emit('room:joined', {
    code: room.code,
    playerId: socket.id,
    sessionId: player.sessionId,
    isLudoKing: player.isLudoKing,
    reconnected: true
  });
  socket.emit('room:chats', room.chats);
  store.getIo().to(room.code).emit('room:member_joined', {
    name: player.name,
    avatar: player.avatar,
    playerId: socket.id,
    reconnected: true
  });
  emitRoom(room);

  if (room.started && room.players[room.turn]?.id === socket.id) engine.triggerTurn(room);
}

function addBot(room, hostSocketId) {
  if (!room || room.started || room.players.length >= MAX_PLAYERS || room.host !== hostSocketId) return;
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
    items: {}
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

function updateSettings(room, hostSocketId, { safeZones, blackHole, blackHoleMode }) {
  if (!room || room.host !== hostSocketId || room.started) return;
  let changed = false;
  if (typeof safeZones === 'boolean') {
    room.settings.safeZones = safeZones;
    addHistory(room, `⚙️ Host mengatur Zona Aman: ${safeZones ? 'AKTIF' : 'NONAKTIF (Hardcore)'}.`);
    changed = true;
  }
  if (typeof blackHole === 'boolean') {
    room.settings.blackHole = blackHole;
    addHistory(room, `⚙️ Host mengatur Black Hole: ${blackHole ? 'AKTIF 🕳️' : 'NONAKTIF'}.`);
    changed = true;
  }
  if (blackHoleMode === 'static' || blackHoleMode === 'random') {
    room.settings.blackHoleMode = blackHoleMode;
    addHistory(room, `⚙️ Host mengatur lokasi Black Hole: ${blackHoleMode === 'random' ? 'ACAK (pindah tiap putaran)' : 'TETAP'}.`);
    changed = true;
  }
  if (changed) emitRoom(room);
}

// Pemain keluar (intentional = klik keluar/menyerah) atau koneksi terputus
function handleDeparture(socket, r, { intentional }) {
  const departing = r.players.find(p => p.id === socket.id);
  if (!departing) return;

  if (!r.started) {
    store.cancelLobbyRemoval(r, departing);
    if (intentional) {
      addHistory(r, `${departing.name} keluar dari ruang tunggu.`);
      store.removeLobbyPlayer(r, departing);
    } else {
      departing.disconnectedAt = Date.now();
      store.holdLobbySeat(r, departing);
      addHistory(r, `⚠️ ${departing.name} terputus dari ruang tunggu, menunggu tersambung ulang...`);
      if (r.host === socket.id) store.reassignHost(r);
      emitRoom(r);
    }
    if (rooms.get(r.code) === r && !store.hasConnectedHuman(r)) store.scheduleCleanup(r);
    return;
  }

  departing.connected = false;

  if (intentional) {
    const wasActive = !departing.isOut;
    departing.isOut = true;
    departing.left = true;
    departing.sessionId = null;
    addHistory(r, `🚪 ${departing.name} keluar dari permainan (menyerah).`);
    // Pemain yang sedang ditanya soal perisai lalu menyerah: anggap tidak memakai perisai
    if (r.pendingShield?.playerId === departing.id) engine.resolvePendingShield(r, false);

    if (store.deleteIfAllHumansOut(r)) return;
    if (r.host === socket.id) store.reassignHost(r);

    if (!r.winner && wasActive) {
      const activeRemaining = r.players.filter(p => !p.isOut);
      if (activeRemaining.length === 1) {
        engine.declareWinner(r, activeRemaining[0]);
      } else if (r.players[r.turn]?.id === departing.id) {
        engine.advanceTurn(r);
      }
    }
  } else {
    departing.disconnectedAt = Date.now();
    addHistory(r, `⚠️ ${departing.name} keluar web/terputus (dimainkan bot sementara).`);
    if (r.host === socket.id) store.reassignHost(r);
    if (!r.winner && r.players[r.turn]?.id === departing.id) engine.triggerTurn(r);
  }

  emitRoom(r);
}

module.exports = { createRoom, joinRoom, addBot, removeBot, updateSettings, handleDeparture };
