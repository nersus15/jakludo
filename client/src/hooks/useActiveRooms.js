import { useEffect, useState } from 'react';
import { storage } from '../storage';

// Room yang masih aktif milik user (dibuat atau diikuti), agar bisa masuk lagi dari perangkat mana pun
export function useActiveRooms({ enabled, authToken }) {
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    if (!enabled || !authToken) {
      setRooms([]);
      return undefined;
    }
    let cancelled = false;
    const load = () => {
      fetch('/api/rooms/active', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (cancelled || !data?.success) return;
          setRooms(data.rooms);
          const saved = storage.get('active_room');
          if (saved && !data.rooms.some(r => r.code === saved)) storage.remove('active_room');
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 15000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, authToken]);

  return rooms;
}
