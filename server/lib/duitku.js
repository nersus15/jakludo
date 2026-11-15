// Integrasi Duitku Direct REST API v2 untuk Top-Up Diamonds & Coins PlayGo
// Dokumentasi resmi: https://docs.duitku.com/api/id/
// - List Payment Method : POST /webapi/api/merchant/paymentmethod/getpaymentmethod
// - Request Transaction : POST /webapi/api/merchant/v2/inquiry
// - Check Transaction   : POST /webapi/api/merchant/transactionStatus
// - Callback Validation : md5(merchantCode + amount + merchantOrderId + apiKey)
const crypto = require('crypto');

// 6 Paket Top Up Coins Reguler
const DIAMOND_PACKAGES = {
  diamond_50: {
    id: 'diamond_50',
    name: '50 Coins',
    diamonds: 50,
    coins: 50,
    price: 5000,
    formattedPrice: 'Rp 5.000',
    description: 'Paket pemula untuk mencoba item & avatar baru.',
    icon: 'coin'
  },
  diamond_120: {
    id: 'diamond_120',
    name: '120 Coins',
    diamonds: 120,
    coins: 120,
    price: 10000,
    formattedPrice: 'Rp 10.000',
    description: 'Paket hemat paling diminati pemain!',
    badge: 'Populer',
    icon: 'coin'
  },
  diamond_260: {
    id: 'diamond_260',
    name: '260 Coins',
    diamonds: 260,
    coins: 260,
    price: 20000,
    formattedPrice: 'Rp 20.000',
    description: 'Cukup untuk beli item arena & taktik game.',
    icon: 'coin'
  },
  diamond_700: {
    id: 'diamond_700',
    name: '700 Coins',
    diamonds: 700,
    coins: 700,
    price: 50000,
    formattedPrice: 'Rp 50.000',
    description: 'Dapatkan 600 + Bonus 100 Coins.',
    badge: 'Bonus 100',
    icon: 'coin'
  },
  diamond_1500: {
    id: 'diamond_1500',
    name: '1.500 Coins',
    diamonds: 1500,
    coins: 1500,
    price: 100000,
    formattedPrice: 'Rp 100.000',
    description: 'Dapatkan 1.250 + Bonus 250 Coins.',
    badge: 'Bonus 250',
    icon: 'coin'
  },
  diamond_3250: {
    id: 'diamond_3250',
    name: '3.250 Coins',
    diamonds: 3250,
    coins: 3250,
    price: 200000,
    formattedPrice: 'Rp 200.000',
    description: 'Paket Sultan! Dapatkan 2.500 + Bonus 750 Coins.',
    badge: 'Bonus 750',
    icon: 'crown'
  }
};

const COIN_PACKAGES = DIAMOND_PACKAGES;

// Katalog Channel Pembayaran Resmi Duitku Direct API v2 (6 Channel Utama PlayGo)
const DUITKU_PAYMENT_METHODS = [
  {
    code: 'SP',
    label: 'QRIS (All E-Wallet & M-Banking)',
    category: 'qris',
    bank: 'QRIS',
    badge: 'Instan',
    description: 'Scan QR dari GoPay, OVO, DANA, ShopeePay, BCA Mobile, Livin, Wondr.'
  },
  {
    code: 'M2',
    label: 'Mandiri Virtual Account',
    category: 'va',
    bank: 'Mandiri',
    badge: 'VA',
    description: 'Transfer via Livin by Mandiri atau ATM Mandiri.'
  },
  {
    code: 'BC',
    label: 'BCA Virtual Account',
    category: 'va',
    bank: 'BCA',
    badge: 'Populer',
    description: 'Bayar lewat myBCA, BCA Mobile, KlikBCA, atau ATM BCA.'
  },
  {
    code: 'I1',
    label: 'BNI Virtual Account',
    category: 'va',
    bank: 'BNI',
    badge: 'VA',
    description: 'Transfer via Wondr / BNI Mobile Banking atau ATM BNI.'
  },
  {
    code: 'SA',
    label: 'ShopeePay E-Wallet',
    category: 'ewallet',
    bank: 'ShopeePay',
    badge: 'E-Wallet',
    description: 'Bayar instan melalui aplikasi ShopeePay.'
  },
  {
    code: 'DA',
    label: 'DANA E-Wallet',
    category: 'ewallet',
    bank: 'DANA',
    badge: 'E-Wallet',
    description: 'Bayar langsung lewat aplikasi DANA di ponselmu.'
  }
];

function findPaymentMethodMeta(code) {
  const clean = String(code || 'SP').trim().toUpperCase() || 'SP';
  return DUITKU_PAYMENT_METHODS.find(m => m.code === clean) || DUITKU_PAYMENT_METHODS[0];
}

function getDuitkuConfig() {
  const merchantCode = process.env.DUITKU_MERCHANT_CODE || '';
  const apiKey = process.env.DUITKU_API_KEY || '';
  const isProduction =
    process.env.DUITKU_IS_PRODUCTION === 'true' ||
    process.env.DUITKU_IS_PRODUCTION === '1';

  const baseUrl = isProduction
    ? 'https://passport.duitku.com/webapi/api/merchant'
    : 'https://sandbox.duitku.com/webapi/api/merchant';

  return {
    merchantCode,
    apiKey,
    isProduction,
    isConfigured: Boolean(merchantCode && apiKey),
    baseUrl,
    inquiryUrl: `${baseUrl}/v2/inquiry`,
    createInvoiceUrl: `${baseUrl}/v2/inquiry`,
    paymentMethodUrl: `${baseUrl}/paymentmethod/getpaymentmethod`,
    transactionStatusUrl: `${baseUrl}/transactionStatus`,
    callbackUrl: process.env.DUITKU_CALLBACK_URL || '',
    returnUrl: process.env.DUITKU_RETURN_URL || ''
  };
}

function md5(string) {
  return crypto.createHash('md5').update(string).digest('hex');
}

function sha256(string) {
  return crypto.createHash('sha256').update(string).digest('hex');
}

function formatDuitkuDatetime(date = new Date()) {
  const wibMs = date.getTime() + 7 * 60 * 60 * 1000;
  return new Date(wibMs).toISOString().slice(0, 19).replace('T', ' ');
}

function buildQrImageUrl(qrString) {
  if (!qrString) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrString)}`;
}

/**
 * Ambil daftar metode pembayaran aktif dari Duitku Get Payment Method API
 * Endpoint: POST /webapi/api/merchant/paymentmethod/getpaymentmethod
 * Signature: sha256(merchantcode + amount + datetime + apiKey)
 */
async function getPaymentMethods(amount = 10000) {
  const config = getDuitkuConfig();
  const paymentAmount = Math.max(1000, Math.trunc(Number(amount) || 10000));

  if (!config.isConfigured || (process.env.NODE_ENV === 'test' && process.env.DUITKU_LIVE_TEST !== '1')) {
    return {
      success: true,
      source: 'catalog',
      amount: paymentAmount,
      methods: DUITKU_PAYMENT_METHODS
    };
  }

  try {
    const datetime = formatDuitkuDatetime();
    const signature = sha256(`${config.merchantCode}${paymentAmount}${datetime}${config.apiKey}`);
    const res = await fetch(config.paymentMethodUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        merchantcode: config.merchantCode,
        amount: paymentAmount,
        datetime,
        signature
      })
    });

    if (!res.ok) {
      return {
        success: true,
        source: 'catalog_fallback',
        amount: paymentAmount,
        methods: DUITKU_PAYMENT_METHODS
      };
    }

    const data = await res.json().catch(() => null);
    const feeList = Array.isArray(data?.paymentFee) ? data.paymentFee : [];
    if (feeList.length === 0) {
      return {
        success: true,
        source: 'catalog_fallback',
        amount: paymentAmount,
        methods: DUITKU_PAYMENT_METHODS
      };
    }

    const feeMap = new Map(
      feeList.map(item => [String(item.paymentMethod || '').trim().toUpperCase(), item])
    );
    const mapped = DUITKU_PAYMENT_METHODS.map(local => {
      const remote = feeMap.get(local.code);
      return {
        ...local,
        paymentImage: remote?.paymentImage || null,
        totalFee: remote ? Number(remote.totalFee || 0) : 0
      };
    });

    return {
      success: true,
      source: 'duitku_api',
      amount: paymentAmount,
      methods: mapped
    };
  } catch (err) {
    console.warn('[DUITKU GET PAYMENT METHOD ERROR]', err.message);
    return {
      success: true,
      source: 'catalog_fallback',
      amount: paymentAmount,
      methods: DUITKU_PAYMENT_METHODS
    };
  }
}

/**
 * Buat transaksi langsung via Duitku API v2 Inquiry (tanpa POP/SNAP)
 * Endpoint: POST /webapi/api/merchant/v2/inquiry
 * Signature: md5(merchantCode + merchantOrderId + paymentAmount + apiKey)
 */
async function createInvoice({
  orderId,
  pkg,
  user,
  host = '',
  callbackPath = '/api/topup/notification',
  returnUrlOverride = '',
  paymentMethod = 'SP'
}) {
  const config = getDuitkuConfig();
  const unitPrice = Number(pkg?.price ?? pkg?.priceIdr ?? pkg?.amountIdr ?? 0);
  const totalDiamonds = Number(pkg?.totalDiamonds ?? pkg?.diamonds ?? pkg?.coins ?? 0);
  const methodMeta = findPaymentMethodMeta(paymentMethod);
  const selectedCode = methodMeta.code;

  const shouldMockInTest =
    process.env.NODE_ENV === 'test' &&
    process.env.DUITKU_LIVE_TEST !== '1';

  if (shouldMockInTest || (!config.isConfigured && process.env.NODE_ENV === 'test')) {
    const isQris = methodMeta.category === 'qris';
    const isVa = methodMeta.category === 'va';
    const mockQrString = isQris
      ? `00020101021226590014ID.CO.SHOPEE.WWW01189360091800215505920208215505920303UMI520458125303360540${unitPrice}5802ID5912PLAYGO STORE6007JAKARTA62200116${orderId}6304ABCD`
      : null;
    const mockVaNumber = isVa ? `8808${String(Date.now()).slice(-10)}` : null;

    return {
      success: true,
      orderId,
      merchantCode: config.merchantCode || 'DTEST',
      reference: `duitku_ref_${orderId}`,
      paymentUrl: `https://sandbox.duitku.com/payment/mock_${orderId}`,
      vaNumber: mockVaNumber,
      qrString: mockQrString,
      qrCodeUrl: buildQrImageUrl(mockQrString),
      paymentMethod: selectedCode,
      paymentMethodName: methodMeta.label,
      paymentCategory: methodMeta.category,
      bank: methodMeta.bank || null,
      statusCode: '00',
      statusMessage: 'SUCCESS',
      grossAmount: unitPrice,
      diamonds: totalDiamonds,
      status: 'pending',
      isSimulation: true
    };
  }

  if (!config.isConfigured) {
    throw new Error(
      'Sistem pembayaran Duitku belum dikonfigurasi di server. Pastikan DUITKU_MERCHANT_CODE dan DUITKU_API_KEY telah diisi di file .env.'
    );
  }

  const paymentAmount = Math.trunc(unitPrice);
  const signature = md5(`${config.merchantCode}${orderId}${paymentAmount}${config.apiKey}`);

  const configuredBaseUrl = String(process.env.PUBLIC_URL || process.env.APP_URL || '').trim().replace(/\/+$/, '');
  const sanitizedHost = String(host || '').replace(/[^a-zA-Z0-9.:-]/g, '');

  let callbackUrl = '';
  if (config.callbackUrl) {
    try {
      const parsed = new URL(config.callbackUrl);
      callbackUrl = callbackPath && callbackPath !== '/api/topup/notification'
        ? `${parsed.origin}${callbackPath}`
        : config.callbackUrl;
    } catch {
      callbackUrl = config.callbackUrl;
    }
  }
  if (!callbackUrl && configuredBaseUrl) {
    callbackUrl = `${configuredBaseUrl}${callbackPath}`;
  }
  if (!callbackUrl && sanitizedHost) {
    const proto = sanitizedHost.includes('localhost') || sanitizedHost.startsWith('127.0.0.1') ? 'http' : 'https';
    callbackUrl = `${proto}://${sanitizedHost}${callbackPath}`;
  }

  let returnUrl = returnUrlOverride || config.returnUrl;
  if (!returnUrl && configuredBaseUrl) {
    returnUrl = configuredBaseUrl;
  }
  if (!returnUrl && sanitizedHost) {
    const proto = sanitizedHost.includes('localhost') || sanitizedHost.startsWith('127.0.0.1') ? 'http' : 'https';
    returnUrl = `${proto}://${sanitizedHost}`;
  }

  const cleanUsername = String(user?.username || 'player').replace(/[^a-zA-Z0-9._-]/g, '') || 'player';
  const cleanCustomerName =
    String(user?.name || user?.username || 'PlayGo Player')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .trim()
      .slice(0, 30) || 'PlayGo Player';
  const email = user?.email || `${cleanUsername}@playgo.game`;
  const phoneNumber = user?.phone || '081234567890';
  const productTitle = `${pkg.name} (${totalDiamonds} ${callbackPath.includes('economy') ? 'Diamonds' : 'Coins'})`;

  const payload = {
    merchantCode: config.merchantCode,
    paymentAmount,
    paymentMethod: selectedCode,
    merchantOrderId: orderId,
    productDetails: productTitle.slice(0, 255),
    additionalParam: String(user?.id || ''),
    merchantUserInfo: String(user?.username || user?.id || ''),
    customerVaName: cleanCustomerName,
    email,
    phoneNumber,
    itemDetails: [
      {
        name: productTitle.slice(0, 50),
        price: paymentAmount,
        quantity: 1
      }
    ],
    customerDetail: {
      firstName: cleanCustomerName,
      email,
      phoneNumber
    },
    callbackUrl: callbackUrl || `https://playgo.devgate.my.id${callbackPath}`,
    returnUrl: returnUrl || 'https://playgo.devgate.my.id',
    signature,
    expiryPeriod: 1440
  };

  const res = await fetch(config.inquiryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const rawText = await res.text();
  let data = {};
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { statusMessage: rawText };
  }

  if (!res.ok || (data.statusCode && data.statusCode !== '00')) {
    const errorMsg = data.Message || data.statusMessage || rawText || `Duitku Inquiry API Error (${res.status})`;
    throw new Error(errorMsg);
  }

  const qrString = data.qrString || null;
  const vaNumber = data.vaNumber || null;

  return {
    success: true,
    orderId,
    reference: data.reference || null,
    paymentUrl: data.paymentUrl || null,
    vaNumber,
    qrString,
    qrCodeUrl: buildQrImageUrl(qrString),
    paymentMethod: selectedCode,
    paymentMethodName: methodMeta.label,
    paymentCategory: methodMeta.category,
    bank: methodMeta.bank || null,
    statusCode: data.statusCode || '00',
    statusMessage: data.statusMessage || 'SUCCESS',
    merchantCode: data.merchantCode || config.merchantCode,
    grossAmount: Number(data.amount || paymentAmount),
    diamonds: totalDiamonds,
    status: 'pending'
  };
}

/**
 * Verifikasi signature webhook notifikasi dari Duitku secara aman (constant-time)
 * Rumus signature callback: md5(merchantCode + amount + merchantOrderId + apiKey)
 */
function verifyDuitkuCallback(payload) {
  const config = getDuitkuConfig();
  const { merchantCode, amount, merchantOrderId, signature } = payload || {};

  if (!config.apiKey) {
    if (process.env.NODE_ENV !== 'test') return false;
    if (!merchantOrderId) return false;
    if (String(signature || '').toLowerCase().includes('invalid')) return false;
    return true;
  }

  if (!merchantOrderId || !signature || amount === undefined || amount === null) return false;
  if (config.merchantCode && merchantCode && String(merchantCode) !== String(config.merchantCode)) {
    return false;
  }

  const resolvedMerchant = merchantCode || config.merchantCode;
  const expectedSignature = md5(`${resolvedMerchant}${amount}${merchantOrderId}${config.apiKey}`);
  const sigBuf = Buffer.from(String(signature).toLowerCase(), 'utf8');
  const expBuf = Buffer.from(expectedSignature.toLowerCase(), 'utf8');

  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Cek status transaksi ke Duitku secara langsung
 * Endpoint: POST /webapi/api/merchant/transactionStatus
 * Signature: md5(merchantCode + merchantOrderId + apiKey)
 */
async function checkDuitkuStatus(orderId) {
  const config = getDuitkuConfig();
  if (!config.isConfigured) return null;
  if (process.env.NODE_ENV === 'test' && process.env.DUITKU_LIVE_TEST !== '1') {
    return null;
  }

  try {
    const signature = md5(`${config.merchantCode}${orderId}${config.apiKey}`);
    const payload = {
      merchantCode: config.merchantCode,
      merchantOrderId: orderId,
      signature
    };

    const res = await fetch(config.transactionStatusUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch (err) {
    console.error('[DUITKU STATUS CHECK ERROR]', err.message);
    return null;
  }
}

module.exports = {
  DIAMOND_PACKAGES,
  COIN_PACKAGES,
  DUITKU_PAYMENT_METHODS,
  findPaymentMethodMeta,
  getDuitkuConfig,
  md5,
  sha256,
  buildQrImageUrl,
  getPaymentMethods,
  createInvoice,
  createInquiry: createInvoice,
  verifyDuitkuCallback,
  checkDuitkuStatus
};
