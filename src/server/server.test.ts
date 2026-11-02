import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  initializeDatabase,
} from './db';
import {
  validateIndianPinCodeFormat,
  normalizeIndianMobile,
  validateCheckoutAddress,
  computeServerSideCheckoutTotals,
  verifyManualPaymentByAdmin,
  canAdminConfirmOrder,
  verifyOrderLookupPhone,
  maskCustomerMobile,
  maskCustomerAddress,
  maskCustomerEmail,
  generateOrderAccessToken,
} from '../shared/domainLogic';
import { FALLBACK_CATEGORIES, FALLBACK_PRODUCTS } from '../shared/fallbackData';

initializeDatabase();

test('1. Storefront Catalogue Integrity & Completeness', () => {
  assert.ok(FALLBACK_CATEGORIES.length >= 3, 'Must have at least 3 categories');
  assert.ok(FALLBACK_PRODUCTS.length >= 10, 'Must have catalogue products');

  const giftHampers = FALLBACK_PRODUCTS.filter((p) => p.categorySlug === 'gift-hampers');
  assert.ok(giftHampers.length >= 4, 'Must have 4 gift hampers');

  for (const product of FALLBACK_PRODUCTS) {
    assert.ok(product.id, 'Product must have id');
    assert.ok(product.name, 'Product must have name');
    assert.ok(product.slug, 'Product must have slug');
    assert.ok(product.sku, 'Product must have sku');
    assert.ok(product.sellingPricePaise > 0, 'Price must be positive integer paise');
    assert.ok(Array.isArray(product.images) && product.images.length > 0, 'Must have images');
    assert.ok(product.images[0].startsWith('/uploads/'), 'Image path must be valid');
  }
});

test('2. Checkout Validation: Indian Address, Mobile & PIN Code', () => {
  // Invalid mobile
  const badMobile = validateCheckoutAddress(
    {
      fullName: 'Pooja Sharma',
      mobile: '12345',
      houseFlat: 'Flat 402',
      streetLocality: 'Golf Course Road',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122001',
    },
    [],
    { mode: 'pan_india' }
  );
  assert.strictEqual(badMobile.valid, false);
  assert.ok(badMobile.errors.some((e) => e.includes('10-digit')));

  // Invalid PIN code (5 digits)
  const badPin = validateCheckoutAddress(
    {
      fullName: 'Pooja Sharma',
      mobile: '9876543210',
      houseFlat: 'Flat 402',
      streetLocality: 'Golf Course Road',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '12200',
    },
    [],
    { mode: 'pan_india' }
  );
  assert.strictEqual(badPin.valid, false);
  assert.ok(badPin.errors.some((e) => e.includes('PIN')));

  // Valid Indian address
  const validAddr = validateCheckoutAddress(
    {
      fullName: 'Pooja Sharma',
      mobile: '9876543210',
      houseFlat: 'Flat 402, DLF Phase 5',
      streetLocality: 'Golf Course Road',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122001',
    },
    [],
    { mode: 'pan_india' }
  );
  assert.strictEqual(validAddr.valid, true);
});

test('3. Server-Side Price & Product Integrity during Checkout', () => {
  const prodMap = new Map<string, any>();
  const varMap = new Map<string, any>();
  const catMap = new Map<string, 'active' | 'coming-soon'>();

  for (const p of FALLBACK_PRODUCTS) {
    prodMap.set(p.id, p);
    catMap.set(p.categorySlug, 'active');
  }

  // Attempt client price tampering (trying to buy 299 hamper for 1 rupee)
  const tamperedCart = [
    {
      productId: 'prod-mini-hamper',
      quantity: 1,
      clientSellingPricePaise: 100, // Tampered client price
    },
  ];

  const calc = computeServerSideCheckoutTotals(
    tamperedCart as any,
    prodMap,
    varMap,
    catMap,
    {
      tier1MaxSubtotalPaise: 49900,
      tier1FeePaise: 5900,
      tier2MaxSubtotalPaise: 99900,
      tier2FeePaise: 3900,
      freeShippingThresholdPaise: 99900,
    },
    []
  );

  assert.strictEqual(calc.valid, true);
  // Must use official server price 29900 paise, NOT 100 paise!
  assert.strictEqual(calc.subtotalPaise, 29900);
  assert.strictEqual(calc.items[0].unitPricePaise, 29900);
  assert.strictEqual(calc.shippingFeePaise, 5900);
  assert.strictEqual(calc.totalPaise, 35800);
});

test('4. Prepaid-Only & Payment Verification Safeguards', () => {
  // Test verifyManualPaymentByAdmin rejects empty bank UTR
  const emptyUtrCheck = verifyManualPaymentByAdmin({
    paymentMode: 'whatsapp',
    adminUserId: 'adm-owner-1',
    adminRole: 'owner',
    bankReferenceUtr: '',
    verifiedAmountPaise: 35800,
    expectedAmountPaise: 35800,
  });
  assert.strictEqual(emptyUtrCheck.allowed, false);

  // Rejects amount mismatch
  const mismatchCheck = verifyManualPaymentByAdmin({
    paymentMode: 'whatsapp',
    adminUserId: 'adm-owner-1',
    adminRole: 'owner',
    bankReferenceUtr: 'UTR1234567890',
    verifiedAmountPaise: 10000,
    expectedAmountPaise: 35800,
  });
  assert.strictEqual(mismatchCheck.allowed, false);

  // Accepts genuine matching UTR
  const validCheck = verifyManualPaymentByAdmin({
    paymentMode: 'whatsapp',
    adminUserId: 'adm-owner-1',
    adminRole: 'owner',
    bankReferenceUtr: 'HDFC20261102987654',
    verifiedAmountPaise: 35800,
    expectedAmountPaise: 35800,
  });
  assert.strictEqual(validCheck.allowed, true);
});

test('5. Order Confirmation & Prepaid Shipment Safeguards', () => {
  // Order confirmation MUST be rejected if paymentStatus is not 'paid'
  const unpaidConfirmCheck = canAdminConfirmOrder({
    paymentStatus: 'pending',
    orderStatus: 'awaiting_payment',
    adminUserId: 'adm-owner-1',
    adminRole: 'owner',
  });
  assert.strictEqual(unpaidConfirmCheck.allowed, false);
  assert.ok(unpaidConfirmCheck.reason?.toLowerCase().includes('payment'));

  // Order confirmation allowed once paid
  const paidConfirmCheck = canAdminConfirmOrder({
    paymentStatus: 'paid',
    orderStatus: 'awaiting_payment',
    adminUserId: 'adm-owner-1',
    adminRole: 'owner',
  });
  assert.strictEqual(paidConfirmCheck.allowed, true);
});

test('6. Authentication & Password Security (PBKDF2-SHA512)', () => {
  const plainPassword = 'PrettyCharm@2025Secure!';
  const { hash, salt } = hashPassword(plainPassword);

  assert.ok(hash && hash.length === 128, 'PBKDF2 sha512 hash must be 128 hex chars (64 bytes)');
  assert.ok(salt && salt.length === 32, 'Salt must be 32 hex chars (16 bytes)');

  // Correct password matches
  const isMatch = verifyPassword(plainPassword, hash, salt);
  assert.strictEqual(isMatch, true);

  // Wrong password rejected
  const wrongMatch = verifyPassword('WrongPassword123!', hash, salt);
  assert.strictEqual(wrongMatch, false);
});

test('7. Order Tracking Security & PII Masking', () => {
  const rawMobile = '9876543210';
  const rawAddressJson = JSON.stringify({
    fullName: 'Pooja Sharma',
    houseFlat: 'Flat 402, DLF Phase 5',
    streetLocality: 'Golf Course Road',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122001',
  });
  const rawEmail = 'pooja.sharma@example.com';

  const maskedPhone = maskCustomerMobile(rawMobile);
  assert.ok(maskedPhone.includes('****'), 'Mobile must be masked');
  assert.ok(!maskedPhone.includes('9876543210'), 'Raw phone must never be exposed');

  const maskedAddr = maskCustomerAddress(rawAddressJson);
  assert.strictEqual(maskedAddr.maskedHouseFlat, 'Residential Address (Protected)');
  assert.ok(!maskedAddr.maskedSummary.includes('Flat 402'), 'House number must be masked');

  const maskedMail = maskCustomerEmail(rawEmail);
  assert.ok(maskedMail.includes('***') || maskedMail.includes('•'), 'Email must be masked');

  // Verify order lookup requires matching phone
  assert.strictEqual(verifyOrderLookupPhone(rawMobile, '9876543210'), true);
  assert.strictEqual(verifyOrderLookupPhone(rawMobile, '9123456789'), false);
});

test('8. Unguessable Crypto Token Generation', () => {
  const token1 = generateOrderAccessToken();
  const token2 = generateOrderAccessToken();

  assert.ok(token1 && token1.length >= 32, 'Token must have strong entropy');
  assert.notStrictEqual(token1, token2, 'Tokens must be distinct');
});
