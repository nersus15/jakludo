// Unified Payment Gateway Adapter untuk PlayGo
// Mendukung switching gateway dinamis melalui env PAYMENT_GATEWAY=midtrans | doku | duitku
// tanpa mengubah logika bisnis, transaksi database, atau alur frontend.
const { reloadDotEnvIfChanged } = require('../migrate');
const doku = require('./doku');
const duitku = require('./duitku');
const midtrans = require('./midtrans');

function getActiveGatewayName(preferred = null) {
  if (!preferred) reloadDotEnvIfChanged();
  const raw = String(preferred || process.env.PAYMENT_GATEWAY || 'midtrans').trim().toLowerCase();
  if (raw === 'duitku') return 'duitku';
  if (raw === 'doku') return 'doku';
  return 'midtrans';
}

function getGatewayAdapter(preferred = null) {
  const name = getActiveGatewayName(preferred);
  if (name === 'duitku') return duitku;
  if (name === 'doku') return doku;
  return midtrans;
}

function getActiveConfig(preferred = null) {
  const gw = getActiveGatewayName(preferred);
  if (gw === 'midtrans') {
    const cfg = midtrans.getMidtransConfig();
    return {
      ...cfg,
      gateway: 'midtrans',
      clientId: cfg.clientKey,
      merchantCode: cfg.merchantId || cfg.clientKey
    };
  }
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
  if (gw === 'midtrans') return midtrans.MIDTRANS_PAYMENT_METHODS;
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
  if (orderGateway === 'midtrans' || orderGateway === 'doku' || orderGateway === 'duitku') {
    return orderGateway;
  }

  const lowerHeaders = {};
  for (const [k, v] of Object.entries(headers || {})) {
    lowerHeaders[String(k).toLowerCase()] = Array.isArray(v) ? v[0] : v;
  }

  const explicitGw = String(payload?.gateway || '').toLowerCase();
  if (explicitGw === 'midtrans') return 'midtrans';
  if (explicitGw === 'duitku') return 'duitku';
  if (explicitGw === 'doku') return 'doku';

  // Ciri khas Midtrans: signature_key, transaction_status, atau payment_type
  const isMidtransShape =
    Boolean(payload?.signature_key) ||
    Boolean(payload?.transaction_status) ||
    Boolean(payload?.fraud_status);

  if (isMidtransShape) return 'midtrans';

  const headerSig = String(lowerHeaders['signature'] || '').trim();
  const isDokuShape =
    headerSig.startsWith('HMACSHA256=') ||
    Boolean(payload?.order?.invoice_number) ||
    Boolean(payload?.transaction?.status);

  if (isDokuShape) return 'doku';
  if (Boolean(payload?.merchantCode && payload?.merchantOrderId)) return 'duitku';

  return getActiveGatewayName();
}

function normalizeCallback(payload = {}, headers = {}, orderGateway = null) {
  const gw = detectCallbackGateway(payload, headers, orderGateway);
  if (gw === 'midtrans') {
    return midtrans.normalizeMidtransCallbackPayload(payload);
  }
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
  if (gw === 'midtrans') {
    return midtrans.verifyMidtransCallback(payload);
  }
  if (gw === 'doku') {
    return doku.verifyDokuCallback(payload, headers);
  }
  return duitku.verifyDuitkuCallback(payload);
}

async function checkStatus(orderId, orderGateway = null) {
  const gw = getActiveGatewayName(orderGateway);
  if (gw === 'midtrans') {
    return midtrans.checkMidtransStatus(orderId);
  }
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
  duitku,
  midtrans
};
