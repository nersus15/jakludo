// Aturan bersama pemberian poin untuk SEMUA game di PlayGo (Ludo, Monster Quiz, dan game baru nanti).
// Game baru cukup memanggil canAwardPoints sebelum memberi poin supaya aturan anti-farming sama.
//
// Poin hanya diberikan jika:
// - ada minimal 2 pemain manusia (pemenang + minimal 1 pemain asli lain). Bot boleh ikut, tapi
//   menang hanya melawan bot tidak memberi poin;
// - pertandingan tidak berakhir karena lawan keluar/terputus (endReason 'forfeit').

const isBotPlayer = p => !!p && (p.isBot === true || String(p.userId || '').startsWith('bot_'));

function canAwardPoints(players, { endReason = null } = {}) {
  if (!Array.isArray(players)) return false;
  if (endReason === 'forfeit') return false;
  return players.filter(p => p && !isBotPlayer(p)).length >= 2;
}

module.exports = { canAwardPoints, isBotPlayer };
