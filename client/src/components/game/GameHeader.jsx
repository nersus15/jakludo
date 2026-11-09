import React, { useState } from 'react';
import Modal from '../Modal';
import ThemeToggle from '../ThemeToggle';
import { NetworkIndicator } from '../NetworkStatus';
import { sound } from '../../sound';

// Header ringkas saat bermain: kode room, sinyal, toko, suara, dan keluar (dengan konfirmasi)
export default function GameHeader({ room, audio, network, theme, onOpenShop, onOpenAudio, onLeave }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const muted = audio.bgmMuted && audio.sfxMuted;

  return (
    <header className="game-header">
      <div className="game-header__room">
        <span className="muted">Room</span> <strong className="code-text">{room.code}</strong>
        {room.settings?.blackHole && <span className="badge badge--warning">🕳️ Black Hole</span>}
      </div>
      <div className="game-header__actions">
        <NetworkIndicator {...network} />
        <button
          type="button"
          className="icon-btn"
          aria-label="Toko item"
          title="Toko item"
          onClick={() => {
            sound.playClick();
            onOpenShop();
          }}
        >
          <span aria-hidden="true">🏪</span>
        </button>
        <button type="button" className="icon-btn" aria-label="Pengaturan suara" title="Pengaturan suara" onClick={onOpenAudio}>
          <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
        </button>
        <ThemeToggle theme={theme} />
        <button type="button" className="btn btn--danger" onClick={() => setConfirmLeave(true)}>
          Keluar
        </button>
      </div>

      <Modal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        size="sm"
        title="Keluar dari permainan?"
        subtitle="Keluar di tengah permainan berarti menyerah. Kamu tidak bisa kembali ke pertandingan ini."
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setConfirmLeave(false)}>Tetap main</button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                setConfirmLeave(false);
                onLeave();
              }}
            >
              Menyerah dan keluar
            </button>
          </>
        }
      >
        <p className="muted">Kalau koneksimu hanya sedang tidak stabil, cukup tutup halaman ini. Kursimu tetap aman dan kamu bisa masuk lagi dari beranda.</p>
      </Modal>
    </header>
  );
}
