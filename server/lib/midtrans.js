// Integrasi Midtrans Payment Gateway untuk Topup Diamonds / Poin PlayGo
const crypto = require('crypto');
const { loadDotEnv } = require('../migrate');

const DIAMOND_PACKAGES = {
  diamond_100: {
    id: 'diamond_100',
    name: '100 Diamonds',
    diamonds: 100,
    price: 50000,
    formattedPrice: 'Rp 50.000',
    badge: 'Starter',
    icon: 'diamond',
    description: '100 Diamonds (Poin PlayGo) untuk membeli perlengkapan permainan.'
  },
  diamond_300: {
    id: 'diamond_300',
    name: '300 Diamonds',
    diamonds: 300,
    price: 150000,
    formattedPrice: 'Rp 150.000',
    badge: 'Paling Populer',
    icon: 'diamond',
    description: '300 Diamonds (Poin PlayGo) untuk perisai, force return & hint kuis.'
  },
  diamond_550: {
    id: 'diamond_550',
    name: '550 Diamonds',
    diamonds: 550,
    price: 500000,
    formattedPrice: 'Rp 500.000',
    badge: 'Paket Sultan',
    icon: 'crown',
    description: '550 Diamonds (Poin PlayGo) paket terbesar untuk pemain setia PlayGo.'
  }
};

function getMidtransConfig() {
  loadDotEnv(true);
  const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
  const clientKey = (process.env.MIDTRANS_CLIENT_KEY || '').trim();
  const isProduction =
    process.env.MIDTRANS_IS_PRODUCTION === '1' ||
    process.env.MIDTRANS_IS_PRODUCTION === 'true';

  const snapApiUrl = isProduction
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

  const snapJsUrl = isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

  const statusApiBase = isProduction
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2';

  return {
    serverKey,
    clientKey,
    isProduction,
    isConfigured: Boolean(serverKey && clientKey),
    snapApiUrl,
    snapJsUrl,
    statusApiBase
  };
}

async function createSnapTransaction({ orderId, pkg, user }) {
  const config = getMidtransConfig();

  // Jika kunci server Midtrans belum diset di .env atau dalam environment uji, aktifkan mode simulasi otomatis
  if (!config.serverKey) {
    return {
      success: true,
      token: `sim_snap_${orderId}`,
      redirectUrl: '#simulated-payment',
      isSimulation: true,
      clientKey: config.clientKey || 'SB-Mid-client-mock',
      snapJsUrl: config.snapJsUrl
    };
  }

  const authHeader = 'Basic ' + Buffer.from(config.serverKey + ':').toString('base64');
  const payload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: pkg.price
    },
    item_details: [
      {
        id: pkg.id,
        price: pkg.price,
        quantity: 1,
        name: `${pkg.name} (${pkg.diamonds} Poin PlayGo)`
      }
    ],
    customer_details: {
      first_name: user.name || user.username,
      email: user.email || `${user.username}@playgo.game`
    }
  };

  const res = await fetch(config.snapApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    const errorMsg = data?.error_messages?.join(', ') || data?.message || `Midtrans API Error (${res.status})`;
    throw new Error(errorMsg);
  }

  return {
    success: true,
    token: data.token,
    redirectUrl: data.redirect_url,
    isSimulation: false,
    clientKey: config.clientKey,
    snapJsUrl: config.snapJsUrl
  };
}

function verifySignature({ orderId, statusCode, grossAmount, signatureKey }) {
  const config = getMidtransConfig();
  if (!config.serverKey) return false;

  const raw = `${orderId}${statusCode}${grossAmount}${config.serverKey}`;
  const expectedSignature = crypto.createHash('sha512').update(raw).digest('hex');
  return expectedSignature.toLowerCase() === String(signatureKey || '').toLowerCase();
}

async function checkMidtransStatus(orderId) {
  const config = getMidtransConfig();
  if (!config.serverKey) return null;

  const authHeader = 'Basic ' + Buffer.from(config.serverKey + ':').toString('base64');
  const url = `${config.statusApiBase}/${encodeURIComponent(orderId)}/status`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: authHeader
    }
  });

  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

module.exports = {
  DIAMOND_PACKAGES,
  getMidtransConfig,
  createSnapTransaction,
  verifySignature,
  checkMidtransStatus
};

