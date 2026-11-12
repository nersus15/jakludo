import { useCallback, useEffect, useState } from 'react';

// Daftar item bawaan (termasuk Hints Jawaban untuk Monster Quiz Battle) agar selalu tampil
// meskipun katalog sedang dimuat atau cache HMR lama masih aktif.
const BUILTIN_ITEMS = [
  {
    id: 'quizHint',
    name: 'Hints Jawaban',
    icon: '💡',
    price: 25,
    game: 'quiz',
    kind: 'active',
    target: null,
    badge: 'Monster Quiz',
    badgeColor: '#3b82f6',
    highlight: 'Eliminasi 2 opsi jawaban salah (50:50) saat duel Monster Quiz Battle',
    description:
      'Bantuan pintar saat ragu menjawab soal di Monster Quiz Battle! Menghilangkan 2 pilihan jawaban yang salah (50:50) pada ronde yang sedang berlangsung sehingga peluang benar meningkat tajam. Maksimal 1 Hint per ronde.'
  }
];

function mergeWithBuiltins(serverItems) {
  const list = Array.isArray(serverItems) ? [...serverItems] : [];
  const existingIds = new Set(list.map(it => it.id));
  for (const builtin of BUILTIN_ITEMS) {
    if (!existingIds.has(builtin.id)) {
      list.push(builtin);
    }
  }
  return list;
}

// Katalog item toko diambil dari server (registry di server/items), jadi item baru
// otomatis tampil di toko, inventaris, dan tombol pemakaian tanpa mengubah kode klien.
let cache = null;
let pending = null;

function loadCatalog(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!pending) {
    pending = fetch('/api/shop/items', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        if (!Array.isArray(data?.items)) throw new Error('Format katalog tidak dikenal');
        cache = mergeWithBuiltins(data.items);
        return cache;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

// Katalog beserta status muat: 'loading' | 'ready' | 'error'
export function useItemCatalogState() {
  const [state, setState] = useState(
    cache ? { items: mergeWithBuiltins(cache), status: 'ready' } : { items: BUILTIN_ITEMS, status: 'loading' }
  );

  const load = useCallback((force = false) => {
    let active = true;
    setState(s => ({ ...s, status: cache && !force ? 'ready' : 'loading' }));
    loadCatalog(force)
      .then(items => active && setState({ items, status: 'ready' }))
      .catch(() => active && setState({ items: BUILTIN_ITEMS, status: 'ready' }));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(true), [load]);
  return { ...state, retry: () => load(true) };
}

export function useItemCatalog() {
  return useItemCatalogState().items;
}

// Ringkasan stok item milik pemain dari room:update ({ count, owned, earned, blocked })
export function itemStock(player, itemId) {
  return player?.items?.[itemId] || { count: 0, owned: 0, earned: 0, blocked: null };
}
