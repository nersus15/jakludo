// Registry item toko JakLudo.
//
// Menambah item baru: buat satu file di folder ini yang meng-export definisi item, lalu
// daftarkan di ITEMS di bawah. Engine, toko, inventaris, dan UI klien membaca semuanya dari
// sini, jadi tidak perlu mengubah file lain.
//
// Kontrak definisi item:
//   id, name, icon, price, description   data toko (id juga dipakai sebagai kunci di database)
//   badge, badgeColor, highlight          label tambahan untuk kartu toko (opsional)
//   kind: 'active' | 'passive' | 'reactive'
//     active   -> dipakai pemain lewat tombol, di giliran sendiri sebelum melempar dadu
//     passive  -> tidak punya tombol, bekerja otomatis lewat hooks
//     reactive -> tidak punya tombol; saat event di `protects` mengenai bidak pemiliknya,
//                 pemain ditanya mau memakai item atau tidak, lalu protect(ctx) dipanggil
//   target: 'opponentPawn'                target yang harus dipilih sebelum use() (opsional)
//   attack: 'forceReturn'                 serangan item aktif ini bisa ditahan perisai (opsional)
//   protects: ['forceReturn' | 'blackHole']
//                                         event yang dicegah item (wajib untuk reactive)
//   protect(ctx)                          efek item reaktif; ctx.event, ctx.pawnIdx, ctx.attacker
//   sound: 'thunder' | 'chime'            efek suara saat item diumumkan ke semua pemain
//   canUse(ctx) -> string | null          alasan item aktif belum bisa dipakai (opsional). Dicek sebelum
//                                         target dipilih (ctx tanpa target) dan dikirim ke klien
//                                         sebagai items[id].blocked agar tombolnya bisa dinonaktifkan
//   use(ctx)                              efek item aktif; stok sudah dikurangi sebelum dipanggil
//   hooks: { [event](ctx) -> boolean }    reaksi terhadap event permainan. Return true berarti
//                                         event sudah ditangani (mis. sedotan Black Hole dicegah).
//     'capture'   ctx.victim, ctx.pawnIdx   bidak lawan baru saja dimakan pemain
//     'blackHole' ctx.pawnIdx, ctx.trackPos bidak pemain mendarat di petak Black Hole
//                 (item pasif dicoba lebih dulu, baru item reaktif ditawarkan)
//
// ctx yang diterima use/canUse/hooks:
//   room, player, item, target              target hanya ada untuk use
//   count                                   stok item yang dimiliki pemain saat ini
//   state                                   objek progres item milik pemain (bebas diisi item)
//   consume() -> boolean                    kurangi 1 stok (item hasil pertandingan dipakai lebih dulu)
//   grant(n = 1)                            beri item gratis yang berlaku untuk pertandingan ini
//   game                                    helper engine: addHistory, setMessage, announce,
//                                           sendPawnHome, recordCapture

const ITEMS = [
  require('./blackhole-shield'),
  require('./universal-shield'),
  require('./force-return')
];

const KINDS = ['active', 'passive', 'reactive'];
const TARGETS = [undefined, 'opponentPawn'];
const PROTECT_EVENTS = ['forceReturn', 'blackHole'];

// Cek kontrak saat server start agar item yang salah definisi langsung ketahuan
const registry = new Map();
for (const item of ITEMS) {
  const where = `Item "${item.id}"`;
  if (!item.id || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(item.id)) throw new Error(`${where}: id wajib berupa huruf/angka`);
  if (registry.has(item.id)) throw new Error(`${where}: id sudah dipakai item lain`);
  if (!item.name || !item.icon || !item.description) throw new Error(`${where}: name, icon, dan description wajib diisi`);
  if (!Number.isInteger(item.price) || item.price < 0) throw new Error(`${where}: price harus bilangan bulat >= 0`);
  if (!KINDS.includes(item.kind)) throw new Error(`${where}: kind harus 'active' atau 'passive'`);
  if (!TARGETS.includes(item.target)) throw new Error(`${where}: target tidak dikenal`);
  if (item.kind === 'active' && typeof item.use !== 'function') throw new Error(`${where}: item aktif wajib punya use()`);
  if (item.kind === 'passive' && !item.hooks) throw new Error(`${where}: item pasif wajib punya hooks`);
  if (item.protects && (!Array.isArray(item.protects) || !item.protects.every(e => PROTECT_EVENTS.includes(e)))) {
    throw new Error(`${where}: protects hanya boleh berisi ${PROTECT_EVENTS.join(', ')}`);
  }
  if (item.attack && !PROTECT_EVENTS.includes(item.attack)) throw new Error(`${where}: attack tidak dikenal`);
  if (item.kind === 'reactive' && (!item.protects?.length || typeof item.protect !== 'function')) {
    throw new Error(`${where}: item reaktif wajib punya protects dan protect()`);
  }
  registry.set(item.id, item);
}

function list() {
  return ITEMS;
}

function get(id) {
  return typeof id === 'string' ? registry.get(id) || null : null;
}

// Item yang bisa menahan sebuah event untuk pemiliknya (pasif maupun reaktif)
function protectorsOf(event) {
  return ITEMS.filter(item => item.protects?.includes(event));
}

// Data item yang aman dikirim ke klien (tanpa function)
function catalog() {
  return ITEMS.map(({ id, name, icon, price, description, badge, badgeColor, highlight, kind, target, sound, protects }) => ({
    id, name, icon, price, description, badge, badgeColor, highlight, kind, target: target || null, sound: sound || 'chime', protects: protects || []
  }));
}

module.exports = { list, get, catalog, protectorsOf };
