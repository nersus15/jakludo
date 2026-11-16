// REST API Dual Currency (Coins + Diamonds), Konversi, Multi-Gateway Top-Up (DOKU/Duitku), Ludo Skin Shop & Admin Economy.
const express = require('express');
const db = require('../db');
const economy = require('./store');
const paymentGateway = require('../lib/paymentGateway');
const { createLimiter } = require('../lib/limiter');

function bearerToken(req) {
  return (
    String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() ||
    String(req.query?.token || '').trim()
  );
}

function resolveUser(req) {
  const token = bearerToken(req) || String(req.body?.token || '');
  if (!token) return null;
  return db.getUserByToken(token);
}

function requireUser(req, res, message = 'Silakan login terlebih dahulu.') {
  const user = resolveUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: message });
    return null;
  }
  return user;
}

function requireAdmin(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;
  if (!db.isUserAdmin(user)) {
    res.status(403).json({ success: false, error: 'Akses ditolak. Hanya admin yang dapat mengakses fitur ini.' });
    return null;
  }
  return user;
}

function createSimpleLimiter({ max = 25, windowMs = 60 * 1000 } = {}) {
  const allow = createLimiter({ windowMs, max });
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_IN_TEST !== '1') {
      return next();
    }
    const user = resolveUser(req);
    const key = user?.id ? `u:${user.id}` : `ip:${req.ip || 'anon'}`;
    if (!allow(key)) {
      return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
    }
    next();
  };
}

const mutationLimiter = createSimpleLimiter({ max: 30, windowMs: 60 * 1000 });

const asyncRoute = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = Number(err.status) || 500;
    if (status >= 500) {
      console.error('[ECONOMY ROUTE ERROR]', err);
    }
    res.status(status).json({
      success: false,
      error: status >= 500 ? 'Terjadi kesalahan pada server ekonomi.' : err.message
    });
  }
};

function registerEconomyRoutes(api) {
  const router = express.Router();
  router.use(express.urlencoded({ extended: true, limit: '20kb' }));

  // ==========================================
  // PLAYER ECONOMY, WALLET & CONVERSION
  // ==========================================

  router.get('/economy/wallet', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    res.json({
      success: true,
      wallet: economy.formatWalletResponse(user.id),
      user: db.sanitizeUser(user)
    });
  }));

  router.get('/economy/transactions', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const txType = String(req.query?.txType || '').trim();
    const limit = Number(req.query?.limit || 50);
    const history = economy.listUserTransactions(user.id, { txType, limit });
    res.json({
      success: true,
      wallet: economy.formatWalletResponse(user.id),
      ...history
    });
  }));

  router.post('/economy/convert', mutationLimiter, asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const { diamonds, direction, idempotencyKey } = req.body || {};
    const result =
      String(direction || '').trim().toLowerCase() === 'coins_to_diamonds'
        ? await economy.convertCoinsToDiamonds({
            userId: user.id,
            diamonds,
            idempotencyKey
          })
        : await economy.convertDiamondsToCoins({
            userId: user.id,
            diamonds,
            idempotencyKey
          });
    res.json(result);
  }));

  // ==========================================
  // DIAMOND TOP-UP & MULTI-GATEWAY (DOKU / DUITKU)
  // ==========================================

  router.get('/economy/packages', asyncRoute(async (req, res) => {
    const user = resolveUser(req);
    const activeGateway = paymentGateway.getActiveGatewayName();
    res.json({
      success: true,
      gateway: activeGateway,
      packages: economy.listDiamondPackages({ includeInactive: false }),
      paymentMethods: paymentGateway.getPaymentMethodsCatalog(activeGateway),
      settings: economy.getEconomySettings(),
      wallet: user ? economy.formatWalletResponse(user.id) : null
    });
  }));

  router.get('/economy/payment-methods', asyncRoute(async (req, res) => {
    const amount = Number(req.query?.amount || 10000);
    const result = await paymentGateway.getPaymentMethods(amount);
    res.json(result);
  }));

  router.get('/economy/topup/history', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const limit = Number(req.query?.limit || 30);
    res.json({
      success: true,
      orders: economy.listPaymentOrdersForUser(user.id, { limit })
    });
  }));

  router.post('/economy/topup/create', mutationLimiter, asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const { packageId, paymentMethod } = req.body || {};
    const host = req.get('host') || '';
    const result = await economy.createDiamondTopupOrder({
      userId: user.id,
      packageId: String(packageId || '').trim(),
      paymentMethod: String(paymentMethod || '').trim(),
      host
    });
    res.json(result);
  }));

  // Fallback GET jika browser user diarahkan ke URL callback (Back to Merchant)
  router.get('/economy/topup/callback', (req, res) => {
    const targetUrl = process.env.PUBLIC_URL || process.env.APP_URL || '/';
    return res.redirect(302, targetUrl);
  });

  // Server-to-server payment gateway callback webhook (DOKU / Duitku)
  router.post('/economy/topup/callback', asyncRoute(async (req, res) => {
    const payload = req.body || {};
    const headers = {
      ...(req.headers || {}),
      'x-resolved-target': String(req.originalUrl || '/api/economy/topup/callback').split('?')[0]
    };
    const result = await economy.handleDuitkuDiamondCallback(payload, headers);
    res.status(result.httpStatus || 200).json(result);
  }));

  router.get('/economy/topup/status/:orderId', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await economy.getAndVerifyOrderStatus({
      orderId: String(req.params.orderId || '').trim(),
      requesterUser: user
    });
    res.json({ success: true, ...result });
  }));

  router.post('/economy/topup/verify', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const orderId = String(req.body?.orderId || '').trim();
    const result = await economy.getAndVerifyOrderStatus({
      orderId,
      requesterUser: user
    });
    res.json({ success: true, ...result });
  }));

  router.post('/economy/topup/cancel', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const orderId = String(req.body?.orderId || '').trim();
    const result = await economy.cancelPendingOrder({ orderId, userId: user.id });
    res.json(result);
  }));

  // ==========================================
  // JAKLUDO SKIN SHOP & PLAYER INVENTORY
  // ==========================================

  router.get('/economy/skins', asyncRoute(async (req, res) => {
    const user = resolveUser(req);
    const skins = economy.listLudoSkins({
      userId: user?.id || null,
      includeInactive: false
    });
    res.json({
      success: true,
      skins,
      equippedSkinId: user ? economy.getUserSkinInventory(user.id).equippedSkinId : null,
      wallet: user ? economy.formatWalletResponse(user.id) : null
    });
  }));

  router.get('/economy/skins/inventory', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    res.json({
      success: true,
      ...economy.getUserSkinInventory(user.id),
      wallet: economy.formatWalletResponse(user.id)
    });
  }));

  router.post('/economy/skins/purchase', mutationLimiter, asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const { skinId, idempotencyKey } = req.body || {};
    const result = await economy.purchaseLudoSkin({
      userId: user.id,
      skinId: String(skinId || '').trim(),
      idempotencyKey
    });
    res.json(result);
  }));

  router.post('/economy/skins/equip', mutationLimiter, asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const { skinId } = req.body || {};
    const result = await economy.equipLudoSkin({
      userId: user.id,
      skinId: skinId === undefined ? null : skinId
    });
    res.json(result);
  }));

  // ==========================================
  // ADMIN ECONOMY DASHBOARD ENDPOINTS
  // ==========================================

  router.get('/admin/economy/overview', asyncRoute(async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const limit = Number(req.query?.limit || 50);
    const txType = String(req.query?.txType || '').trim();
    res.json({
      success: true,
      ...economy.getAdminOverview({ limit, txType })
    });
  }));

  router.put('/admin/economy/settings', asyncRoute(async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const settings = await economy.updateEconomySettings({
      ...req.body,
      adminUser: admin
    });
    res.json({ success: true, settings });
  }));

  router.post('/admin/economy/packages', asyncRoute(async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const pkg = await economy.upsertDiamondPackage(req.body || {});
    res.json({ success: true, package: pkg });
  }));

  router.put('/admin/economy/packages/:id', asyncRoute(async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const pkg = await economy.upsertDiamondPackage({
      ...(req.body || {}),
      id: req.params.id
    });
    res.json({ success: true, package: pkg });
  }));

  router.post('/admin/economy/skins', asyncRoute(async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const skin = await economy.upsertLudoSkin(req.body || {});
    res.json({ success: true, skin });
  }));

  router.put('/admin/economy/skins/:id', asyncRoute(async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const skin = await economy.upsertLudoSkin({
      ...(req.body || {}),
      id: req.params.id
    });
    res.json({ success: true, skin });
  }));

  router.post('/admin/economy/wallets/adjust', asyncRoute(async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const result = await economy.adminAdjustDiamonds({
      targetUserId: req.body?.userId || req.body?.targetUserId || req.body?.username,
      amount: req.body?.amount,
      reason: req.body?.reason,
      txType: req.body?.txType,
      adminUser: admin
    });
    res.json(result);
  }));

  router.get('/admin/economy/transactions', asyncRoute(async (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const overview = economy.getAdminOverview({
      limit: Number(req.query?.limit || 100),
      txType: String(req.query?.txType || '').trim()
    });
    res.json({
      success: true,
      transactions: overview.transactions,
      coinConversions: overview.coinConversions,
      paymentOrders: overview.paymentOrders,
      callbackLogs: overview.callbackLogs
    });
  }));

  api.use(router);
}

module.exports = { registerEconomyRoutes };
