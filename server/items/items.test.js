// Test fitur toko & item: registry, pembelian, Force Return, dan Blackhole Shield
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jakludo-items-'));
process.env.JAKLUDO_DATA_DIR = dataDir;

const { io: ioClient } = require('socket.io-client');
const { server, rooms, shutdown } = require('../index');
const db = require('../db');
const items = require('./index');

let url;
const clients = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const once = (c, event) => new Promise(resolve => c.once(event, resolve));

test.before(async () => {
  await new Promise(resolve => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

test.after(async () => {
  clients.forEach(c => c.close());
  shutdown();
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function connect() {
  const c = ioClient(url, { forceNew: true, transports: ['websocket'] });
  clients.push(c);
  return new Promise(resolve => c.on('connect', () => resolve(c)));
}

let userSeq = 0;
async function register() {
  const res = await fetch(`${url}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `pemain_item_${++userSeq}`, password: 'Rahasia#123' })
  });
  return res.json();
}

const buy = (token, itemId) => fetch(`${url}/api/shop/buy`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ itemId })
}).then(r => r.json());

// Room 2 pemain (A login, B tamu) yang sudah dimulai; giliran A
async function startedRoom({ blackHole = false } = {}) {
  const a = await register();
  const host = await connect();
  host.emit('room:create', { token: a.token });
  const { code } = await once(host, 'room:joined');
  const guest = await connect();
  guest.emit('room:join', { code, name: 'B' });
  await once(guest, 'room:joined');
  if (blackHole) host.emit('room:update_settings', { blackHole: true });
  await wait(30);
  host.emit('game:start');
  await wait(80);
  const room = rooms.get(code);
  clearTimeout(room.turnTimer);
  return { a, host, guest, room, pa: room.players[0], pb: room.players[1] };
}

test('setiap item di registry memenuhi kontrak dan tampil di katalog toko', async () => {
  const res = await fetch(`${url}/api/shop/items`).then(r => r.json());
  assert.deepEqual(res.items.map(i => i.id), items.list().map(i => i.id));
  for (const item of res.items) {
    assert.ok(item.name && item.icon && item.description && Number.isInteger(item.price));
    assert.ok(['active', 'passive', 'reactive'].includes(item.kind));
    assert.equal(typeof item.use, 'undefined', 'function tidak ikut dikirim ke klien');
  }
});

test('Force Return yang dibeli bisa langsung dipakai tanpa harus menginjak lawan', async () => {
  const { a, host, room, pa, pb } = await startedRoom();
  const bought = await buy(a.token, 'forceReturn');
  assert.equal(bought.success, true);
  assert.equal(pa.items.forceReturn.owned, 1, 'stok di room ikut tersinkron setelah membeli');

  room.pawns[pb.id] = [12, 0, 0, 0];
  host.emit('game:use_item', { itemId: 'forceReturn', target: { playerId: pb.id, pawnIdx: 0 } });
  await wait(100);
  assert.equal(room.pawns[pb.id][0], 0, 'bidak lawan pulang ke markas');
  assert.equal(pa.items.forceReturn.owned, 0);
  assert.equal(db.getUserItems(a.user.id).forceReturn || 0, 0, 'stok di database berkurang');
  assert.equal(room.lastItemEvent.itemId, 'forceReturn');
  assert.equal(room.turn, 0, 'giliran tetap milik pemain yang memakai item');
});

test('menginjak lawan dan memasukkan 3 bidak tidak lagi memberi Force Return gratis', async () => {
  const { room, pa, pb } = await startedRoom();
  for (let i = 0; i < 3; i++) {
    // Merah val 2 + dadu 3 -> track 4; hijau val 35 -> track (10 + 34) % 40 = 4
    room.pawns[pa.id] = [2, 44, 44, 44 - i];
    room.pawns[pb.id] = [35, 0, 0, 0];
    room.turn = 0;
    room.dice = 3;
    clearTimeout(room.turnTimer);
    require('../game/engine').handleMove(room, pa.id, 0);
    await wait(3 * 220 + 500);
    assert.equal(room.pawns[pb.id][0], 0);
  }
  assert.equal(pa.items.forceReturn?.earned || 0, 0);
  assert.equal(pa.skillPoints, undefined, 'skill eliminasi sudah dihapus');
});

test('item gratis dari pertandingan dipakai lebih dulu, item yang dibeli tetap tersimpan', async () => {
  const { a, host, room, pa, pb } = await startedRoom();
  await buy(a.token, 'forceReturn');
  pa.items.forceReturn.earned = 1;

  room.pawns[pb.id] = [12, 0, 0, 0];
  host.emit('game:use_item', { itemId: 'forceReturn', target: { playerId: pb.id, pawnIdx: 0 } });
  await wait(100);
  assert.equal(pa.items.forceReturn.earned, 0);
  assert.equal(pa.items.forceReturn.owned, 1);
  assert.equal(db.getUserItems(a.user.id).forceReturn, 1);
});

test('item aktif tidak bisa dipakai tanpa stok atau setelah melempar dadu', async () => {
  const { a, host, room, pa, pb } = await startedRoom();
  room.pawns[pb.id] = [12, 0, 0, 0];
  let err = once(host, 'room:error');
  host.emit('game:use_item', { itemId: 'forceReturn', target: { playerId: pb.id, pawnIdx: 0 } });
  assert.match(await err, /tidak punya/);

  await buy(a.token, 'forceReturn');
  room.dice = 4;
  err = once(host, 'room:error');
  host.emit('game:use_item', { itemId: 'forceReturn', target: { playerId: pb.id, pawnIdx: 0 } });
  assert.match(await err, /sebelum melempar dadu/);
  assert.equal(pa.items.forceReturn.owned, 1);

  room.dice = null;
  err = once(host, 'room:error');
  host.emit('game:use_item', { itemId: 'blackholeShield' });
  assert.match(await err, /tidak valid/, 'item pasif tidak bisa dipakai manual');
});

test('Blackhole Shield otomatis mencegah bidak tersedot dan mengurangi stok', async () => {
  const { a, room, pa } = await startedRoom({ blackHole: true });
  await buy(a.token, 'blackholeShield');
  // Merah val 2 + dadu 3 -> val 5 -> track 4 (Black Hole)
  room.pawns[pa.id] = [2, 0, 0, 0];
  room.dice = 3;
  require('../game/engine').handleMove(room, pa.id, 0);
  await wait(3 * 220 + 500);
  assert.equal(room.pawns[pa.id][0], 5, 'bidak tidak tersedot');
  assert.equal(pa.items.blackholeShield.owned, 0);
  assert.equal(db.getUserItems(a.user.id).blackholeShield || 0, 0);
  assert.equal(room.lastItemEvent.itemId, 'blackholeShield');
});

test('poin tidak cukup menolak pembelian', async () => {
  const u = await register();
  await buy(u.token, 'forceReturn');
  await buy(u.token, 'forceReturn');
  const third = await buy(u.token, 'forceReturn');
  assert.equal(third.success, false);
  assert.match(third.error, /Poin tidak mencukupi/);
  assert.equal(db.getUserItems(u.user.id).forceReturn, 2);
});
