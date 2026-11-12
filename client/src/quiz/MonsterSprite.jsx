import React from 'react';
import { getClientMonster } from './monsters';

/**
 * Ilustrasi 2D vektor orisinal untuk 6 monster Monster Quiz Battle.
 * Tidak menggunakan emoji sebagai visual monster.
 * Mendukung 5 state animasi: 'idle' | 'attack' | 'hurt' | 'victory' | 'defeat'
 * serta orientasi hadap: facing="right" (Pemain 1 di kiri) | facing="left" (Pemain 2 di kanan).
 * Dipisahkan dari logic battle agar aset dapat diganti sewaktu-waktu tanpa mengubah engine.
 */
export default function MonsterSprite({
  monsterId = 'emberon',
  animState = 'idle',
  facing = 'right',
  size = 156,
  className = ''
}) {
  const monster = getClientMonster(monsterId);
  const state = ['idle', 'attack', 'hurt', 'victory', 'defeat'].includes(animState)
    ? animState
    : 'idle';

  return (
    <div
      className={`mq-sprite mq-sprite--${monster.id} mq-sprite--${state} mq-sprite--face-${facing} ${className}`.trim()}
      style={{
        '--mq-size': `${size}px`,
        '--mq-accent': monster.accent,
        '--mq-secondary': monster.secondary,
        '--mq-glow': monster.glow
      }}
      data-monster={monster.id}
      data-anim={state}
      role="img"
      aria-label={`${monster.name} (${monster.elementLabel})`}
    >
      <div className="mq-sprite__shadow" aria-hidden="true" />
      <div className="mq-sprite__actor" aria-hidden="true">
        {renderMonsterSvg(monster.id, state)}
      </div>
      {state === 'attack' && (
        <div className={`mq-sprite__fx mq-sprite__fx--${monster.element}`} aria-hidden="true">
          {renderAttackFxSvg(monster.element)}
        </div>
      )}
      {state === 'hurt' && (
        <div className="mq-sprite__impact" aria-hidden="true">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <path
              d="M40 6 L48 28 L72 20 L54 40 L74 58 L48 52 L40 74 L32 52 L6 58 L26 40 L8 20 L32 28 Z"
              fill="#fde047"
              stroke="#b42318"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

function renderAttackFxSvg(element) {
  switch (element) {
    case 'fire':
      return (
        <svg viewBox="0 0 96 64" className="mq-fx-svg">
          <path
            d="M8 32 C28 10, 56 6, 90 32 C56 58, 28 54, 8 32 Z"
            fill="#f97316"
            stroke="#2b2420"
            strokeWidth="3"
          />
          <path
            d="M18 32 C34 18, 56 18, 78 32 C56 46, 34 46, 18 32 Z"
            fill="#fde047"
          />
        </svg>
      );
    case 'water':
      return (
        <svg viewBox="0 0 96 64" className="mq-fx-svg">
          <path
            d="M6 36 Q32 8 64 24 T92 32 Q64 56 32 46 Z"
            fill="#0ea5e9"
            stroke="#2b2420"
            strokeWidth="3"
          />
          <circle cx="72" cy="24" r="6" fill="#e0f2fe" />
          <circle cx="54" cy="40" r="4" fill="#bae6fd" />
        </svg>
      );
    case 'earth':
      return (
        <svg viewBox="0 0 96 64" className="mq-fx-svg">
          <polygon
            points="16,44 34,14 66,10 88,32 70,54 28,54"
            fill="#b45309"
            stroke="#2b2420"
            strokeWidth="3.5"
          />
          <polyline points="34,14 52,34 70,54" stroke="#fcd34d" strokeWidth="3" fill="none" />
        </svg>
      );
    case 'electric':
      return (
        <svg viewBox="0 0 96 64" className="mq-fx-svg">
          <polygon
            points="8,36 42,10 38,28 88,18 50,54 54,36"
            fill="#facc15"
            stroke="#2b2420"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'nature':
      return (
        <svg viewBox="0 0 96 64" className="mq-fx-svg">
          <path
            d="M10 34 C30 10, 68 10, 90 32 C68 54, 30 54, 10 34 Z"
            fill="#22c55e"
            stroke="#2b2420"
            strokeWidth="3"
          />
          <path d="M18 33 L82 32" stroke="#dcfce7" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'ice':
    default:
      return (
        <svg viewBox="0 0 96 64" className="mq-fx-svg">
          <polygon
            points="8,32 36,14 90,32 36,50"
            fill="#38bdf8"
            stroke="#2b2420"
            strokeWidth="3"
          />
          <polygon points="24,32 42,22 76,32 42,42" fill="#e0f2fe" />
        </svg>
      );
  }
}

function renderEyes(state, cx1, cy1, cx2, cy2, eyeColor = '#fef08a') {
  if (state === 'hurt' || state === 'defeat') {
    return (
      <g stroke="#2b2420" strokeWidth="3.2" strokeLinecap="round">
        <path d={`M${cx1 - 5} ${cy1 - 5} L${cx1 + 5} ${cy1 + 5}`} />
        <path d={`M${cx1 + 5} ${cy1 - 5} L${cx1 - 5} ${cy1 + 5}`} />
        <path d={`M${cx2 - 5} ${cy2 - 5} L${cx2 + 5} ${cy2 + 5}`} />
        <path d={`M${cx2 + 5} ${cy2 - 5} L${cx2 - 5} ${cy2 + 5}`} />
      </g>
    );
  }
  if (state === 'victory') {
    return (
      <g fill="none" stroke="#2b2420" strokeWidth="3.2" strokeLinecap="round">
        <path d={`M${cx1 - 6} ${cy1 + 2} Q${cx1} ${cy1 - 6} ${cx1 + 6} ${cy1 + 2}`} />
        <path d={`M${cx2 - 6} ${cy2 + 2} Q${cx2} ${cy2 - 6} ${cx2 + 6} ${cy2 + 2}`} />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx={cx1} cy={cy1} rx="6" ry="7" fill={eyeColor} stroke="#2b2420" strokeWidth="2.6" />
      <circle cx={cx1 + 1.5} cy={cy1} r="3" fill="#2b2420" />
      <circle cx={cx1 + 2.5} cy={cy1 - 2} r="1.2" fill="#ffffff" />

      <ellipse cx={cx2} cy={cy2} rx="6" ry="7" fill={eyeColor} stroke="#2b2420" strokeWidth="2.6" />
      <circle cx={cx2 + 1.5} cy={cy2} r="3" fill="#2b2420" />
      <circle cx={cx2 + 2.5} cy={cy2 - 2} r="1.2" fill="#ffffff" />
    </g>
  );
}

function renderMonsterSvg(id, state) {
  switch (id) {
    case 'emberon':
      return (
        <svg viewBox="0 0 160 160" className="mq-monster-svg">
          {/* Ekor bara api */}
          <path
            d="M36 112 C12 106, 8 76, 26 62 C18 82, 28 96, 46 98 Z"
            fill="#f97316"
            stroke="#2b2420"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M22 64 C14 48, 28 32, 38 46 C44 34, 52 50, 38 66 Z"
            fill="#fde047"
            stroke="#2b2420"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Sayap naga kecil */}
          <path
            d="M52 72 L24 44 L44 52 L34 32 L64 56 Z"
            fill="#b91c1c"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          {/* Tubuh utama naga api */}
          <ellipse
            cx="84"
            cy="92"
            rx="42"
            ry="40"
            fill="#ef4444"
            stroke="#2b2420"
            strokeWidth="4.2"
          />
          {/* Perut sisik magma */}
          <path
            d="M66 74 C92 70, 114 82, 112 110 C104 126, 74 128, 64 112 Z"
            fill="#fed7aa"
            stroke="#2b2420"
            strokeWidth="3.2"
          />
          <path d="M70 88 H108 M68 100 H110 M72 112 H104" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
          {/* Tanduk magma */}
          <path
            d="M62 56 L46 26 L76 48 Z"
            fill="#f59e0b"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          <path
            d="M96 52 L106 22 L114 54 Z"
            fill="#f59e0b"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          {/* Kepala */}
          <path
            d="M58 60 C58 36, 116 36, 122 64 C128 84, 108 94, 76 90 C60 88, 56 74, 58 60 Z"
            fill="#dc2626"
            stroke="#2b2420"
            strokeWidth="4.2"
          />
          {renderEyes(state, 82, 62, 106, 62, '#fef08a')}
          {/* Mulut & taring */}
          <path
            d="M78 78 Q98 86 116 76"
            fill="none"
            stroke="#2b2420"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <polygon points="84,79 88,87 92,80" fill="#ffffff" stroke="#2b2420" strokeWidth="2" />
          <polygon points="104,79 108,87 112,78" fill="#ffffff" stroke="#2b2420" strokeWidth="2" />
          {/* Kaki & cakar */}
          <ellipse cx="66" cy="130" rx="14" ry="9" fill="#b91c1c" stroke="#2b2420" strokeWidth="3.8" />
          <ellipse cx="104" cy="130" rx="14" ry="9" fill="#b91c1c" stroke="#2b2420" strokeWidth="3.8" />
        </svg>
      );

    case 'aquaris':
      return (
        <svg viewBox="0 0 160 160" className="mq-monster-svg">
          {/* Ekor sirip samudra */}
          <path
            d="M34 108 C10 98, 12 66, 36 56 L24 40 L48 52 C42 74, 42 92, 52 104 Z"
            fill="#0284c7"
            stroke="#2b2420"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          {/* Sirip punggung */}
          <path
            d="M66 44 L58 20 L84 36 L96 18 L106 42 Z"
            fill="#38bdf8"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          {/* Tubuh leviathan air */}
          <path
            d="M46 92 C44 54, 74 40, 98 44 C122 48, 132 76, 124 108 C118 128, 56 130, 46 92 Z"
            fill="#0ea5e9"
            stroke="#2b2420"
            strokeWidth="4.2"
          />
          {/* Perut & inti gelombang */}
          <ellipse cx="90" cy="98" rx="26" ry="22" fill="#e0f2fe" stroke="#2b2420" strokeWidth="3.2" />
          <circle cx="90" cy="96" r="9" fill="#0284c7" stroke="#2b2420" strokeWidth="2.8" />
          <circle cx="87" cy="93" r="3" fill="#ffffff" />
          {/* Sirip pipi */}
          <path
            d="M118 64 L142 54 L134 70 L144 80 L118 78 Z"
            fill="#7dd3fc"
            stroke="#2b2420"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {renderEyes(state, 78, 66, 104, 66, '#e0f2fe')}
          <path d="M82 80 Q92 86 104 80" fill="none" stroke="#2b2420" strokeWidth="3.4" strokeLinecap="round" />
          {/* Kaki sirip */}
          <ellipse cx="66" cy="128" rx="15" ry="8" fill="#0369a1" stroke="#2b2420" strokeWidth="3.8" />
          <ellipse cx="106" cy="128" rx="15" ry="8" fill="#0369a1" stroke="#2b2420" strokeWidth="3.8" />
        </svg>
      );

    case 'terragon':
      return (
        <svg viewBox="0 0 160 160" className="mq-monster-svg">
          {/* Pundak kristal batu */}
          <polygon
            points="32,74 46,34 68,54"
            fill="#f59e0b"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          <polygon
            points="98,50 116,28 130,68"
            fill="#f59e0b"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          {/* Badan golem granit */}
          <polygon
            points="38,66 64,42 104,42 128,68 122,124 44,124"
            fill="#a16207"
            stroke="#2b2420"
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          {/* Lempeng dada batu */}
          <polygon
            points="54,74 84,62 112,74 106,112 60,112"
            fill="#d97706"
            stroke="#2b2420"
            strokeWidth="3.4"
            strokeLinejoin="round"
          />
          {/* Rune menyala di dada */}
          <polygon points="84,74 94,88 84,102 74,88" fill="#fef08a" stroke="#2b2420" strokeWidth="2.6" />
          {/* Tangan kepalan batu */}
          <rect x="20" y="78" width="24" height="32" rx="6" fill="#78350f" stroke="#2b2420" strokeWidth="3.8" />
          <rect x="118" y="78" width="24" height="32" rx="6" fill="#78350f" stroke="#2b2420" strokeWidth="3.8" />
          {renderEyes(state, 72, 58, 98, 58, '#fde047')}
          {/* Rahang batu */}
          <path d="M68 70 L76 74 L86 69 L96 74 L104 70" fill="none" stroke="#2b2420" strokeWidth="3.5" strokeLinecap="round" />
          {/* Kaki pilar */}
          <rect x="52" y="120" width="24" height="16" rx="5" fill="#78350f" stroke="#2b2420" strokeWidth="3.8" />
          <rect x="92" y="120" width="24" height="16" rx="5" fill="#78350f" stroke="#2b2420" strokeWidth="3.8" />
        </svg>
      );

    case 'voltix':
      return (
        <svg viewBox="0 0 160 160" className="mq-monster-svg">
          {/* Ekor petir bercabang */}
          <polygon
            points="44,106 14,88 30,78 12,56 46,68 36,80 54,92"
            fill="#facc15"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          {/* Telinga tajam serigala plasma */}
          <polygon points="56,56 48,20 78,44" fill="#eab308" stroke="#2b2420" strokeWidth="3.8" strokeLinejoin="round" />
          <polygon points="92,44 116,18 114,56" fill="#eab308" stroke="#2b2420" strokeWidth="3.8" strokeLinejoin="round" />
          {/* Surai kilat */}
          <polygon
            points="44,72 30,58 52,52 64,34 86,44 106,34 128,60 116,74 134,88 112,102"
            fill="#fde047"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          {/* Badan utama */}
          <ellipse cx="86" cy="92" rx="36" ry="34" fill="#f59e0b" stroke="#2b2420" strokeWidth="4.2" />
          {/* Dada petir */}
          <polygon
            points="74,78 98,78 88,96 102,96 78,120 84,100 70,100"
            fill="#fef9c3"
            stroke="#2b2420"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          {renderEyes(state, 76, 66, 102, 66, '#e0f2fe')}
          <path d="M78 80 L88 85 L98 79" fill="none" stroke="#2b2420" strokeWidth="3.4" strokeLinecap="round" />
          {/* Kaki cepat */}
          <ellipse cx="68" cy="128" rx="13" ry="8" fill="#ca8a04" stroke="#2b2420" strokeWidth="3.8" />
          <ellipse cx="104" cy="128" rx="13" ry="8" fill="#ca8a04" stroke="#2b2420" strokeWidth="3.8" />
        </svg>
      );

    case 'sylvara':
      return (
        <svg viewBox="0 0 160 160" className="mq-monster-svg">
          {/* Mahkota daun zamrud */}
          <path
            d="M56 48 C46 22, 72 16, 82 38 C88 14, 118 22, 106 48 Z"
            fill="#16a34a"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          <circle cx="82" cy="30" r="6" fill="#f43f5e" stroke="#2b2420" strokeWidth="2.6" />
          {/* Sayap/jubah daun */}
          <path
            d="M44 82 C20 72, 22 110, 48 114 Z"
            fill="#15803d"
            stroke="#2b2420"
            strokeWidth="3.8"
          />
          <path
            d="M120 82 C144 72, 142 110, 116 114 Z"
            fill="#15803d"
            stroke="#2b2420"
            strokeWidth="3.8"
          />
          {/* Tubuh roh alam */}
          <path
            d="M50 86 C48 52, 116 52, 114 86 C116 118, 98 130, 82 130 C66 130, 48 118, 50 86 Z"
            fill="#4ade80"
            stroke="#2b2420"
            strokeWidth="4.2"
          />
          {/* Pola kalung daun */}
          <path
            d="M58 88 Q82 106 106 88 Q96 116 82 118 Q68 116 58 88 Z"
            fill="#bbf7d0"
            stroke="#2b2420"
            strokeWidth="3"
          />
          {renderEyes(state, 72, 70, 96, 70, '#fef08a')}
          <path d="M78 82 Q84 87 90 82" fill="none" stroke="#2b2420" strokeWidth="3.2" strokeLinecap="round" />
          {/* Akar pijakan */}
          <ellipse cx="68" cy="130" rx="12" ry="7" fill="#15803d" stroke="#2b2420" strokeWidth="3.6" />
          <ellipse cx="96" cy="130" rx="12" ry="7" fill="#15803d" stroke="#2b2420" strokeWidth="3.6" />
        </svg>
      );

    case 'frostbite':
    default:
      return (
        <svg viewBox="0 0 160 160" className="mq-monster-svg">
          {/* Puncak kristal es di punggung & kepala */}
          <polygon
            points="48,54 36,24 66,40"
            fill="#67e8f9"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          <polygon
            points="72,38 82,14 94,38"
            fill="#a5f3fc"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          <polygon
            points="98,40 126,24 114,54"
            fill="#67e8f9"
            stroke="#2b2420"
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          {/* Tubuh yeti gletser */}
          <path
            d="M40 88 C38 48, 126 48, 124 88 C128 118, 112 130, 82 130 C52 130, 36 118, 40 88 Z"
            fill="#06b6d4"
            stroke="#2b2420"
            strokeWidth="4.2"
          />
          {/* Perisai dada es */}
          <polygon
            points="62,82 82,72 102,82 98,116 66,116"
            fill="#cffafe"
            stroke="#2b2420"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          {renderEyes(state, 70, 62, 98, 62, '#ffffff')}
          {/* Mulut & taring es */}
          <path d="M68 76 H100" stroke="#2b2420" strokeWidth="3.6" strokeLinecap="round" />
          <polygon points="72,76 76,86 80,76" fill="#e0f2fe" stroke="#2b2420" strokeWidth="2.2" />
          <polygon points="88,76 92,86 96,76" fill="#e0f2fe" stroke="#2b2420" strokeWidth="2.2" />
          {/* Kaki gletser */}
          <rect x="52" y="122" width="24" height="14" rx="6" fill="#0e7490" stroke="#2b2420" strokeWidth="3.8" />
          <rect x="90" y="122" width="24" height="14" rx="6" fill="#0e7490" stroke="#2b2420" strokeWidth="3.8" />
        </svg>
      );
  }
}

