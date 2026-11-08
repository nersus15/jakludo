// Backup database SQLite tanpa menghentikan server: node server/backup.js [file-tujuan]
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.JAKLUDO_DATA_DIR || path.join(__dirname, 'data');
const source = path.join(DATA_DIR, 'jakludo.db');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.resolve(process.argv[2] || path.join(DATA_DIR, 'backups', `jakludo-${stamp}.db`));

if (!fs.existsSync(source)) {
  console.error(`Database tidak ditemukan: ${source}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
if (fs.existsSync(target)) {
  console.error(`File tujuan sudah ada: ${target}`);
  process.exit(1);
}

const db = new DatabaseSync(source, { readOnly: true });
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();
console.log(`Backup tersimpan: ${target}`);
