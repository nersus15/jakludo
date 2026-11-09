import { useCallback, useEffect, useState } from 'react';

// Tema tampilan: 'light' (default), 'dark', atau 'system' (ikut pengaturan perangkat).
// Pilihan disimpan di localStorage; atribut data-theme di <html> dipasang lebih awal oleh
// skrip kecil di index.html agar halaman tidak berkedip saat dimuat.
const KEY = 'jakludo_theme';
const ORDER = ['light', 'dark', 'system'];
const META_COLORS = { light: '#f5ecdc', dark: '#1a1512' };

function readPreference() {
  try {
    const saved = localStorage.getItem(KEY);
    return ORDER.includes(saved) ? saved : 'light';
  } catch {
    return 'light';
  }
}

function resolve(preference) {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(preference) {
  const theme = resolve(preference);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
}

export const THEME_LABELS = { light: 'Terang', dark: 'Gelap', system: 'Ikut perangkat' };
export const THEME_ICONS = { light: '☀️', dark: '🌙', system: '🌗' };

export function useTheme() {
  const [preference, setPreference] = useState(readPreference);

  useEffect(() => {
    apply(preference);
    if (preference !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  // Ganti ke pilihan berikutnya: Terang -> Gelap -> Ikut perangkat -> Terang
  const cycle = useCallback(() => {
    setPreference(prev => {
      const next = ORDER[(ORDER.indexOf(prev) + 1) % ORDER.length];
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Tanpa localStorage pilihan hanya berlaku untuk sesi ini
      }
      return next;
    });
  }, []);

  return { preference, cycle };
}
