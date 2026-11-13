// Integrasi Midtrans Payment Gateway (Core API / Charge API) untuk Topup Diamonds / Poin PlayGo
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

const PAYMENT_METHODS = [
  {
    id: 'qris',
    category: 'qris',
    name: 'QRIS (Semua E-Wallet & M-Banking)',
    description: 'Scan langsung via GoPay, OVO, DANA, ShopeePay, BCA Mobile, Livin, dll.',
    icon: 'qr',
    badge: 'Instan'
  },
  {
    id: 'bca_va',
    category: 'bank_transfer',
    bank: 'bca',
    name: 'BCA Virtual Account',
    description: 'Transfer otomatis 24 jam via BCA Mobile, myBCA, KlikBCA, atau ATM BCA.',
    icon: 'bank',
    badge: 'Populer'
  },
  {
    id: 'bni_va',
    category: 'bank_transfer',
    bank: 'bni',
    name: 'BNI Virtual Account',
    description: 'Transfer via BNI Mobile Banking, Internet Banking, atau ATM BNI.',
    icon: 'bank'
  },
  {
    id: 'bri_va',
    category: 'bank_transfer',
    bank: 'bri',
    name: 'BRI Virtual Account (BRIVA)',
    description: 'Transfer via BRImo, Internet Banking BRI, atau ATM BRI.',
    icon: 'bank'
  },
  {
    id: 'mandiri_bill',
    category: 'echannel',
    bank: 'mandiri',
    name: 'Mandiri Bill',
    description: 'Pembayaran tagihan via Livin by Mandiri (kode perusahaan + kode bayar).',
    icon: 'bank'
  },
  {
    id: 'permata_va',
    category: 'bank_transfer',
    bank: 'permata',
    name: 'Permata Virtual Account',
    description: 'Transfer via PermataMobile X atau ATM bersama/ALTO/Prima.',
    icon: 'bank'
  }
];

function getMidtransConfig() {
  loadDotEnv(true);
  const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
  const clientKey = (process.env.MIDTRANS_CLIENT_KEY || '').trim();
  const isProduction =
    process.env.MIDTRANS_IS_PRODUCTION === '1' ||
    process.env.MIDTRANS_IS_PRODUCTION === 'true';

  const chargeUrl = isProduction
    ? 'https://api.midtrans.com/v2/charge'
    : 'https://api.sandbox.midtrans.com/v2/charge';

  const statusApiBase = isProduction
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2';

  return {
    serverKey,
    clientKey,
    isProduction,
    isConfigured: Boolean(serverKey),
    chargeUrl,
    statusApiBase
  };
}

// Midtrans Core API Charge
async function chargeTransaction({ orderId, pkg, user, methodId = 'qris' }) {
  const config = getMidtransConfig();

  // Mode mock HANYA diizinkan pada unit test otomatis (NODE_ENV=test)
  if (!config.serverKey) {
    if (process.env.NODE_ENV === 'test') {
      const isVa = methodId.includes('va') || methodId.includes('bill');
      return {
        success: true,
        orderId,
        transactionId: `mock_tx_${orderId}`,
        paymentType: isVa ? 'bank_transfer' : 'qris',
        grossAmount: pkg.price,
        status: 'pending',
        isSimulation: true,
        qrCodeUrl: 'https://api.sandbox.midtrans.com/v2/qris/mock/qr-code',
        qrString: '000201010212mockqris',
        vaNumber: isVa ? '123456789012' : null,
        bank: isVa ? 'bca' : null,
        billKey: methodId === 'mandiri_bill' ? '385843904150' : null,
        billerCode: methodId === 'mandiri_bill' ? '70012' : null,
        expiryTime: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };
    }
    throw new Error('Sistem pembayaran Midtrans belum dikonfigurasi di server. Pastikan MIDTRANS_SERVER_KEY telah diisi di file .env.');
  }

  const selectedMethod = PAYMENT_METHODS.find(m => m.id === methodId) || PAYMENT_METHODS[0];

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
        name: `${pkg.name} (${pkg.diamonds} Diamonds)`
      }
    ],
    customer_details: {
      first_name: user.name || user.username,
      email: user.email || `${user.username}@playgo.game`
    }
  };

  if (selectedMethod.id === 'qris') {
    payload.payment_type = 'qris';
    payload.qris = { acquirer: 'gopay' };
  } else if (selectedMethod.id === 'mandiri_bill') {
    payload.payment_type = 'echannel';
    payload.echannel = {
      bill_info1: 'Topup Diamonds',
      bill_info2: `${pkg.diamonds} Poin PlayGo`
    };
  } else if (selectedMethod.bank === 'permata') {
    payload.payment_type = 'permata';
  } else {
    payload.payment_type = 'bank_transfer';
    payload.bank_transfer = {
      bank: selectedMethod.bank || 'bca'
    };
  }

  const authHeader = 'Basic ' + Buffer.from(config.serverKey + ':').toString('base64');
  const res = await fetch(config.chargeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.status_code && !data.status_code.startsWith('20'))) {
    const errorMsg = data?.error_messages?.join(', ') || data?.status_message || `Midtrans Core API Error (${res.status})`;
    throw new Error(errorMsg);
  }

  // Ekstrak detail pembayaran dari respon Core API
  const qrCodeUrl =
    data.actions?.find(a => a.name === 'generate-qr-code')?.url ||
    data.actions?.find(a => a.name === 'generate-qr-code-v2')?.url ||
    null;

  const vaNumber =
    data.va_numbers?.[0]?.va_number ||
    data.permata_va_number ||
    null;

  const bank =
    data.va_numbers?.[0]?.bank ||
    (data.permata_va_number ? 'permata' : selectedMethod.bank || null);

  const billKey = data.bill_key || null;
  const billerCode = data.biller_code || null;

  return {
    success: true,
    orderId,
    transactionId: data.transaction_id,
    paymentType: data.payment_type,
    methodId: selectedMethod.id,
    methodName: selectedMethod.name,
    grossAmount: Number(data.gross_amount || pkg.price),
    status: data.transaction_status || 'pending',
    expiryTime: data.expiry_time || null,
    qrCodeUrl,
    qrString: data.qr_string || null,
    vaNumber,
    bank,
    billKey,
    billerCode
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
  PAYMENT_METHODS,
  getMidtransConfig,
  chargeTransaction,
  createSnapTransaction: chargeTransaction, // Alias untuk backward compatibility
  verifySignature,
  checkMidtransStatus
};
