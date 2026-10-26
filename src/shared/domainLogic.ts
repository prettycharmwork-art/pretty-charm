/**
 * Pure domain logic for Pretty Charm E-Commerce Platform.
 * Handles integer paise arithmetic, shipping calculation, PIN code validation,
 * publication rules, Weighted Average Cost (WAC) inventory valuation,
 * stock reservations/releases, payment verification safeguards, order tracking
 * phone verification, courier webhook deduplication, and spreadsheet escaping.
 */

export type ProductStatus = 'active' | 'draft' | 'coming-soon' | 'out-of-stock' | 'archived';

export type OrderStatus =
  | 'awaiting_payment'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'Pending Confirmation'
  | 'Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Return Requested'
  | 'Returned'
  | 'Refunded';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'Demo Mode - Not Paid'
  | 'Pending'
  | 'Awaiting Verification'
  | 'Paid'
  | 'Failed'
  | 'Refunded';

export type ShipmentStatus =
  | 'Not Shipped'
  | 'AWB Assigned'
  | 'Picked Up'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'RTO / Returned';

export type PaymentMode = 'whatsapp' | 'demo' | 'manual' | 'razorpay';

export interface ShippingRuleConfig {
  tier1MaxSubtotalPaise: number; // default 49900 (₹499)
  tier1FeePaise: number;         // default 5900 (₹59)
  tier2MaxSubtotalPaise: number; // default 99900 (₹999)
  tier2FeePaise: number;         // default 3900 (₹39)
  freeShippingThresholdPaise: number; // default 99900 (₹999)
}

export const DEFAULT_SHIPPING_RULES: ShippingRuleConfig = {
  tier1MaxSubtotalPaise: 49900,
  tier1FeePaise: 5900,
  tier2MaxSubtotalPaise: 99900,
  tier2FeePaise: 3900,
  freeShippingThresholdPaise: 99900,
};

export interface ServiceablePinCode {
  pincode: string;
  city: string;
  state: string;
  district?: string;
  isServiceable: boolean;
  codAvailable: boolean;
  updatedAt?: string;
}

export interface DeliveryPolicyConfig {
  mode: 'pan_india' | 'whitelist' | 'whitelist_only';
  defaultCodAvailable?: boolean;
  serviceabilityNotice?: string;
  unserviceableNotice?: string;
  codRule?: 'all_serviceable' | 'whitelist_only' | 'disabled';
  estimatedMinDaysPanIndia?: number;
  estimatedMaxDaysPanIndia?: number;
  fallbackServiceableByDefault?: boolean;
}

export const DEFAULT_DELIVERY_POLICY: DeliveryPolicyConfig = {
  mode: 'pan_india',
  defaultCodAvailable: false,
  serviceabilityNotice: 'Standard Pan-India courier dispatch from Gurugram (122001), Haryana.',
};

export interface PostOfficeDetail {
  name: string;
  district: string;
  state: string;
  branchType?: string;
  deliveryStatus?: string;
  pincode: string;
}

export interface PostalPincodeLookupResult {
  pincode: string;
  isValid: boolean;
  state?: string;
  district?: string;
  city?: string;
  postOffices: PostOfficeDetail[];
  source: 'india_post' | 'india_post_api' | 'cache' | 'sqlite_cache' | 'builtin_fallback' | 'unverified' | 'api_failed';
  error?: string;
  /** Optional branch/office type from India Post API */
  officeType?: string;
  /** Whether we can deliver to this PIN */
  isServiceable?: boolean;
  /** Whether Cash on Delivery is available */
  codAvailable?: boolean;
  /** Human-readable serviceability message */
  serviceabilityMessage?: string;
}

// ============================================================================
// SMART CART: CONFIGURABLE COMBO OFFERS & FREE SHIPPING PROGRESS
// ============================================================================

export interface ComboOfferConfig {
  id: string;
  name: string;
  description: string;
  badge: string;
  minItems: number;
  discountPaise: number;
  categorySlugs?: string[];
  isActive: boolean;
}

export const DEFAULT_COMBO_OFFERS: ComboOfferConfig[] = [
  {
    id: 'combo-accessories-duo',
    name: 'Dainty Duo Offer',
    description: 'Add 2 or more Hair Accessories or Jewellery items to your bag and get ₹50 off instantly!',
    badge: 'Save ₹50',
    minItems: 2,
    discountPaise: 5000,
    categorySlugs: ['hair-accessories', 'jewellery'],
    isActive: true,
  },
  {
    id: 'combo-hamper-bundle',
    name: 'Luxury Hamper Celebration Bundle',
    description: 'Buy any 2 Gift Hampers and save ₹100 on your curated gifting order!',
    badge: 'Save ₹100',
    minItems: 2,
    discountPaise: 10000,
    categorySlugs: ['gift-hampers'],
    isActive: true,
  },
];

export interface CartComboEvaluation {
  appliedCombos: Array<{
    comboId: string;
    comboName: string;
    discountPaise: number;
    badge: string;
  }>;
  totalComboDiscountPaise: number;
}

export function evaluateCartComboOffers(
  items: Array<{ productId: string; quantity: number; categorySlug?: string; unitPricePaise: number }>,
  comboRules: ComboOfferConfig[] = DEFAULT_COMBO_OFFERS
): CartComboEvaluation {
  const activeRules = (comboRules || []).filter((r) => r.isActive);
  const appliedCombos: CartComboEvaluation['appliedCombos'] = [];
  let totalComboDiscountPaise = 0;

  for (const rule of activeRules) {
    let eligibleCount = 0;
    for (const item of items) {
      if (
        !rule.categorySlugs ||
        rule.categorySlugs.length === 0 ||
        (item.categorySlug && rule.categorySlugs.includes(item.categorySlug))
      ) {
        eligibleCount += item.quantity;
      }
    }
    if (eligibleCount >= rule.minItems) {
      appliedCombos.push({
        comboId: rule.id,
        comboName: rule.name,
        discountPaise: rule.discountPaise,
        badge: rule.badge,
      });
      totalComboDiscountPaise += rule.discountPaise;
    }
  }

  return {
    appliedCombos,
    totalComboDiscountPaise,
  };
}

export interface FreeShippingProgress {
  thresholdPaise: number;
  subtotalPaise: number;
  qualifiesForFreeShipping: boolean;
  amountNeededPaise: number;
  progressPercentage: number;
  message: string;
}

export function calculateFreeShippingProgress(
  subtotalPaise: number,
  thresholdPaise: number = 99900
): FreeShippingProgress {
  const subtotal = Math.max(0, subtotalPaise);
  const threshold = Math.max(1, thresholdPaise);
  const qualifies = subtotal >= threshold;
  const needed = qualifies ? 0 : threshold - subtotal;
  const progress = Math.min(100, Math.round((subtotal / threshold) * 100));

  let message = '';
  if (qualifies) {
    message = '🎉 Congratulations! You have unlocked FREE Delivery across India!';
  } else {
    message = `Add ₹${Math.ceil(needed / 100)} more to your bag to unlock FREE Delivery!`;
  }

  return {
    thresholdPaise: threshold,
    subtotalPaise: subtotal,
    qualifiesForFreeShipping: qualifies,
    amountNeededPaise: needed,
    progressPercentage: progress,
    message,
  };
}

// ============================================================================
// GIFT PERSONALIZATION (RECIPIENT NAME, OCCASION, GIFT NOTE)
// ============================================================================

export type GiftOccasion =
  | 'Birthday'
  | 'Anniversary'
  | 'Rakhi / Bhai Dooj'
  | 'Congratulations'
  | 'Festive Celebration'
  | 'Just Because / Self Love'
  | 'Other';

export interface GiftPersonalizationInput {
  isGift?: boolean;
  recipientName?: string;
  occasion?: GiftOccasion | string;
  giftNote?: string;
}

export function validateGiftPersonalization(input?: GiftPersonalizationInput | null): {
  isValid: boolean;
  sanitized: GiftPersonalizationInput;
  error?: string;
} {
  if (!input || !input.isGift) {
    return {
      isValid: true,
      sanitized: { isGift: false, recipientName: '', occasion: '', giftNote: '' },
    };
  }

  const recipientName = (input.recipientName || '').trim().slice(0, 80);
  const occasion = (input.occasion || 'Just Because / Self Love').trim().slice(0, 50);
  const giftNote = (input.giftNote || '').trim().slice(0, 300);

  return {
    isValid: true,
    sanitized: {
      isGift: true,
      recipientName,
      occasion,
      giftNote,
    },
  };
}

export function formatGiftPersonalizationForWhatsApp(gift?: GiftPersonalizationInput | null): string {
  if (!gift || !gift.isGift) return '';
  const lines: string[] = ['🎁 *Complimentary Gift Personalization:*'];
  if (gift.recipientName) lines.push(`• *To:* ${gift.recipientName}`);
  if (gift.occasion) lines.push(`• *Occasion:* ${gift.occasion}`);
  if (gift.giftNote) lines.push(`• *Personal Note:* "${gift.giftNote}"`);
  return lines.join('\n');
}

// ============================================================================
// ORDER ACCESS TOKENS & GUEST PRIVACY SAFEGUARDS
// ============================================================================

export function generateOrderAccessToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return 'pc_tok_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function maskCustomerMobile(mobile: string): string {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length <= 4) return '******';
  const prefix = digits.slice(0, 2);
  const suffix = digits.slice(-2);
  return `+91 ${prefix}****${suffix}`;
}

export function maskCustomerAddress(address: Record<string, any> | string): {
  maskedHouseFlat: string;
  streetLocality: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  maskedSummary: string;
} {
  const parsed = typeof address === 'string' ? JSON.parse(address || '{}') : (address || {});
  const city = String(parsed.city || '').trim();
  const district = String(parsed.district || city).trim();
  const state = String(parsed.state || '').trim();
  const pincode = String(parsed.pincode || '').trim();
  const locality = String(parsed.locality || parsed.streetLocality || '').trim();

  const maskedHouseFlat = 'Residential Address (Protected)';
  const maskedSummary = [locality, district, `${state} - ${pincode}`].filter(Boolean).join(', ');

  return {
    maskedHouseFlat,
    streetLocality: locality,
    city,
    district,
    state,
    pincode,
    maskedSummary,
  };
}

export function maskCustomerEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `*@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

// ============================================================================
// REAL VERIFIED REVIEWS VALIDATION
// ============================================================================

export interface ProductReview {
  id: string;
  productId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  rating: number; // 1 to 5
  reviewTitle?: string;
  reviewText: string;
  isVerifiedPurchase: boolean;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: string;
}

export function canOrderReviewProduct(
  order: {
    orderStatus: string;
    paymentStatus: string;
    items: Array<{ productId: string }>;
  },
  targetProductId: string
): { eligible: boolean; reason?: string } {
  const hasItem = (order.items || []).some((i) => i.productId === targetProductId);
  if (!hasItem) {
    return { eligible: false, reason: 'This order does not contain the selected product.' };
  }
  const isPaid = order.paymentStatus === 'paid' || order.paymentStatus === 'Paid';
  const isFulfilled = ['confirmed', 'processing', 'packed', 'shipped', 'delivered'].includes(
    String(order.orderStatus).toLowerCase()
  );

  if (!isPaid && !isFulfilled) {
    return {
      eligible: false,
      reason: 'Reviews are permitted only for verified paid and confirmed orders. No unverified reviews allowed.',
    };
  }

  return { eligible: true };
}

export interface ReverseGeocodeResult {
  pincode?: string;
  locality?: string;
  street?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  displayName?: string;
  isEstimated: boolean;
  source: 'nominatim' | 'fallback_hub';
  error?: string;
}

export interface DomainProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  categorySlug: string;
  status: ProductStatus;
  sellingPricePaise: number;
  purchaseCostPaise: number;
  packagingCostPaise: number;
  stockQty: number;
  reservedQty: number;
  lowStockThreshold: number;
}

export interface DomainVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  priceDeltaPaise: number;
  stockQty: number;
  reservedQty: number;
}

export interface CheckoutCartItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  clientSubmittedPricePaise?: number; // Ignored by server calculation
}

export interface ValidatedOrderItemSnapshot {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  unitCostSnapshotPaise: number;
  packagingCostSnapshotPaise: number;
}

export interface CheckoutAddressInput {
  fullName: string;
  mobile: string;
  houseFlat: string;
  street: string;
  locality: string;
  landmark?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  streetLocality?: string; // backwards compatibility
  selectedPostOffice?: string;
  deliveryInstructions?: string;
}

// ============================================================================
// 1. CURRENCY ARITHMETIC (INTEGER PAISE)
// ============================================================================

export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees < 0) {
    throw new Error('Invalid INR rupee amount');
  }
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

export function formatINR(paise: number, showDecimals = false): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(rupees);
}

// ============================================================================
// 2. PRODUCT PUBLICATION & STOCK AVAILABILITY RULES
// ============================================================================

export function getAvailableStock(stockQty: number, reservedQty: number): number {
  return Math.max(0, Math.floor(stockQty) - Math.floor(reservedQty));
}

export function canCustomerPurchaseProduct(
  product: DomainProduct,
  requestedQty: number,
  categoryStatus: 'active' | 'coming-soon' = 'active',
  variant?: DomainVariant | null
): { allowed: boolean; reason?: string } {
  if (!Number.isInteger(requestedQty) || requestedQty <= 0) {
    return { allowed: false, reason: 'Quantity must be a positive integer.' };
  }
  if (categoryStatus === 'coming-soon') {
    return { allowed: false, reason: 'This category is Coming Soon and not yet open for purchase.' };
  }
  if (product.status === 'draft') {
    return {
      allowed: false,
      reason: `"${product.name}" is currently an unconfirmed draft awaiting owner approval and cannot be purchased.`,
    };
  }
  if (product.status === 'coming-soon') {
    return {
      allowed: false,
      reason: `"${product.name}" is Coming Soon and cannot be purchased yet.`,
    };
  }
  if (product.status === 'archived') {
    return {
      allowed: false,
      reason: `"${product.name}" is archived and no longer available.`,
    };
  }
  if (product.status === 'out-of-stock') {
    return {
      allowed: false,
      reason: `"${product.name}" is currently out of stock.`,
    };
  }

  const available = variant
    ? getAvailableStock(variant.stockQty, variant.reservedQty)
    : getAvailableStock(product.stockQty, product.reservedQty);

  if (available < requestedQty) {
    return {
      allowed: false,
      reason:
        available === 0
          ? `"${product.name}" is out of stock.`
          : `Only ${available} unit(s) of "${product.name}" available in stock.`,
    };
  }

  return { allowed: true };
}

export function validateProductPublication(product: {
  name: string;
  sellingPricePaise: number;
  stockQty: number;
  description: string;
  confirmedByAdmin: boolean;
}): { valid: boolean; reason?: string } {
  if (!product.confirmedByAdmin) {
    return { valid: false, reason: 'Admin must confirm actual contents, stock, and selling price before publishing.' };
  }
  if (!product.name || product.name.trim().length < 3) {
    return { valid: false, reason: 'Product name must be at least 3 characters.' };
  }
  if (!Number.isInteger(product.sellingPricePaise) || product.sellingPricePaise <= 0) {
    return { valid: false, reason: 'Selling price must be greater than ₹0.' };
  }
  if (!Number.isInteger(product.stockQty) || product.stockQty < 0) {
    return { valid: false, reason: 'Stock quantity cannot be negative.' };
  }
  if (!product.description || product.description.trim().length < 10) {
    return { valid: false, reason: 'Confirmed product description must be at least 10 characters.' };
  }
  return { valid: true };
}

// ============================================================================
// 3. SHIPPING FEE ENGINE & INDIAN PIN-CODE VALIDATION
// ============================================================================

export function calculateCustomerShippingFeePaise(
  subtotalPaise: number,
  rules: ShippingRuleConfig = DEFAULT_SHIPPING_RULES
): number {
  if (subtotalPaise <= 0) return 0;
  if (subtotalPaise >= rules.freeShippingThresholdPaise) {
    return 0;
  }
  if (subtotalPaise >= rules.tier1MaxSubtotalPaise) {
    return rules.tier2FeePaise;
  }
  return rules.tier1FeePaise;
}

export const ALL_INDIAN_STATES_AND_UTS: ReadonlyArray<string> = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

const STATE_NAME_ALIASES: Record<string, string> = {
  'nct of delhi': 'Delhi',
  'new delhi': 'Delhi',
  'delhi': 'Delhi',
  'orissa': 'Odisha',
  'odisha': 'Odisha',
  'pondicherry': 'Puducherry',
  'puducherry': 'Puducherry',
  'uttaranchal': 'Uttarakhand',
  'uttarakhand': 'Uttarakhand',
  'jammu & kashmir': 'Jammu and Kashmir',
  'jammu and kashmir': 'Jammu and Kashmir',
  'andaman & nicobar islands': 'Andaman and Nicobar Islands',
  'andaman and nicobar islands': 'Andaman and Nicobar Islands',
  'dadra & nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'daman & diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'dadra and nagar haveli and daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
};

export function normalizeIndianStateName(state: string): string {
  const clean = String(state || '').trim();
  const lower = clean.toLowerCase();
  if (STATE_NAME_ALIASES[lower]) {
    return STATE_NAME_ALIASES[lower];
  }
  const match = ALL_INDIAN_STATES_AND_UTS.find(
    (s) => s.toLowerCase() === lower
  );
  return match || clean;
}

export function validateIndianPinCodeFormat(pincode: string): boolean {
  const cleaned = String(pincode || '').trim();
  return /^[1-9][0-9]{5}$/.test(cleaned);
}

export const BUILTIN_INDIAN_POSTAL_REGISTRY: Record<
  string,
  { state: string; district: string; city: string; postOffices: PostOfficeDetail[] }
> = {
  '122001': {
    state: 'Haryana',
    district: 'Gurugram',
    city: 'Gurugram',
    postOffices: [
      { name: 'Gurgaon H.O', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Delivery', pincode: '122001' },
      { name: 'Arjun Nagar', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Non-Delivery', pincode: '122001' },
      { name: 'New Colony', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Non-Delivery', pincode: '122001' },
      { name: 'Shivaji Nagar', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Non-Delivery', pincode: '122001' },
      { name: 'Urban Estate', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Non-Delivery', pincode: '122001' },
    ],
  },
  '122002': {
    state: 'Haryana',
    district: 'Gurugram',
    city: 'Gurugram',
    postOffices: [
      { name: 'DLF Phase-II', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Delivery', pincode: '122002' },
      { name: 'Sikanderpur', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Non-Delivery', pincode: '122002' },
    ],
  },
  '122003': {
    state: 'Haryana',
    district: 'Gurugram',
    city: 'Gurugram',
    postOffices: [
      { name: 'Sector 45', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Delivery', pincode: '122003' },
      { name: 'Sushant Lok', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Non-Delivery', pincode: '122003' },
    ],
  },
  '122009': {
    state: 'Haryana',
    district: 'Gurugram',
    city: 'Gurugram',
    postOffices: [
      { name: 'Galleria Market (DLF Phase-IV)', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Delivery', pincode: '122009' },
    ],
  },
  '122010': {
    state: 'Haryana',
    district: 'Gurugram',
    city: 'Gurugram',
    postOffices: [
      { name: 'DLF Cyber City', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Delivery', pincode: '122010' },
      { name: 'Cyber Hub', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Delivery', pincode: '122010' },
    ],
  },
  '122018': {
    state: 'Haryana',
    district: 'Gurugram',
    city: 'Gurugram',
    postOffices: [
      { name: 'Sohna Road', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Delivery', pincode: '122018' },
      { name: 'Badshahpur', district: 'Gurugram', state: 'Haryana', deliveryStatus: 'Delivery', pincode: '122018' },
    ],
  },
  '110001': {
    state: 'Delhi',
    district: 'Central Delhi',
    city: 'New Delhi',
    postOffices: [
      { name: 'Connaught Place', district: 'Central Delhi', state: 'Delhi', deliveryStatus: 'Delivery', pincode: '110001' },
      { name: 'Barakhamba Road', district: 'Central Delhi', state: 'Delhi', deliveryStatus: 'Non-Delivery', pincode: '110001' },
      { name: 'Parliament Street', district: 'Central Delhi', state: 'Delhi', deliveryStatus: 'Delivery', pincode: '110001' },
    ],
  },
  '110016': {
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    postOffices: [
      { name: 'Hauz Khas', district: 'South Delhi', state: 'Delhi', deliveryStatus: 'Delivery', pincode: '110016' },
      { name: 'Green Park Market', district: 'South Delhi', state: 'Delhi', deliveryStatus: 'Non-Delivery', pincode: '110016' },
      { name: 'IIT Delhi', district: 'South Delhi', state: 'Delhi', deliveryStatus: 'Delivery', pincode: '110016' },
    ],
  },
  '110049': {
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    postOffices: [
      { name: 'South Extension', district: 'South Delhi', state: 'Delhi', deliveryStatus: 'Delivery', pincode: '110049' },
      { name: 'Andrews Ganj', district: 'South Delhi', state: 'Delhi', deliveryStatus: 'Delivery', pincode: '110049' },
    ],
  },
  '201301': {
    state: 'Uttar Pradesh',
    district: 'Gautam Buddha Nagar',
    city: 'Noida',
    postOffices: [
      { name: 'Noida Sector 16', district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh', deliveryStatus: 'Delivery', pincode: '201301' },
      { name: 'Sector 27 Noida', district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh', deliveryStatus: 'Delivery', pincode: '201301' },
    ],
  },
  '121001': {
    state: 'Haryana',
    district: 'Faridabad',
    city: 'Faridabad',
    postOffices: [
      { name: 'Faridabad Old', district: 'Faridabad', state: 'Haryana', deliveryStatus: 'Delivery', pincode: '121001' },
    ],
  },
  '160017': {
    state: 'Chandigarh',
    district: 'Chandigarh',
    city: 'Chandigarh',
    postOffices: [
      { name: 'Sector 17 Chandigarh', district: 'Chandigarh', state: 'Chandigarh', deliveryStatus: 'Delivery', pincode: '160017' },
    ],
  },
  '302001': {
    state: 'Rajasthan',
    district: 'Jaipur',
    city: 'Jaipur',
    postOffices: [
      { name: 'Jaipur G.P.O.', district: 'Jaipur', state: 'Rajasthan', deliveryStatus: 'Delivery', pincode: '302001' },
    ],
  },
  '400001': {
    state: 'Maharashtra',
    district: 'Mumbai',
    city: 'Mumbai',
    postOffices: [
      { name: 'Mumbai G.P.O.', district: 'Mumbai', state: 'Maharashtra', deliveryStatus: 'Delivery', pincode: '400001' },
      { name: 'Fort', district: 'Mumbai', state: 'Maharashtra', deliveryStatus: 'Delivery', pincode: '400001' },
    ],
  },
  '400050': {
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    city: 'Mumbai',
    postOffices: [
      { name: 'Bandra West', district: 'Mumbai Suburban', state: 'Maharashtra', deliveryStatus: 'Delivery', pincode: '400050' },
      { name: 'Bandra', district: 'Mumbai Suburban', state: 'Maharashtra', deliveryStatus: 'Delivery', pincode: '400050' },
    ],
  },
  '411001': {
    state: 'Maharashtra',
    district: 'Pune',
    city: 'Pune',
    postOffices: [
      { name: 'Pune H.O', district: 'Pune', state: 'Maharashtra', deliveryStatus: 'Delivery', pincode: '411001' },
    ],
  },
  '560001': {
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    postOffices: [
      { name: 'Bengaluru G.P.O.', district: 'Bengaluru Urban', state: 'Karnataka', deliveryStatus: 'Delivery', pincode: '560001' },
      { name: 'MG Road', district: 'Bengaluru Urban', state: 'Karnataka', deliveryStatus: 'Delivery', pincode: '560001' },
    ],
  },
  '560034': {
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    postOffices: [
      { name: 'Koramangala 4th Block', district: 'Bengaluru Urban', state: 'Karnataka', deliveryStatus: 'Delivery', pincode: '560034' },
      { name: 'Koramangala VI Block', district: 'Bengaluru Urban', state: 'Karnataka', deliveryStatus: 'Delivery', pincode: '560034' },
    ],
  },
  '500001': {
    state: 'Telangana',
    district: 'Hyderabad',
    city: 'Hyderabad',
    postOffices: [
      { name: 'Hyderabad G.P.O.', district: 'Hyderabad', state: 'Telangana', deliveryStatus: 'Delivery', pincode: '500001' },
    ],
  },
  '500033': {
    state: 'Telangana',
    district: 'Hyderabad',
    city: 'Hyderabad',
    postOffices: [
      { name: 'Jubilee Hills', district: 'Hyderabad', state: 'Telangana', deliveryStatus: 'Delivery', pincode: '500033' },
    ],
  },
  '600001': {
    state: 'Tamil Nadu',
    district: 'Chennai',
    city: 'Chennai',
    postOffices: [
      { name: 'Chennai G.P.O.', district: 'Chennai', state: 'Tamil Nadu', deliveryStatus: 'Delivery', pincode: '600001' },
    ],
  },
  '700001': {
    state: 'West Bengal',
    district: 'Kolkata',
    city: 'Kolkata',
    postOffices: [
      { name: 'Kolkata G.P.O.', district: 'Kolkata', state: 'West Bengal', deliveryStatus: 'Delivery', pincode: '700001' },
    ],
  },
  '380001': {
    state: 'Gujarat',
    district: 'Ahmedabad',
    city: 'Ahmedabad',
    postOffices: [
      { name: 'Ahmedabad G.P.O.', district: 'Ahmedabad', state: 'Gujarat', deliveryStatus: 'Delivery', pincode: '380001' },
    ],
  },
  '682001': {
    state: 'Kerala',
    district: 'Ernakulam',
    city: 'Kochi',
    postOffices: [
      { name: 'Kochi H.O', district: 'Ernakulam', state: 'Kerala', deliveryStatus: 'Delivery', pincode: '682001' },
    ],
  },
};

export function lookupBuiltinIndianPostalInfo(pincode: string): PostalPincodeLookupResult | null {
  const clean = String(pincode || '').trim();
  if (!validateIndianPinCodeFormat(clean)) return null;
  const match = BUILTIN_INDIAN_POSTAL_REGISTRY[clean];
  if (!match) return null;
  return {
    pincode: clean,
    isValid: true,
    state: match.state,
    district: match.district,
    city: match.city,
    postOffices: match.postOffices,
    source: 'builtin_fallback',
  };
}

export function detectPinCodeLocationMismatch(
  pincode: string,
  enteredState: string,
  enteredDistrict?: string,
  postalInfo?: { state?: string; district?: string } | null
): {
  hasMismatch: boolean;
  type?: 'state' | 'district' | 'both';
  expectedState?: string;
  expectedDistrict?: string;
  message?: string;
} {
  if (!validateIndianPinCodeFormat(pincode) || !postalInfo || !postalInfo.state) {
    return { hasMismatch: false };
  }

  const expStateNorm = normalizeIndianStateName(postalInfo.state).toLowerCase();
  const enteredStateNorm = normalizeIndianStateName(enteredState || '').toLowerCase();
  const stateMismatch = Boolean(enteredStateNorm && expStateNorm && enteredStateNorm !== expStateNorm);

  const expDistClean = String(postalInfo.district || '').trim().toLowerCase();
  const enteredDistClean = String(enteredDistrict || '').trim().toLowerCase();
  // Check district mismatch only if user entered a non-empty district and it does not contain or match expected district
  const districtMismatch = Boolean(
    enteredDistClean &&
      expDistClean &&
      !expDistClean.includes(enteredDistClean) &&
      !enteredDistClean.includes(expDistClean)
  );

  if (stateMismatch && districtMismatch) {
    return {
      hasMismatch: true,
      type: 'both',
      expectedState: postalInfo.state,
      expectedDistrict: postalInfo.district,
      message: `Address & PIN Mismatch: PIN ${pincode} officially belongs to ${postalInfo.district}, ${postalInfo.state}. You selected ${enteredDistrict || 'different district'}, ${enteredState}. Please verify.`,
    };
  }

  if (stateMismatch) {
    return {
      hasMismatch: true,
      type: 'state',
      expectedState: postalInfo.state,
      expectedDistrict: postalInfo.district,
      message: `State Inconsistency: PIN ${pincode} is located in ${postalInfo.state}, but "${enteredState}" was selected. Please update the state or PIN code.`,
    };
  }

  if (districtMismatch) {
    return {
      hasMismatch: true,
      type: 'district',
      expectedState: postalInfo.state,
      expectedDistrict: postalInfo.district,
      message: `District Inconsistency: PIN ${pincode} is officially registered under district ${postalInfo.district}. You entered "${enteredDistrict}".`,
    };
  }

  return { hasMismatch: false };
}

export function evaluateDeliveryServiceability(
  pincode: string,
  configuredPins: ServiceablePinCode[],
  policy: DeliveryPolicyConfig = DEFAULT_DELIVERY_POLICY
): {
  isServiceable: boolean;
  codAvailable: boolean;
  validFormat: boolean;
  status: 'serviceable' | 'unserviceable' | 'invalid_format';
  matchedCity?: string;
  matchedState?: string;
  matchedDistrict?: string;
  message: string;
} {
  const clean = String(pincode || '').trim();
  if (!validateIndianPinCodeFormat(clean)) {
    return {
      isServiceable: false,
      codAvailable: false,
      validFormat: false,
      status: 'invalid_format',
      message: 'PIN code must be exactly 6 numeric digits (cannot start with 0).',
    };
  }

  const match = configuredPins.find((p) => p.pincode === clean);

  // Explicit admin block overrides everything
  if (match && !match.isServiceable) {
    return {
      isServiceable: false,
      codAvailable: false,
      validFormat: true,
      status: 'unserviceable',
      matchedCity: match.city,
      matchedState: match.state,
      matchedDistrict: match.district,
      message: `Delivery to PIN ${clean} (${match.city || 'area'}, ${match.state || ''}) is currently disabled by store admin. Please contact WhatsApp support.`,
    };
  }

  // Explicit admin whitelist
  if (match && match.isServiceable) {
    return {
      isServiceable: true,
      codAvailable: Boolean(match.codAvailable),
      validFormat: true,
      status: 'serviceable',
      matchedCity: match.city,
      matchedState: match.state,
      matchedDistrict: match.district,
      message: `Ships from Gurugram to ${match.city}, ${match.state} (${clean}). Standard Pan-India delivery available.`,
    };
  }

  // Not explicitly configured: apply store delivery policy
  if (policy.mode === 'whitelist') {
    return {
      isServiceable: false,
      codAvailable: false,
      validFormat: true,
      status: 'unserviceable',
      message: `Delivery is currently restricted to select serviceable PIN codes. PIN ${clean} is not on our active delivery list.`,
    };
  }

  // Default Pan-India delivery policy
  return {
    isServiceable: true,
    codAvailable: Boolean(policy.defaultCodAvailable),
    validFormat: true,
    status: 'serviceable',
    message: `Ships Pan-India from Gurugram studio (${clean}). Standard surface and air courier delivery enabled.`,
  };
}

export function checkPinCodeServiceability(
  pincode: string,
  configuredPins: ServiceablePinCode[],
  policy: DeliveryPolicyConfig = DEFAULT_DELIVERY_POLICY
): { validFormat: boolean; isServiceable: boolean; city?: string; state?: string; district?: string; message: string; codAvailable?: boolean } {
  const result = evaluateDeliveryServiceability(pincode, configuredPins, policy);
  return {
    validFormat: result.validFormat,
    isServiceable: result.isServiceable,
    city: result.matchedCity,
    state: result.matchedState,
    district: result.matchedDistrict,
    codAvailable: result.codAvailable,
    message: result.message,
  };
}

// ============================================================================
// 4. SERVER-SIDE CART & CHECKOUT VALIDATION
// ============================================================================

export function normalizeIndianMobile(mobile: string): string {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function validateIndianMobile(mobile: string): boolean {
  const normalized = normalizeIndianMobile(mobile);
  return /^[6-9][0-9]{9}$/.test(normalized);
}

export function validateCheckoutAddress(
  address: CheckoutAddressInput,
  serviceablePins: ServiceablePinCode[],
  policy: DeliveryPolicyConfig = DEFAULT_DELIVERY_POLICY,
  postalData?: { state?: string; district?: string } | null
): { valid: boolean; errors: string[]; mismatchWarning?: string } {
  const errors: string[] = [];

  if (!address.fullName || address.fullName.trim().length < 2) {
    errors.push('Customer full name is required (minimum 2 characters).');
  }
  if (!validateIndianMobile(address.mobile)) {
    errors.push('Valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 is required.');
  }
  if (!address.houseFlat || address.houseFlat.trim().length < 2) {
    errors.push('House / Flat / Building number is required.');
  }

  // Accept street/locality either individually or via backwards-compatible streetLocality
  const streetVal = (address.street || address.streetLocality || '').trim();
  const localityVal = (address.locality || address.streetLocality || address.city || '').trim();
  if (streetVal.length < 2) {
    errors.push('Street / Road name is required.');
  }
  if (localityVal.length < 2) {
    errors.push('Locality / Area / Sector is required.');
  }

  if (!address.city || address.city.trim().length < 2) {
    errors.push('City is required.');
  }

  // District validation (fallback to built-in postal registry or city if not explicitly provided)
  const districtVal = (
    address.district ||
    BUILTIN_INDIAN_POSTAL_REGISTRY[address.pincode]?.district ||
    address.city ||
    ''
  ).trim();
  if (districtVal.length < 2) {
    errors.push('District is required.');
  }

  if (!address.state || address.state.trim().length < 2) {
    errors.push('State / Union Territory is required.');
  } else {
    const norm = normalizeIndianStateName(address.state);
    if (!ALL_INDIAN_STATES_AND_UTS.includes(norm)) {
      errors.push(`"${address.state}" is not a recognized Indian State or Union Territory.`);
    }
  }

  if (!validateIndianPinCodeFormat(address.pincode)) {
    errors.push('PIN code must be exactly 6 numeric digits (e.g. 122001).');
  } else {
    const serviceability = evaluateDeliveryServiceability(address.pincode, serviceablePins, policy);
    if (!serviceability.isServiceable) {
      errors.push(serviceability.message);
    }
  }

  let mismatchWarning: string | undefined;
  if (postalData && postalData.state && validateIndianPinCodeFormat(address.pincode)) {
    const mismatch = detectPinCodeLocationMismatch(
      address.pincode,
      address.state,
      address.district,
      postalData
    );
    if (mismatch.hasMismatch && mismatch.message) {
      mismatchWarning = mismatch.message;
    }
  }

  return { valid: errors.length === 0, errors, mismatchWarning };
}

export function computeServerSideCheckoutTotals(
  cartItems: CheckoutCartItemInput[],
  catalogueProducts: Map<string, DomainProduct>,
  catalogueVariants: Map<string, DomainVariant>,
  categoryStatusMap: Map<string, 'active' | 'coming-soon'>,
  shippingRules: ShippingRuleConfig = DEFAULT_SHIPPING_RULES,
  comboRules: ComboOfferConfig[] = []
): {
  valid: boolean;
  error?: string;
  items: ValidatedOrderItemSnapshot[];
  subtotalPaise: number;
  comboDiscountPaise: number;
  appliedCombos: CartComboEvaluation['appliedCombos'];
  shippingFeePaise: number;
  totalPaise: number;
} {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return {
      valid: false,
      error: 'Your shopping bag is empty.',
      items: [],
      subtotalPaise: 0,
      comboDiscountPaise: 0,
      appliedCombos: [],
      shippingFeePaise: 0,
      totalPaise: 0,
    };
  }

  // Combine duplicate lines for the same product + variant so stock checks cannot be bypassed
  const aggregated = new Map<string, CheckoutCartItemInput>();
  for (const raw of cartItems) {
    const key = `${raw.productId}::${raw.variantId || ''}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += raw.quantity;
    } else {
      aggregated.set(key, { ...raw });
    }
  }

  const validatedItems: ValidatedOrderItemSnapshot[] = [];
  let subtotalPaise = 0;

  for (const item of aggregated.values()) {
    const product = catalogueProducts.get(item.productId);
    if (!product) {
      return {
        valid: false,
        error: `Product "${item.productId}" does not exist.`,
        items: [],
        subtotalPaise: 0,
        comboDiscountPaise: 0,
        appliedCombos: [],
        shippingFeePaise: 0,
        totalPaise: 0,
      };
    }

    const variant = item.variantId ? catalogueVariants.get(item.variantId) || null : null;
    if (item.variantId && (!variant || variant.productId !== product.id)) {
      return {
        valid: false,
        error: `Selected variant for "${product.name}" is invalid.`,
        items: [],
        subtotalPaise: 0,
        comboDiscountPaise: 0,
        appliedCombos: [],
        shippingFeePaise: 0,
        totalPaise: 0,
      };
    }

    const catStatus = categoryStatusMap.get(product.categorySlug) || 'active';
    const check = canCustomerPurchaseProduct(product, item.quantity, catStatus, variant);
    if (!check.allowed) {
      return {
        valid: false,
        error: check.reason,
        items: [],
        subtotalPaise: 0,
        comboDiscountPaise: 0,
        appliedCombos: [],
        shippingFeePaise: 0,
        totalPaise: 0,
      };
    }

    // Always use server-authoritative product & variant price (never clientSubmittedPricePaise)
    const unitPricePaise = product.sellingPricePaise + (variant ? variant.priceDeltaPaise : 0);
    const lineTotalPaise = unitPricePaise * item.quantity;
    subtotalPaise += lineTotalPaise;

    validatedItems.push({
      productId: product.id,
      variantId: variant ? variant.id : null,
      productName: product.name,
      variantName: variant ? variant.name : null,
      sku: variant ? variant.sku : product.sku,
      quantity: item.quantity,
      unitPricePaise,
      lineTotalPaise,
      unitCostSnapshotPaise: product.purchaseCostPaise,
      packagingCostSnapshotPaise: product.packagingCostPaise,
    });
  }

  // Evaluate combo offers on validated cart lines
  const comboCartItems = validatedItems.map((line) => {
    const prod = catalogueProducts.get(line.productId);
    return {
      productId: line.productId,
      quantity: line.quantity,
      categorySlug: prod?.categorySlug,
      unitPricePaise: line.unitPricePaise,
    };
  });
  const comboEval = evaluateCartComboOffers(comboCartItems, comboRules);
  const comboDiscountPaise = Math.min(subtotalPaise, comboEval.totalComboDiscountPaise);
  const discountedSubtotalPaise = Math.max(0, subtotalPaise - comboDiscountPaise);

  const shippingFeePaise = calculateCustomerShippingFeePaise(discountedSubtotalPaise, shippingRules);
  const totalPaise = discountedSubtotalPaise + shippingFeePaise;

  return {
    valid: true,
    items: validatedItems,
    subtotalPaise,
    comboDiscountPaise,
    appliedCombos: comboEval.appliedCombos,
    shippingFeePaise,
    totalPaise,
  };
}

// ============================================================================
// 5. WEIGHTED AVERAGE COST (WAC) & INVENTORY RESERVATION / RELEASE
// ============================================================================

export function calculateNewWeightedAverageCost(
  existingQty: number,
  existingUnitCostPaise: number,
  receivedQty: number,
  receivedUnitCostPaise: number
): number {
  if (receivedQty <= 0) return existingUnitCostPaise;
  const safeExistingQty = Math.max(0, existingQty);
  const totalValuePaise =
    safeExistingQty * existingUnitCostPaise + receivedQty * receivedUnitCostPaise;
  const newTotalQty = safeExistingQty + receivedQty;
  if (newTotalQty <= 0) return receivedUnitCostPaise;
  return Math.round(totalValuePaise / newTotalQty);
}

export function canReleaseReservationOnCancel(orderStatus: OrderStatus | string): boolean {
  const releasableStatuses = [
    'awaiting_payment',
    'confirmed',
    'processing',
    'packed',
    'Pending Confirmation',
    'Confirmed',
    'Processing',
    'Packed',
  ];
  return releasableStatuses.includes(String(orderStatus));
}

// ============================================================================
// 6. PAYMENT SAFEGUARDS & VERIFICATION RULES
// ============================================================================

export function getInitialPaymentStatusForMode(mode: PaymentMode): PaymentStatus {
  if (mode === 'whatsapp') {
    return 'pending';
  }
  if (mode === 'demo') {
    return 'Demo Mode - Not Paid';
  }
  if (mode === 'manual') {
    return 'Awaiting Verification';
  }
  return 'Pending';
}

export function getInitialOrderStatusForMode(mode: PaymentMode): OrderStatus {
  if (mode === 'whatsapp') {
    return 'awaiting_payment';
  }
  return 'Pending Confirmation';
}

export function verifyManualPaymentByAdmin(params: {
  paymentMode: PaymentMode;
  adminUserId: string | null;
  adminRole: string | null;
  bankReferenceUtr: string;
  verifiedAmountPaise: number;
  expectedAmountPaise: number;
}): { allowed: boolean; newStatus?: PaymentStatus; reason?: string } {
  if (!params.adminUserId || !params.adminRole || !['owner', 'admin', 'finance'].includes(params.adminRole)) {
    return { allowed: false, reason: 'Unauthorized: Only an authenticated Admin/Owner can verify payments.' };
  }
  if (params.paymentMode === 'demo') {
    return {
      allowed: false,
      reason: 'Demo mode orders cannot be marked as real Paid orders. Switch store payment mode to WhatsApp, Manual, or Gateway first.',
    };
  }
  if (!params.bankReferenceUtr || params.bankReferenceUtr.trim().length < 6) {
    return {
      allowed: false,
      reason: 'A valid bank/UPI verification reference (min 6 chars) is required after checking the actual bank statement.',
    };
  }
  if (params.verifiedAmountPaise !== params.expectedAmountPaise) {
    return {
      allowed: false,
      reason: `Verified amount (${formatINR(params.verifiedAmountPaise, true)}) does not match order total (${formatINR(params.expectedAmountPaise, true)}).`,
    };
  }
  return {
    allowed: true,
    newStatus: params.paymentMode === 'whatsapp' ? 'paid' : 'Paid',
  };
}

// ============================================================================
// 7. ORDER TRACKING, PHONE VERIFICATION, ETA & WEBHOOK DEDUPLICATION
// ============================================================================

export function verifyOrderLookupPhone(storedMobile: string, submittedMobile: string): boolean {
  const normStored = normalizeIndianMobile(storedMobile);
  const normSubmitted = normalizeIndianMobile(submittedMobile);
  return normStored.length === 10 && normStored === normSubmitted;
}

export function getHonestEtaDisplay(carrierTrustedEtaIso: string | null | undefined): string {
  if (!carrierTrustedEtaIso || !carrierTrustedEtaIso.trim()) {
    return 'Estimated delivery not available yet.';
  }
  return carrierTrustedEtaIso.trim();
}

export function isDuplicateShipmentEvent(
  existingEvents: Array<{ eventCode: string; eventTimestamp: string; location: string }>,
  incomingEvent: { eventCode: string; eventTimestamp: string; location: string }
): boolean {
  return existingEvents.some(
    (e) =>
      e.eventCode === incomingEvent.eventCode &&
      e.eventTimestamp === incomingEvent.eventTimestamp &&
      e.location === incomingEvent.location
  );
}

// ============================================================================
// 8. SALES, PROFIT, COGS & REFUND CALCULATIONS
// ============================================================================

export interface ProfitOrderRecord {
  orderId: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalPaise: number;
  shippingFeeCollectedPaise: number;
  totalPaise: number;
  refundedAmountPaise: number;
  actualCourierCostPaise: number | null;
  paymentGatewayFeePaise: number | null;
  items: Array<{
    quantity: number;
    unitPricePaise: number;
    unitCostSnapshotPaise: number | null;
    packagingCostSnapshotPaise: number | null;
  }>;
}

export interface ProfitReportSummary {
  totalOrdersCount: number;
  paidOrdersCount: number;
  grossSalesPaise: number;
  paidRevenuePaise: number;
  shippingFeesCollectedPaise: number;
  refundsTotalPaise: number;
  netPaidRevenuePaise: number;
  cogsPaise: number;
  packagingCostPaise: number;
  actualShippingCostPaise: number;
  paymentFeesPaise: number;
  operatingExpensesPaise: number;
  unsoldInventoryValuePaise: number;
  grossProfitPaise: number;
  contributionProfitPaise: number;
  estimatedNetProfitPaise: number;
  isEstimated: boolean;
  missingInputs: string[];
}

/**
 * Documented Financial Formulas:
 * - Unpaid or Demo orders are NEVER counted in Paid Revenue or COGS.
 * - Unsold inventory is NEVER counted in COGS; it is reported separately as Asset Value.
 * - Net Paid Revenue = Paid Order Totals (including shipping fees collected) - Refunds.
 * - COGS = Sum of (quantity * unitCostSnapshotPaise) for Paid, non-cancelled, non-returned orders.
 * - Gross Profit = Net Paid Revenue - COGS - Packaging Cost.
 * - Contribution Profit = Gross Profit - Actual Courier Shipping Cost - Payment Gateway Fees.
 * - Estimated Net Profit = Contribution Profit - Operating/Marketing Expenses.
 */
export function calculateFinancialReport(
  orders: ProfitOrderRecord[],
  operatingExpensesPaise: number,
  unsoldInventoryValuePaise: number
): ProfitReportSummary {
  let totalOrdersCount = orders.length;
  let paidOrdersCount = 0;
  let grossSalesPaise = 0;
  let paidRevenuePaise = 0;
  let shippingFeesCollectedPaise = 0;
  let refundsTotalPaise = 0;
  let cogsPaise = 0;
  let packagingCostPaise = 0;
  let actualShippingCostPaise = 0;
  let paymentFeesPaise = 0;

  const missingInputsSet = new Set<string>();

  for (const order of orders) {
    const normOrderStatus = String(order.orderStatus || '').toLowerCase();
    const normPayStatus = String(order.paymentStatus || '').toLowerCase();

    if (normOrderStatus !== 'cancelled') {
      grossSalesPaise += order.totalPaise;
    }

    if (order.refundedAmountPaise > 0) {
      refundsTotalPaise += order.refundedAmountPaise;
    }

    const isPaidReal = normPayStatus === 'paid' || normPayStatus === 'refunded';
    if (!isPaidReal) {
      continue;
    }

    paidOrdersCount += 1;
    paidRevenuePaise += order.totalPaise;
    shippingFeesCollectedPaise += order.shippingFeeCollectedPaise;

    // Only count COGS and packaging if the order was not cancelled or returned to stock
    const isFulfilledSale = !['cancelled', 'returned'].includes(normOrderStatus);
    if (isFulfilledSale) {
      for (const item of order.items) {
        if (item.unitCostSnapshotPaise === null || item.unitCostSnapshotPaise <= 0) {
          missingInputsSet.add(`Missing purchase cost on order ${order.orderId}`);
        } else {
          cogsPaise += item.quantity * item.unitCostSnapshotPaise;
        }

        if (item.packagingCostSnapshotPaise === null) {
          missingInputsSet.add(`Missing packaging cost on order ${order.orderId}`);
        } else {
          packagingCostPaise += item.quantity * item.packagingCostSnapshotPaise;
        }
      }

      if (['shipped', 'delivered'].includes(normOrderStatus)) {
        if (order.actualCourierCostPaise === null) {
          missingInputsSet.add(`Missing actual courier cost on shipped order ${order.orderId}`);
        } else {
          actualShippingCostPaise += order.actualCourierCostPaise;
        }
      }

      if (order.paymentGatewayFeePaise === null) {
        missingInputsSet.add(`Payment fee not recorded on order ${order.orderId}`);
      } else {
        paymentFeesPaise += order.paymentGatewayFeePaise;
      }
    }
  }

  const netPaidRevenuePaise = Math.max(0, paidRevenuePaise - refundsTotalPaise);
  const grossProfitPaise = netPaidRevenuePaise - cogsPaise - packagingCostPaise;
  const contributionProfitPaise = grossProfitPaise - actualShippingCostPaise - paymentFeesPaise;
  const estimatedNetProfitPaise = contributionProfitPaise - operatingExpensesPaise;

  const missingInputs = Array.from(missingInputsSet);

  return {
    totalOrdersCount,
    paidOrdersCount,
    grossSalesPaise,
    paidRevenuePaise,
    shippingFeesCollectedPaise,
    refundsTotalPaise,
    netPaidRevenuePaise,
    cogsPaise,
    packagingCostPaise,
    actualShippingCostPaise,
    paymentFeesPaise,
    operatingExpensesPaise,
    unsoldInventoryValuePaise,
    grossProfitPaise,
    contributionProfitPaise,
    estimatedNetProfitPaise,
    isEstimated: missingInputs.length > 0,
    missingInputs,
  };
}

// ============================================================================
// 9. SPREADSHEET CELL ESCAPING & WHATSAPP CLICK-TO-CHAT SANITIZATION
// ============================================================================

export function sanitizeSpreadsheetCell(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const str = String(value ?? '');
  // Prevent CSV/Excel formula injection (=, +, -, @, tab, CR)
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function buildSafeWhatsAppUrl(
  storePhone: string,
  type: 'enquiry' | 'confirmation' | 'tracking' | 'support',
  context: { orderId?: string; productName?: string }
): string {
  const cleanPhone = String(storePhone || '919000000000').replace(/\D/g, '');
  const safeOrderId = (context.orderId || '').replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 24);
  const safeProduct = (context.productName || '').replace(/[^\w\s\-₹&]/g, '').slice(0, 60);

  let message = 'Hello Pretty Charm team, I need assistance with my shopping experience.';
  if (type === 'enquiry' && safeProduct) {
    message = `Hello Pretty Charm! I would like to enquire about "${safeProduct}".`;
  } else if (type === 'confirmation' && safeOrderId) {
    message = `Hello Pretty Charm! I just placed Order ${safeOrderId} and would like to follow up on confirmation.`;
  } else if (type === 'tracking' && safeOrderId) {
    message = `Hello Pretty Charm! Could you please share the dispatch update for Order ${safeOrderId}?`;
  }

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

// ============================================================================
// 10. PRODUCT LISTING & CATEGORY PAGE SORTING
// ============================================================================

export type ProductSortOption = 'featured' | 'price-asc' | 'price-desc' | 'newest';

export const PRODUCT_SORT_OPTIONS: ReadonlyArray<{
  value: ProductSortOption;
  label: string;
}> = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest Arrivals' },
];

export interface SortableProduct {
  id: string;
  name: string;
  sellingPricePaise: number;
  status?: ProductStatus | string;
  featured?: boolean;
  createdAt?: string | null;
}

export function sortCatalogueProducts<T extends SortableProduct>(
  products: readonly T[],
  sortBy: ProductSortOption
): T[] {
  const copy = [...products];
  copy.sort((a, b) => {
    if (sortBy === 'price-asc') {
      const diff = a.sellingPricePaise - b.sellingPricePaise;
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    }

    if (sortBy === 'price-desc') {
      const diff = b.sellingPricePaise - a.sellingPricePaise;
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    }

    if (sortBy === 'newest') {
      const timeA = a.createdAt ? Date.parse(a.createdAt) : 0;
      const timeB = b.createdAt ? Date.parse(b.createdAt) : 0;
      const safeTimeA = Number.isFinite(timeA) ? timeA : 0;
      const safeTimeB = Number.isFinite(timeB) ? timeB : 0;
      if (safeTimeB !== safeTimeA) {
        return safeTimeB - safeTimeA;
      }
      return String(b.id).localeCompare(String(a.id));
    }

    // Default 'featured': active products first, then featured flag, then price ascending
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;

    const aFeatured = a.featured ? 1 : 0;
    const bFeatured = b.featured ? 1 : 0;
    if (aFeatured !== bFeatured) return bFeatured - aFeatured;

    return a.sellingPricePaise - b.sellingPricePaise;
  });
  return copy;
}

// ============================================================================
// 11. ORIGINAL PRODUCT PHOTO VERIFICATION, APPROVAL & INTEGRITY AUDIT
// ============================================================================

export type ProductImageAuditStatus =
  | 'Genuine Image Found'
  | 'Added Successfully'
  | 'Awaiting Admin Approval'
  | 'AI-Generated Image'
  | 'Image Needed'
  | 'Search Failed'
  | 'Original image found — awaiting approval'
  | 'Image successfully added'
  | 'Source or reuse permission unverified'
  | 'Search failed';

export const PRODUCT_IMAGE_AUDIT_STATUSES: ReadonlyArray<ProductImageAuditStatus> = [
  'Genuine Image Found',
  'Added Successfully',
  'Awaiting Admin Approval',
  'AI-Generated Image',
  'Image Needed',
  'Search Failed',
];

export function isProductEligibleForImageImport(product: {
  status: string;
  stockQty: number;
  reservedQty?: number;
}): boolean {
  const available = product.stockQty - (product.reservedQty || 0);
  return product.status === 'active' && available > 0;
}

export function buildGeminiProductImagePrompt(product: {
  name: string;
  categorySlug: string;
  description: string;
  sku: string;
  variants?: ReadonlyArray<{ name: string }>;
}): string {
  const variantText =
    product.variants && product.variants.length > 0
      ? ` Known variants/colours: ${product.variants.map((v) => v.name).join(', ')}.`
      : '';
  return `High-resolution e-commerce studio product illustration for Pretty Charm (${product.categorySlug}): "${product.name}" (SKU: ${product.sku}). Exact product details: ${product.description}.${variantText} Preserve known colours, materials, shape, and included components on a soft blush-cream studio surface. Do not invent unknown contents, text overlays, brand logos, or watermarks.`;
}

export interface CandidateImageValidationInput {
  urlOrDataUri: string;
  sourceUrl: string;
  mimeType?: string;
  byteLength?: number;
  isAiGenerated?: boolean;
  allowAiFallback?: boolean;
  hasReusePermission?: boolean;
  exactProductMatch?: boolean;
}

export function validateCandidateProductImage(
  input: CandidateImageValidationInput
): {
  valid: boolean;
  recommendedStatus: ProductImageAuditStatus;
  isAiGenerated: boolean;
  reason: string;
} {
  if (input.isAiGenerated && !input.allowAiFallback) {
    return {
      valid: false,
      recommendedStatus: 'Image Needed',
      isAiGenerated: true,
      reason:
        'Rejected: AI-generated images cannot be treated as genuine original product photographs.',
    };
  }

  if (input.exactProductMatch === false && !input.isAiGenerated) {
    return {
      valid: false,
      recommendedStatus: 'Image Needed',
      isAiGenerated: false,
      reason:
        'Rejected: Candidate image does not match the exact product, packaging, colour, and variant.',
    };
  }

  if (input.hasReusePermission === false) {
    return {
      valid: false,
      recommendedStatus: 'Source or reuse permission unverified',
      isAiGenerated: Boolean(input.isAiGenerated),
      reason:
        'Candidate image found on third-party domain, but commercial reuse permission or official brand authorization is unverified.',
    };
  }

  const rawUrl = String(input.urlOrDataUri || '').trim();
  const rawSource = String(input.sourceUrl || '').trim();
  if (!rawUrl || !rawSource) {
    return {
      valid: false,
      recommendedStatus: 'Image Needed',
      isAiGenerated: Boolean(input.isAiGenerated),
      reason: 'Both a valid image preview URL/file and an attribution source URL are required.',
    };
  }

  const isHttpsUrl = /^https:\/\/[^\s]+$/i.test(rawUrl);
  const isLocalUploadUrl = /^\/uploads\/products\/[a-zA-Z0-9._/-]+\.(jpg|jpeg|png|webp)$/i.test(
    rawUrl
  );
  const isRasterDataUri = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(rawUrl);
  if (!isHttpsUrl && !isLocalUploadUrl && !isRasterDataUri) {
    return {
      valid: false,
      recommendedStatus: 'Image Needed',
      isAiGenerated: Boolean(input.isAiGenerated),
      reason:
        'Image must be a validated HTTPS photograph URL, stored local product photograph, or a genuine JPEG/PNG/WebP photograph file.',
    };
  }

  if (input.mimeType) {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(input.mimeType.toLowerCase())) {
      return {
        valid: false,
        recommendedStatus: 'Image Needed',
        isAiGenerated: Boolean(input.isAiGenerated),
        reason: `Unsupported image MIME type "${input.mimeType}". Only real JPEG, PNG, or WebP photographs are accepted.`,
      };
    }
  }

  if (typeof input.byteLength === 'number') {
    if (input.byteLength < 128) {
      return {
        valid: false,
        recommendedStatus: 'Image Needed',
        isAiGenerated: Boolean(input.isAiGenerated),
        reason: 'Downloaded image file is empty or corrupted (< 128 bytes).',
      };
    }
    if (input.byteLength > 10 * 1024 * 1024) {
      return {
        valid: false,
        recommendedStatus: 'Image Needed',
        isAiGenerated: Boolean(input.isAiGenerated),
        reason: 'Image file exceeds the 10 MB safety limit.',
      };
    }
  }

  if (input.isAiGenerated && input.allowAiFallback) {
    return {
      valid: true,
      recommendedStatus: 'AI-Generated Image',
      isAiGenerated: true,
      reason:
        'Illustrative AI-generated image created from actual product attributes (not a physical photograph) — awaiting Admin review & approval.',
    };
  }

  return {
    valid: true,
    recommendedStatus: 'Awaiting Admin Approval',
    isAiGenerated: false,
    reason:
      'Genuine product photograph validated (format, resolution, and permitted source license) — awaiting Admin approval.',
  };
}

export function applyApprovedProductImageToGallery(
  existingImages: readonly string[],
  approvedImageUrl: string,
  options: { replaceExisting: boolean; setAsPrimary: boolean }
): string[] {
  const cleanApproved = String(approvedImageUrl || '').trim();
  if (!cleanApproved) {
    return [...existingImages];
  }

  if (options.replaceExisting) {
    return [cleanApproved];
  }

  const filteredExisting = existingImages.filter((img) => img !== cleanApproved);
  if (options.setAsPrimary || filteredExisting.length === 0) {
    return [cleanApproved, ...filteredExisting];
  }

  return [...filteredExisting, cleanApproved];
}

export interface CatalogueIntegritySnapshot {
  id: string;
  name: string;
  slug: string;
  categorySlug: string;
  sku: string;
  sellingPricePaise: number;
  stockQty: number;
  status: string;
  variantSkus: string[];
}

export function verifyCatalogueIntegrityUnchanged(
  before: ReadonlyArray<CatalogueIntegritySnapshot>,
  after: ReadonlyArray<CatalogueIntegritySnapshot>
): { unchanged: boolean; discrepancies: string[] } {
  const discrepancies: string[] = [];

  if (before.length !== after.length) {
    discrepancies.push(`Product count changed from ${before.length} to ${after.length}.`);
  }

  const beforeMap = new Map(before.map((p) => [p.id, p]));
  const afterMap = new Map(after.map((p) => [p.id, p]));

  for (const [id, b] of beforeMap.entries()) {
    const a = afterMap.get(id);
    if (!a) {
      discrepancies.push(`Existing product "${b.name}" (${id}) was removed.`);
      continue;
    }
    if (b.name !== a.name)
      discrepancies.push(`Product ${id} name changed from "${b.name}" to "${a.name}".`);
    if (b.slug !== a.slug) discrepancies.push(`Product ${id} slug changed.`);
    if (b.categorySlug !== a.categorySlug) discrepancies.push(`Product ${id} category changed.`);
    if (b.sku !== a.sku)
      discrepancies.push(`Product ${id} SKU changed from "${b.sku}" to "${a.sku}".`);
    if (b.sellingPricePaise !== a.sellingPricePaise) {
      discrepancies.push(
        `Product ${id} price changed from ${b.sellingPricePaise} to ${a.sellingPricePaise}.`
      );
    }
    if (b.stockQty !== a.stockQty) {
      discrepancies.push(`Product ${id} stock changed from ${b.stockQty} to ${a.stockQty}.`);
    }
    if (b.status !== a.status) {
      discrepancies.push(`Product ${id} status changed from "${b.status}" to "${a.status}".`);
    }
    if (b.variantSkus.join('|') !== a.variantSkus.join('|')) {
      discrepancies.push(`Product ${id} variants changed.`);
    }
  }

  for (const id of afterMap.keys()) {
    if (!beforeMap.has(id)) {
      discrepancies.push(`Unexpected new product ID "${id}" was added.`);
    }
  }

  return {
    unchanged: discrepancies.length === 0,
    discrepancies,
  };
}

// ============================================================================
// 12. PREMIUM HOMEPAGE CURATION, VERIFIED BENEFITS & SOCIAL LINK HELPERS
// ============================================================================

export interface HomepageProductCandidate {
  id: string;
  name: string;
  slug?: string;
  categorySlug?: string;
  status?: ProductStatus | string;
  sellingPricePaise: number;
  availableQty?: number;
  stockQty?: number;
  reservedQty?: number;
  featured?: boolean;
  images?: string[];
  variants?: Array<{ id: string; name: string; priceDeltaPaise?: number }>;
}

/**
 * Returns only active, in-stock products from the database for the Featured Products section.
 * Never returns draft, coming-soon, archived, or out-of-stock items as purchasable featured items.
 */
export function getHomepageFeaturedProducts<T extends HomepageProductCandidate>(
  products: readonly T[]
): T[] {
  return products
    .filter((p) => {
      if (p.status !== 'active') return false;
      const avail =
        typeof p.availableQty === 'number'
          ? p.availableQty
          : Math.max(0, Number(p.stockQty || 0) - Number(p.reservedQty || 0));
      return avail > 0;
    })
    .sort((a, b) => {
      const aFeat = a.featured ? 1 : 0;
      const bFeat = b.featured ? 1 : 0;
      if (aFeat !== bFeat) return bFeat - aFeat;
      return a.sellingPricePaise - b.sellingPricePaise;
    });
}

/**
 * Returns saved Gift Hampers from the database without inventing contents or hiding draft state.
 */
export function getHomepageGiftHampers<T extends HomepageProductCandidate>(
  products: readonly T[]
): T[] {
  return products.filter(
    (p) => p.categorySlug === 'gift-hampers' && p.status !== 'archived'
  );
}

export interface WhyShopBenefit {
  id: string;
  title: string;
  description: string;
}

/**
 * Builds verified "Why Shop With Us" benefits using Admin-configured settings and live shipping rules.
 * Never claims unverified free shipping on all orders, guaranteed delivery dates, or unverified certifications.
 */
export function getVerifiedWhyShopBenefits(
  generalSettings: Record<string, any> = {},
  shippingRules: ShippingRuleConfig = DEFAULT_SHIPPING_RULES
): ReadonlyArray<WhyShopBenefit> {
  const custom = generalSettings?.whyShopBenefits || {};
  const origin = generalSettings?.shippingOrigin || 'Gurugram, Haryana (PIN 122001)';

  return [
    {
      id: 'thoughtful-selection',
      title: custom.selectionTitle || 'Thoughtfully selected products',
      description:
        custom.selectionDescription ||
        'Satin and pearl hair accessories, anti-tarnish demifine jewellery, and keepsake gift boxes with clear item specifications.',
    },
    {
      id: 'secure-ordering',
      title: custom.orderingTitle || 'Secure ordering process',
      description:
        custom.orderingDescription ||
        'Transparent prices in Indian Rupees (INR), server-verified order totals, real-time stock reservation, and guest or account checkout.',
    },
    {
      id: 'shipping-info',
      title: custom.shippingTitle || 'Shipping information',
      description:
        custom.shippingDescription ||
        `Dispatched from ${origin}. Standard pan-India shipping is ${formatINR(
          shippingRules.tier1FeePaise
        )} below ${formatINR(shippingRules.tier1MaxSubtotalPaise)}, ${formatINR(
          shippingRules.tier2FeePaise
        )} up to ${formatINR(
          shippingRules.freeShippingThresholdPaise - 100
        )}, and Free on orders ${formatINR(shippingRules.freeShippingThresholdPaise)}+.`,
    },
    {
      id: 'customer-support',
      title: custom.supportTitle || 'Customer support',
      description:
        custom.supportDescription ||
        'Direct assistance via WhatsApp Click-to-Chat and email for product questions, order updates, and AWB shipment tracking.',
    },
  ];
}

export function buildInstagramProfileUrl(rawHandle?: string): {
  handle: string;
  cleanHandle: string;
  url: string;
} {
  const cleaned = String(rawHandle || 'prettycharm.in')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@+/, '')
    .replace(/\/+$/, '')
    .replace(/[^a-zA-Z0-9._]/g, '');
  const finalHandle = cleaned || 'prettycharm.in';
  return {
    handle: `@${finalHandle}`,
    cleanHandle: finalHandle,
    url: `https://www.instagram.com/${encodeURIComponent(finalHandle)}`,
  };
}

// ============================================================================
// 13. WHATSAPP-ASSISTED ORDER & PAYMENT WORKFLOW HELPERS
// ============================================================================

export interface WhatsAppOrderItemSummary {
  productName: string;
  variantName?: string | null;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise?: number;
}

export interface WhatsAppOrderPayload {
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  address: {
    houseFlat: string;
    street?: string;
    locality?: string;
    landmark?: string;
    streetLocality?: string;
    city: string;
    district?: string;
    state: string;
    pincode: string;
    deliveryInstructions?: string;
  };
  items: ReadonlyArray<WhatsAppOrderItemSummary>;
  subtotalPaise: number;
  comboDiscountPaise?: number;
  shippingFeePaise: number;
  totalPaise: number;
  giftPersonalization?: GiftPersonalizationInput | null;
  paymentStatus?: string;
  orderStatus?: string;
}

export function normalizeWhatsAppE164Phone(rawPhone: string, fallback = '919000000000'): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return fallback;
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

export function formatCompleteDeliveryAddress(address: {
  houseFlat?: string;
  street?: string;
  locality?: string;
  landmark?: string;
  streetLocality?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  deliveryInstructions?: string;
}): string {
  const streetPart = address.street?.trim() || address.streetLocality?.trim();
  const localityPart = address.locality?.trim();
  const landmarkPart = address.landmark?.trim() ? `Near ${address.landmark.trim()}` : '';

  const streetAndLocality = [streetPart, localityPart, landmarkPart]
    .filter(Boolean)
    .join(', ');

  const districtPart = address.district?.trim();
  const cityPart = address.city?.trim();
  const cityAndDistrict =
    districtPart && cityPart && !cityPart.toLowerCase().includes(districtPart.toLowerCase())
      ? `${cityPart}, ${districtPart}`
      : cityPart || districtPart || '';

  const stateAndPin = address.state?.trim() && address.pincode?.trim()
    ? `${address.state.trim()} - ${address.pincode.trim()}`
    : address.state?.trim() || address.pincode?.trim() || '';

  const parts = [
    address.houseFlat?.trim(),
    streetAndLocality,
    cityAndDistrict,
    stateAndPin,
  ].filter(Boolean);

  return parts.join(', ');
}

/**
 * Builds the personalized customer-to-business WhatsApp order message containing:
 * Order ID, product names, variants, quantities, item prices, subtotal, shipping, total amount,
 * customer name, phone number, complete delivery address, and optional delivery instructions.
 */
export function buildCustomerOrderWhatsAppMessage(order: WhatsAppOrderPayload): string {
  const itemLines = order.items.map((item, idx) => {
    const variantSuffix = item.variantName ? ` (${item.variantName})` : '';
    const lineTotal =
      typeof item.lineTotalPaise === 'number'
        ? item.lineTotalPaise
        : item.unitPricePaise * item.quantity;
    return `${idx + 1}. ${item.productName}${variantSuffix} — Qty: ${item.quantity} × ${formatINR(
      item.unitPricePaise
    )} = ${formatINR(lineTotal)}`;
  });

  const fullAddress = formatCompleteDeliveryAddress(order.address);
  const instructionsLine = order.address.deliveryInstructions?.trim()
    ? `\nDelivery Instructions: ${order.address.deliveryInstructions.trim()}`
    : '';

  const giftBlock =
    order.giftPersonalization && order.giftPersonalization.isGift
      ? formatGiftPersonalizationForWhatsApp(order.giftPersonalization)
      : '';

  const summaryLines: string[] = [`Subtotal: ${formatINR(order.subtotalPaise)}`];
  if (order.comboDiscountPaise && order.comboDiscountPaise > 0) {
    summaryLines.push(`Combo Discount: -${formatINR(order.comboDiscountPaise)}`);
  }
  summaryLines.push(
    `Shipping: ${order.shippingFeePaise === 0 ? 'Free' : formatINR(order.shippingFeePaise)}`
  );
  summaryLines.push(`Total Amount: ${formatINR(order.totalPaise)}`);

  const messageSections: string[] = [
    `Hello Pretty Charm! I would like to place my saved order:`,
    ``,
    `Order ID: ${order.orderNumber}`,
    `Items:`,
    ...itemLines,
    ``,
    ...summaryLines,
  ];

  if (giftBlock) {
    messageSections.push(``, giftBlock);
  }

  messageSections.push(
    ``,
    `Customer Details:`,
    `Name: ${order.customerName}`,
    `Phone: +91 ${normalizeIndianMobile(order.customerMobile)}`,
    `Delivery Address: ${fullAddress}${instructionsLine}`,
    ``,
    `Please share the payment link or QR details for Order ${order.orderNumber}.`,
    ``,
    `*(Please tap Send in WhatsApp to share your order with us)*`
  );

  return messageSections.join('\n');
}

export function buildCustomerOrderWhatsAppUrl(
  storePhone: string,
  order: WhatsAppOrderPayload
): string {
  const cleanStorePhone = normalizeWhatsAppE164Phone(storePhone, '919000000000');
  const message = buildCustomerOrderWhatsAppMessage(order);
  return `https://wa.me/${cleanStorePhone}?text=${encodeURIComponent(message)}`;
}

export function buildCustomerWhatsAppContactUrl(customerPhone: string): string {
  const cleanCustomerPhone = normalizeWhatsAppE164Phone(customerPhone, '');
  return `https://wa.me/${cleanCustomerPhone}`;
}

export function buildAdminPaymentInstructionWhatsAppMessage(
  order: WhatsAppOrderPayload,
  paymentConfig?: {
    upiId?: string;
    paymentLink?: string;
    qrImageUrl?: string;
    merchantName?: string;
  }
): string {
  const itemLines = order.items.map((item) => {
    const variantSuffix = item.variantName ? ` (${item.variantName})` : '';
    return `• ${item.productName}${variantSuffix} × ${item.quantity} (${formatINR(
      item.unitPricePaise * item.quantity
    )})`;
  });

  const paymentDetailsLines: string[] = [];
  if (paymentConfig?.paymentLink?.trim()) {
    paymentDetailsLines.push(`Payment Link: ${paymentConfig.paymentLink.trim()}`);
  }
  if (paymentConfig?.upiId?.trim()) {
    paymentDetailsLines.push(`Merchant UPI ID: ${paymentConfig.upiId.trim()}`);
  }
  if (paymentConfig?.qrImageUrl?.trim()) {
    paymentDetailsLines.push(`UPI QR Image: ${paymentConfig.qrImageUrl.trim()}`);
  }
  if (paymentDetailsLines.length === 0) {
    paymentDetailsLines.push(
      `We are sharing our official payment link / QR code below in this chat.`
    );
  }

  return [
    `Hello ${order.customerName}, thank you for shopping with Pretty Charm!`,
    ``,
    `We have received your saved Order ID: ${order.orderNumber}`,
    `Items:`,
    ...itemLines,
    `Total Payable: ${formatINR(order.totalPaise)}`,
    ``,
    `Payment Instructions:`,
    ...paymentDetailsLines,
    ``,
    `Once you complete the transfer, our team will verify the transaction in our bank/UPI statement and send your official order confirmation.`,
  ].join('\n');
}

export function buildAdminPaymentInstructionWhatsAppUrl(
  customerPhone: string,
  order: WhatsAppOrderPayload,
  paymentConfig?: {
    upiId?: string;
    paymentLink?: string;
    qrImageUrl?: string;
    merchantName?: string;
  }
): string {
  const cleanCustomerPhone = normalizeWhatsAppE164Phone(customerPhone, '');
  const message = buildAdminPaymentInstructionWhatsAppMessage(order, paymentConfig);
  return `https://wa.me/${cleanCustomerPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Admin authorization & payment verification gate before confirming an order.
 * Keeps payment status separate from order fulfilment status: an order can only
 * be confirmed after an authorized Admin has verified the payment ('paid' / 'Paid').
 */
export function canAdminConfirmOrder(params: {
  paymentStatus: string;
  orderStatus: string;
  adminUserId: string | null;
  adminRole: string | null;
}): { allowed: boolean; newOrderStatus?: OrderStatus; reason?: string } {
  if (
    !params.adminUserId ||
    !params.adminRole ||
    !['owner', 'admin', 'finance'].includes(params.adminRole)
  ) {
    return {
      allowed: false,
      reason: 'Unauthorized: Only an authenticated Admin can confirm orders.',
    };
  }

  const normPay = String(params.paymentStatus || '').toLowerCase();
  if (normPay !== 'paid') {
    return {
      allowed: false,
      reason:
        'Payment must be verified in the bank/UPI account and marked "paid" before confirming the order.',
    };
  }

  const normOrder = String(params.orderStatus || '').toLowerCase();
  if (normOrder === 'cancelled') {
    return {
      allowed: false,
      reason: 'Cancelled orders cannot be confirmed.',
    };
  }

  return {
    allowed: true,
    newOrderStatus: 'confirmed',
  };
}

export function buildAdminOrderConfirmationWhatsAppMessage(order: WhatsAppOrderPayload): string {
  const itemLines = order.items.map((item, idx) => {
    const variantSuffix = item.variantName ? ` (${item.variantName})` : '';
    const lineTotal =
      typeof item.lineTotalPaise === 'number'
        ? item.lineTotalPaise
        : item.unitPricePaise * item.quantity;
    return `${idx + 1}. ${item.productName}${variantSuffix} × ${item.quantity} — ${formatINR(
      lineTotal
    )}`;
  });

  const fullAddress = formatCompleteDeliveryAddress(order.address);

  return [
    `Hello ${order.customerName}! Your Pretty Charm order is now CONFIRMED.`,
    ``,
    `Order ID: ${order.orderNumber}`,
    `Confirmation Status: Confirmed (Payment Verified)`,
    `Order Items:`,
    ...itemLines,
    `Total Paid: ${formatINR(order.totalPaise)}`,
    `Delivery Address: ${fullAddress}`,
    ``,
    `We are preparing your order for dispatch from Gurugram and will share your courier AWB tracking details once shipped. Thank you for shopping with Pretty Charm!`,
  ].join('\n');
}

export function buildAdminOrderConfirmationWhatsAppUrl(
  customerPhone: string,
  order: WhatsAppOrderPayload
): string {
  const cleanCustomerPhone = normalizeWhatsAppE164Phone(customerPhone, '');
  const message = buildAdminOrderConfirmationWhatsAppMessage(order);
  return `https://wa.me/${cleanCustomerPhone}?text=${encodeURIComponent(message)}`;
}



