export const COLORS = ['red', 'green', 'yellow', 'blue'];
export const COLOR_OFFSETS = [0, 10, 20, 30];

export const COLOR_INFO = {
  red: { name: 'Merah', hex: '#ef4444', light: '#fecaca', dark: '#991b1b' },
  green: { name: 'Hijau', hex: '#22c55e', light: '#bbf7d0', dark: '#15803d' },
  yellow: { name: 'Kuning', hex: '#f59e0b', light: '#fde68a', dark: '#b45309' },
  blue: { name: 'Biru', hex: '#3b82f6', light: '#bfdbfe', dark: '#1d4ed8' }
};

// 40 lintasan searah jarum jam mulai dari kotak start Merah [9, 4] pada papan 11x11
export const TRACK_COORDS = [
  [9, 4], [8, 4], [7, 4], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [5, 0], [4, 0],
  [4, 1], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 5], [0, 6],
  [1, 6], [2, 6], [3, 6], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10], [5, 10], [6, 10],
  [6, 9], [6, 8], [6, 7], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [10, 5], [10, 4]
];

// Jalur khusus menuju kotak finish masing-masing warna (4 langkah runway)
export const HOME_COORDS = {
  red: [[9, 5], [8, 5], [7, 5], [6, 5]],
  green: [[5, 1], [5, 2], [5, 3], [5, 4]],
  yellow: [[1, 5], [2, 5], [3, 5], [4, 5]],
  blue: [[5, 9], [5, 8], [5, 7], [5, 6]]
};

// Kotak finish tengah [5, 5] (1 sel di tengah papan 11x11)
export const GOAL_COORDS = {
  red: [5, 5],
  green: [5, 5],
  yellow: [5, 5],
  blue: [5, 5]
};

// Kotak aman (safe star squares)
export const SAFE_TRACK_INDICES = [0, 6, 10, 16, 20, 26, 30, 36];

// Kotak Black Hole misterius (aktif jika mode blackhole dihidupkan)
export const BLACK_HOLE_INDICES = [4, 14, 24, 34];

// Koordinat petak start masing-masing warna
export const START_TILES = {
  red: [9, 4],
  green: [4, 1],
  yellow: [1, 6],
  blue: [6, 9]
};

export function getPawnCoord(color, val) {
  if (val <= 0) return null;
  const colorIdx = COLORS.indexOf(color);
  if (val >= 1 && val <= 39) {
    const trackIdx = (COLOR_OFFSETS[colorIdx] + val - 1) % 40;
    return TRACK_COORDS[trackIdx];
  }
  if (val >= 40 && val <= 43) {
    return HOME_COORDS[color][val - 40];
  }
  if (val === 44) {
    return GOAL_COORDS[color];
  }
  return null;
}
