// Unit & integration test mekanisme migrasi PostgreSQL (skema SQL, migrasi dari SQLite, dan sinkronisasi Pool)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  parseDatabaseUrl,
  getPoolConfig,
  listMigrationFiles,
  runSchemaMigrations,
  readSqliteDatabase,
  migrateSqliteToPostgres
} = require('./migrate');

test('getPoolConfig dan parseDatabaseUrl aman terhadap karakter spesial di password (@, #, !, :, /)', () => {
  const { Pool } = require('pg');

  // Password dengan @, #, !, :, ? di dalam DATABASE_URL
  const cfgFromUrl = getPoolConfig({
    DATABASE_URL: 'postgresql://jakludo:P@ss#w0rd!123:456@postgres:5432/jakludo'
  });
  assert.equal(cfgFromUrl.host, 'postgres');
  assert.equal(cfgFromUrl.port, 5432);
  assert.equal(cfgFromUrl.user, 'jakludo');
  assert.equal(cfgFromUrl.password, 'P@ss#w0rd!123:456');
  assert.equal(cfgFromUrl.database, 'jakludo');
  assert.equal(cfgFromUrl.connectionString, undefined);

  // Pastikan pg.Pool tidak melempar ERR_INVALID_URL
  const pool = new Pool(cfgFromUrl);
  pool.end();

  // Variabel PGHOST di Docker Compose diprioritaskan di atas DATABASE_URL
  const cfgDocker = getPoolConfig({
    PGHOST: 'postgres',
    PGPORT: '5432',
    POSTGRES_USER: 'jakludo',
    POSTGRES_PASSWORD: 'My#Super@Secret!Password',
    POSTGRES_DB: 'jakludo',
    DATABASE_URL: 'postgresql://jakludo:My#Super@Secret!Password@127.0.0.1:5433/jakludo'
  });
  assert.equal(cfgDocker.host, 'postgres');
  assert.equal(cfgDocker.password, 'My#Super@Secret!Password');
  assert.equal(cfgDocker.connectionString, undefined);
});

// Mock pg.Pool in-memory untuk menguji alur migrasi & transaksi SQL tanpa bergantung pada daemon Postgres eksternal
function createMockPgPool() {
  const queries = [];
  const appliedVersions = new Set();
  const tables = {
    users: new Map(),
    user_items: new Map(),
    sessions: new Map(),
    leaderboard: new Map(),
    rooms: new Map()
  };

  async function executeQuery(sql, params = []) {
    const clean = sql.trim();
    queries.push({ sql: clean, params });

    if (/^SELECT\s+version\s+FROM\s+schema_migrations/i.test(clean)) {
      return { rows: Array.from(appliedVersions).sort((a, b) => a - b).map(v => ({ version: v })) };
    }
    if (/^INSERT\s+INTO\s+schema_migrations/i.test(clean)) {
      appliedVersions.add(Number(params[0]));
      return { rowCount: 1, rows: [] };
    }
    if (/^INSERT\s+INTO\s+users/i.test(clean)) {
      const [id, username, name, password_hash, auth_type, avatar, email, created_at] = params;
      tables.users.set(id, {
        id,
        username,
        name,
        password_hash,
        auth_type: params.length === 5 ? 'password' : auth_type,
        avatar: params.length === 5 ? '🎯' : avatar,
        email: params.length === 5 ? null : email,
        created_at: params.length === 5 ? params[4] : created_at
      });
      return { rowCount: 1, rows: [] };
    }
    if (/^SELECT\s+1\s+FROM\s+users\s+WHERE\s+id\s*=\s*\$1/i.test(clean)) {
      const exists = tables.users.has(params[0]);
      return { rowCount: exists ? 1 : 0, rows: exists ? [{ '?column?': 1 }] : [] };
    }
    if (/^INSERT\s+INTO\s+user_items/i.test(clean)) {
      const userId = params[0];
      const itemId = params.length === 2 ? (clean.includes("'blackholeShield'") ? 'blackholeShield' : 'forceReturn') : params[1];
      const qty = params.length === 2 ? Number(params[1]) : Number(params[2]);
      tables.user_items.set(`${userId}:${itemId}`, { user_id: userId, item_id: itemId, quantity: qty });
      return { rowCount: 1, rows: [] };
    }
    if (/^INSERT\s+INTO\s+sessions/i.test(clean)) {
      const [token_hash, user_id, created_at, expires_at] = params;
      tables.sessions.set(token_hash, { token_hash, user_id, created_at, expires_at });
      return { rowCount: 1, rows: [] };
    }
    if (/^INSERT\s+INTO\s+leaderboard/i.test(clean)) {
      const [user_id, username, name, avatar, wins, matches_played, points, auth_type] = params;
      tables.leaderboard.set(user_id, {
        user_id,
        username,
        name,
        avatar,
        wins: Number(wins || 0),
        matches_played: Number(matches_played || 0),
        points: Number(points || 0),
        auth_type: auth_type || 'password'
      });
      return { rowCount: 1, rows: [] };
    }
    if (/^INSERT\s+INTO\s+rooms/i.test(clean)) {
      const [code, state, updated_at] = params;
      tables.rooms.set(code, { code, state: JSON.parse(state), updated_at });
      return { rowCount: 1, rows: [] };
    }
    if (/^SELECT\s+\*\s+FROM\s+users/i.test(clean)) {
      return { rows: Array.from(tables.users.values()) };
    }
    if (/^SELECT\s+user_id,\s*item_id,\s*quantity\s+FROM\s+user_items/i.test(clean)) {
      return { rows: Array.from(tables.user_items.values()) };
    }
    if (/^SELECT\s+token_hash,\s*user_id,\s*created_at,\s*expires_at\s+FROM\s+sessions/i.test(clean)) {
      return { rows: Array.from(tables.sessions.values()) };
    }
    if (/^SELECT\s+\*\s+FROM\s+leaderboard/i.test(clean)) {
      return { rows: Array.from(tables.leaderboard.values()) };
    }
    if (/^SELECT\s+code,\s*state,\s*updated_at\s+FROM\s+rooms/i.test(clean)) {
      return { rows: Array.from(tables.rooms.values()) };
    }
    return { rowCount: 1, rows: [] };
  }

  return {
    queries,
    tables,
    appliedVersions,
    on() {},
    query: executeQuery,
    async connect() {
      return {
        query: executeQuery,
        release() {}
      };
    },
    async end() {}
  };
}

test('runSchemaMigrations menerapkan file SQL secara idempoten dengan advisory lock', async () => {
  const files = listMigrationFiles();
  assert.ok(files.length >= 1, 'minimal ada 001_initial_schema.sql');
  assert.equal(files[0].version, 1);

  const mockPool = createMockPgPool();
  const firstRun = await runSchemaMigrations(mockPool);
  assert.deepEqual(firstRun, files.map(f => f.name));
  assert.ok(mockPool.queries.some(q => q.sql.includes('pg_advisory_xact_lock')));

  // Jalankan kedua kali: tidak ada migrasi yang dijalankan ulang
  const secondRun = await runSchemaMigrations(mockPool);
  assert.deepEqual(secondRun, []);
});

test('migrateSqliteToPostgres memindahkan seluruh tabel dari jakludo.db ke PostgreSQL dan mengganti nama file lama', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jakludo-pg-mig-'));
  const sqliteFile = path.join(tmpDir, 'jakludo.db');
  const futureExp = Date.now() + 3600_000;

  const initSql = `
    CREATE TABLE users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL, name TEXT NOT NULL,
      password_hash TEXT, auth_type TEXT NOT NULL, avatar TEXT, email TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE user_items (
      user_id TEXT NOT NULL, item_id TEXT NOT NULL, quantity INTEGER NOT NULL, PRIMARY KEY (user_id, item_id)
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE leaderboard (
      user_id TEXT PRIMARY KEY, username TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT,
      wins INTEGER NOT NULL, matches_played INTEGER NOT NULL, points INTEGER NOT NULL, auth_type TEXT NOT NULL
    );
    CREATE TABLE rooms (
      code TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL
    );
    INSERT INTO users VALUES ('u_1', 'joko', 'Joko', 'scrypt:a:b', 'password', '🎯', NULL, '2026-01-01T00:00:00Z');
    INSERT INTO user_items VALUES ('u_1', 'forceReturn', 3);
    INSERT INTO sessions VALUES ('hash_abc', 'u_1', 1000, ${futureExp});
    INSERT INTO leaderboard VALUES ('u_1', 'joko', 'Joko', '🎯', 7, 10, 320, 'password');
    INSERT INTO rooms VALUES ('RM999', '{"code":"RM999","started":true,"players":[]}', 2000);
  `;

  const created = spawnSync('sqlite3', [sqliteFile, initSql], { encoding: 'utf8' });
  assert.equal(created.status, 0, created.stderr);

  const sqData = readSqliteDatabase(sqliteFile);
  assert.equal(sqData.users.length, 1);
  assert.equal(sqData.user_items.length, 1);
  assert.equal(sqData.leaderboard[0].points, 320);

  const mockPool = createMockPgPool();
  const res = await migrateSqliteToPostgres(mockPool, { sqliteFile, renameAfter: true });

  assert.equal(res.migrated, true);
  assert.deepEqual(res.counts, {
    users: 1,
    userItems: 1,
    sessions: 1,
    leaderboard: 1,
    rooms: 1
  });
  assert.equal(mockPool.tables.users.get('u_1').username, 'joko');
  assert.equal(mockPool.tables.user_items.get('u_1:forceReturn').quantity, 3);
  assert.equal(mockPool.tables.leaderboard.get('u_1').wins, 7);
  assert.equal(mockPool.tables.rooms.get('RM999').state.code, 'RM999');
  assert.equal(fs.existsSync(sqliteFile), false, 'file jakludo.db lama sudah di-rename');
  assert.ok(fs.readdirSync(tmpDir).some(f => f.startsWith('jakludo.db.migrated-')));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

