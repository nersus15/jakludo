// Katalog monster MVP untuk Monster Quiz Battle.
// Visual SVG berlapis & state animasi (idle, attack, hurt, victory, defeat) dirender di client/src/quiz/MonsterSprite.jsx
// berdasarkan id monster, sehingga aset dapat diganti kapan saja tanpa mengubah logic battle di server.

const INITIAL_HP = 100;
const ATTACK_DAMAGE = 10;

const MONSTERS = [
  {
    id: 'emberon',
    name: 'Emberon',
    element: 'fire',
    elementLabel: 'Api',
    description: 'Naga bara vulkanik dengan cakar magma menyala dan napas api bertekanan tinggi.',
    baseHp: INITIAL_HP,
    sortOrder: 1,
    active: true
  },
  {
    id: 'aquaris',
    name: 'Aquaris',
    element: 'water',
    elementLabel: 'Air',
    description: 'Penjaga samudra dalam yang mengendalikan pusaran arus deras dan perisai pasang.',
    baseHp: INITIAL_HP,
    sortOrder: 2,
    active: true
  },
  {
    id: 'terragon',
    name: 'Terragon',
    element: 'earth',
    elementLabel: 'Tanah',
    description: 'Golem batu purba berzirah granit yang mengguncang arena dengan hentakan tektonik.',
    baseHp: INITIAL_HP,
    sortOrder: 3,
    active: true
  },
  {
    id: 'voltix',
    name: 'Voltix',
    element: 'electric',
    elementLabel: 'Listrik',
    description: 'Serigala plasma berkecepatan kilat yang menyambar lawan dengan loncatan petir.',
    baseHp: INITIAL_HP,
    sortOrder: 4,
    active: true
  },
  {
    id: 'sylvara',
    name: 'Sylvara',
    element: 'nature',
    elementLabel: 'Alam',
    description: 'Roh rimba mistis yang memanggil sulur berduri dan badai spora zamrud.',
    baseHp: INITIAL_HP,
    sortOrder: 5,
    active: true
  },
  {
    id: 'frostbite',
    name: 'Frostbite',
    element: 'ice',
    elementLabel: 'Es',
    description: 'Raksasa gletser utara dengan taring kristal beku dan hembusan badai salju.',
    baseHp: INITIAL_HP,
    sortOrder: 6,
    active: true
  }
];

const MONSTERS_BY_ID = new Map(MONSTERS.map(m => [m.id, m]));

function listMonsters() {
  return MONSTERS.filter(m => m.active).map(m => ({ ...m }));
}

function getMonster(id) {
  if (typeof id !== 'string') return null;
  const m = MONSTERS_BY_ID.get(id.trim().toLowerCase());
  return m && m.active ? { ...m } : null;
}

module.exports = {
  INITIAL_HP,
  ATTACK_DAMAGE,
  MONSTERS,
  listMonsters,
  getMonster
};

