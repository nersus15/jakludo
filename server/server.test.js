// Integration test lewat socket sungguhan. Data disimpan di folder sementara.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jakludo-test-'));
process.env.JAKLUDO_DATA_DIR = dataDir;

const { io: ioClient } = require('socket.io-client');
const { server, rooms } = require('./index');
const db = require('./db');

let url;
const clients = [];

test.before(async () => {
  await new Promise(resolve => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

test.after(async () => {
  clients.forEach(c => c.close());
  await new Promise(resolve => server.close(resolve));
  db.flushNow();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function connect() {
  const c = ioClient(url, { forceNew: true, transports: ['websocket'] });
  clients.push(c);
  return new Promise(resolve => c.on('connect', () => resolve(c)));
}

function once(c, event) {
  return new Promise(resolve => c.once(event, resolve));
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function register(username) {
  const res = await fetch(`${url}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'Rahasia#123', name: username })
  });
  return res.json();
}

async function createRoomWith(names) {
  const sockets = [];
  const host = await connect();
  host.emit('room:create', { name: names[0] });
  const joined = await once(host, 'room:joined');
  sockets.push({ socket: host, ...joined });
  for (const name of names.slice(1)) {
    const c = await connect();
    c.emit('room:join', { code: joined.code, name });
    sockets.push({ socket: c, ...(await once(c, 'room:joined')) });
  }
  return { code: joined.code, sockets, room: rooms.get(joined.code) };
}

test('payload kosong / rusak tidak menjatuhkan server', async () => {
  const c = await connect();
  for (const ev of ['game:move', 'room:update_settings', 'game:use_skill', 'game:use_force_return', 'game:reaction', 'room:chat', 'room:join', 'room:leave']) {
    c.emit(ev);
    c.emit(ev, null);
    c.emit(ev, 'string');
  }
  c.emit('room:check_active');
  await wait(150);
  const res = await fetch(`${url}/health`);
  assert.equal(res.status, 200);
});

test('menyerah saat giliran sendiri tidak crash dan giliran berpindah', async () => {
  const { sockets, room } = await createRoomWith(['A', 'B', 'C']);
  const [a] = sockets;
  a.socket.emit('game:start');
  await wait(100);
  assert.equal(room.started, true);
  assert.equal(room.turn, 0);
  a.socket.emit('room:leave', {});
  await wait(100);
  assert.equal(room.players[0].isOut, true);
  assert.equal(room.turn, 1);
});

test('warna tidak dobel setelah pemain keluar dari lobby', async () => {
  const { code, sockets, room } = await createRoomWith(['A', 'B', 'C']);
  sockets[1].socket.emit('room:leave', {});
  await wait(80);
  const d = await connect();
  d.emit('room:join', { code, name: 'D' });
  await once(d, 'room:joined');
  const colors = room.players.map(p => p.color);
  assert.equal(new Set(colors).size, colors.length, `warna dobel: ${colors}`);
});

test('pemain lain tidak bisa mengambil alih kursi dengan nama yang sama', async () => {
  const { code, sockets, room } = await createRoomWith(['Pemain', 'Pemain']);
  assert.equal(room.players.length, 2);
  assert.notEqual(sockets[0].playerId, sockets[1].playerId);

  // sessionId tidak boleh ikut disiarkan
  const update = await new Promise(resolve => {
    sockets[0].socket.once('room:update', resolve);
    sockets[0].socket.emit('room:add_bot');
  });
  assert.ok(update.players.every(p => p.sessionId === undefined));

  // Reconnect sah dengan sessionId rahasia mempertahankan kursi
  const again = await connect();
  again.emit('room:join', { code, sessionId: sockets[1].sessionId, name: 'x' });
  const rejoined = await once(again, 'room:joined');
  assert.equal(rejoined.reconnected, true);
  assert.equal(room.players.length, 3);
});

test('restart hanya setelah ada pemenang dan mereset state pemain', async () => {
  const { sockets, room } = await createRoomWith(['A', 'B']);
  const host = sockets[0].socket;
  host.emit('game:start');
  await wait(50);
  host.emit('game:restart');
  await wait(50);
  assert.equal(room.winner, null);

  room.players[0].stompCount = 5;
  room.players[0].skillPoints = 4;
  host.emit('game:start'); // start ulang di tengah game harus ditolak
  await wait(50);
  assert.equal(room.players[0].stompCount, 5);

  room.winner = room.players[1].id;
  host.emit('game:restart');
  await wait(80);
  assert.equal(room.winner, null);
  assert.equal(room.players[0].stompCount, 0);
  assert.equal(room.players[0].skillPoints, 0);
  assert.deepEqual(room.pawns[room.players[0].id], [0, 0, 0, 0]);
});

test('skill tidak bisa dipakai setelah dadu dilempar', async () => {
  const { sockets, room } = await createRoomWith(['A', 'B']);
  const a = sockets[0].socket;
  a.emit('game:start');
  await wait(50);
  room.pawns[room.players[0].id] = [44, 44, 44, 0];
  room.players[0].skillPoints = 1;
  room.pawns[room.players[1].id] = [5, 0, 0, 0];
  room.dice = 3;
  const err = once(a, 'room:error');
  a.emit('game:use_skill', { targetPlayerId: room.players[1].id, targetPawnIdx: 0 });
  assert.match(await err, /sebelum melempar dadu/);
  assert.equal(room.pawns[room.players[1].id][0], 5);
  assert.equal(room.dice, 3);
});

test('chat dikirim sebagai event terpisah dan dibatasi kecepatannya', async () => {
  const { sockets } = await createRoomWith(['A', 'B']);
  const received = [];
  sockets[1].socket.on('room:chat_message', m => received.push(m.text));
  for (let i = 0; i < 8; i++) sockets[0].socket.emit('room:chat', { text: `halo ${i}` });
  await wait(150);
  assert.equal(received.length, 5);
});

test('menang melawan bot tidak memberi poin; hanya akun terdaftar yang dicatat', async () => {
  const u1 = await register('pemain_satu');
  const u2 = await register('pemain_dua');
  assert.equal(u1.success, true);
  const before = db.getLeaderboard().find(e => e.userId === u1.user.id).points;

  db.recordMatchResult({ winnerPlayerId: 'p1', players: [{ id: 'p1', userId: u1.user.id }, { id: 'bot', isBot: true }] });
  assert.equal(db.getLeaderboard().find(e => e.userId === u1.user.id).points, before);

  db.recordMatchResult({ winnerPlayerId: 'p1', players: [{ id: 'p1', userId: u1.user.id }, { id: 'p2', userId: u2.user.id }, { id: 'g', name: 'tamu' }] });
  const board = db.getLeaderboard();
  assert.equal(board.find(e => e.userId === u1.user.id).points, before + 25);
  assert.ok(!board.some(e => e.username === 'tamu'));
});

test('logout menghapus sesi dan login dibatasi', async () => {
  const u = await register('pemain_tiga');
  const me = () => fetch(`${url}/api/auth/me`, { headers: { Authorization: `Bearer ${u.token}` } });
  assert.equal((await me()).status, 200);
  await fetch(`${url}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${u.token}` } });
  assert.equal((await me()).status, 401);

  let last;
  for (let i = 0; i < 11; i++) {
    last = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'pemain_tiga', password: 'salah' })
    });
  }
  assert.equal(last.status, 429);
});

test('endpoint /api yang tidak ada mengembalikan 404 JSON', async () => {
  const res = await fetch(`${url}/api/tidak-ada`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).success, false);
});

test('file data rusak tidak diperlakukan sebagai kosong', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jakludo-corrupt-'));
  fs.writeFileSync(path.join(dir, 'users.json'), '[{"id": "u1", ');
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, ['-e', "require('./server/db')"], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, JAKLUDO_DATA_DIR: dir },
    encoding: 'utf8'
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /DB FATAL/);
  assert.equal(fs.readFileSync(path.join(dir, 'users.json'), 'utf8'), '[{"id": "u1", ');
  assert.ok(fs.readdirSync(dir).some(f => f.startsWith('users.json.corrupt-')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('memakan bidak lawan di petak Black Hole tetap memberi bonus giliran', async () => {
  const { sockets, room } = await createRoomWith(['A', 'B']);
  const a = sockets[0].socket;
  a.emit('room:update_settings', { blackHole: true });
  await wait(30);
  a.emit('game:start');
  await wait(80);
  clearTimeout(room.turnTimer);
  const [pa, pb] = room.players;
  // Merah val 2 + 3 = val 5 -> track 4 (Black Hole). Hijau val 35 -> track (10 + 34) % 40 = 4.
  room.pawns[pa.id] = [2, 0, 0, 0];
  room.pawns[pb.id] = [35, 0, 0, 0];
  room.dice = 3;
  a.emit('game:move', { pawn: 0 });
  await wait(3 * 220 + 600);
  assert.equal(room.pawns[pb.id][0], 0, 'bidak lawan harus kembali ke markas');
  assert.equal(room.turn, 0, 'pemain yang memakan harus mendapat giliran lagi');
  assert.equal(room.dice, null);
});

test('koneksi putus di lobby tidak langsung menghapus kursi', async () => {
  const { code, sockets, room } = await createRoomWith(['A', 'B']);
  const colorB = room.players[1].color;
  sockets[1].socket.disconnect();
  await wait(80);
  assert.equal(room.players.length, 2);
  assert.equal(room.players[1].connected, false);

  const again = await connect();
  again.emit('room:join', { code, sessionId: sockets[1].sessionId, name: 'B' });
  const rejoined = await once(again, 'room:joined');
  assert.equal(rejoined.reconnected, true);
  assert.equal(room.players[1].connected, true);
  assert.equal(room.players[1].color, colorB);
});

test('pemain yang terputus di tengah giliran tidak langsung dimainkan sistem', async () => {
  const { code, sockets, room } = await createRoomWith(['A', 'B']);
  sockets[0].socket.emit('game:start');
  await wait(80);
  sockets[0].socket.disconnect(); // giliran A, lalu sinyal putus
  await wait(2500);
  assert.equal(room.players[0].autoPlayCount, 0, 'auto-play tidak boleh langsung mengambil giliran');
  assert.equal(room.dice, null);

  const again = await connect();
  again.emit('room:join', { code, sessionId: sockets[0].sessionId, name: 'A' });
  await once(again, 'room:joined');
  again.emit('game:roll');
  await wait(900);
  assert.notEqual(room.dice, null, 'pemain bisa melempar dadu sendiri setelah tersambung ulang');
  assert.equal(room.players[0].autoPlayCount, 0);
});
