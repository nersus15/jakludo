// REST API untuk Monster Quiz Battle:
// - Katalog monster (/api/quiz/monsters)
// - Leaderboard khusus Monster Quiz Battle (/api/quiz/leaderboard)
// - Statistik & riwayat pertandingan pemain (/api/quiz/stats, /api/quiz/history)
// - Cek room aktif (/api/quiz/active-room)
// - Manajemen bank soal (/api/quiz/questions) yang siap dihubungkan ke Admin Panel
const db = require('../db');
const quizStore = require('./store');
const quizEngine = require('./engine');
const { createLimiter } = require('../lib/limiter');

const quizWriteLimiter = createLimiter({ windowMs: 60 * 1000, max: 30 });

function bearerToken(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function requireUser(req, res, message = 'Silakan login terlebih dahulu.') {
  const user = db.getUserByToken(bearerToken(req) || String(req.body?.token || ''));
  if (!user) res.status(401).json({ success: false, error: message });
  return user;
}

function requireQuizAdmin(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;
  const adminUsers = String(process.env.QUIZ_ADMIN_USERNAMES || 'admin')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  const adminKey = process.env.QUIZ_ADMIN_KEY ? String(process.env.QUIZ_ADMIN_KEY) : '';
  const headerKey = String(req.headers['x-quiz-admin-key'] || '');

  const isAllowed =
    adminUsers.includes(String(user.username || '').toLowerCase()) ||
    (adminKey && headerKey === adminKey);

  if (!isAllowed) {
    res.status(403).json({ success: false, error: 'Akses ditolak: hanya admin yang dapat mengelola bank soal.' });
    return null;
  }
  return user;
}

function registerQuizRoutes(api) {
  // Katalog monster yang tersedia untuk dipilih pemain
  api.get('/quiz/monsters', (req, res) => {
    res.json({
      success: true,
      monsters: quizStore.listMonsters()
    });
  });

  // Leaderboard khusus Monster Quiz Battle (terpisah dari leaderboard Ludo)
  api.get('/quiz/leaderboard', (req, res) => {
    const limit = Number(req.query.limit) || 50;
    res.json({
      success: true,
      leaderboard: quizStore.getQuizLeaderboard(limit)
    });
  });

  // Statistik & riwayat pertandingan pemain yang sedang login (atau berdasarkan userId)
  api.get('/quiz/stats', (req, res) => {
    const targetUserId = typeof req.query.userId === 'string' && req.query.userId.trim()
      ? req.query.userId.trim()
      : null;

    if (targetUserId) {
      const targetUser = db.getUserById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ success: false, error: 'Pemain tidak ditemukan.' });
      }
      return res.json({
        success: true,
        stats: quizStore.getPlayerStats(targetUser.id),
        history: quizStore.getPlayerMatchHistory(targetUser.id, Number(req.query.limit) || 15)
      });
    }

    const user = requireUser(req, res);
    if (!user) return;
    res.json({
      success: true,
      stats: quizStore.getPlayerStats(user.id),
      history: quizStore.getPlayerMatchHistory(user.id, Number(req.query.limit) || 20)
    });
  });

  api.get('/quiz/history', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    res.json({
      success: true,
      history: quizStore.getPlayerMatchHistory(user.id, Number(req.query.limit) || 20)
    });
  });

  // Room Monster Quiz Battle yang masih aktif milik user (agar mudah rejoin)
  api.get('/quiz/active-room', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const room = quizEngine.getActiveRoomForUser(user.id);
    res.json({
      success: true,
      room
    });
  });

  // ==========================================
  // MANAJEMEN BANK SOAL (SIAP ADMIN PANEL)
  // ==========================================

  // Daftar soal untuk admin (menyertakan jawaban benar hanya bagi admin)
  api.get('/quiz/questions', (req, res) => {
    const admin = requireQuizAdmin(req, res);
    if (!admin) return;
    const category = typeof req.query.category === 'string' && req.query.category.trim()
      ? req.query.category.trim()
      : null;
    const activeOnly = req.query.activeOnly === 'true';
    res.json({
      success: true,
      questions: quizStore.listQuestions({ category, activeOnly, includeAnswer: true })
    });
  });

  api.post('/quiz/questions', (req, res) => {
    if (!quizWriteLimiter(req.ip)) {
      return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
    }
    const admin = requireQuizAdmin(req, res);
    if (!admin) return;
    const result = quizStore.saveQuestion(req.body || {});
    if (result.error) return res.status(400).json({ success: false, error: result.error });
    res.json({ success: true, question: result.question });
  });

  api.put('/quiz/questions/:id', (req, res) => {
    if (!quizWriteLimiter(req.ip)) {
      return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
    }
    const admin = requireQuizAdmin(req, res);
    if (!admin) return;
    const result = quizStore.saveQuestion({ ...(req.body || {}), id: req.params.id });
    if (result.error) return res.status(400).json({ success: false, error: result.error });
    res.json({ success: true, question: result.question });
  });

  api.patch('/quiz/questions/:id/active', (req, res) => {
    if (!quizWriteLimiter(req.ip)) {
      return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
    }
    const admin = requireQuizAdmin(req, res);
    if (!admin) return;
    const result = quizStore.setQuestionActive(req.params.id, req.body?.active !== false);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, question: result.question });
  });
}

module.exports = { registerQuizRoutes };

