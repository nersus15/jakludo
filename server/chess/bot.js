// Mesin AI / Bot Catur untuk Chess Master (PlayGo)
// Menggunakan chess.js + Minimax dengan Alpha-Beta Pruning & Piece-Square Tables.
const crypto = require('crypto');
const { Chess } = require('chess.js');

const BOT_PROFILES = {
  easy: {
    id: 'bot_chess_easy',
    username: 'dimas_07',
    name: 'dimas_07',
    avatar: '1',
    rating: 950,
    difficulty: 'easy',
    isBot: true
  },
  medium: {
    id: 'bot_chess_medium',
    username: 'rizky_p',
    name: 'rizky_p',
    avatar: '2',
    rating: 1200,
    difficulty: 'medium',
    isBot: true
  },
  hard: {
    id: 'bot_chess_hard',
    username: 'hendra.gm',
    name: 'hendra.gm',
    avatar: '3',
    rating: 1550,
    difficulty: 'hard',
    isBot: true
  }
};

const QUICK_MATCH_BOT_NAMES = [
  { id: 'bot_chess_raka', username: 'raka_p', name: 'raka_p', avatar: '1' },
  { id: 'bot_chess_dewi', username: 'dewi.k', name: 'dewi.k', avatar: '2' },
  { id: 'bot_chess_bima', username: 'bima_sakti', name: 'bima_sakti', avatar: '3' },
  { id: 'bot_chess_citra', username: 'citra_m', name: 'citra_m', avatar: '4' },
  { id: 'bot_chess_arya', username: 'arya.wjy', name: 'arya.wjy', avatar: '5' },
  { id: 'bot_chess_nadia', username: 'nadia_putri', name: 'nadia_putri', avatar: '6' },
  { id: 'bot_chess_fajar', username: 'fajar_id', name: 'fajar_id', avatar: '1' },
  { id: 'bot_chess_kevin', username: 'kevin_k', name: 'kevin_k', avatar: '2' },
  { id: 'bot_chess_alya', username: 'alya.r', name: 'alya.r', avatar: '3' },
  { id: 'bot_chess_reza', username: 'reza_xd', name: 'reza_xd', avatar: '4' }
];

function isBotUserId(userId) {
  return typeof userId === 'string' && userId.startsWith('bot_');
}

function getBotProfile(difficultyOrId = 'medium', targetRating = null) {
  const key = String(difficultyOrId || 'medium').toLowerCase();
  if (BOT_PROFILES[key]) {
    return { ...BOT_PROFILES[key] };
  }
  for (const prof of Object.values(BOT_PROFILES)) {
    if (prof.id === key) return { ...prof };
  }
  const matchedPersona = QUICK_MATCH_BOT_NAMES.find(p => p.id === key);
  if (matchedPersona) {
    return {
      ...matchedPersona,
      rating: targetRating || 1200,
      difficulty: 'medium',
      isBot: true
    };
  }
  return { ...BOT_PROFILES.medium };
}

function buildQuickMatchBotForRating(playerRating = 1200) {
  const persona = QUICK_MATCH_BOT_NAMES[crypto.randomInt(0, QUICK_MATCH_BOT_NAMES.length)];
  const baseRating = Number(playerRating) || 1200;
  const jitter = crypto.randomInt(-35, 36);
  const botRating = Math.max(800, Math.min(2000, baseRating + jitter));

  let difficulty = 'medium';
  if (baseRating < 1080) difficulty = 'easy';
  else if (baseRating >= 1380) difficulty = 'hard';

  return {
    id: persona.id,
    userId: persona.id,
    username: persona.username,
    name: persona.name,
    avatar: persona.avatar,
    rating: botRating,
    difficulty,
    isBot: true
  };
}

// Nilai material bidak (centipawns)
const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

// Tabel posisi bidak (Piece-Square Tables) dari sudut pandang Putih (baris 0 = rank 8, baris 7 = rank 1)
const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 22, 22,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

function getPositionalBonus(piece, row, col) {
  const r = piece.color === 'w' ? row : 7 - row;
  if (piece.type === 'p') return PAWN_PST[r]?.[col] || 0;
  if (piece.type === 'n') return KNIGHT_PST[r]?.[col] || 0;
  if (piece.type === 'b') return BISHOP_PST[r]?.[col] || 0;
  return 0;
}

// Evaluasi papan dari sudut pandang Putih (+ menguntungkan Putih, - menguntungkan Hitam)
function evaluateBoard(chess) {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
    return 0;
  }
  return materialScore(chess);
}

// Nilai material + posisi saja (tanpa cek akhir permainan). Dipakai di daun pencarian: cek skakmat /
// remis sudah dilakukan sekali di simpul induk lewat jumlah langkah legal, jadi tidak perlu diulang.
function materialScore(chess) {
  const board = chess.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const val = (PIECE_VALUES[piece.type] || 0) + getPositionalBonus(piece, r, c);
      if (piece.color === 'w') score += val;
      else score -= val;
    }
  }
  return score;
}

function scoreMoveForOrdering(mv) {
  let s = 0;
  if (mv.san?.includes('#')) s += 10000;
  if (mv.promotion) s += 800;
  if (mv.captured) {
    s += 10 * (PIECE_VALUES[mv.captured] || 100) - ((PIECE_VALUES[mv.piece] || 100) / 10);
  }
  if (mv.san?.includes('+')) s += 150;
  return s;
}

const MATE_SCORE = 99999;

// Minimax alpha-beta, skor dari sudut pandang Putih. Skakmat yang lebih cepat dinilai lebih ekstrem.
function minimax(chess, depth, alpha, beta, isMaximizing) {
  if (depth === 0) return materialScore(chess);

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    if (!chess.inCheck()) return 0; // stalemate
    return chess.turn() === 'w' ? -MATE_SCORE - depth : MATE_SCORE + depth;
  }
  moves.sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const mv of moves) {
      chess.move(mv);
      const ev = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      if (ev > maxEval) maxEval = ev;
      if (ev > alpha) alpha = ev;
      if (beta <= alpha) break;
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (const mv of moves) {
    chess.move(mv);
    const ev = minimax(chess, depth - 1, alpha, beta, true);
    chess.undo();
    if (ev < minEval) minEval = ev;
    if (ev < beta) beta = ev;
    if (beta <= alpha) break;
  }
  return minEval;
}

// Kedalaman pencarian (setelah langkah akar), variasi acak skor, dan batas waktu berpikir per level.
// 'analysis' dipakai item HINT: paling dalam dan tanpa variasi acak.
const SEARCH_PROFILES = {
  easy: { depth: 1, jitter: 95, timeBudgetMs: 400 },
  medium: { depth: 1, jitter: 25, timeBudgetMs: 600 },
  hard: { depth: 2, jitter: 8, timeBudgetMs: 1500 },
  analysis: { depth: 3, jitter: 0, timeBudgetMs: 2500 }
};

// Pilih langkah untuk posisi `fen`. Langkah akar diurutkan dari yang paling menjanjikan; bila batas waktu
// habis, sisa langkah (yang kurang menjanjikan) tidak dihitung. Return { from, to, promotion, san, score }.
function chooseBotMove(fen, difficulty = 'medium', { timeBudgetMs } = {}) {
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  if (!legalMoves || legalMoves.length === 0) return null;
  const pick = mv => ({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q', san: mv.san });
  if (legalMoves.length === 1) return pick(legalMoves[0]);

  const isWhite = chess.turn() === 'w';
  const profile = SEARCH_PROFILES[String(difficulty || 'medium').toLowerCase()] || SEARCH_PROFILES.medium;
  const deadline = Date.now() + (timeBudgetMs ?? profile.timeBudgetMs);

  // Skakmat 1 langkah langsung dipilih
  for (const mv of legalMoves) {
    chess.move(mv);
    const isMate = chess.isCheckmate();
    chess.undo();
    if (isMate) return pick(mv);
  }

  legalMoves.sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));

  // Skor dari sudut pandang bot (besar = bagus untuk bot). Jendela pruning dilonggarkan selebar jitter
  // agar langkah yang hampir sama bagusnya tetap dihitung tepat dan bisa terpilih secara acak.
  let best = null;
  let bestScore = -Infinity;
  for (const mv of legalMoves) {
    if (best && Date.now() > deadline) break;
    const floor = bestScore === -Infinity ? -Infinity : bestScore - profile.jitter;
    chess.move(mv);
    const raw = isWhite
      ? minimax(chess, profile.depth, floor, Infinity, false)
      : -minimax(chess, profile.depth, -Infinity, floor === -Infinity ? Infinity : -floor, true);
    chess.undo();

    const jitter = profile.jitter ? crypto.randomInt(-profile.jitter, profile.jitter + 1) : 0;
    const score = raw + jitter;
    if (score > bestScore) {
      bestScore = score;
      best = mv;
    }
  }

  return { ...pick(best), score: bestScore };
}

module.exports = {
  BOT_PROFILES,
  QUICK_MATCH_BOT_NAMES,
  isBotUserId,
  getBotProfile,
  buildQuickMatchBotForRating,
  evaluateBoard,
  chooseBotMove
};

