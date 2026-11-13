import { useCallback, useEffect, useState } from 'react';
import { storage } from '../storage';
import { sound } from '../sound';

// Sesi login: token tersimpan, profil user, login & logout
export function useAuth() {
  const [authToken, setAuthToken] = useState(storage.get('token'));
  const [currentUser, setCurrentUser] = useState(null);
  const [checking, setChecking] = useState(!!storage.get('token'));

  // Verifikasi token yang tersimpan saat aplikasi dibuka
  useEffect(() => {
    if (!authToken) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(res => (res.ok ? res.json() : res.status === 401 ? { expired: true } : null))
      .then(data => {
        if (cancelled) return;
        if (data?.success && data.user) {
          setCurrentUser(data.user);
        } else if (data?.expired) {
          storage.remove('token');
          setAuthToken('');
          setCurrentUser(null);
        }
      })
      .catch(() => {
        // Gangguan jaringan sementara: biarkan token tetap tersimpan
      })
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const loginSuccess = useCallback((user, token) => {
    setCurrentUser(user);
    setAuthToken(token);
    storage.set('token', token);
    sound.playWin();
  }, []);

  const updateProfile = useCallback(async ({ name, username, email, currentPassword, newPassword }) => {
    if (!authToken) throw new Error('Silakan login terlebih dahulu.');
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ name, username, email, currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || 'Gagal memperbarui profil.');
    }
    setCurrentUser(data.user);
    sound.playWin();
    return data.user;
  }, [authToken]);

  const logout = useCallback(() => {
    if (authToken) {
      fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } }).catch(() => {});
    }
    setCurrentUser(null);
    setAuthToken('');
    storage.remove('token', 'active_room', 'session_id');
    sound.playClick();
  }, [authToken]);

  return { authToken, currentUser, setCurrentUser, checking, loginSuccess, logout, updateProfile };
}
