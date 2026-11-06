import React, { useState, useEffect } from 'react';
import { sound } from './sound';

export default function AudioSettingsModal({ isOpen, onClose }) {
  const [audioState, setAudioState] = useState(sound.getState());

  useEffect(() => {
    const unsubscribe = sound.subscribe((state) => {
      setAudioState({ ...state });
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const bgmPercent = Math.round(audioState.bgmVolume * 100);
  const sfxPercent = Math.round(audioState.sfxVolume * 100);

  const handleBgmSlider = (e) => {
    const val = parseFloat(e.target.value) / 100;
    sound.setBgmVolume(val);
  };

  const handleSfxSlider = (e) => {
    const val = parseFloat(e.target.value) / 100;
    sound.setSfxVolume(val);
  };

  const handleToggleBgmMute = () => {
    sound.toggleBgmMute();
  };

  const handleToggleSfxMute = () => {
    sound.toggleSfxMute();
  };

  const handleToggleBgmPlay = () => {
    sound.toggleBgmPlay();
  };

  const handleTestSfx = () => {
    sound.playDiceLand(true);
  };

  const handleResetDefaults = () => {
    sound.setBgmVolume(0.25);
    sound.setSfxVolume(0.75);
    if (audioState.bgmMuted) sound.toggleBgmMute();
    if (audioState.sfxMuted) sound.toggleSfxMute();
    sound.playBgm();
    sound.playJoinNotification();
  };

  return (
    <div className="audio-modal-overlay" onClick={onClose}>
      <div
        className="audio-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Pengaturan Suara JakLudo"
      >
        <button type="button" className="audio-close-btn" onClick={onClose} title="Tutup">
          ✕
        </button>

        <div className="audio-header">
          <div className="audio-title-icon">🎧</div>
          <h2>Pengaturan Suara</h2>
          <p className="audio-sub">
            Atur volume musik latar dan efek suara secara terpisah sesuai kenyamanan bermainmu.
          </p>
        </div>

        <div className="audio-modal-body">
          {/* Section 1: Musik Latar (BGM) */}
          <div className={`audio-setting-card ${audioState.bgmMuted ? 'card-muted' : ''}`}>
            <div className="audio-card-head">
              <div className="audio-card-icon bgm-icon">🎵</div>
              <div className="audio-card-info">
                <div className="audio-card-name-row">
                  <strong>Musik Latar (BGM)</strong>
                  {audioState.bgmMuted ? (
                    <span className="audio-status-badge muted-badge">Mute</span>
                  ) : (
                    <span className="audio-status-badge active-badge">
                      {audioState.isBgmPlaying ? '▶ Memutar' : '⏸ Dijeda'}
                    </span>
                  )}
                </div>
                <small className="audio-card-desc">Musik Latar JakLudo (Diputar saat bermain di room)</small>
              </div>

              <div className="audio-head-actions">
                <button
                  type="button"
                  className={`audio-mini-btn ${audioState.isBgmPlaying ? 'btn-playing' : ''}`}
                  onClick={handleToggleBgmPlay}
                  title={audioState.isBgmPlaying ? 'Jeda Musik' : 'Putar Musik'}
                >
                  {audioState.isBgmPlaying ? '⏸' : '▶'}
                </button>
                <button
                  type="button"
                  className={`audio-mini-btn ${audioState.bgmMuted ? 'btn-muted' : ''}`}
                  onClick={handleToggleBgmMute}
                  title={audioState.bgmMuted ? 'Nyalakan Musik' : 'Bisukan Musik'}
                >
                  {audioState.bgmMuted ? '🔇' : '🔊'}
                </button>
              </div>
            </div>

            <div className="audio-slider-row">
              <span className="slider-label-min">0%</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={audioState.bgmMuted ? 0 : bgmPercent}
                onChange={handleBgmSlider}
                className="audio-range-slider bgm-slider"
                aria-label="Volume Musik Latar"
              />
              <span className="slider-label-val">{audioState.bgmMuted ? '0%' : `${bgmPercent}%`}</span>
            </div>
            <div className="audio-card-footer-tip">
              💡 <em>Default: 25% — Hanya berbunyi di arena permainan, tenang di beranda</em>
            </div>
          </div>

          {/* Section 2: Efek Suara (SFX) */}
          <div className={`audio-setting-card ${audioState.sfxMuted ? 'card-muted' : ''}`}>
            <div className="audio-card-head">
              <div className="audio-card-icon sfx-icon">🎲</div>
              <div className="audio-card-info">
                <div className="audio-card-name-row">
                  <strong>Efek Suara (SFX)</strong>
                  {audioState.sfxMuted ? (
                    <span className="audio-status-badge muted-badge">Mute</span>
                  ) : (
                    <span className="audio-status-badge active-badge">Aktif</span>
                  )}
                </div>
                <small className="audio-card-desc">Kocokan dadu, langkah bidak, eliminasi & perayaan goal</small>
              </div>

              <div className="audio-head-actions">
                <button
                  type="button"
                  className="audio-test-btn"
                  onClick={() => sound.playGoalCelebration()}
                  title="Tes Suara Bidak Masuk Garis Akhir"
                >
                  ⭐ Tes Goal
                </button>
                <button
                  type="button"
                  className="audio-test-btn"
                  onClick={handleTestSfx}
                  title="Tes Suara Dadu"
                >
                  🔔 Tes Dadu
                </button>
                <button
                  type="button"
                  className={`audio-mini-btn ${audioState.sfxMuted ? 'btn-muted' : ''}`}
                  onClick={handleToggleSfxMute}
                  title={audioState.sfxMuted ? 'Nyalakan SFX' : 'Bisukan SFX'}
                >
                  {audioState.sfxMuted ? '🔇' : '🔊'}
                </button>
              </div>
            </div>

            <div className="audio-slider-row">
              <span className="slider-label-min">0%</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={audioState.sfxMuted ? 0 : sfxPercent}
                onChange={handleSfxSlider}
                className="audio-range-slider sfx-slider"
                aria-label="Volume Efek Suara"
              />
              <span className="slider-label-val">{audioState.sfxMuted ? '0%' : `${sfxPercent}%`}</span>
            </div>
            <div className="audio-card-footer-tip">
              ⚡ <em>Default: 75% — Jernih dan renyah agar setiap aksi terdengar jelas</em>
            </div>
          </div>

          {/* Preset & Save Buttons */}
          <div className="audio-modal-bottom-row">
            <button
              type="button"
              className="audio-reset-defaults-btn"
              onClick={handleResetDefaults}
              title="Kembalikan volume ke settingan rekomendasi"
            >
              🔄 Reset Rekomendasi (Musik 25% · SFX 75%)
            </button>
            <button
              type="button"
              className="audio-save-close-btn"
              onClick={onClose}
            >
              Selesai & Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
