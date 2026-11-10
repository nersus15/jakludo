import React from 'react';
import Icon from './Icon';
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
      <Icon name={THEME_ICONS[theme.preference]} size={20} />
    </button>
  );
}
