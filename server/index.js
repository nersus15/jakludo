const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map();
const COLORS = ['red', 'green', 'yellow', 'blue'];
const COLOR_OFFSETS = [0, 10, 20, 30];
const SAFE_TRACK_INDICES = [0, 6, 10, 16, 20, 26, 30, 36];
const BLACK_HOLE_INDICES = [4, 14, 24, 34];
const BOT_NAMES = ['Bot Merah', 'Bot Hijau', 'Bot Kuning', 'Bot Biru'];

const makeRoomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

function publicRoom(r) {
  return {
    code: r.code,
    players: r.players,
    started: r.started,
    turn: r.turn,
    dice: r.dice,
    rolling: !!r.rolling,
    animatingMove: r.animatingMove || null,
    winner: r.winner,
    pawns: r.pawns,
    message: r.message,
    lastCapture: r.lastCapture || null,
    lastBlackHole: r.lastBlackHole || null,
    lastGoal: r.lastGoal || null,
    lastSkillUse: r.lastSkillUse || null,
    history: r.history || [],
    settings: r.settings || { safeZones: true, blackHole: false }
  };
}

function emitRoom(room) {
  if (!room) return;
  io.to(room.code).emit('room:update', publicRoom(room));
}

function addHistory(room, text) {
  if (!room.history) room.history = [];
  room.history.unshift({
    id: Date.now() + Math.random(),
    text,
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  });
  if (room.history.length > 15) room.history.pop();
}

function getTrackIndex(colorIdx, pawnVal) {
  if (pawnVal >= 1 && pawnVal <= 39) {
    return (COLOR_OFFSETS[colorIdx] + pawnVal - 1) % 40;
  }
  return null;
}

// Aturan: Dalam satu kotak tidak bisa ada 2 bidak.
// - Tidak boleh mendarat di petak yang sudah ada bidak milik sendiri.
// - Tidak boleh mendarat di petak lawan jika petak tersebut adalah Safe Zone (karena tidak bisa dimakan dan tidak bisa bertumpuk).
// - Jika petak lawan bukan Safe Zone, mendarat di sana akan memakan bidak lawan (sehingga tetap hanya ada 1 bidak di petak tersebut).
// - Petak finish (44) adalah tujuan akhir dan boleh menampung semua bidak yang finish.
function canPawnMove(room, player, pawnIdx, dice) {
  if (!room || !player || dice === null || dice === undefined) return false;
  const currentPawns = room.pawns[player.id];
  if (!currentPawns) return false;

  const val = currentPawns[pawnIdx];
  const colorIdx = COLORS.indexOf(player.color);
  const safeZonesActive = room.settings?.safeZones !== false;

  // Bidak di markas (0): bisa keluar dengan angka 6 atau 1
  if (val === 0) {
    if (dice !== 6 && dice !== 1) return false;
    const newVal = 1;

    // Cek apakah petak start sudah ditempati oleh bidak sendiri
    if (currentPawns.some((v, idx) => idx !== pawnIdx && v === newVal)) {
      return false; // Terhalang oleh bidak sendiri di petak start
    }

    // Cek jika ditempati lawan dan Safe Zone aktif
    const startTrack = COLOR_OFFSETS[colorIdx];
    if (safeZonesActive) {
      for (const opp of room.players) {
        if (opp.id === player.id) continue;
        const oppColorIdx = COLORS.indexOf(opp.color);
        const oppPawns = room.pawns[opp.id] || [];
        for (const oppVal of oppPawns) {
          if (oppVal >= 1 && oppVal <= 39) {
            if (getTrackIndex(oppColorIdx, oppVal) === startTrack) {
              return false; // Terhalang oleh lawan di zona aman petak start
            }
          }
        }
      }
    }

    return true;
  }

  // Bidak di lintasan atau jalur finish (1..43)
  if (val > 0 && val < 44) {
    const newVal = val + dice;
    if (newVal > 44) return false;
    if (newVal === 44) return true; // Kotak finish boleh menampung semua bidak tamat

    // 1. Cek apakah ada bidak sendiri di petak tujuan
    if (currentPawns.some((v, idx) => idx !== pawnIdx && v === newVal)) {
      return false; // Tidak boleh ada 2 bidak sendiri dalam satu kotak
    }

    // 2. Jika di lintasan utama (1..39), cek aturan proteksi petak base lawan & Safe Zone
    if (newVal <= 39) {
      const targetTrack = getTrackIndex(colorIdx, newVal);

      // Aturan: Jika bidak lawan berada di kotak base warnanya, tidak bisa diinjak lawan
      for (const opp of room.players) {
        if (opp.id === player.id || opp.isOut) continue;
        const oppColorIdx = COLORS.indexOf(opp.color);
        const oppBaseTrack = COLOR_OFFSETS[oppColorIdx];
        if (targetTrack === oppBaseTrack) {
          const oppPawns = room.pawns[opp.id] || [];
          if (oppPawns.some(v => v >= 1 && v <= 39 && getTrackIndex(oppColorIdx, v) === targetTrack)) {
            return false; // Bidak lawan di kotak base warnanya kebal dan tidak bisa diinjak!
          }
        }
      }

      const isTargetSafe = safeZonesActive && SAFE_TRACK_INDICES.includes(targetTrack);

      if (isTargetSafe) {
        for (const opp of room.players) {
          if (opp.id === player.id) continue;
          const oppColorIdx = COLORS.indexOf(opp.color);
          const oppPawns = room.pawns[opp.id] || [];
          for (const oppVal of oppPawns) {
            if (oppVal >= 1 && oppVal <= 39) {
              if (getTrackIndex(oppColorIdx, oppVal) === targetTrack) {
                return false; // Petak aman sudah diisi lawan, tidak bisa bertumpuk dan tidak bisa dimakan
              }
            }
          }
        }
      }
    }

    return true;
  }

  return false;
}

function getMovablePawns(room, player, dice) {
  if (!room || !player || !dice) return [];
  const result = [];
  for (let i = 0; i < 4; i++) {
    if (canPawnMove(room, player, i, dice)) {
      result.push(i);
    }
  }
  return result;
}

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
    dice: null,
    rolling: false,
    animatingMove: null,
    winner: null,
    pawns: {},
    message: 'Menunggu pemain bergabung...',
    history: [],
    consecutiveSixes: 0,
    settings: {
      safeZones: true // Default: Zona Aman Aktif
    },
    botTimeout: null,
    rollTimer: null,
    passTimer: null,
    moveTimer: null,
    turnTimer: null,
    cleanupTimer: null
  };
  rooms.set(code, room);
  return joinRoom(socket, code, payload);
}

function clearRoomTimers(r) {
  if (!r) return;
  if (r.botTimeout) clearTimeout(r.botTimeout);
  if (r.rollTimer) clearTimeout(r.rollTimer);
  if (r.passTimer) clearTimeout(r.passTimer);
  if (r.moveTimer) clearTimeout(r.moveTimer);
  if (r.turnTimer) clearTimeout(r.turnTimer);
  if (r.cleanupTimer) clearTimeout(r.cleanupTimer);
}

function joinRoom(socket, code, payload) {
  const room = rooms.get(String(code || '').toUpperCase());
  if (!room) return socket.emit('room:error', 'Room tidak ditemukan. Periksa kembali kode room.');

  let rawName = typeof payload === 'object' ? payload.name : payload;
  let token = typeof payload === 'object' ? payload.token : null;
  let user = token ? db.getUserByToken(token) : null;
  let sessionId = typeof payload === 'object' ? payload.sessionId : null;

  const finalUsername = user?.username || (typeof payload === 'object' ? payload.username : null) || rawName || 'Pemain';
  const finalName = user?.name || String(rawName || finalUsername).trim().slice(0, 18) || 'Pemain';
  const isKing = db.checkIsLudoKing(finalUsername);

  // CEK APAKAH INI RECONNECT PEMAIN YANG SUDAH TERDAFTAR DI ROOM
  const existingPlayer = room.players.find(p =>
    (sessionId && p.sessionId === sessionId) ||
    (p.userId && user && p.userId === user.id) ||
    (p.username && p.username.toLowerCase() === finalUsername.toLowerCase())
  );

  if (existingPlayer) {
    if (existingPlayer.isOut) {
      return socket.emit('room:error', 'Kamu telah dinyatakan OUT dari pertandingan ini (3x tidak merespon).');
    }

    // Re-bind socket ID dan data session pemain lama
    const oldSocketId = existingPlayer.id;
    existingPlayer.id = socket.id;
    existingPlayer.connected = true;
    existingPlayer.autoPlayCount = 0; // Reset hitungan auto-play karena user sudah aktif kembali

    // Pindahkan bidak dari socket ID lama ke socket ID baru
    if (room.pawns[oldSocketId]) {
      room.pawns[socket.id] = room.pawns[oldSocketId];
      if (oldSocketId !== socket.id) {
        delete room.pawns[oldSocketId];
      }
    } else if (!room.pawns[socket.id]) {
      room.pawns[socket.id] = [0, 0, 0, 0];
    }

    if (room.host === oldSocketId) {
      room.host = socket.id;
    }

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
    io.to(room.code).emit('room:member_joined', {
      name: existingPlayer.name,
      avatar: existingPlayer.avatar,
      playerId: socket.id,
      reconnected: true
    });
    emitRoom(room);

    // Jika giliran pemain ini sedang aktif, perbarui timer agar pemain bisa langsung jalan
    if (room.started && room.players[room.turn]?.id === socket.id) {
      triggerTurn(room);
    }
    return;
  }

  // Jika bukan pemain lama dan permainan sudah dimulai
  if (room.started) return socket.emit('room:error', 'Permainan sudah dimulai.');
  if (room.players.length >= 4) return socket.emit('room:error', 'Room sudah penuh (maksimal 4 pemain).');

  const assignedSessionId = sessionId || ('sess_' + Math.random().toString(36).slice(2, 10));

  const player = {
    id: socket.id,
    sessionId: assignedSessionId,
    userId: user?.id || null,
    username: finalUsername,
    name: finalName,
    avatar: user?.avatar || '🎲',
    color: COLORS[room.players.length],
    isHost: room.players.length === 0,
    isBot: false,
    isLudoKing: isKing,
    connected: true,
    autoPlayCount: 0,
    isOut: false
  };

  const isFirstPlayer = room.players.length === 0;

  room.players.push(player);
  room.pawns[socket.id] = [0, 0, 0, 0];
  socket.join(room.code);
  socket.data.room = room.code;

  addHistory(room, `${player.isLudoKing ? '👑 [Ludo King] ' : ''}${player.name} bergabung ke dalam room.`);
  socket.emit('room:joined', {
    code: room.code,
    playerId: socket.id,
    sessionId: assignedSessionId,
    isLudoKing: isKing,
    reconnected: false
  });

  // Saat member baru bergabung via kode (bukan saat pembuat room pertama kali inisialisasi)
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
  const botId = 'bot_' + Math.random().toString(36).slice(2, 9);
  const color = COLORS[room.players.length];
  const bot = {
    id: botId,
    name: BOT_NAMES[room.players.length] || `Bot ${room.players.length + 1}`,
    color,
    isHost: false,
    isBot: true
  };
  room.players.push(bot);
  room.pawns[botId] = [0, 0, 0, 0];
  addHistory(room, `${bot.name} ditambahkan oleh host.`);
  emitRoom(room);
}

function removeBot(room, hostSocketId) {
  if (!room || room.started || room.host !== hostSocketId) return;
  const lastIdx = room.players.length - 1;
  if (lastIdx > 0 && room.players[lastIdx].isBot) {
    const removed = room.players.pop();
    delete room.pawns[removed.id];
    addHistory(room, `${removed.name} dikeluarkan.`);
    emitRoom(room);
  }
}

function declareWinner(room, winnerPlayer) {
  if (!room || room.winner) return;
  clearRoomTimers(room);
  room.winner = winnerPlayer.id;
  room.dice = null;
  room.message = `🏆 SELAMAT! ${winnerPlayer.name} MENANG!`;
  addHistory(room, `🎉 ${winnerPlayer.name} berhasil memenangkan pertandingan JakLudo!`);

  // Catat statistik match ke database & update ranking
  db.recordMatchResult({
    winnerPlayerId: winnerPlayer.id,
    winnerUsername: winnerPlayer.username || winnerPlayer.name,
    players: room.players
  });

  // Update status isLudoKing pemain di dalam room
  room.players.forEach(p => {
    p.isLudoKing = db.checkIsLudoKing(p.username);
  });

  io.emit('leaderboard:update', db.getLeaderboard());
  emitRoom(room);
}

function advanceTurn(room) {
  if (!room || !room.started || room.winner) return;
  clearRoomTimers(room);

  // Cek apakah masih ada pemain aktif yang belum OUT
  const activePlayers = room.players.filter(p => !p.isOut);
  if (activePlayers.length <= 1) {
    if (activePlayers.length === 1) {
      declareWinner(room, activePlayers[0]);
    }
    return;
  }

  // Cari giliran berikutnya yang pemainnya BELUM OUT
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

  if (nextPlayer && !nextPlayer.isOut) {
    room.message = `Giliran ${nextPlayer.name}${nextPlayer.autoPlayCount > 0 ? ` (Auto-Play ${nextPlayer.autoPlayCount}/3)` : ''}.`;
  }

  emitRoom(room);
  triggerTurn(room);
}

function chooseBestPawn(room, player, dice) {
  const currentPawns = room.pawns[player.id];
  if (!currentPawns) return null;
  const movable = getMovablePawns(room, player, dice);
  if (movable.length === 0) return null;

  const colorIdx = COLORS.indexOf(player.color);
  const safeZonesActive = room.settings?.safeZones !== false;
  let bestPawn = movable[0];
  let highestScore = -Infinity;

  for (const pIdx of movable) {
    const val = currentPawns[pIdx];
    const next = val === 0 ? 1 : val + dice;
    let score = next;

    if (next === 44) score += 600;
    if (val === 0 && (dice === 6 || dice === 1)) score += 300;

    if (next >= 1 && next <= 39) {
      const trackPos = getTrackIndex(colorIdx, next);
      const isTargetSafe = safeZonesActive && SAFE_TRACK_INDICES.includes(trackPos);

      if (!isTargetSafe) {
        for (const opp of room.players) {
          if (opp.id === player.id || opp.isOut) continue;
          const oppColorIdx = COLORS.indexOf(opp.color);
          const oppPawns = room.pawns[opp.id] || [];
          for (let j = 0; j < 4; j++) {
            if (oppPawns[j] >= 1 && oppPawns[j] <= 39) {
              if (getTrackIndex(oppColorIdx, oppPawns[j]) === trackPos) {
                score += 1000; // Prioritas utama: Makan lawan!
              }
            }
          }
        }
      } else {
        score += 150;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestPawn = pIdx;
    }
  }

  return bestPawn;
}

function executeAutoPlay(room, player) {
  if (!room || !room.started || room.winner || room.rolling || room.animatingMove) return;
  if (room.players[room.turn]?.id !== player.id) return;

  // Jika pemain sudah 3x berturut-turut tanpa respon dan belum kembali, nyatakan OUT
  if ((player.autoPlayCount || 0) >= 3) {
    player.isOut = true;
    player.autoPlayCount = 3;
    addHistory(room, `❌ ${player.name} dinyatakan OUT (batas 3x auto-play tercapai tanpa respon).`);
    room.message = `❌ ${player.name} dinyatakan OUT!`;

    const remainingActive = room.players.filter(p => !p.isOut);
    if (remainingActive.length <= 1) {
      if (remainingActive.length === 1) {
        declareWinner(room, remainingActive[0]);
      }
      return;
    }

    advanceTurn(room);
    return;
  }

  // Tambah hitungan autoPlayCount
  player.autoPlayCount = (player.autoPlayCount || 0) + 1;
  addHistory(room, `🤖 [Auto-Play ${player.autoPlayCount}/3] Bidak ${player.name} dijalankan otomatis oleh sistem.`);

  if (room.dice === null) {
    handleRoll(room, player.id, true);
  } else {
    const bestPawn = chooseBestPawn(room, player, room.dice);
    if (bestPawn !== null) {
      handleMove(room, player.id, bestPawn, true);
    }
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

  // Jika bot komputer murni
  if (currentPlayer.isBot) {
    if (room.dice === null) {
      room.botTimeout = setTimeout(() => {
        if (!rooms.has(room.code)) return;
        if (room.players[room.turn]?.id === currentPlayer.id && room.dice === null && !room.animatingMove) {
          handleRoll(room, currentPlayer.id);
        }
      }, 700);
    } else {
      const bestPawn = chooseBestPawn(room, currentPlayer, room.dice);
      if (bestPawn !== null) {
        room.botTimeout = setTimeout(() => {
          if (!rooms.has(room.code)) return;
          if (room.players[room.turn]?.id === currentPlayer.id && room.dice !== null && !room.animatingMove) {
            handleMove(room, currentPlayer.id, bestPawn);
          }
        }, 800);
      }
    }
    return;
  }

  // Jika pemain manusia:
  if (!currentPlayer.connected) {
    // Pemain sedang terputus / keluar web: tunggu 1.2 detik lalu jalankan otomatis
    room.turnTimer = setTimeout(() => {
      if (!rooms.has(room.code)) return;
      if (room.players[room.turn]?.id === currentPlayer.id && !currentPlayer.connected) {
        executeAutoPlay(room, currentPlayer);
      }
    }, 1200);
  } else {
    // Pemain online: beri batas waktu 15 detik sebelum dimainkan bot
    room.turnTimer = setTimeout(() => {
      if (!rooms.has(room.code)) return;
      if (room.players[room.turn]?.id === currentPlayer.id) {
        executeAutoPlay(room, currentPlayer);
      }
    }, 15000);
  }
}

const triggerBotTurn = triggerTurn; // Alias kompatibilitas

function handleRoll(room, playerId, isAuto = false) {
  if (!room || !room.started || room.winner) return;
  const currentPlayer = room.players[room.turn];
  if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.isOut) return;
  if (room.dice !== null || room.rolling || room.animatingMove) return;

  if (room.turnTimer) clearTimeout(room.turnTimer);

  // Jika pemain mengocok sendiri secara manual, reset hitungan autoPlayCount
  if (!isAuto && !currentPlayer.isBot) {
    currentPlayer.autoPlayCount = 0;
  }

  // Jika pemain memiliki skill eliminasi dan memilih melempar dadu (tidak memakai skill giliran ini),
  // poin skill diakumulasikan per 2 kali lipat!
  if (currentPlayer.skillUnlocked && (currentPlayer.skillPoints || 0) > 0 && !currentPlayer.accumulatedThisTurn) {
    currentPlayer.skillPoints = currentPlayer.skillPoints * 2;
    currentPlayer.accumulatedThisTurn = true;
    addHistory(room, `⚡ ${currentPlayer.name} tidak menggunakan skill giliran ini: Poin skill diakumulasi menjadi ${currentPlayer.skillPoints}x!`);
  }

  room.rolling = true;
  room.message = `${currentPlayer.name} sedang mengocok dadu...`;
  emitRoom(room);

  if (room.rollTimer) clearTimeout(room.rollTimer);
  room.rollTimer = setTimeout(() => {
    if (!rooms.has(room.code)) return;
    room.rolling = false;
    const roll = 1 + Math.floor(Math.random() * 6);
    room.dice = roll;

    if (roll === 6) {
      room.consecutiveSixes = (room.consecutiveSixes || 0) + 1;
    } else {
      room.consecutiveSixes = 0;
    }

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
      room.passTimer = setTimeout(() => {
        if (!rooms.has(room.code)) return;
        advanceTurn(room);
      }, 1300);
      return;
    }

    room.message = `${currentPlayer.name} mendapatkan angka ${roll}! Pilih bidak untuk dijalankan.`;
    addHistory(room, `${currentPlayer.name} melempar dadu: ${roll}`);
    emitRoom(room);

    // Jika bot komputer atau auto-play (pemain offline), langsung pilih bidak
    if (currentPlayer.isBot || isAuto || !currentPlayer.connected) {
      const bestPawn = chooseBestPawn(room, currentPlayer, roll);
      if (bestPawn !== null) {
        room.botTimeout = setTimeout(() => {
          if (!rooms.has(room.code)) return;
          if (room.players[room.turn]?.id === currentPlayer.id && room.dice !== null && !room.animatingMove) {
            handleMove(room, currentPlayer.id, bestPawn, isAuto);
          }
        }, 800);
      }
    } else {
      // Pemain online: beri batas waktu 15 detik untuk memilih bidak
      triggerTurn(room);
    }
  }, 750);
}

function handleMove(room, playerId, pawnIdx, isAuto = false) {
  if (!room || !room.started || room.winner || room.rolling || room.animatingMove) return;
  const currentPlayer = room.players[room.turn];
  if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.isOut) return;
  if (room.dice === null) return;
  if (!Number.isInteger(pawnIdx) || pawnIdx < 0 || pawnIdx > 3) return;

  if (room.turnTimer) clearTimeout(room.turnTimer);

  if (!isAuto && !currentPlayer.isBot) {
    currentPlayer.autoPlayCount = 0;
  }

  const currentPawns = room.pawns[playerId];
  const currentVal = currentPawns[pawnIdx];
  if (!canPawnMove(room, currentPlayer, pawnIdx, room.dice)) {
    return;
  }

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

  // Bersihkan event capture/blackhole/goal lama saat langkah baru dimulai
  room.lastCapture = null;
  room.lastBlackHole = null;
  room.lastGoal = null;

  currentPawns[pawnIdx] = newVal;
  room.message = `${currentPlayer.name} memajukan bidak ${pawnIdx + 1} (${steps} langkah)...`;
  emitRoom(room);

  const stepDelay = steps * 220 + 360;

  if (room.moveTimer) clearTimeout(room.moveTimer);
  room.moveTimer = setTimeout(() => {
    if (!rooms.has(room.code)) return;
    room.animatingMove = null;

    let captured = false;
    let capturedInfo = null;

    // Cek efek di lintasan (1..39)
    if (newVal >= 1 && newVal <= 39) {
      const trackPos = getTrackIndex(colorIdx, newVal);

      // 1. Fitur Black Hole (jika aktif dan menginjak kotak Black Hole)
      if (room.settings?.blackHole && BLACK_HOLE_INDICES.includes(trackPos)) {
        currentPawns[pawnIdx] = 0; // Tersedot langsung kembali ke base!
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
      } else {
        // 2. Cek pemakanan lawan di lintasan
        const isSafe = safeZonesActive && SAFE_TRACK_INDICES.includes(trackPos);

        if (!isSafe) {
          for (const opponent of room.players) {
            if (opponent.id === currentPlayer.id || opponent.isOut) continue;
            const oppColorIdx = COLORS.indexOf(opponent.color);
            const oppPawns = room.pawns[opponent.id];
            if (!oppPawns) continue;

            for (let j = 0; j < 4; j++) {
              const oppVal = oppPawns[j];
              if (oppVal >= 1 && oppVal <= 39) {
                const oppTrack = getTrackIndex(oppColorIdx, oppVal);
                if (oppTrack === trackPos) {
                  // Aturan: Jika bidak lawan ada di kotak base warnanya, tidak bisa diinjak lawan!
                  const isOppBaseStart = oppTrack === COLOR_OFFSETS[oppColorIdx];
                  if (isOppBaseStart) {
                    continue; // Kebal di kotak base warnanya sendiri
                  }

                  oppPawns[j] = 0; // Tendang balik ke markas
                  captured = true;
                  capturedInfo = {
                    id: Date.now() + Math.random(),
                    attacker: currentPlayer.name,
                    defender: opponent.name,
                    color: opponent.color,
                    trackPos
                  };
                  addHistory(room, `⚔️ ${currentPlayer.name} memakan bidak ${opponent.name}!`);
                }
              }
            }
          }
        }
      }
    }

    const isWinner = currentPawns.every(p => p === 44);
    if (isWinner) {
      declareWinner(room, currentPlayer);
      return;
    }

    let goalInfo = null;
    const reachedGoal = newVal === 44;
    if (reachedGoal) {
      goalInfo = {
        id: Date.now() + Math.random(),
        playerId,
        playerName: currentPlayer.name,
        color: currentPlayer.color,
        pawnIdx
      };
      addHistory(room, `⭐ ${currentPlayer.name} berhasil memasukkan 1 bidak ke garis akhir!`);

      // Cek jumlah bidak finish organik pemain
      const finishedCount = currentPawns.filter(v => v === 44).length;
      currentPlayer.finishedCount = finishedCount;

      // Fitur Skill: saat pemain sudah berhasil memasukkan tiga buah bidak secara organik
      if (finishedCount === 3 && !currentPlayer.skillUnlocked) {
        currentPlayer.skillUnlocked = true;
        currentPlayer.skillPoints = 1; // Poin skill awal = 1 kesempatan eliminasi
        addHistory(room, `⚡ ${currentPlayer.name} BERHASIL MEMASUKKAN 3 BIDAK! SKILL ELIMINASI TERBUKA!`);
        room.message = `⚡ SKILL TERBUKA! ${currentPlayer.name} dapat mengeliminasi 1 bidak lawan!`;
      }
    }

    // Aturan: Angka 6 ATAU berhasil memasukkan satu bidak ke tengah memberikan bonus lempar dadu & jalan satu bidak lagi!
    const extraTurn = (rollVal === 6) || reachedGoal;
    room.dice = null;
    room.lastCapture = capturedInfo;
    room.lastGoal = goalInfo;

    if (extraTurn) {
      if (reachedGoal) {
        currentPlayer.accumulatedThisTurn = false;
        room.message = `🎯 Bidak masuk ke garis tengah! ${currentPlayer.name} dapat bonus giliran lempar dadu & jalan satu bidak lagi!`;
        addHistory(room, `🎯 ${currentPlayer.name} memasukkan bidak ke tengah (bonus lempar dadu & jalan lagi)!`);
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

io.on('connection', socket => {
  socket.on('room:create', payload => createRoom(socket, payload));
  socket.on('room:join', payload => joinRoom(socket, payload?.code, payload));
  socket.on('leaderboard:get', () => socket.emit('leaderboard:update', db.getLeaderboard()));

  // Cek apakah user memiliki room yang masih aktif
  socket.on('room:check_active', ({ code, sessionId, username }, callback) => {
    if (!code) return callback && callback({ active: false });
    const r = rooms.get(String(code).toUpperCase());
    if (!r) return callback && callback({ active: false });

    const player = r.players.find(p =>
      (sessionId && p.sessionId === sessionId) ||
      (username && p.username && p.username.toLowerCase() === String(username).toLowerCase())
    );

    if (!player) return callback && callback({ active: false });
    return callback && callback({
      active: true,
      started: r.started,
      isOut: !!player.isOut,
      winner: r.winner,
      code: r.code
    });
  });

  // Pengaturan room (misal: Toggle Safe Zone & Black Hole)
  socket.on('room:update_settings', ({ safeZones, blackHole }) => {
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
    if (changed) {
      emitRoom(r);
    }
  });

  socket.on('room:add_bot', () => {
    const r = rooms.get(socket.data.room);
    if (r) addBot(r, socket.id);
  });

  socket.on('room:remove_bot', () => {
    const r = rooms.get(socket.data.room);
    if (r) removeBot(r, socket.id);
  });

  socket.on('game:start', () => {
    const r = rooms.get(socket.data.room);
    if (!r || r.host !== socket.id || r.players.length < 2) return;
    r.started = true;
    r.turn = 0;
    r.dice = null;
    r.winner = null;
    r.consecutiveSixes = 0;
    r.animatingMove = null;
    for (const p of r.players) {
      p.connected = true;
      p.autoPlayCount = 0;
      p.isOut = false;
    }
    r.message = `Permainan dimulai! Giliran ${r.players[0].name}.`;
    addHistory(r, '🎲 Permainan dimulai!');
    emitRoom(r);
    triggerTurn(r);
  });

  socket.on('game:restart', () => {
    const r = rooms.get(socket.data.room);
    if (!r || r.host !== socket.id) return;
    r.started = true;
    r.turn = 0;
    r.dice = null;
    r.rolling = false;
    r.animatingMove = null;
    r.winner = null;
    r.consecutiveSixes = 0;
    for (const p of r.players) {
      r.pawns[p.id] = [0, 0, 0, 0];
      p.connected = true;
      p.autoPlayCount = 0;
      p.isOut = false;
    }
    r.message = `Permainan baru dimulai! Giliran ${r.players[0].name}.`;
    addHistory(r, '🔄 Permainan di-reset.');
    emitRoom(r);
    triggerTurn(r);
  });

  socket.on('game:roll', () => {
    const r = rooms.get(socket.data.room);
    if (r) handleRoll(r, socket.id);
  });

  socket.on('game:move', ({ pawn }) => {
    const r = rooms.get(socket.data.room);
    if (r) handleMove(r, socket.id, pawn);
  });

  // Fitur Skill: Eliminasi 1 bidak lawan pilihan saat sudah memasukkan 3 bidak secara organik
  socket.on('game:use_skill', ({ targetPlayerId, targetPawnIdx }) => {
    const r = rooms.get(socket.data.room);
    if (!r || !r.started || r.winner || r.rolling || r.animatingMove) return;

    const currentPlayer = r.players[r.turn];
    if (!currentPlayer || currentPlayer.id !== socket.id || currentPlayer.isOut) {
      return socket.emit('room:error', 'Sekarang bukan giliranmu.');
    }

    const myPawns = r.pawns[currentPlayer.id] || [];
    const finishedCount = myPawns.filter(v => v === 44).length;
    if (finishedCount < 3 || !currentPlayer.skillPoints || currentPlayer.skillPoints <= 0) {
      return socket.emit('room:error', 'Skill belum terbuka atau poin skill tidak cukup.');
    }

    const targetPlayer = r.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer || targetPlayer.id === currentPlayer.id || targetPlayer.isOut) {
      return socket.emit('room:error', 'Pemain target tidak valid.');
    }

    const oppPawns = r.pawns[targetPlayer.id];
    if (!oppPawns || targetPawnIdx < 0 || targetPawnIdx > 3) {
      return socket.emit('room:error', 'Bidak target tidak valid.');
    }

    const oppVal = oppPawns[targetPawnIdx];
    if (oppVal < 1 || oppVal > 39) {
      return socket.emit('room:error', 'Hanya bidak yang sedang berada di arena lintasan yang dapat dieliminasi.');
    }

    // Eksekusi eliminasi: tendang bidak lawan kembali ke markas
    oppPawns[targetPawnIdx] = 0;

    // Aturan: setelah mengeliminasi, poin skill RESET MENJADI 0
    currentPlayer.skillPoints = 0;
    currentPlayer.skillUnlocked = false;

    const skillEvent = {
      id: Date.now() + Math.random(),
      attacker: currentPlayer.name,
      defender: targetPlayer.name,
      color: targetPlayer.color,
      targetPawnIdx
    };

    r.lastSkillUse = skillEvent;
    r.lastCapture = {
      id: Date.now() + Math.random(),
      attacker: currentPlayer.name,
      defender: targetPlayer.name,
      color: targetPlayer.color,
      isSkill: true
    };

    addHistory(r, `⚡ ${currentPlayer.name} MENGGUNAKAN SKILL ELIMINASI: Menendang bidak ${targetPlayer.name} kembali ke markas! Poin skill kembali ke 0.`);
    r.message = `⚡ ${currentPlayer.name} menggunakan SKILL ELIMINASI pada bidak ${targetPlayer.name}!`;

    emitRoom(r);
  });

  // Pemain memilih tidak menggunakan skill pada giliran ini (Akumulasi 2x lipat)
  socket.on('game:accumulate_skill', () => {
    const r = rooms.get(socket.data.room);
    if (!r || !r.started || r.winner || r.rolling || r.animatingMove) return;

    const currentPlayer = r.players[r.turn];
    if (!currentPlayer || currentPlayer.id !== socket.id || currentPlayer.isOut) return;

    const myPawns = r.pawns[currentPlayer.id] || [];
    const finishedCount = myPawns.filter(v => v === 44).length;
    if (finishedCount < 3 || !currentPlayer.skillPoints || currentPlayer.skillPoints <= 0) return;

    if (!currentPlayer.accumulatedThisTurn) {
      currentPlayer.skillPoints = Math.max(1, currentPlayer.skillPoints) * 2;
      currentPlayer.accumulatedThisTurn = true;
      addHistory(r, `⚡ ${currentPlayer.name} menabung skill! Poin skill dilipatgandakan menjadi ${currentPlayer.skillPoints}x!`);
      r.message = `⚡ Poin skill ${currentPlayer.name} terakumulasi menjadi ${currentPlayer.skillPoints}x lipat!`;
      emitRoom(r);
    }
  });

  socket.on('game:reaction', ({ emoji }) => {
    const r = rooms.get(socket.data.room);
    if (!r || !emoji) return;
    const player = r.players.find(p => p.id === socket.id);
    if (player) {
      io.to(r.code).emit('room:reaction', {
        id: Date.now() + Math.random(),
        playerId: socket.id,
        playerName: player.name,
        color: player.color,
        emoji
      });
    }
  });

  socket.on('room:leave', ({ code } = {}) => {
    const roomCode = (code || socket.data.room || '').toUpperCase();
    const r = rooms.get(roomCode);
    if (!r) {
      delete socket.data.room;
      return;
    }

    const departingPlayer = r.players.find(p => p.id === socket.id);
    if (!departingPlayer) {
      socket.leave(roomCode);
      delete socket.data.room;
      return;
    }

    if (!r.started) {
      r.players = r.players.filter(p => p.id !== socket.id);
      delete r.pawns[socket.id];
      addHistory(r, `${departingPlayer.name} keluar dari ruang tunggu.`);

      const hasHuman = r.players.some(p => !p.isBot);
      if (!hasHuman || r.players.length === 0) {
        clearRoomTimers(r);
        rooms.delete(roomCode);
      } else {
        if (r.host === socket.id) {
          const nextHost = r.players.find(p => !p.isBot) || r.players[0];
          r.host = nextHost.id;
          nextHost.isHost = true;
        }
        emitRoom(r);
      }
    } else {
      departingPlayer.isOut = true;
      departingPlayer.connected = false;
      departingPlayer.sessionId = null;
      addHistory(r, `🚪 ${departingPlayer.name} keluar dari permainan (menyerah).`);

      const activeHumans = r.players.filter(p => !p.isBot && !p.isOut);
      if (activeHumans.length === 0) {
        clearRoomTimers(r);
        rooms.delete(roomCode);
      } else {
        const activeRemaining = r.players.filter(p => !p.isOut);
        if (activeRemaining.length === 1 && !r.winner) {
          declareWinner(r, activeRemaining[0]);
        } else if (r.players[r.turn]?.id === departingPlayer.id) {
          nextTurn(r);
        }
        emitRoom(r);
      }
    }

    socket.leave(roomCode);
    delete socket.data.room;
  });

  socket.on('disconnect', () => {
    const code = socket.data.room;
    const r = rooms.get(code);
    if (!r) return;

    const departingPlayer = r.players.find(p => p.id === socket.id);
    if (!departingPlayer) return;

    // Jika permainan belum dimulai, keluarkan dari ruang tunggu (lobby)
    if (!r.started) {
      r.players = r.players.filter(p => p.id !== socket.id);
      delete r.pawns[socket.id];
      addHistory(r, `${departingPlayer.name} meninggalkan ruang tunggu.`);

      const hasHuman = r.players.some(p => !p.isBot);
      if (!hasHuman || r.players.length === 0) {
        clearRoomTimers(r);
        rooms.delete(code);
        return;
      }

      if (r.host === socket.id) {
        const nextHost = r.players.find(p => !p.isBot) || r.players[0];
        r.host = nextHost.id;
        nextHost.isHost = true;
      }

      emitRoom(r);
      return;
    }

    // GAME SUDAH BERLANGSUNG:
    // JANGAN hapus pemain/bidak! Tandai disconnected agar pemain bisa reconnect kembali.
    departingPlayer.connected = false;
    addHistory(r, `⚠️ ${departingPlayer.name} keluar web/terputus (dimainkan bot sementara).`);
    emitRoom(r);

    // Jika giliran pemain yang terputus, picu giliran auto-play
    if (r.players[r.turn]?.id === departingPlayer.id) {
      triggerTurn(r);
    }
  });
});

app.get('/health', (_, res) => res.json({ ok: true, rooms: rooms.size }));

// ==========================================
// REST APIS: AUTHENTICATION & LEADERBOARD
// ==========================================

// 1. Register Akun baru dengan Username Unik & Standar Keamanan Password
app.post('/api/auth/register', (req, res) => {
  const { username, password, name } = req.body || {};
  const result = db.registerUser({ username, password, name });
  if (result.error) {
    return res.status(400).json({ success: false, error: result.error });
  }
  const isKing = db.checkIsLudoKing(result.user.username);
  res.json({ success: true, user: { ...result.user, isLudoKing: isKing }, token: result.token });
});

// 2. Login Akun dengan Username & Password
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const result = db.loginUser({ username, password });
  if (result.error) {
    return res.status(400).json({ success: false, error: result.error });
  }
  const isKing = db.checkIsLudoKing(result.user.username);
  res.json({ success: true, user: { ...result.user, isLudoKing: isKing }, token: result.token });
});

// 3. Ambil Profil User yang Sedang Login
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const user = db.getUserByToken(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized / Sesi telah kedaluwarsa.' });
  }
  const isKing = db.checkIsLudoKing(user.username);
  res.json({ success: true, user: { ...db.sanitizeUser(user), isLudoKing: isKing } });
});

// 5. Leaderboard & Status Ludo King
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = db.getLeaderboard();
  const ludoKing = leaderboard[0] && leaderboard[0].isLudoKing ? leaderboard[0] : null;
  res.json({ success: true, leaderboard, ludoKing });
});
const dist = path.join(__dirname, '../dist');
app.use(express.static(dist));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));

const PORT = process.env.PORT || 5172;
server.listen(PORT, () => console.log(`JakLudo server listening on ${PORT}`));
