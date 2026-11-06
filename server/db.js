const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

// Pastikan direktori data ada
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, defaultVal) {
  try {
    if (!fs.existsSync(file)) return defaultVal;
    const content = fs.readFileSync(file, 'utf8').trim();
    if (!content) return defaultVal;
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultVal;
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[DB WARNING] Gagal menulis ke ${file} (${err.code || err.message}). Pastikan folder server/data memiliki izin write (chmod 777 server/data).`);
  }
}

// Inisialisasi awal Leaderboard data jika kosong
function initData() {
  const users = readJson(USERS_FILE, []);
  const leaderboard = readJson(LEADERBOARD_FILE, []);

  if (leaderboard.length === 0) {
    // Seed default leaderboard players untuk visual awal yang menarik
    const seedPlayers = [
      {
        userId: 'seed-1',
        username: 'ludo_emperor',
        name: 'Sultan JakLudo',
        avatar: '👑',
        wins: 18,
        matchesPlayed: 24,
        points: 570, // 18*25 + 24*5
        authType: 'seed'
      },
      {
        userId: 'seed-2',
        username: 'queen_dice',
        name: 'Ratu Dadu',
        avatar: '🎲',
        wins: 14,
        matchesPlayed: 20,
        points: 450,
        authType: 'seed'
      },
      {
        userId: 'seed-3',
        username: 'lucky_roller',
        name: 'Si Hoki 6',
        avatar: '🔥',
        wins: 11,
        matchesPlayed: 18,
        points: 365,
        authType: 'seed'
      },
      {
        userId: 'seed-4',
        username: 'master_stride',
        name: 'Langkah Sakti',
        avatar: '⚡',
        wins: 8,
        matchesPlayed: 15,
        points: 275,
        authType: 'seed'
      }
    ];
    writeJson(LEADERBOARD_FILE, seedPlayers);
  }
}

initData();

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

// Scrypt standard NIST/OWASP password hashing
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  try {
    const [algorithm, salt, originalKeyHex] = storedHash.split(':');
    if (algorithm !== 'scrypt' || !salt || !originalKeyHex) return false;

    const derivedKey = crypto.scryptSync(password, salt, 64);
    const originalKey = Buffer.from(originalKeyHex, 'hex');
    return crypto.timingSafeEqual(derivedKey, originalKey);
  } catch (err) {
    console.error('Password verify error:', err);
    return false;
  }
}

// ==========================================
// MANAJEMEN USER & SSO
// ==========================================

let inMemoryUsers = null;

function getAllUsers() {
  if (inMemoryUsers !== null) {
    return inMemoryUsers;
  }
  inMemoryUsers = readJson(USERS_FILE, []);
  return inMemoryUsers;
}

function findUserByUsername(username) {
  const users = getAllUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

function findUserById(id) {
  const users = getAllUsers();
  return users.find(u => u.id === id);
}

function findUserByGoogleId(googleId) {
  const users = getAllUsers();
  return users.find(u => u.googleId === googleId);
}

// Buat akun baru dengan Username & Password
function registerUser({ username, password, name }) {
  const userValid = validateUsername(username);
  if (!userValid.valid) return { error: userValid.message };

  const passValid = validatePassword(password);
  if (!passValid.valid) return { error: passValid.message };

  const existing = findUserByUsername(userValid.cleanUsername);
  if (existing) {
    return { error: 'Username sudah digunakan, silakan pilih username lain.' };
  }

  const users = getAllUsers();
  const newUser = {
    id: 'user_' + crypto.randomUUID(),
    username: userValid.cleanUsername,
    name: (name && name.trim()) || userValid.cleanUsername,
    passwordHash: hashPassword(password),
    authType: 'password',
    avatar: '🎯',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  inMemoryUsers = users;
  writeJson(USERS_FILE, users);

  // Buat sesi login otomatis
  const token = createSession(newUser.id);

  // Pastikan ada entry di leaderboard
  ensureLeaderboardEntry(newUser);

  return {
    user: sanitizeUser(newUser),
    token
  };
}

// Login dengan Username & Password
function loginUser({ username, password }) {
  if (!username || !password) {
    return { error: 'Username dan password wajib diisi.' };
  }

  const user = findUserByUsername(username.trim());
  if (!user || !user.passwordHash) {
    return { error: 'Username atau password salah.' };
  }

  const isValid = verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { error: 'Username atau password salah.' };
  }

  const token = createSession(user.id);
  return {
    user: sanitizeUser(user),
    token
  };
}

// Login / Register menggunakan Google SSO
function loginWithGoogle({ googleId, email, name, picture, chosenUsername }) {
  if (!googleId || !email) {
    return { error: 'Data Google SSO tidak valid.' };
  }

  const users = getAllUsers();
  let user = findUserByGoogleId(googleId);

  if (user) {
    // User Google sudah pernah terdaftar
    const token = createSession(user.id);
    return { user: sanitizeUser(user), token };
  }

  // Jika user Google baru, harus ada unique username
  let targetUsername = chosenUsername;
  if (!targetUsername) {
    // Generate default username dari email prefix
    const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15);
    targetUsername = prefix || 'player';
  }

  const userValid = validateUsername(targetUsername);
  if (!userValid.valid) {
    // Jika format default kurang valid, tambahkan random suffix
    targetUsername = 'joy_' + Math.floor(1000 + Math.random() * 9000);
  } else {
    targetUsername = userValid.cleanUsername;
  }

  // Cek apakah username unik, jika bentrok tambahkan angka
  let uniqueUsername = targetUsername;
  let counter = 1;
  while (findUserByUsername(uniqueUsername)) {
    uniqueUsername = `${targetUsername}${counter}`;
    counter++;
  }

  const newUser = {
    id: 'user_goog_' + crypto.randomUUID(),
    googleId,
    email,
    username: uniqueUsername,
    name: name || uniqueUsername,
    avatar: picture || '🎲',
    authType: 'google',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeJson(USERS_FILE, users);

  ensureLeaderboardEntry(newUser);
  const token = createSession(newUser.id);

  return {
    user: sanitizeUser(newUser),
    token,
    isNewUser: true
  };
}

function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    email: u.email,
    authType: u.authType
  };
}

// ==========================================
// SESSION MANAGEMENT (TOKEN)
// ==========================================

let inMemorySessions = null;

function getSessions() {
  if (inMemorySessions !== null) {
    return inMemorySessions;
  }
  inMemorySessions = readJson(SESSIONS_FILE, {});
  return inMemorySessions;
}

function createSession(userId) {
  const sessions = getSessions();
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 hari
  };
  inMemorySessions = sessions;
  writeJson(SESSIONS_FILE, sessions);
  return token;
}

function getUserByToken(token) {
  if (!token) return null;
  const sessions = getSessions();
  const session = sessions[token];
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    delete sessions[token];
    inMemorySessions = sessions;
    writeJson(SESSIONS_FILE, sessions);
    return null;
  }

  return findUserById(session.userId);
}

// ==========================================
// LEADERBOARD & LUDO KING
// ==========================================

function ensureLeaderboardEntry(user) {
  const board = readJson(LEADERBOARD_FILE, []);
  const existing = board.find(b => b.userId === user.id || b.username.toLowerCase() === user.username.toLowerCase());
  if (!existing) {
    board.push({
      userId: user.id,
      username: user.username,
      name: user.name,
      avatar: user.avatar || '🎲',
      wins: 0,
      matchesPlayed: 0,
      points: 0,
      authType: user.authType
    });
    writeJson(LEADERBOARD_FILE, board);
  }
}

// Catat hasil pertandingan selesai
function recordMatchResult({ winnerPlayerId, winnerUsername, players }) {
  if (!players || players.length === 0) return;

  const board = readJson(LEADERBOARD_FILE, []);

  players.forEach(p => {
    // Cari entry pemain berdasarkan userId atau username
    const pId = p.userId || p.id;
    const pUsername = p.username || p.name;
    let entry = board.find(b => (p.userId && b.userId === p.userId) || b.username.toLowerCase() === pUsername.toLowerCase());

    if (!entry) {
      entry = {
        userId: pId,
        username: pUsername,
        name: p.name,
        avatar: p.isBot ? '🤖' : (p.avatar || '🎲'),
        wins: 0,
        matchesPlayed: 0,
        points: 0,
        authType: p.isBot ? 'bot' : 'player'
      };
      board.push(entry);
    }

    const isWinner = (winnerPlayerId && p.id === winnerPlayerId) || (winnerUsername && p.username === winnerUsername);
    entry.matchesPlayed = (entry.matchesPlayed || 0) + 1;
    if (isWinner) {
      entry.wins = (entry.wins || 0) + 1;
      entry.points = (entry.points || 0) + 25; // 25 Poin per Kemenangan
    } else {
      entry.points = (entry.points || 0) + 5; // 5 Poin Partisipasi
    }
  });

  writeJson(LEADERBOARD_FILE, board);
  return getLeaderboard();
}

// Ambil ranking leaderboard terurut & tentukan LUDO KING (#1)
function getLeaderboard() {
  const board = readJson(LEADERBOARD_FILE, []);

  // Urutkan: Paling banyak Kemenangan (wins) -> Paling banyak Points -> Win Rate
  const sorted = [...board].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.points !== a.points) return b.points - a.points;
    const aRate = a.matchesPlayed > 0 ? a.wins / a.matchesPlayed : 0;
    const bRate = b.matchesPlayed > 0 ? b.wins / b.matchesPlayed : 0;
    return bRate - aRate;
  });

  // Tandai rank dan identifikasi Sang LUDO KING (#1)
  const ranked = sorted.map((player, index) => {
    const rank = index + 1;
    const winRate = player.matchesPlayed > 0
      ? Math.round((player.wins / player.matchesPlayed) * 100)
      : 0;
    const isLudoKing = rank === 1 && player.wins > 0;

    return {
      ...player,
      rank,
      winRate,
      isLudoKing
    };
  });

  return ranked;
}

// Cek apakah username tertentu adalah Ludo King saat ini
function checkIsLudoKing(username) {
  if (!username) return false;
  const board = getLeaderboard();
  const king = board[0];
  return king && king.isLudoKing && king.username.toLowerCase() === username.toLowerCase();
}

module.exports = {
  validateUsername,
  validatePassword,
  hashPassword,
  verifyPassword,
  registerUser,
  loginUser,
  loginWithGoogle,
  getUserByToken,
  recordMatchResult,
  getLeaderboard,
  checkIsLudoKing,
  sanitizeUser
};

