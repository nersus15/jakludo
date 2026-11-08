const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { DatabaseSync } = require('node:sqlite');

const scrypt = promisify(crypto.scrypt);

const DATA_DIR = process.env.JAKLUDO_DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'jakludo.db');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari
const STARTER_POINTS = 200;
const WIN_POINTS = 25;
const PLAY_POINTS = 5;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ==========================================
// DATABASE SQLITE (satu file di folder data, dipasang sebagai volume di Docker)
// ==========================================

const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

// Setiap versi skema adalah satu langkah migrasi. Tambah langkah baru di akhir daftar.
const MIGRATIONS = [
  // v1: tabel awal
  () => db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      password_hash TEXT,
      auth_type TEXT NOT NULL DEFAULT 'password',
      avatar TEXT,
      email TEXT,
      shield_count INTEGER NOT NULL DEFAULT 0,
      force_return_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Token disimpan sebagai hash SHA-256: file database yang bocor tidak berisi token login yang bisa dipakai
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);

    -- user_id tanpa foreign key: database lama bisa berisi baris tanpa akun (bot/tamu/contoh)
    CREATE TABLE IF NOT EXISTS leaderboard (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      wins INTEGER NOT NULL DEFAULT 0,
      matches_played INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      auth_type TEXT NOT NULL
    );

    -- Snapshot room yang sedang berjalan agar permainan selamat dari restart/deploy server
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `),

  // v2: inventaris generik per item (sebelumnya satu kolom per jenis item di tabel users),
  // supaya item baru bisa ditambahkan tanpa mengubah skema database
  () => db.exec(`
    CREATE TABLE user_items (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      PRIMARY KEY (user_id, item_id)
    );
    INSERT INTO user_items (user_id, item_id, quantity)
      SELECT id, 'blackholeShield', shield_count FROM users WHERE shield_count > 0;
    INSERT INTO user_items (user_id, item_id, quantity)
      SELECT id, 'forceReturn', force_return_count FROM users WHERE force_return_count > 0;
    ALTER TABLE users DROP COLUMN shield_count;
    ALTER TABLE users DROP COLUMN force_return_count;
  `)
];

function migrate() {
  const { user_version: version } = db.prepare('PRAGMA user_version').get();
  for (let v = version; v < MIGRATIONS.length; v++) {
    transaction(() => {
      MIGRATIONS[v]();
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

// Impor sekali dari penyimpanan JSON lama (users.json, sessions.json, leaderboard.json).
// File JSON yang rusak menghentikan server agar data tidak diam-diam hilang.
function importLegacyJson() {
  const files = {
    users: path.join(DATA_DIR, 'users.json'),
    sessions: path.join(DATA_DIR, 'sessions.json'),
    leaderboard: path.join(DATA_DIR, 'leaderboard.json')
  };
  if (!Object.values(files).some(f => fs.existsSync(f))) return;

  const load = (file, fallback) => {
    if (!fs.existsSync(file)) return fallback;
    const content = fs.readFileSync(file, 'utf8').trim();
    if (!content) return fallback;
    try {
      return JSON.parse(content);
    } catch (err) {
      throw new Error(`[DB FATAL] ${file} tidak valid (${err.message}). Perbaiki/pulihkan file ini agar data bisa dipindahkan ke SQLite.`);
    }
  };
  const users = load(files.users, []);
  const sessions = load(files.sessions, {});
  const leaderboard = load(files.leaderboard, []);

  transaction(() => {
    const insertUser = db.prepare(`INSERT OR IGNORE INTO users
      (id, username, name, password_hash, auth_type, avatar, email, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertItem = db.prepare('INSERT OR IGNORE INTO user_items (user_id, item_id, quantity) VALUES (?, ?, ?)');
    for (const u of users) {
      insertUser.run(u.id, u.username, u.name || u.username, u.passwordHash || null, u.authType || 'password',
        u.avatar || null, u.email || null, u.createdAt || new Date().toISOString());
      for (const [itemId, quantity] of Object.entries(u.inventory || {})) {
        if (quantity > 0) insertItem.run(u.id, itemId, quantity);
      }
    }
    const insertSession = db.prepare('INSERT OR IGNORE INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)');
    const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?');
    for (const [token, s] of Object.entries(sessions)) {
      if (s && userExists.get(s.userId) && s.expiresAt > Date.now()) {
        insertSession.run(hashToken(token), s.userId, s.createdAt || Date.now(), s.expiresAt);
      }
    }
    const insertEntry = db.prepare(`INSERT OR IGNORE INTO leaderboard
      (user_id, username, name, avatar, wins, matches_played, points, auth_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const e of leaderboard) {
      if (!e.userId || !e.username) continue;
      insertEntry.run(e.userId, e.username, e.name || e.username, e.avatar || null, e.wins || 0,
        e.matchesPlayed || 0, e.points || 0, e.authType || 'player');
    }
  });

  const stamp = Date.now();
  for (const file of Object.values(files)) {
    if (fs.existsSync(file)) fs.renameSync(file, `${file}.migrated-${stamp}`);
  }
  console.log(`[DB] Data JSON lama dipindahkan ke SQLite: ${users.length} user, ${leaderboard.length} baris leaderboard.`);
}

migrate();
importLegacyJson();

const q = {
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  userByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  insertUser: db.prepare(`INSERT INTO users (id, username, name, password_hash, auth_type, avatar, created_at)
    VALUES (?, ?, ?, ?, 'password', ?, ?)`),
  insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'),
  sessionByHash: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  pruneSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  entryByUser: db.prepare('SELECT * FROM leaderboard WHERE user_id = ?'),
  insertEntry: db.prepare(`INSERT OR IGNORE INTO leaderboard
    (user_id, username, name, avatar, wins, matches_played, points, auth_type) VALUES (?, ?, ?, ?, 0, 0, ?, ?)`),
  addResult: db.prepare(`UPDATE leaderboard SET matches_played = matches_played + 1,
    wins = wins + ?, points = points + ? WHERE user_id = ?`),
  // Hanya akun asli: baris bot, tamu, dan pemain contoh (seed) versi lama tidak ikut peringkat
  ranked: db.prepare(`SELECT * FROM leaderboard WHERE auth_type NOT IN ('bot', 'player', 'seed')
    ORDER BY wins DESC, points DESC,
      CASE WHEN matches_played > 0 THEN CAST(wins AS REAL) / matches_played ELSE 0 END DESC`),
  spendPoints: db.prepare('UPDATE leaderboard SET points = points - ? WHERE user_id = ? AND points >= ?'),
  userItems: db.prepare('SELECT item_id, quantity FROM user_items WHERE user_id = ? AND quantity > 0'),
  addItem: db.prepare(`INSERT INTO user_items (user_id, item_id, quantity) VALUES (?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity`),
  useItem: db.prepare('UPDATE user_items SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ? AND quantity > 0'),
  saveRoom: db.prepare(`INSERT INTO rooms (code, state, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`),
  deleteRoom: db.prepare('DELETE FROM rooms WHERE code = ?'),
  allRooms: db.prepare('SELECT code, state, updated_at FROM rooms')
};

// Bentuk user sama seperti versi JSON sebelumnya agar kode pemanggil tidak berubah
function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    passwordHash: row.password_hash,
    authType: row.auth_type,
    avatar: row.avatar,
    email: row.email || undefined,
    createdAt: row.created_at,
    inventory: getUserItems(row.id)
  };
}

// Stok item milik akun: { [itemId]: jumlah }
function getUserItems(userId) {
  const items = {};
  for (const row of q.userItems.all(userId)) items[row.item_id] = row.quantity;
  return items;
}

function rowToEntry(row) {
  return {
    userId: row.user_id,
    username: row.username,
    name: row.name,
    avatar: row.avatar,
    wins: row.wins,
    matchesPlayed: row.matches_played,
    points: row.points,
    authType: row.auth_type
  };
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

function findUserById(id) {
  return typeof id === 'string' ? rowToUser(q.userById.get(id)) : null;
}

function findUserByUsername(username) {
  return rowToUser(q.userByUsername.get(String(username)));
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
  const displayName = (typeof name === 'string' ? name.trim().slice(0, 18) : '') || userValid.cleanUsername;
  const id = 'user_' + crypto.randomUUID();

  try {
    transaction(() => {
      q.insertUser.run(id, userValid.cleanUsername, displayName, passwordHash, '🎯', new Date().toISOString());
      q.insertEntry.run(id, userValid.cleanUsername, displayName, '🎯', STARTER_POINTS, 'password');
    });
  } catch (err) {
    // Dua pendaftaran bersamaan dengan username yang sama: constraint UNIQUE yang menentukan
    if (String(err.message).includes('UNIQUE')) {
      return { error: 'Username sudah digunakan, silakan pilih username lain.' };
    }
    throw err;
  }

  return { user: sanitizeUser(findUserById(id)), token: createSession(id) };
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
  return { user: sanitizeUser(user), token: createSession(user.id) };
}

// ==========================================
// PROFIL USER
// ==========================================

function sanitizeUser(u) {
  if (!u) return null;
  const entry = q.entryByUser.get(u.id);
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    email: u.email,
    authType: u.authType,
    points: entry ? entry.points : 0,
    inventory: { ...u.inventory }
  };
}

// ==========================================
// SESSION MANAGEMENT (TOKEN)
// ==========================================

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  q.insertSession.run(hashToken(token), userId, now, now + SESSION_TTL_MS);
  return token;
}

function getUserByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const hash = hashToken(token);
  const session = q.sessionByHash.get(hash);
  if (!session) return null;
  if (Date.now() > session.expires_at) {
    q.deleteSession.run(hash);
    return null;
  }
  return findUserById(session.user_id);
}

function deleteSession(token) {
  if (!token || typeof token !== 'string') return false;
  return q.deleteSession.run(hashToken(token)).changes > 0;
}

function pruneExpiredSessions() {
  return Number(q.pruneSessions.run(Date.now()).changes);
}

pruneExpiredSessions();
setInterval(pruneExpiredSessions, 60 * 60 * 1000).unref();

// ==========================================
// LEADERBOARD & LUDO KING
// ==========================================

function ensureLeaderboardEntry(user) {
  q.insertEntry.run(user.id, user.username, user.name, user.avatar || '🎲', STARTER_POINTS, user.authType);
}

// Catat hasil pertandingan. Hanya akun terdaftar yang mendapat poin, dan hanya
// jika lawannya mencakup minimal satu manusia lain (menang lawan bot tidak dihitung).
function recordMatchResult({ winnerPlayerId, players }) {
  if (!players || players.length === 0) return;
  const humans = players.filter(p => !p.isBot);
  if (humans.length < 2) return;

  transaction(() => {
    for (const p of humans) {
      const user = p.userId ? findUserById(p.userId) : null;
      if (!user) continue;
      ensureLeaderboardEntry(user);
      const won = p.id === winnerPlayerId;
      q.addResult.run(won ? 1 : 0, won ? WIN_POINTS : PLAY_POINTS, user.id);
    }
  });
}

// Urutkan: wins -> points -> win rate. Baris bot/tamu lama tidak ditampilkan.
function getLeaderboard() {
  return q.ranked.all().map((row, index) => {
    const player = rowToEntry(row);
    const rank = index + 1;
    const winRate = player.matchesPlayed > 0 ? Math.round((player.wins / player.matchesPlayed) * 100) : 0;
    return { ...player, rank, winRate, isLudoKing: rank === 1 && player.wins > 0 };
  });
}

function checkIsLudoKing(userId) {
  if (!userId) return false;
  const king = q.ranked.get();
  return !!(king && king.wins > 0 && king.user_id === userId);
}

// Beli item: pengurangan poin dan penambahan stok terjadi dalam satu transaksi.
// Katalog & harga item ditentukan oleh registry item (server/items), bukan oleh database.
function purchaseItem({ userId, itemId, price }) {
  const user = findUserById(userId);
  if (!user) return { error: 'Pengguna tidak ditemukan.' };

  const bought = transaction(() => {
    ensureLeaderboardEntry(user);
    if (q.spendPoints.run(price, user.id, price).changes === 0) return false;
    q.addItem.run(user.id, itemId, 1);
    return true;
  });

  if (!bought) {
    const points = q.entryByUser.get(user.id)?.points || 0;
    return { error: `Poin tidak mencukupi. Diperlukan ${price} poin, kamu memiliki ${points} poin.` };
  }
  return { success: true, user: sanitizeUser(findUserById(user.id)) };
}

function consumeUserItem({ userId, itemId }) {
  if (!userId || typeof itemId !== 'string') return false;
  return q.useItem.run(userId, itemId).changes > 0;
}

let closed = false;

// ==========================================
// SNAPSHOT ROOM
// ==========================================

// Setelah database ditutup (server berhenti) snapshot tidak lagi disimpan
function saveRoom(code, state) {
  if (closed) return;
  q.saveRoom.run(code, JSON.stringify(state), Date.now());
}

function deleteRoom(code) {
  if (closed) return;
  q.deleteRoom.run(code);
}

function loadRooms() {
  const result = [];
  for (const row of q.allRooms.all()) {
    try {
      result.push({ code: row.code, state: JSON.parse(row.state), updatedAt: row.updated_at });
    } catch (err) {
      console.error(`[DB] Snapshot room ${row.code} rusak, dilewati:`, err.message);
      q.deleteRoom.run(row.code);
    }
  }
  return result;
}

function close() {
  if (closed) return;
  closed = true;
  db.close();
}

module.exports = {
  DB_FILE,
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
  getUserItems,
  purchaseItem,
  consumeUserItem,
  saveRoom,
  deleteRoom,
  loadRooms,
  close
};
