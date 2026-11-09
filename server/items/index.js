// Registry item toko JakLudo.
//
// Menambah item baru: buat satu file di folder ini yang meng-export definisi item, lalu
// daftarkan di ITEMS di bawah. Engine, toko, inventaris, dan UI klien membaca semuanya dari
// sini, jadi tidak perlu mengubah file lain.
//
// Kontrak definisi item:
//   id, name, icon, price, description   data toko (id juga dipakai sebagai kunci di database)
//   badge, badgeColor, highlight          label tambahan untuk kartu toko (opsional)
//   kind: 'active' | 'passive'
//     active  -> dipakai pemain lewat tombol, di giliran sendiri sebelum melempar dadu
//     passive -> tidak punya tombol, bekerja otomatis lewat hooks
//   target: 'opponentPawn'                target yang harus dipilih sebelum use() (opsional)
//   sound: 'thunder' | 'chime'            efek suara saat item diumumkan ke semua pemain
//   canUse(ctx) -> string | null          alasan item belum bisa dipakai (opsional)
//   use(ctx)                              efek item aktif; stok sudah dikurangi sebelum dipanggil
//   progress(state) -> { value, max, label } | null
//                                         progres yang ditampilkan di inventaris (opsional)
//   hooks: { [event](ctx) -> boolean }    reaksi terhadap event permainan. Return true berarti
//                                         event sudah ditangani (mis. sedotan Black Hole dicegah).
//     'capture'   ctx.victim, ctx.pawnIdx   bidak lawan baru saja dimakan pemain
//     'blackHole' ctx.pawnIdx, ctx.trackPos bidak pemain mendarat di petak Black Hole
//
// ctx yang diterima use/canUse/hooks:
//   room, player, item, target              target hanya ada untuk use/canUse
//   count                                   stok item yang dimiliki pemain saat ini
//   state                                   objek progres item milik pemain (bebas diisi item)
//   consume() -> boolean                    kurangi 1 stok (item hasil pertandingan dipakai lebih dulu)
//   grant(n = 1)                            beri item gratis yang berlaku untuk pertandingan ini
//   game                                    helper engine: addHistory, setMessage, announce,
//                                           sendPawnHome, recordCapture

const ITEMS = [
  require('./blackhole-shield'),
  require('./force-return')
];

const KINDS = ['active', 'passive'];
const TARGETS = [undefined, 'opponentPawn'];

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
  registry.set(item.id, item);
}

function list() {
  return ITEMS;
}

function get(id) {
  return typeof id === 'string' ? registry.get(id) || null : null;
}

// Data item yang aman dikirim ke klien (tanpa function)
function catalog() {
  return ITEMS.map(({ id, name, icon, price, description, badge, badgeColor, highlight, kind, target, sound }) => ({
    id, name, icon, price, description, badge, badgeColor, highlight, kind, target: target || null, sound: sound || 'chime'
  }));
}

module.exports = { list, get, catalog };
