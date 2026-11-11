import React, { useEffect, useState, useRef } from 'react';
import { sound } from './sound';

// `muted`: matikan suara dadu untuk instance ini (layar permainan hanya merender satu dadu).
export default function Dice3D({ value, isRolling, canRoll, onRoll, disabled, playerColor, muted = false }) {
  const [landingBounce, setLandingBounce] = useState(false);
  const prevRollingRef = useRef(false);

  useEffect(() => {
    const wasRolling = prevRollingRef.current;
    prevRollingRef.current = isRolling;
    if (isRolling) {
      if (!muted) sound.playRoll();
    } else if (wasRolling && value) {
      // Tepat saat selesai kocok dan dadu mendarat pada angka value
      if (!muted) sound.playDiceLand(value === 6);
      setLandingBounce(true);
      const timer = setTimeout(() => setLandingBounce(false), 480);
      return () => clearTimeout(timer);
    }
  }, [isRolling, value, muted]);

  const handleClick = () => {
    if (canRoll && !disabled && !isRolling) {
      if (!muted) sound.playClick();
      onRoll();
    }
  };

  // Saat nilai dadu kosong (giliran baru), tetap tampilkan angka terakhir yang keluar, bukan 1,
  // supaya tidak terlihat seperti baru dapat 1
  const lastValueRef = useRef(1);
  if (value) lastValueRef.current = value;
  const targetFace = value || lastValueRef.current;
  const rotationClass = isRolling ? 'rolling-3d' : `show-${targetFace}`;

  const label = isRolling ? 'Dadu sedang dikocok' : canRoll ? 'Lempar dadu' : value ? `Dadu menunjukkan ${value}` : 'Dadu';

  // Tombol asli agar bisa dipakai lewat keyboard; nonaktif saat bukan giliran pemain
  return (
    <div className={`dice-wrapper ${value === 6 && !isRolling ? 'is-six' : ''}`}>
      <button
        type="button"
        className={`dice-button ${canRoll ? 'is-ready' : ''}`}
        onClick={handleClick}
        disabled={!canRoll || disabled || isRolling}
        aria-label={label}
        title={canRoll ? 'Lempar dadu' : undefined}
      >
      <span className={`dice-stage ${landingBounce ? 'landing-bounce' : ''}`} aria-hidden="true">
        <span className={`dice-cube ${rotationClass}`}>
          {/* Face 1 */}
          <span className="dice-face face-1">
            <span className="pip pip-center pip-red" />
          </span>

          {/* Face 2 */}
          <span className="dice-face face-2">
            <span className="pip pip-top-left" />
            <span className="pip pip-bottom-right" />
          </span>

          {/* Face 3 */}
          <span className="dice-face face-3">
            <span className="pip pip-top-left" />
            <span className="pip pip-center" />
            <span className="pip pip-bottom-right" />
          </span>

          {/* Face 4 */}
          <span className="dice-face face-4">
            <span className="pip pip-top-left" />
            <span className="pip pip-top-right" />
            <span className="pip pip-bottom-left" />
            <span className="pip pip-bottom-right" />
          </span>

          {/* Face 5 */}
          <span className="dice-face face-5">
            <span className="pip pip-top-left" />
            <span className="pip pip-top-right" />
            <span className="pip pip-center" />
            <span className="pip pip-bottom-left" />
            <span className="pip pip-bottom-right" />
          </span>

          {/* Face 6 */}
          <span className="dice-face face-6">
            <span className="pip pip-top-left" />
            <span className="pip pip-top-right" />
            <span className="pip pip-middle-left" />
            <span className="pip pip-middle-right" />
            <span className="pip pip-bottom-left" />
            <span className="pip pip-bottom-right" />
          </span>
        </span>

        {/* Bayangan di bawah dadu */}
        <span className={`dice-shadow ${isRolling ? 'rolling' : ''}`} />
      </span>
      </button>
    </div>
  );
}
