// Entry point server JakLudo: menyambungkan HTTP, Socket.IO, dan state permainan.
//   server/http/routes.js     REST API
//   server/realtime/socket.js event Socket.IO
//   server/game/              state room, engine permainan, aturan, inventaris item
//   server/items/             definisi item toko (tambah item baru di sini)
//   server/db.js              database SQLite
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const db = require('./db');
const store = require('./game/store');
const engine = require('./game/engine');
const { createApiRouter } = require('./http/routes');
const { registerSocketHandlers } = require('./realtime/socket');

const app = express();
// Set TRUST_PROXY=1 jika server berada di belakang Nginx / Cloudflare Tunnel agar req.ip memakai IP asli
if (process.env.TRUST_PROXY && process.env.TRUST_PROXY !== '0') {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}
// Klien dilayani dari origin yang sama (Vite dev memakai proxy). CORS hanya dibuka bila diminta.
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : null;
if (corsOrigin) app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10kb' }));

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 16 * 1024,
  // Lebih toleran terhadap jeda jaringan HP / tunnel: koneksi baru dianggap putus
  // setelah tidak ada balasan ping selama pingInterval + pingTimeout (25 + 30 detik).
  pingInterval: 25000,
  pingTimeout: 30000,
  ...(corsOrigin ? { cors: { origin: corsOrigin } } : {})
});

store.init(io);
registerSocketHandlers(io);

app.get('/health', (_, res) => res.json({ ok: true, rooms: store.rooms.size }));
app.use('/api', createApiRouter());

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, error: 'Permintaan tidak valid.' });
  }
  console.error('[http]', err);
  res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server.' });
});

const dist = path.join(__dirname, '../dist');
app.use(express.static(dist));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));

// ==========================================
// PROSES: simpan room saat berhenti, jangan mati karena satu error
// ==========================================

process.on('uncaughtException', err => {
  console.error('[uncaughtException]', err);
  store.flushRooms();
});
process.on('unhandledRejection', err => {
  console.error('[unhandledRejection]', err);
});
// Simpan snapshot semua room lalu tutup database. Room dipulihkan saat server start lagi.
function shutdown() {
  store.stopAllTimers();
  store.flushRooms();
  db.close();
}

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    shutdown();
    process.exit(0);
  });
}

store.restoreRooms({ onResume: engine.triggerTurn });

const PORT = process.env.PORT || 5172;
if (require.main === module) {
  server.listen(PORT, () => console.log(`JakLudo server listening on ${server.address().port}`));
}

module.exports = { server, io, rooms: store.rooms, shutdown };
