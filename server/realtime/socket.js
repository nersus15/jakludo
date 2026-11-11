// Event Socket.IO: menerjemahkan pesan klien menjadi aksi lobby/engine.
const db = require('../db');
const store = require('../game/store');
const lobby = require('../game/lobby');
const engine = require('../game/engine');
const social = require('../social/store');
const { createLimiter } = require('../lib/limiter');
const { EMOJIS, MAX_CHATS } = require('../game/config');

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

// Log siklus koneksi agar penyebab pemain terputus bisa dilacak di log produksi.
// Alasan umum: "ping timeout" (HP tidur / tab di background / jaringan beku),
// "transport close" / "transport error" (koneksi diputus tunnel/proxy/jaringan).
function logConnection(socket, event, extra = '') {
  const ua = String(socket.handshake.headers['user-agent'] || '');
  const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';
  const transport = socket.conn?.transport?.name || '-';
  const r = store.rooms.get(socket.data.room);
  const player = r?.players.find(p => p.id === socket.id);
  console.log(`[conn] ${event} id=${socket.id} transport=${transport} device=${device}` +
    `${r ? ` room=${r.code}` : ''}${player ? ` player="${player.name}"` : ''}${extra}`);
}

// Target eliminasi: format baru { target: { playerId, pawnIdx } }, format lama { targetPlayerId, targetPawnIdx }
function readTarget(payload) {
  if (payload.target && typeof payload.target === 'object') return payload.target;
  return { playerId: payload.targetPlayerId, pawnIdx: payload.targetPawnIdx };
}

function registerSocketHandlers(io) {
  io.on('connection', socket => {
    const connectedAt = Date.now();
    const currentRoom = () => store.rooms.get(socket.data.room);
    logConnection(socket, 'connect');
    socket.conn.once('upgrade', () => logConnection(socket, 'upgrade'));

    // Heartbeat Ping/Pong untuk mengukur latensi
    socket.on('network:ping', (clientTimestamp, callback) => {
      if (typeof callback === 'function') callback(clientTimestamp);
    });

    on(socket, 'room:create', payload => lobby.createRoom(socket, payload));
    on(socket, 'room:join', payload => lobby.joinRoom(socket, payload.code, payload));
    on(socket, 'leaderboard:get', () => socket.emit('leaderboard:update', db.getLeaderboard()));

    // Identifikasi sesi user pada koneksi Socket.IO untuk fitur teman, chat grup, & undangan room
    on(socket, 'social:identify', ({ token }, cb) => {
      const user = social.identifySocket(socket, token);
      if (typeof cb === 'function') cb({ ok: Boolean(user) });
    });

    on(socket, 'social:logout', () => {
      social.detachSocket(socket);
    });

    // Perbarui foto profil/nama pemain di dalam room secara realtime setelah ganti avatar
    on(socket, 'room:sync_profile', ({ token }) => {
      const r = currentRoom();
      if (!r) return;
      const user = typeof token === 'string' ? db.getUserByToken(token) : null;
      if (!user) return;
      const player = r.players.find(p => !p.isBot && p.userId === user.id);
      if (!player) return;
      player.avatar = user.avatar || '🎲';
      player.name = user.name || player.name;
      store.emitRoom(r);
    });

    // Undang teman atau sesama anggota grup ke dalam room tempat pengirim berada
    on(socket, 'room:invite', ({ userId: targetUserId }, cb) => {
      const reply = payload => { if (typeof cb === 'function') cb(payload); };
      const r = currentRoom();
      if (!r || r.started) return reply({ ok: false, error: 'Room tidak tersedia atau permainan sudah dimulai.' });
      if (r.players.length >= 4) return reply({ ok: false, error: 'Room sudah penuh.' });

      const mePlayer = r.players.find(p => p.id === socket.id);
      const senderUserId = socket.data.userId || mePlayer?.userId;
      if (!senderUserId) return reply({ ok: false, error: 'Silakan login terlebih dahulu.' });
      if (!targetUserId || targetUserId === senderUserId) return reply({ ok: false, error: 'Target undangan tidak valid.' });

      if (r.players.some(p => p.userId === targetUserId)) {
        return reply({ ok: false, error: 'Pemain tersebut sudah berada di dalam room.' });
      }

      if (r.groupId) {
        if (!social.isGroupMember(r.groupId, targetUserId)) {
          return reply({ ok: false, error: 'Hanya anggota grup yang dapat diundang ke match grup ini.' });
        }
      } else if (!social.areFriends(senderUserId, targetUserId)) {
        return reply({ ok: false, error: 'Kamu hanya dapat mengundang pemain yang sudah menjadi teman.' });
      }

      if (!social.isUserOnline(targetUserId)) {
        return reply({ ok: false, error: 'Teman sedang offline.' });
      }

      social.emitToUser(targetUserId, 'room:invite', {
        code: r.code,
        from: social.userSummary(senderUserId),
        group: r.groupId ? social.getGroupBasic(r.groupId) : null
      });
      reply({ ok: true });
    });

    // Cek apakah user memiliki room yang masih aktif (butuh sessionId rahasia atau token)
    on(socket, 'room:check_active', ({ code, sessionId, token }, callback) => {
      if (!callback) return;
      const r = code ? store.rooms.get(String(code).toUpperCase()) : null;
      if (!r) return callback({ active: false });

      const user = typeof token === 'string' ? db.getUserByToken(token) : null;
      const player = r.players.find(p =>
        !p.isBot && ((typeof sessionId === 'string' && sessionId && p.sessionId === sessionId) || (user && p.userId === user.id))
      );
      if (!player) return callback({ active: false });
      callback({ active: true, started: r.started, isOut: !!player.isOut, winner: r.winner, code: r.code });
    });

    on(socket, 'room:update_settings', payload => lobby.updateSettings(currentRoom(), socket.id, payload));
    on(socket, 'room:add_bot', () => lobby.addBot(currentRoom(), socket.id));
    on(socket, 'room:remove_bot', () => lobby.removeBot(currentRoom(), socket.id));

    on(socket, 'game:start', () => {
      const r = currentRoom();
      if (!r || r.host !== socket.id || r.started || r.players.length < 2) return;
      engine.startGame(r);
      r.message = `Permainan dimulai! Giliran ${r.players[0].name}.`;
      store.addHistory(r, '🎲 Permainan dimulai!');
      store.emitRoom(r);
      engine.triggerTurn(r);
    });

    on(socket, 'game:restart', () => {
      const r = currentRoom();
      if (!r || r.host !== socket.id || !r.started || !r.winner) return;
      const error = engine.restartGame(r);
      if (error) return socket.emit('room:error', error);
      r.message = `Permainan baru dimulai! Giliran ${r.players[0].name}.`;
      store.addHistory(r, '🔄 Permainan di-reset.');
      store.emitRoom(r);
      engine.triggerTurn(r);
    });

    on(socket, 'game:roll', () => {
      const r = currentRoom();
      if (r) engine.handleRoll(r, socket.id);
    });

    on(socket, 'game:move', ({ pawn }) => {
      const r = currentRoom();
      if (r) engine.handleMove(r, socket.id, pawn);
    });

    on(socket, 'game:shield_decision', payload => engine.decideShield(socket, currentRoom(), { use: payload?.use === true }));

    // Satu event untuk semua item aktif: { itemId, target }
    on(socket, 'game:use_item', ({ itemId, target }) => engine.useItem(socket, currentRoom(), { itemId, target }));
    // Kompatibilitas klien lama yang masih terbuka saat deploy. Hapus setelah semua klien diperbarui.
    on(socket, 'game:use_force_return', payload =>
      engine.useItem(socket, currentRoom(), { itemId: 'forceReturn', target: readTarget(payload) }));

    on(socket, 'game:reaction', ({ emoji }) => {
      const r = currentRoom();
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
      const r = currentRoom();
      const player = r?.players.find(p => p.id === socket.id);
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
        senderAvatar: player.avatar || '🎲',
        senderColor: player.color,
        text: cleanText,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      r.chats.push(chatMsg);
      if (r.chats.length > MAX_CHATS) r.chats.shift();
      io.to(r.code).emit('room:chat_message', chatMsg);
      store.markRoomDirty(r);
    });

    on(socket, 'room:leave', ({ code }) => {
      const roomCode = String(code || socket.data.room || '').toUpperCase();
      const r = store.rooms.get(roomCode);
      if (r) lobby.handleDeparture(socket, r, { intentional: true });
      socket.leave(roomCode);
      delete socket.data.room;
    });

    socket.on('disconnect', reason => {
      logConnection(socket, 'disconnect', ` reason="${reason}" after=${Math.round((Date.now() - connectedAt) / 1000)}s`);
      social.detachSocket(socket);
      try {
        const r = currentRoom();
        if (r) lobby.handleDeparture(socket, r, { intentional: false });
      } catch (err) {
        console.error('[socket disconnect]', err);
      }
    });
  });
}

module.exports = { registerSocketHandlers };
