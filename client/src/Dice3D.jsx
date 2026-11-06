import React, { useEffect, useState, useRef } from 'react';
import { sound } from './sound';

export default function Dice3D({ value, isRolling, canRoll, onRoll, disabled, playerColor }) {
  const [landingBounce, setLandingBounce] = useState(false);
  const prevRollingRef = useRef(false);

  useEffect(() => {
    if (isRolling) {
      sound.playRoll();
    } else if (prevRollingRef.current && value) {
      // Tepat saat selesai kocok dan dadu mendarat pada angka value
      sound.playDiceLand(value === 6);
      setLandingBounce(true);
      const timer = setTimeout(() => setLandingBounce(false), 480);
      return () => clearTimeout(timer);
    }
    prevRollingRef.current = isRolling;
  }, [isRolling, value]);

  const handleClick = () => {
    if (canRoll && !disabled && !isRolling) {
      sound.playClick();
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
