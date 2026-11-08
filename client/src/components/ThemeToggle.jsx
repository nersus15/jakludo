import React from 'react';
import { THEME_ICONS, THEME_LABELS } from '../hooks/useTheme';

// Tombol tema: sekali ketuk berganti Terang -> Gelap -> Ikut perangkat
export default function ThemeToggle({ theme }) {
  const label = THEME_LABELS[theme.preference];
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={theme.cycle}
      aria-label={`Tema: ${label}. Ketuk untuk mengganti`}
      title={`Tema: ${label}`}
    >
      <span aria-hidden="true">{THEME_ICONS[theme.preference]}</span>
    </button>
  );
}
