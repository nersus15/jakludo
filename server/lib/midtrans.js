// Integrasi Midtrans Core API (Direct Charge API v2) Sandbox untuk PlayGo
// Dokumentasi resmi: https://docs.midtrans.com/reference/core-api-overview
// - Charge API      : POST /v2/charge
// - Status API      : GET /v2/{order_id}/status
// - Cancel API      : POST /v2/{order_id}/cancel
// - Callback Verify : SHA512(order_id + status_code + gross_amount + ServerKey)
// PENTING: Menggunakan CORE API, BUKAN SNAP (tanpa popup snap, tanpa redirect snap)!
const crypto = require('crypto');
const { reloadDotEnvIfChanged } = require('../migrate');

// 8 Metode Pembayaran Resmi yang didukung Midtrans Core API untuk PlayGo
const MIDTRANS_PAYMENT_METHODS = [
  {
    code: 'bca_va',
    midtransType: 'bank_transfer',
    bank: 'BCA',
    label: 'BCA Virtual Account',
    category: 'va',
    badge: 'Populer',
    description: 'Transfer via myBCA, BCA Mobile, KlikBCA, atau ATM BCA.'
  },
  {
    code: 'bni_va',
    midtransType: 'bank_transfer',
    bank: 'BNI',
    label: 'BNI Virtual Account',
    category: 'va',
    badge: 'VA',
    description: 'Transfer via Wondr by BNI, BNI Mobile, atau ATM BNI.'
  },
  {
    code: 'bri_va',
    midtransType: 'bank_transfer',
    bank: 'BRI',
    label: 'BRI Virtual Account (BRIVA)',
    category: 'va',
    badge: 'VA',
    description: 'Transfer via BRImo, Internet Banking BRI, atau ATM BRI.'
  },
  {
    code: 'qris',
    midtransType: 'qris',
    bank: 'QRIS',
    label: 'QRIS (Semua E-Wallet & Bank)',
    category: 'qris',
    badge: 'Instan',
    description: 'Scan QR dari GoPay, OVO, DANA, ShopeePay, BCA Mobile, Livin, dll.'
  },
  {
    code: 'gopay',
    midtransType: 'gopay',
    bank: 'GoPay',
    label: 'GoPay E-Wallet',
    category: 'ewallet',
    badge: 'Instan',
    description: 'Bayar instan via aplikasi GoPay atau scan kode QR.'
  },
  {
    code: 'shopeepay',
    midtransType: 'shopeepay',
    bank: 'ShopeePay',
    label: 'ShopeePay E-Wallet',
    category: 'ewallet',
    badge: 'Instan',
    description: 'Bayar langsung melalui aplikasi Shopee / ShopeePay.'
  },
  {
    code: 'dana',
    midtransType: 'qris',
    bank: 'DANA',
    label: 'DANA E-Wallet',
    category: 'ewallet',
    badge: 'E-Wallet',
    description: 'Scan QRIS resmi PlayGo langsung dari aplikasi DANA kamu.'
  },
  {
    code: 'ovo',
    midtransType: 'qris',
    bank: 'OVO',
    label: 'OVO E-Wallet',
    category: 'ewallet',
    badge: 'E-Wallet',
    description: 'Scan QRIS resmi PlayGo langsung dari aplikasi OVO kamu.'
  }
];

function findPaymentMethodMeta(code) {
  const clean = String(code || 'qris').trim().toLowerCase();
  const aliasMap = {
    bca: 'bca_va',
    bc: 'bca_va',
    bni: 'bni_va',
    i1: 'bni_va',
    bri: 'bri_va',
    br: 'bri_va',
    sp: 'qris',
    qr: 'qris',
    gp: 'gopay',
    sa: 'shopeepay',
    shopee: 'shopeepay',
    da: 'dana',
    ov: 'ovo'
  };

  const resolvedCode = aliasMap[clean] || clean;
  return (
    MIDTRANS_PAYMENT_METHODS.find(m => m.code.toLowerCase() === resolvedCode) ||
    MIDTRANS_PAYMENT_METHODS.find(m => m.midtransType === resolvedCode) ||
    MIDTRANS_PAYMENT_METHODS[3] // default QRIS
  );
}

function getMidtransConfig() {
  reloadDotEnvIfChanged();
  const serverKey = String(process.env.MIDTRANS_SERVER_KEY || '').trim();
  const clientKey = String(process.env.MIDTRANS_CLIENT_KEY || '').trim();
  const merchantId = String(process.env.MIDTRANS_MERCHANT_ID || '').trim();
  const isProduction =
    process.env.MIDTRANS_IS_PRODUCTION === 'true' ||
    process.env.MIDTRANS_IS_PRODUCTION === '1';

  const baseUrl = isProduction
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com';

  return {
    gateway: 'midtrans',
    serverKey,
    clientKey,
    merchantId,
    isProduction,
    isConfigured: Boolean(serverKey),
    baseUrl,
    chargeUrl: `${baseUrl}/v2/charge`,
    statusUrl: orderId => `${baseUrl}/v2/${encodeURIComponent(orderId)}/status`,
    cancelUrl: orderId => `${baseUrl}/v2/${encodeURIComponent(orderId)}/cancel`
  };
}

function buildQrImageUrl(qrString) {
  if (!qrString) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(qrString)}`;
}

async function getPaymentMethods(amount = 10000) {
  return {
    success: true,
    gateway: 'midtrans',
    source: 'midtrans_core_catalog',
    amount: Number(amount) || 10000,
    methods: MIDTRANS_PAYMENT_METHODS
  };
}

/**
 * Buat transaksi langsung via Midtrans Core API v2 Charge (TANPA SNAP)
 * Endpoint: POST https://api.sandbox.midtrans.com/v2/charge
 * Auth: Basic base64(serverKey + ':')
 */
async function createInvoice({
  orderId,
  pkg,
  user,
  host = '',
  callbackPath = '/api/topup/notification',
  returnUrlOverride = '',
  paymentMethod = 'qris'
}) {
  const config = getMidtransConfig();
  const unitPrice = Number(pkg?.price ?? pkg?.priceIdr ?? pkg?.amountIdr ?? 0);
  const totalDiamonds = Number(pkg?.totalDiamonds ?? pkg?.diamonds ?? pkg?.coins ?? 0);
  const methodMeta = findPaymentMethodMeta(paymentMethod);
  const paymentAmount = Math.trunc(unitPrice);

  const isDummyKey =
    !config.serverKey ||
    config.serverKey.includes('sandbox-key') ||
    config.serverKey.includes('test-key') ||
    config.serverKey.startsWith('SB-Mid-server-playgo');

  const shouldMockInTest =
    (process.env.NODE_ENV === 'test' && process.env.MIDTRANS_LIVE_TEST !== '1') ||
    process.env.MIDTRANS_SIMULATION === 'true' ||
    isDummyKey;

  // Fallback simulasi jika dalam test environment atau key belum diisi di sandbox
  if (shouldMockInTest) {
    const isVa = methodMeta.category === 'va';
    const isQris = methodMeta.code === 'qris' || methodMeta.code === 'dana' || methodMeta.code === 'ovo';
    const isGopay = methodMeta.code === 'gopay';
    const isShopee = methodMeta.code === 'shopeepay';

    let mockVa = null;
    if (isVa) {
      if (methodMeta.code === 'bca_va') mockVa = `70070${String(Date.now()).slice(-8)}`;
      else if (methodMeta.code === 'bni_va') mockVa = `98801${String(Date.now()).slice(-8)}`;
      else if (methodMeta.code === 'bri_va') mockVa = `01234${String(Date.now()).slice(-8)}`;
      else mockVa = `88000${String(Date.now()).slice(-8)}`;
    }

    const mockQr = isQris || isGopay
      ? `00020101021226590014ID.LINKAJA.WWW01189360091800215505920208215505920303UMI520458125303360540${paymentAmount}5802ID5912PLAYGO STORE6007JAKARTA62200116${orderId}6304ABCD`
      : null;

    const mockDeeplink = isGopay
      ? `https://simulator.sandbox.midtrans.com/gopay/partner/app/payment-pin?id=${orderId}`
      : isShopee
      ? `https://simulator.sandbox.midtrans.com/shopeepay/partner/app/payment-pin-test?id=${orderId}`
      : null;

    return {
      success: true,
      gateway: 'midtrans',
      orderId,
      reference: `midtrans_tx_${orderId}`,
      paymentUrl: null, // PENTING: Tidak ada SNAP redirect/popup
      vaNumber: mockVa,
      qrString: mockQr,
      qrCodeUrl: buildQrImageUrl(mockQr),
      deeplinkUrl: mockDeeplink,
      actions: [
        ...(mockDeeplink ? [{ name: 'deeplink-redirect', method: 'GET', url: mockDeeplink }] : []),
        ...(mockQr ? [{ name: 'generate-qr-code', method: 'GET', url: buildQrImageUrl(mockQr) }] : [])
      ],
      paymentMethod: methodMeta.code,
      paymentMethodName: methodMeta.label,
      paymentCategory: methodMeta.category,
      bank: methodMeta.bank || null,
      statusCode: '201',
      statusMessage: 'SUCCESS (MIDTRANS CORE API SIMULATION)',
      grossAmount: paymentAmount,
      diamonds: totalDiamonds,
      status: 'pending',
      isSimulation: true
    };
  }

  if (!config.isConfigured) {
    throw new Error(
      'Sistem pembayaran Midtrans Core API belum dikonfigurasi. Pastikan MIDTRANS_SERVER_KEY telah diisi di file .env.'
    );
  }

  const configuredBaseUrl = String(process.env.PUBLIC_URL || process.env.APP_URL || '').trim().replace(/\/+$/, '');
  const sanitizedHost = String(host || '').replace(/[^a-zA-Z0-9.:-]/g, '');

  let returnUrl = returnUrlOverride;
  if (!returnUrl && configuredBaseUrl) returnUrl = configuredBaseUrl;
  if (!returnUrl && sanitizedHost) {
    const proto = sanitizedHost.includes('localhost') || sanitizedHost.startsWith('127.0.0.1') ? 'http' : 'https';
    returnUrl = `${proto}://${sanitizedHost}`;
  }
  if (!returnUrl) returnUrl = 'https://playgo.devgate.my.id';

  const cleanUsername = String(user?.username || 'player').replace(/[^a-zA-Z0-9._-]/g, '') || 'player';
  const cleanCustomerName =
    String(user?.name || user?.username || 'PlayGo Player')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .trim()
      .slice(0, 30) || 'PlayGo Player';
  const email = user?.email || `${cleanUsername}@playgo.game`;
  const phoneNumber = user?.phone || '081234567890';
  const productTitle = `${pkg.name} (${totalDiamonds} ${callbackPath.includes('economy') ? 'Diamonds' : 'Coins'})`;

  // Susun payload Core API charge sesuai tipe pembayaran
  const chargePayload = {
    payment_type: methodMeta.midtransType,
    transaction_details: {
      order_id: orderId,
      gross_amount: paymentAmount
    },
    customer_details: {
      first_name: cleanCustomerName,
      email,
      phone: phoneNumber
    },
    item_details: [
      {
        id: String(pkg?.id || 'diamonds_topup').slice(0, 50),
        price: paymentAmount,
        quantity: 1,
        name: productTitle.slice(0, 50)
      }
    ]
  };

  if (methodMeta.midtransType === 'bank_transfer') {
    chargePayload.bank_transfer = {
      bank: methodMeta.bank.toLowerCase()
    };
  } else if (methodMeta.midtransType === 'qris') {
    chargePayload.qris = {
      acquirer: 'gopay'
    };
  } else if (methodMeta.midtransType === 'gopay') {
    chargePayload.gopay = {
      enable_callback: true,
      callback_url: returnUrl
    };
  } else if (methodMeta.midtransType === 'shopeepay') {
    chargePayload.shopeepay = {
      callback_url: returnUrl
    };
  }

  const basicAuthHeader = `Basic ${Buffer.from(`${config.serverKey}:`).toString('base64')}`;

  const res = await fetch(config.chargeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: basicAuthHeader
    },
    body: JSON.stringify(chargePayload)
  });

  const rawText = await res.text();
  let data = {};
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { status_message: rawText };
  }

  if (!res.ok || (data.status_code && !['200', '201'].includes(String(data.status_code)))) {
    const errorMsg =
      data.status_message ||
      (Array.isArray(data.validation_messages) ? data.validation_messages.join(', ') : '') ||
      rawText ||
      `Midtrans Core API Error (${res.status})`;
    throw new Error(errorMsg);
  }

  // Parse VA Numbers
  let vaNumber = null;
  if (Array.isArray(data.va_numbers) && data.va_numbers.length > 0) {
    vaNumber = data.va_numbers[0].va_number || null;
  } else if (data.briva_number) {
    vaNumber = data.briva_number;
  } else if (data.permata_va_number) {
    vaNumber = data.permata_va_number;
  } else if (data.bill_key) {
    vaNumber = `${data.biller_code || ''} ${data.bill_key}`;
  }

  // Parse QRIS
  const qrString = data.qr_string || null;

  // Parse Actions (Deeplink, QR image)
  const actions = Array.isArray(data.actions) ? data.actions : [];
  const deeplinkAction = actions.find(
    a => a.name === 'deeplink-redirect' || a.name === 'deeplink'
  );
  const qrAction = actions.find(a => a.name === 'generate-qr-code');

  const deeplinkUrl = deeplinkAction?.url || null;
  const qrCodeUrl = qrAction?.url || (qrString ? buildQrImageUrl(qrString) : null);

  return {
    success: true,
    gateway: 'midtrans',
    orderId,
    reference: data.transaction_id || null,
    paymentUrl: null, // STRICTLY CORE API: no snap redirect
    vaNumber,
    qrString,
    qrCodeUrl,
    deeplinkUrl,
    actions,
    paymentMethod: methodMeta.code,
    paymentMethodName: methodMeta.label,
    paymentCategory: methodMeta.category,
    bank: methodMeta.bank || null,
    statusCode: String(data.status_code || '201'),
    statusMessage: data.status_message || 'SUCCESS',
    grossAmount: Number(data.gross_amount || paymentAmount),
    diamonds: totalDiamonds,
    status: 'pending'
  };
}

/**
 * Verifikasi signature webhook notifikasi dari Midtrans secara aman (constant-time)
 * Rumus signature webhook Midtrans:
 * SHA512(order_id + status_code + gross_amount + ServerKey)
 */
function verifyMidtransCallback(payload) {
  const config = getMidtransConfig();
  const orderId = String(payload?.order_id || payload?.orderId || '').trim();
  const statusCode = String(payload?.status_code || payload?.statusCode || '').trim();
  const grossAmount = String(payload?.gross_amount || payload?.grossAmount || '').trim();
  const signatureKey = String(payload?.signature_key || payload?.signature || '').trim();

  if (!signatureKey || !orderId || !statusCode || !grossAmount || !config.serverKey) {
    return false;
  }

  const hashPayload = `${orderId}${statusCode}${grossAmount}${config.serverKey}`;
  const expectedSignature = crypto.createHash('sha512').update(hashPayload).digest('hex');

  try {
    const receivedBuf = Buffer.from(signatureKey, 'utf-8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    return (
      receivedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(receivedBuf, expectedBuf)
    );
  } catch {
    return false;
  }
}

/**
 * Normalisasi payload callback webhook Midtrans ke format standar PlayGo
 */
function normalizeMidtransCallbackPayload(payload) {
  const orderId = String(payload?.order_id || payload?.orderId || '').trim();
  const transactionStatus = String(payload?.transaction_status || '').toLowerCase().trim();
  const fraudStatus = String(payload?.fraud_status || '').toLowerCase().trim();
  const paymentType = String(payload?.payment_type || '').toLowerCase().trim();
  const statusCode = String(payload?.status_code || '').trim();

  let resultCode = '01'; // Default: PENDING
  let statusMessage = payload?.status_message || transactionStatus || 'PENDING';

  if (transactionStatus === 'settlement') {
    resultCode = '00';
    statusMessage = 'SUCCESS';
  } else if (transactionStatus === 'capture') {
    if (fraudStatus === 'accept' || !fraudStatus) {
      resultCode = '00';
      statusMessage = 'SUCCESS';
    } else {
      resultCode = '02';
      statusMessage = `CAPTURE_${fraudStatus.toUpperCase()}`;
    }
  } else if (['deny', 'cancel', 'expire', 'failure'].includes(transactionStatus)) {
    resultCode = '02';
    statusMessage = transactionStatus.toUpperCase();
  }

  return {
    gateway: 'midtrans',
    merchantOrderId: orderId,
    amount: payload?.gross_amount ? Number(payload.gross_amount) : null,
    merchantCode: payload?.merchant_id || null,
    resultCode,
    statusCode: resultCode,
    statusMessage,
    reference: payload?.transaction_id || null,
    signature: payload?.signature_key || null,
    paymentMethod: paymentType || 'midtrans',
    rawStatus: transactionStatus,
    rawFraudStatus: fraudStatus
  };
}

/**
 * Cek status transaksi via Midtrans Status API v2
 * GET https://api.sandbox.midtrans.com/v2/{order_id}/status
 */
async function checkMidtransStatus(orderId) {
  const config = getMidtransConfig();
  const isDummyKey =
    !config.serverKey ||
    config.serverKey.includes('sandbox-key') ||
    config.serverKey.includes('test-key') ||
    config.serverKey.startsWith('SB-Mid-server-playgo');

  if (!config.isConfigured || process.env.NODE_ENV === 'test' || isDummyKey) {
    return {
      statusCode: '01',
      status: '01',
      resultCode: '01',
      statusMessage: 'PENDING_SIMULATION',
      amount: null
    };
  }

  try {
    const basicAuthHeader = `Basic ${Buffer.from(`${config.serverKey}:`).toString('base64')}`;
    const res = await fetch(config.statusUrl(orderId), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: basicAuthHeader
      }
    });

    if (!res.ok) {
      return {
        statusCode: '01',
        status: '01',
        resultCode: '01',
        statusMessage: `Midtrans Status Error (${res.status})`
      };
    }

    const data = await res.json();
    const transactionStatus = String(data?.transaction_status || '').toLowerCase().trim();
    const fraudStatus = String(data?.fraud_status || '').toLowerCase().trim();

    let resultCode = '01';
    if (transactionStatus === 'settlement') {
      resultCode = '00';
    } else if (transactionStatus === 'capture' && (fraudStatus === 'accept' || !fraudStatus)) {
      resultCode = '00';
    } else if (['deny', 'cancel', 'expire', 'failure'].includes(transactionStatus)) {
      resultCode = '02';
    }

    return {
      statusCode: resultCode,
      status: resultCode,
      resultCode,
      statusMessage: data.status_message || transactionStatus.toUpperCase(),
      amount: data.gross_amount ? Number(data.gross_amount) : null,
      raw: data
    };
  } catch (err) {
    console.warn('[MIDTRANS CHECK STATUS ERROR]', err.message);
    return {
      statusCode: '01',
      status: '01',
      resultCode: '01',
      statusMessage: err.message
    };
  }
}

module.exports = {
  MIDTRANS_PAYMENT_METHODS,
  findPaymentMethodMeta,
  getMidtransConfig,
  getPaymentMethods,
  createInvoice,
  verifyMidtransCallback,
  normalizeMidtransCallbackPayload,
  checkMidtransStatus,
  buildQrImageUrl
};
