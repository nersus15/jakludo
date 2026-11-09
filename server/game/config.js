// Pengaturan waktu & batas permainan di satu tempat
module.exports = {
  // Lobby tanpa pemain yang tersambung, atau room yang permainannya sudah selesai, dihapus setelah ini
  ROOM_IDLE_TTL_MS: 5 * 60 * 1000,
  // Jeda menyimpan snapshot room ke database (mengelompokkan banyak perubahan beruntun)
  ROOM_SAVE_DELAY_MS: 300,
  // Batas waktu giliran pemain online sebelum dimainkan sistem
  TURN_TIMEOUT_MS: 15000,
  // Pemain yang koneksinya putus diberi waktu tersambung ulang sebelum gilirannya dimainkan sistem
  DISCONNECTED_TURN_DELAY_MS: 8000,
  // Pemain yang terputus baru bisa dinyatakan OUT setelah offline selama ini (bukan karena sinyal goyang)
  OFFLINE_OUT_MS: 2 * 60 * 1000,
  // Kursi pemain (selain pembuat room) di lobby ditahan selama ini setelah koneksi putus
  LOBBY_SEAT_GRACE_MS: 2 * 60 * 1000,
  // Batas auto-play berturut-turut sebelum pemain dinyatakan OUT
  MAX_AUTO_PLAY: 3,
  MAX_PLAYERS: 4,
  MAX_CHATS: 50,
  MAX_HISTORY: 15,
  EMOJIS: ['🎲', '🔥', '👏', '😂', '😭', '👑', '⚡', '🎯'],
  BOT_NAMES: { red: 'Bot Merah', green: 'Bot Hijau', yellow: 'Bot Kuning', blue: 'Bot Biru' }
};
