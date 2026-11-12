// Data katalog & palet visual monster di sisi klien.
// Terpisah dari komponen UI dan logic battle agar aset visual mudah diganti kapan saja.

export const QUIZ_MONSTERS = [
  {
    id: 'emberon',
    name: 'Emberon',
    element: 'fire',
    elementLabel: 'Api',
    title: 'Naga Bara Vulkanik',
    description: 'Naga bara vulkanik dengan cakar magma menyala dan napas api bertekanan tinggi.',
    baseHp: 100,
    accent: '#ef4444',
    accentSoft: '#fee2e2',
    secondary: '#f97316',
    glow: 'rgba(239, 68, 68, 0.45)'
  },
  {
    id: 'aquaris',
    name: 'Aquaris',
    element: 'water',
    elementLabel: 'Air',
    title: 'Penjaga Samudra Dalam',
    description: 'Penjaga samudra dalam yang mengendalikan pusaran arus deras dan perisai pasang.',
    baseHp: 100,
    accent: '#0ea5e9',
    accentSoft: '#e0f2fe',
    secondary: '#2563eb',
    glow: 'rgba(14, 165, 233, 0.45)'
  },
  {
    id: 'terragon',
    name: 'Terragon',
    element: 'earth',
    elementLabel: 'Tanah',
    title: 'Golem Batu Purba',
    description: 'Golem batu purba berzirah granit yang mengguncang arena dengan hentakan tektonik.',
    baseHp: 100,
    accent: '#d97706',
    accentSoft: '#fef3c7',
    secondary: '#78350f',
    glow: 'rgba(217, 119, 6, 0.45)'
  },
  {
    id: 'voltix',
    name: 'Voltix',
    element: 'electric',
    elementLabel: 'Listrik',
    title: 'Serigala Plasma Kilat',
    description: 'Serigala plasma berkecepatan kilat yang menyambar lawan dengan loncatan petir.',
    baseHp: 100,
    accent: '#eab308',
    accentSoft: '#fef9c3',
    secondary: '#ca8a04',
    glow: 'rgba(234, 179, 8, 0.5)'
  },
  {
    id: 'sylvara',
    name: 'Sylvara',
    element: 'nature',
    elementLabel: 'Alam',
    title: 'Roh Rimba Zamrud',
    description: 'Roh rimba mistis yang memanggil sulur berduri dan badai spora zamrud.',
    baseHp: 100,
    accent: '#22c55e',
    accentSoft: '#dcfce7',
    secondary: '#15803d',
    glow: 'rgba(34, 197, 94, 0.45)'
  },
  {
    id: 'frostbite',
    name: 'Frostbite',
    element: 'ice',
    elementLabel: 'Es',
    title: 'Raksasa Gletser Utara',
    description: 'Raksasa gletser utara dengan taring kristal beku dan hembusan badai salju.',
    baseHp: 100,
    accent: '#06b6d4',
    accentSoft: '#cffafe',
    secondary: '#0284c7',
    glow: 'rgba(6, 182, 212, 0.45)'
  }
];

const BY_ID = new Map(QUIZ_MONSTERS.map(m => [m.id, m]));

export function getClientMonster(id) {
  return BY_ID.get(String(id || '').toLowerCase()) || QUIZ_MONSTERS[0];
}

