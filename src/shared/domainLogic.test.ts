import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  canCustomerPurchaseProduct,
  validateProductPublication,
  calculateCustomerShippingFeePaise,
  checkPinCodeServiceability,
  validateCheckoutAddress,
  computeServerSideCheckoutTotals,
  calculateNewWeightedAverageCost,
  canReleaseReservationOnCancel,
  getInitialPaymentStatusForMode,
  verifyManualPaymentByAdmin,
  verifyOrderLookupPhone,
  getHonestEtaDisplay,
  isDuplicateShipmentEvent,
  calculateFinancialReport,
  sanitizeSpreadsheetCell,
  buildSafeWhatsAppUrl,
  sortCatalogueProducts,
  PRODUCT_SORT_OPTIONS,
  validateCandidateProductImage,
  applyApprovedProductImageToGallery,
  verifyCatalogueIntegrityUnchanged,
  isProductEligibleForImageImport,
  buildGeminiProductImagePrompt,
  PRODUCT_IMAGE_AUDIT_STATUSES,
  getHomepageFeaturedProducts,
  getHomepageGiftHampers,
  getVerifiedWhyShopBenefits,
  buildInstagramProfileUrl,
  getInitialOrderStatusForMode,
  buildCustomerOrderWhatsAppMessage,
  buildCustomerOrderWhatsAppUrl,
  buildCustomerWhatsAppContactUrl,
  buildAdminPaymentInstructionWhatsAppUrl,
  canAdminConfirmOrder,
  buildAdminOrderConfirmationWhatsAppUrl,
  validateIndianPinCodeFormat,
  lookupBuiltinIndianPostalInfo,
  detectPinCodeLocationMismatch,
  evaluateDeliveryServiceability,
  normalizeIndianStateName,
  ALL_INDIAN_STATES_AND_UTS,
  DEFAULT_DELIVERY_POLICY,
  DEFAULT_SHIPPING_RULES,
  formatCompleteDeliveryAddress,
  DEFAULT_COMBO_OFFERS,
  evaluateCartComboOffers,
  calculateFreeShippingProgress,
  validateGiftPersonalization,
  formatGiftPersonalizationForWhatsApp,
  generateOrderAccessToken,
  maskCustomerMobile,
  maskCustomerAddress,
  maskCustomerEmail,
  canOrderReviewProduct,
  DeliveryPolicyConfig,
  DomainProduct,
  DomainVariant,
  ServiceablePinCode,
} from './domainLogic';

const SAMPLE_PINS: ServiceablePinCode[] = [
  { pincode: '122001', city: 'Gurugram', state: 'Haryana', isServiceable: true, codAvailable: false },
  { pincode: '110001', city: 'New Delhi', state: 'Delhi', isServiceable: true, codAvailable: false },
  { pincode: '400001', city: 'Mumbai', state: 'Maharashtra', isServiceable: false, codAvailable: false },
];

const DRAFT_HAMPER: DomainProduct = {
  id: 'prod-mini-hamper',
  name: 'Pretty Charm Mini Hamper',
  slug: 'pretty-charm-mini-hamper',
  sku: 'PC-HMP-MINI',
  categorySlug: 'gift-hampers',
  status: 'draft',
  sellingPricePaise: 29900,
  purchaseCostPaise: 16000,
  packagingCostPaise: 2500,
  stockQty: 0,
  reservedQty: 0,
  lowStockThreshold: 5,
};

const ACTIVE_CLAW: DomainProduct = {
  id: 'prod-pearl-claw',
  name: 'Rose Gold Pearl Hair Claw',
  slug: 'rose-gold-pearl-hair-claw',
  sku: 'PC-HAIR-001',
  categorySlug: 'hair-accessories',
  status: 'active',
  sellingPricePaise: 24900,
  purchaseCostPaise: 9500,
  packagingCostPaise: 1500,
  stockQty: 10,
  reservedQty: 2,
  lowStockThreshold: 3,
};

test('1. Currency arithmetic in integer paise is exact', () => {
  assert.equal(rupeesToPaise(299), 29900);
  assert.equal(rupeesToPaise(449.5), 44950);
  assert.equal(paiseToRupees(29900), 299);
  assert.ok(formatINR(29900).includes('299'));
});

test('2. Product publication rules block unconfirmed drafts and coming-soon items', () => {
  const draftAttempt = canCustomerPurchaseProduct(DRAFT_HAMPER, 1, 'active');
  assert.equal(draftAttempt.allowed, false);
  assert.match(draftAttempt.reason || '', /draft/i);

  const comingSoonCatAttempt = canCustomerPurchaseProduct(ACTIVE_CLAW, 1, 'coming-soon');
  assert.equal(comingSoonCatAttempt.allowed, false);
  assert.match(comingSoonCatAttempt.reason || '', /Coming Soon/i);

  const unconfirmedPublish = validateProductPublication({
    name: 'Pretty Charm Mini Hamper',
    sellingPricePaise: 29900,
    stockQty: 10,
    description: 'Confirmed hamper contents with satin scrunchie and claw clip.',
    confirmedByAdmin: false,
  });
  assert.equal(unconfirmedPublish.valid, false);
});

test('3. Stock availability and reservation math prevents overselling', () => {
  // ACTIVE_CLAW has stockQty=10, reservedQty=2 => 8 available
  assert.equal(canCustomerPurchaseProduct(ACTIVE_CLAW, 8, 'active').allowed, true);
  const oversell = canCustomerPurchaseProduct(ACTIVE_CLAW, 9, 'active');
  assert.equal(oversell.allowed, false);
  assert.match(oversell.reason || '', /Only 8 unit/);
});

test('4. Configurable shipping rules engine calculates accurate tiers', () => {
  // Subtotal below ₹499 => ₹59 (5900 paise)
  assert.equal(calculateCustomerShippingFeePaise(29900), 5900);
  assert.equal(calculateCustomerShippingFeePaise(49800), 5900);
  // Subtotal ₹499 to below ₹999 => ₹39 (3900 paise)
  assert.equal(calculateCustomerShippingFeePaise(49900), 3900);
  assert.equal(calculateCustomerShippingFeePaise(89900), 3900);
  // Subtotal ₹999 or above => ₹0 free shipping
  assert.equal(calculateCustomerShippingFeePaise(99900), 0);
  assert.equal(calculateCustomerShippingFeePaise(149900), 0);
});

test('5. Server-side price validation ignores tampered client prices and aggregates duplicate lines', () => {
  const products = new Map<string, DomainProduct>([[ACTIVE_CLAW.id, ACTIVE_CLAW]]);
  const variants = new Map<string, DomainVariant>();
  const categories = new Map<string, 'active' | 'coming-soon'>([['hair-accessories', 'active']]);

  const result = computeServerSideCheckoutTotals(
    [
      { productId: ACTIVE_CLAW.id, quantity: 1, clientSubmittedPricePaise: 100 }, // Tampered ₹1 price
      { productId: ACTIVE_CLAW.id, quantity: 1, clientSubmittedPricePaise: 100 },
    ],
    products,
    variants,
    categories
  );

  assert.equal(result.valid, true);
  assert.equal(result.subtotalPaise, 49800); // 2 * ₹249 = ₹498
  assert.equal(result.shippingFeePaise, 5900); // < ₹499 => ₹59
  assert.equal(result.totalPaise, 55700); // ₹557
});

test('6. Guest checkout address & Indian PIN code validation', () => {
  const validAddr = validateCheckoutAddress(
    {
      fullName: 'Ananya Sharma',
      mobile: '+91 9876543210',
      houseFlat: 'Flat 402, Tower B',
      street: 'DLF Phase 4',
      locality: 'DLF Phase 4',
      district: 'Gurugram',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122001',
    },
    SAMPLE_PINS
  );
  assert.equal(validAddr.valid, true);

  const unserviceableAddr = validateCheckoutAddress(
    {
      fullName: 'Ananya Sharma',
      mobile: '9876543210',
      houseFlat: '12A',
      street: 'Marine Drive',
      locality: 'Marine Drive',
      district: 'Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    },
    SAMPLE_PINS
  );
  assert.equal(unserviceableAddr.valid, false);
  assert.ok(unserviceableAddr.errors.some((e) => e.includes('400001')));
});

test('7. Weighted Average Cost (WAC) and cancellation stock release rules', () => {
  // 10 units @ ₹100 (10000p) + 10 units @ ₹140 (14000p) = ₹120 (12000p)
  const newWac = calculateNewWeightedAverageCost(10, 10000, 10, 14000);
  assert.equal(newWac, 12000);

  assert.equal(canReleaseReservationOnCancel('Pending Confirmation'), true);
  assert.equal(canReleaseReservationOnCancel('Packed'), true);
  assert.equal(canReleaseReservationOnCancel('Delivered'), false);
});

test('8. Payment verification safeguards prevent demo payment spoofing and unauthorized approvals', () => {
  assert.equal(getInitialPaymentStatusForMode('demo'), 'Demo Mode - Not Paid');
  assert.equal(getInitialPaymentStatusForMode('manual'), 'Awaiting Verification');

  const demoVerifyAttempt = verifyManualPaymentByAdmin({
    paymentMode: 'demo',
    adminUserId: 'admin-1',
    adminRole: 'owner',
    bankReferenceUtr: 'UTR123456789',
    verifiedAmountPaise: 55700,
    expectedAmountPaise: 55700,
  });
  assert.equal(demoVerifyAttempt.allowed, false);

  const unauthAttempt = verifyManualPaymentByAdmin({
    paymentMode: 'manual',
    adminUserId: null,
    adminRole: null,
    bankReferenceUtr: 'UTR123456789',
    verifiedAmountPaise: 55700,
    expectedAmountPaise: 55700,
  });
  assert.equal(unauthAttempt.allowed, false);

  const validManualVerify = verifyManualPaymentByAdmin({
    paymentMode: 'manual',
    adminUserId: 'admin-1',
    adminRole: 'owner',
    bankReferenceUtr: 'UTR9988776655',
    verifiedAmountPaise: 55700,
    expectedAmountPaise: 55700,
  });
  assert.equal(validManualVerify.allowed, true);
  assert.equal(validManualVerify.newStatus, 'Paid');
});

test('9. Shipment tracking phone verification, missing ETA, and duplicate webhook protection', () => {
  assert.equal(verifyOrderLookupPhone('9876543210', '+91-9876543210'), true);
  assert.equal(verifyOrderLookupPhone('9876543210', '9876500000'), false);

  assert.equal(getHonestEtaDisplay(null), 'Estimated delivery not available yet.');
  assert.equal(getHonestEtaDisplay(''), 'Estimated delivery not available yet.');
  assert.equal(getHonestEtaDisplay('2026-10-28'), '2026-10-28');

  const existingEvents = [
    { eventCode: 'PICKED_UP', eventTimestamp: '2026-10-23T10:00:00Z', location: 'Gurugram Hub' },
  ];
  assert.equal(
    isDuplicateShipmentEvent(existingEvents, {
      eventCode: 'PICKED_UP',
      eventTimestamp: '2026-10-23T10:00:00Z',
      location: 'Gurugram Hub',
    }),
    true
  );
});

test('10. Profit reporting excludes unpaid/demo orders and never counts unsold inventory as COGS', () => {
  const report = calculateFinancialReport(
    [
      {
        orderId: 'PC-1001',
        orderStatus: 'Delivered',
        paymentStatus: 'Paid',
        subtotalPaise: 50000,
        shippingFeeCollectedPaise: 3900,
        totalPaise: 53900,
        refundedAmountPaise: 0,
        actualCourierCostPaise: 4500,
        paymentGatewayFeePaise: 1000,
        items: [
          {
            quantity: 2,
            unitPricePaise: 25000,
            unitCostSnapshotPaise: 10000,
            packagingCostSnapshotPaise: 1500,
          },
        ],
      },
      {
        orderId: 'PC-1002-DEMO',
        orderStatus: 'Pending Confirmation',
        paymentStatus: 'Demo Mode - Not Paid',
        subtotalPaise: 29900,
        shippingFeeCollectedPaise: 5900,
        totalPaise: 35800,
        refundedAmountPaise: 0,
        actualCourierCostPaise: null,
        paymentGatewayFeePaise: null,
        items: [
          {
            quantity: 1,
            unitPricePaise: 29900,
            unitCostSnapshotPaise: 12000,
            packagingCostSnapshotPaise: 1500,
          },
        ],
      },
    ],
    5000, // ₹50 operating expense
    250000 // ₹2,500 unsold inventory value
  );

  assert.equal(report.paidOrdersCount, 1);
  assert.equal(report.paidRevenuePaise, 53900);
  assert.equal(report.cogsPaise, 20000); // Only the 2 paid items (2 * ₹100), never unsold inventory
  assert.equal(report.packagingCostPaise, 3000); // 2 * ₹15
  assert.equal(report.grossProfitPaise, 30900); // 53900 - 20000 - 3000
  assert.equal(report.contributionProfitPaise, 25400); // 30900 - 4500 - 1000
  assert.equal(report.estimatedNetProfitPaise, 20400); // 25400 - 5000
  assert.equal(report.unsoldInventoryValuePaise, 250000);
});

test('11. Spreadsheet formula injection escaping & WhatsApp URL sanitization', () => {
  assert.equal(sanitizeSpreadsheetCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.equal(sanitizeSpreadsheetCell('+cmd|"/c calc"!A0'), "'+cmd|\"/c calc\"!A0");
  assert.equal(sanitizeSpreadsheetCell('Normal Product Name'), 'Normal Product Name');
  assert.equal(sanitizeSpreadsheetCell(299), 299);

  const waUrl = buildSafeWhatsAppUrl('+91 9876543210', 'tracking', { orderId: 'PC-2026-0001' });
  assert.ok(waUrl.startsWith('https://wa.me/919876543210?text='));
  assert.ok(waUrl.includes('PC-2026-0001'));
});

test('12. Product listing & Category Page sorting (Price: Low to High, Price: High to Low, Newest Arrivals)', () => {
  const sampleCatalogue = [
    {
      id: 'prod-1',
      name: 'Rose Gold Pearl Hair Claw',
      sellingPricePaise: 24900,
      status: 'active',
      featured: true,
      createdAt: '2026-10-15T10:00:00.000Z',
    },
    {
      id: 'prod-2',
      name: 'Blush Satin Pearl Bow Barrette',
      sellingPricePaise: 17900,
      status: 'active',
      featured: false,
      createdAt: '2026-10-18T10:00:00.000Z',
    },
    {
      id: 'prod-3',
      name: 'Blush Quartz Layered Necklace',
      sellingPricePaise: 42900,
      status: 'active',
      featured: true,
      createdAt: '2026-10-23T10:00:00.000Z',
    },
    {
      id: 'prod-4',
      name: 'Mulberry Silk Scrunchie Trio',
      sellingPricePaise: 19900,
      status: 'active',
      featured: true,
      createdAt: '2026-10-20T10:00:00.000Z',
    },
  ];

  // Verify required option labels exist
  const labels = PRODUCT_SORT_OPTIONS.map((o) => o.label);
  assert.ok(labels.includes('Price: Low to High'));
  assert.ok(labels.includes('Price: High to Low'));
  assert.ok(labels.includes('Newest Arrivals'));

  // 1. Price: Low to High
  const lowToHigh = sortCatalogueProducts(sampleCatalogue, 'price-asc');
  assert.deepEqual(
    lowToHigh.map((p) => p.sellingPricePaise),
    [17900, 19900, 24900, 42900]
  );

  // 2. Price: High to Low
  const highToLow = sortCatalogueProducts(sampleCatalogue, 'price-desc');
  assert.deepEqual(
    highToLow.map((p) => p.sellingPricePaise),
    [42900, 24900, 19900, 17900]
  );

  // 3. Newest Arrivals (chronological descending by createdAt)
  const newest = sortCatalogueProducts(sampleCatalogue, 'newest');
  assert.deepEqual(
    newest.map((p) => p.id),
    ['prod-3', 'prod-4', 'prod-2', 'prod-1']
  );

  // Ensure original array was not mutated
  assert.equal(sampleCatalogue[0].id, 'prod-1');
});

test('13. Product image eligibility, validation, AI fallback metadata labeling, gallery update & catalogue integrity check', () => {
  // Verify all 6 required Admin Image Management statuses exist
  assert.deepEqual(PRODUCT_IMAGE_AUDIT_STATUSES, [
    'Genuine Image Found',
    'Added Successfully',
    'Awaiting Admin Approval',
    'AI-Generated Image',
    'Image Needed',
    'Search Failed',
  ]);

  // Verify eligibility check identifies active, in-stock products available for sale
  assert.equal(isProductEligibleForImageImport({ status: 'active', stockQty: 18, reservedQty: 0 }), true);
  assert.equal(isProductEligibleForImageImport({ status: 'draft', stockQty: 0, reservedQty: 0 }), false);
  assert.equal(isProductEligibleForImageImport({ status: 'active', stockQty: 2, reservedQty: 2 }), false);

  // Verify Gemini fallback prompt uses actual database attributes without inventing contents
  const prompt = buildGeminiProductImagePrompt({
    name: 'Rose Gold Pearl Hair Claw',
    categorySlug: 'hair-accessories',
    description: 'Non-slip electroplated rose-gold alloy hair claw handset with lustrous faux freshwater pearls.',
    sku: 'PC-HAIR-CLAW-01',
    variants: [{ name: 'Blush Pearl' }, { name: 'Champagne Pearl' }],
  });
  assert.ok(prompt.includes('Rose Gold Pearl Hair Claw'));
  assert.ok(prompt.includes('PC-HAIR-CLAW-01'));
  assert.ok(prompt.includes('Blush Pearl, Champagne Pearl'));
  assert.ok(prompt.includes('Do not invent unknown contents'));

  // Reject AI-generated images when submitted as genuine original photographs
  const aiRejectedAsGenuine = validateCandidateProductImage({
    urlOrDataUri: 'https://example.com/photo.jpg',
    sourceUrl: 'https://example.com/product',
    isAiGenerated: true,
    allowAiFallback: false,
    hasReusePermission: true,
    exactProductMatch: true,
  });
  assert.equal(aiRejectedAsGenuine.valid, false);
  assert.equal(aiRejectedAsGenuine.recommendedStatus, 'Image Needed');

  // Allow AI-generated fallback when explicitly labeled as AI-Generated Image awaiting Admin approval
  const aiFallbackCheck = validateCandidateProductImage({
    urlOrDataUri: '/uploads/products/ai-claw.png',
    sourceUrl: 'gemini://gemini-3.1-flash-lite-image/PC-HAIR-CLAW-01',
    mimeType: 'image/png',
    byteLength: 85000,
    isAiGenerated: true,
    allowAiFallback: true,
    hasReusePermission: true,
  });
  assert.equal(aiFallbackCheck.valid, true);
  assert.equal(aiFallbackCheck.isAiGenerated, true);
  assert.equal(aiFallbackCheck.recommendedStatus, 'AI-Generated Image');

  // Flag unverified third-party reuse permissions
  const unverifiedCheck = validateCandidateProductImage({
    urlOrDataUri: 'https://etsy.com/img/claw.jpg',
    sourceUrl: 'https://etsy.com/listing/123',
    isAiGenerated: false,
    hasReusePermission: false,
    exactProductMatch: true,
  });
  assert.equal(unverifiedCheck.valid, false);
  assert.equal(unverifiedCheck.recommendedStatus, 'Source or reuse permission unverified');

  // Accept valid authorized photo (local or HTTPS) into Awaiting Admin Approval state
  const validCheck = validateCandidateProductImage({
    urlOrDataUri: '/uploads/products/prod-pearl-claw.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:White_Pearl_hair_catch.jpg',
    mimeType: 'image/jpeg',
    byteLength: 240546,
    isAiGenerated: false,
    hasReusePermission: true,
    exactProductMatch: true,
  });
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.isAiGenerated, false);
  assert.equal(validCheck.recommendedStatus, 'Awaiting Admin Approval');

  // Gallery update preserves existing images by default and sets primary image when confirmed
  const existingGallery = ['data:image/svg+xml;utf8,existing1', 'data:image/svg+xml;utf8,existing2'];
  const preservedPrimary = applyApprovedProductImageToGallery(
    existingGallery,
    '/uploads/products/prod-pearl-claw.jpg',
    { replaceExisting: false, setAsPrimary: true }
  );
  assert.deepEqual(preservedPrimary, [
    '/uploads/products/prod-pearl-claw.jpg',
    'data:image/svg+xml;utf8,existing1',
    'data:image/svg+xml;utf8,existing2',
  ]);

  // Catalogue integrity check detects any unauthorized mutation of product count, ID, price, or stock
  const snapshotBefore = [
    {
      id: 'prod-pearl-claw',
      name: 'Rose Gold Pearl Hair Claw',
      slug: 'rose-gold-pearl-hair-claw',
      categorySlug: 'hair-accessories',
      sku: 'PC-HAIR-CLAW-01',
      sellingPricePaise: 24900,
      stockQty: 18,
      status: 'active',
      variantSkus: ['PC-HAIR-CLAW-01-CL', 'PC-HAIR-CLAW-01-PT'],
    },
  ];
  const integrityOk = verifyCatalogueIntegrityUnchanged(snapshotBefore, [...snapshotBefore]);
  assert.equal(integrityOk.unchanged, true);
  assert.equal(integrityOk.discrepancies.length, 0);
});

test('14. Homepage featured products, gift hampers filter, verified benefits & Instagram profile URL helper', () => {
  const sampleProducts = [
    {
      id: 'prod-pearl-claw',
      name: 'Rose Gold Pearl Hair Claw',
      categorySlug: 'hair-accessories',
      status: 'active',
      sellingPricePaise: 24900,
      availableQty: 18,
      featured: true,
    },
    {
      id: 'prod-satin-bow',
      name: 'Blush Satin Pearl Bow Barrette',
      categorySlug: 'hair-accessories',
      status: 'active',
      sellingPricePaise: 17900,
      availableQty: 15,
      featured: false,
    },
    {
      id: 'prod-mini-hamper',
      name: 'Pretty Charm Mini Hamper',
      categorySlug: 'gift-hampers',
      status: 'draft',
      sellingPricePaise: 29900,
      availableQty: 0,
      featured: true,
    },
    {
      id: 'prod-out-of-stock',
      name: 'Sold Out Item',
      categorySlug: 'jewellery',
      status: 'active',
      sellingPricePaise: 19900,
      availableQty: 0,
      featured: true,
    },
  ];

  // Featured products must only return active, in-stock products (never drafts or 0-stock items)
  const featured = getHomepageFeaturedProducts(sampleProducts);
  assert.deepEqual(
    featured.map((p) => p.id),
    ['prod-pearl-claw', 'prod-satin-bow']
  );

  // Gift hampers filter returns saved gift-hampers items
  const hampers = getHomepageGiftHampers(sampleProducts);
  assert.deepEqual(
    hampers.map((p) => p.id),
    ['prod-mini-hamper']
  );

  // Verified Why Shop With Us benefits reflect live shipping tiers and Admin overrides
  const benefits = getVerifiedWhyShopBenefits({
    shippingOrigin: 'Gurugram, Haryana (PIN 122001)',
    whyShopBenefits: {
      selectionTitle: 'Thoughtfully selected products',
    },
  });
  assert.equal(benefits.length, 4);
  assert.equal(benefits[0].title, 'Thoughtfully selected products');
  assert.equal(benefits[1].title, 'Secure ordering process');
  assert.equal(benefits[2].title, 'Shipping information');
  assert.ok(benefits[2].description.includes('₹59'));
  assert.ok(benefits[2].description.includes('₹999'));
  assert.equal(benefits[3].title, 'Customer support');

  // Instagram handle sanitization
  const ig = buildInstagramProfileUrl('@prettycharm.in/');
  assert.equal(ig.handle, '@prettycharm.in');
  assert.equal(ig.url, 'https://www.instagram.com/prettycharm.in');
});

test('15. WhatsApp-assisted order & payment workflow: ₹299/₹499 hamper totals, URL encoding, and admin verification/confirmation checks', () => {
  // 1. Verify ₹299 and ₹499 hamper order total calculation on the server
  const hamper299: DomainProduct = {
    id: 'prod-mini-hamper',
    name: 'Pretty Charm Mini Hamper',
    slug: 'pretty-charm-mini-hamper',
    sku: 'PC-HMP-MINI',
    categorySlug: 'gift-hampers',
    status: 'active',
    sellingPricePaise: 29900, // ₹299
    purchaseCostPaise: 12500,
    packagingCostPaise: 2000,
    stockQty: 12,
    reservedQty: 0,
    lowStockThreshold: 3,
  };
  const hamper499: DomainProduct = {
    id: 'prod-premium-box',
    name: 'Pretty Charm Premium Gift Box',
    slug: 'pretty-charm-premium-gift-box',
    sku: 'PC-HMP-PREM',
    categorySlug: 'gift-hampers',
    status: 'active',
    sellingPricePaise: 49900, // ₹499
    purchaseCostPaise: 21000,
    packagingCostPaise: 3000,
    stockQty: 12,
    reservedQty: 0,
    lowStockThreshold: 3,
  };

  const productMap = new Map<string, DomainProduct>([
    [hamper299.id, hamper299],
    [hamper499.id, hamper499],
  ]);
  const variantMap = new Map<string, DomainVariant>();
  const categoryStatusMap = new Map<string, 'active' | 'coming-soon'>([
    ['gift-hampers', 'active'],
  ]);

  const checkoutResult = computeServerSideCheckoutTotals(
    [
      { productId: 'prod-mini-hamper', quantity: 1, clientSubmittedPricePaise: 100 }, // tampered price ignored
      { productId: 'prod-premium-box', quantity: 1 },
    ],
    productMap,
    variantMap,
    categoryStatusMap
  );

  assert.equal(checkoutResult.valid, true);
  assert.equal(checkoutResult.subtotalPaise, 79800); // ₹299 + ₹499 = ₹798
  assert.equal(checkoutResult.shippingFeePaise, 3900); // ₹39 tier2 shipping (499 <= 798 < 999)
  assert.equal(checkoutResult.totalPaise, 83700); // ₹837 total

  // 2. Verify initial statuses for WhatsApp-assisted checkout
  assert.equal(getInitialPaymentStatusForMode('whatsapp'), 'pending');
  assert.equal(getInitialOrderStatusForMode('whatsapp'), 'awaiting_payment');

  // 3. Verify customer "Order via WhatsApp" message & URL encoding
  const orderPayload = {
    orderNumber: 'PC-2026-1042',
    customerName: 'Ananya Sharma',
    customerMobile: '9876543210',
    address: {
      houseFlat: 'Flat 402, Tower B',
      streetLocality: 'DLF Phase 4, Sector 28',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122001',
      deliveryInstructions: 'Leave with security guard if unavailable',
    },
    items: [
      {
        productName: 'Pretty Charm Mini Hamper',
        variantName: 'Blush Pink Box',
        quantity: 1,
        unitPricePaise: 29900,
        lineTotalPaise: 29900,
      },
      {
        productName: 'Pretty Charm Premium Gift Box',
        variantName: null,
        quantity: 1,
        unitPricePaise: 49900,
        lineTotalPaise: 49900,
      },
    ],
    subtotalPaise: 79800,
    shippingFeePaise: 3900,
    totalPaise: 83700,
  };

  const customerMsg = buildCustomerOrderWhatsAppMessage(orderPayload);
  assert.ok(customerMsg.includes('PC-2026-1042'));
  assert.ok(customerMsg.includes('Pretty Charm Mini Hamper (Blush Pink Box)'));
  assert.ok(customerMsg.includes('₹299'));
  assert.ok(customerMsg.includes('Pretty Charm Premium Gift Box'));
  assert.ok(customerMsg.includes('₹499'));
  assert.ok(customerMsg.includes('₹837'));
  assert.ok(customerMsg.includes('Ananya Sharma'));
  assert.ok(customerMsg.includes('Flat 402, Tower B, DLF Phase 4, Sector 28, Gurugram, Haryana - 122001'));
  assert.ok(customerMsg.includes('Leave with security guard if unavailable'));

  const customerWaUrl = buildCustomerOrderWhatsAppUrl('+91 90000 00000', orderPayload);
  assert.ok(customerWaUrl.startsWith('https://wa.me/919000000000?text='));
  assert.ok(customerWaUrl.includes(encodeURIComponent('PC-2026-1042')));
  assert.ok(customerWaUrl.includes(encodeURIComponent('Ananya Sharma')));

  // 4. Verify Admin customer contact link & payment instruction WhatsApp link
  assert.equal(buildCustomerWhatsAppContactUrl('9876543210'), 'https://wa.me/919876543210');
  const paymentInstrUrl = buildAdminPaymentInstructionWhatsAppUrl('9876543210', orderPayload, {
    upiId: 'prettycharm@icici',
    paymentLink: 'https://rzp.io/i/prettycharm-demo',
  });
  assert.ok(paymentInstrUrl.startsWith('https://wa.me/919876543210?text='));
  assert.ok(paymentInstrUrl.includes(encodeURIComponent('prettycharm@icici')));
  assert.ok(paymentInstrUrl.includes(encodeURIComponent('PC-2026-1042')));

  // 5. Verify Admin permission & payment verification checks before order confirmation
  // Cannot confirm order while paymentStatus is still 'pending'
  const prematureConfirm = canAdminConfirmOrder({
    paymentStatus: 'pending',
    orderStatus: 'awaiting_payment',
    adminUserId: 'admin-owner-1',
    adminRole: 'owner',
  });
  assert.equal(prematureConfirm.allowed, false);

  // Non-admin cannot confirm order even if paid
  const unauthorizedConfirm = canAdminConfirmOrder({
    paymentStatus: 'paid',
    orderStatus: 'awaiting_payment',
    adminUserId: null,
    adminRole: null,
  });
  assert.equal(unauthorizedConfirm.allowed, false);

  // Admin verifies payment after checking bank/UPI transaction
  const verifyResult = verifyManualPaymentByAdmin({
    paymentMode: 'whatsapp',
    adminUserId: 'admin-owner-1',
    adminRole: 'owner',
    bankReferenceUtr: 'UPI428910293847',
    verifiedAmountPaise: 83700,
    expectedAmountPaise: 83700,
  });
  assert.equal(verifyResult.allowed, true);
  assert.equal(verifyResult.newStatus, 'paid');

  // Now Admin can confirm the order
  const validConfirm = canAdminConfirmOrder({
    paymentStatus: verifyResult.newStatus!,
    orderStatus: 'awaiting_payment',
    adminUserId: 'admin-owner-1',
    adminRole: 'owner',
  });
  assert.equal(validConfirm.allowed, true);
  assert.equal(validConfirm.newOrderStatus, 'confirmed');

  // 6. Verify Admin "Send Confirmation via WhatsApp" URL generation
  const confirmWaUrl = buildAdminOrderConfirmationWhatsAppUrl('9876543210', orderPayload);
  assert.ok(confirmWaUrl.startsWith('https://wa.me/919876543210?text='));
  assert.ok(confirmWaUrl.includes(encodeURIComponent('CONFIRMED')));
  assert.ok(confirmWaUrl.includes(encodeURIComponent('PC-2026-1042')));
});

test('16. Indian PIN code format requires exactly 6 numeric digits with no leading zero', () => {
  // Valid PIN codes
  assert.equal(validateIndianPinCodeFormat('122001'), true);
  assert.equal(validateIndianPinCodeFormat('110001'), true);
  assert.equal(validateIndianPinCodeFormat('400050'), true);
  assert.equal(validateIndianPinCodeFormat('560034'), true);
  assert.equal(validateIndianPinCodeFormat(' 122009 '), true); // Cleaned whitespace

  // Invalid: starts with 0
  assert.equal(validateIndianPinCodeFormat('012001'), false);
  // Invalid: length less than 6
  assert.equal(validateIndianPinCodeFormat('12200'), false);
  // Invalid: length greater than 6
  assert.equal(validateIndianPinCodeFormat('1220011'), false);
  // Invalid: contains letters/symbols
  assert.equal(validateIndianPinCodeFormat('12200A'), false);
  assert.equal(validateIndianPinCodeFormat('12-200'), false);
  assert.equal(validateIndianPinCodeFormat(''), false);
});

test('17. Postal PIN lookup and offline fallback resolution', () => {
  const ggnLookup = lookupBuiltinIndianPostalInfo('122001');
  assert.ok(ggnLookup);
  assert.equal(ggnLookup.isValid, true);
  assert.equal(ggnLookup.district, 'Gurugram');
  assert.equal(ggnLookup.state, 'Haryana');
  assert.ok(ggnLookup.postOffices.length > 0);

  const mumbaiLookup = lookupBuiltinIndianPostalInfo('400050');
  assert.ok(mumbaiLookup);
  assert.equal(mumbaiLookup.state, 'Maharashtra');
  assert.equal(mumbaiLookup.district, 'Mumbai Suburban');

  const invalidLookup = lookupBuiltinIndianPostalInfo('999999');
  assert.equal(invalidLookup, null);
});

test('18. Address and PIN code district/state inconsistency detection & mismatch warnings', () => {
  const ggnInfo = { state: 'Haryana', district: 'Gurugram' };

  // Perfectly matching state and district
  const match = detectPinCodeLocationMismatch('122001', 'Haryana', 'Gurugram', ggnInfo);
  assert.equal(match.hasMismatch, false);

  // State mismatch (e.g. Haryana PIN paired with Maharashtra)
  const stateMismatch = detectPinCodeLocationMismatch('122001', 'Maharashtra', 'Gurugram', ggnInfo);
  assert.equal(stateMismatch.hasMismatch, true);
  assert.equal(stateMismatch.type, 'state');
  assert.equal(stateMismatch.expectedState, 'Haryana');
  assert.match(stateMismatch.message || '', /State Inconsistency/);

  // District mismatch (e.g. Gurugram PIN paired with Faridabad)
  const distMismatch = detectPinCodeLocationMismatch('122001', 'Haryana', 'Faridabad', ggnInfo);
  assert.equal(distMismatch.hasMismatch, true);
  assert.equal(distMismatch.type, 'district');
  assert.equal(distMismatch.expectedDistrict, 'Gurugram');

  // Both mismatch
  const bothMismatch = detectPinCodeLocationMismatch('122001', 'Karnataka', 'Bengaluru Urban', ggnInfo);
  assert.equal(bothMismatch.hasMismatch, true);
  assert.equal(bothMismatch.type, 'both');
});

test('19. Delivery serviceability vs. postal validity separation under Pan-India vs. Whitelist policies', () => {
  const configPins: ServiceablePinCode[] = [
    { pincode: '122001', city: 'Gurugram', state: 'Haryana', district: 'Gurugram', isServiceable: true, codAvailable: true },
    { pincode: '400001', city: 'Mumbai', state: 'Maharashtra', district: 'Mumbai', isServiceable: false, codAvailable: false }, // Explicitly blocked
  ];

  // 1. Explicitly blocked PIN is unserviceable under any policy
  const blockedPanIndia = evaluateDeliveryServiceability('400001', configPins, { mode: 'pan_india', defaultCodAvailable: false });
  assert.equal(blockedPanIndia.isServiceable, false);
  assert.equal(blockedPanIndia.status, 'unserviceable');

  // 2. Explicitly whitelisted PIN is serviceable
  const whitelisted = evaluateDeliveryServiceability('122001', configPins, { mode: 'pan_india', defaultCodAvailable: false });
  assert.equal(whitelisted.isServiceable, true);
  assert.equal(whitelisted.codAvailable, true);

  // 3. Unlisted PIN under Pan-India policy is serviceable
  const unlistedPanIndia = evaluateDeliveryServiceability('560034', configPins, { mode: 'pan_india', defaultCodAvailable: false });
  assert.equal(unlistedPanIndia.isServiceable, true);
  assert.equal(unlistedPanIndia.status, 'serviceable');

  // 4. Unlisted PIN under Whitelist policy is unserviceable
  const unlistedWhitelist = evaluateDeliveryServiceability('560034', configPins, { mode: 'whitelist', defaultCodAvailable: false });
  assert.equal(unlistedWhitelist.isServiceable, false);
  assert.equal(unlistedWhitelist.status, 'unserviceable');
});

test('20. 8-part Indian address collection and comprehensive formatting', () => {
  const fullAddress = {
    fullName: 'Ananya Sharma',
    mobile: '9876543210',
    houseFlat: 'Flat 402, Tower B',
    street: 'Galleria Market Road',
    locality: 'DLF Phase 4',
    landmark: 'Opposite DLF Club',
    city: 'Gurugram',
    district: 'Gurugram',
    state: 'Haryana',
    pincode: '122009',
    deliveryInstructions: 'Leave with reception gate keeper',
  };

  const validation = validateCheckoutAddress(
    fullAddress,
    SAMPLE_PINS,
    DEFAULT_DELIVERY_POLICY,
    { state: 'Haryana', district: 'Gurugram' }
  );
  assert.equal(validation.valid, true);
  assert.equal(validation.mismatchWarning, undefined);

  const formatted = formatCompleteDeliveryAddress(fullAddress);
  assert.ok(formatted.includes('Flat 402, Tower B'));
  assert.ok(formatted.includes('Galleria Market Road'));
  assert.ok(formatted.includes('DLF Phase 4'));
  assert.ok(formatted.includes('Near Opposite DLF Club'));
  assert.ok(formatted.includes('Gurugram'));
  assert.ok(formatted.includes('Haryana - 122009'));
});

test('21. Smart Cart Combo Offers evaluation and server checkout discount deduction', () => {
  // 1. Dainty Duo offer (2 or more hair accessories / jewellery items gives ₹50 discount)
  const cartItems = [
    { productId: 'prod-pearl-claw', quantity: 1, categorySlug: 'hair-accessories', unitPricePaise: 24900 },
    { productId: 'prod-silk-scrunchie-trio', quantity: 1, categorySlug: 'hair-accessories', unitPricePaise: 19900 },
  ];
  const evalResult = evaluateCartComboOffers(cartItems, DEFAULT_COMBO_OFFERS);
  assert.equal(evalResult.appliedCombos.length, 1);
  assert.equal(evalResult.appliedCombos[0].comboId, 'combo-accessories-duo');
  assert.equal(evalResult.totalComboDiscountPaise, 5000); // ₹50 off

  // 2. Full checkout totals computation with combo discount applied server-side
  const catMap = new Map<string, 'active' | 'coming-soon'>([['hair-accessories', 'active']]);
  const prodMap = new Map<string, DomainProduct>([
    ['prod-pearl-claw', ACTIVE_CLAW],
    ['prod-silk-scrunchie-trio', {
      ...ACTIVE_CLAW,
      id: 'prod-silk-scrunchie-trio',
      name: 'Mulberry Silk Scrunchie Trio',
      sellingPricePaise: 19900,
      stockQty: 15,
      reservedQty: 0,
    }],
  ]);
  const varMap = new Map<string, DomainVariant>();

  const checkoutCalc = computeServerSideCheckoutTotals(
    [
      { productId: 'prod-pearl-claw', quantity: 1 },
      { productId: 'prod-silk-scrunchie-trio', quantity: 1 },
    ],
    prodMap,
    varMap,
    catMap,
    DEFAULT_SHIPPING_RULES,
    DEFAULT_COMBO_OFFERS
  );

  assert.equal(checkoutCalc.valid, true);
  assert.equal(checkoutCalc.subtotalPaise, 44800); // 249 + 199 = 448
  assert.equal(checkoutCalc.comboDiscountPaise, 5000); // 50 off
  assert.equal(checkoutCalc.appliedCombos.length, 1);
  // Net subtotal = 44800 - 5000 = 39800 (< ₹499 tier 1, so shipping fee = ₹59)
  assert.equal(checkoutCalc.shippingFeePaise, 5900);
  assert.equal(checkoutCalc.totalPaise, 39800 + 5900);
});

test('22. Free-shipping progress calculation across order threshold boundaries', () => {
  // Below threshold: ₹400 subtotal, threshold ₹999
  const p1 = calculateFreeShippingProgress(40000, 99900);
  assert.equal(p1.qualifiesForFreeShipping, false);
  assert.equal(p1.amountNeededPaise, 59900);
  assert.equal(p1.progressPercentage, 40);
  assert.ok(p1.message.includes('Add ₹599 more'));

  // Exactly at threshold: ₹999 subtotal
  const p2 = calculateFreeShippingProgress(99900, 99900);
  assert.equal(p2.qualifiesForFreeShipping, true);
  assert.equal(p2.amountNeededPaise, 0);
  assert.equal(p2.progressPercentage, 100);
  assert.ok(p2.message.includes('FREE Delivery across India'));

  // Well above threshold: ₹1,500 subtotal
  const p3 = calculateFreeShippingProgress(150000, 99900);
  assert.equal(p3.qualifiesForFreeShipping, true);
  assert.equal(p3.progressPercentage, 100);
});

test('23. Gift personalization validation and WhatsApp message formatting', () => {
  // 1. Non-gift input
  const nonGift = validateGiftPersonalization({ isGift: false });
  assert.equal(nonGift.isValid, true);
  assert.equal(nonGift.sanitized.isGift, false);
  assert.equal(formatGiftPersonalizationForWhatsApp(nonGift.sanitized), '');

  // 2. Valid gift input with recipient, occasion, and note
  const giftInput = {
    isGift: true,
    recipientName: 'Diya Sen',
    occasion: 'Birthday',
    giftNote: 'Wishing you the happiest birthday full of smiles and sparkles! Love, Rhea',
  };
  const giftVal = validateGiftPersonalization(giftInput);
  assert.equal(giftVal.isValid, true);
  assert.equal(giftVal.sanitized.recipientName, 'Diya Sen');
  assert.equal(giftVal.sanitized.occasion, 'Birthday');

  const formattedWa = formatGiftPersonalizationForWhatsApp(giftVal.sanitized);
  assert.ok(formattedWa.includes('Diya Sen'));
  assert.ok(formattedWa.includes('Birthday'));
  assert.ok(formattedWa.includes('Wishing you the happiest birthday'));

  // 3. WhatsApp order message integration with gift and combo discount
  const waOrderMsg = buildCustomerOrderWhatsAppMessage({
    orderNumber: 'PC-2026-1050',
    customerName: 'Rhea Sen',
    customerMobile: '9876543210',
    address: {
      houseFlat: 'A-201',
      streetLocality: 'Sector 43',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122003',
    },
    items: [
      { productName: 'Rose Gold Pearl Hair Claw', quantity: 2, unitPricePaise: 24900, lineTotalPaise: 49800 },
    ],
    subtotalPaise: 49800,
    comboDiscountPaise: 5000,
    shippingFeePaise: 3900,
    totalPaise: 48700,
    giftPersonalization: giftVal.sanitized,
  });

  assert.ok(waOrderMsg.includes('PC-2026-1050'));
  assert.ok(waOrderMsg.includes('Combo Discount: -₹50'));
  assert.ok(waOrderMsg.includes('Diya Sen'));
  assert.ok(waOrderMsg.includes('Please tap Send in WhatsApp'));
});

test('24. Unguessable order access token generation and PII masking (phone, address, email)', () => {
  // 1. Secure token generation
  const tok1 = generateOrderAccessToken();
  const tok2 = generateOrderAccessToken();
  assert.ok(tok1.startsWith('pc_tok_'));
  assert.ok(tok1.length > 20);
  assert.notEqual(tok1, tok2);

  // 2. Mobile masking (never expose full mobile number publicly)
  const maskedMobile = maskCustomerMobile('9876543210');
  assert.equal(maskedMobile, '+91 98****10');

  // 3. Address masking (hide house/flat number for guest tracking)
  const maskedAddr = maskCustomerAddress({
    houseFlat: 'Flat 502, Wing C, Sky Heights',
    locality: 'Sector 54',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122011',
  });
  assert.equal(maskedAddr.maskedHouseFlat, 'Residential Address (Protected)');
  assert.ok(maskedAddr.maskedSummary.includes('Sector 54, Gurugram, Haryana - 122011'));
  assert.ok(!maskedAddr.maskedSummary.includes('Flat 502'));

  // 4. Email masking
  const maskedEmail = maskCustomerEmail('aarav.sharma@example.com');
  assert.equal(maskedEmail, 'a***a@example.com');
});

test('25. Verified buyer product review eligibility rules (No unverified reviews)', () => {
  // 1. Eligible order: confirmed/paid order containing the target product
  const eligibleOrder = {
    orderStatus: 'delivered',
    paymentStatus: 'paid',
    items: [{ productId: 'prod-pearl-claw' }, { productId: 'prod-satin-bow-barrette' }],
  };
  const eligibleCheck = canOrderReviewProduct(eligibleOrder, 'prod-pearl-claw');
  assert.equal(eligibleCheck.eligible, true);

  // 2. Ineligible: order does not contain product
  const missingProductCheck = canOrderReviewProduct(eligibleOrder, 'prod-quartz-necklace');
  assert.equal(missingProductCheck.eligible, false);
  assert.ok(missingProductCheck.reason?.includes('does not contain'));

  // 3. Ineligible: unpaid / unconfirmed order
  const unpaidOrder = {
    orderStatus: 'awaiting_payment',
    paymentStatus: 'pending',
    items: [{ productId: 'prod-pearl-claw' }],
  };
  const unpaidCheck = canOrderReviewProduct(unpaidOrder, 'prod-pearl-claw');
  assert.equal(unpaidCheck.eligible, false);
  assert.ok(unpaidCheck.reason?.includes('verified paid and confirmed orders'));
});




