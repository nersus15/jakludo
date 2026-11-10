// Backup database PostgreSQL tanpa menghentikan server: node server/backup.js [file-tujuan]
// Menggunakan pg_dump jika tersedia di sistem, atau mengekspor seluruh tabel ke format JSON terstruktur.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');
const { getPoolConfig } = require('./migrate');

const DATA_DIR = process.env.JAKLUDO_DATA_DIR || path.join(__dirname, 'data');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

async function main() {
  const poolConfig = getPoolConfig();
  if (!poolConfig) {
    console.error('[BACKUP] Error: DATABASE_URL belum dikonfigurasi di .env atau environment.');
    process.exit(1);
  }

  const defaultExt = 'sql';
  const target = path.resolve(
    process.argv[2] || path.join(DATA_DIR, 'backups', `jakludo-pg-${stamp}.${defaultExt}`)
  );

  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    console.error(`File tujuan sudah ada: ${target}`);
    process.exit(1);
  }

  // Gunakan pg_dump dengan parameter terpisah (aman untuk karakter spesial pada password)
  if (target.endsWith('.sql') && poolConfig.host) {
    const dump = spawnSync(
      'pg_dump',
      [
        '--no-owner',
        '--no-privileges',
        '--clean',
        '--if-exists',
        '-h', String(poolConfig.host),
        '-p', String(poolConfig.port || 5432),
        '-U', String(poolConfig.user || 'jakludo'),
        '-d', String(poolConfig.database || 'jakludo'),
        '-f', target
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, PGPASSWORD: String(poolConfig.password || '') }
      }
    );
    if (!dump.error && dump.status === 0) {
      console.log(`Backup PostgreSQL (pg_dump) tersimpan: ${target}`);
      return;
    }
    console.warn('[BACKUP] pg_dump tidak tersedia atau gagal, beralih ke ekspor langsung via koneksi Node...');
  }

  const jsonTarget = target.endsWith('.sql') ? target.replace(/\.sql$/, '.json') : target;
  const pool = new Pool(poolConfig);
  try {
    const [users, userItems, sessions, leaderboard, rooms] = await Promise.all([
      pool.query('SELECT * FROM users'),
      pool.query('SELECT * FROM user_items'),
      pool.query('SELECT * FROM sessions'),
      pool.query('SELECT * FROM leaderboard'),
      pool.query('SELECT * FROM rooms')
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      users: users.rows,
      user_items: userItems.rows,
      sessions: sessions.rows,
      leaderboard: leaderboard.rows,
      rooms: rooms.rows
    };
    fs.writeFileSync(jsonTarget, JSON.stringify(payload, null, 2));
    console.log(`Backup PostgreSQL (JSON) tersimpan: ${jsonTarget}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[BACKUP] Gagal:', err.message);
  process.exit(1);
});
