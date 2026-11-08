import React, { useEffect, useState, useRef } from 'react';
import { sound } from './sound';

// `muted`: dadu kedua (tampilan HP & desktop sama-sama dirender, salah satunya disembunyikan CSS)
// tidak ikut memutar suara agar suara kocok/mendarat tidak terdengar dobel.
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

  // Langsung tampilkan angka target (value) tanpa fallback ke 1
  const targetFace = value || 1;
  const rotationClass = isRolling ? 'rolling-3d' : `show-${targetFace}`;

  return (
    <div
      className={`dice-wrapper ${canRoll ? 'clickable' : ''} ${disabled ? 'disabled' : ''} ${value === 6 && !isRolling ? 'is-six' : ''}`}
      onClick={handleClick}
      title={canRoll ? 'Klik untuk mengocok dadu!' : ''}
    >
      <div className={`dice-stage ${landingBounce ? 'landing-bounce' : ''}`}>
        <div className={`dice-cube ${rotationClass}`}>
          {/* Face 1 */}
          <div className="dice-face face-1">
            <span className="pip pip-center pip-red" />
          </div>

          {/* Face 2 */}
          <div className="dice-face face-2">
            <span className="pip pip-top-left" />
            <span className="pip pip-bottom-right" />
          </div>

          {/* Face 3 */}
          <div className="dice-face face-3">
            <span className="pip pip-top-left" />
            <span className="pip pip-center" />
            <span className="pip pip-bottom-right" />
          </div>

          {/* Face 4 */}
          <div className="dice-face face-4">
            <span className="pip pip-top-left" />
            <span className="pip pip-top-right" />
            <span className="pip pip-bottom-left" />
            <span className="pip pip-bottom-right" />
          </div>

          {/* Face 5 */}
          <div className="dice-face face-5">
            <span className="pip pip-top-left" />
            <span className="pip pip-top-right" />
            <span className="pip pip-center" />
            <span className="pip pip-bottom-left" />
            <span className="pip pip-bottom-right" />
          </div>

          {/* Face 6 */}
          <div className="dice-face face-6">
            <span className="pip pip-top-left" />
            <span className="pip pip-top-right" />
            <span className="pip pip-middle-left" />
            <span className="pip pip-middle-right" />
            <span className="pip pip-bottom-left" />
            <span className="pip pip-bottom-right" />
          </div>
        </div>

        {/* Dynamic Shadow underneath */}
        <div className={`dice-shadow ${isRolling ? 'rolling' : ''}`} />
      </div>

      {canRoll && !isRolling && (
        <div className="dice-callout">
          <span className="pulse-dot" /> KLIK KOCOK DADU
        </div>
      )}
      {value === 1 && !isRolling && (
        <div className="one-badge">✦ DAPAT 1: KELUAR KOTAK (1X JALAN) ✦</div>
      )}
      {value === 6 && !isRolling && (
        <div className="six-badge">★ DAPAT 6: BONUS LEMPAR LAGI! ★</div>
      )}
    </div>
  );
}
