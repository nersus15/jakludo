// Mekanisme migrasi database PostgreSQL untuk JakLudo:
// 1. Menjalankan migrasi skema SQL berurutan (server/migrations/*.sql) dengan advisory lock
// 2. Memigrasikan data lama dari SQLite (jakludo.db) dan/atau JSON lama ke PostgreSQL secara idempoten
//
// Penggunaan CLI:
//   node server/migrate.js                           # jalankan migrasi skema + impor jakludo.db jika ada
//   node server/migrate.js --from-sqlite <path.db>   # impor eksplisit dari file SQLite tertentu
//   node server/migrate.js --status                  # lihat status migrasi & jumlah baris di PostgreSQL

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const DEFAULT_DATA_DIR = process.env.JAKLUDO_DATA_DIR || path.join(__dirname, 'data');
// Kunci advisory lock khusus JakLudo agar migrasi paralel antar container aman
const MIGRATION_LOCK_ID = 74656231;

function loadDotEnv(force = false) {
  const envFile = path.join(__dirname, '../.env');
  if (!force && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envFile);
      return;
    } catch {
      // Lanjut ke parser manual
    }
  }
  try {
    if (!fs.existsSync(envFile)) return;
    const content = fs.readFileSync(envFile, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key) {
        // Jangan timpa variabel jika di file kosong namun process.env sudah diisi oleh Docker/environment
        if (val || process.env[key] === undefined) {
          if (force || process.env[key] === undefined || process.env[key] === '') {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {
    // Abaikan jika .env tidak ada
  }
}

// Parse URL PostgreSQL secara aman walaupun password mengandung karakter spesial (@, #, !, :, /, %)
// yang membuat `new URL()` bawaan pg-connection-string gagal dengan ERR_INVALID_URL.
function parseDatabaseUrl(rawUrl) {
  const clean = String(rawUrl || '').trim();
  const match = clean.match(/^postgres(?:ql)?:\/\/([^:]+):(.+)@([^@/:]+)(?::(\d+))?\/([^?#]+)(?:\?(.*))?$/i);
  if (!match) return null;
  const [, rawUser, rawPassword, host, portStr, rawDb] = match;
  const safeDecode = str => {
    try {
      return decodeURIComponent(str);
    } catch {
      return str;
    }
  };
  return {
    host,
    port: Number(portStr || 5432),
    user: safeDecode(rawUser),
    password: safeDecode(rawPassword),
    database: safeDecode(rawDb)
  };
}

function getPoolConfig(env = process.env) {
  loadDotEnv();
  const connectionString = String(env.DATABASE_URL || '').trim();
  const host = env.PGHOST || '';
  const database = env.PGDATABASE || env.POSTGRES_DB || '';
  const hasPgVars = Boolean(connectionString || host || env.PGUSER || env.POSTGRES_USER);
  if (!hasPgVars) return null;

  const sslMode = String(env.PGSSLMODE || '').toLowerCase();
  const ssl = sslMode === 'require' || sslMode === 'verify-full'
    ? { rejectUnauthorized: sslMode === 'verify-full' }
    : undefined;

  // Jika PGHOST diset (mis. di dalam Docker Compose), prioritaskan parameter terpisah
  // agar password dengan karakter spesial tidak pernah gagal di-parse sebagai URL.
  let connParams;
  if (host) {
    connParams = {
      host,
      port: Number(env.PGPORT || 5432),
      user: env.PGUSER || env.POSTGRES_USER || 'jakludo',
      password: env.PGPASSWORD ?? env.POSTGRES_PASSWORD ?? '',
      database: database || 'jakludo'
    };
  } else if (connectionString) {
    connParams = parseDatabaseUrl(connectionString) || { connectionString };
  } else {
    connParams = {
      host: '127.0.0.1',
      port: Number(env.PGPORT || env.POSTGRES_PORT || 5432),
      user: env.PGUSER || env.POSTGRES_USER || 'jakludo',
      password: env.PGPASSWORD ?? env.POSTGRES_PASSWORD ?? '',
      database: database || 'jakludo'
    };
  }

  return {
    ...connParams,
    max: Number(env.PGPOOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(ssl ? { ssl } : {})
  };
}

function listMigrationFiles(dir = MIGRATIONS_DIR) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter(f => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map(filename => {
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      return {
        version: Number(match[1]),
        name: filename,
        fullPath: path.join(dir, filename),
        sql: fs.readFileSync(path.join(dir, filename), 'utf8')
      };
    });
  // Versi migrasi wajib unik (schema_migrations.version adalah PRIMARY KEY). Gagal dengan pesan jelas
  // daripada membuat transaksi migrasi gagal di tengah atau melewatkan salah satu file secara diam-diam.
  const seen = new Map();
  for (const m of files) {
    if (seen.has(m.version)) {
      throw new Error(`[PG MIGRATE] Nomor versi migrasi ganda ${m.version}: ${seen.get(m.version)} dan ${m.name}`);
    }
    seen.set(m.version, m.name);
  }
  return files;
}

// Buat database otomatis jika belum ada di server PostgreSQL lokal (error code 3D000)
async function ensureDatabaseExists(poolConfig) {
  if (!poolConfig || !poolConfig.database || !/^[a-zA-Z0-9_-]+$/.test(poolConfig.database)) return;
  const testPool = new Pool({ ...poolConfig, max: 1 });
  try {
    const client = await testPool.connect();
    client.release();
  } catch (err) {
    if (err && err.code === '3D000') {
      const adminPool = new Pool({ ...poolConfig, database: 'postgres', max: 1 });
      try {
        await adminPool.query(`CREATE DATABASE "${poolConfig.database}"`);
        console.log(`[PG MIGRATE] Database "${poolConfig.database}" belum ada, berhasil dibuat otomatis.`);
      } finally {
        await adminPool.end().catch(() => {});
      }
    } else {
      throw err;
    }
  } finally {
    await testPool.end().catch(() => {});
  }
}

// Jalankan semua file migrasi SQL yang belum tercatat di tabel schema_migrations
async function runSchemaMigrations(pool) {
  const files = listMigrationFiles();
  const client = await pool.connect();
  const applied = [];

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
    const done = new Set(rows.map(r => Number(r.version)));

    for (const m of files) {
      if (done.has(m.version)) continue;
      await client.query(m.sql);
      await client.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [m.version, m.name]
      );
      applied.push(m.name);
    }

    await client.query('COMMIT');
    if (applied.length > 0) {
      console.log(`[PG MIGRATE] Berhasil menerapkan ${applied.length} migrasi skema: ${applied.join(', ')}`);
    }
    return applied;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Baca tabel dari file SQLite memakai node:sqlite (Node 22+) atau CLI sqlite3 -json (Node 20 / OS)
function readSqliteDatabase(sqliteFile) {
  if (!sqliteFile || !fs.existsSync(sqliteFile)) return null;

  // Cara 1: Coba built-in node:sqlite jika tersedia
  try {
    const { DatabaseSync } = require('node:sqlite');
    const sqlite = new DatabaseSync(sqliteFile, { readOnly: true });
    const hasTable = name => Boolean(
      sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)
    );
    const data = {
      users: hasTable('users') ? sqlite.prepare('SELECT * FROM users').all() : [],
      user_items: hasTable('user_items') ? sqlite.prepare('SELECT * FROM user_items').all() : [],
      sessions: hasTable('sessions') ? sqlite.prepare('SELECT * FROM sessions').all() : [],
      leaderboard: hasTable('leaderboard') ? sqlite.prepare('SELECT * FROM leaderboard').all() : [],
      rooms: hasTable('rooms') ? sqlite.prepare('SELECT * FROM rooms').all() : []
    };
    sqlite.close();
    return data;
  } catch (err) {
    if (err.code !== 'ERR_UNKNOWN_BUILTIN_MODULE') {
      console.warn('[PG MIGRATE] node:sqlite gagal membaca, mencoba sqlite3 CLI:', err.message);
    }
  }

  // Cara 2: Fallback ke binary sqlite3 -json
  const queryTable = table => {
    const check = spawnSync('sqlite3', ['-json', sqliteFile, `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`], {
      encoding: 'utf8'
    });
    if (check.error) {
      throw new Error(`Tidak dapat membaca ${sqliteFile}: node:sqlite tidak tersedia dan binary sqlite3 tidak ditemukan (${check.error.message})`);
    }
    if (check.status !== 0 || !check.stdout.trim()) return [];
    const res = spawnSync('sqlite3', ['-json', sqliteFile, `SELECT * FROM ${table};`], { encoding: 'utf8' });
    if (res.status !== 0 || !res.stdout.trim()) return [];
    return JSON.parse(res.stdout.trim());
  };

  return {
    users: queryTable('users'),
    user_items: queryTable('user_items'),
    sessions: queryTable('sessions'),
    leaderboard: queryTable('leaderboard'),
    rooms: queryTable('rooms')
  };
}

// Impor data dari SQLite (jakludo.db) ke PostgreSQL dalam satu transaksi idempoten
async function migrateSqliteToPostgres(pool, { sqliteFile, renameAfter = false } = {}) {
  const data = readSqliteDatabase(sqliteFile);
  if (!data) return { migrated: false, reason: 'no_sqlite_file' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID]);

    let usersCount = 0;
    let itemsCount = 0;
    let sessionsCount = 0;
    let leaderboardCount = 0;
    let roomsCount = 0;

    for (const u of data.users) {
      await client.query(
        `INSERT INTO users (id, username, name, password_hash, auth_type, avatar, email, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
           avatar = COALESCE(EXCLUDED.avatar, users.avatar),
           email = COALESCE(EXCLUDED.email, users.email)`,
        [
          u.id,
          u.username,
          u.name || u.username,
          u.password_hash || null,
          u.auth_type || 'password',
          u.avatar || null,
          u.email || null,
          u.created_at || new Date().toISOString()
        ]
      );
      usersCount++;

      // Kompatibilitas skema SQLite v1 yang masih memiliki kolom shield_count / force_return_count
      if (Number(u.shield_count) > 0) {
        await client.query(
          `INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, 'blackholeShield', $2)
           ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = GREATEST(user_items.quantity, EXCLUDED.quantity)`,
          [u.id, Number(u.shield_count)]
        );
      }
      if (Number(u.force_return_count) > 0) {
        await client.query(
          `INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, 'forceReturn', $2)
           ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = GREATEST(user_items.quantity, EXCLUDED.quantity)`,
          [u.id, Number(u.force_return_count)]
        );
      }
    }

    for (const item of data.user_items) {
      if (Number(item.quantity) <= 0) continue;
      // Pastikan user_id ada di tabel users sebelum insert FK
      const userExists = await client.query('SELECT 1 FROM users WHERE id = $1', [item.user_id]);
      if (userExists.rowCount === 0) continue;
      await client.query(
        `INSERT INTO user_items (user_id, item_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = GREATEST(user_items.quantity, EXCLUDED.quantity)`,
        [item.user_id, item.item_id, Number(item.quantity)]
      );
      itemsCount++;
    }

    const now = Date.now();
    for (const s of data.sessions) {
      if (Number(s.expires_at) <= now) continue;
      const userExists = await client.query('SELECT 1 FROM users WHERE id = $1', [s.user_id]);
      if (userExists.rowCount === 0) continue;
      await client.query(
        `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (token_hash) DO NOTHING`,
        [s.token_hash, s.user_id, Number(s.created_at || now), Number(s.expires_at)]
      );
      sessionsCount++;
    }

    for (const e of data.leaderboard) {
      await client.query(
        `INSERT INTO leaderboard (user_id, username, name, avatar, wins, matches_played, points, auth_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO UPDATE SET
           wins = GREATEST(leaderboard.wins, EXCLUDED.wins),
           matches_played = GREATEST(leaderboard.matches_played, EXCLUDED.matches_played),
           points = GREATEST(leaderboard.points, EXCLUDED.points),
           name = EXCLUDED.name,
           avatar = COALESCE(EXCLUDED.avatar, leaderboard.avatar)`,
        [
          e.user_id,
          e.username,
          e.name || e.username,
          e.avatar || null,
          Number(e.wins || 0),
          Number(e.matches_played || 0),
          Number(e.points || 0),
          e.auth_type || 'password'
        ]
      );
      leaderboardCount++;
    }

    for (const r of data.rooms) {
      let parsedState = r.state;
      if (typeof parsedState === 'string') {
        try {
          parsedState = JSON.parse(parsedState);
        } catch {
          continue;
        }
      }
      await client.query(
        `INSERT INTO rooms (code, state, updated_at)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (code) DO UPDATE SET
           state = CASE WHEN EXCLUDED.updated_at >= rooms.updated_at THEN EXCLUDED.state ELSE rooms.state END,
           updated_at = GREATEST(rooms.updated_at, EXCLUDED.updated_at)`,
        [r.code, JSON.stringify(parsedState), Number(r.updated_at || now)]
      );
      roomsCount++;
    }

    await client.query('COMMIT');

    if (renameAfter && fs.existsSync(sqliteFile)) {
      const stamp = Date.now();
      const backupPath = `${sqliteFile}.migrated-${stamp}`;
      fs.renameSync(sqliteFile, backupPath);
      for (const suffix of ['-wal', '-shm']) {
        if (fs.existsSync(sqliteFile + suffix)) {
          fs.renameSync(sqliteFile + suffix, `${backupPath}${suffix}`);
        }
      }
      console.log(`[PG MIGRATE] File SQLite lama dipindahkan ke ${backupPath}`);
    }

    console.log(
      `[PG MIGRATE] Data SQLite berhasil dimigrasikan ke PostgreSQL: ` +
      `${usersCount} user, ${itemsCount} stok item, ${sessionsCount} sesi, ${leaderboardCount} leaderboard, ${roomsCount} room.`
    );

    return {
      migrated: true,
      counts: { users: usersCount, userItems: itemsCount, sessions: sessionsCount, leaderboard: leaderboardCount, rooms: roomsCount }
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Impor dari file JSON generasi pertama (users.json, sessions.json, leaderboard.json) jika masih ada
async function migrateLegacyJsonToPostgres(pool, dataDir = DEFAULT_DATA_DIR) {
  const files = {
    users: path.join(dataDir, 'users.json'),
    sessions: path.join(dataDir, 'sessions.json'),
    leaderboard: path.join(dataDir, 'leaderboard.json')
  };
  if (!Object.values(files).some(f => fs.existsSync(f))) return { migrated: false };

  const load = (file, fallback) => {
    if (!fs.existsSync(file)) return fallback;
    const content = fs.readFileSync(file, 'utf8').trim();
    if (!content) return fallback;
    try {
      return JSON.parse(content);
    } catch (err) {
      throw new Error(`[DB FATAL] ${file} tidak valid (${err.message}). Perbaiki/pulihkan file ini agar data bisa dipindahkan ke PostgreSQL.`);
    }
  };

  const users = load(files.users, []);
  const sessions = load(files.sessions, {});
  const leaderboard = load(files.leaderboard, []);
  const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, username, name, password_hash, auth_type, avatar, email, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.username, u.name || u.username, u.passwordHash || null, u.authType || 'password', u.avatar || null, u.email || null, u.createdAt || new Date().toISOString()]
      );
      for (const [itemId, quantity] of Object.entries(u.inventory || {})) {
        if (quantity > 0) {
          await client.query(
            `INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, item_id) DO NOTHING`,
            [u.id, itemId, Number(quantity)]
          );
        }
      }
    }
    for (const [token, s] of Object.entries(sessions)) {
      if (s && s.expiresAt > Date.now()) {
        const exists = await client.query('SELECT 1 FROM users WHERE id = $1', [s.userId]);
        if (exists.rowCount > 0) {
          await client.query(
            `INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)
             ON CONFLICT (token_hash) DO NOTHING`,
            [hashToken(token), s.userId, Number(s.createdAt || Date.now()), Number(s.expiresAt)]
          );
        }
      }
    }
    for (const e of leaderboard) {
      if (!e.userId || !e.username) continue;
      await client.query(
        `INSERT INTO leaderboard (user_id, username, name, avatar, wins, matches_played, points, auth_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO NOTHING`,
        [e.userId, e.username, e.name || e.username, e.avatar || null, Number(e.wins || 0), Number(e.matchesPlayed || 0), Number(e.points || 0), e.authType || 'player']
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const stamp = Date.now();
  for (const file of Object.values(files)) {
    if (fs.existsSync(file)) fs.renameSync(file, `${file}.migrated-${stamp}`);
  }
  console.log(`[PG MIGRATE] Data JSON lama dipindahkan ke PostgreSQL: ${users.length} user, ${leaderboard.length} baris leaderboard.`);
  return { migrated: true };
}

async function getMigrationStatus(pool) {
  const migrations = await pool.query('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC').catch(() => ({ rows: [] }));
  const counts = {};
  for (const table of ['users', 'user_items', 'sessions', 'leaderboard', 'rooms']) {
    const res = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`).catch(() => ({ rows: [{ count: 0 }] }));
    counts[table] = res.rows[0].count;
  }
  return { appliedMigrations: migrations.rows, tableCounts: counts };
}

// Entrypoint CLI: `npm run db:migrate`
async function runCli() {
  const args = process.argv.slice(2);
  const poolConfig = getPoolConfig();
  if (!poolConfig) {
    console.error('[PG MIGRATE] Error: DATABASE_URL (atau PGHOST/PGDATABASE) belum dikonfigurasi di .env atau environment.');
    process.exit(1);
  }

  await ensureDatabaseExists(poolConfig);
  const pool = new Pool(poolConfig);
  try {
    await runSchemaMigrations(pool);

    if (args.includes('--status')) {
      const status = await getMigrationStatus(pool);
      console.log('[PG MIGRATE] Status migrasi skema:', status.appliedMigrations);
      console.log('[PG MIGRATE] Jumlah baris tabel:', status.tableCounts);
      return;
    }

    const fromIdx = args.indexOf('--from-sqlite');
    const customSqlite = fromIdx !== -1 && args[fromIdx + 1]
      ? path.resolve(args[fromIdx + 1])
      : path.join(DEFAULT_DATA_DIR, 'jakludo.db');

    const renameAfter = fromIdx === -1 && !args.includes('--keep-sqlite');
    await migrateLegacyJsonToPostgres(pool, DEFAULT_DATA_DIR);

    if (fs.existsSync(customSqlite)) {
      await migrateSqliteToPostgres(pool, { sqliteFile: customSqlite, renameAfter });
    } else if (fromIdx !== -1) {
      console.error(`[PG MIGRATE] File SQLite tidak ditemukan: ${customSqlite}`);
      process.exit(1);
    }

    const status = await getMigrationStatus(pool);
    console.log('[PG MIGRATE] Selesai. Ringkasan data di PostgreSQL:', status.tableCounts);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runCli().catch(err => {
    console.error('[PG MIGRATE] Gagal:', err);
    process.exit(1);
  });
}

module.exports = {
  loadDotEnv,
  parseDatabaseUrl,
  getPoolConfig,
  ensureDatabaseExists,
  listMigrationFiles,
  runSchemaMigrations,
  readSqliteDatabase,
  migrateSqliteToPostgres,
  migrateLegacyJsonToPostgres,
  getMigrationStatus
};

