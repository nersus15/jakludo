// Aturan main JakLudo dalam bentuk fungsi murni (tanpa socket / timer / IO)
// sehingga bisa diuji langsung lewat `npm test`.

const COLORS = ['red', 'green', 'yellow', 'blue'];
const COLOR_OFFSETS = [0, 10, 20, 30];
const SAFE_TRACK_INDICES = [0, 6, 10, 16, 20, 26, 30, 36];
const BLACK_HOLE_INDICES = [4, 14, 24, 34];
const FINISH = 44;

// Posisi bidak: 0 = markas, 1..39 = lintasan utama, 40..43 = jalur finish, 44 = finish
function getTrackIndex(colorIdx, pawnVal) {
  if (pawnVal >= 1 && pawnVal <= 39) {
    return (COLOR_OFFSETS[colorIdx] + pawnVal - 1) % 40;
  }
  return null;
}

// Warna pertama yang belum dipakai pemain lain di room
function nextFreeColor(players) {
  const used = new Set(players.map(p => p.color));
  return COLORS.find(c => !used.has(c)) || null;
}

function opponentOnTrack(room, player, trackPos, { skipOut = false } = {}) {
  for (const opp of room.players) {
    if (opp.id === player.id || (skipOut && opp.isOut)) continue;
    const oppColorIdx = COLORS.indexOf(opp.color);
    const oppPawns = room.pawns[opp.id] || [];
    if (oppPawns.some(v => v >= 1 && v <= 39 && getTrackIndex(oppColorIdx, v) === trackPos)) {
      return opp;
    }
  }
  return null;
}

// Aturan: Dalam satu kotak tidak bisa ada 2 bidak.
// - Tidak boleh mendarat di petak yang sudah ada bidak milik sendiri.
// - Tidak boleh mendarat di petak lawan jika petak tersebut adalah Safe Zone.
// - Bidak lawan di kotak base warnanya sendiri kebal dan tidak bisa diinjak.
// - Petak finish (44) boleh menampung semua bidak yang finish.
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
    if (currentPawns.some((v, idx) => idx !== pawnIdx && v === 1)) return false;
    if (safeZonesActive && opponentOnTrack(room, player, COLOR_OFFSETS[colorIdx])) return false;
    return true;
  }

  if (val > 0 && val < FINISH) {
    const newVal = val + dice;
    if (newVal > FINISH) return false;
    if (newVal === FINISH) return true;
    if (currentPawns.some((v, idx) => idx !== pawnIdx && v === newVal)) return false;

    if (newVal <= 39) {
      const targetTrack = getTrackIndex(colorIdx, newVal);

      for (const opp of room.players) {
        if (opp.id === player.id || opp.isOut) continue;
        const oppColorIdx = COLORS.indexOf(opp.color);
        if (targetTrack !== COLOR_OFFSETS[oppColorIdx]) continue;
        const oppPawns = room.pawns[opp.id] || [];
        if (oppPawns.some(v => v >= 1 && v <= 39 && getTrackIndex(oppColorIdx, v) === targetTrack)) {
          return false;
        }
      }

      const isTargetSafe = safeZonesActive && SAFE_TRACK_INDICES.includes(targetTrack);
      if (isTargetSafe && opponentOnTrack(room, player, targetTrack)) return false;
    }
    return true;
  }

  return false;
}

function getMovablePawns(room, player, dice) {
  if (!room || !player || !dice) return [];
  const result = [];
  for (let i = 0; i < 4; i++) {
    if (canPawnMove(room, player, i, dice)) result.push(i);
  }
  return result;
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

    if (next === FINISH) score += 600;
    if (val === 0) score += 300;

    if (next >= 1 && next <= 39) {
      const trackPos = getTrackIndex(colorIdx, next);
      const isTargetSafe = safeZonesActive && SAFE_TRACK_INDICES.includes(trackPos);
      if (isTargetSafe) {
        score += 150;
      } else if (opponentOnTrack(room, player, trackPos, { skipOut: true })) {
        score += 1000; // Prioritas utama: Makan lawan!
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestPawn = pIdx;
    }
  }
  return bestPawn;
}

// Validasi indeks bidak dari payload klien
function isPawnIndex(v) {
  return Number.isInteger(v) && v >= 0 && v <= 3;
}

module.exports = {
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
};
