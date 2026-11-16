// Unified Payment Gateway Adapter untuk PlayGo
// Mendukung switching gateway dinamis melalui env PAYMENT_GATEWAY=doku | duitku
// tanpa mengubah logika bisnis, transaksi database, atau alur frontend.
const { reloadDotEnvIfChanged } = require('../migrate');
const doku = require('./doku');
const duitku = require('./duitku');

function getActiveGatewayName(preferred = null) {
  if (!preferred) reloadDotEnvIfChanged();
  const raw = String(preferred || process.env.PAYMENT_GATEWAY || 'doku').trim().toLowerCase();
  return raw === 'duitku' ? 'duitku' : 'doku';
}

function getGatewayAdapter(preferred = null) {
  return getActiveGatewayName(preferred) === 'duitku' ? duitku : doku;
}

function getActiveConfig(preferred = null) {
  const gw = getActiveGatewayName(preferred);
  if (gw === 'duitku') {
    const cfg = duitku.getDuitkuConfig();
    return {
      ...cfg,
      gateway: 'duitku',
      clientId: cfg.merchantCode
    };
  }
  const cfg = doku.getDokuConfig();
  return {
    ...cfg,
    gateway: 'doku'
  };
}

function getPaymentMethodsCatalog(preferred = null) {
  const gw = getActiveGatewayName(preferred);
  return gw === 'duitku' ? duitku.DUITKU_PAYMENT_METHODS : doku.DOKU_PAYMENT_METHODS;
}

async function getPaymentMethods(amount = 10000, preferred = null) {
  const gw = getActiveGatewayName(preferred);
  const adapter = getGatewayAdapter(gw);
  const res = await adapter.getPaymentMethods(amount);
  return {
    ...res,
    gateway: res.gateway || gw
  };
}

async function createInvoice(options = {}) {
  const gw = getActiveGatewayName(options.gateway);
  const adapter = getGatewayAdapter(gw);
  const invoice = await adapter.createInvoice(options);
  return {
    ...invoice,
    gateway: invoice.gateway || gw
  };
}

function detectCallbackGateway(payload = {}, headers = {}, orderGateway = null) {
  const lowerHeaders = {};
  for (const [k, v] of Object.entries(headers || {})) {
    lowerHeaders[String(k).toLowerCase()] = Array.isArray(v) ? v[0] : v;
  }

  const headerSig = String(lowerHeaders['signature'] || '').trim();
  const isDokuShape =
    headerSig.startsWith('HMACSHA256=') ||
    Boolean(payload?.order?.invoice_number) ||
    Boolean(payload?.transaction?.status) ||
    String(payload?.gateway || '').toLowerCase() === 'doku';

  if (isDokuShape) return 'doku';
  if (String(payload?.gateway || '').toLowerCase() === 'duitku') return 'duitku';
  if (orderGateway === 'doku' || orderGateway === 'duitku') return orderGateway;
  return getActiveGatewayName();
}

function normalizeCallback(payload = {}, headers = {}, orderGateway = null) {
  const gw = detectCallbackGateway(payload, headers, orderGateway);
  if (gw === 'doku') {
    return doku.normalizeDokuCallbackPayload(payload, headers);
  }
  return {
    gateway: 'duitku',
    merchantOrderId: String(
      payload?.merchantOrderId ||
      payload?.merchant_order_id ||
      payload?.order_id ||
      ''
    ).trim(),
    amount: payload?.amount ?? null,
    merchantCode: payload?.merchantCode ? String(payload.merchantCode) : null,
    resultCode: String(payload?.resultCode ?? ''),
    statusMessage: String(payload?.statusMessage || payload?.status || '').trim(),
    reference: payload?.reference ? String(payload.reference) : null,
    signature: payload?.signature ? String(payload.signature) : null,
    paymentMethod: String(payload?.paymentMethod || payload?.payment_method || 'duitku').trim()
  };
}

function verifyCallback(payload = {}, headers = {}, orderGateway = null) {
  const gw = detectCallbackGateway(payload, headers, orderGateway);
  if (gw === 'doku') {
    return doku.verifyDokuCallback(payload, headers);
  }
  return duitku.verifyDuitkuCallback(payload);
}

async function checkStatus(orderId, orderGateway = null) {
  const gw = getActiveGatewayName(orderGateway);
  if (gw === 'duitku') {
    return duitku.checkDuitkuStatus(orderId);
  }
  return doku.checkDokuStatus(orderId);
}

module.exports = {
  getActiveGatewayName,
  getGatewayAdapter,
  getActiveConfig,
  getPaymentMethodsCatalog,
  getPaymentMethods,
  createInvoice,
  detectCallbackGateway,
  normalizeCallback,
  verifyCallback,
  checkStatus,
  doku,
  duitku
};
