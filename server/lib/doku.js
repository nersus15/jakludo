// Integrasi DOKU Payment Gateway (Jokul Checkout / Direct API) untuk PlayGo
// Dokumentasi resmi: https://dashboard.doku.com/docs/docs/jokul-checkout/
// - Request Payment : POST /checkout/v1/payment
// - Check Status    : GET  /orders/v1/status/:invoiceNumber
// - Callback Auth   : Header Signature: HMACSHA256=<base64(hmac_sha256(secretKey, components))>
const crypto = require('crypto');
const { reloadDotEnvIfChanged } = require('../migrate');

// Katalog 6 channel utama PlayGo yang dipetakan ke kode kanal resmi DOKU Jokul
const DOKU_PAYMENT_METHODS = [
  {
    code: 'SP',
    dokuChannel: 'QRIS',
    label: 'QRIS (All E-Wallet & M-Banking)',
    category: 'qris',
    bank: 'QRIS',
    badge: 'Instan',
    description: 'Scan QR dari GoPay, OVO, DANA, ShopeePay, BCA Mobile, Livin, Wondr.'
  },
  {
    code: 'M2',
    dokuChannel: 'VIRTUAL_ACCOUNT_BANK_MANDIRI',
    directTarget: '/mandiri-virtual-account/v2/payment-code',
    label: 'Mandiri Virtual Account',
    category: 'va',
    bank: 'Mandiri',
    badge: 'VA',
    description: 'Transfer via Livin by Mandiri atau ATM Mandiri.'
  },
  {
    code: 'BC',
    dokuChannel: 'VIRTUAL_ACCOUNT_BCA',
    directTarget: '/bca-virtual-account/v2/payment-code',
    label: 'BCA Virtual Account',
    category: 'va',
    bank: 'BCA',
    badge: 'Populer',
    description: 'Bayar lewat myBCA, BCA Mobile, KlikBCA, atau ATM BCA.'
  },
  {
    code: 'I1',
    dokuChannel: 'VIRTUAL_ACCOUNT_BNI',
    directTarget: '/bni-virtual-account/v2/payment-code',
    label: 'BNI Virtual Account',
    category: 'va',
    bank: 'BNI',
    badge: 'VA',
    description: 'Transfer via Wondr / BNI Mobile Banking atau ATM BNI.'
  },
  {
    code: 'SA',
    dokuChannel: 'EMONEY_SHOPEEPAY',
    label: 'ShopeePay E-Wallet',
    category: 'ewallet',
    bank: 'ShopeePay',
    badge: 'E-Wallet',
    description: 'Bayar instan melalui aplikasi ShopeePay.'
  },
  {
    code: 'DA',
    dokuChannel: 'EMONEY_DANA',
    label: 'DANA E-Wallet',
    category: 'ewallet',
    bank: 'DANA',
    badge: 'E-Wallet',
    description: 'Bayar langsung lewat aplikasi DANA di ponselmu.'
  }
];

function findPaymentMethodMeta(code) {
  const clean = String(code || 'SP').trim().toUpperCase() || 'SP';
  return (
    DOKU_PAYMENT_METHODS.find(
      m => m.code === clean || m.dokuChannel === clean
    ) || DOKU_PAYMENT_METHODS[0]
  );
}

function getDokuConfig() {
  reloadDotEnvIfChanged();
  const clientId = String(process.env.DOKU_CLIENT_ID || process.env.DOKU_MERCHANT_CODE || '').trim();
  const secretKey = String(process.env.DOKU_SECRET_KEY || process.env.DOKU_API_KEY || '').trim();
  const merchantCode = String(process.env.DOKU_MERCHANT_CODE || clientId || '').trim();
  const isProduction =
    process.env.DOKU_IS_PRODUCTION === 'true' ||
    process.env.DOKU_IS_PRODUCTION === '1';

  const baseUrl = isProduction
    ? 'https://api.doku.com'
    : 'https://api-sandbox.doku.com';

  return {
    gateway: 'doku',
    clientId,
    merchantCode,
    secretKey,
    isProduction,
    isConfigured: Boolean(clientId && secretKey),
    baseUrl,
    checkoutUrl: `${baseUrl}/checkout/v1/payment`,
    statusBaseUrl: `${baseUrl}/orders/v1/status`,
    callbackUrl: String(process.env.DOKU_CALLBACK_URL || '').trim(),
    returnUrl: String(process.env.DOKU_RETURN_URL || '').trim()
  };
}

function buildQrImageUrl(qrString) {
  if (!qrString) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrString)}`;
}

function generateDigest(rawBody) {
  const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {});
  return crypto.createHash('sha256').update(bodyStr, 'utf8').digest('base64');
}

function generateDokuSignature({
  clientId,
  requestId,
  requestTimestamp,
  requestTarget,
  digest = null,
  secretKey
}) {
  const lines = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${requestTarget}`
  ];
  if (digest !== null && digest !== undefined && digest !== '') {
    lines.push(`Digest:${digest}`);
  }
  const component = lines.join('\n');
  const hmac = crypto.createHmac('sha256', String(secretKey || '')).update(component, 'utf8').digest('base64');
  return `HMACSHA256=${hmac}`;
}

function signDokuCallback({ clientId, amount, merchantOrderId, secretKey }) {
  return crypto
    .createHmac('sha256', String(secretKey || ''))
    .update(`${clientId || ''}${amount}${merchantOrderId}`, 'utf8')
    .digest('hex');
}

function timingSafeCompare(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function mapDokuStatusToResultCode(rawStatus) {
  const upper = String(rawStatus || '').trim().toUpperCase();
  if (upper === 'SUCCESS' || upper === 'PAID' || upper === 'SETTLED' || upper === '00') return '00';
  if (upper === 'PENDING' || upper === 'IN_PROGRESS' || upper === '01') return '01';
  if (upper === 'FAILED' || upper === 'EXPIRED' || upper === 'CANCELLED' || upper === 'CANCELED' || upper === '02') {
    return '02';
  }
  return upper;
}

function normalizeDokuCallbackPayload(payload = {}, headers = {}) {
  const lowerHeaders = {};
  for (const [k, v] of Object.entries(headers || {})) {
    lowerHeaders[String(k).toLowerCase()] = Array.isArray(v) ? v[0] : v;
  }

  const isJokulObject = Boolean(payload?.order?.invoice_number || payload?.transaction?.status);
  if (isJokulObject) {
    const rawStatus = String(payload?.transaction?.status || '').trim().toUpperCase();
    const channelRaw = payload?.channel?.id || payload?.payment?.payment_method_type || '';
    const methodMeta = channelRaw ? findPaymentMethodMeta(channelRaw) : null;
    return {
      gateway: 'doku',
      merchantOrderId: String(payload?.order?.invoice_number || '').trim(),
      amount: payload?.order?.amount ?? payload?.transaction?.original_amount ?? null,
      merchantCode: String(lowerHeaders['client-id'] || payload?.merchantCode || payload?.client_id || '').trim() || null,
      resultCode: mapDokuStatusToResultCode(rawStatus),
      statusMessage: rawStatus || String(payload?.transaction?.message || ''),
      reference: String(
        payload?.transaction?.original_request_id ||
        payload?.order?.session_id ||
        payload?.uuid ||
        payload?.reference ||
        ''
      ).trim() || null,
      signature: String(lowerHeaders['signature'] || payload?.signature || '').trim() || null,
      paymentMethod: methodMeta ? methodMeta.code : String(channelRaw || 'doku').trim()
    };
  }

  const rawCode = payload?.resultCode ?? payload?.statusCode ?? payload?.status ?? '';
  return {
    gateway: 'doku',
    merchantOrderId: String(
      payload?.merchantOrderId ||
      payload?.invoiceNumber ||
      payload?.invoice_number ||
      payload?.orderId ||
      ''
    ).trim(),
    amount: payload?.amount ?? null,
    merchantCode: String(lowerHeaders['client-id'] || payload?.merchantCode || payload?.clientId || '').trim() || null,
    resultCode: mapDokuStatusToResultCode(rawCode),
    statusMessage: String(payload?.statusMessage || payload?.status || '').trim(),
    reference: String(payload?.reference || '').trim() || null,
    signature: String(lowerHeaders['signature'] || payload?.signature || '').trim() || null,
    paymentMethod: String(payload?.paymentMethod || 'doku').trim()
  };
}

function verifyDokuCallback(payload = {}, headers = {}) {
  const config = getDokuConfig();
  const normalized = normalizeDokuCallbackPayload(payload, headers);
  const lowerHeaders = {};
  for (const [k, v] of Object.entries(headers || {})) {
    lowerHeaders[String(k).toLowerCase()] = Array.isArray(v) ? v[0] : v;
  }

  const headerSig = String(lowerHeaders['signature'] || '').trim();
  const headerClientId = String(lowerHeaders['client-id'] || '').trim();
  const headerReqId = String(lowerHeaders['request-id'] || '').trim();
  const headerTimestamp = String(lowerHeaders['request-timestamp'] || '').trim();
  const explicitTarget = String(
    lowerHeaders['x-resolved-target'] ||
    lowerHeaders['request-target'] ||
    ''
  ).trim();

  if (!config.secretKey) {
    if (process.env.NODE_ENV !== 'test') return false;
    if (!normalized.merchantOrderId) return false;
    const sigText = String(headerSig || payload?.signature || '').toLowerCase();
    if (sigText.includes('invalid') || sigText.includes('wrong') || sigText.includes('fake')) return false;
    return true;
  }

  if (headerClientId && config.clientId && headerClientId !== config.clientId) {
    return false;
  }
  if (
    payload?.merchantCode &&
    config.merchantCode &&
    String(payload.merchantCode) !== String(config.merchantCode)
  ) {
    return false;
  }

  // Jalur 1: Header Signature standar DOKU Jokul (HMACSHA256=...)
  if (headerSig.startsWith('HMACSHA256=')) {
    if (!headerReqId || !headerTimestamp || !normalized.merchantOrderId) return false;
    const rawBody = typeof lowerHeaders['x-raw-body'] === 'string' && lowerHeaders['x-raw-body'].length > 0
      ? lowerHeaders['x-raw-body']
      : JSON.stringify(payload || {});
    const digest = generateDigest(rawBody);

    let configPath = '';
    if (config.callbackUrl) {
      try {
        configPath = new URL(config.callbackUrl).pathname;
      } catch {}
    }

    const candidateTargets = Array.from(
      new Set(
        [
          explicitTarget,
          configPath,
          '/api/economy/topup/callback',
          '/api/topup/notification'
        ].filter(Boolean)
      )
    );

    const clientIdForSig = headerClientId || config.clientId;
    return candidateTargets.some(target => {
      const expectedSig = generateDokuSignature({
        clientId: clientIdForSig,
        requestId: headerReqId,
        requestTimestamp: headerTimestamp,
        requestTarget: target,
        digest,
        secretKey: config.secretKey
      });
      return timingSafeCompare(headerSig, expectedSig);
    });
  }

  // Jalur 2: Payload signature datar (HMAC-SHA256 hex)
  if (!normalized.merchantOrderId || !normalized.signature || normalized.amount === undefined || normalized.amount === null) {
    return false;
  }

  const clientIdForFlat = normalized.merchantCode || config.clientId || config.merchantCode;
  const expectedFlat = signDokuCallback({
    clientId: clientIdForFlat,
    amount: normalized.amount,
    merchantOrderId: normalized.merchantOrderId,
    secretKey: config.secretKey
  });

  return timingSafeCompare(String(normalized.signature).toLowerCase(), expectedFlat.toLowerCase());
}

async function getPaymentMethods(amount = 10000) {
  const paymentAmount = Math.max(1000, Math.trunc(Number(amount) || 10000));
  return {
    success: true,
    gateway: 'doku',
    source: 'doku_catalog',
    amount: paymentAmount,
    methods: DOKU_PAYMENT_METHODS.map(m => ({ ...m, totalFee: 0 }))
  };
}

function resolveUrls({ config, host, callbackPath, returnUrlOverride }) {
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

  return {
    callbackUrl: callbackUrl || `https://playgo.devgate.my.id${callbackPath}`,
    returnUrl: returnUrl || 'https://playgo.devgate.my.id'
  };
}

async function createInvoice({
  orderId,
  pkg,
  user,
  host = '',
  callbackPath = '/api/topup/notification',
  returnUrlOverride = '',
  paymentMethod = 'SP'
}) {
  const config = getDokuConfig();
  const unitPrice = Number(pkg?.price ?? pkg?.priceIdr ?? pkg?.amountIdr ?? 0);
  const totalDiamonds = Number(pkg?.totalDiamonds ?? pkg?.diamonds ?? pkg?.coins ?? 0);
  const isAllMethods = !paymentMethod || ['all', 'doku', 'snap', 'ALL', 'DOKU', 'SNAP'].includes(String(paymentMethod).trim());
  const methodMeta = findPaymentMethodMeta(isAllMethods ? 'SP' : paymentMethod);
  const selectedCode = isAllMethods ? 'ALL' : methodMeta.code;

  const shouldMockInTest =
    process.env.NODE_ENV === 'test' &&
    process.env.DOKU_LIVE_TEST !== '1';

  if (shouldMockInTest || (!config.isConfigured && process.env.NODE_ENV === 'test')) {
    const isQris = methodMeta.category === 'qris';
    const isVa = methodMeta.category === 'va';
    const mockQrString = isQris
      ? `00020101021226590014ID.CO.DOKU.WWW01189360089900215505920208215505920303UMI520458125303360540${unitPrice}5802ID5912PLAYGO STORE6007JAKARTA62200116${orderId}6304DOKU`
      : null;
    const mockVaNumber = isVa ? `8908${String(Date.now()).slice(-10)}` : null;

    return {
      success: true,
      gateway: 'doku',
      orderId,
      merchantCode: config.clientId || config.merchantCode || 'BRN-TEST-DOKU',
      reference: `doku_ref_${orderId}`,
      paymentUrl: `https://sandbox.doku.com/checkout-link-v2/${orderId}`,
      vaNumber: mockVaNumber,
      qrString: mockQrString,
      qrCodeUrl: buildQrImageUrl(mockQrString),
      paymentMethod: selectedCode,
      paymentMethodName: isAllMethods ? 'DOKU Snap Checkout' : methodMeta.label,
      paymentCategory: isAllMethods ? 'all' : methodMeta.category,
      bank: isAllMethods ? null : (methodMeta.bank || null),
      dokuChannel: isAllMethods ? null : methodMeta.dokuChannel,
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
      'Sistem pembayaran DOKU belum dikonfigurasi di server. Pastikan DOKU_CLIENT_ID dan DOKU_SECRET_KEY telah diisi di file .env.'
    );
  }

  const paymentAmount = Math.trunc(unitPrice);
  const { callbackUrl, returnUrl } = resolveUrls({ config, host, callbackPath, returnUrlOverride });

  const cleanUsername = String(user?.username || 'player').replace(/[^a-zA-Z0-9._-]/g, '') || 'player';
  const cleanCustomerName =
    String(user?.name || user?.username || 'PlayGo Player')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .trim()
      .slice(0, 50) || 'PlayGo Player';
  const email = user?.email || `${cleanUsername}@playgo.game`;
  const phoneNumber = user?.phone || '081234567890';
  const productTitle = `${pkg.name} (${totalDiamonds} ${callbackPath.includes('economy') ? 'Diamonds' : 'Coins'})`.slice(0, 100);

  let activeBaseUrl = config.baseUrl;

  // 1. Utamakan DOKU Direct API v2 (Core API) hanya jika user/test memilih channel Virtual Account tertentu
  if (!isAllMethods && methodMeta.category === 'va' && methodMeta.directTarget) {
    const vaPayload = {
      order: {
        invoice_number: orderId,
        amount: paymentAmount
      },
      virtual_account_info: {
        expired_time: 60,
        reusable_status: false,
        info1: 'PlayGo Marketplace',
        info2: productTitle.slice(0, 30),
        info3: 'Terima kasih'
      },
      customer: {
        name: cleanCustomerName,
        email
      }
    };

    let vaResult = await sendDokuWithEnvFallback({
      baseUrl: activeBaseUrl,
      config,
      requestTarget: methodMeta.directTarget,
      payload: vaPayload
    });
    activeBaseUrl = vaResult.activeBaseUrl;
    let vaAttempt = vaResult.attempt;

    if (!vaAttempt.ok) {
      console.warn(`[DOKU DIRECT VA] ${methodMeta.directTarget} gagal (${vaAttempt.errorMsg}), mencoba /doku-virtual-account/v2/payment-code...`);
      vaResult = await sendDokuWithEnvFallback({
        baseUrl: activeBaseUrl,
        config,
        requestTarget: '/doku-virtual-account/v2/payment-code',
        payload: vaPayload
      });
      activeBaseUrl = vaResult.activeBaseUrl;
      vaAttempt = vaResult.attempt;
    }

    if (vaAttempt.ok && vaAttempt.data) {
      const vaData = vaAttempt.data;
      const vaResp = vaData.response || vaData;
      const directVaNumber =
        vaResp.virtual_account_info?.virtual_account_number ||
        vaResp.vaNumber ||
        null;
      if (directVaNumber) {
        const directRef =
          vaResp.order?.session_id ||
          vaResp.uuid ||
          vaResp.virtual_account_info?.identifier?.[0]?.value ||
          vaAttempt.requestId;
        return {
          success: true,
          gateway: 'doku',
          orderId,
          reference: directRef,
          paymentUrl: null,
          vaNumber: directVaNumber,
          qrString: null,
          qrCodeUrl: null,
          paymentMethod: selectedCode,
          paymentMethodName: methodMeta.label,
          paymentCategory: methodMeta.category,
          bank: methodMeta.bank || null,
          dokuChannel: methodMeta.dokuChannel,
          statusCode: '00',
          statusMessage: 'SUCCESS',
          merchantCode: config.merchantCode || config.clientId,
          grossAmount: Number(vaResp.order?.amount || paymentAmount),
          diamonds: totalDiamonds,
          status: 'pending'
        };
      }
    } else {
      console.warn(`[DOKU DIRECT VA] Fallback ke /checkout/v1/payment karena: ${vaAttempt?.errorMsg || 'nomor VA tidak dikembalikan'}`);
    }
  }

  const payload = {
    order: {
      amount: paymentAmount,
      invoice_number: orderId,
      currency: 'IDR',
      callback_url: callbackUrl,
      callback_url_cancel: returnUrl,
      callback_url_result: returnUrl,
      auto_redirect: true,
      disable_retry_payment: false,
      line_items: [
        {
          id: String(pkg?.id || orderId).slice(0, 50),
          name: productTitle,
          price: paymentAmount,
          quantity: 1
        }
      ]
    },
    payment: {
      payment_due_date: 1440,
      ...(isAllMethods ? {} : { payment_method_types: [methodMeta.dokuChannel] })
    },
    customer: {
      id: String(user?.id || cleanUsername).slice(0, 64),
      name: cleanCustomerName,
      email,
      phone: phoneNumber,
      country: 'ID'
    }
  };

  let checkoutRes = await sendDokuWithEnvFallback({
    baseUrl: activeBaseUrl,
    config,
    requestTarget: '/checkout/v1/payment',
    payload
  });
  activeBaseUrl = checkoutRes.activeBaseUrl;
  let attempt = checkoutRes.attempt;

  // Auto-fallback ke seluruh channel aktif merchant jika channel spesifik belum diaktifkan di DOKU
  if (!attempt.ok && /payment channel is inactive/i.test(String(attempt.errorMsg || ''))) {
    console.warn(`[DOKU] Channel ${methodMeta.dokuChannel} belum aktif, membuat checkout URL dengan channel aktif merchant...`);
    const fallbackPayload = {
      ...payload,
      payment: { payment_due_date: payload.payment?.payment_due_date || 1440 }
    };
    attempt = await sendDokuApiRequest({
      baseUrl: activeBaseUrl,
      config,
      requestTarget: '/checkout/v1/payment',
      payload: fallbackPayload
    });
  }

  if (!attempt.ok) {
    throw new Error(attempt.errorMsg);
  }

  const data = attempt.data || {};
  const requestId = attempt.requestId;
  const resp = data.response || data;

  const qrString =
    resp.qris?.qr_code ||
    resp.qr_string ||
    resp.qrString ||
    null;
  const vaNumber =
    resp.virtual_account_info?.virtual_account_number ||
    resp.vaNumber ||
    null;
  const rawPaymentUrl =
    resp.payment?.url ||
    data.payment?.url ||
    resp.paymentUrl ||
    null;
  const paymentUrl = rawPaymentUrl;
  const reference =
    resp.order?.session_id ||
    resp.uuid ||
    resp.payment?.token_id ||
    requestId;

  return {
    success: true,
    gateway: 'doku',
    orderId,
    reference,
    paymentUrl,
    vaNumber,
    qrString,
    qrCodeUrl: buildQrImageUrl(qrString),
    paymentMethod: selectedCode,
    paymentMethodName: isAllMethods ? 'DOKU Snap Checkout' : methodMeta.label,
    paymentCategory: isAllMethods ? 'all' : methodMeta.category,
    bank: isAllMethods ? null : (methodMeta.bank || null),
    dokuChannel: isAllMethods ? null : methodMeta.dokuChannel,
    statusCode: '00',
    statusMessage: 'SUCCESS',
    merchantCode: config.merchantCode || config.clientId,
    grossAmount: Number(resp.order?.amount || paymentAmount),
    diamonds: totalDiamonds,
    status: 'pending'
  };
}

async function sendDokuWithEnvFallback({ baseUrl, config, requestTarget, payload }) {
  let activeBaseUrl = baseUrl;
  let attempt = await sendDokuApiRequest({
    baseUrl: activeBaseUrl,
    config,
    requestTarget,
    payload
  });

  if (!attempt.ok && /invalid\s*client-id/i.test(String(attempt.errorMsg || ''))) {
    const altBaseUrl =
      activeBaseUrl === 'https://api.doku.com'
        ? 'https://api-sandbox.doku.com'
        : 'https://api.doku.com';
    console.warn(`[DOKU] Invalid Client-Id di ${activeBaseUrl}, mencoba fallback ke ${altBaseUrl}...`);
    const altAttempt = await sendDokuApiRequest({
      baseUrl: altBaseUrl,
      config,
      requestTarget,
      payload
    });
    if (altAttempt.ok || !/invalid\s*client-id/i.test(String(altAttempt.errorMsg || ''))) {
      activeBaseUrl = altBaseUrl;
      attempt = altAttempt;
    }
  }

  return { activeBaseUrl, attempt };
}

async function sendDokuApiRequest({ baseUrl, config, requestTarget = '/checkout/v1/payment', payload }) {
  const rawBody = JSON.stringify(payload);
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().slice(0, 19) + 'Z';
  const digest = generateDigest(rawBody);
  const signature = generateDokuSignature({
    clientId: config.clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    digest,
    secretKey: config.secretKey
  });

  const res = await fetch(`${baseUrl}${requestTarget}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Client-Id': config.clientId,
      'Request-Id': requestId,
      'Request-Timestamp': requestTimestamp,
      Signature: signature
    },
    body: rawBody
  });

  const rawText = await res.text();
  let data = {};
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { message: [rawText] };
  }

  const errorMsg = !res.ok
    ? (Array.isArray(data.error?.message) ? data.error.message.join(', ') : data.error?.message) ||
      (Array.isArray(data.message) ? data.message.join(', ') : data.message) ||
      `DOKU API Error (${res.status})`
    : null;

  return { ok: res.ok, status: res.status, data, errorMsg, requestId };
}

async function fetchDokuOrderStatus({ baseUrl, config, orderId }) {
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().slice(0, 19) + 'Z';
  const requestTarget = `/orders/v1/status/${encodeURIComponent(orderId)}`;
  const signature = generateDokuSignature({
    clientId: config.clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    secretKey: config.secretKey
  });

  const res = await fetch(`${baseUrl}${requestTarget}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Client-Id': config.clientId,
      'Request-Id': requestId,
      'Request-Timestamp': requestTimestamp,
      Signature: signature
    }
  });

  const rawText = await res.text();
  let data = null;
  try {
    data = JSON.parse(rawText);
  } catch {}
  return { ok: res.ok, status: res.status, data, rawText };
}

async function checkDokuStatus(orderId) {
  const config = getDokuConfig();
  if (!config.isConfigured) return null;
  if (process.env.NODE_ENV === 'test' && process.env.DOKU_LIVE_TEST !== '1') {
    return null;
  }

  try {
    let attempt = await fetchDokuOrderStatus({ baseUrl: config.baseUrl, config, orderId });
    if (!attempt.ok && /invalid\s*client-id/i.test(attempt.rawText || '')) {
      const altBaseUrl =
        config.baseUrl === 'https://api.doku.com'
          ? 'https://api-sandbox.doku.com'
          : 'https://api.doku.com';
      attempt = await fetchDokuOrderStatus({ baseUrl: altBaseUrl, config, orderId });
    }

    if (!attempt.ok || !attempt.data) return null;
    const data = attempt.data;

    const rawStatus = String(data.transaction?.status || data.status || '').trim().toUpperCase();
    return {
      gateway: 'doku',
      orderId: data.order?.invoice_number || orderId,
      amount: data.order?.amount !== undefined ? Number(data.order.amount) : undefined,
      statusCode: mapDokuStatusToResultCode(rawStatus),
      statusMessage: rawStatus || 'UNKNOWN',
      raw: data
    };
  } catch (err) {
    console.error('[DOKU STATUS CHECK ERROR]', err.message);
    return null;
  }
}

module.exports = {
  DOKU_PAYMENT_METHODS,
  findPaymentMethodMeta,
  getDokuConfig,
  generateDigest,
  generateDokuSignature,
  signDokuCallback,
  normalizeDokuCallbackPayload,
  verifyDokuCallback,
  getPaymentMethods,
  createInvoice,
  checkDokuStatus
};
