// Cache singkat untuk GET API yang sering terpanggil ulang (leaderboard, profil, riwayat).
// Saat login dipulihkan atau layar berganti, beberapa efek bisa meminta URL yang sama berkali-kali
// dalam hitungan milidetik; di sini request yang sama memakai satu hasil (atau satu request yang
// sedang berjalan). Kunci cache menyertakan token supaya data akun tidak tertukar.
const cache = new Map(); // key -> { at, promise }

export function getJsonCached(url, { token = '', maxAgeMs = 5000 } = {}) {
  const key = `${token}|${url}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.promise;
  const entry = { at: Date.now() };
  entry.promise = fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
    .then(data => {
      // Hasil gagal tidak disimpan supaya tombol "coba lagi" langsung meminta ulang
      if (data == null && cache.get(key) === entry) cache.delete(key);
      return data;
    });
  cache.set(key, entry);
  return entry.promise;
}
