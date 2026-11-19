const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const paymentGateway = require('./paymentGateway');
const midtrans = require('./midtrans');

test('Midtrans Core API: Gateway name is midtrans by default', () => {
  const active = paymentGateway.getActiveGatewayName();
  assert.equal(active, 'midtrans');
});

test('Midtrans Core API: Catalog contains exactly the 8 requested payment methods', () => {
  const catalog = paymentGateway.getPaymentMethodsCatalog('midtrans');
  assert.equal(catalog.length, 8);

  const codes = catalog.map(m => m.code);
  assert.ok(codes.includes('bca_va'), 'Must contain BCA VA');
  assert.ok(codes.includes('bni_va'), 'Must contain BNI VA');
  assert.ok(codes.includes('bri_va'), 'Must contain BRI VA');
  assert.ok(codes.includes('qris'), 'Must contain QRIS');
  assert.ok(codes.includes('gopay'), 'Must contain Gopay');
  assert.ok(codes.includes('dana'), 'Must contain Dana');
  assert.ok(codes.includes('ovo'), 'Must contain Ovo');
  assert.ok(codes.includes('shopeepay'), 'Must contain ShopeePay');
});

test('Midtrans Core API: createInvoice generates Core API charges without SNAP', async () => {
  const pkg = { id: 'diamond_50', name: '50 Coins', price: 5000, totalDiamonds: 50 };
  const user = { id: 'u1', username: 'player1', name: 'Player One' };

  // 1. BCA VA
  const bcaRes = await paymentGateway.createInvoice({
    gateway: 'midtrans',
    orderId: 'PGD_TEST_BCA',
    pkg,
    user,
    paymentMethod: 'bca_va'
  });
  assert.equal(bcaRes.success, true);
  assert.equal(bcaRes.gateway, 'midtrans');
  assert.equal(bcaRes.paymentUrl, null, 'Must NOT have Snap paymentUrl');
  assert.ok(bcaRes.vaNumber, 'Must return VA Number for BCA');
  assert.equal(bcaRes.bank, 'BCA');

  // 2. BNI VA
  const bniRes = await paymentGateway.createInvoice({
    gateway: 'midtrans',
    orderId: 'PGD_TEST_BNI',
    pkg,
    user,
    paymentMethod: 'bni_va'
  });
  assert.equal(bniRes.success, true);
  assert.ok(bniRes.vaNumber, 'Must return VA Number for BNI');
  assert.equal(bniRes.bank, 'BNI');

  // 3. BRI VA
  const briRes = await paymentGateway.createInvoice({
    gateway: 'midtrans',
    orderId: 'PGD_TEST_BRI',
    pkg,
    user,
    paymentMethod: 'bri_va'
  });
  assert.equal(briRes.success, true);
  assert.ok(briRes.vaNumber, 'Must return VA Number for BRI');
  assert.equal(briRes.bank, 'BRI');

  // 4. QRIS
  const qrisRes = await paymentGateway.createInvoice({
    gateway: 'midtrans',
    orderId: 'PGD_TEST_QRIS',
    pkg,
    user,
    paymentMethod: 'qris'
  });
  assert.equal(qrisRes.success, true);
  assert.ok(qrisRes.qrString, 'Must return QR string for QRIS');
  assert.ok(qrisRes.qrCodeUrl, 'Must return QR code image URL for QRIS');

  // 5. GoPay
  const gopayRes = await paymentGateway.createInvoice({
    gateway: 'midtrans',
    orderId: 'PGD_TEST_GOPAY',
    pkg,
    user,
    paymentMethod: 'gopay'
  });
  assert.equal(gopayRes.success, true);
  assert.ok(gopayRes.deeplinkUrl, 'Must return deeplink redirect for GoPay');

  // 6. ShopeePay
  const shopeeRes = await paymentGateway.createInvoice({
    gateway: 'midtrans',
    orderId: 'PGD_TEST_SHOPEE',
    pkg,
    user,
    paymentMethod: 'shopeepay'
  });
  assert.equal(shopeeRes.success, true);
  assert.ok(shopeeRes.deeplinkUrl, 'Must return deeplink redirect for ShopeePay');

  // 7. DANA
  const danaRes = await paymentGateway.createInvoice({
    gateway: 'midtrans',
    orderId: 'PGD_TEST_DANA',
    pkg,
    user,
    paymentMethod: 'dana'
  });
  assert.equal(danaRes.success, true);
  assert.ok(danaRes.qrCodeUrl, 'Must return QR code URL for DANA');
  assert.equal(danaRes.bank, 'DANA');

  // 8. OVO
  const ovoRes = await paymentGateway.createInvoice({
    gateway: 'midtrans',
    orderId: 'PGD_TEST_OVO',
    pkg,
    user,
    paymentMethod: 'ovo'
  });
  assert.equal(ovoRes.success, true);
  assert.ok(ovoRes.qrCodeUrl, 'Must return QR code URL for OVO');
  assert.equal(ovoRes.bank, 'OVO');
});

test('Midtrans Core API: Webhook signature verification and normalization', () => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-playgo-sandbox-key';
  const orderId = 'PGD_ORDER_123';
  const statusCode = '200';
  const grossAmount = '5000.00';

  const validSig = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');

  const validPayload = {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: validSig,
    transaction_status: 'settlement',
    payment_type: 'bank_transfer',
    transaction_id: 'midtrans_tx_123'
  };

  assert.equal(paymentGateway.verifyCallback(validPayload), true);

  const invalidPayload = { ...validPayload, signature_key: 'invalid_sha512_hash' };
  assert.equal(paymentGateway.verifyCallback(invalidPayload), false);

  // Normalization
  const normalized = paymentGateway.normalizeCallback(validPayload);
  assert.equal(normalized.gateway, 'midtrans');
  assert.equal(normalized.merchantOrderId, orderId);
  assert.equal(normalized.resultCode, '00');
  assert.equal(normalized.statusMessage, 'SUCCESS');
  assert.equal(normalized.reference, 'midtrans_tx_123');
});
