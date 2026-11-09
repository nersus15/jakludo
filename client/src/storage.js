// Penyimpanan lokal klien. Versi lama memakai prefix "joybit_", tetap dibaca untuk kompatibilitas
// dan dibersihkan saat nilai baru ditulis. localStorage bisa melempar error (mode privat, diblokir).
const PREFIX = 'jakplayer_';
const LEGACY_PREFIX = 'joybit_';

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const storage = {
  get: key => safe(() => localStorage.getItem(PREFIX + key) || localStorage.getItem(LEGACY_PREFIX + key) || '', ''),
  set: (key, value) => safe(() => {
    localStorage.setItem(PREFIX + key, value);
    localStorage.removeItem(LEGACY_PREFIX + key);
  }),
  remove: (...keys) => safe(() => keys.forEach(key => {
    localStorage.removeItem(PREFIX + key);
    localStorage.removeItem(LEGACY_PREFIX + key);
  }))
};
