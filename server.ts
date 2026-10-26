import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import {
  db,
  initializeDatabase,
  hashPassword,
  verifyPassword,
  runInTransaction,
  writeAuditLog,
  receiveGoodsTransaction,
  PERMITTED_AVAILABLE_PRODUCT_IMAGES,
  PERMITTED_CATEGORY_IMAGES,
  updateCategoryImage,
  updateProductGallery,
  getCachedPostalPincode,
  savePostalPincodeCache,
  getDeliveryPolicySettings,
  saveDeliveryPolicySettings,
  getProductReviews,
  saveProductReview,
  getAllReviewsForAdmin,
  updateReviewStatus,
  getComboOffersSettings,
  saveComboOffersSettings,
  getOrderByAccessToken,
} from './src/server/db';
import {
  DEFAULT_SHIPPING_RULES,
  DEFAULT_DELIVERY_POLICY,
  DEFAULT_COMBO_OFFERS,
  ComboOfferConfig,
  generateOrderAccessToken,
  validateGiftPersonalization,
  formatGiftPersonalizationForWhatsApp,
  maskCustomerMobile,
  maskCustomerAddress,
  maskCustomerEmail,
  canOrderReviewProduct,
  DomainProduct,
  DomainVariant,
  ServiceablePinCode,
  ShippingRuleConfig,
  DeliveryPolicyConfig,
  PostalPincodeLookupResult,
  ReverseGeocodeResult,
  PaymentMode,
  OrderStatus,
  ShipmentStatus,
  checkPinCodeServiceability,
  validateIndianPinCodeFormat,
  lookupBuiltinIndianPostalInfo,
  detectPinCodeLocationMismatch,
  evaluateDeliveryServiceability,
  normalizeIndianStateName,
  ALL_INDIAN_STATES_AND_UTS,
  formatCompleteDeliveryAddress,
  validateCheckoutAddress,
  computeServerSideCheckoutTotals,
  validateProductPublication,
  getInitialPaymentStatusForMode,
  verifyManualPaymentByAdmin,
  verifyOrderLookupPhone,
  getHonestEtaDisplay,
  isDuplicateShipmentEvent,
  canReleaseReservationOnCancel,
  calculateFinancialReport,
  sanitizeSpreadsheetCell,
  normalizeIndianMobile,
  paiseToRupees,
  validateCandidateProductImage,
  applyApprovedProductImageToGallery,
  verifyCatalogueIntegrityUnchanged,
  isProductEligibleForImageImport,
  buildGeminiProductImagePrompt,
  PRODUCT_IMAGE_AUDIT_STATUSES,
  ProductImageAuditStatus,
  CatalogueIntegritySnapshot,
  getInitialOrderStatusForMode,
  buildCustomerOrderWhatsAppMessage,
  buildCustomerOrderWhatsAppUrl,
  buildCustomerWhatsAppContactUrl,
  buildAdminPaymentInstructionWhatsAppMessage,
  buildAdminPaymentInstructionWhatsAppUrl,
  canAdminConfirmOrder,
  buildAdminOrderConfirmationWhatsAppMessage,
  buildAdminOrderConfirmationWhatsAppUrl,
} from './src/shared/domainLogic';

initializeDatabase();

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use('/uploads', express.static(path.resolve('./public/uploads')));

// ============================================================================
// SESSION & RATE LIMITING INFRASTRUCTURE
// ============================================================================

interface AdminSession {
  token: string;
  userId: string;
  email: string;
  fullName: string;
  role: string;
  expiresAt: number;
}

interface CustomerSession {
  token: string;
  customerId: string;
  fullName: string;
  mobile: string;
  email: string | null;
  expiresAt: number;
}

const adminSessions = new Map<string, AdminSession>();
const customerSessions = new Map<string, CustomerSession>();
const loginRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxAttempts = 8, windowMs = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = loginRateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    loginRateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return null;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in to the Pretty Charm Admin Panel.' });
    return;
  }
  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) adminSessions.delete(token);
    res.status(401).json({ error: 'Admin session expired or invalid. Please sign in again.' });
    return;
  }
  (req as any).adminSession = session;
  next();
}

function getCustomerSession(req: Request): CustomerSession | null {
  const token = getBearerToken(req);
  if (!token) return null;
  const session = customerSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) customerSessions.delete(token);
    return null;
  }
  return session;
}

// ============================================================================
// DATABASE HELPER QUERIES
// ============================================================================

function getStoreSettings(): {
  general: Record<string, any>;
  shippingRules: ShippingRuleConfig;
  policies: Record<string, string>;
  deliveryPolicy: DeliveryPolicyConfig;
} {
  const rows = db.prepare('SELECT key, value_json FROM store_settings').all() as Array<{
    key: string;
    value_json: string;
  }>;
  const map = new Map(rows.map((r) => [r.key, JSON.parse(r.value_json)]));
  return {
    general: map.get('general') || {},
    shippingRules: map.get('shipping_rules') || DEFAULT_SHIPPING_RULES,
    policies: map.get('policies') || {},
    deliveryPolicy: map.get('delivery_policy') || DEFAULT_DELIVERY_POLICY,
  };
}

function getAllServiceablePins(includeUnserviceable = true): ServiceablePinCode[] {
  const query = includeUnserviceable
    ? 'SELECT * FROM serviceable_pincodes ORDER BY pincode ASC'
    : 'SELECT * FROM serviceable_pincodes WHERE is_serviceable = 1 ORDER BY pincode ASC';
  const rows = db.prepare(query).all() as any[];
  return rows.map((r) => ({
    pincode: r.pincode,
    city: r.city,
    district: r.district || r.city,
    state: r.state,
    isServiceable: Boolean(r.is_serviceable),
    codAvailable: Boolean(r.cod_available),
    updatedAt: r.updated_at,
  }));
}

function getFormattedCatalogue(includeArchived = false) {
  const categories = db
    .prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC')
    .all() as any[];

  const prodQuery = includeArchived
    ? 'SELECT * FROM products ORDER BY featured DESC, created_at DESC'
    : "SELECT * FROM products WHERE status != 'archived' ORDER BY featured DESC, created_at DESC";
  const productRows = db.prepare(prodQuery).all() as any[];
  const variantRows = db.prepare('SELECT * FROM product_variants ORDER BY created_at ASC').all() as any[];

  const variantsByProduct = new Map<string, any[]>();
  for (const v of variantRows) {
    const arr = variantsByProduct.get(v.product_id) || [];
    arr.push({
      id: v.id,
      productId: v.product_id,
      name: v.name,
      sku: v.sku,
      priceDeltaPaise: v.price_delta_paise,
      stockQty: v.stock_qty,
      reservedQty: v.reserved_qty,
      availableQty: Math.max(0, v.stock_qty - v.reserved_qty),
    });
    variantsByProduct.set(v.product_id, arr);
  }

  const products = productRows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    categorySlug: p.category_slug,
    tags: JSON.parse(p.tags_json || '[]'),
    images: JSON.parse(p.images_json || '[]'),
    sku: p.sku,
    sellingPricePaise: p.selling_price_paise,
    purchaseCostPaise: p.purchase_cost_paise,
    packagingCostPaise: p.packaging_cost_paise,
    stockQty: p.stock_qty,
    reservedQty: p.reserved_qty,
    availableQty: Math.max(0, p.stock_qty - p.reserved_qty),
    lowStockThreshold: p.low_stock_threshold,
    status: p.status,
    confirmedByAdmin: Boolean(p.confirmed_by_admin),
    featured: Boolean(p.featured),
    variants: variantsByProduct.get(p.id) || [],
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.image_url,
      status: c.status,
      sortOrder: c.sort_order,
    })),
    products,
  };
}

// ============================================================================
// PUBLIC STOREFRONT & CHECKOUT ENDPOINTS
// ============================================================================

app.get('/api/storefront', (_req, res) => {
  const { categories, products } = getFormattedCatalogue(false);
  const settings = getStoreSettings();
  const pincodes = getAllServiceablePins();

  // Strip internal cost fields from public storefront response
  const publicProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    categorySlug: p.categorySlug,
    tags: p.tags,
    images: p.images,
    sku: p.sku,
    sellingPricePaise: p.sellingPricePaise,
    availableQty: p.availableQty,
    lowStockThreshold: p.lowStockThreshold,
    status: p.status,
    confirmedByAdmin: p.confirmedByAdmin,
    featured: p.featured,
    variants: p.variants,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  res.json({
    categories,
    products: publicProducts,
    shippingRules: settings.shippingRules,
    generalSettings: {
      storeName: settings.general.storeName,
      tagline: settings.general.tagline,
      shippingOrigin: settings.general.shippingOrigin,
      supportWhatsapp: settings.general.supportWhatsapp,
      supportEmail: settings.general.supportEmail,
      instagramHandle: settings.general.instagramHandle,
      announcementBanner: settings.general.announcementBanner,
      paymentMode: settings.general.paymentMode || 'whatsapp',
      manualPaymentUpiId: settings.general.manualPaymentUpiId,
      manualPaymentLink: settings.general.manualPaymentLink || '',
      manualPaymentQrUrl: settings.general.manualPaymentQrUrl || '',
      manualPaymentInstructions: settings.general.manualPaymentInstructions,
    },
    policies: settings.policies,
    deliveryPolicy: settings.deliveryPolicy,
    comboOffers: getComboOffersSettings(),
    serviceablePincodes: pincodes.filter((p) => p.isServiceable),
  });
});

/**
 * Validates 6-digit Indian PIN, checks SQLite cache, queries India Post API,
 * falls back to offline registry, and checks delivery serviceability policy.
 */
async function lookupPostalPincodeHelper(pincode: string): Promise<PostalPincodeLookupResult> {
  const cleanPin = String(pincode || '').trim();
  if (!validateIndianPinCodeFormat(cleanPin)) {
    return {
      pincode: cleanPin,
      isValid: false,
      isServiceable: false,
      state: '',
      district: '',
      city: '',
      postOffices: [],
      source: 'api_failed',
      serviceabilityMessage: 'PIN code must be exactly 6 digits (numeric 1-9 followed by 5 digits).',
    };
  }

  // 1. Check SQLite cache
  const cached = getCachedPostalPincode(cleanPin);
  let resolvedState = cached?.state || '';
  let resolvedDistrict = cached?.district || '';
  let resolvedCity = cached?.city || '';
  let resolvedPostOffices = cached?.postOffices || [];
  let resolvedOfficeType = cached?.officeType;
  let source: PostalPincodeLookupResult['source'] = cached ? 'sqlite_cache' : 'api_failed';

  if (!cached) {
    // 2. Query official India Post OGD endpoint (api.postalpincode.in)
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'PrettyCharmECommerce/2.0 (Gurugram, India; support@prettycharm.in)',
        },
        signal: AbortSignal.timeout(4500),
      });
      if (response.ok) {
        const data = (await response.json()) as any[];
        if (
          Array.isArray(data) &&
          data.length > 0 &&
          data[0].Status === 'Success' &&
          Array.isArray(data[0].PostOffice) &&
          data[0].PostOffice.length > 0
        ) {
          const poList = data[0].PostOffice;
          const poNames = poList.map((po: any) => po.Name).filter(Boolean);
          const firstPo = poList[0];
          resolvedState = normalizeIndianStateName(firstPo.State || '');
          resolvedDistrict = (firstPo.District || '').trim();
          resolvedCity = (firstPo.Circle || firstPo.District || '').trim();
          resolvedPostOffices = poNames;
          resolvedOfficeType = firstPo.BranchType;
          source = 'india_post_api';

          // Save to persistent SQLite cache
          savePostalPincodeCache(cleanPin, {
            pincode: cleanPin,
            state: resolvedState,
            district: resolvedDistrict,
            city: resolvedCity,
            postOffices: resolvedPostOffices,
            officeType: resolvedOfficeType,
          });
        }
      }
    } catch (err: any) {
      console.warn(`[PostalLookup] External India Post API lookup error for ${cleanPin}:`, err?.message || err);
    }
  }

  // 3. Fallback to built-in offline registry if API failed and not in cache
  if (!resolvedState) {
    const builtin = lookupBuiltinIndianPostalInfo(cleanPin);
    if (builtin) {
      resolvedState = builtin.state ?? '';
      resolvedDistrict = builtin.district ?? '';
      resolvedCity = builtin.city ?? '';
      resolvedPostOffices = builtin.postOffices;
      resolvedOfficeType = builtin.officeType;
      source = 'builtin_fallback';
    }
  }

  const isValid = Boolean(resolvedState && resolvedDistrict);
  const deliveryPolicy = getDeliveryPolicySettings();
  const serviceablePins = getAllServiceablePins(true);

  const servResult = evaluateDeliveryServiceability(
    cleanPin,
    serviceablePins,
    deliveryPolicy
  );

  return {
    pincode: cleanPin,
    isValid,
    state: resolvedState,
    district: resolvedDistrict,
    city: resolvedCity,
    postOffices: resolvedPostOffices,
    officeType: resolvedOfficeType,
    isServiceable: servResult.isServiceable,
    codAvailable: servResult.codAvailable,
    source,
    serviceabilityMessage: servResult.message,
  };
}

// Postal PIN code lookup with postal verification and delivery serviceability
app.get('/api/pincode/lookup/:pincode', async (req, res) => {
  try {
    const result = await lookupPostalPincodeHelper(req.params.pincode);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      pincode: req.params.pincode,
      isValid: false,
      isServiceable: false,
      state: '',
      district: '',
      city: '',
      postOffices: [],
      source: 'api_failed',
      serviceabilityMessage: 'Error looking up PIN code. Please verify details manually.',
    });
  }
});

// Legacy / quick check endpoint (enhanced with postal resolver)
app.get('/api/pincode/:pincode', async (req, res) => {
  try {
    const result = await lookupPostalPincodeHelper(req.params.pincode);
    res.json({
      pincode: result.pincode,
      isServiceable: result.isServiceable,
      city: result.city,
      district: result.district,
      state: result.state,
      codAvailable: result.codAvailable,
      isValid: result.isValid,
      postOffices: result.postOffices,
      serviceabilityMessage: result.serviceabilityMessage,
    });
  } catch (_err) {
    const pins = getAllServiceablePins();
    const result = checkPinCodeServiceability(req.params.pincode, pins);
    res.json(result);
  }
});

// Optional GPS-assisted reverse geocoding
// Precise coordinates are evaluated on-the-fly and NEVER stored in the database.
app.post('/api/location/reverse-geocode', async (req, res) => {
  try {
    const { latitude, longitude } = req.body || {};
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      res.status(400).json({
        success: false,
        error: 'Invalid coordinates provided. Latitude must be between -90 and 90, longitude between -180 and 180.',
      });
      return;
    }

    // Call OpenStreetMap Nominatim reverse geocoding
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`;
    let nominatimData: any = null;
    try {
      const resp = await fetch(nominatimUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'PrettyCharmECommerce/2.0 (Gurugram, India; support@prettycharm.in)',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        nominatimData = await resp.json();
      }
    } catch (fetchErr: any) {
      console.warn('[ReverseGeocode] Nominatim fetch error:', fetchErr?.message || fetchErr);
    }

    if (!nominatimData || !nominatimData.address) {
      res.status(502).json({
        success: false,
        error: 'Unable to resolve reverse geocoding for this location. Please enter your address details manually.',
      });
      return;
    }

    const addr = nominatimData.address;
    const rawPostcode = String(addr.postcode || '').trim();
    const cleanedPin = rawPostcode.replace(/\s+/g, '');
    const estimatedPincode = validateIndianPinCodeFormat(cleanedPin) ? cleanedPin : null;

    const estimatedState = normalizeIndianStateName(addr.state || addr.state_district || '');
    const estimatedDistrict = (addr.state_district || addr.county || addr.district || addr.city || '').trim();
    const estimatedCity = (addr.city || addr.town || addr.village || addr.suburb || addr.municipality || '').trim();
    const estimatedLocality = (addr.suburb || addr.neighbourhood || addr.residential || addr.subdivision || '').trim();
    const estimatedStreet = (addr.road || addr.pedestrian || addr.footway || '').trim();

    let postalInfo: PostalPincodeLookupResult | null = null;
    if (estimatedPincode) {
      postalInfo = await lookupPostalPincodeHelper(estimatedPincode);
    }

    res.json({
      success: true,
      estimatedPincode,
      estimatedState: postalInfo?.state || estimatedState,
      estimatedDistrict: postalInfo?.district || estimatedDistrict,
      estimatedCity: estimatedCity || postalInfo?.city || '',
      estimatedLocality,
      estimatedStreet,
      displayName: nominatimData.display_name || '',
      postalInfo,
      disclaimer: 'GPS and PIN code matching estimate your geographic area but do not prove residence at the entered address. Please verify your exact house/flat and street number.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred during location estimation. Please enter your address manually.',
    });
  }
});

app.post('/api/checkout/validate', (req, res) => {
  const { items } = req.body || {};
  const { categories, products } = getFormattedCatalogue(true);
  const settings = getStoreSettings();

  const prodMap = new Map<string, DomainProduct>();
  const varMap = new Map<string, DomainVariant>();
  for (const p of products) {
    prodMap.set(p.id, p);
    for (const v of p.variants) {
      varMap.set(v.id, v);
    }
  }
  const catMap = new Map<string, 'active' | 'coming-soon'>(
    categories.map((c) => [c.slug, c.status as 'active' | 'coming-soon'])
  );

  const combos = getComboOffersSettings();
  const calc = computeServerSideCheckoutTotals(
    items || [],
    prodMap,
    varMap,
    catMap,
    settings.shippingRules,
    combos
  );

  if (!calc.valid) {
    res.status(400).json({ valid: false, error: calc.error });
    return;
  }

  res.json({
    valid: true,
    subtotalPaise: calc.subtotalPaise,
    comboDiscountPaise: calc.comboDiscountPaise,
    appliedCombos: calc.appliedCombos,
    shippingFeePaise: calc.shippingFeePaise,
    totalPaise: calc.totalPaise,
    items: calc.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      productName: i.productName,
      variantName: i.variantName,
      sku: i.sku,
      quantity: i.quantity,
      unitPricePaise: i.unitPricePaise,
      lineTotalPaise: i.lineTotalPaise,
    })),
  });
});

app.post('/api/checkout', (req, res) => {
  try {
    const { items, address, idempotencyKey, customerNotes, giftPersonalization } = req.body || {};

    const customerSession = getCustomerSession(req);
    const settings = getStoreSettings();
    const rawPaymentMode = settings.general.paymentMode || 'whatsapp';
    const paymentMode: PaymentMode = rawPaymentMode === 'demo' ? 'whatsapp' : (rawPaymentMode as PaymentMode);
    const storeWhatsapp = settings.general.supportWhatsapp || '919000000000';

    if (idempotencyKey && typeof idempotencyKey === 'string') {
      const existingOrder = db
        .prepare('SELECT * FROM orders WHERE idempotency_key = ?')
        .get(idempotencyKey.trim()) as any;
      if (existingOrder) {
        const existingItems = db
          .prepare('SELECT product_name, variant_name, quantity, unit_price_paise, line_total_paise FROM order_items WHERE order_id = ?')
          .all(existingOrder.id) as any[];
        const parsedAddr = JSON.parse(existingOrder.shipping_address_json || '{}');
        const parsedGift = existingOrder.gift_personalization_json
          ? JSON.parse(existingOrder.gift_personalization_json)
          : null;
        const waPayload = {
          orderNumber: existingOrder.order_number,
          customerName: existingOrder.customer_name,
          customerMobile: existingOrder.customer_mobile,
          address: parsedAddr,
          items: existingItems.map((i) => ({
            productName: i.product_name,
            variantName: i.variant_name,
            quantity: i.quantity,
            unitPricePaise: i.unit_price_paise,
            lineTotalPaise: i.line_total_paise,
          })),
          subtotalPaise: existingOrder.subtotal_paise,
          shippingFeePaise: existingOrder.shipping_fee_paise,
          totalPaise: existingOrder.total_paise,
          giftPersonalization: parsedGift?.isGift ? parsedGift : null,
        };
        res.json({
          duplicate: true,
          orderId: existingOrder.id,
          orderNumber: existingOrder.order_number,
          orderAccessToken: existingOrder.order_access_token,
          orderStatus: existingOrder.order_status,
          paymentStatus: existingOrder.payment_status,
          paymentMode: existingOrder.payment_mode,
          subtotalPaise: existingOrder.subtotal_paise,
          shippingFeePaise: existingOrder.shipping_fee_paise,
          totalPaise: existingOrder.total_paise,
          giftPersonalization: parsedGift?.isGift ? parsedGift : null,
          items: waPayload.items,
          shippingAddress: parsedAddr,
          whatsappOrderUrl: buildCustomerOrderWhatsAppUrl(storeWhatsapp, waPayload),
          whatsappOrderMessage: buildCustomerOrderWhatsAppMessage(waPayload),
          createdAt: existingOrder.created_at,
        });
        return;
      }
    }

    const pins = getAllServiceablePins();
    const deliveryPolicy = getDeliveryPolicySettings();
    const addrCheck = validateCheckoutAddress(address || {}, pins, deliveryPolicy);
    if (!addrCheck.valid) {
      res.status(400).json({ error: addrCheck.errors.join(' ') });
      return;
    }

    const createdOrder = runInTransaction(() => {
      const { categories, products } = getFormattedCatalogue(true);
      const prodMap = new Map<string, DomainProduct>();
      const varMap = new Map<string, DomainVariant>();
      for (const p of products) {
        prodMap.set(p.id, p);
        for (const v of p.variants) {
          varMap.set(v.id, v);
        }
      }
      const catMap = new Map<string, 'active' | 'coming-soon'>(
        categories.map((c) => [c.slug, c.status as 'active' | 'coming-soon'])
      );

      const combos = getComboOffersSettings();
      const calc = computeServerSideCheckoutTotals(
        items || [],
        prodMap,
        varMap,
        catMap,
        settings.shippingRules,
        combos
      );

      if (!calc.valid) {
        throw new Error(calc.error || 'Cart validation failed');
      }

      const giftVal = validateGiftPersonalization(giftPersonalization);
      const cleanGift = giftVal.sanitized;
      const orderAccessToken = generateOrderAccessToken();

      const now = new Date().toISOString();
      const orderSeq =
        (db.prepare('SELECT COUNT(*) as c FROM orders').get() as { c: number }).c + 1001;
      const orderNumber = `PC-${new Date().getFullYear()}-${orderSeq}`;
      const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const normalizedMobile = normalizeIndianMobile(address.mobile);

      // Upsert or link customer record
      let customerId = customerSession?.customerId || null;
      if (!customerId) {
        const existingCust = db
          .prepare('SELECT id FROM customers WHERE mobile = ?')
          .get(normalizedMobile) as { id: string } | undefined;
        if (existingCust) {
          customerId = existingCust.id;
        } else {
          customerId = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          db.prepare(`
            INSERT INTO customers (id, full_name, mobile, email, created_at, updated_at)
            VALUES (?, ?, ?, NULL, ?, ?)
          `).run(customerId, address.fullName.trim(), normalizedMobile, now, now);
        }
      }

      // Reserve stock atomically for each item
      for (const line of calc.items) {
        const currentProd = db
          .prepare('SELECT stock_qty, reserved_qty, status, name FROM products WHERE id = ?')
          .get(line.productId) as any;
        if (!currentProd || currentProd.status !== 'active') {
          throw new Error(`Product "${line.productName}" is no longer available.`);
        }
        const avail = currentProd.stock_qty - currentProd.reserved_qty;
        if (avail < line.quantity) {
          throw new Error(`Insufficient stock for "${line.productName}". Available: ${avail}`);
        }

        const newReserved = currentProd.reserved_qty + line.quantity;
        db.prepare('UPDATE products SET reserved_qty = ?, updated_at = ? WHERE id = ?').run(
          newReserved,
          now,
          line.productId
        );

        if (line.variantId) {
          const currentVar = db
            .prepare('SELECT stock_qty, reserved_qty FROM product_variants WHERE id = ?')
            .get(line.variantId) as any;
          if (!currentVar || currentVar.stock_qty - currentVar.reserved_qty < line.quantity) {
            throw new Error(`Insufficient variant stock for "${line.productName}".`);
          }
          db.prepare(
            'UPDATE product_variants SET reserved_qty = reserved_qty + ?, updated_at = ? WHERE id = ?'
          ).run(line.quantity, now, line.variantId);
        }

        db.prepare(`
          INSERT INTO inventory_movements (
            id, product_id, variant_id, movement_type, quantity_delta, balance_after, unit_cost_paise, reference_id, reason, actor_email, created_at
          ) VALUES (?, ?, ?, 'reserved', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          line.productId,
          line.variantId,
          -line.quantity,
          currentProd.stock_qty - newReserved,
          line.unitCostSnapshotPaise,
          orderNumber,
          `Reserved ${line.quantity} unit(s) for Order ${orderNumber}`,
          normalizedMobile,
          now
        );
      }

      const initialPaymentStatus = 'pending';
      const initialOrderStatus = 'awaiting_payment';
      const statusHistory = [
        {
          status: initialOrderStatus,
          timestamp: now,
          note: `Order saved in database prior to WhatsApp handoff. Initial payment_status=${initialPaymentStatus}, order_status=${initialOrderStatus}. Stock reserved.`,
        },
      ];

      const cleanAddress = {
        fullName: address.fullName.trim(),
        mobile: normalizedMobile,
        houseFlat: (address.houseFlat || '').trim(),
        street: (address.street || address.streetLocality || '').trim(),
        locality: (address.locality || address.streetLocality || '').trim(),
        streetLocality: (address.streetLocality || `${address.street || ''}, ${address.locality || ''}`).replace(/^,\s*|,\s*$/g, '').trim(),
        landmark: (address.landmark || '').trim(),
        city: (address.city || '').trim(),
        district: (address.district || address.city || '').trim(),
        state: (address.state || '').trim(),
        pincode: address.pincode.trim(),
        selectedPostOffice: (address.selectedPostOffice || '').trim(),
        deliveryInstructions: (address.deliveryInstructions || customerNotes || '').trim(),
      };

      db.prepare(`
        INSERT INTO orders (
          id, order_number, order_access_token, idempotency_key, customer_id, customer_name, customer_mobile, customer_email,
          shipping_address_json, gift_personalization_json, subtotal_paise, shipping_fee_paise, total_paise,
          order_status, payment_mode, payment_status, shipment_status,
          status_history_json, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Shipped', ?, ?, ?, ?)
      `).run(
        orderId,
        orderNumber,
        orderAccessToken,
        idempotencyKey ? idempotencyKey.trim() : null,
        customerId,
        cleanAddress.fullName,
        cleanAddress.mobile,
        customerSession?.email || null,
        JSON.stringify(cleanAddress),
        JSON.stringify(cleanGift),
        calc.subtotalPaise,
        calc.shippingFeePaise,
        calc.totalPaise,
        initialOrderStatus,
        paymentMode,
        initialPaymentStatus,
        JSON.stringify(statusHistory),
        cleanAddress.deliveryInstructions,
        now,
        now
      );

      for (const line of calc.items) {
        db.prepare(`
          INSERT INTO order_items (
            id, order_id, product_id, variant_id, product_name, variant_name, sku,
            quantity, unit_price_paise, line_total_paise, unit_cost_snapshot_paise, packaging_cost_snapshot_paise
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `oi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          orderId,
          line.productId,
          line.variantId,
          line.productName,
          line.variantName,
          line.sku,
          line.quantity,
          line.unitPricePaise,
          line.lineTotalPaise,
          line.unitCostSnapshotPaise,
          line.packagingCostSnapshotPaise
        );
      }

      db.prepare(`
        INSERT INTO payment_records (
          id, order_id, payment_mode, status, amount_paise, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId,
        paymentMode,
        initialPaymentStatus,
        calc.totalPaise,
        'Order saved — awaiting customer WhatsApp message & admin verification of bank/UPI transaction.',
        now,
        now
      );

      db.prepare(`
        INSERT INTO shipment_records (
          id, order_id, shipment_status, last_updated_at, created_at
        ) VALUES (?, ?, 'Not Shipped', ?, ?)
      `).run(`shp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, orderId, now, now);

      const waPayload = {
        orderNumber,
        customerName: cleanAddress.fullName,
        customerMobile: cleanAddress.mobile,
        address: cleanAddress,
        items: calc.items.map((i) => ({
          productName: i.productName,
          variantName: i.variantName,
          quantity: i.quantity,
          unitPricePaise: i.unitPricePaise,
          lineTotalPaise: i.lineTotalPaise,
        })),
        subtotalPaise: calc.subtotalPaise,
        comboDiscountPaise: calc.comboDiscountPaise,
        shippingFeePaise: calc.shippingFeePaise,
        totalPaise: calc.totalPaise,
        giftPersonalization: cleanGift.isGift ? cleanGift : null,
      };

      return {
        orderId,
        orderNumber,
        orderAccessToken,
        orderStatus: initialOrderStatus,
        paymentMode,
        paymentStatus: initialPaymentStatus,
        shipmentStatus: 'Not Shipped',
        subtotalPaise: calc.subtotalPaise,
        comboDiscountPaise: calc.comboDiscountPaise,
        appliedCombos: calc.appliedCombos,
        shippingFeePaise: calc.shippingFeePaise,
        totalPaise: calc.totalPaise,
        giftPersonalization: cleanGift.isGift ? cleanGift : null,
        items: calc.items,
        shippingAddress: cleanAddress,
        whatsappOrderUrl: buildCustomerOrderWhatsAppUrl(storeWhatsapp, waPayload),
        whatsappOrderMessage: buildCustomerOrderWhatsAppMessage(waPayload),
        createdAt: now,
      };
    });

    res.status(201).json(createdOrder);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Unable to process checkout.' });
  }
});

// Submit manual payment reference (Customer submits UTR; status remains Awaiting Verification until Admin checks bank)
app.post('/api/orders/:orderNumber/payment-reference', (req, res) => {
  const { mobile, customerReferenceUtr } = req.body || {};
  const orderNumber = String(req.params.orderNumber || '').trim().toUpperCase();

  const order = db
    .prepare('SELECT * FROM orders WHERE UPPER(order_number) = ?')
    .get(orderNumber) as any;
  if (!order || !verifyOrderLookupPhone(order.customer_mobile, mobile || '')) {
    res.status(404).json({ error: 'Order not found or mobile number does not match.' });
    return;
  }

  if (order.payment_mode === 'demo') {
    res.status(400).json({
      error: 'Store is currently in Demo Payment Mode. Demo orders cannot be marked paid or accept real UTR references.',
    });
    return;
  }

  const cleanRef = String(customerReferenceUtr || '').trim();
  if (cleanRef.length < 6) {
    res.status(400).json({ error: 'Please enter a valid 6+ character payment reference / UTR number.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE payment_records
    SET customer_submitted_ref = ?, status = 'Awaiting Verification', updated_at = ?
    WHERE order_id = ?
  `).run(cleanRef, now, order.id);

  db.prepare(`
    UPDATE orders
    SET payment_status = 'Awaiting Verification', updated_at = ?
    WHERE id = ?
  `).run(now, order.id);

  res.json({
    orderNumber: order.order_number,
    paymentStatus: 'Awaiting Verification',
    message:
      'Reference recorded. Your order remains Awaiting Verification until the store owner verifies receipt in the bank account.',
  });
});

// Helper to format tracked order response with privacy protection
function formatTrackedOrderResponse(
  order: any,
  items: any[],
  shipment: any,
  events: any[],
  payments: any[],
  storeWhatsapp: string
) {
  const maskedMobile = maskCustomerMobile(order.customer_mobile);
  const maskedAddress = maskCustomerAddress(order.shipping_address_json);
  const maskedEmail = maskCustomerEmail(order.customer_email);
  const giftPersonalization = order.gift_personalization_json
    ? JSON.parse(order.gift_personalization_json)
    : null;

  const mappedItems = items.map((i: any) => ({
    id: i.id,
    productId: i.product_id,
    productName: i.product_name,
    variantName: i.variant_name,
    quantity: i.quantity,
    unitPricePaise: i.unit_price_paise,
    lineTotalPaise: i.line_total_paise,
  }));

  const waPayload = {
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerMobile: order.customer_mobile,
    address: JSON.parse(order.shipping_address_json || '{}'),
    items: mappedItems,
    subtotalPaise: order.subtotal_paise,
    shippingFeePaise: order.shipping_fee_paise,
    totalPaise: order.total_paise,
    giftPersonalization: giftPersonalization?.isGift ? giftPersonalization : null,
  };

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    orderAccessToken: order.order_access_token,
    customerName: order.customer_name,
    customerMobile: maskedMobile,
    customerEmail: maskedEmail,
    shippingAddress: maskedAddress,
    giftPersonalization: giftPersonalization?.isGift ? giftPersonalization : null,
    orderStatus: order.order_status,
    paymentMode: order.payment_mode,
    paymentStatus: order.payment_status,
    shipmentStatus: shipment?.shipment_status || order.shipment_status,
    subtotalPaise: order.subtotal_paise,
    shippingFeePaise: order.shipping_fee_paise,
    totalPaise: order.total_paise,
    createdAt: order.created_at,
    statusHistory: JSON.parse(order.status_history_json || '[]'),
    items: mappedItems,
    whatsappOrderUrl: buildCustomerOrderWhatsAppUrl(storeWhatsapp, waPayload),
    whatsappOrderMessage: buildCustomerOrderWhatsAppMessage(waPayload),
    shipment: {
      courierName: shipment?.courier_name || null,
      awbNumber: shipment?.awb_number || null,
      trackingUrl: shipment?.tracking_url || null,
      pickupDate: shipment?.pickup_date || null,
      estimatedDelivery: getHonestEtaDisplay(shipment?.estimated_delivery_date),
      lastUpdatedAt: shipment?.last_updated_at || order.updated_at,
      events: (events || []).map((e: any) => ({
        eventCode: e.event_code,
        statusLabel: e.status_label,
        location: e.location,
        timestamp: e.event_timestamp || e.timestamp,
      })),
    },
    payments: (payments || []).map((p: any) => ({
      id: p.id,
      paymentMode: p.payment_mode,
      status: p.status,
      amountPaise: p.amount_paise,
      createdAt: p.created_at,
    })),
  };
}

// 1-Click Guest Order Tracking by secure token
app.get('/api/orders/track/:token', (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) {
    res.status(400).json({ error: 'Order access token is required.' });
    return;
  }
  const result = getOrderByAccessToken(token);
  if (!result || !result.order) {
    res.status(404).json({ error: 'Order not found or invalid access token.' });
    return;
  }
  const settings = getStoreSettings();
  const storeWhatsapp = settings.general.supportWhatsapp || '919000000000';
  res.json(
    formatTrackedOrderResponse(
      result.order,
      result.items,
      result.shipment,
      result.shipmentEvents,
      result.payments,
      storeWhatsapp
    )
  );
});

// Secure Customer Order Tracking (by Token OR Order Number + Phone)
app.post('/api/orders/track', (req, res) => {
  const { token, orderNumber, mobile } = req.body || {};
  let orderRow: any = null;

  if (token && typeof token === 'string' && token.trim()) {
    orderRow = db.prepare('SELECT * FROM orders WHERE order_access_token = ?').get(token.trim());
  } else if (orderNumber && mobile) {
    const cleanOrderNum = String(orderNumber).trim().toUpperCase();
    const candidate = db.prepare('SELECT * FROM orders WHERE UPPER(order_number) = ?').get(cleanOrderNum) as any;
    if (candidate && verifyOrderLookupPhone(candidate.customer_mobile, String(mobile))) {
      orderRow = candidate;
    }
  }

  if (!orderRow) {
    res.status(404).json({
      error: 'No matching order found. Please check your Order ID and phone number or order tracking link.',
    });
    return;
  }

  const result = getOrderByAccessToken(orderRow.order_access_token);
  if (!result || !result.order) {
    res.status(404).json({ error: 'Order details not found.' });
    return;
  }
  const settings = getStoreSettings();
  const storeWhatsapp = settings.general.supportWhatsapp || '919000000000';
  res.json(
    formatTrackedOrderResponse(
      result.order,
      result.items,
      result.shipment,
      result.shipmentEvents,
      result.payments,
      storeWhatsapp
    )
  );
});

// Product Reviews: Public verified reviews
app.get('/api/products/:productId/reviews', (req, res) => {
  const productId = String(req.params.productId || '').trim();
  const reviews = getProductReviews(productId);
  res.json({ reviews });
});

// Product Reviews: Customer submission (Verified Buyers Only)
app.post('/api/reviews', (req, res) => {
  const { orderNumber, token, mobile, productId, rating, reviewTitle, reviewText } = req.body || {};
  if (!productId || !reviewText || !rating) {
    res.status(400).json({ error: 'Product ID, rating (1-5 stars), and review text are required.' });
    return;
  }
  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    res.status(400).json({ error: 'Rating must be an integer between 1 and 5 stars.' });
    return;
  }

  let orderRow: any = null;
  if (token && typeof token === 'string' && token.trim()) {
    orderRow = db.prepare('SELECT * FROM orders WHERE order_access_token = ?').get(token.trim());
  } else if (orderNumber && mobile) {
    const cleanOrderNum = String(orderNumber).trim().toUpperCase();
    const candidate = db.prepare('SELECT * FROM orders WHERE UPPER(order_number) = ?').get(cleanOrderNum) as any;
    if (candidate && verifyOrderLookupPhone(candidate.customer_mobile, String(mobile))) {
      orderRow = candidate;
    }
  }

  if (!orderRow) {
    res.status(403).json({
      error: 'Reviews are permitted only for verified purchases. Please provide your Order ID and access token or mobile number.',
    });
    return;
  }

  const orderItems = db
    .prepare('SELECT product_id as productId FROM order_items WHERE order_id = ?')
    .all(orderRow.id) as Array<{ productId: string }>;

  const eligibility = canOrderReviewProduct(
    {
      orderStatus: orderRow.order_status,
      paymentStatus: orderRow.payment_status,
      items: orderItems,
    },
    productId
  );

  if (!eligibility.eligible) {
    res.status(403).json({ error: eligibility.reason });
    return;
  }

  const review = saveProductReview({
    productId,
    orderId: orderRow.id,
    orderNumber: orderRow.order_number,
    customerName: orderRow.customer_name,
    rating: numRating,
    reviewTitle: String(reviewTitle || '').trim().slice(0, 100),
    reviewText: String(reviewText).trim().slice(0, 1000),
    isVerifiedPurchase: true,
    status: 'approved',
  });

  res.status(201).json({ success: true, review });
});

// Admin Review Moderation
app.get('/api/admin/reviews', requireAdmin, (_req, res) => {
  const reviews = getAllReviewsForAdmin();
  res.json({ reviews });
});

app.post('/api/admin/reviews/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!['approved', 'pending', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Status must be approved, pending, or rejected.' });
    return;
  }
  updateReviewStatus(req.params.id, status);
  res.json({ success: true, id: req.params.id, status });
});

// Admin Combo Offers Configuration
app.get('/api/admin/combo-offers', requireAdmin, (_req, res) => {
  res.json({ comboOffers: getComboOffersSettings() });
});

app.post('/api/admin/combo-offers', requireAdmin, (req, res) => {
  const { comboOffers } = req.body || {};
  if (!Array.isArray(comboOffers)) {
    res.status(400).json({ error: 'comboOffers must be an array.' });
    return;
  }
  saveComboOffersSettings(comboOffers);
  res.json({ success: true, comboOffers });
});

// ============================================================================
// OPTIONAL CUSTOMER ACCOUNT & ORDER HISTORY ENDPOINTS
// ============================================================================

app.post('/api/customer/register', (req, res) => {
  const { fullName, mobile, email, password } = req.body || {};
  const normMobile = normalizeIndianMobile(mobile || '');
  if (!fullName || fullName.trim().length < 2) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  if (!/^[6-9][0-9]{9}$/.test(normMobile)) {
    res.status(400).json({ error: 'Valid 10-digit Indian mobile number is required.' });
    return;
  }
  if (!password || String(password).length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const now = new Date().toISOString();
  const { hash, salt } = hashPassword(String(password));

  const existing = db.prepare('SELECT * FROM customers WHERE mobile = ?').get(normMobile) as any;
  let customerId = existing?.id;

  if (existing && existing.password_hash) {
    res.status(400).json({ error: 'An account with this mobile number already exists. Please sign in.' });
    return;
  } else if (existing) {
    db.prepare(`
      UPDATE customers SET full_name = ?, email = ?, password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = ?
    `).run(fullName.trim(), email?.trim() || null, hash, salt, now, existing.id);
  } else {
    customerId = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO customers (id, full_name, mobile, email, password_hash, password_salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customerId, fullName.trim(), normMobile, email?.trim() || null, hash, salt, now, now);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const session: CustomerSession = {
    token,
    customerId,
    fullName: fullName.trim(),
    mobile: normMobile,
    email: email?.trim() || null,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  customerSessions.set(token, session);

  res.status(201).json({
    token,
    customer: {
      id: customerId,
      fullName: session.fullName,
      mobile: session.mobile,
      email: session.email,
    },
  });
});

app.post('/api/customer/login', (req, res) => {
  const { mobile, password } = req.body || {};
  const normMobile = normalizeIndianMobile(mobile || '');
  if (!checkRateLimit(`cust:${normMobile}`)) {
    res.status(429).json({ error: 'Too many login attempts. Please wait 5 minutes.' });
    return;
  }

  const cust = db.prepare('SELECT * FROM customers WHERE mobile = ?').get(normMobile) as any;
  if (!cust || !cust.password_hash || !cust.password_salt) {
    res.status(401).json({ error: 'Invalid mobile number or password.' });
    return;
  }

  if (!verifyPassword(String(password || ''), cust.password_hash, cust.password_salt)) {
    res.status(401).json({ error: 'Invalid mobile number or password.' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const session: CustomerSession = {
    token,
    customerId: cust.id,
    fullName: cust.full_name,
    mobile: cust.mobile,
    email: cust.email,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  customerSessions.set(token, session);

  res.json({
    token,
    customer: {
      id: cust.id,
      fullName: cust.full_name,
      mobile: cust.mobile,
      email: cust.email,
    },
  });
});

app.get('/api/customer/me', (req, res) => {
  const session = getCustomerSession(req);
  if (!session) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }

  const orders = db
    .prepare('SELECT * FROM orders WHERE customer_mobile = ? ORDER BY created_at DESC')
    .all(session.mobile) as any[];

  const addresses = db
    .prepare('SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC')
    .all(session.customerId) as any[];

  res.json({
    customer: {
      id: session.customerId,
      fullName: session.fullName,
      mobile: session.mobile,
      email: session.email,
    },
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      orderStatus: o.order_status,
      paymentStatus: o.payment_status,
      shipmentStatus: o.shipment_status,
      subtotalPaise: o.subtotal_paise,
      shippingFeePaise: o.shipping_fee_paise,
      totalPaise: o.total_paise,
      createdAt: o.created_at,
      items: db
        .prepare('SELECT product_name, variant_name, quantity, unit_price_paise, line_total_paise FROM order_items WHERE order_id = ?')
        .all(o.id),
    })),
    addresses: addresses.map((a) => ({
      id: a.id,
      label: a.label,
      fullName: a.full_name,
      mobile: a.mobile,
      houseFlat: a.house_flat,
      street: a.street || a.street_locality,
      locality: a.locality || a.street_locality,
      streetLocality: a.street_locality,
      landmark: a.landmark || '',
      city: a.city,
      district: a.district || a.city,
      state: a.state,
      pincode: a.pincode,
      deliveryInstructions: a.delivery_instructions,
      isDefault: Boolean(a.is_default),
    })),
  });
});

app.post('/api/customer/addresses', (req, res) => {
  const session = getCustomerSession(req);
  if (!session) {
    res.status(401).json({ error: 'Please sign in to save addresses.' });
    return;
  }
  const {
    label,
    fullName,
    mobile,
    houseFlat,
    street,
    locality,
    streetLocality,
    landmark,
    city,
    district,
    state,
    pincode,
    deliveryInstructions,
  } = req.body || {};
  const pins = getAllServiceablePins();
  const deliveryPolicy = getDeliveryPolicySettings();
  const check = validateCheckoutAddress(
    {
      fullName,
      mobile,
      houseFlat,
      street,
      locality,
      streetLocality,
      landmark,
      city,
      district,
      state,
      pincode,
    },
    pins,
    deliveryPolicy
  );
  if (!check.valid) {
    res.status(400).json({ error: check.errors.join(' ') });
    return;
  }
  const id = `addr-${Date.now()}`;
  const cleanStreet = (street || streetLocality || '').trim();
  const cleanLocality = (locality || streetLocality || '').trim();
  const combinedStreetLocality = (streetLocality || `${cleanStreet}, ${cleanLocality}`).replace(/^,\s*|,\s*$/g, '').trim();

  db.prepare(`
    INSERT INTO addresses (
      id, customer_id, label, full_name, mobile, house_flat, street, locality,
      street_locality, landmark, city, district, state, pincode, delivery_instructions, is_default, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    id,
    session.customerId,
    (label || 'Home').trim(),
    fullName.trim(),
    normalizeIndianMobile(mobile),
    houseFlat.trim(),
    cleanStreet,
    cleanLocality,
    combinedStreetLocality,
    (landmark || '').trim(),
    city.trim(),
    (district || city).trim(),
    state.trim(),
    pincode.trim(),
    (deliveryInstructions || '').trim(),
    new Date().toISOString()
  );
  res.status(201).json({ id });
});

app.delete('/api/customer/addresses/:id', (req, res) => {
  const session = getCustomerSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  db.prepare('DELETE FROM addresses WHERE id = ? AND customer_id = ?').run(
    req.params.id,
    session.customerId
  );
  res.json({ deleted: true });
});

// ============================================================================
// ADMIN AUTHENTICATION & BOOTSTRAP (SECTION 7)
// ============================================================================

app.get('/api/admin/status', (_req, res) => {
  const count = (db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number }).c;
  res.json({
    bootstrapped: count > 0,
    requiresBootstrapToken: Boolean(process.env.ADMIN_BOOTSTRAP_TOKEN),
  });
});

app.post('/api/admin/bootstrap', (req, res) => {
  const count = (db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number }).c;
  if (count > 0) {
    res.status(403).json({
      error: 'Administrator account is already bootstrapped. Sign in with your existing credentials.',
    });
    return;
  }

  const { email, fullName, password, bootstrapToken } = req.body || {};
  const configuredToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (
    configuredToken &&
    configuredToken !== 'replace-with-one-time-bootstrap-token' &&
    bootstrapToken !== configuredToken
  ) {
    res.status(403).json({ error: 'Invalid ADMIN_BOOTSTRAP_TOKEN.' });
    return;
  }

  if (!email || !String(email).includes('@')) {
    res.status(400).json({ error: 'Valid administrator email is required.' });
    return;
  }
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: 'Administrator password must be at least 8 characters.' });
    return;
  }

  const now = new Date().toISOString();
  const { hash, salt } = hashPassword(String(password));
  const adminId = `adm-${Date.now()}`;
  const cleanEmail = String(email).trim().toLowerCase();

  db.prepare(`
    INSERT INTO admin_users (id, email, full_name, role, password_hash, password_salt, is_active, last_login_at, created_at)
    VALUES (?, ?, ?, 'owner', ?, ?, 1, ?, ?)
  `).run(adminId, cleanEmail, (fullName || 'Store Owner').trim(), hash, salt, now, now);

  writeAuditLog({
    actorId: adminId,
    actorEmail: cleanEmail,
    actorRole: 'owner',
    action: 'ADMIN_BOOTSTRAP',
    entityType: 'admin_users',
    entityId: adminId,
    details: { message: 'Initial owner administrator bootstrapped safely.' },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const session: AdminSession = {
    token,
    userId: adminId,
    email: cleanEmail,
    fullName: (fullName || 'Store Owner').trim(),
    role: 'owner',
    expiresAt: Date.now() + 12 * 60 * 60 * 1000,
  };
  adminSessions.set(token, session);

  res.status(201).json({
    token,
    admin: {
      id: adminId,
      email: cleanEmail,
      fullName: session.fullName,
      role: 'owner',
    },
  });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!checkRateLimit(`admin:${cleanEmail}`, 6)) {
    res.status(429).json({ error: 'Too many failed login attempts. Please wait 5 minutes.' });
    return;
  }

  const admin = db.prepare('SELECT * FROM admin_users WHERE email = ? AND is_active = 1').get(cleanEmail) as any;
  if (!admin || !verifyPassword(String(password || ''), admin.password_hash, admin.password_salt)) {
    writeAuditLog({
      actorEmail: cleanEmail || 'unknown',
      actorRole: 'unauthenticated',
      action: 'ADMIN_LOGIN_FAILED',
      entityType: 'admin_users',
      details: { reason: 'Invalid email or password' },
    });
    res.status(401).json({ error: 'Invalid admin email or password.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').run(now, admin.id);

  const token = crypto.randomBytes(32).toString('hex');
  const session: AdminSession = {
    token,
    userId: admin.id,
    email: admin.email,
    fullName: admin.full_name,
    role: admin.role,
    expiresAt: Date.now() + 12 * 60 * 60 * 1000,
  };
  adminSessions.set(token, session);

  writeAuditLog({
    actorId: admin.id,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'ADMIN_LOGIN_SUCCESS',
    entityType: 'admin_users',
    entityId: admin.id,
  });

  res.json({
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
    },
  });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = getBearerToken(req);
  if (token) adminSessions.delete(token);
  res.json({ loggedOut: true });
});

// ============================================================================
// ADMIN DASHBOARD, CATALOGUE, INVENTORY, ORDERS & REPORTS (SECTIONS 13–15)
// ============================================================================

function computeFullAdminOverview(startDate?: string, endDate?: string) {
  const { categories, products } = getFormattedCatalogue(true);
  const settings = getStoreSettings();

  let orderQuery = 'SELECT * FROM orders';
  const params: any[] = [];
  if (startDate && endDate) {
    orderQuery += ' WHERE created_at >= ? AND created_at <= ?';
    params.push(startDate, endDate);
  }
  orderQuery += ' ORDER BY created_at DESC';

  const orderRows = db.prepare(orderQuery).all(...params) as any[];
  const allOrderItems = db.prepare('SELECT * FROM order_items').all() as any[];
  const itemsByOrder = new Map<string, any[]>();
  for (const item of allOrderItems) {
    const list = itemsByOrder.get(item.order_id) || [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  const expensesRows = db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC').all() as any[];
  const totalExpensesPaise = expensesRows.reduce((acc, e) => acc + e.amount_paise, 0);

  const unsoldInventoryValuePaise = products.reduce(
    (acc, p) => acc + Math.max(0, p.stockQty) * p.purchaseCostPaise,
    0
  );

  const profitOrders = orderRows.map((o) => ({
    orderId: o.order_number,
    orderStatus: o.order_status as OrderStatus,
    paymentStatus: o.payment_status,
    subtotalPaise: o.subtotal_paise,
    shippingFeeCollectedPaise: o.shipping_fee_paise,
    totalPaise: o.total_paise,
    refundedAmountPaise: o.refunded_amount_paise || 0,
    actualCourierCostPaise: o.actual_courier_cost_paise,
    paymentGatewayFeePaise: o.payment_gateway_fee_paise,
    items: (itemsByOrder.get(o.id) || []).map((i) => ({
      quantity: i.quantity,
      unitPricePaise: i.unit_price_paise,
      unitCostSnapshotPaise: i.unit_cost_snapshot_paise,
      packagingCostSnapshotPaise: i.packaging_cost_snapshot_paise,
    })),
  }));

  const financialReport = calculateFinancialReport(
    profitOrders,
    totalExpensesPaise,
    unsoldInventoryValuePaise
  );

  const activeProductsCount = products.filter((p) => p.status === 'active').length;
  const draftProductsCount = products.filter((p) => p.status === 'draft').length;
  const lowStockProducts = products.filter(
    (p) => p.status === 'active' && p.availableQty <= p.lowStockThreshold
  );
  const pendingOrdersCount = orderRows.filter((o) =>
    [
      'awaiting_payment',
      'confirmed',
      'processing',
      'packed',
      'Pending Confirmation',
      'Confirmed',
      'Processing',
      'Packed',
    ].includes(o.order_status)
  ).length;

  const paymentConfig = {
    upiId: settings.general.manualPaymentUpiId || '',
    paymentLink: settings.general.manualPaymentLink || '',
    qrImageUrl: settings.general.manualPaymentQrUrl || '',
    merchantName: settings.general.storeName || 'Pretty Charm',
  };

  return {
    summary: {
      totalProducts: products.length,
      activeProducts: activeProductsCount,
      draftProducts: draftProductsCount,
      lowStockCount: lowStockProducts.length,
      totalOrders: orderRows.length,
      pendingOrders: pendingOrdersCount,
      paidRevenuePaise: financialReport.paidRevenuePaise,
      refundTotalsPaise: financialReport.refundsTotalPaise,
      expenseTotalsPaise: totalExpensesPaise,
      estimatedNetProfitPaise: financialReport.estimatedNetProfitPaise,
      unsoldInventoryValuePaise,
      isProfitEstimated: financialReport.isEstimated,
      missingProfitInputs: financialReport.missingInputs,
    },
    financialReport,
    lowStockProducts,
    categories,
    products,
    recentOrders: orderRows.slice(0, 100).map((o) => {
      const shp = db.prepare('SELECT * FROM shipment_records WHERE order_id = ?').get(o.id) as any;
      const pay = db.prepare('SELECT * FROM payment_records WHERE order_id = ?').get(o.id) as any;
      const parsedAddr = JSON.parse(o.shipping_address_json || '{}');
      const ordItems = itemsByOrder.get(o.id) || [];
      let giftPersonalization = null;
      try {
        if (o.gift_personalization_json) {
          giftPersonalization = JSON.parse(o.gift_personalization_json);
        }
      } catch {}
      const waPayload = {
        orderNumber: o.order_number,
        customerName: o.customer_name,
        customerMobile: o.customer_mobile,
        address: parsedAddr,
        items: ordItems.map((i: any) => ({
          productName: i.product_name,
          variantName: i.variant_name,
          quantity: i.quantity,
          unitPricePaise: i.unit_price_paise,
          lineTotalPaise: i.line_total_paise,
        })),
        subtotalPaise: o.subtotal_paise,
        shippingFeePaise: o.shipping_fee_paise,
        totalPaise: o.total_paise,
        paymentStatus: o.payment_status,
        orderStatus: o.order_status,
        comboDiscountPaise: o.combo_discount_paise || 0,
        giftPersonalization,
      };
      return {
        id: o.id,
        orderNumber: o.order_number,
        orderAccessToken: o.order_access_token,
        customerName: o.customer_name,
        customerMobile: o.customer_mobile,
        shippingAddress: parsedAddr,
        subtotalPaise: o.subtotal_paise,
        shippingFeePaise: o.shipping_fee_paise,
        totalPaise: o.total_paise,
        comboDiscountPaise: o.combo_discount_paise || 0,
        giftPersonalization,
        orderStatus: o.order_status,
        paymentMode: o.payment_mode,
        paymentStatus: o.payment_status,
        shipmentStatus: shp?.shipment_status || o.shipment_status,
        refundedAmountPaise: o.refunded_amount_paise,
        actualCourierCostPaise: o.actual_courier_cost_paise,
        paymentGatewayFeePaise: o.payment_gateway_fee_paise,
        customerSubmittedRef: pay?.customer_submitted_ref || null,
        verifiedBankUtr: pay?.verified_bank_utr || null,
        verifiedByAdminId: pay?.verified_by_admin_id || null,
        verifiedByAdminEmail: pay?.verified_by_admin_email || null,
        verifiedAt: pay?.verified_at || null,
        paymentNotes: pay?.notes || null,
        customerWhatsappContactUrl: buildCustomerWhatsAppContactUrl(o.customer_mobile),
        adminPaymentInstructionWhatsappUrl: buildAdminPaymentInstructionWhatsAppUrl(
          o.customer_mobile,
          waPayload,
          paymentConfig
        ),
        adminPaymentInstructionMessage: buildAdminPaymentInstructionWhatsAppMessage(
          waPayload,
          paymentConfig
        ),
        adminOrderConfirmationWhatsappUrl: buildAdminOrderConfirmationWhatsAppUrl(
          o.customer_mobile,
          waPayload
        ),
        adminOrderConfirmationMessage: buildAdminOrderConfirmationWhatsAppMessage(waPayload),
        shipment: shp || null,
        items: ordItems,
        createdAt: o.created_at,
      };
    }),
    suppliers: db.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all(),
    purchases: db.prepare('SELECT * FROM purchase_orders ORDER BY created_at DESC').all(),
    inventoryMovements: db
      .prepare('SELECT * FROM inventory_movements ORDER BY created_at DESC LIMIT 60')
      .all(),
    customers: db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all(),
    expenses: expensesRows,
    pincodes: getAllServiceablePins(),
    settings,
    adminUsers: db
      .prepare('SELECT id, email, full_name, role, is_active, last_login_at, created_at FROM admin_users')
      .all(),
    auditLogs: db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 80').all(),
    imageAuditReport: buildProductImageAuditReport(),
    reviews: getAllReviewsForAdmin(),
    comboOffers: getComboOffersSettings(),
  };
}

function getCurrentCatalogueIntegritySnapshot(): CatalogueIntegritySnapshot[] {
  const prods = db.prepare('SELECT * FROM products ORDER BY id ASC').all() as any[];
  const vars = db.prepare('SELECT * FROM product_variants ORDER BY id ASC').all() as any[];
  return prods.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    categorySlug: p.category_slug,
    sku: p.sku,
    sellingPricePaise: p.selling_price_paise,
    stockQty: p.stock_qty,
    status: p.status,
    variantSkus: vars.filter((v) => v.product_id === p.id).map((v) => v.sku),
  }));
}

function buildProductImageAuditReport() {
  const { categories, products } = getFormattedCatalogue(true);
  const catMap = new Map(categories.map((c) => [c.slug, c.name]));
  const auditRows = db.prepare('SELECT * FROM product_image_audits').all() as any[];
  const auditMap = new Map(auditRows.map((a) => [a.product_id, a]));

  const baselineRow = db
    .prepare("SELECT value_json FROM store_settings WHERE key = 'catalogue_integrity_baseline'")
    .get() as { value_json: string } | undefined;
  const currentSnapshot = getCurrentCatalogueIntegritySnapshot();
  const baselineSnapshot: CatalogueIntegritySnapshot[] = baselineRow
    ? JSON.parse(baselineRow.value_json)
    : currentSnapshot;

  const integrity = verifyCatalogueIntegrityUnchanged(baselineSnapshot, currentSnapshot);

  const items = products.map((p) => {
    const audit = auditMap.get(p.id);
    const rawStatus = audit?.audit_status || 'Image Needed';
    // Normalize legacy status strings into the 6 Step 5 Admin Image Management statuses
    let auditStatus: ProductImageAuditStatus = rawStatus;
    if (rawStatus === 'Image successfully added') auditStatus = 'Added Successfully';
    if (rawStatus === 'Original image found — awaiting approval')
      auditStatus = 'Awaiting Admin Approval';
    if (rawStatus === 'Search failed') auditStatus = 'Search Failed';

    const eligibleForSale = isProductEligibleForImageImport({
      status: p.status,
      stockQty: p.stockQty,
      reservedQty: p.reservedQty,
    });

    return {
      productId: p.id,
      productName: p.name,
      brand: audit?.brand || 'Pretty Charm',
      categorySlug: p.categorySlug,
      categoryName: catMap.get(p.categorySlug) || p.categorySlug,
      sku: p.sku,
      sellingPricePaise: p.sellingPricePaise,
      stockQty: p.stockQty,
      availableQty: p.availableQty,
      productStatus: p.status,
      isEligibleForSale: eligibleForSale,
      variants: p.variants.map((v: any) => ({ id: v.id, name: v.name, sku: v.sku })),
      existingImages: p.images,
      currentPrimaryImage: p.images?.[0] || null,
      thumbnailUrl: audit?.thumbnail_url || p.images?.[0] || null,
      searchQuery: audit?.search_query || `"Pretty Charm" "${p.name}" "${p.sku}"`,
      auditStatus,
      candidateImageUrl: audit?.candidate_image_url || null,
      sourceUrl: audit?.source_url || null,
      licenseInfo: audit?.license_info || null,
      isAiGenerated: Boolean(audit?.is_ai_generated),
      imageFormat: audit?.image_format || null,
      imageResolution: audit?.image_resolution || null,
      imageBytes: audit?.image_bytes || null,
      reason:
        audit?.reason ||
        'No exact manufacturer or authorized supplier photograph with verified reuse permission found yet.',
      preserveExisting: audit ? Boolean(audit.preserve_existing) : true,
      setAsPrimary: audit ? Boolean(audit.set_as_primary) : true,
      approvedByEmail: audit?.approved_by_email || null,
      approvedAt: audit?.approved_at || null,
      updatedAt: audit?.updated_at || p.updatedAt,
    };
  });

  const statusBreakdown: Record<string, number> = {
    'Genuine Image Found': 0,
    'Added Successfully': 0,
    'Awaiting Admin Approval': 0,
    'AI-Generated Image': 0,
    'Image Needed': 0,
    'Search Failed': 0,
    'Source or reuse permission unverified': 0,
  };

  for (const item of items) {
    statusBreakdown[item.auditStatus] = (statusBreakdown[item.auditStatus] || 0) + 1;
  }

  const eligibleAvailableItems = items.filter((i) => i.isEligibleForSale);
  const eligibleWithApprovedImages = eligibleAvailableItems.filter(
    (i) => i.auditStatus === 'Added Successfully'
  );

  return {
    totalExistingProducts: items.length,
    eligibleAvailableProductsCount: eligibleAvailableItems.length,
    eligibleWithApprovedImagesCount: eligibleWithApprovedImages.length,
    approvedOriginalImagesCount: statusBreakdown['Added Successfully'] || 0,
    awaitingApprovalCount:
      (statusBreakdown['Genuine Image Found'] || 0) +
      (statusBreakdown['Awaiting Admin Approval'] || 0) +
      (statusBreakdown['AI-Generated Image'] || 0),
    aiGeneratedCount: items.filter((i) => i.isAiGenerated).length,
    stillNeedingImagesCount:
      (statusBreakdown['Image Needed'] || 0) +
      (statusBreakdown['Source or reuse permission unverified'] || 0) +
      (statusBreakdown['Search Failed'] || 0),
    statusBreakdown,
    availableStatuses: PRODUCT_IMAGE_AUDIT_STATUSES,
    integrityVerification: {
      unchanged: integrity.unchanged,
      discrepancies: integrity.discrepancies,
      beforeCount: baselineSnapshot.length,
      afterCount: currentSnapshot.length,
    },
    items,
  };
}

app.get('/api/product-image-report', (_req, res) => {
  res.json(buildProductImageAuditReport());
});

app.get('/api/admin/product-image-report', requireAdmin, (_req, res) => {
  res.json(buildProductImageAuditReport());
});

// Helper to inspect and validate a local image file in ./public
function validateLocalUploadedProductPhoto(localUrl: string): {
  exists: boolean;
  byteLength: number;
  isValidJpegOrPng: boolean;
} {
  try {
    const rel = localUrl.replace(/^\//, '');
    const fullPath = path.resolve('./public', rel);
    if (!fs.existsSync(fullPath)) {
      return { exists: false, byteLength: 0, isValidJpegOrPng: false };
    }
    const buf = fs.readFileSync(fullPath);
    const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng =
      buf.length > 4 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47;
    return {
      exists: true,
      byteLength: buf.byteLength,
      isValidJpegOrPng: isJpeg || isPng,
    };
  } catch {
    return { exists: false, byteLength: 0, isValidJpegOrPng: false };
  }
}

// STEP 5: Find Images for All Available Products (automated priority 1 -> 2 -> 3 -> 4 pipeline)
app.post('/api/admin/product-images/find-all-available', requireAdmin, async (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { stageOnly = false, allCatalogue = true } = req.body || {};
  const prods = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all() as any[];
  const now = new Date().toISOString();

  let processedCount = 0;
  let foundOrImportedCount = 0;

  for (const prod of prods) {
    const eligible =
      allCatalogue ||
      isProductEligibleForImageImport({
        status: prod.status,
        stockQty: prod.stock_qty,
        reservedQty: prod.reserved_qty,
      });
    if (!eligible) continue;

    processedCount += 1;
    const verifiedPhoto = PERMITTED_AVAILABLE_PRODUCT_IMAGES[prod.id];
    if (verifiedPhoto) {
      const fileCheck = validateLocalUploadedProductPhoto(verifiedPhoto.imageUrl);
      if (fileCheck.exists && fileCheck.isValidJpegOrPng && fileCheck.byteLength >= 128) {
        foundOrImportedCount += 1;
        const currentImages: string[] = JSON.parse(prod.images_json || '[]');
        const targetStatus: ProductImageAuditStatus = stageOnly
          ? 'Genuine Image Found'
          : 'Added Successfully';

        if (!stageOnly) {
          const updatedGallery = applyApprovedProductImageToGallery(
            currentImages,
            verifiedPhoto.imageUrl,
            { replaceExisting: false, setAsPrimary: true }
          );
          db.prepare('UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?').run(
            JSON.stringify(updatedGallery),
            now,
            prod.id
          );
        }

        db.prepare(`
          INSERT INTO product_image_audits (
            product_id, brand, search_query, audit_status, candidate_image_url, thumbnail_url,
            source_url, license_info, is_ai_generated, image_format, image_resolution, image_bytes,
            reason, preserve_existing, set_as_primary, approved_by_email, approved_at, updated_at
          ) VALUES (?, 'Pretty Charm', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1, 1, ?, ?, ?)
          ON CONFLICT(product_id) DO UPDATE SET
            search_query = excluded.search_query,
            audit_status = excluded.audit_status,
            candidate_image_url = excluded.candidate_image_url,
            thumbnail_url = excluded.thumbnail_url,
            source_url = excluded.source_url,
            license_info = excluded.license_info,
            is_ai_generated = 0,
            image_format = excluded.image_format,
            image_resolution = excluded.image_resolution,
            image_bytes = excluded.image_bytes,
            reason = excluded.reason,
            approved_by_email = excluded.approved_by_email,
            approved_at = excluded.approved_at,
            updated_at = excluded.updated_at
        `).run(
          prod.id,
          verifiedPhoto.searchQuery,
          targetStatus,
          verifiedPhoto.imageUrl,
          verifiedPhoto.thumbnailUrl,
          verifiedPhoto.sourceUrl,
          verifiedPhoto.licenseInfo,
          verifiedPhoto.imageFormat,
          verifiedPhoto.imageResolution,
          fileCheck.byteLength,
          stageOnly
            ? `Genuine CC-licensed product photograph found (${verifiedPhoto.imageResolution} ${verifiedPhoto.imageFormat}) — ready for Admin approval.`
            : verifiedPhoto.reason,
          stageOnly ? null : admin.email,
          stageOnly ? null : now,
          now
        );
      }
    }
  }

  // Also synchronize category images with genuine CC-licensed photography
  for (const [categoryId, catPhoto] of Object.entries(PERMITTED_CATEGORY_IMAGES)) {
    const catRow = db
      .prepare('SELECT id, image_url FROM categories WHERE id = ?')
      .get(categoryId) as { id: string; image_url: string } | undefined;
    if (catRow && (catRow.image_url.startsWith('data:image/svg') || catRow.image_url !== catPhoto.imageUrl)) {
      db.prepare('UPDATE categories SET image_url = ?, updated_at = ? WHERE id = ?').run(
        catPhoto.imageUrl,
        now,
        categoryId
      );
    }
  }

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'PRODUCT_IMAGE_BATCH_FIND_ALL_AVAILABLE',
    entityType: 'product_image_audits',
    entityId: 'all-available',
    details: { processedCount, foundOrImportedCount, stageOnly },
  });

  res.json({
    processedCount,
    foundOrImportedCount,
    report: buildProductImageAuditReport(),
  });
});

// Search permitted public repositories (Wikimedia Commons API) for one product
app.post('/api/admin/product-images/search/:productId', requireAdmin, async (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const productId = req.params.productId;
  const { stageForApproval = false } = req.body || {};
  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
  if (!prod) {
    res.status(404).json({ error: 'Existing product not found.' });
    return;
  }

  const now = new Date().toISOString();

  // Check verified permitted product photo catalogue first
  const verifiedPhoto = PERMITTED_AVAILABLE_PRODUCT_IMAGES[productId];
  if (verifiedPhoto) {
    const fileCheck = validateLocalUploadedProductPhoto(verifiedPhoto.imageUrl);
    if (fileCheck.exists && fileCheck.isValidJpegOrPng) {
      const currentAudit = db
        .prepare('SELECT audit_status FROM product_image_audits WHERE product_id = ?')
        .get(productId) as { audit_status: string } | undefined;
      const nextStatus: ProductImageAuditStatus =
        !stageForApproval && currentAudit?.audit_status === 'Added Successfully'
          ? 'Added Successfully'
          : 'Genuine Image Found';

      db.prepare(`
        INSERT INTO product_image_audits (
          product_id, brand, search_query, audit_status, candidate_image_url, thumbnail_url,
          source_url, license_info, is_ai_generated, image_format, image_resolution, image_bytes,
          reason, preserve_existing, set_as_primary, updated_at
        ) VALUES (?, 'Pretty Charm', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1, 1, ?)
        ON CONFLICT(product_id) DO UPDATE SET
          search_query = excluded.search_query,
          audit_status = excluded.audit_status,
          candidate_image_url = excluded.candidate_image_url,
          thumbnail_url = excluded.thumbnail_url,
          source_url = excluded.source_url,
          license_info = excluded.license_info,
          is_ai_generated = 0,
          image_format = excluded.image_format,
          image_resolution = excluded.image_resolution,
          image_bytes = excluded.image_bytes,
          reason = excluded.reason,
          updated_at = excluded.updated_at
      `).run(
        productId,
        verifiedPhoto.searchQuery,
        nextStatus,
        verifiedPhoto.imageUrl,
        verifiedPhoto.thumbnailUrl,
        verifiedPhoto.sourceUrl,
        verifiedPhoto.licenseInfo,
        verifiedPhoto.imageFormat,
        verifiedPhoto.imageResolution,
        fileCheck.byteLength,
        nextStatus === 'Added Successfully'
          ? verifiedPhoto.reason
          : `Genuine product photograph found (${verifiedPhoto.imageResolution} ${verifiedPhoto.imageFormat}, ${verifiedPhoto.licenseInfo}) — awaiting Admin approval.`,
        now
      );

      res.json({ report: buildProductImageAuditReport() });
      return;
    }
  }

  const variants = db
    .prepare('SELECT name, sku FROM product_variants WHERE product_id = ?')
    .all(productId) as Array<{ name: string; sku: string }>;
  const variantHint = variants.length > 0 ? ` "${variants[0].name}"` : '';
  const exactQuery = `"Pretty Charm" "${prod.name}" "${prod.sku}"${variantHint}`;

  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      `${prod.name} ${prod.category_slug.replace('-', ' ')} filetype:bitmap`
    )}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=800&format=json&origin=*`;

    const response = await fetch(commonsUrl, {
      headers: { 'User-Agent': 'PrettyCharmCatalogAudit/1.0 (https://prettycharm.in)' },
    });

    if (!response.ok) {
      throw new Error(`Permitted search API returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as any;
    const pages = data?.query?.pages ? (Object.values(data.query.pages) as any[]) : [];
    const firstValid = pages.find((pg) => pg?.imageinfo?.[0]?.url);

    let newStatus: ProductImageAuditStatus = 'Image Needed';
    let candidateUrl: string | null = null;
    let sourceUrl: string | null = null;
    let licenseInfo = 'Checked Wikimedia Commons & Permitted Brand Sources';
    let reason = `Searched permitted repositories with query ${exactQuery}. No exact original photograph matching proprietary SKU ${prod.sku} was found; leaving existing image unchanged.`;

    if (firstValid && prod.status === 'active') {
      const info = firstValid.imageinfo[0];
      candidateUrl = info.thumburl || info.url;
      sourceUrl = info.descriptionurl || 'https://commons.wikimedia.org';
      licenseInfo =
        info.extmetadata?.LicenseShortName?.value || 'Verified Wikimedia Commons License';
      newStatus = 'Genuine Image Found';
      reason = `Permitted photograph candidate found (${licenseInfo}) — awaiting Admin inspection and approval.`;
    }

    db.prepare(`
      INSERT INTO product_image_audits (
        product_id, brand, search_query, audit_status, candidate_image_url, source_url, license_info, is_ai_generated, reason, preserve_existing, set_as_primary, updated_at
      ) VALUES (?, 'Pretty Charm', ?, ?, ?, ?, ?, 0, ?, 1, 1, ?)
      ON CONFLICT(product_id) DO UPDATE SET
        search_query = excluded.search_query,
        audit_status = excluded.audit_status,
        candidate_image_url = excluded.candidate_image_url,
        source_url = excluded.source_url,
        license_info = excluded.license_info,
        is_ai_generated = 0,
        reason = excluded.reason,
        updated_at = excluded.updated_at
    `).run(productId, exactQuery, newStatus, candidateUrl, sourceUrl, licenseInfo, reason, now);

    writeAuditLog({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'PRODUCT_IMAGE_SEARCH_EXECUTED',
      entityType: 'product_image_audits',
      entityId: productId,
      details: { sku: prod.sku, query: exactQuery, resultStatus: newStatus },
    });

    res.json({ report: buildProductImageAuditReport() });
  } catch (err: any) {
    const failReason = `Search request failed: ${err.message || 'Network error contacting permitted search API'}. Existing product image left unchanged.`;
    db.prepare(`
      UPDATE product_image_audits
      SET audit_status = 'Search Failed', reason = ?, updated_at = ?
      WHERE product_id = ?
    `).run(failReason, now, productId);

    res.json({ report: buildProductImageAuditReport() });
  }
});

// STEP 3: Google Gemini Image Generation Fallback (strictly labeled as AI-Generated Image & requires Admin approval)
app.post('/api/admin/product-images/generate-ai/:productId', requireAdmin, async (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const productId = req.params.productId;
  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
  if (!prod) {
    res.status(404).json({ error: 'Existing product not found.' });
    return;
  }

  const variants = db
    .prepare('SELECT name FROM product_variants WHERE product_id = ?')
    .all(productId) as Array<{ name: string }>;
  const prompt = buildGeminiProductImagePrompt({
    name: prod.name,
    categorySlug: prod.category_slug,
    description: prod.description,
    sku: prod.sku,
    variants,
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    res.status(400).json({
      error:
        'Google Gemini image generation requires a configured GEMINI_API_KEY. Continuing with internet-search and manual-upload fallback.',
      report: buildProductImageAuditReport(),
    });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: '1:1',
        },
      },
    });

    let base64Image: string | null = null;
    let mimeType = 'image/png';
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        base64Image = part.inlineData.data;
        if (part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
        break;
      }
    }

    if (!base64Image) {
      throw new Error('Gemini model did not return an inlineData image part.');
    }

    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const filename = `ai-${productId}.${ext}`;
    const outDir = path.resolve('./public/uploads/products');
    fs.mkdirSync(outDir, { recursive: true });
    const imgBuf = Buffer.from(base64Image, 'base64');
    fs.writeFileSync(path.join(outDir, filename), imgBuf);

    const localUrl = `/uploads/products/${filename}`;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE product_image_audits
      SET audit_status = 'AI-Generated Image',
          candidate_image_url = ?,
          thumbnail_url = ?,
          source_url = ?,
          license_info = 'AI-Generated Illustrative Image (Google Gemini — Not an original physical photograph)',
          is_ai_generated = 1,
          image_format = ?,
          image_resolution = '1024x1024',
          image_bytes = ?,
          reason = ?,
          updated_at = ?
      WHERE product_id = ?
    `).run(
      localUrl,
      localUrl,
      `gemini://gemini-3.1-flash-lite-image/${prod.sku}`,
      mimeType,
      imgBuf.byteLength,
      'AI-Generated illustrative image created from database product attributes (labeled internally as AI-generated, not a physical photograph). Requires Admin approval before publishing.',
      now,
      productId
    );

    writeAuditLog({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'PRODUCT_IMAGE_AI_FALLBACK_GENERATED',
      entityType: 'product_image_audits',
      entityId: productId,
      details: { sku: prod.sku, isAiGenerated: true, localUrl },
    });

    res.json({ report: buildProductImageAuditReport() });
  } catch (err: any) {
    res.status(400).json({
      error: `Gemini image generation unavailable (${
        err.message || 'API quota/credential limit'
      }). Continuing with permitted internet-search and manual-upload fallback — no fake AI image was generated.`,
      report: buildProductImageAuditReport(),
    });
  }
});

// Submit a candidate photograph or AI fallback for an existing product (validates file/URL before staging for approval)
app.post('/api/admin/product-images/candidate/:productId', requireAdmin, async (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const productId = req.params.productId;
  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
  if (!prod) {
    res.status(404).json({ error: 'Existing product not found.' });
    return;
  }

  const {
    candidateImageUrl,
    sourceUrl,
    licenseInfo,
    isAiGenerated = false,
    allowAiFallback = false,
    hasReusePermission = true,
    exactProductMatch = true,
  } = req.body || {};

  let detectedMime: string | undefined;
  let detectedBytes: number | undefined;
  const rawCandidate = String(candidateImageUrl || '').trim();

  if (rawCandidate.startsWith('data:image/')) {
    const match = rawCandidate.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      detectedMime = match[1].toLowerCase();
      detectedBytes = Buffer.from(match[2], 'base64').byteLength;
    }
  } else if (rawCandidate.startsWith('/uploads/products/')) {
    const localCheck = validateLocalUploadedProductPhoto(rawCandidate);
    if (localCheck.exists) {
      detectedBytes = localCheck.byteLength;
      detectedMime = rawCandidate.endsWith('.png') ? 'image/png' : 'image/jpeg';
    }
  } else if (/^https:\/\//i.test(rawCandidate)) {
    try {
      const headRes = await fetch(rawCandidate, { method: 'HEAD' });
      if (headRes.ok) {
        const ct = headRes.headers.get('content-type');
        if (ct) detectedMime = ct.split(';')[0].trim().toLowerCase();
        const cl = headRes.headers.get('content-length');
        if (cl && Number.isFinite(Number(cl))) detectedBytes = Number(cl);
      }
    } catch {
      // Allow validation to proceed based on URL & declaration if remote host blocks HEAD
    }
  }

  const check = validateCandidateProductImage({
    urlOrDataUri: rawCandidate,
    sourceUrl: String(sourceUrl || '').trim(),
    mimeType: detectedMime,
    byteLength: detectedBytes,
    isAiGenerated: Boolean(isAiGenerated),
    allowAiFallback: Boolean(allowAiFallback),
    hasReusePermission: Boolean(hasReusePermission),
    exactProductMatch: Boolean(exactProductMatch),
  });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE product_image_audits
    SET audit_status = ?,
        candidate_image_url = ?,
        source_url = ?,
        license_info = ?,
        is_ai_generated = ?,
        image_format = COALESCE(?, image_format),
        image_bytes = COALESCE(?, image_bytes),
        reason = ?,
        updated_at = ?
    WHERE product_id = ?
  `).run(
    check.recommendedStatus,
    check.valid ? rawCandidate : null,
    String(sourceUrl || '').trim() || null,
    String(
      licenseInfo ||
        (check.isAiGenerated
          ? 'AI-Generated Illustrative Image (Not a physical photograph)'
          : 'Authorized Product Photograph')
    ).trim(),
    check.isAiGenerated ? 1 : 0,
    detectedMime || null,
    detectedBytes || null,
    check.reason,
    now,
    productId
  );

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'PRODUCT_IMAGE_CANDIDATE_EVALUATED',
    entityType: 'product_image_audits',
    entityId: productId,
    details: {
      sku: prod.sku,
      valid: check.valid,
      recommendedStatus: check.recommendedStatus,
      isAiGenerated: check.isAiGenerated,
      reason: check.reason,
    },
  });

  if (!check.valid) {
    res.status(400).json({ error: check.reason, report: buildProductImageAuditReport() });
    return;
  }

  res.json({ report: buildProductImageAuditReport() });
});

// Admin Approves Candidate Photograph -> Updates ONLY images_json on that exact existing product
app.post('/api/admin/product-images/approve/:productId', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const productId = req.params.productId;
  const { replaceExisting = false, setAsPrimary = true } = req.body || {};

  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
  if (!prod) {
    res.status(404).json({ error: 'Existing product not found.' });
    return;
  }

  const audit = db
    .prepare('SELECT * FROM product_image_audits WHERE product_id = ?')
    .get(productId) as any;
  if (!audit || !audit.candidate_image_url) {
    res.status(400).json({
      error: 'No verified candidate photograph is staged for approval on this product.',
    });
    return;
  }

  const existingImages: string[] = JSON.parse(prod.images_json || '[]');
  const updatedGallery = applyApprovedProductImageToGallery(
    existingImages,
    audit.candidate_image_url,
    {
      replaceExisting: Boolean(replaceExisting),
      setAsPrimary: Boolean(setAsPrimary),
    }
  );

  const now = new Date().toISOString();
  runInTransaction(() => {
    // Update ONLY images_json and updated_at on the existing product record
    db.prepare('UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(updatedGallery),
      now,
      productId
    );

    db.prepare(`
      UPDATE product_image_audits
      SET audit_status = 'Added Successfully',
          preserve_existing = ?,
          set_as_primary = ?,
          approved_by_email = ?,
          approved_at = ?,
          reason = ?,
          updated_at = ?
      WHERE product_id = ?
    `).run(
      replaceExisting ? 0 : 1,
      setAsPrimary ? 1 : 0,
      admin.email,
      now,
      `Approved by ${admin.email}. Gallery updated (${
        replaceExisting ? 'replaced existing image' : 'preserved existing images'
      }, ${setAsPrimary ? 'set as primary image' : 'appended to gallery'}). ${
        audit.is_ai_generated ? '[Labeled: AI-Generated Illustrative Image]' : '[Genuine Photograph]'
      }`,
      now,
      productId
    );

    writeAuditLog({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'PRODUCT_ORIGINAL_IMAGE_APPROVED',
      entityType: 'products',
      entityId: productId,
      details: {
        sku: prod.sku,
        sourceUrl: audit.source_url,
        isAiGenerated: Boolean(audit.is_ai_generated),
        replaceExisting: Boolean(replaceExisting),
        setAsPrimary: Boolean(setAsPrimary),
        galleryCount: updatedGallery.length,
      },
    });
  });

  res.json({ report: buildProductImageAuditReport() });
});

// Batch Approve All Staged Candidate Images Together
app.post('/api/admin/product-images/approve-batch', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { replaceExisting = false, setAsPrimary = true } = req.body || {};
  const stagedAudits = db
    .prepare(
      `SELECT * FROM product_image_audits
       WHERE candidate_image_url IS NOT NULL
         AND audit_status IN ('Genuine Image Found', 'Awaiting Admin Approval', 'AI-Generated Image', 'Original image found — awaiting approval')`
    )
    .all() as any[];

  const now = new Date().toISOString();
  let approvedCount = 0;

  runInTransaction(() => {
    for (const audit of stagedAudits) {
      const prod = db
        .prepare('SELECT id, sku, images_json FROM products WHERE id = ?')
        .get(audit.product_id) as any;
      if (!prod) continue;

      const existingImages: string[] = JSON.parse(prod.images_json || '[]');
      const updatedGallery = applyApprovedProductImageToGallery(
        existingImages,
        audit.candidate_image_url,
        {
          replaceExisting: Boolean(replaceExisting),
          setAsPrimary: Boolean(setAsPrimary),
        }
      );

      db.prepare('UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify(updatedGallery),
        now,
        prod.id
      );

      db.prepare(`
        UPDATE product_image_audits
        SET audit_status = 'Added Successfully',
            preserve_existing = ?,
            set_as_primary = ?,
            approved_by_email = ?,
            approved_at = ?,
            reason = ?,
            updated_at = ?
        WHERE product_id = ?
      `).run(
        replaceExisting ? 0 : 1,
        setAsPrimary ? 1 : 0,
        admin.email,
        now,
        `Batch approved by ${admin.email} (${
          replaceExisting ? 'replaced existing' : 'preserved existing gallery'
        }).`,
        now,
        prod.id
      );
      approvedCount += 1;
    }
  });

  res.json({ approvedCount, report: buildProductImageAuditReport() });
});

// Admin Rejects Candidate Image -> Leaves product gallery untouched and marks Image Needed
app.post('/api/admin/product-images/reject/:productId', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const productId = req.params.productId;
  const { status = 'Image Needed', reason } = req.body || {};

  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
  if (!prod) {
    res.status(404).json({ error: 'Existing product not found.' });
    return;
  }

  const finalStatus: ProductImageAuditStatus =
    status === 'Source or reuse permission unverified'
      ? 'Source or reuse permission unverified'
      : 'Image Needed';
  const finalReason =
    String(reason || '').trim() ||
    `Candidate image rejected by Admin (${admin.email}). Existing product image preserved unchanged; marked ${finalStatus}.`;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE product_image_audits
    SET audit_status = ?,
        candidate_image_url = NULL,
        is_ai_generated = 0,
        reason = ?,
        updated_at = ?
    WHERE product_id = ?
  `).run(finalStatus, finalReason, now, productId);

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'PRODUCT_ORIGINAL_IMAGE_REJECTED',
    entityType: 'product_image_audits',
    entityId: productId,
    details: { sku: prod.sku, finalStatus, reason: finalReason },
  });

  res.json({ report: buildProductImageAuditReport() });
});

// Update or Upload Category Image (Section 3 & 5)
app.post('/api/admin/categories/:id/image', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const categoryId = req.params.id;
  const { imageUrl, base64, mimeType } = req.body || {};

  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId) as any;
  if (!cat) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }

  let finalUrl = imageUrl;
  if (base64) {
    const mime = (mimeType || 'image/jpeg').toLowerCase();
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const filename = `cat-${categoryId}-${Date.now()}.${ext}`;
    const outDir = path.resolve('./public/uploads/categories');
    fs.mkdirSync(outDir, { recursive: true });
    const buf = Buffer.from(base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, ''), 'base64');
    fs.writeFileSync(path.join(outDir, filename), buf);
    finalUrl = `/uploads/categories/${filename}`;
    const distDir = path.resolve('./dist/uploads/categories');
    if (fs.existsSync(distDir)) {
      try {
        fs.writeFileSync(path.join(distDir, filename), buf);
      } catch {}
    }
  }

  if (!finalUrl) {
    res.status(400).json({ error: 'imageUrl or base64 file data is required.' });
    return;
  }

  const updated = updateCategoryImage(categoryId, finalUrl);

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'CATEGORY_IMAGE_UPDATED',
    entityType: 'categories',
    entityId: categoryId,
    details: { imageUrl: finalUrl },
  });

  res.json({ category: updated, categories: db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all() });
});

// Direct Product Image Upload (Section 5)
app.post('/api/admin/product-images/upload/:productId', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const productId = req.params.productId;
  const { base64, mimeType, setAsPrimary = true, preserveExisting = true, sourceUrl, licenseInfo } = req.body || {};

  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
  if (!prod) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  if (!base64) {
    res.status(400).json({ error: 'base64 image payload is required.' });
    return;
  }

  const rawBase64 = base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const buf = Buffer.from(rawBase64, 'base64');
  if (buf.byteLength < 64) {
    res.status(400).json({ error: 'Uploaded file is too small or invalid.' });
    return;
  }

  const mime = (mimeType || 'image/jpeg').toLowerCase();
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const filename = `uploaded-${productId}-${Date.now()}.${ext}`;
  const outDir = path.resolve('./public/uploads/products');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, filename), buf);
  const localUrl = `/uploads/products/${filename}`;

  const distDir = path.resolve('./dist/uploads/products');
  if (fs.existsSync(distDir)) {
    try {
      fs.writeFileSync(path.join(distDir, filename), buf);
    } catch {}
  }

  const currentImages: string[] = JSON.parse(prod.images_json || '[]');
  const updatedGallery = applyApprovedProductImageToGallery(currentImages, localUrl, {
    replaceExisting: !preserveExisting,
    setAsPrimary: Boolean(setAsPrimary),
  });

  const now = new Date().toISOString();
  db.prepare('UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(updatedGallery),
    now,
    productId
  );

  db.prepare(`
    INSERT INTO product_image_audits (
      product_id, brand, search_query, audit_status, candidate_image_url, thumbnail_url,
      source_url, license_info, is_ai_generated, image_format, image_resolution, image_bytes,
      reason, preserve_existing, set_as_primary, approved_by_email, approved_at, updated_at
    ) VALUES (?, 'Pretty Charm', ?, 'Added Successfully', ?, ?, ?, ?, 0, ?, '800x600', ?, ?, 1, 1, ?, ?, ?)
    ON CONFLICT(product_id) DO UPDATE SET
      audit_status = 'Added Successfully',
      candidate_image_url = excluded.candidate_image_url,
      thumbnail_url = excluded.thumbnail_url,
      source_url = excluded.source_url,
      license_info = excluded.license_info,
      image_format = excluded.image_format,
      image_bytes = excluded.image_bytes,
      reason = excluded.reason,
      approved_by_email = excluded.approved_by_email,
      approved_at = excluded.approved_at,
      updated_at = excluded.updated_at
  `).run(
    productId,
    `"${prod.name}" "${prod.sku}" uploaded photo`,
    localUrl,
    localUrl,
    sourceUrl || 'Admin Direct Upload',
    licenseInfo || 'Studio product photography — authorized upload',
    mime,
    buf.byteLength,
    `Admin direct upload by ${admin.email} — validated (${Math.round(buf.byteLength / 1024)} KB ${ext.toUpperCase()}).`,
    admin.email,
    now,
    now
  );

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'PRODUCT_IMAGE_DIRECT_UPLOAD',
    entityType: 'products',
    entityId: productId,
    details: { localUrl, byteLength: buf.byteLength, setAsPrimary },
  });

  res.json({ localUrl, report: buildProductImageAuditReport() });
});

// Product Gallery Management (Set Primary, Remove Image, Reorder) (Section 5)
app.post('/api/admin/product-images/gallery/:productId', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const productId = req.params.productId;
  const { images, setPrimaryUrl, removeImageUrl } = req.body || {};

  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
  if (!prod) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  let currentGallery: string[] = JSON.parse(prod.images_json || '[]');

  if (Array.isArray(images)) {
    currentGallery = images.filter((img: any) => typeof img === 'string' && img.trim().length > 0);
  } else if (setPrimaryUrl) {
    currentGallery = [setPrimaryUrl, ...currentGallery.filter((u) => u !== setPrimaryUrl)];
  } else if (removeImageUrl) {
    if (currentGallery.length <= 1) {
      res.status(400).json({ error: 'Cannot remove the only image in the product gallery.' });
      return;
    }
    currentGallery = currentGallery.filter((u) => u !== removeImageUrl);
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(currentGallery),
    now,
    productId
  );

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'PRODUCT_GALLERY_UPDATED',
    entityType: 'products',
    entityId: productId,
    details: { galleryCount: currentGallery.length, primary: currentGallery[0] },
  });

  res.json({ gallery: currentGallery, report: buildProductImageAuditReport() });
});

app.get('/api/admin/overview', requireAdmin, (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  res.json(computeFullAdminOverview(startDate, endDate));
});

// Create or Update Product (Section 4)
app.post('/api/admin/products', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const {
    id,
    name,
    slug,
    description,
    categorySlug,
    sku,
    sellingPricePaise,
    purchaseCostPaise,
    packagingCostPaise,
    stockQty,
    lowStockThreshold,
    status,
    confirmedByAdmin,
    images,
    tags,
  } = req.body || {};

  if (status === 'active') {
    const pubCheck = validateProductPublication({
      name,
      sellingPricePaise: Number(sellingPricePaise),
      stockQty: Number(stockQty),
      description,
      confirmedByAdmin: Boolean(confirmedByAdmin),
    });
    if (!pubCheck.valid) {
      res.status(400).json({ error: pubCheck.reason });
      return;
    }
  }

  const now = new Date().toISOString();
  const cleanSlug =
    (slug || name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `product-${Date.now()}`;

  if (id) {
    db.prepare(`
      UPDATE products
      SET name = ?, slug = ?, description = ?, category_slug = ?, sku = ?,
          selling_price_paise = ?, purchase_cost_paise = ?, packaging_cost_paise = ?,
          stock_qty = ?, low_stock_threshold = ?, status = ?, confirmed_by_admin = ?,
          images_json = ?, tags_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name.trim(),
      cleanSlug,
      description.trim(),
      categorySlug,
      sku.trim(),
      Number(sellingPricePaise),
      Number(purchaseCostPaise || 0),
      Number(packagingCostPaise || 0),
      Number(stockQty || 0),
      Number(lowStockThreshold || 5),
      status || 'draft',
      confirmedByAdmin ? 1 : 0,
      JSON.stringify(Array.isArray(images) && images.length > 0 ? images : []),
      JSON.stringify(Array.isArray(tags) ? tags : []),
      now,
      id
    );

    writeAuditLog({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'PRODUCT_UPDATED',
      entityType: 'products',
      entityId: id,
      details: { name, status, sellingPricePaise, stockQty, confirmedByAdmin },
    });

    res.json({ updated: true, id });
  } else {
    const newId = `prod-${Date.now()}`;
    db.prepare(`
      INSERT INTO products (
        id, name, slug, description, category_slug, tags_json, images_json, sku,
        selling_price_paise, purchase_cost_paise, packaging_cost_paise,
        stock_qty, reserved_qty, low_stock_threshold, status, confirmed_by_admin, featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?)
    `).run(
      newId,
      name.trim(),
      cleanSlug,
      description.trim(),
      categorySlug || 'hair-accessories',
      JSON.stringify(Array.isArray(tags) ? tags : []),
      JSON.stringify(Array.isArray(images) ? images : []),
      (sku || `PC-${Date.now()}`).trim(),
      Number(sellingPricePaise || 0),
      Number(purchaseCostPaise || 0),
      Number(packagingCostPaise || 0),
      Number(stockQty || 0),
      Number(lowStockThreshold || 5),
      status || 'draft',
      confirmedByAdmin ? 1 : 0,
      now,
      now
    );

    writeAuditLog({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'PRODUCT_CREATED',
      entityType: 'products',
      entityId: newId,
      details: { name, status, sellingPricePaise, stockQty },
    });

    res.status(201).json({ created: true, id: newId });
  }
});

// Inventory Manual Adjustment / Damaged / Returned (Section 8)
app.post('/api/admin/inventory/adjust', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { productId, movementType, quantityDelta, reason } = req.body || {};

  if (!productId || !reason || String(reason).trim().length < 3) {
    res.status(400).json({ error: 'Product and a clear adjustment reason are required.' });
    return;
  }
  const delta = Number(quantityDelta);
  if (!Number.isInteger(delta) || delta === 0) {
    res.status(400).json({ error: 'Quantity delta must be a non-zero integer.' });
    return;
  }

  try {
    const updated = runInTransaction(() => {
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
      if (!prod) throw new Error('Product not found');

      const newBalance = prod.stock_qty + delta;
      if (newBalance < prod.reserved_qty) {
        throw new Error(
          `Cannot reduce stock below currently reserved quantity (${prod.reserved_qty}).`
        );
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(
        newBalance,
        now,
        productId
      );

      db.prepare(`
        INSERT INTO inventory_movements (
          id, product_id, variant_id, movement_type, quantity_delta, balance_after, unit_cost_paise, reference_id, reason, actor_email, created_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, 'MANUAL-ADJ', ?, ?, ?)
      `).run(
        `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId,
        movementType || 'adjustment',
        delta,
        newBalance,
        prod.purchase_cost_paise,
        String(reason).trim(),
        admin.email,
        now
      );

      writeAuditLog({
        actorId: admin.userId,
        actorEmail: admin.email,
        actorRole: admin.role,
        action: 'INVENTORY_ADJUSTED',
        entityType: 'products',
        entityId: productId,
        details: { movementType, quantityDelta: delta, newBalance, reason },
      });

      return { productId, newBalance };
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Suppliers & Goods Receipt (WAC Purchase Order)
app.post('/api/admin/suppliers', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { name, contactPerson, phone, email, city, state, notes } = req.body || {};
  if (!name || !contactPerson || !phone) {
    res.status(400).json({ error: 'Supplier name, contact person, and phone are required.' });
    return;
  }
  const id = `sup-${Date.now()}`;
  db.prepare(`
    INSERT INTO suppliers (id, name, contact_person, phone, email, city, state, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name.trim(),
    contactPerson.trim(),
    phone.trim(),
    (email || '').trim(),
    (city || 'Gurugram').trim(),
    (state || 'Haryana').trim(),
    (notes || '').trim(),
    new Date().toISOString()
  );
  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'SUPPLIER_CREATED',
    entityType: 'suppliers',
    entityId: id,
    details: { name },
  });
  res.status(201).json({ id });
});

app.post('/api/admin/purchases/receive', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { supplierId, poNumber, notes, items } = req.body || {};
  if (!supplierId || !poNumber || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Supplier, PO number, and at least one item are required.' });
    return;
  }
  try {
    const result = receiveGoodsTransaction({
      supplierId,
      poNumber: String(poNumber).trim(),
      notes,
      actorEmail: admin.email,
      items: items.map((i: any) => ({
        productId: i.productId,
        quantity: Number(i.quantity),
        unitCostPaise: Number(i.unitCostPaise),
      })),
    });
    writeAuditLog({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'GOODS_RECEIVED',
      entityType: 'purchase_orders',
      entityId: result.purchaseOrderId,
      details: { poNumber, totalCostPaise: result.totalCostPaise },
    });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Order Status & Stock Reservation Release / Deduction (Section 9)
app.post('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { newStatus, note, refundedAmountPaise, actualCourierCostPaise, paymentGatewayFeePaise } =
    req.body || {};
  const orderId = req.params.id;

  try {
    runInTransaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
      if (!order) throw new Error('Order not found');

      const oldStatus: OrderStatus = order.order_status;
      const targetStatus: OrderStatus = newStatus;
      const normOld = String(oldStatus || '').toLowerCase();
      const normTarget = String(targetStatus || '').toLowerCase();
      const now = new Date().toISOString();
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];

      // Require verified payment before confirming an order
      if (normTarget === 'confirmed' && String(order.payment_status || '').toLowerCase() !== 'paid') {
        throw new Error(
          'Payment must be verified in the bank/UPI account and marked "paid" before confirming the order.'
        );
      }

      // Handle stock transitions safely
      if (normTarget === 'cancelled' && normOld !== 'cancelled') {
        if (!canReleaseReservationOnCancel(oldStatus)) {
          throw new Error(`Order in status "${oldStatus}" cannot release reservation automatically.`);
        }
        for (const item of items) {
          db.prepare(
            'UPDATE products SET reserved_qty = MAX(0, reserved_qty - ?), updated_at = ? WHERE id = ?'
          ).run(item.quantity, now, item.product_id);

          const prod = db.prepare('SELECT stock_qty, reserved_qty FROM products WHERE id = ?').get(item.product_id) as any;
          db.prepare(`
            INSERT INTO inventory_movements (
              id, product_id, variant_id, movement_type, quantity_delta, balance_after, unit_cost_paise, reference_id, reason, actor_email, created_at
            ) VALUES (?, ?, ?, 'released', ?, ?, ?, ?, ?, ?, ?)
          `).run(
            `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            item.product_id,
            item.variant_id,
            item.quantity,
            prod.stock_qty - prod.reserved_qty,
            item.unit_cost_snapshot_paise,
            order.order_number,
            `Released reserved stock after cancellation of ${order.order_number}`,
            admin.email,
            now
          );
        }
      } else if (
        normTarget === 'shipped' &&
        !['shipped', 'delivered', 'returned', 'refunded'].includes(normOld)
      ) {
        // Convert reserved stock into final sold deduction
        for (const item of items) {
          db.prepare(
            'UPDATE products SET stock_qty = MAX(0, stock_qty - ?), reserved_qty = MAX(0, reserved_qty - ?), updated_at = ? WHERE id = ?'
          ).run(item.quantity, item.quantity, now, item.product_id);

          const prod = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(item.product_id) as any;
          db.prepare(`
            INSERT INTO inventory_movements (
              id, product_id, variant_id, movement_type, quantity_delta, balance_after, unit_cost_paise, reference_id, reason, actor_email, created_at
            ) VALUES (?, ?, ?, 'sold', ?, ?, ?, ?, ?, ?, ?)
          `).run(
            `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            item.product_id,
            item.variant_id,
            -item.quantity,
            prod.stock_qty,
            item.unit_cost_snapshot_paise,
            order.order_number,
            `Stock dispatched & sold on ${order.order_number}`,
            admin.email,
            now
          );
        }
      } else if (normTarget === 'returned' && normOld !== 'returned') {
        for (const item of items) {
          db.prepare('UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?').run(
            item.quantity,
            now,
            item.product_id
          );
          const prod = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(item.product_id) as any;
          db.prepare(`
            INSERT INTO inventory_movements (
              id, product_id, variant_id, movement_type, quantity_delta, balance_after, unit_cost_paise, reference_id, reason, actor_email, created_at
            ) VALUES (?, ?, ?, 'returned', ?, ?, ?, ?, ?, ?, ?)
          `).run(
            `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            item.product_id,
            item.variant_id,
            item.quantity,
            prod.stock_qty,
            item.unit_cost_snapshot_paise,
            order.order_number,
            `Returned item restocked from ${order.order_number}`,
            admin.email,
            now
          );
        }
      }

      const history = JSON.parse(order.status_history_json || '[]');
      history.push({
        status: targetStatus,
        timestamp: now,
        note: note || `Updated by ${admin.email}`,
      });

      const refundVal =
        refundedAmountPaise !== undefined
          ? Number(refundedAmountPaise)
          : normTarget === 'refunded'
          ? order.total_paise
          : order.refunded_amount_paise;

      const newPayStatus = normTarget === 'refunded' ? 'refunded' : order.payment_status;

      db.prepare(`
        UPDATE orders
        SET order_status = ?, payment_status = ?, refunded_amount_paise = ?,
            actual_courier_cost_paise = COALESCE(?, actual_courier_cost_paise),
            payment_gateway_fee_paise = COALESCE(?, payment_gateway_fee_paise),
            status_history_json = ?, updated_at = ?
        WHERE id = ?
      `).run(
        targetStatus,
        newPayStatus,
        refundVal,
        actualCourierCostPaise !== undefined ? Number(actualCourierCostPaise) : null,
        paymentGatewayFeePaise !== undefined ? Number(paymentGatewayFeePaise) : null,
        JSON.stringify(history),
        now,
        orderId
      );

      writeAuditLog({
        actorId: admin.userId,
        actorEmail: admin.email,
        actorRole: admin.role,
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'orders',
        entityId: orderId,
        details: { orderNumber: order.order_number, from: oldStatus, to: targetStatus, refundVal },
      });
    });

    res.json({ updated: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Verify Manual / WhatsApp Payment after checking actual bank/UPI transaction (Section 10)
app.post('/api/admin/orders/:id/verify-payment', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { bankReferenceUtr, verifiedAmountPaise, notes } = req.body || {};
  const orderId = req.params.id;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const effectiveMode: PaymentMode =
    order.payment_mode === 'demo' ? 'whatsapp' : (order.payment_mode as PaymentMode);

  const check = verifyManualPaymentByAdmin({
    paymentMode: effectiveMode,
    adminUserId: admin.userId,
    adminRole: admin.role,
    bankReferenceUtr: String(bankReferenceUtr || ''),
    verifiedAmountPaise: Number(verifiedAmountPaise ?? order.total_paise),
    expectedAmountPaise: order.total_paise,
  });

  if (!check.allowed) {
    res.status(400).json({ error: check.reason });
    return;
  }

  const now = new Date().toISOString();
  const nextPayStatus = 'paid';
  const previousPaymentStatus = order.payment_status;

  db.prepare(`
    UPDATE payment_records
    SET status = ?, verified_bank_utr = ?, verified_by_admin_id = ?, verified_by_admin_email = ?, verified_at = ?, notes = ?, updated_at = ?
    WHERE order_id = ?
  `).run(
    nextPayStatus,
    String(bankReferenceUtr).trim(),
    admin.userId,
    admin.email,
    now,
    (notes || 'Verified against bank/UPI statement by Admin').trim(),
    now,
    orderId
  );

  // Keep payment_status separate from order fulfilment status (admin explicitly confirms order next)
  db.prepare(`
    UPDATE orders
    SET payment_status = ?, updated_at = ?
    WHERE id = ?
  `).run(nextPayStatus, now, orderId);

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'PAYMENT_VERIFIED',
    entityType: 'orders',
    entityId: orderId,
    details: {
      orderNumber: order.order_number,
      previousPaymentStatus,
      newPaymentStatus: nextPayStatus,
      verifiedByAdminId: admin.userId,
      verifiedByAdminEmail: admin.email,
      verifiedAt: now,
      verifiedBankUtr: String(bankReferenceUtr).trim(),
      amountPaise: order.total_paise,
    },
  });

  res.json({
    verified: true,
    paymentStatus: nextPayStatus,
    verifiedByAdminEmail: admin.email,
    verifiedAt: now,
  });
});

// Admin Confirm Order after Verified Payment & Generate Prefilled Confirmation WhatsApp Link
app.post('/api/admin/orders/:id/confirm', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const orderId = req.params.id;
  const { note } = req.body || {};

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const check = canAdminConfirmOrder({
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    adminUserId: admin.userId,
    adminRole: admin.role,
  });

  if (!check.allowed) {
    res.status(400).json({ error: check.reason });
    return;
  }

  const now = new Date().toISOString();
  const previousOrderStatus = order.order_status;
  const nextOrderStatus = 'confirmed';
  const history = JSON.parse(order.status_history_json || '[]');
  history.push({
    status: nextOrderStatus,
    timestamp: now,
    note: note || `Order confirmed by ${admin.email} after verified payment.`,
  });

  db.prepare(`
    UPDATE orders
    SET order_status = ?, status_history_json = ?, updated_at = ?
    WHERE id = ?
  `).run(nextOrderStatus, JSON.stringify(history), now, orderId);

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
  const parsedAddr = JSON.parse(order.shipping_address_json || '{}');
  const waPayload = {
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerMobile: order.customer_mobile,
    address: parsedAddr,
    items: items.map((i) => ({
      productName: i.product_name,
      variantName: i.variant_name,
      quantity: i.quantity,
      unitPricePaise: i.unit_price_paise,
      lineTotalPaise: i.line_total_paise,
    })),
    subtotalPaise: order.subtotal_paise,
    shippingFeePaise: order.shipping_fee_paise,
    totalPaise: order.total_paise,
    paymentStatus: order.payment_status,
    orderStatus: nextOrderStatus,
  };

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'ORDER_CONFIRMED',
    entityType: 'orders',
    entityId: orderId,
    details: {
      orderNumber: order.order_number,
      previousOrderStatus,
      newOrderStatus: nextOrderStatus,
      confirmedByAdminEmail: admin.email,
      confirmedAt: now,
    },
  });

  res.json({
    confirmed: true,
    orderStatus: nextOrderStatus,
    whatsappConfirmationUrl: buildAdminOrderConfirmationWhatsAppUrl(
      order.customer_mobile,
      waPayload
    ),
    whatsappConfirmationMessage: buildAdminOrderConfirmationWhatsAppMessage(waPayload),
  });
});

// Update Shipment & Add Genuine Shipment Event (Section 11)
app.post('/api/admin/orders/:id/shipment', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const orderId = req.params.id;
  const {
    courierName,
    awbNumber,
    trackingUrl,
    pickupDate,
    estimatedDeliveryDate,
    shipmentStatus,
    actualShippingCostPaise,
    eventLabel,
    eventLocation,
  } = req.body || {};

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const now = new Date().toISOString();
  const shp = db.prepare('SELECT * FROM shipment_records WHERE order_id = ?').get(orderId) as any;
  const nextStatus: ShipmentStatus = shipmentStatus || shp?.shipment_status || 'AWB Assigned';

  db.prepare(`
    UPDATE shipment_records
    SET courier_name = ?, awb_number = ?, tracking_url = ?, pickup_date = ?,
        estimated_delivery_date = ?, shipment_status = ?,
        actual_shipping_cost_paise = COALESCE(?, actual_shipping_cost_paise),
        last_updated_at = ?
    WHERE order_id = ?
  `).run(
    (courierName || shp?.courier_name || '').trim() || null,
    (awbNumber || shp?.awb_number || '').trim() || null,
    (trackingUrl || shp?.tracking_url || '').trim() || null,
    (pickupDate || shp?.pickup_date || '').trim() || null,
    (estimatedDeliveryDate || '').trim() || null,
    nextStatus,
    actualShippingCostPaise !== undefined && actualShippingCostPaise !== ''
      ? Number(actualShippingCostPaise)
      : null,
    now,
    orderId
  );

  db.prepare(`
    UPDATE orders
    SET shipment_status = ?,
        actual_courier_cost_paise = COALESCE(?, actual_courier_cost_paise),
        updated_at = ?
    WHERE id = ?
  `).run(
    nextStatus,
    actualShippingCostPaise !== undefined && actualShippingCostPaise !== ''
      ? Number(actualShippingCostPaise)
      : null,
    now,
    orderId
  );

  if (eventLabel && shp) {
    db.prepare(`
      INSERT INTO shipment_events (id, shipment_id, event_code, status_label, location, event_timestamp, raw_source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'admin', ?)
    `).run(
      `shev-${Date.now()}`,
      shp.id,
      nextStatus.toUpperCase().replace(/\s+/g, '_'),
      String(eventLabel).trim(),
      String(eventLocation || 'Gurugram Origin Hub').trim(),
      now,
      now
    );
  }

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'SHIPMENT_UPDATED',
    entityType: 'shipment_records',
    entityId: orderId,
    details: { courierName, awbNumber, shipmentStatus: nextStatus, estimatedDeliveryDate },
  });

  res.json({ updated: true });
});

// Authenticated Shiprocket Webhook Receiver with Deduplication (Section 11)
app.post('/api/webhooks/shiprocket', (req, res) => {
  const configuredToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  const incomingToken = req.headers['x-api-key'] || req.headers['x-shiprocket-token'];

  if (!configuredToken || configuredToken === '' || incomingToken !== configuredToken) {
    res.status(401).json({ error: 'Unauthorized webhook signature or Shiprocket integration not active.' });
    return;
  }

  const { awb, current_status, current_timestamp, location, etd } = req.body || {};
  if (!awb) {
    res.status(400).json({ error: 'Missing AWB number' });
    return;
  }

  const shp = db.prepare('SELECT * FROM shipment_records WHERE awb_number = ?').get(String(awb)) as any;
  if (!shp) {
    res.status(404).json({ error: 'Shipment AWB not found' });
    return;
  }

  const existingEvents = (
    db.prepare('SELECT event_code, event_timestamp, location FROM shipment_events WHERE shipment_id = ?').all(shp.id) as any[]
  ).map((e) => ({
    eventCode: e.event_code,
    eventTimestamp: e.event_timestamp,
    location: e.location,
  }));

  const newEvent = {
    eventCode: String(current_status || 'SCAN').toUpperCase(),
    eventTimestamp: String(current_timestamp || new Date().toISOString()),
    location: String(location || 'Carrier Hub'),
  };

  if (isDuplicateShipmentEvent(existingEvents, newEvent)) {
    res.json({ deduplicated: true });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO shipment_events (id, shipment_id, event_code, status_label, location, event_timestamp, raw_source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'shiprocket_webhook', ?)
  `).run(
    `shev-${Date.now()}`,
    shp.id,
    newEvent.eventCode,
    String(current_status || 'In Transit'),
    newEvent.location,
    newEvent.eventTimestamp,
    now
  );

  db.prepare(`
    UPDATE shipment_records
    SET shipment_status = ?, estimated_delivery_date = COALESCE(?, estimated_delivery_date), last_updated_at = ?
    WHERE id = ?
  `).run(String(current_status || 'In Transit'), etd || null, now, shp.id);

  res.json({ processed: true });
});

// Expenses Management (Section 14)
app.post('/api/admin/expenses', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { title, category, amountPaise, expenseDate, vendorName, notes } = req.body || {};
  if (!title || !amountPaise || Number(amountPaise) <= 0) {
    res.status(400).json({ error: 'Expense title and positive INR amount are required.' });
    return;
  }
  const id = `exp-${Date.now()}`;
  db.prepare(`
    INSERT INTO expenses (id, title, category, amount_paise, expense_date, vendor_name, notes, recorded_by_email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    title.trim(),
    category || 'operations',
    Number(amountPaise),
    expenseDate || new Date().toISOString().slice(0, 10),
    (vendorName || '').trim(),
    (notes || '').trim(),
    admin.email,
    new Date().toISOString()
  );

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'EXPENSE_RECORDED',
    entityType: 'expenses',
    entityId: id,
    details: { title, category, amountPaise },
  });

  res.status(201).json({ id });
});

// Configurable Shipping Rules & Serviceable PIN Codes (Section 11)
app.post('/api/admin/shipping-rules', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { tier1MaxSubtotalPaise, tier1FeePaise, tier2MaxSubtotalPaise, tier2FeePaise, freeShippingThresholdPaise } =
    req.body || {};

  const updatedRules: ShippingRuleConfig = {
    tier1MaxSubtotalPaise: Number(tier1MaxSubtotalPaise ?? 49900),
    tier1FeePaise: Number(tier1FeePaise ?? 5900),
    tier2MaxSubtotalPaise: Number(tier2MaxSubtotalPaise ?? 99900),
    tier2FeePaise: Number(tier2FeePaise ?? 3900),
    freeShippingThresholdPaise: Number(freeShippingThresholdPaise ?? 99900),
  };

  db.prepare('UPDATE store_settings SET value_json = ?, updated_at = ? WHERE key = ?').run(
    JSON.stringify(updatedRules),
    new Date().toISOString(),
    'shipping_rules'
  );

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'SHIPPING_RULES_UPDATED',
    entityType: 'store_settings',
    entityId: 'shipping_rules',
    details: updatedRules as any,
  });

  res.json({ updated: true, shippingRules: updatedRules });
});

app.get('/api/admin/delivery-policy', requireAdmin, (_req, res) => {
  const policy = getDeliveryPolicySettings();
  res.json({ policy });
});

app.post('/api/admin/delivery-policy', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const policyInput = req.body?.policy || req.body || {};
  const current = getDeliveryPolicySettings();
  const updated: DeliveryPolicyConfig = {
    mode: policyInput.mode === 'whitelist_only' ? 'whitelist_only' : 'pan_india',
    codRule: ['all_serviceable', 'whitelist_only', 'disabled'].includes(policyInput.codRule)
      ? policyInput.codRule
      : current.codRule,
    estimatedMinDaysPanIndia: Math.max(1, Number(policyInput.estimatedMinDaysPanIndia ?? current.estimatedMinDaysPanIndia)),
    estimatedMaxDaysPanIndia: Math.max(2, Number(policyInput.estimatedMaxDaysPanIndia ?? current.estimatedMaxDaysPanIndia)),
    fallbackServiceableByDefault: Boolean(policyInput.fallbackServiceableByDefault ?? current.fallbackServiceableByDefault),
    unserviceableNotice: String(policyInput.unserviceableNotice || current.unserviceableNotice).trim(),
  };

  saveDeliveryPolicySettings(updated);

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'DELIVERY_POLICY_UPDATED',
    entityType: 'store_settings',
    entityId: 'delivery_policy',
    details: updated as any,
  });

  res.json({ updated: true, policy: updated });
});

app.post('/api/admin/pincodes', requireAdmin, async (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { pincode, city, district, state, isServiceable, codAvailable } = req.body || {};
  const cleanPin = String(pincode || '').trim();
  if (!validateIndianPinCodeFormat(cleanPin)) {
    res.status(400).json({ error: 'Valid 6-digit Indian PIN code starting with digits 1-9 is required.' });
    return;
  }

  let finalCity = String(city || '').trim();
  let finalDistrict = String(district || '').trim();
  let finalState = String(state || '').trim();

  // If postal information is incomplete, verify and auto-fill via India Post API / cache
  if (!finalDistrict || !finalState) {
    const postal = await lookupPostalPincodeHelper(cleanPin);
    if (postal.isValid) {
      if (!finalState) finalState = postal.state ?? '';
      if (!finalDistrict) finalDistrict = postal.district ?? '';
      if (!finalCity) finalCity = postal.city ?? postal.district ?? '';
    }
  }

  if (!finalCity || !finalState) {
    res.status(400).json({ error: 'City and State are required, and could not be determined from the PIN code.' });
    return;
  }

  const serviceableVal = isServiceable !== undefined ? (isServiceable ? 1 : 0) : 1;
  const codVal = codAvailable !== undefined ? (codAvailable ? 1 : 0) : 1;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO serviceable_pincodes (pincode, city, district, state, is_serviceable, cod_available, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pincode) DO UPDATE SET
      city = excluded.city,
      district = excluded.district,
      state = excluded.state,
      is_serviceable = excluded.is_serviceable,
      cod_available = excluded.cod_available,
      updated_at = excluded.updated_at
  `).run(cleanPin, finalCity, finalDistrict || finalCity, finalState, serviceableVal, codVal, now);

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'PINCODE_UPDATED',
    entityType: 'serviceable_pincodes',
    entityId: cleanPin,
    details: {
      pincode: cleanPin,
      city: finalCity,
      district: finalDistrict || finalCity,
      state: finalState,
      isServiceable: serviceableVal,
      codAvailable: codVal,
    },
  });

  res.json({
    updated: true,
    pincode: {
      pincode: cleanPin,
      city: finalCity,
      district: finalDistrict || finalCity,
      state: finalState,
      isServiceable: Boolean(serviceableVal),
      codAvailable: Boolean(codVal),
      updatedAt: now,
    },
  });
});

app.delete('/api/admin/pincodes/:pincode', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const cleanPin = String(req.params.pincode || '').trim();
  if (!cleanPin) {
    res.status(400).json({ error: 'PIN code is required' });
    return;
  }

  db.prepare('DELETE FROM serviceable_pincodes WHERE pincode = ?').run(cleanPin);

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'PINCODE_DELETED',
    entityType: 'serviceable_pincodes',
    entityId: cleanPin,
    details: { pincode: cleanPin },
  });

  res.json({ deleted: true, pincode: cleanPin });
});

app.post('/api/admin/pincodes/toggle', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { pincode, field } = req.body || {};
  const cleanPin = String(pincode || '').trim();

  const existing = db.prepare('SELECT * FROM serviceable_pincodes WHERE pincode = ?').get(cleanPin) as any;
  if (!existing) {
    res.status(404).json({ error: 'PIN code not found in delivery registry' });
    return;
  }

  const now = new Date().toISOString();
  if (field === 'cod') {
    const newVal = existing.cod_available ? 0 : 1;
    db.prepare('UPDATE serviceable_pincodes SET cod_available = ?, updated_at = ? WHERE pincode = ?').run(newVal, now, cleanPin);
    writeAuditLog({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'PINCODE_COD_TOGGLED',
      entityType: 'serviceable_pincodes',
      entityId: cleanPin,
      details: { pincode: cleanPin, codAvailable: newVal },
    });
    res.json({ success: true, pincode: cleanPin, codAvailable: Boolean(newVal) });
  } else {
    const newVal = existing.is_serviceable ? 0 : 1;
    db.prepare('UPDATE serviceable_pincodes SET is_serviceable = ?, updated_at = ? WHERE pincode = ?').run(newVal, now, cleanPin);
    writeAuditLog({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'PINCODE_SERVICEABILITY_TOGGLED',
      entityType: 'serviceable_pincodes',
      entityId: cleanPin,
      details: { pincode: cleanPin, isServiceable: newVal },
    });
    res.json({ success: true, pincode: cleanPin, isServiceable: Boolean(newVal) });
  }
});

// Store Settings & Policies Update (Section 16)
app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const { general, policies } = req.body || {};
  const now = new Date().toISOString();

  if (general) {
    const current = getStoreSettings().general;
    const merged = { ...current, ...general };
    db.prepare('UPDATE store_settings SET value_json = ?, updated_at = ? WHERE key = ?').run(
      JSON.stringify(merged),
      now,
      'general'
    );
  }

  if (policies) {
    const currentPol = getStoreSettings().policies;
    const mergedPol = { ...currentPol, ...policies };
    db.prepare('UPDATE store_settings SET value_json = ?, updated_at = ? WHERE key = ?').run(
      JSON.stringify(mergedPol),
      now,
      'policies'
    );
  }

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'STORE_SETTINGS_UPDATED',
    entityType: 'store_settings',
    details: { updatedGeneral: Boolean(general), updatedPolicies: Boolean(policies) },
  });

  res.json({ updated: true, settings: getStoreSettings() });
});

// ============================================================================
// SECURE EXCEL (.XLSX) & CSV EXPORTS (SECTION 15)
// ============================================================================

app.get('/api/admin/export/:reportType', requireAdmin, (req, res) => {
  const admin = (req as any).adminSession as AdminSession;
  const reportType = req.params.reportType;
  const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
  const overview = computeFullAdminOverview();

  let sheetName = 'Report';
  let fileNameBase = 'Report';
  let rows: Array<Record<string, string | number>> = [];

  switch (reportType) {
    case 'Products':
      sheetName = 'Products';
      fileNameBase = 'Products';
      rows = overview.products.map((p) => ({
        SKU: sanitizeSpreadsheetCell(p.sku),
        Name: sanitizeSpreadsheetCell(p.name),
        Category: sanitizeSpreadsheetCell(p.categorySlug),
        Status: sanitizeSpreadsheetCell(p.status),
        ConfirmedByAdmin: p.confirmedByAdmin ? 'Yes' : 'No',
        'Selling Price (INR)': paiseToRupees(p.sellingPricePaise),
        'Weighted Avg Purchase Cost (INR)': paiseToRupees(p.purchaseCostPaise),
        'Packaging Cost (INR)': paiseToRupees(p.packagingCostPaise),
        'Physical Stock': p.stockQty,
        'Reserved Stock': p.reservedQty,
        'Available Stock': p.availableQty,
        'Updated At': sanitizeSpreadsheetCell(p.updatedAt),
      }));
      break;

    case 'Inventory':
      sheetName = 'Inventory';
      fileNameBase = 'Inventory';
      rows = overview.products.map((p) => ({
        SKU: sanitizeSpreadsheetCell(p.sku),
        Product: sanitizeSpreadsheetCell(p.name),
        Status: sanitizeSpreadsheetCell(p.status),
        'Physical Stock': p.stockQty,
        'Reserved Stock': p.reservedQty,
        'Available Stock': p.availableQty,
        'Low Stock Threshold': p.lowStockThreshold,
        'Unit WAC Cost (INR)': paiseToRupees(p.purchaseCostPaise),
        'Total Inventory Value (INR)': paiseToRupees(Math.max(0, p.stockQty) * p.purchaseCostPaise),
      }));
      break;

    case 'PurchaseHistory':
      sheetName = 'PurchaseHistory';
      fileNameBase = 'PurchaseHistory';
      rows = (overview.purchases as any[]).map((po) => ({
        'PO Number': sanitizeSpreadsheetCell(po.po_number),
        'Supplier ID': sanitizeSpreadsheetCell(po.supplier_id),
        Status: sanitizeSpreadsheetCell(po.status),
        'Total Cost (INR)': paiseToRupees(po.total_cost_paise),
        Notes: sanitizeSpreadsheetCell(po.notes || ''),
        'Received Date': sanitizeSpreadsheetCell(po.received_at || po.created_at),
      }));
      break;

    case 'Orders':
      sheetName = 'Orders';
      fileNameBase = 'Orders';
      rows = overview.recentOrders.map((o) => ({
        'Order ID': sanitizeSpreadsheetCell(o.orderNumber),
        'Customer Name': sanitizeSpreadsheetCell(o.customerName),
        Mobile: sanitizeSpreadsheetCell(o.customerMobile),
        City: sanitizeSpreadsheetCell(o.shippingAddress?.city || ''),
        State: sanitizeSpreadsheetCell(o.shippingAddress?.state || ''),
        PIN: sanitizeSpreadsheetCell(o.shippingAddress?.pincode || ''),
        'Order Status': sanitizeSpreadsheetCell(o.orderStatus),
        'Payment Mode': sanitizeSpreadsheetCell(o.paymentMode),
        'Payment Status': sanitizeSpreadsheetCell(o.paymentStatus),
        'Shipment Status': sanitizeSpreadsheetCell(o.shipmentStatus),
        'Subtotal (INR)': paiseToRupees(o.subtotalPaise),
        'Combo Discount (INR)': paiseToRupees(o.comboDiscountPaise || 0),
        'Shipping Fee (INR)': paiseToRupees(o.shippingFeePaise),
        'Total (INR)': paiseToRupees(o.totalPaise),
        'Gift Recipient': sanitizeSpreadsheetCell(o.giftPersonalization?.recipientName || ''),
        'Gift Occasion': sanitizeSpreadsheetCell(o.giftPersonalization?.occasion || ''),
        'Gift Note': sanitizeSpreadsheetCell(o.giftPersonalization?.giftNote || ''),
        'Created At': sanitizeSpreadsheetCell(o.createdAt),
      }));
      break;

    case 'Customers':
      sheetName = 'Customers';
      fileNameBase = 'Customers';
      rows = (overview.customers as any[]).map((c) => ({
        'Customer ID': sanitizeSpreadsheetCell(c.id),
        'Full Name': sanitizeSpreadsheetCell(c.full_name),
        Mobile: sanitizeSpreadsheetCell(c.mobile),
        Email: sanitizeSpreadsheetCell(c.email || ''),
        'Joined Date': sanitizeSpreadsheetCell(c.created_at),
      }));
      break;

    case 'SalesRevenue':
      sheetName = 'SalesRevenue';
      fileNameBase = 'SalesRevenue';
      rows = [
        {
          Metric: 'Gross Non-Cancelled Order Value (INR)',
          'Amount (INR)': paiseToRupees(overview.financialReport.grossSalesPaise),
        },
        {
          Metric: 'Verified Paid Revenue (INR)',
          'Amount (INR)': paiseToRupees(overview.financialReport.paidRevenuePaise),
        },
        {
          Metric: 'Shipping Fees Collected on Paid Orders (INR)',
          'Amount (INR)': paiseToRupees(overview.financialReport.shippingFeesCollectedPaise),
        },
        {
          Metric: 'Refunds Total (INR)',
          'Amount (INR)': paiseToRupees(overview.financialReport.refundsTotalPaise),
        },
        {
          Metric: 'Net Paid Revenue (INR)',
          'Amount (INR)': paiseToRupees(overview.financialReport.netPaidRevenuePaise),
        },
      ];
      break;

    case 'ProductProfitMargins':
      sheetName = 'ProductProfitMargins';
      fileNameBase = 'ProductProfitMargins';
      rows = overview.products.map((p) => {
        const unitMarginPaise =
          p.sellingPricePaise - p.purchaseCostPaise - p.packagingCostPaise;
        const marginPct =
          p.sellingPricePaise > 0
            ? Number(((unitMarginPaise / p.sellingPricePaise) * 100).toFixed(1))
            : 0;
        return {
          SKU: sanitizeSpreadsheetCell(p.sku),
          Product: sanitizeSpreadsheetCell(p.name),
          Status: sanitizeSpreadsheetCell(p.status),
          'Selling Price (INR)': paiseToRupees(p.sellingPricePaise),
          'Purchase Cost (INR)': paiseToRupees(p.purchaseCostPaise),
          'Packaging Cost (INR)': paiseToRupees(p.packagingCostPaise),
          'Unit Gross Margin (INR)': paiseToRupees(unitMarginPaise),
          'Gross Margin (%)': marginPct,
        };
      });
      break;

    case 'OrderProfitability':
      sheetName = 'OrderProfitability';
      fileNameBase = 'OrderProfitability';
      rows = overview.recentOrders.map((o) => {
        const cogsPaise = (o.items || []).reduce(
          (sum: number, i: any) => sum + i.quantity * (i.unit_cost_snapshot_paise || 0),
          0
        );
        const pkgPaise = (o.items || []).reduce(
          (sum: number, i: any) => sum + i.quantity * (i.packaging_cost_snapshot_paise || 0),
          0
        );
        const isPaid = o.paymentStatus === 'Paid';
        const netOrderProfitPaise = isPaid
          ? o.totalPaise -
            (o.refundedAmountPaise || 0) -
            cogsPaise -
            pkgPaise -
            (o.actualCourierCostPaise || 0) -
            (o.paymentGatewayFeePaise || 0)
          : 0;
        return {
          'Order ID': sanitizeSpreadsheetCell(o.orderNumber),
          'Order Status': sanitizeSpreadsheetCell(o.orderStatus),
          'Payment Status': sanitizeSpreadsheetCell(o.paymentStatus),
          'Order Total (INR)': paiseToRupees(o.totalPaise),
          'Historical COGS Snapshot (INR)': paiseToRupees(cogsPaise),
          'Packaging Cost Snapshot (INR)': paiseToRupees(pkgPaise),
          'Actual Courier Cost (INR)':
            o.actualCourierCostPaise !== null ? paiseToRupees(o.actualCourierCostPaise) : 'Unrecorded',
          'Realized Contribution Profit (INR)': isPaid
            ? paiseToRupees(netOrderProfitPaise)
            : 'Unpaid / Demo (₹0)',
        };
      });
      break;

    case 'Expenses':
      sheetName = 'Expenses';
      fileNameBase = 'Expenses';
      rows = (overview.expenses as any[]).map((e) => ({
        Date: sanitizeSpreadsheetCell(e.expense_date),
        Title: sanitizeSpreadsheetCell(e.title),
        Category: sanitizeSpreadsheetCell(e.category),
        Vendor: sanitizeSpreadsheetCell(e.vendor_name || ''),
        'Amount (INR)': paiseToRupees(e.amount_paise),
        Notes: sanitizeSpreadsheetCell(e.notes || ''),
        'Recorded By': sanitizeSpreadsheetCell(e.recorded_by_email),
      }));
      break;

    case 'LowStock':
      sheetName = 'LowStock';
      fileNameBase = 'LowStock';
      rows = overview.lowStockProducts.map((p) => ({
        SKU: sanitizeSpreadsheetCell(p.sku),
        Product: sanitizeSpreadsheetCell(p.name),
        'Available Stock': p.availableQty,
        'Low Stock Threshold': p.lowStockThreshold,
        'Unit Purchase Cost (INR)': paiseToRupees(p.purchaseCostPaise),
      }));
      break;

    case 'Reviews':
      sheetName = 'ProductReviews';
      fileNameBase = 'ProductReviews';
      rows = ((overview as any).reviews || getAllReviewsForAdmin()).map((r: any) => ({
        'Review ID': sanitizeSpreadsheetCell(r.id),
        'Product ID': sanitizeSpreadsheetCell(r.product_id),
        'Product Name': sanitizeSpreadsheetCell(r.product_name || ''),
        'Order Number': sanitizeSpreadsheetCell(r.order_number),
        'Customer Name': sanitizeSpreadsheetCell(r.customer_name),
        'Rating (Stars)': r.rating,
        'Review Title': sanitizeSpreadsheetCell(r.review_title || ''),
        'Review Text': sanitizeSpreadsheetCell(r.review_text),
        'Verified Purchase': r.is_verified_purchase ? 'Yes' : 'No',
        Status: sanitizeSpreadsheetCell(r.status),
        'Created At': sanitizeSpreadsheetCell(r.created_at),
      }));
      break;

    default:
      res.status(400).json({ error: `Unsupported report type: ${reportType}` });
      return;
  }

  writeAuditLog({
    actorId: admin.userId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'REPORT_EXPORTED',
    entityType: 'exports',
    entityId: `${fileNameBase}.${format}`,
  });

  const worksheet = XLSX.utils.json_to_sheet(
    rows.length > 0 ? rows : [{ Notice: 'No records matching current filter.' }]
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  if (format === 'csv') {
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileNameBase}.csv"`);
    res.send(csvOutput);
    return;
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${fileNameBase}.xlsx"`);
  res.send(buffer);
});

// ============================================================================
// SERVER-SIDE GEMINI AI CONCIERGE & STUDIO ROUTES
// ============================================================================

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Multi-Turn Chatbot / Gift Concierge (Supports gemini-3.8-flash, gemini-4-argon, gemini-3.1-flash-lite)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, modelMode } = req.body || {};
    const ai = getGeminiClient();
    const selectedModel =
      modelMode === 'complex'
        ? 'gemini-4-argon'
        : modelMode === 'fast'
        ? 'gemini-3.1-flash-lite'
        : 'gemini-3.8-flash';

    const { products } = getFormattedCatalogue(false);
    const activeSummary = products
      .filter((p) => p.status === 'active')
      .map((p) => `${p.name} (₹${(p.sellingPricePaise / 100).toFixed(0)}, ${p.availableQty} in stock)`)
      .join('; ');

    const systemInstruction = `You are the Pretty Charm Gifting & Styling Concierge for Pretty Charm (shipping from Gurugram, Haryana, India).
Current active in-stock products: ${activeSummary}.
Note: Gift Hampers (Mini Hamper ₹299, Bestie Box ₹299, Premium Box ₹449, Celebration Box ₹449) are currently in Draft awaiting owner confirmation and cannot be purchased until published.
Shipping rules: Subtotal < ₹499 is ₹59; ₹499–₹998 is ₹39; ₹999+ is Free Shipping.
Keep answers warm, concise, honest, and in Indian Rupees (INR). Never invent stock or fake discounts.`;

    const contents = Array.isArray(messages)
      ? messages.map((m: any) => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: String(m.text || '') }],
        }))
      : [{ role: 'user', parts: [{ text: 'Recommend a gift from Pretty Charm.' }] }];

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        systemInstruction,
      },
    });

    res.json({
      text: response.text || 'I would love to help you pick a gift from our active collection!',
      modelUsed: selectedModel,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gemini AI Concierge request failed.' });
  }
});

// 2. Google Search & Maps Grounding (gemini-3.8-flash)
app.post('/api/ai/grounding', async (req, res) => {
  try {
    const { query, groundingType } = req.body || {};
    const ai = getGeminiClient();

    // Note: googleMaps cannot be combined with googleSearch in the same request
    const tools =
      groundingType === 'maps' ? [{ googleMaps: {} }] : [{ googleSearch: {} }];

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: String(
        query ||
          (groundingType === 'maps'
            ? 'Show gifting and boutique delivery landmarks around Gurugram, Haryana 122001.'
            : 'What are the latest trending hair claw and dainty rose gold jewellery gifting styles in India?')
      ),
      config: {
        tools,
      },
    });

    const chunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    res.json({
      text: response.text || '',
      groundingChunks: chunks,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Grounding lookup failed.' });
  }
});

// 3. Create & Edit Images (gemini-nano-banana-2.1 and gemini-3-pro-image-preview with 1K/2K/4K)
app.post('/api/ai/image', async (req, res) => {
  try {
    const { prompt, imageSize, aspectRatio, base64Image, mimeType, useProPreview } = req.body || {};
    const ai = getGeminiClient();

    const modelName = useProPreview ? 'gemini-3-pro-image-preview' : 'gemini-nano-banana-2.1';
    const parts: any[] = [];
    if (base64Image) {
      parts.push({
        inlineData: {
          data: String(base64Image).replace(/^data:image\/\w+;base64,/, ''),
          mimeType: mimeType || 'image/png',
        },
      });
    }
    parts.push({
      text: String(
        prompt ||
          'Luxury blush pink gift hamper box with rose gold satin ribbon and pearl hair claw on cream stone'
      ),
    });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio || '1:1',
          imageSize: imageSize || '1K',
        },
      },
    });

    let generatedImageUrl: string | null = null;
    let textNote = '';
    const candidateParts = response.candidates?.[0]?.content?.parts || [];
    for (const part of candidateParts) {
      if (part.inlineData) {
        generatedImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      } else if (part.text) {
        textNote += part.text;
      }
    }

    if (!generatedImageUrl) {
      res.status(500).json({ error: 'No image returned from model.' });
      return;
    }

    res.json({ imageUrl: generatedImageUrl, text: textNote, modelUsed: modelName });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Image generation failed.' });
  }
});

// 4. Generate Video from Text or Animate Uploaded Photo (gemini-omni-1.1-flash via Interactions API)
app.post('/api/ai/video', async (req, res) => {
  try {
    const { prompt, aspectRatio, base64Image, mimeType } = req.body || {};
    const ai = getGeminiClient();
    const validRatio = aspectRatio === '9:16' ? '9:16' : '16:9';

    const inputPayload: any = base64Image
      ? [
          {
            type: 'image',
            mime_type: mimeType || 'image/png',
            data: String(base64Image).replace(/^data:image\/\w+;base64,/, ''),
          },
          {
            type: 'text',
            text: String(
              prompt ||
                'Soft studio light shimmers across the blush pink gift box and rose gold pearls in slow motion.'
            ),
          },
        ]
      : String(
          prompt ||
            'Close-up studio cinematography of a blush pink gift hamper with rose gold ribbon and pearl hair accessories.'
        );

    const interaction = await (ai as any).interactions.create(
      {
        model: 'gemini-omni-1.1-flash',
        input: inputPayload,
        background: false,
        store: false,
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: validRatio,
          duration: '5s',
          resolution: '720p',
        },
      },
      { timeout: 300000 }
    );

    const videoPart = interaction.output_video;
    if (videoPart && videoPart.data) {
      const mime = videoPart.mime_type || 'video/mp4';
      res.json({
        videoUrl: `data:${mime};base64,${videoPart.data}`,
        aspectRatio: validRatio,
      });
      return;
    }

    res.status(500).json({ error: 'Video generation did not return video data.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Video generation failed.' });
  }
});

// ============================================================================
// VITE DEV SERVER / PRODUCTION STATIC MOUNT
// ============================================================================

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pretty Charm full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
