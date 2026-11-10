import { useCallback, useEffect, useState } from 'react';

// Katalog item toko diambil dari server (registry di server/items), jadi item baru
// otomatis tampil di toko, inventaris, dan tombol pemakaian tanpa mengubah kode klien.
let cache = null;
let pending = null;

function loadCatalog() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = fetch('/api/shop/items')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        if (!Array.isArray(data?.items)) throw new Error('Format katalog tidak dikenal');
        cache = data.items;
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
  const [state, setState] = useState(cache ? { items: cache, status: 'ready' } : { items: [], status: 'loading' });

  const load = useCallback(() => {
    let active = true;
    setState(s => ({ ...s, status: cache ? 'ready' : 'loading' }));
    loadCatalog()
      .then(items => active && setState({ items, status: 'ready' }))
      .catch(() => active && setState({ items: [], status: 'error' }));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(), [load]);
  return { ...state, retry: load };
}

export function useItemCatalog() {
  return useItemCatalogState().items;
}

// Ringkasan stok item milik pemain dari room:update ({ count, owned, earned, blocked })
export function itemStock(player, itemId) {
  return player?.items?.[itemId] || { count: 0, owned: 0, earned: 0, blocked: null };
}
