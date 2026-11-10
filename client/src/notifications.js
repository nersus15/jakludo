// Notifikasi bawaan browser (Notification API) untuk event permainan yang datang lewat WebSocket.
// Hanya ditampilkan saat tab JakLudo sedang tidak dilihat pemain (tab lain / aplikasi lain / layar mati).

const ICON = '/icons/icon-192.png';

export const isNotificationSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export const getNotificationPermission = () => (isNotificationSupported() ? Notification.permission : 'unsupported');

// Harus dipanggil dari aksi pengguna (klik tombol), browser memblokir permintaan otomatis
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    // Safari lama hanya mendukung versi callback
    return new Promise(resolve => Notification.requestPermission(resolve));
  }
}

export const isPageHidden = () => document.visibilityState === 'hidden' || !document.hasFocus();

// Service worker yang sudah aktif (maks. 1,5 detik menunggu). null jika tidak ada / belum siap.
async function activeRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve => setTimeout(() => resolve(null), 1500))
    ]);
    return reg?.active ? reg : null;
  } catch {
    return null;
  }
}

// Tampilkan notifikasi. Mengembalikan { ok, reason } agar kegagalan bisa dijelaskan ke pemain.
// tag yang sama menggantikan notifikasi sebelumnya sehingga tidak menumpuk.
export async function notify(title, { body, tag, force = false } = {}) {
  if (!isNotificationSupported()) return { ok: false, reason: 'unsupported' };
  if (Notification.permission !== 'granted') return { ok: false, reason: Notification.permission };
  if (!force && !isPageHidden()) return { ok: false, reason: 'visible' };

  const options = { body, tag, icon: ICON, badge: ICON, renotify: !!tag, data: { url: location.href } };
  let lastError = null;

  // 1) Lewat service worker: wajib di Android Chrome dan PWA terpasang
  const reg = await activeRegistration();
  if (reg) {
    try {
      await reg.showNotification(title, options);
      return { ok: true };
    } catch (err) {
      lastError = err;
      console.warn('[notif] showNotification via service worker gagal, mencoba cara biasa:', err);
    }
  }

  // 2) Cadangan: konstruktor Notification (desktop)
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return { ok: true };
  } catch (err) {
    console.warn('[notif] new Notification gagal:', lastError || err);
    return { ok: false, reason: 'error', error: err };
  }
}
