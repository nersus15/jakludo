const test = require('node:test');
const assert = require('node:assert/strict');
const { canPawnMove, getMovablePawns, chooseBestPawn, nextFreeColor, getTrackIndex, isPawnIndex } = require('./rules');

function makeRoom(pawnsByPlayer, settings = { safeZones: true }) {
  const colors = ['red', 'green', 'yellow', 'blue'];
  const players = Object.keys(pawnsByPlayer).map((id, i) => ({ id, color: colors[i] }));
  return { players, pawns: pawnsByPlayer, settings };
}

test('bidak di markas hanya keluar dengan angka 1 atau 6', () => {
  const room = makeRoom({ a: [0, 0, 0, 0], b: [0, 0, 0, 0] });
  const a = room.players[0];
  assert.deepEqual(getMovablePawns(room, a, 3), []);
  assert.deepEqual(getMovablePawns(room, a, 6), [0, 1, 2, 3]);
  assert.deepEqual(getMovablePawns(room, a, 1), [0, 1, 2, 3]);
});

test('tidak boleh mendarat di petak bidak sendiri', () => {
  const room = makeRoom({ a: [5, 8, 0, 0], b: [0, 0, 0, 0] });
  assert.equal(canPawnMove(room, room.players[0], 0, 3), false);
  assert.equal(canPawnMove(room, room.players[0], 0, 4), true);
});

test('tidak boleh melewati petak finish', () => {
  const room = makeRoom({ a: [42, 0, 0, 0], b: [0, 0, 0, 0] });
  assert.equal(canPawnMove(room, room.players[0], 0, 2), true);
  assert.equal(canPawnMove(room, room.players[0], 0, 3), false);
});

test('safe zone yang ditempati lawan tidak bisa didarati', () => {
  // Track 6 adalah safe zone. Merah val 7 -> track 6. Hijau val 37 -> track (10+36)%40 = 6.
  const room = makeRoom({ a: [3, 0, 0, 0], b: [37, 0, 0, 0] });
  assert.equal(getTrackIndex(1, 37), 6);
  assert.equal(canPawnMove(room, room.players[0], 0, 4), false);
  room.settings.safeZones = false;
  assert.equal(canPawnMove(room, room.players[0], 0, 4), true);
});

test('bot memprioritaskan memakan lawan', () => {
  // Merah: bidak 0 di val 2 (track 1), bidak 1 di val 10 (track 9). Hijau di track 12 (val 3).
  const room = makeRoom({ a: [2, 10, 0, 0], b: [3, 0, 0, 0] });
  // dadu 3: bidak 1 -> val 13 -> track 12 = makan lawan
  assert.equal(chooseBestPawn(room, room.players[0], 3), 1);
});

test('nextFreeColor memilih warna yang belum dipakai', () => {
  assert.equal(nextFreeColor([{ color: 'red' }, { color: 'yellow' }]), 'green');
  assert.equal(nextFreeColor([{ color: 'red' }, { color: 'green' }, { color: 'yellow' }, { color: 'blue' }]), null);
});

test('isPawnIndex hanya menerima bilangan bulat 0..3', () => {
  for (const ok of [0, 1, 2, 3]) assert.equal(isPawnIndex(ok), true);
  for (const bad of [-1, 4, 1.5, '1', 'abc', null, undefined, NaN]) assert.equal(isPawnIndex(bad), false);
});

// ---------- Bot ----------

test('bot memilih bidak yang aman daripada mendarat tepat di depan lawan', () => {
  // Merah bidak 0 di val 3 (track 2), bidak 1 di val 20 (track 19). Dadu 2.
  // Bidak 0 -> track 4: ada hijau di track 1 (val 32, jarak 3) -> berisiko.
  // Bidak 1 -> track 21: tidak ada lawan di belakangnya -> aman.
  const room = makeRoom({ a: [3, 20, 0, 0], b: [32, 0, 0, 0] });
  assert.equal(getTrackIndex(1, 32), 1);
  assert.equal(chooseBestPawn(room, room.players[0], 2), 1);
});

test('bot lebih memilih memakan bidak lawan yang sudah jauh', () => {
  // Dadu 3: bidak 0 (val 2) -> track 4 memakan hijau val 35 (jauh); bidak 1 (val 10) -> track 12 memakan hijau val 3 (dekat markas)
  const room = makeRoom({ a: [2, 10, 0, 0], b: [35, 3, 0, 0] }, { safeZones: false });
  assert.equal(chooseBestPawn(room, room.players[0], 3), 0);
});

test('bot memasukkan bidak ke jalur finish yang aman jika lawan mengejar', () => {
  // Bidak 0 di val 37 dikejar hijau (track 33 = val 24), dadu 4 -> val 41 (jalur finish)
  const room = makeRoom({ a: [37, 5, 0, 0], b: [24, 0, 0, 0] });
  assert.equal(chooseBestPawn(room, room.players[0], 4), 0);
});

test('bot menghindari Black Hole jika tidak punya perisai', () => {
  // Dadu 3: bidak 0 (val 2) -> track 4 = Black Hole; bidak 1 (val 20) -> track 22 = petak biasa
  const room = makeRoom({ a: [2, 20, 0, 0], b: [0, 0, 0, 0] }, { safeZones: true, blackHole: true });
  assert.equal(chooseBestPawn(room, room.players[0], 3), 1);
});

// ---------- Black Hole acak ----------

test('Black Hole acak pindah di ruasnya sendiri dan menghindari bidak, petak aman, dan start', () => {
  const { relocateBlackHoles, COLOR_OFFSETS: offsets, SAFE_TRACK_INDICES: safe } = require('./rules');
  // Merah menempati track 1..5 (val 2..6 untuk bidak 0..3 + 1 bidak di val 4)
  const room = makeRoom({ a: [2, 3, 4, 5], b: [0, 0, 0, 0] }, { safeZones: true, blackHole: true });
  for (let i = 0; i < 200; i++) {
    const holes = relocateBlackHoles(room);
    holes.forEach((t, segment) => {
      assert.equal(Math.floor(t / 10), segment, 'tetap di ruasnya');
      assert.ok(!offsets.includes(t) && !safe.includes(t), 'bukan petak start/aman');
      assert.ok(![1, 2, 3, 4].includes(t), 'bukan petak berisi bidak');
    });
  }
});
