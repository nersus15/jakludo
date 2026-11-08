import { useEffect, useState } from 'react';

// Katalog item toko diambil dari server (registry di server/items), jadi item baru
// otomatis tampil di toko, inventaris, dan tombol pemakaian tanpa mengubah kode klien.
let cache = null;
let pending = null;

function loadCatalog() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = fetch('/api/shop/items')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        cache = Array.isArray(data?.items) ? data.items : [];
        return cache;
      })
      .catch(() => [])
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

export function useItemCatalog() {
  const [catalog, setCatalog] = useState(cache || []);
  useEffect(() => {
    let active = true;
    loadCatalog().then(list => active && setCatalog(list));
    return () => {
      active = false;
    };
  }, []);
  return catalog;
}

// Ringkasan stok item milik pemain dari room:update ({ count, owned, earned, progress })
export function itemStock(player, itemId) {
  return player?.items?.[itemId] || { count: 0, owned: 0, earned: 0, progress: null };
}
