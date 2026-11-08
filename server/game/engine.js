// Alur permainan: giliran, dadu, langkah bidak, skill, dan pemakaian item.
const crypto = require('crypto');
const db = require('../db');
const items = require('../items');
const inventory = require('./inventory');
const store = require('./store');
const {
  COLORS,
  COLOR_OFFSETS,
  SAFE_TRACK_INDICES,
  BLACK_HOLE_INDICES,
  FINISH,
  getTrackIndex,
  canPawnMove,
  getMovablePawns,
  chooseBestPawn,
  isPawnIndex
} = require('./rules');
const { TURN_TIMEOUT_MS, DISCONNECTED_TURN_DELAY_MS, OFFLINE_OUT_MS, MAX_AUTO_PLAY } = require('./config');

const { addHistory, emitRoom, roomTimeout, clearRoomTimers } = store;
const eventId = () => Date.now() + Math.random();

// ==========================================
// MULAI & SELESAI
// ==========================================

function resetPlayerForGame(p) {
  p.autoPlayCount = 0;
  p.isOut = false;
  p.skillPoints = 0;
  p.skillUnlocked = false;
  p.finishedCount = 0;
  p.accumulatedThisTurn = false;
  inventory.resetForMatch(p);
  if (p.userId) inventory.loadOwned(p, db.getUserItems(p.userId));
}

function startGame(r) {
  for (const timer of r.lobbyRemovals.values()) clearTimeout(timer);
  r.lobbyRemovals.clear();
  clearRoomTimers(r);
  store.cancelCleanup(r);
  store.resetRoomEvents(r);
  r.started = true;
  r.turn = 0;
  for (const p of r.players) {
    r.pawns[p.id] = [0, 0, 0, 0];
    resetPlayerForGame(p);
  }
}

// Main lagi: hanya setelah ada pemenang. Pemain yang sudah menyerah tidak diikutkan.
function restartGame(r) {
  const remaining = r.players.filter(p => !p.left);
  if (remaining.length < 2) return 'Butuh minimal 2 pemain untuk bermain lagi. Tambahkan bot atau ajak teman.';
  for (const p of r.players) if (p.left) delete r.pawns[p.id];
  r.players = remaining;
  startGame(r);
  return null;
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

  store.getIo().emit('leaderboard:update', db.getLeaderboard());
  emitRoom(room);
  store.scheduleCleanup(room);
}

// ==========================================
// GILIRAN
// ==========================================

function advanceTurn(room) {
  if (!room || !room.started || room.winner) return;
  clearRoomTimers(room);

  const activePlayers = room.players.filter(p => !p.isOut);
  if (activePlayers.length <= 1) {
    if (activePlayers.length === 1) declareWinner(room, activePlayers[0]);
    return;
  }

  let next = (room.turn + 1) % room.players.length;
  for (let attempts = 0; room.players[next]?.isOut && attempts < room.players.length; attempts++) {
    next = (next + 1) % room.players.length;
  }

  room.turn = next;
  room.dice = null;
  room.consecutiveSixes = 0;
  room.players.forEach(p => { p.accumulatedThisTurn = false; });
  const nextPlayer = room.players[room.turn];
  room.message = `Giliran ${nextPlayer.name}${nextPlayer.autoPlayCount > 0 ? ` (Auto-Play ${nextPlayer.autoPlayCount}/${MAX_AUTO_PLAY})` : ''}.`;

  emitRoom(room);
  triggerTurn(room);
}

// Jadwalkan aksi berikutnya untuk pemain yang sedang mendapat giliran
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
      scheduleAutoMove(room, currentPlayer, false);
    }
    return;
  }

  // Pemain manusia: online -> batas waktu 15 detik, terputus -> tunggu sebentar agar sempat tersambung ulang
  const delay = currentPlayer.connected ? TURN_TIMEOUT_MS : DISCONNECTED_TURN_DELAY_MS;
  room.turnTimer = roomTimeout(room, () => {
    if (room.players[room.turn]?.id === currentPlayer.id) executeAutoPlay(room, currentPlayer);
  }, delay);
}

function scheduleAutoMove(room, player, isAuto) {
  const bestPawn = chooseBestPawn(room, player, room.dice);
  if (bestPawn === null) return;
  room.botTimeout = roomTimeout(room, () => {
    if (room.players[room.turn]?.id === player.id && room.dice !== null && !room.animatingMove) {
      handleMove(room, player.id, bestPawn, isAuto);
    }
  }, 800);
}

function executeAutoPlay(room, player) {
  if (!room || !room.started || room.winner || room.rolling || room.animatingMove) return;
  if (room.players[room.turn]?.id !== player.id) return;

  // OUT setelah 3x auto-play berturut-turut: langsung jika pemain online tapi diam (AFK),
  // atau jika sudah offline cukup lama. Sinyal yang goyang sebentar tidak membuat pemain OUT.
  const offlineTooLong = !player.connected && Date.now() - (player.disconnectedAt || 0) >= OFFLINE_OUT_MS;
  if ((player.autoPlayCount || 0) >= MAX_AUTO_PLAY && (player.connected || offlineTooLong)) {
    player.isOut = true;
    player.autoPlayCount = MAX_AUTO_PLAY;
    addHistory(room, `❌ ${player.name} dinyatakan OUT (batas ${MAX_AUTO_PLAY}x auto-play tercapai tanpa respon).`);
    room.message = `❌ ${player.name} dinyatakan OUT!`;
    if (store.deleteIfAllHumansOut(room)) return;
    advanceTurn(room);
    return;
  }

  player.autoPlayCount = Math.min(MAX_AUTO_PLAY, (player.autoPlayCount || 0) + 1);
  addHistory(room, `🤖 [Auto-Play ${player.autoPlayCount}/${MAX_AUTO_PLAY}] Bidak ${player.name} dijalankan otomatis oleh sistem.`);

  if (room.dice === null) {
    handleRoll(room, player.id, true);
  } else {
    const bestPawn = chooseBestPawn(room, player, room.dice);
    if (bestPawn !== null) handleMove(room, player.id, bestPawn, true);
  }
}

// ==========================================
// DADU
// ==========================================

function handleRoll(room, playerId, isAuto = false) {
  if (!room || !room.started || room.winner) return;
  const currentPlayer = room.players[room.turn];
  if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.isOut) return;
  if (room.dice !== null || room.rolling || room.animatingMove) return;

  if (room.turnTimer) clearTimeout(room.turnTimer);
  if (!isAuto && !currentPlayer.isBot) currentPlayer.autoPlayCount = 0;

  // Pemain yang memegang skill eliminasi tetapi memilih melempar dadu: poin skill diakumulasi 2x
  if (currentPlayer.skillUnlocked && (currentPlayer.skillPoints || 0) > 0 && !currentPlayer.accumulatedThisTurn) {
    currentPlayer.skillPoints *= 2;
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

    if (getMovablePawns(room, currentPlayer, roll).length === 0) {
      // Angka 6 tetap memberi lemparan bonus walaupun tidak ada bidak yang bisa jalan
      // (mis. bidak terakhir di jalur finish butuh angka yang lebih kecil)
      const bonus = roll === 6;
      room.message = bonus
        ? `${currentPlayer.name} dapat 6 tapi tidak ada langkah. Tetap dapat lemparan bonus!`
        : `${currentPlayer.name} mendapatkan angka ${roll}, tetapi tidak ada bidak yang dapat melangkah.`;
      addHistory(room, `${currentPlayer.name} melempar dadu: ${roll} (tidak ada langkah valid${bonus ? ', lempar lagi' : ''})`);
      emitRoom(room);
      if (room.passTimer) clearTimeout(room.passTimer);
      room.passTimer = roomTimeout(room, () => {
        if (!bonus) return advanceTurn(room);
        room.dice = null;
        emitRoom(room);
        triggerTurn(room);
      }, 1300);
      return;
    }

    room.message = `${currentPlayer.name} mendapatkan angka ${roll}! Pilih bidak untuk dijalankan.`;
    addHistory(room, `${currentPlayer.name} melempar dadu: ${roll}`);
    emitRoom(room);

    if (currentPlayer.isBot || isAuto || !currentPlayer.connected) {
      scheduleAutoMove(room, currentPlayer, isAuto);
    } else {
      triggerTurn(room);
    }
  }, 750);
}

// ==========================================
// LANGKAH BIDAK
// ==========================================

function handleMove(room, playerId, pawnIdx, isAuto = false) {
  if (!room || !room.started || room.winner || room.rolling || room.animatingMove) return;
  const player = room.players[room.turn];
  if (!player || player.id !== playerId || player.isOut) return;
  if (room.dice === null) return;
  if (!isPawnIndex(pawnIdx)) return;
  if (!canPawnMove(room, player, pawnIdx, room.dice)) return;

  if (room.turnTimer) clearTimeout(room.turnTimer);
  if (!isAuto && !player.isBot) player.autoPlayCount = 0;

  const pawns = room.pawns[playerId];
  const fromVal = pawns[pawnIdx];
  const rollVal = room.dice;
  const toVal = fromVal === 0 ? 1 : fromVal + rollVal;
  const steps = fromVal === 0 ? 1 : rollVal;

  room.animatingMove = { id: eventId(), playerId, pawnIdx, from: fromVal, to: toVal, steps, color: player.color };
  room.lastCapture = null;
  room.lastBlackHole = null;
  room.lastGoal = null;

  pawns[pawnIdx] = toVal;
  room.message = `${player.name} memajukan bidak ${pawnIdx + 1} (${steps} langkah)...`;
  emitRoom(room);

  // Efek langkah diproses setelah animasi di klien selesai
  if (room.moveTimer) clearTimeout(room.moveTimer);
  room.moveTimer = roomTimeout(room, () => {
    room.animatingMove = null;
    const captured = resolveLanding(room, player, pawnIdx, toVal);

    if (pawns.every(v => v === FINISH)) {
      declareWinner(room, player);
      return;
    }

    const reachedGoal = toVal === FINISH;
    if (reachedGoal) resolveGoal(room, player, pawnIdx);
    room.dice = null;

    // Angka 6, bidak masuk finish, atau memakan lawan memberi bonus giliran
    if (rollVal === 6 || reachedGoal || captured) {
      if (reachedGoal) {
        player.accumulatedThisTurn = false;
        room.message = `🎯 Bidak masuk ke garis tengah! ${player.name} dapat bonus giliran lempar dadu & jalan satu bidak lagi!`;
        addHistory(room, `🎯 ${player.name} memasukkan bidak ke tengah (bonus lempar dadu & jalan lagi)!`);
      } else if (captured) {
        player.accumulatedThisTurn = false;
        room.message = `⚔️ Bidak lawan berhasil dieliminasi! ${player.name} dapat giliran jalan lagi sekali!${room.lastBlackHole ? ' (Bidakmu sendiri tersedot Black Hole.)' : ''}`;
        addHistory(room, `⚔️ ${player.name} mengeliminasi bidak lawan (bonus lempar dadu & jalan lagi)!`);
      } else {
        room.message = `Dapat angka 6! ${player.name} dapat melempar dadu sekali lagi.`;
        addHistory(room, `🎲 ${player.name} dapat angka 6 (bonus lempar lagi)!`);
      }
      emitRoom(room);
      triggerTurn(room);
    } else {
      if (fromVal === 0 && rollVal === 1) addHistory(room, `🚪 ${player.name} keluar kotak dengan angka 1.`);
      advanceTurn(room);
    }
  }, steps * 220 + 360);
}

// Efek petak tujuan di lintasan utama. Return true jika ada bidak lawan yang dimakan.
function resolveLanding(room, player, pawnIdx, toVal) {
  if (toVal < 1 || toVal > 39) return false;
  const trackPos = getTrackIndex(COLORS.indexOf(player.color), toVal);
  const safeZonesActive = room.settings?.safeZones !== false;
  let captured = false;

  // 1. Makan bidak lawan. Dicek lebih dulu, termasuk di petak Black Hole: lawan yang bertahan
  //    di sana (memakai perisai) tetap bisa dimakan dan tetap memberi bonus giliran.
  if (!(safeZonesActive && SAFE_TRACK_INDICES.includes(trackPos))) {
    for (const opponent of room.players) {
      // Bidak milik pemain yang sudah out TETAP bisa diinjak & dikembalikan ke base
      if (opponent.id === player.id) continue;
      const oppColorIdx = COLORS.indexOf(opponent.color);
      const oppPawns = room.pawns[opponent.id];
      if (!oppPawns) continue;

      oppPawns.forEach((oppVal, j) => {
        if (oppVal < 1 || oppVal > 39) return;
        const oppTrack = getTrackIndex(oppColorIdx, oppVal);
        if (oppTrack !== trackPos || oppTrack === COLOR_OFFSETS[oppColorIdx]) return; // Kebal di kotak base warnanya

        oppPawns[j] = 0;
        captured = true;
        room.lastCapture = {
          id: eventId(),
          attacker: player.name,
          defender: opponent.name,
          color: opponent.color,
          defenderIsOut: !!opponent.isOut,
          trackPos
        };
        addHistory(room, `⚔️ ${player.name} memakan bidak ${opponent.name}${opponent.isOut ? ' (pemain out)' : ''}!`);
        runItemHooks(room, player, 'capture', { victim: opponent, pawnIdx: j });
      });
    }
  }

  // 2. Efek Black Hole pada bidak yang baru mendarat (bisa dicegah item, mis. Blackhole Shield)
  if (room.settings?.blackHole && BLACK_HOLE_INDICES.includes(trackPos)) {
    if (!runItemHooks(room, player, 'blackHole', { pawnIdx, trackPos })) {
      room.pawns[player.id][pawnIdx] = 0;
      room.lastBlackHole = { id: eventId(), playerId: player.id, pawnIdx, trackPos, color: player.color, time: Date.now() };
      addHistory(room, `🕳️ Bidak ${pawnIdx + 1} milik ${player.name} menginjak Black Hole dan tersedot kembali ke Base!`);
      room.message = `🕳️ Bidak ${player.name} tersedot Black Hole ke base!`;
    }
  }
  return captured;
}

// Bidak masuk finish. Tiga bidak finish secara organik membuka Skill Eliminasi.
function resolveGoal(room, player, pawnIdx) {
  room.lastGoal = { id: eventId(), playerId: player.id, playerName: player.name, color: player.color, pawnIdx };
  addHistory(room, `⭐ ${player.name} berhasil memasukkan 1 bidak ke garis akhir!`);

  player.finishedCount = room.pawns[player.id].filter(v => v === FINISH).length;
  if (player.finishedCount === 3 && !player.skillUnlocked) {
    player.skillUnlocked = true;
    player.skillPoints = 1;
    addHistory(room, `⚡ ${player.name} BERHASIL MEMASUKKAN 3 BIDAK! SKILL ELIMINASI TERBUKA!`);
    room.message = `⚡ SKILL TERBUKA! ${player.name} dapat mengeliminasi 1 bidak lawan!`;
    room.lastSkillUnlock = { id: eventId(), playerId: player.id, playerName: player.name, playerColor: player.color, time: Date.now() };
  }
}

// ==========================================
// ITEM
// ==========================================

// Helper engine yang boleh dipakai definisi item (lihat server/items/index.js)
function gameApi(room, player, item) {
  return {
    addHistory: text => addHistory(room, text),
    setMessage: text => { room.message = text; },
    announce: ({ title, text }) => {
      room.lastItemEvent = {
        id: eventId(),
        itemId: item.id,
        icon: item.icon,
        sound: item.sound || 'chime',
        title,
        text,
        playerId: player.id,
        playerName: player.name
      };
    },
    sendPawnHome: (owner, pawnIdx) => {
      room.pawns[owner.id][pawnIdx] = 0;
    },
    recordCapture: (defender, extra = {}) => {
      room.lastCapture = { id: eventId(), attacker: player.name, defender: defender.name, color: defender.color, ...extra };
    }
  };
}

function itemContext(room, player, item, data = {}) {
  return {
    ...data,
    room,
    player,
    item,
    count: inventory.count(player, item.id),
    state: inventory.state(player, item.id),
    consume: () => inventory.consume(player, item.id),
    grant: (amount = 1) => inventory.grant(player, item.id, amount),
    game: gameApi(room, player, item)
  };
}

// Jalankan hook semua item untuk satu event. Berhenti di item pertama yang menangani event (return true).
function runItemHooks(room, player, event, data) {
  for (const item of items.list()) {
    const hook = item.hooks?.[event];
    if (hook && hook(itemContext(room, player, item, data)) === true) return true;
  }
  return false;
}

// Pemain yang sedang giliran dan boleh memakai skill/item aktif. Skill & item aktif hanya boleh
// dipakai SEBELUM melempar dadu agar tidak bisa dipakai untuk mengocok ulang.
function currentActor(socket, room) {
  if (!room || !room.started || room.winner || room.rolling || room.animatingMove) return null;
  const player = room.players[room.turn];
  if (!player || player.id !== socket.id || player.isOut) {
    socket.emit('room:error', 'Sekarang bukan giliranmu.');
    return null;
  }
  if (room.dice !== null) {
    socket.emit('room:error', 'Skill dan item hanya bisa dipakai sebelum melempar dadu.');
    return null;
  }
  return player;
}

// Target { playerId, pawnIdx } dari klien -> { player, pawnIdx }. Return null jika tidak valid.
function resolveOpponentPawn(socket, room, actor, target) {
  const targetPlayer = typeof target?.playerId === 'string' ? room.players.find(p => p.id === target.playerId) : null;
  if (!targetPlayer || targetPlayer.id === actor.id) {
    socket.emit('room:error', 'Pemain target tidak valid.');
    return null;
  }
  const pawns = room.pawns[targetPlayer.id];
  if (!pawns || !isPawnIndex(target.pawnIdx)) {
    socket.emit('room:error', 'Bidak target tidak valid.');
    return null;
  }
  const val = pawns[target.pawnIdx];
  if (val < 1 || val > 39) {
    socket.emit('room:error', 'Hanya bidak lawan di lintasan yang dapat dieliminasi.');
    return null;
  }
  return { player: targetPlayer, pawnIdx: target.pawnIdx };
}

function useItem(socket, room, { itemId, target }) {
  const item = items.get(itemId);
  if (!item || item.kind !== 'active') return socket.emit('room:error', 'Item tidak valid.');

  const player = currentActor(socket, room);
  if (!player) return;
  if (inventory.count(player, item.id) <= 0) {
    return socket.emit('room:error', `Kamu tidak punya ${item.name}. Beli di Toko atau dapatkan dari permainan.`);
  }

  let resolvedTarget = null;
  if (item.target === 'opponentPawn') {
    resolvedTarget = resolveOpponentPawn(socket, room, player, target);
    if (!resolvedTarget) return;
  }

  const ctx = itemContext(room, player, item, { target: resolvedTarget });
  const reason = item.canUse?.(ctx);
  if (reason) return socket.emit('room:error', reason);
  if (!ctx.consume()) return socket.emit('room:error', `${item.name} gagal dipakai. Coba lagi.`);

  item.use(ctx);
  emitRoom(room);
  triggerTurn(room);
}

// ==========================================
// SKILL ELIMINASI (3 bidak finish)
// ==========================================

function useSkill(socket, room, { target }) {
  const player = currentActor(socket, room);
  if (!player) return;

  const finishedCount = room.pawns[player.id].filter(v => v === FINISH).length;
  if (finishedCount < 3 || !(player.skillPoints > 0)) {
    return socket.emit('room:error', 'Skill belum terbuka atau poin skill tidak cukup.');
  }
  const victim = resolveOpponentPawn(socket, room, player, target);
  if (!victim) return;

  room.pawns[victim.player.id][victim.pawnIdx] = 0;
  player.skillPoints = 0;
  player.skillUnlocked = false;

  room.lastSkillUse = {
    id: eventId(),
    attacker: player.name,
    defender: victim.player.name,
    color: victim.player.color,
    targetPawnIdx: victim.pawnIdx
  };
  room.lastCapture = { id: eventId(), attacker: player.name, defender: victim.player.name, color: victim.player.color, isSkill: true };

  addHistory(room, `⚡ ${player.name} MENGGUNAKAN SKILL ELIMINASI: Menendang bidak ${victim.player.name} kembali ke markas! Poin skill kembali ke 0.`);
  room.message = `⚡ ${player.name} berhasil mengeliminasi bidak ${victim.player.name} dengan SKILL! Silakan lempar dadu.`;
  emitRoom(room);
  triggerTurn(room);
}

// Pemain memilih menabung skill pada giliran ini (Akumulasi 2x lipat)
function accumulateSkill(socket, room) {
  if (!room || !room.started || room.winner || room.rolling || room.animatingMove) return;
  const player = room.players[room.turn];
  if (!player || player.id !== socket.id || player.isOut) return;

  const finishedCount = (room.pawns[player.id] || []).filter(v => v === FINISH).length;
  if (finishedCount < 3 || !(player.skillPoints > 0) || player.accumulatedThisTurn) return;

  player.skillPoints = Math.max(1, player.skillPoints) * 2;
  player.accumulatedThisTurn = true;
  addHistory(room, `⚡ ${player.name} menabung skill! Poin skill dilipatgandakan menjadi ${player.skillPoints}x!`);
  room.message = `⚡ Poin skill ${player.name} terakumulasi menjadi ${player.skillPoints}x lipat!`;
  emitRoom(room);
}

module.exports = {
  startGame,
  restartGame,
  declareWinner,
  advanceTurn,
  triggerTurn,
  handleRoll,
  handleMove,
  useItem,
  useSkill,
  accumulateSkill
};
