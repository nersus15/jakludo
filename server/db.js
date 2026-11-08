const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

const DATA_DIR = process.env.JAKLUDO_DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari
const STARTER_POINTS = 200;
const WIN_POINTS = 25;
const PLAY_POINTS = 5;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ==========================================
// PENYIMPANAN JSON (cache memori + tulis atomic)
// ==========================================

// File yang rusak TIDAK boleh diperlakukan sebagai kosong: penulisan berikutnya akan
// menimpa seluruh data. Simpan salinan lalu hentikan server.
function loadJson(file, defaultVal) {
  if (!fs.existsSync(file)) return defaultVal;
  const content = fs.readFileSync(file, 'utf8').trim();
  if (!content) return defaultVal;
  try {
    return JSON.parse(content);
  } catch (err) {
    const backup = `${file}.corrupt-${Date.now()}`;
    fs.copyFileSync(file, backup);
    throw new Error(`[DB FATAL] ${file} tidak valid (${err.message}). Salinan disimpan di ${backup}. Perbaiki/pulihkan file sebelum menjalankan server.`);
  }
}

function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

const store = {
  users: loadJson(USERS_FILE, []),
  sessions: loadJson(SESSIONS_FILE, {}),
  leaderboard: loadJson(LEADERBOARD_FILE, [])
};
const FILES = { users: USERS_FILE, sessions: SESSIONS_FILE, leaderboard: LEADERBOARD_FILE };
const dirty = new Set();
let flushTimer = null;
let rankedCache = null;

function flushNow() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  for (const key of [...dirty]) {
    try {
      writeJsonAtomic(FILES[key], store[key]);
      dirty.delete(key);
    } catch (err) {
      console.error(`[DB WARNING] Gagal menulis ${FILES[key]} (${err.code || err.message}). Pastikan folder server/data dapat ditulis oleh proses server.`);
    }
  }
  // Coba ulang nanti jika masih ada yang gagal ditulis
  if (dirty.size > 0) scheduleFlush(5000);
}

function scheduleFlush(delay = 200) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushNow();
  }, delay);
}

function markDirty(key) {
  dirty.add(key);
  if (key === 'leaderboard') rankedCache = null;
  scheduleFlush();
}

// Seed leaderboard awal untuk visual awal yang menarik
if (store.leaderboard.length === 0) {
  store.leaderboard = [
    { userId: 'seed-1', username: 'ludo_emperor', name: 'Sultan JakLudo', avatar: '👑', wins: 18, matchesPlayed: 24, points: 570, authType: 'seed' },
    { userId: 'seed-2', username: 'queen_dice', name: 'Ratu Dadu', avatar: '🎲', wins: 14, matchesPlayed: 20, points: 450, authType: 'seed' },
    { userId: 'seed-3', username: 'lucky_roller', name: 'Si Hoki 6', avatar: '🔥', wins: 11, matchesPlayed: 18, points: 365, authType: 'seed' },
    { userId: 'seed-4', username: 'master_stride', name: 'Langkah Sakti', avatar: '⚡', wins: 8, matchesPlayed: 15, points: 275, authType: 'seed' }
  ];
  markDirty('leaderboard');
}

// ==========================================
// STANDARD KEAMANAN PASSWORD & VALIDASI
// ==========================================

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, message: 'Username wajib diisi.' };
  }
  const clean = username.trim();
  if (clean.length < 3 || clean.length > 20) {
    return { valid: false, message: 'Username harus memiliki panjang 3-20 karakter.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
    return { valid: false, message: 'Username hanya boleh berisi huruf, angka, dan underscore (_).' };
  }
  return { valid: true, cleanUsername: clean };
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password wajib diisi.' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password minimal 8 karakter.' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password maksimal 128 karakter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password harus mengandung minimal 1 huruf kecil.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password harus mengandung minimal 1 huruf besar.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password harus mengandung minimal 1 angka.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { valid: false, message: 'Password harus mengandung minimal 1 karakter spesial/simbol (@#$% dll).' };
  }
  return { valid: true };
}

// Scrypt async agar hashing tidak memblokir event loop game
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  try {
    const [algorithm, salt, originalKeyHex] = String(storedHash).split(':');
    if (algorithm !== 'scrypt' || !salt || !originalKeyHex) return false;
    const derivedKey = await scrypt(password, salt, 64);
    const originalKey = Buffer.from(originalKeyHex, 'hex');
    if (originalKey.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(derivedKey, originalKey);
  } catch (err) {
    console.error('Password verify error:', err);
    return false;
  }
}

// ==========================================
// MANAJEMEN USER
// ==========================================

function findUserByUsername(username) {
  const lower = String(username).toLowerCase();
  return store.users.find(u => u.username.toLowerCase() === lower);
}

function findUserById(id) {
  return store.users.find(u => u.id === id);
}

function findEntry(userId) {
  return store.leaderboard.find(b => b.userId === userId);
}

async function registerUser({ username, password, name }) {
  const userValid = validateUsername(username);
  if (!userValid.valid) return { error: userValid.message };

  const passValid = validatePassword(password);
  if (!passValid.valid) return { error: passValid.message };

  if (findUserByUsername(userValid.cleanUsername)) {
    return { error: 'Username sudah digunakan, silakan pilih username lain.' };
  }

  const passwordHash = await hashPassword(password);

  // Cek ulang: dua pendaftaran bersamaan bisa lolos cek pertama selama hashing berjalan
  if (findUserByUsername(userValid.cleanUsername)) {
    return { error: 'Username sudah digunakan, silakan pilih username lain.' };
  }

  const cleanName = typeof name === 'string' ? name.trim().slice(0, 18) : '';
  const newUser = {
    id: 'user_' + crypto.randomUUID(),
    username: userValid.cleanUsername,
    name: cleanName || userValid.cleanUsername,
    passwordHash,
    authType: 'password',
    avatar: '🎯',
    createdAt: new Date().toISOString()
  };

  store.users.push(newUser);
  markDirty('users');
  ensureLeaderboardEntry(newUser);

  const token = createSession(newUser.id);
  return { user: sanitizeUser(newUser), token };
}

async function loginUser({ username, password }) {
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return { error: 'Username dan password wajib diisi.' };
  }

  const user = findUserByUsername(username.trim());
  if (!user || !user.passwordHash) {
    return { error: 'Username atau password salah.' };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return { error: 'Username atau password salah.' };
  }

  const token = createSession(user.id);
  return { user: sanitizeUser(user), token };
}

// ==========================================
// TOKO / SHOP JAKLUDO
// ==========================================

const SHOP_ITEMS = {
  blackholeShield: {
    id: 'blackholeShield',
    name: 'Blackhole Shield',
    icon: '🛡️',
    price: 100,
    type: 'passive',
    description: 'Melindungi bidak dari sedotan Blackhole. Otomatis aktif saat menginjak petak Blackhole sehingga bidakmu tidak kembali ke markas.'
  },
  forceReturn: {
    id: 'forceReturn',
    name: 'Force Return',
    icon: '⚡',
    price: 100,
    type: 'active',
    description: 'Kemampuan eliminasi langsung instan. Aktif ketika kamu sudah berhasil menginjak bidak lawan sebanyak 3 kali.'
  }
};

function sanitizeUser(u) {
  if (!u) return null;
  const entry = findEntry(u.id);
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    email: u.email,
    authType: u.authType,
    points: entry ? (entry.points || 0) : 0,
    inventory: {
      blackholeShield: (u.inventory && u.inventory.blackholeShield) || 0,
      forceReturn: (u.inventory && u.inventory.forceReturn) || 0
    }
  };
}

// ==========================================
// SESSION MANAGEMENT (TOKEN)
// ==========================================

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  store.sessions[token] = {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  markDirty('sessions');
  return token;
}

function getUserByToken(token) {
  if (!token || typeof token !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(store.sessions, token)) return null;
  const session = store.sessions[token];

  if (Date.now() > session.expiresAt) {
    delete store.sessions[token];
    markDirty('sessions');
    return null;
  }
  return findUserById(session.userId) || null;
}

function deleteSession(token) {
  if (typeof token === 'string' && Object.prototype.hasOwnProperty.call(store.sessions, token)) {
    delete store.sessions[token];
    markDirty('sessions');
    return true;
  }
  return false;
}

function pruneExpiredSessions() {
  const now = Date.now();
  let removed = 0;
  for (const [token, s] of Object.entries(store.sessions)) {
    if (!s || now > s.expiresAt || !findUserById(s.userId)) {
      delete store.sessions[token];
      removed++;
    }
  }
  if (removed > 0) markDirty('sessions');
  return removed;
}

pruneExpiredSessions();
setInterval(pruneExpiredSessions, 60 * 60 * 1000).unref();

// ==========================================
// LEADERBOARD & LUDO KING
// ==========================================

function ensureLeaderboardEntry(user) {
  if (findEntry(user.id)) return;
  store.leaderboard.push({
    userId: user.id,
    username: user.username,
    name: user.name,
    avatar: user.avatar || '🎲',
    wins: 0,
    matchesPlayed: 0,
    points: STARTER_POINTS, // Bonus starter untuk belanja di Toko (sekali saja)
    authType: user.authType
  });
  markDirty('leaderboard');
}

// Catat hasil pertandingan. Hanya akun terdaftar yang mendapat poin, dan hanya
// jika lawannya mencakup minimal satu manusia lain (menang lawan bot tidak dihitung).
function recordMatchResult({ winnerPlayerId, players }) {
  if (!players || players.length === 0) return;
  const humans = players.filter(p => !p.isBot);
  if (humans.length < 2) return;

  let changed = false;
  for (const p of humans) {
    if (!p.userId) continue;
    const user = findUserById(p.userId);
    if (!user) continue;
    ensureLeaderboardEntry(user);
    const entry = findEntry(user.id);

    entry.matchesPlayed = (entry.matchesPlayed || 0) + 1;
    if (p.id === winnerPlayerId) {
      entry.wins = (entry.wins || 0) + 1;
      entry.points = (entry.points || 0) + WIN_POINTS;
    } else {
      entry.points = (entry.points || 0) + PLAY_POINTS;
    }
    changed = true;
  }
  if (changed) markDirty('leaderboard');
}

// Urutkan: wins -> points -> win rate. Baris bot/tamu lama tidak ditampilkan.
function getLeaderboard() {
  if (rankedCache) return rankedCache;
  const sorted = store.leaderboard
    .filter(p => p.authType !== 'bot' && p.authType !== 'player')
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.points !== a.points) return b.points - a.points;
      const aRate = a.matchesPlayed > 0 ? a.wins / a.matchesPlayed : 0;
      const bRate = b.matchesPlayed > 0 ? b.wins / b.matchesPlayed : 0;
      return bRate - aRate;
    });

  rankedCache = sorted.map((player, index) => {
    const rank = index + 1;
    const winRate = player.matchesPlayed > 0 ? Math.round((player.wins / player.matchesPlayed) * 100) : 0;
    return { ...player, rank, winRate, isLudoKing: rank === 1 && player.wins > 0 };
  });
  return rankedCache;
}

function checkIsLudoKing(userId) {
  if (!userId) return false;
  const king = getLeaderboard()[0];
  return !!(king && king.isLudoKing && king.userId === userId);
}

function buyShopItem({ userId, itemType }) {
  if (!Object.prototype.hasOwnProperty.call(SHOP_ITEMS, itemType)) {
    return { error: 'Item toko tidak valid.' };
  }
  const item = SHOP_ITEMS[itemType];

  const user = findUserById(userId);
  if (!user) return { error: 'Pengguna tidak ditemukan.' };

  ensureLeaderboardEntry(user);
  const entry = findEntry(user.id);
  const currentPoints = entry.points || 0;
  if (currentPoints < item.price) {
    return { error: `Poin tidak mencukupi. Diperlukan ${item.price} poin, kamu memiliki ${currentPoints} poin.` };
  }

  entry.points = currentPoints - item.price;
  markDirty('leaderboard');

  if (!user.inventory) user.inventory = { blackholeShield: 0, forceReturn: 0 };
  user.inventory[itemType] = (user.inventory[itemType] || 0) + 1;
  markDirty('users');

  return { success: true, item, points: entry.points, inventory: { ...user.inventory }, user: sanitizeUser(user) };
}

function consumeUserItem({ userId, itemType }) {
  const user = userId ? findUserById(userId) : null;
  if (!user || !user.inventory || !(user.inventory[itemType] > 0)) return false;
  user.inventory[itemType] -= 1;
  markDirty('users');
  return true;
}

module.exports = {
  validateUsername,
  validatePassword,
  hashPassword,
  verifyPassword,
  registerUser,
  loginUser,
  getUserByToken,
  getUserById: findUserById,
  deleteSession,
  pruneExpiredSessions,
  recordMatchResult,
  getLeaderboard,
  checkIsLudoKing,
  sanitizeUser,
  SHOP_ITEMS,
  buyShopItem,
  consumeUserItem,
  flushNow
};
