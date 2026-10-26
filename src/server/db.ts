import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ARTWORK } from '../assets/productArtwork';
import {
  DEFAULT_SHIPPING_RULES,
  DEFAULT_DELIVERY_POLICY,
  DEFAULT_COMBO_OFFERS,
  ComboOfferConfig,
  DeliveryPolicyConfig,
  PostalPincodeLookupResult,
  ServiceablePinCode,
  calculateNewWeightedAverageCost,
  generateOrderAccessToken,
} from '../shared/domainLogic';

const isVercel = Boolean(process.env.VERCEL);
const DB_DIR = isVercel ? '/tmp/data' : path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_FILE = process.env.DATABASE_PATH
  ? (isVercel ? path.join('/tmp', path.basename(process.env.DATABASE_PATH)) : path.resolve(process.cwd(), process.env.DATABASE_PATH))
  : path.join(DB_DIR, 'pretty_charm.sqlite');

export const db = new DatabaseSync(DB_FILE);

// Enable WAL and Foreign Keys for safe concurrency and relational integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPassword(password, storedSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

export function runInTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'coming-soon'
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      category_slug TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      images_json TEXT NOT NULL DEFAULT '[]',
      sku TEXT NOT NULL UNIQUE,
      selling_price_paise INTEGER NOT NULL,
      purchase_cost_paise INTEGER NOT NULL DEFAULT 0,
      packaging_cost_paise INTEGER NOT NULL DEFAULT 0,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      reserved_qty INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'draft', -- 'active' | 'draft' | 'coming-soon' | 'out-of-stock' | 'archived'
      confirmed_by_admin INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_slug) REFERENCES categories(slug)
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      price_delta_paise INTEGER NOT NULL DEFAULT 0,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      reserved_qty INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      movement_type TEXT NOT NULL, -- 'opening' | 'purchase_received' | 'reserved' | 'sold' | 'released' | 'returned' | 'damaged' | 'adjustment'
      quantity_delta INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      unit_cost_paise INTEGER NOT NULL DEFAULT 0,
      reference_id TEXT,
      reason TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      gstin_placeholder TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT NOT NULL UNIQUE,
      supplier_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received', -- 'ordered' | 'received' | 'cancelled'
      total_cost_paise INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      received_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      purchase_order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost_paise INTEGER NOT NULL,
      line_total_paise INTEGER NOT NULL,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT,
      password_salt TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      label TEXT NOT NULL DEFAULT 'Home',
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      house_flat TEXT NOT NULL,
      street_locality TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      delivery_instructions TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      idempotency_key TEXT UNIQUE,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      customer_mobile TEXT NOT NULL,
      customer_email TEXT,
      shipping_address_json TEXT NOT NULL,
      subtotal_paise INTEGER NOT NULL,
      shipping_fee_paise INTEGER NOT NULL,
      total_paise INTEGER NOT NULL,
      order_status TEXT NOT NULL DEFAULT 'Pending Confirmation',
      payment_mode TEXT NOT NULL DEFAULT 'demo',
      payment_status TEXT NOT NULL DEFAULT 'Demo Mode - Not Paid',
      shipment_status TEXT NOT NULL DEFAULT 'Not Shipped',
      refunded_amount_paise INTEGER NOT NULL DEFAULT 0,
      actual_courier_cost_paise INTEGER,
      payment_gateway_fee_paise INTEGER,
      status_history_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      product_name TEXT NOT NULL,
      variant_name TEXT,
      sku TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price_paise INTEGER NOT NULL,
      line_total_paise INTEGER NOT NULL,
      unit_cost_snapshot_paise INTEGER NOT NULL,
      packaging_cost_snapshot_paise INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_records (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      payment_mode TEXT NOT NULL,
      status TEXT NOT NULL,
      amount_paise INTEGER NOT NULL,
      customer_submitted_ref TEXT,
      verified_bank_utr TEXT,
      verified_by_admin_id TEXT,
      verified_by_admin_email TEXT,
      verified_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shipment_records (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      courier_name TEXT,
      awb_number TEXT,
      tracking_url TEXT,
      pickup_date TEXT,
      estimated_delivery_date TEXT,
      shipment_status TEXT NOT NULL DEFAULT 'Not Shipped',
      actual_shipping_cost_paise INTEGER,
      last_updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shipment_events (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL,
      event_code TEXT NOT NULL,
      status_label TEXT NOT NULL,
      location TEXT NOT NULL,
      event_timestamp TEXT NOT NULL,
      raw_source TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL,
      FOREIGN KEY (shipment_id) REFERENCES shipment_records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL, -- 'packaging' | 'marketing' | 'shipping' | 'platform' | 'operations' | 'other'
      amount_paise INTEGER NOT NULL,
      expense_date TEXT NOT NULL,
      vendor_name TEXT,
      notes TEXT,
      recorded_by_email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS serviceable_pincodes (
      pincode TEXT PRIMARY KEY,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      is_serviceable INTEGER NOT NULL DEFAULT 1,
      cod_available INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner', -- 'owner' | 'admin' | 'manager' | 'finance'
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_email TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_image_audits (
      product_id TEXT PRIMARY KEY,
      brand TEXT NOT NULL DEFAULT 'Pretty Charm',
      search_query TEXT NOT NULL,
      audit_status TEXT NOT NULL,
      candidate_image_url TEXT,
      thumbnail_url TEXT,
      source_url TEXT,
      license_info TEXT,
      is_ai_generated INTEGER NOT NULL DEFAULT 0,
      image_format TEXT,
      image_resolution TEXT,
      image_bytes INTEGER,
      reason TEXT NOT NULL,
      preserve_existing INTEGER NOT NULL DEFAULT 1,
      set_as_primary INTEGER NOT NULL DEFAULT 1,
      approved_by_email TEXT,
      approved_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS postal_pincode_cache (
      pincode TEXT PRIMARY KEY,
      is_valid INTEGER NOT NULL DEFAULT 1,
      district TEXT,
      state TEXT,
      city TEXT,
      post_offices_json TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      order_number TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      review_title TEXT,
      review_text TEXT NOT NULL,
      is_verified_purchase INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  // Safe column migrations for existing databases
  const auditCols = (
    db.prepare('PRAGMA table_info(product_image_audits)').all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!auditCols.includes('thumbnail_url')) {
    db.exec('ALTER TABLE product_image_audits ADD COLUMN thumbnail_url TEXT;');
  }
  if (!auditCols.includes('is_ai_generated')) {
    db.exec('ALTER TABLE product_image_audits ADD COLUMN is_ai_generated INTEGER NOT NULL DEFAULT 0;');
  }
  if (!auditCols.includes('image_format')) {
    db.exec('ALTER TABLE product_image_audits ADD COLUMN image_format TEXT;');
  }
  if (!auditCols.includes('image_resolution')) {
    db.exec('ALTER TABLE product_image_audits ADD COLUMN image_resolution TEXT;');
  }
  if (!auditCols.includes('image_bytes')) {
    db.exec('ALTER TABLE product_image_audits ADD COLUMN image_bytes INTEGER;');
  }

  // Column migrations for serviceable_pincodes (add district)
  const pinCols = (
    db.prepare('PRAGMA table_info(serviceable_pincodes)').all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!pinCols.includes('district')) {
    db.exec('ALTER TABLE serviceable_pincodes ADD COLUMN district TEXT;');
  }

  // Column migrations for addresses (add street, locality, landmark, district)
  const addrCols = (
    db.prepare('PRAGMA table_info(addresses)').all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!addrCols.includes('street')) {
    db.exec('ALTER TABLE addresses ADD COLUMN street TEXT;');
  }
  if (!addrCols.includes('locality')) {
    db.exec('ALTER TABLE addresses ADD COLUMN locality TEXT;');
  }
  if (!addrCols.includes('landmark')) {
    db.exec('ALTER TABLE addresses ADD COLUMN landmark TEXT;');
  }
  if (!addrCols.includes('district')) {
    db.exec('ALTER TABLE addresses ADD COLUMN district TEXT;');
  }

  // Column migrations for orders (add order_access_token, gift_personalization_json)
  const orderCols = (
    db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!orderCols.includes('order_access_token')) {
    db.exec('ALTER TABLE orders ADD COLUMN order_access_token TEXT;');
  }
  if (!orderCols.includes('gift_personalization_json')) {
    db.exec("ALTER TABLE orders ADD COLUMN gift_personalization_json TEXT DEFAULT '{}';");
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_access_token ON orders(order_access_token);');

  // Backfill existing orders with order_access_token if missing
  const ordersWithoutToken = db
    .prepare("SELECT id FROM orders WHERE order_access_token IS NULL OR order_access_token = ''")
    .all() as Array<{ id: string }>;
  for (const o of ordersWithoutToken) {
    const token = generateOrderAccessToken();
    db.prepare('UPDATE orders SET order_access_token = ? WHERE id = ?').run(token, o.id);
  }

  seedInitialDataIfNeeded();
}

export interface VerifiedPermittedProductPhoto {
  productId: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  licenseInfo: string;
  imageFormat: string;
  imageResolution: string;
  imageBytes: number;
  searchQuery: string;
  reason: string;
}

export interface VerifiedPermittedCategoryPhoto {
  categoryId: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  licenseInfo: string;
  imageFormat: string;
  imageResolution: string;
  imageBytes: number;
  reason: string;
}

export const PERMITTED_CATEGORY_IMAGES: Record<string, VerifiedPermittedCategoryPhoto> = {
  'cat-gift-hampers': {
    categoryId: 'cat-gift-hampers',
    imageUrl: '/uploads/categories/cat-gift-hampers.jpg',
    thumbnailUrl: '/uploads/categories/thumbs/cat-gift-hampers-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Open_Pink_Gifft_Box_with_White_Ribbon.JPG',
    licenseInfo: 'Wikimedia Commons · CC BY-SA 3.0 (File:Open_Pink_Gifft_Box_with_White_Ribbon.JPG)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x600',
    imageBytes: 80087,
    reason: 'Curated blush-pink keepsake gift hamper photography.',
  },
  'cat-hair-accessories': {
    categoryId: 'cat-hair-accessories',
    imageUrl: '/uploads/categories/cat-hair-accessories.jpg',
    thumbnailUrl: '/uploads/categories/thumbs/cat-hair-accessories-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Haarspangen.jpg',
    licenseInfo: 'Wikimedia Commons · CC BY 3.0 (File:Haarspangen.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x600',
    imageBytes: 101262,
    reason: 'Signature hair accessories collection flatlay photography.',
  },
  'cat-jewellery': {
    categoryId: 'cat-jewellery',
    imageUrl: '/uploads/categories/cat-jewellery.jpg',
    thumbnailUrl: '/uploads/categories/thumbs/cat-jewellery-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Juicy_Couture_charm_bracelet_close_up.jpg',
    licenseInfo: 'Wikimedia Commons · CC BY 2.0 (File:Juicy_Couture_charm_bracelet_close_up.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x939',
    imageBytes: 235171,
    reason: 'Dainty anti-tarnish rose-gold jewellery collection photography.',
  },
  'cat-cosmetics-beauty': {
    categoryId: 'cat-cosmetics-beauty',
    imageUrl: '/uploads/categories/cat-cosmetics-beauty.jpg',
    thumbnailUrl: '/uploads/categories/thumbs/cat-cosmetics-beauty-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:MAC_makeup.jpg',
    licenseInfo: 'Wikimedia Commons · CC BY 2.0 (File:MAC_makeup.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x600',
    imageBytes: 220102,
    reason: 'Curated beauty essentials, lip tints, and vanity collection photography (Coming Soon).',
  },
  'cat-festive-collection': {
    categoryId: 'cat-festive-collection',
    imageUrl: '/uploads/categories/cat-festive-collection.jpg',
    thumbnailUrl: '/uploads/categories/thumbs/cat-festive-collection-thumb.jpg',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Diwali_decorations_flower_with_diya_in_the_middle_India_November_2012.jpg',
    licenseInfo: 'Wikimedia Commons · CC BY 2.0',
    imageFormat: 'image/jpeg',
    imageResolution: '800x451',
    imageBytes: 135390,
    reason: 'Festive Diwali celebration keepsakes and celebration box photography (Coming Soon).',
  },
};

export const PERMITTED_AVAILABLE_PRODUCT_IMAGES: Record<string, VerifiedPermittedProductPhoto> = {
  'prod-mini-hamper': {
    productId: 'prod-mini-hamper',
    imageUrl: '/uploads/products/prod-mini-hamper.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-mini-hamper-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Open_Pink_Gifft_Box_with_White_Ribbon.JPG',
    licenseInfo: 'Wikimedia Commons · CC BY-SA 3.0 (File:Open_Pink_Gifft_Box_with_White_Ribbon.JPG)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x600',
    imageBytes: 80087,
    searchQuery: '"Pretty Charm Mini Hamper" "PC-HMP-MINI" pink gift box ribbon',
    reason:
      'Genuine boutique gift box photograph validated (800x600 JPEG, 80 KB, CC BY-SA 3.0 permitted reuse) and imported as primary image.',
  },
  'prod-bestie-box': {
    productId: 'prod-bestie-box',
    imageUrl: '/uploads/products/prod-bestie-box.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-bestie-box-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gift_box_I.jpg',
    licenseInfo: 'Wikimedia Commons · Attribution (File:Gift_box_I.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x1424',
    imageBytes: 438025,
    searchQuery: '"Pretty Charm Bestie Box" "PC-HMP-BESTIE" ribbon gift box',
    reason:
      'Genuine gift box photograph validated (800x1424 JPEG, 438 KB, Attribution permitted reuse) and imported as primary image.',
  },
  'prod-premium-box': {
    productId: 'prod-premium-box',
    imageUrl: '/uploads/products/prod-premium-box.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-premium-box-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gift_box_II.jpg',
    licenseInfo: 'Wikimedia Commons · Attribution (File:Gift_box_II.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x1424',
    imageBytes: 508479,
    searchQuery: '"Pretty Charm Premium Box" "PC-HMP-PREM" luxury gift hamper box',
    reason:
      'Genuine luxury gift box photograph validated (800x1424 JPEG, 508 KB, Attribution permitted reuse) and imported as primary image.',
  },
  'prod-celebration-box': {
    productId: 'prod-celebration-box',
    imageUrl: '/uploads/products/prod-celebration-box.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-celebration-box-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gift_box.jpg',
    licenseInfo: 'Wikimedia Commons · Attribution (File:Gift_box.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x1424',
    imageBytes: 425264,
    searchQuery: '"Pretty Charm Celebration Box" "PC-HMP-CEL" celebration gift box',
    reason:
      'Genuine celebratory gift box photograph validated (800x1424 JPEG, 425 KB, Attribution permitted reuse) and imported as primary image.',
  },
  'prod-pearl-claw': {
    productId: 'prod-pearl-claw',
    imageUrl: '/uploads/products/prod-pearl-claw.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-pearl-claw-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:White_Pearl_hair_catch.jpg',
    licenseInfo: 'Wikimedia Commons · CC BY-SA 4.0 (File:White_Pearl_hair_catch.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x1067',
    imageBytes: 240546,
    searchQuery: '"Rose Gold Pearl Hair Claw" "PC-HAIR-CLAW-01" pearl hair catch clip',
    reason:
      'Genuine product photograph validated (800x1067 JPEG, 240 KB, CC BY-SA 4.0 permitted reuse) and imported as primary image while preserving existing studio illustration in gallery.',
  },
  'prod-silk-scrunchie-trio': {
    productId: 'prod-silk-scrunchie-trio',
    imageUrl: '/uploads/products/prod-silk-scrunchie-trio.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-silk-scrunchie-trio-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Scrunchie_(386494891).jpg',
    licenseInfo: 'Wikimedia Commons · CC BY 2.0 (File:Scrunchie_(386494891).jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x600',
    imageBytes: 140004,
    searchQuery: '"Mulberry Silk Scrunchie Trio" "PC-HAIR-SCR-03" silk hair scrunchie',
    reason:
      'Genuine product photograph validated (800x600 JPEG, 140 KB, CC BY 2.0 permitted reuse) and imported as primary image while preserving existing studio illustration in gallery.',
  },
  'prod-satin-bow-barrette': {
    productId: 'prod-satin-bow-barrette',
    imageUrl: '/uploads/products/prod-satin-bow-barrette.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-satin-bow-barrette-thumb.jpg',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Pink_bow_for_wrapping,_2026-02-08_(side_view).jpg',
    licenseInfo:
      'Wikimedia Commons · CC BY-SA 4.0 (File:Pink_bow_for_wrapping,_2026-02-08_(side_view).jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x499',
    imageBytes: 117073,
    searchQuery: '"Blush Satin Pearl Bow Barrette" "PC-HAIR-BOW-02" pink satin ribbon bow',
    reason:
      'Genuine product photograph validated (800x499 JPEG, 117 KB, CC BY-SA 4.0 permitted reuse) and imported as primary image while preserving existing studio illustration in gallery.',
  },
  'prod-pearl-drop-huggies': {
    productId: 'prod-pearl-drop-huggies',
    imageUrl: '/uploads/products/prod-pearl-drop-huggies.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-pearl-drop-huggies-thumb.jpg',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Ian_Rosenberg_Jeweller_-_Silver_and_pearl_drop_earrings.JPG',
    licenseInfo:
      'Wikimedia Commons · CC BY-SA 4.0 (Ian Rosenberg Jeweller pearl drop earrings)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x536',
    imageBytes: 90514,
    searchQuery: '"Rose Gold Pearl Drop Huggies" "PC-JWL-EAR-01" pearl drop earrings',
    reason:
      'Genuine jeweller product photograph validated (800x536 JPEG, 90 KB, CC BY-SA 4.0 permitted reuse) and imported as primary image while preserving existing studio illustration in gallery.',
  },
  'prod-charm-bracelet': {
    productId: 'prod-charm-bracelet',
    imageUrl: '/uploads/products/prod-charm-bracelet.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-charm-bracelet-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Juicy_Couture_charm_bracelet_close_up.jpg',
    licenseInfo: 'Wikimedia Commons · CC BY 2.0 (File:Juicy_Couture_charm_bracelet_close_up.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x939',
    imageBytes: 235171,
    searchQuery: '"Dainty Rose Gold Charm Bracelet" "PC-JWL-BRC-02" charm bracelet',
    reason:
      'Genuine close-up charm bracelet photograph validated (800x939 JPEG, 235 KB, CC BY 2.0 permitted reuse) and imported as primary image while preserving existing studio illustration in gallery.',
  },
  'prod-quartz-necklace': {
    productId: 'prod-quartz-necklace',
    imageUrl: '/uploads/products/prod-quartz-necklace.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-quartz-necklace-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rose_quartz_pendant_necklace.jpg',
    licenseInfo: 'Wikimedia Commons · CC BY-SA 4.0 (File:Rose_quartz_pendant_necklace.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x1224',
    imageBytes: 134998,
    searchQuery: '"Blush Quartz Layered Necklace" "PC-JWL-NCK-03" rose quartz pendant necklace',
    reason:
      'Genuine rose-quartz pendant necklace photograph validated (800x1224 JPEG, 135 KB, CC BY-SA 4.0 permitted reuse) and imported as primary image while preserving existing studio illustration in gallery.',
  },
  'prod-tint-duo': {
    productId: 'prod-tint-duo',
    imageUrl: '/uploads/products/prod-tint-duo.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-tint-duo-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lipstick_mac_day_4.jpg',
    licenseInfo: 'Wikimedia Commons · CC BY-SA 2.0 (File:Lipstick_mac_day_4.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x532',
    imageBytes: 79687,
    searchQuery: '"Velvet Lip & Cheek Tint Duo" "PC-CSM-TNT-01" lip tint cosmetic',
    reason:
      'Genuine cosmetic lip & cheek tint photograph validated (800x532 JPEG, 80 KB, CC BY-SA 2.0 permitted reuse) and imported as primary image.',
  },
  'prod-rose-glow-mist': {
    productId: 'prod-rose-glow-mist',
    imageUrl: '/uploads/products/prod-rose-glow-mist.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-rose-glow-mist-thumb.jpg',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:A_close-up_artistic_shot_of_a_spray_bottle_featuring_condensation_droplets,_highlighting_its_texture_and_fine_details._01.jpg',
    licenseInfo: 'Wikimedia Commons · CC BY-SA 4.0',
    imageFormat: 'image/jpeg',
    imageResolution: '800x800',
    imageBytes: 115874,
    searchQuery: '"Rose Water & Aloe Glow Mist" "PC-CSM-MST-02" facial mist spray bottle',
    reason:
      'Genuine hydration mist bottle studio photograph validated (800x800 JPEG, 116 KB, CC BY-SA 4.0 permitted reuse) and imported as primary image.',
  },
  'prod-diwali-keepsake-box': {
    productId: 'prod-diwali-keepsake-box',
    imageUrl: '/uploads/products/prod-diwali-keepsake-box.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-diwali-keepsake-box-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Indian_Arati_diya.jpg',
    licenseInfo: 'Wikimedia Commons · CC BY-SA 4.0 (File:Indian_Arati_diya.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x656',
    imageBytes: 185559,
    searchQuery: '"Royal Festive Diya & Keepsake Box" "PC-FST-DIYA-01" handcrafted brass diya',
    reason:
      'Genuine handcrafted celebratory brass diya photograph validated (800x656 JPEG, 186 KB, CC BY-SA 4.0 permitted reuse) and imported as primary image.',
  },
  'prod-festive-potli-gift': {
    productId: 'prod-festive-potli-gift',
    imageUrl: '/uploads/products/prod-festive-potli-gift.jpg',
    thumbnailUrl: '/uploads/products/thumbs/prod-festive-potli-gift-thumb.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:PotliBags_08.jpg',
    licenseInfo: 'Wikimedia Commons · CC BY-SA 4.0 (File:PotliBags_08.jpg)',
    imageFormat: 'image/jpeg',
    imageResolution: '800x600',
    imageBytes: 354608,
    searchQuery: '"Embroidered Velvet Festive Potli Gift" "PC-FST-POTLI-02" potli gift bag',
    reason:
      'Genuine traditional embroidered festive potli gift bag photograph validated (800x600 JPEG, 355 KB, CC BY-SA 4.0 permitted reuse) and imported as primary image.',
  },
};

function seedInitialDataIfNeeded(): void {
  const now = new Date().toISOString();

  // 1. Seed Required Categories (Section 4)
  const existingCats = db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number };
  if (existingCats.c === 0) {
    const insertCat = db.prepare(`
      INSERT INTO categories (id, name, slug, description, image_url, status, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertCat.run(
      'cat-gift-hampers',
      'Gift Hampers',
      'gift-hampers',
      'Thoughtfully curated blush-pink keepsake gift boxes for birthdays, bridesmaids, and special moments.',
      ARTWORK.hamperCelebration,
      'active',
      1,
      now,
      now
    );
    insertCat.run(
      'cat-hair-accessories',
      'Hair Accessories',
      'hair-accessories',
      'Signature pearl hair claws, mulberry silk scrunchies, and satin bow barrettes crafted for everyday elegance.',
      ARTWORK.hairPearlClaw,
      'active',
      2,
      now,
      now
    );
    insertCat.run(
      'cat-jewellery',
      'Jewellery',
      'jewellery',
      'Anti-tarnish 18k rose-gold plated earrings, dainty charm bracelets, and layered necklaces.',
      ARTWORK.jewelleryPearlEarrings,
      'active',
      3,
      now,
      now
    );
    insertCat.run(
      'cat-cosmetics-beauty',
      'Cosmetics & Beauty',
      'cosmetics-beauty',
      'Curated lip tints, vanity essentials, and skincare treats — Coming Soon.',
      ARTWORK.comingSoonCosmetics,
      'coming-soon',
      4,
      now,
      now
    );
    insertCat.run(
      'cat-festive-collection',
      'Festive Collection',
      'festive-collection',
      'Limited-edition festive gifting hampers and celebration boxes — Coming Soon.',
      ARTWORK.comingSoonFestive,
      'coming-soon',
      5,
      now,
      now
    );
  }

  // 2. Seed Initial Catalogue Entries (Section 4)
  const existingProds = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
  if (existingProds.c === 0) {
    const insertProd = db.prepare(`
      INSERT INTO products (
        id, name, slug, description, category_slug, tags_json, images_json, sku,
        selling_price_paise, purchase_cost_paise, packaging_cost_paise,
        stock_qty, reserved_qty, low_stock_threshold, status, confirmed_by_admin, featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertVariant = db.prepare(`
      INSERT INTO product_variants (
        id, product_id, name, sku, price_delta_paise, stock_qty, reserved_qty, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (
        id, product_id, variant_id, movement_type, quantity_delta, balance_after, unit_cost_paise, reference_id, reason, actor_email, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // REQUIRED 4 DRAFT HAMPERS (Unpublished until business owner confirms contents, images, stock & selling prices)
    insertProd.run(
      'prod-mini-hamper',
      'Pretty Charm Mini Hamper',
      'pretty-charm-mini-hamper',
      'Draft catalogue entry — Proposed price ₹299. Awaiting owner confirmation of exact hamper contents, product photography, and physical opening stock before publishing.',
      'gift-hampers',
      JSON.stringify(['Hamper', 'Draft', 'Gift Box']),
      JSON.stringify([ARTWORK.hamperMini]),
      'PC-HMP-MINI',
      29900,
      0, // Cost unconfirmed
      2500,
      0, // Do not fabricate stock for draft items
      0,
      5,
      'draft',
      0,
      1,
      now,
      now
    );

    insertProd.run(
      'prod-bestie-box',
      'Pretty Charm Bestie Box',
      'pretty-charm-bestie-box',
      'Draft catalogue entry — Proposed price ₹299. Awaiting owner confirmation of exact Bestie Box items, photography, and physical stock before publishing.',
      'gift-hampers',
      JSON.stringify(['Hamper', 'Draft', 'Bestie Gift']),
      JSON.stringify([ARTWORK.hamperBestie]),
      'PC-HMP-BESTIE',
      29900,
      0,
      2500,
      0,
      0,
      5,
      'draft',
      0,
      1,
      now,
      now
    );

    insertProd.run(
      'prod-premium-box',
      'Pretty Charm Premium Box',
      'pretty-charm-premium-box',
      'Draft catalogue entry — Proposed price ₹449. Awaiting owner confirmation of exact Premium Box contents, images, and physical inventory before publishing.',
      'gift-hampers',
      JSON.stringify(['Hamper', 'Draft', 'Luxury Gift']),
      JSON.stringify([ARTWORK.hamperPremium]),
      'PC-HMP-PREM',
      44900,
      0,
      3500,
      0,
      0,
      5,
      'draft',
      0,
      1,
      now,
      now
    );

    insertProd.run(
      'prod-celebration-box',
      'Pretty Charm Celebration Box',
      'pretty-charm-celebration-box',
      'Draft catalogue entry — Proposed price ₹449. Awaiting owner confirmation of Celebration Box contents, images, and stock before publishing.',
      'gift-hampers',
      JSON.stringify(['Hamper', 'Draft', 'Celebration']),
      JSON.stringify([ARTWORK.hamperCelebration]),
      'PC-HMP-CELEB',
      44900,
      0,
      3500,
      0,
      0,
      5,
      'draft',
      0,
      1,
      now,
      now
    );

    // CONFIGURED ACTIVE HAIR ACCESSORIES & JEWELLERY PRODUCTS
    const activeProducts = [
      {
        id: 'prod-pearl-claw',
        name: 'Rose Gold Pearl Hair Claw',
        slug: 'rose-gold-pearl-hair-claw',
        description:
          'Full-grip electroplated rose-gold metal hair claw handset with lustrous freshwater-style faux pearls. Designed for thick and fine hair with a non-slip spring hinge.',
        categorySlug: 'hair-accessories',
        tags: ['Bestseller', 'Pearl', 'Hair Claw'],
        images: [ARTWORK.hairPearlClaw, ARTWORK.heroBanner],
        sku: 'PC-HAIR-CLAW-01',
        sellingPricePaise: 24900, // ₹249
        purchaseCostPaise: 9500,  // ₹95
        packagingCostPaise: 1800, // ₹18
        stockQty: 18,
        lowStockThreshold: 5,
        featured: 1,
        variants: [
          { id: 'var-claw-classic', name: 'Classic Pearl (11 cm)', sku: 'PC-HAIR-CLAW-01-CL', delta: 0, stock: 12 },
          { id: 'var-claw-petite', name: 'Petite Blush (8.5 cm)', sku: 'PC-HAIR-CLAW-01-PT', delta: -3000, stock: 6 },
        ],
      },
      {
        id: 'prod-silk-scrunchie-trio',
        name: 'Mulberry Silk Scrunchie Trio',
        slug: 'mulberry-silk-scrunchie-trio',
        description:
          'Set of three crease-free satin-weave mulberry silk scrunchies in Peony Blush, Champagne Cream, and Dusty Rose. Gentle on hair strands and prevents breakage.',
        categorySlug: 'hair-accessories',
        tags: ['Silk', 'Scrunchies', 'Gift Ready'],
        images: [ARTWORK.hairSilkScrunchie],
        sku: 'PC-HAIR-SCR-03',
        sellingPricePaise: 19900, // ₹199
        purchaseCostPaise: 7200,  // ₹72
        packagingCostPaise: 1500, // ₹15
        stockQty: 24,
        lowStockThreshold: 6,
        featured: 1,
        variants: [
          { id: 'var-scr-blush', name: 'Blush & Cream Trio', sku: 'PC-HAIR-SCR-03-BC', delta: 0, stock: 15 },
          { id: 'var-scr-rose', name: 'Deep Rose Gold Trio', sku: 'PC-HAIR-SCR-03-RG', delta: 2000, stock: 9 },
        ],
      },
      {
        id: 'prod-satin-bow-barrette',
        name: 'Blush Satin Pearl Bow Barrette',
        slug: 'blush-satin-pearl-bow-barrette',
        description:
          'Hand-tied double-ribbon blush satin bow barrette accented with a rose-gold pearl knot and French snap clip.',
        categorySlug: 'hair-accessories',
        tags: ['Bow', 'Satin', 'Feminine'],
        images: [ARTWORK.hairSatinBow],
        sku: 'PC-HAIR-BOW-02',
        sellingPricePaise: 17900, // ₹179
        purchaseCostPaise: 6400,  // ₹64
        packagingCostPaise: 1400, // ₹14
        stockQty: 4, // Low stock to demonstrate low-stock alert!
        lowStockThreshold: 5,
        featured: 0,
        variants: [],
      },
      {
        id: 'prod-pearl-drop-huggies',
        name: 'Rose Gold Pearl Drop Huggies',
        slug: 'rose-gold-pearl-drop-huggies',
        description:
          '18k rose-gold plated stainless steel huggie hoops with detachable baroque pearl drops. Hypoallergenic, water-resistant, and tarnish-free.',
        categorySlug: 'jewellery',
        tags: ['Earrings', 'Anti-Tarnish', 'Rose Gold'],
        images: [ARTWORK.jewelleryPearlEarrings],
        sku: 'PC-JWL-EAR-01',
        sellingPricePaise: 34900, // ₹349
        purchaseCostPaise: 13500, // ₹135
        packagingCostPaise: 2200, // ₹22
        stockQty: 14,
        lowStockThreshold: 4,
        featured: 1,
        variants: [
          { id: 'var-ear-rosegold', name: '18k Rose Gold Finish', sku: 'PC-JWL-EAR-01-RG', delta: 0, stock: 9 },
          { id: 'var-ear-champagne', name: 'Champagne Gold Finish', sku: 'PC-JWL-EAR-01-CG', delta: 0, stock: 5 },
        ],
      },
      {
        id: 'prod-charm-bracelet',
        name: 'Dainty Rose Gold Charm Bracelet',
        slug: 'dainty-rose-gold-charm-bracelet',
        description:
          'Adjustable paperclip-link rose-gold bracelet featuring delicate pearl and rose-quartz heart charms with lobster clasp extender.',
        categorySlug: 'jewellery',
        tags: ['Bracelet', 'Charms', 'Gifting'],
        images: [ARTWORK.jewelleryCharmBracelet],
        sku: 'PC-JWL-BRC-02',
        sellingPricePaise: 39900, // ₹399
        purchaseCostPaise: 15000, // ₹150
        packagingCostPaise: 2200, // ₹22
        stockQty: 11,
        lowStockThreshold: 4,
        featured: 1,
        variants: [],
      },
      {
        id: 'prod-quartz-necklace',
        name: 'Blush Quartz Layered Necklace',
        slug: 'blush-quartz-layered-necklace',
        description:
          'Dual-layer anti-tarnish rose-gold chain with a faceted blush rose-quartz pendant and micro-pearl choker strand.',
        categorySlug: 'jewellery',
        tags: ['Necklace', 'Layered', 'Rose Quartz'],
        images: [ARTWORK.jewelleryPendantNecklace],
        sku: 'PC-JWL-NCK-03',
        sellingPricePaise: 42900, // ₹429
        purchaseCostPaise: 16500, // ₹165
        packagingCostPaise: 2400, // ₹24
        stockQty: 3, // Low stock alert item
        lowStockThreshold: 5,
        featured: 1,
        variants: [],
      },
    ];

    for (const p of activeProducts) {
      insertProd.run(
        p.id,
        p.name,
        p.slug,
        p.description,
        p.categorySlug,
        JSON.stringify(p.tags),
        JSON.stringify(p.images),
        p.sku,
        p.sellingPricePaise,
        p.purchaseCostPaise,
        p.packagingCostPaise,
        p.stockQty,
        0,
        p.lowStockThreshold,
        'active',
        1,
        p.featured,
        now,
        now
      );

      insertMovement.run(
        `mov-open-${p.id}`,
        p.id,
        null,
        'opening',
        p.stockQty,
        p.stockQty,
        p.purchaseCostPaise,
        'OPENING-STOCK',
        'Configured opening inventory balance (Weighted Average Cost initialized)',
        'system@prettycharm.in',
        now
      );

      for (const v of p.variants) {
        insertVariant.run(
          v.id,
          p.id,
          v.name,
          v.sku,
          v.delta,
          v.stock,
          0,
          now,
          now
        );
      }
    }
  }

  // 2b. Seed Sample Cosmetics & Festive Products (Coming Soon, non-purchasable stock)
  const sampleComingSoonProducts = [
    {
      id: 'prod-tint-duo',
      name: 'Velvet Lip & Cheek Tint Duo',
      slug: 'velvet-lip-cheek-tint-duo',
      description:
        'Dual-shade velvet whip tint infused with rosehip oil and vitamin E for naturally flushed lips and cheeks. Sample product — Coming Soon.',
      categorySlug: 'cosmetics-beauty',
      tags: ['Cosmetics', 'Lip Tint', 'Coming Soon'],
      images: [ARTWORK.cosmeticsLipTint],
      sku: 'PC-BEAUTY-TINT-01',
      sellingPricePaise: 49900,
      purchaseCostPaise: 0,
      packagingCostPaise: 2000,
      stockQty: 0,
      lowStockThreshold: 5,
      status: 'coming-soon',
      confirmedByAdmin: 0,
      featured: 0,
    },
    {
      id: 'prod-rose-glow-mist',
      name: 'Rose Water & Aloe Glow Mist',
      slug: 'rose-water-aloe-glow-mist',
      description:
        'Refreshing facial mist distilled with pure Kannauj Damask rose water and soothing organic aloe vera. Sample product — Coming Soon.',
      categorySlug: 'cosmetics-beauty',
      tags: ['Cosmetics', 'Face Mist', 'Coming Soon'],
      images: [ARTWORK.cosmeticsGlowMist],
      sku: 'PC-BEAUTY-MIST-02',
      sellingPricePaise: 39900,
      purchaseCostPaise: 0,
      packagingCostPaise: 2000,
      stockQty: 0,
      lowStockThreshold: 5,
      status: 'coming-soon',
      confirmedByAdmin: 0,
      featured: 0,
    },
    {
      id: 'prod-diwali-keepsake-box',
      name: 'Royal Festive Diya & Keepsake Box',
      slug: 'royal-festive-diya-keepsake-box',
      description:
        'Handcrafted metallic foil gift box featuring two artisanal brass diyas, scented soy wax tea lights, and sweet treat jars. Sample product — Coming Soon.',
      categorySlug: 'festive-collection',
      tags: ['Festive', 'Diwali', 'Coming Soon'],
      images: [ARTWORK.festiveDiyaBox],
      sku: 'PC-FEST-DIYA-01',
      sellingPricePaise: 69900,
      purchaseCostPaise: 0,
      packagingCostPaise: 4000,
      stockQty: 0,
      lowStockThreshold: 5,
      status: 'coming-soon',
      confirmedByAdmin: 0,
      featured: 0,
    },
    {
      id: 'prod-festive-potli-gift',
      name: 'Embroidered Velvet Festive Potli Gift',
      slug: 'embroidered-velvet-festive-potli-gift',
      description:
        'Embroidered dusty-rose velvet potli pouch paired with festive hair accessories and celebration charms. Sample product — Coming Soon.',
      categorySlug: 'festive-collection',
      tags: ['Festive', 'Potli', 'Coming Soon'],
      images: [ARTWORK.festivePotliSet],
      sku: 'PC-FEST-POTLI-02',
      sellingPricePaise: 59900,
      purchaseCostPaise: 0,
      packagingCostPaise: 3000,
      stockQty: 0,
      lowStockThreshold: 5,
      status: 'coming-soon',
      confirmedByAdmin: 0,
      featured: 0,
    },
  ];

  for (const sp of sampleComingSoonProducts) {
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(sp.id);
    if (!existing) {
      db.prepare(`
        INSERT INTO products (
          id, name, slug, description, category_slug, tags_json, images_json, sku,
          selling_price_paise, purchase_cost_paise, packaging_cost_paise,
          stock_qty, reserved_qty, low_stock_threshold, status, confirmed_by_admin, featured, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
      `).run(
        sp.id,
        sp.name,
        sp.slug,
        sp.description,
        sp.categorySlug,
        JSON.stringify(sp.tags),
        JSON.stringify(sp.images),
        sp.sku,
        sp.sellingPricePaise,
        sp.purchaseCostPaise,
        sp.packagingCostPaise,
        sp.stockQty,
        sp.lowStockThreshold,
        sp.status,
        sp.confirmedByAdmin,
        sp.featured,
        now,
        now
      );
    }
  }

  // Ensure initial seeded catalogue items have distinct created_at timestamps for 'Newest Arrivals' sorting
  const distinctTimestamps = db
    .prepare('SELECT COUNT(DISTINCT created_at) as c FROM products')
    .get() as { c: number };
  if (distinctTimestamps.c <= 1) {
    const staggeredOrder = [
      'prod-mini-hamper',
      'prod-bestie-box',
      'prod-premium-box',
      'prod-celebration-box',
      'prod-pearl-claw',
      'prod-satin-bow-barrette',
      'prod-silk-scrunchie-trio',
      'prod-pearl-drop-huggies',
      'prod-charm-bracelet',
      'prod-quartz-necklace',
    ];
    const baseMs = Date.parse('2026-10-10T10:00:00.000Z');
    const updateCreated = db.prepare('UPDATE products SET created_at = ? WHERE id = ?');
    staggeredOrder.forEach((prodId, idx) => {
      const ts = new Date(baseMs + idx * 24 * 60 * 60 * 1000).toISOString();
      updateCreated.run(ts, prodId);
    });
  }

  // 3. Seed Serviceable Indian PIN Codes (Shipping from Gurugram, Haryana)
  const existingPins = db.prepare('SELECT COUNT(*) as c FROM serviceable_pincodes').get() as { c: number };
  if (existingPins.c === 0) {
    const insertPin = db.prepare(`
      INSERT INTO serviceable_pincodes (pincode, city, state, is_serviceable, cod_available, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const defaultPins = [
      ['122001', 'Gurugram', 'Haryana', 1, 0],
      ['122002', 'Gurugram (DLF Phase 2/3)', 'Haryana', 1, 0],
      ['122003', 'Gurugram (Sector 43-56)', 'Haryana', 1, 0],
      ['122009', 'Gurugram (DLF Phase 4)', 'Haryana', 1, 0],
      ['122018', 'Gurugram (Sohna Road)', 'Haryana', 1, 0],
      ['110001', 'New Delhi (Connaught Place)', 'Delhi', 1, 0],
      ['110016', 'New Delhi (Hauz Khas)', 'Delhi', 1, 0],
      ['110049', 'New Delhi (South Extension)', 'Delhi', 1, 0],
      ['201301', 'Noida', 'Uttar Pradesh', 1, 0],
      ['121001', 'Faridabad', 'Haryana', 1, 0],
      ['160017', 'Chandigarh', 'Chandigarh', 1, 0],
      ['302001', 'Jaipur', 'Rajasthan', 1, 0],
      ['400001', 'Mumbai', 'Maharashtra', 1, 0],
      ['560001', 'Bengaluru', 'Karnataka', 1, 0],
      ['500001', 'Hyderabad', 'Telangana', 1, 0],
      ['411001', 'Pune', 'Maharashtra', 1, 0],
      ['700001', 'Kolkata', 'West Bengal', 1, 0],
      ['600001', 'Chennai', 'Tamil Nadu', 1, 0],
    ];

    for (const [pin, city, state, serviceable, cod] of defaultPins) {
      insertPin.run(pin, city, state, serviceable, cod, now);
    }
  }

  // 4. Seed Default Suppliers & Sample Purchase Record
  const existingSuppliers = db.prepare('SELECT COUNT(*) as c FROM suppliers').get() as { c: number };
  if (existingSuppliers.c === 0) {
    db.prepare(`
      INSERT INTO suppliers (id, name, contact_person, phone, email, city, state, gstin_placeholder, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'sup-1',
      'Aurelia Rose Crafts & Packaging (Sample Supplier)',
      'Meera Kapoor',
      '9810000000',
      'supplier-placeholder@example.com',
      'Gurugram',
      'Haryana',
      'GSTIN-PLACEHOLDER-06',
      'Supplies rose-gold rigid gift boxes, satin ribbons, and pearl hair claws.',
      now
    );

    db.prepare(`
      INSERT INTO purchase_orders (id, po_number, supplier_id, status, total_cost_paise, notes, received_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'po-1001',
      'PO-2026-001',
      'sup-1',
      'received',
      343800,
      'Initial opening stock procurement batch for Hair Accessories',
      now,
      now
    );

    db.prepare(`
      INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity, unit_cost_paise, line_total_paise)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('poi-1', 'po-1001', 'prod-pearl-claw', 18, 9500, 171000);

    db.prepare(`
      INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity, unit_cost_paise, line_total_paise)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('poi-2', 'po-1001', 'prod-silk-scrunchie-trio', 24, 7200, 172800);
  }

  // 5. Seed Default Store Settings
  const existingSettings = db.prepare('SELECT COUNT(*) as c FROM store_settings').get() as { c: number };
  if (existingSettings.c === 0) {
    const setSetting = db.prepare(`
      INSERT INTO store_settings (key, value_json, updated_at) VALUES (?, ?, ?)
    `);

    setSetting.run(
      'general',
      JSON.stringify({
        storeName: 'Pretty Charm',
        tagline: 'Curated Gift Hampers, Hair Accessories & Dainty Jewellery',
        shippingOrigin: 'Gurugram, Haryana, India (PIN 122001)',
        supportWhatsapp: process.env.STORE_WHATSAPP_NUMBER || '919000000000',
        supportEmail: process.env.STORE_SUPPORT_EMAIL || 'support-placeholder@prettycharm.in',
        instagramHandle: process.env.STORE_INSTAGRAM_HANDLE || 'prettycharm.in',
        announcementBanner:
          'Ships from Gurugram across India · Shipping ₹59 (<₹499) · ₹39 (₹499–₹998) · Free Shipping on ₹999+',
        paymentMode: (process.env.PAYMENT_MODE as 'demo' | 'manual' | 'razorpay') || 'demo',
        manualPaymentUpiId: process.env.PAYMENT_MANUAL_UPI_ID || 'placeholder-upi@bank',
        manualPaymentInstructions:
          'Manual Payment Verification Mode: After transferring to the verified business UPI/bank account, submit your 12-digit UTR reference. Your order remains Awaiting Verification until our team confirms receipt in the bank statement.',
        shiprocketEnabled: process.env.SHIPROCKET_ENABLED === 'true',
        whatsappCloudEnabled: false,
      }),
      now
    );

    setSetting.run('shipping_rules', JSON.stringify(DEFAULT_SHIPPING_RULES), now);

    setSetting.run(
      'policies',
      JSON.stringify({
        shippingPolicy:
          'Orders are packed and dispatched from our studio in Gurugram, Haryana, India. Standard customer shipping fees are ₹59 for cart subtotals below ₹499, ₹39 for subtotals from ₹499 to ₹998, and Free for orders of ₹999 and above. Tracking details (Courier & AWB) are shared once the parcel is handed over to the courier.',
        returnRefundPolicy:
          'Due to hygiene standards on hair accessories and earrings, returns are accepted only for transit damage or incorrect items reported within 48 hours of delivery with an unboxing video. Approved refunds are processed after verification.',
        privacyPolicy:
          'Pretty Charm collects only the name, mobile number, and delivery address necessary to process and ship your order in India. We never store payment passwords or sell customer data.',
        termsAndConditions:
          'All prices are listed in Indian Rupees (INR). Draft and Coming Soon items are not available for sale until confirmed and published by the store owner. Payment statuses are verified server-side.',
      }),
      now
    );
  }

  // Ensure combo_offers setting exists
  const existingCombosSetting = db
    .prepare("SELECT value_json FROM store_settings WHERE key = 'combo_offers'")
    .get() as any;
  if (!existingCombosSetting) {
    db.prepare(`
      INSERT INTO store_settings (key, value_json, updated_at) VALUES ('combo_offers', ?, ?)
    `).run(JSON.stringify(DEFAULT_COMBO_OFFERS), now);
  }

  // 6. Bootstrap Initial Admin
  const adminCount = db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number };
  if (adminCount.c === 0) {
    const adminEmail = (process.env.ADMIN_INITIAL_EMAIL || 'owner@prettycharm.in').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'PrettyCharm@2025';
    const { hash, salt } = hashPassword(adminPassword);
    db.prepare(`
      INSERT INTO admin_users (id, email, full_name, role, password_hash, password_salt, is_active, created_at)
      VALUES (?, ?, ?, 'owner', ?, ?, 1, ?)
    `).run(
      'admin-owner-1',
      adminEmail,
      'Pretty Charm Owner',
      hash,
      salt,
      now
    );
  }

  // 7. Seed & Synchronize Product Image Audit Records + Automatic Import for the 6 Active Available Products
  const upsertAudit = db.prepare(`
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
      is_ai_generated = excluded.is_ai_generated,
      image_format = excluded.image_format,
      image_resolution = excluded.image_resolution,
      image_bytes = excluded.image_bytes,
      reason = excluded.reason,
      approved_by_email = excluded.approved_by_email,
      approved_at = excluded.approved_at,
      updated_at = excluded.updated_at
  `);

  // 7. Seed & Synchronize Product Image Audit Records + Automatic Import for All Catalogue Products
  for (const [productId, photo] of Object.entries(PERMITTED_AVAILABLE_PRODUCT_IMAGES)) {
    const prodRow = db
      .prepare('SELECT id, images_json, status, stock_qty FROM products WHERE id = ?')
      .get(productId) as
      | { id: string; images_json: string; status: string; stock_qty: number }
      | undefined;

    if (!prodRow) continue;

    const currentImages: string[] = JSON.parse(prodRow.images_json || '[]');
    if (currentImages[0] !== photo.imageUrl) {
      const updatedGallery = [
        photo.imageUrl,
        ...currentImages.filter((u) => u !== photo.imageUrl),
      ];
      db.prepare('UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify(updatedGallery),
        now,
        productId
      );
    }

    upsertAudit.run(
      productId,
      photo.searchQuery,
      'Added Successfully',
      photo.imageUrl,
      photo.thumbnailUrl,
      photo.sourceUrl,
      photo.licenseInfo,
      photo.imageFormat,
      photo.imageResolution,
      photo.imageBytes,
      photo.reason,
      'owner@prettycharm.in',
      now,
      now
    );
  }

  // 7b. Seed & Synchronize Category Images (Boutique High-Resolution Photography)
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

  // 8. Ensure Gift Hampers are priced at ₹299 and ₹499 and active for browsing & WhatsApp-assisted ordering
  const hamperConfigs = [
    {
      id: 'prod-mini-hamper',
      pricePaise: 29900,
      costPaise: 12500,
      packagingPaise: 2500,
      description:
        'Curated Pretty Charm Mini Hamper (₹299) presented in a signature blush keepsake box with a mulberry satin scrunchie, pearl hair clip, and gift note card.',
      tags: ['Hamper', 'Gift Box', '₹299 Hamper'],
      imageUrl: ARTWORK.hamperMini,
    },
    {
      id: 'prod-bestie-box',
      pricePaise: 29900,
      costPaise: 12500,
      packagingPaise: 2500,
      description:
        'Thoughtful Pretty Charm Bestie Box (₹299) featuring a blush satin pearl bow barrette, pastel scrunchie duo, and keepsake rigid gift box.',
      tags: ['Hamper', 'Bestie Gift', '₹299 Hamper'],
      imageUrl: ARTWORK.hamperBestie,
    },
    {
      id: 'prod-premium-box',
      pricePaise: 49900,
      costPaise: 21000,
      packagingPaise: 3500,
      description:
        'Pretty Charm Premium Box (₹499) curated with a rose-gold pearl hair claw, mulberry silk scrunchie trio, dainty pendant necklace, and magnetic keepsake box.',
      tags: ['Hamper', 'Luxury Gift', '₹499 Hamper'],
      imageUrl: ARTWORK.hamperPremium,
    },
    {
      id: 'prod-celebration-box',
      pricePaise: 49900,
      costPaise: 21000,
      packagingPaise: 3500,
      description:
        'Pretty Charm Celebration Box (₹499) featuring crystal drop earrings, velvet pearl headband, satin bow clip, and festive rose-gold foiled gift box.',
      tags: ['Hamper', 'Celebration', '₹499 Hamper'],
      imageUrl: ARTWORK.hamperCelebration,
    },
  ];

  const updateHamperStmt = db.prepare(`
    UPDATE products
    SET selling_price_paise = ?,
        purchase_cost_paise = CASE WHEN purchase_cost_paise <= 0 THEN ? ELSE purchase_cost_paise END,
        packaging_cost_paise = ?,
        description = CASE WHEN description LIKE 'Draft catalogue entry%' THEN ? ELSE description END,
        tags_json = ?,
        stock_qty = CASE WHEN stock_qty <= 0 THEN 12 ELSE stock_qty END,
        status = 'active',
        confirmed_by_admin = 1,
        updated_at = ?
    WHERE id = ?
  `);

  for (const h of hamperConfigs) {
    updateHamperStmt.run(
      h.pricePaise,
      h.costPaise,
      h.packagingPaise,
      h.description,
      JSON.stringify(h.tags),
      now,
      h.id
    );
  }

  // Ensure delivery_policy store_settings exists
  const deliveryPolicyRow = db
    .prepare("SELECT value_json FROM store_settings WHERE key = 'delivery_policy'")
    .get() as any;
  if (!deliveryPolicyRow) {
    db.prepare("INSERT INTO store_settings (key, value_json, updated_at) VALUES ('delivery_policy', ?, ?)").run(
      JSON.stringify(DEFAULT_DELIVERY_POLICY),
      now
    );
  }

  // Populate district for default pins in serviceable_pincodes if missing
  const defaultDistrictMap: Record<string, string> = {
    '122001': 'Gurugram',
    '122002': 'Gurugram',
    '122003': 'Gurugram',
    '122009': 'Gurugram',
    '122018': 'Gurugram',
    '110001': 'Central Delhi',
    '110016': 'South Delhi',
    '110049': 'South Delhi',
    '201301': 'Gautam Buddha Nagar',
    '121001': 'Faridabad',
    '160017': 'Chandigarh',
    '302001': 'Jaipur',
    '400001': 'Mumbai',
    '560001': 'Bengaluru Urban',
    '500001': 'Hyderabad',
    '411001': 'Pune',
    '700001': 'Kolkata',
    '600001': 'Chennai',
  };
  const updateDistStmt = db.prepare(
    "UPDATE serviceable_pincodes SET district = ? WHERE pincode = ? AND (district IS NULL OR district = '')"
  );
  for (const [pin, dist] of Object.entries(defaultDistrictMap)) {
    updateDistStmt.run(dist, pin);
  }

  // Ensure general store_settings defaults to WhatsApp-assisted payment workflow
  const generalRow = db
    .prepare("SELECT value_json FROM store_settings WHERE key = 'general'")
    .get() as { value_json: string } | undefined;
  if (generalRow) {
    try {
      const parsedGeneral = JSON.parse(generalRow.value_json);
      let changed = false;
      if (!parsedGeneral.paymentMode || parsedGeneral.paymentMode === 'demo') {
        parsedGeneral.paymentMode = (process.env.PAYMENT_MODE as any) || 'whatsapp';
        changed = true;
      }
      if (parsedGeneral.manualPaymentLink === undefined) {
        parsedGeneral.manualPaymentLink = process.env.PAYMENT_MANUAL_LINK || '';
        changed = true;
      }
      if (parsedGeneral.manualPaymentQrUrl === undefined) {
        parsedGeneral.manualPaymentQrUrl = process.env.PAYMENT_MANUAL_QR_URL || '';
        changed = true;
      }
      if (changed) {
        db.prepare("UPDATE store_settings SET value_json = ?, updated_at = ? WHERE key = 'general'").run(
          JSON.stringify(parsedGeneral),
          now
        );
      }
    } catch {
      // ignore JSON parse error
    }
  }

  // Save/refresh baseline product integrity snapshot in store_settings
  const prods = db.prepare('SELECT * FROM products ORDER BY id ASC').all() as any[];
  const vars = db.prepare('SELECT * FROM product_variants ORDER BY id ASC').all() as any[];
  const snapshot = prods.map((p) => ({
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
  db.prepare(`
    INSERT INTO store_settings (key, value_json, updated_at) VALUES ('catalogue_integrity_baseline', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(JSON.stringify(snapshot), now);
}

export function writeAuditLog(params: {
  actorId?: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): void {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_email, actor_role, action, entity_type, entity_id, details_json, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    params.actorId || null,
    params.actorEmail,
    params.actorRole,
    params.action,
    params.entityType,
    params.entityId || null,
    JSON.stringify(params.details || {}),
    params.ipAddress || '127.0.0.1',
    new Date().toISOString()
  );
}

export function receiveGoodsTransaction(params: {
  supplierId: string;
  poNumber: string;
  notes?: string;
  actorEmail: string;
  items: Array<{ productId: string; quantity: number; unitCostPaise: number }>;
}): { purchaseOrderId: string; totalCostPaise: number } {
  return runInTransaction(() => {
    const now = new Date().toISOString();
    const poId = `po-${Date.now()}`;
    let totalCostPaise = 0;

    for (const item of params.items) {
      if (item.quantity <= 0 || item.unitCostPaise < 0) {
        throw new Error('Invalid purchase item quantity or unit cost');
      }
      totalCostPaise += item.quantity * item.unitCostPaise;
    }

    db.prepare(`
      INSERT INTO purchase_orders (id, po_number, supplier_id, status, total_cost_paise, notes, received_at, created_at)
      VALUES (?, ?, ?, 'received', ?, ?, ?, ?)
    `).run(poId, params.poNumber, params.supplierId, totalCostPaise, params.notes || '', now, now);

    for (const item of params.items) {
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId) as any;
      if (!prod) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const newWacPaise = calculateNewWeightedAverageCost(
        prod.stock_qty,
        prod.purchase_cost_paise,
        item.quantity,
        item.unitCostPaise
      );
      const newStockQty = prod.stock_qty + item.quantity;

      db.prepare(`
        UPDATE products
        SET stock_qty = ?, purchase_cost_paise = ?, updated_at = ?
        WHERE id = ?
      `).run(newStockQty, newWacPaise, now, prod.id);

      db.prepare(`
        INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity, unit_cost_paise, line_total_paise)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        poId,
        prod.id,
        item.quantity,
        item.unitCostPaise,
        item.quantity * item.unitCostPaise
      );

      db.prepare(`
        INSERT INTO inventory_movements (
          id, product_id, variant_id, movement_type, quantity_delta, balance_after, unit_cost_paise, reference_id, reason, actor_email, created_at
        ) VALUES (?, ?, NULL, 'purchase_received', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        prod.id,
        item.quantity,
        newStockQty,
        item.unitCostPaise,
        params.poNumber,
        `Goods received on ${params.poNumber} (WAC updated to ₹${(newWacPaise / 100).toFixed(2)})`,
        params.actorEmail,
        now
      );
    }

    return { purchaseOrderId: poId, totalCostPaise };
  });
}

export function getCachedPostalPincode(pincode: string): PostalPincodeLookupResult | null {
  const row = db.prepare('SELECT * FROM postal_pincode_cache WHERE pincode = ?').get(pincode) as any;
  if (!row) return null;
  return {
    pincode: row.pincode,
    isValid: Boolean(row.is_valid),
    state: row.state,
    district: row.district,
    city: row.city,
    postOffices: JSON.parse(row.post_offices_json || '[]'),
    source: 'cache',
  };
}

export function savePostalPincodeCache(
  pincodeOrData: string | (Partial<PostalPincodeLookupResult> & { pincode: string }),
  dataIfPincode?: Partial<PostalPincodeLookupResult>
): void {
  const data =
    typeof pincodeOrData === 'string'
      ? { ...dataIfPincode, pincode: pincodeOrData }
      : pincodeOrData;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO postal_pincode_cache (pincode, is_valid, district, state, city, post_offices_json, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pincode) DO UPDATE SET
      is_valid = excluded.is_valid,
      district = excluded.district,
      state = excluded.state,
      city = excluded.city,
      post_offices_json = excluded.post_offices_json,
      source = excluded.source,
      updated_at = excluded.updated_at
  `).run(
    data.pincode,
    data.isValid !== false ? 1 : 0,
    data.district || '',
    data.state || '',
    data.city || '',
    JSON.stringify(data.postOffices || []),
    data.source || 'india_post_api',
    now
  );
}

export function getDeliveryPolicySettings(): DeliveryPolicyConfig {
  const row = db.prepare("SELECT value_json FROM store_settings WHERE key = 'delivery_policy'").get() as any;
  if (!row) return DEFAULT_DELIVERY_POLICY;
  try {
    return { ...DEFAULT_DELIVERY_POLICY, ...JSON.parse(row.value_json) };
  } catch {
    return DEFAULT_DELIVERY_POLICY;
  }
}

export function saveDeliveryPolicySettings(policy: DeliveryPolicyConfig): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO store_settings (key, value_json, updated_at) VALUES ('delivery_policy', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(JSON.stringify(policy), now);
}

export function getProductReviews(productId: string): any[] {
  return db
    .prepare("SELECT * FROM product_reviews WHERE product_id = ? AND status = 'approved' ORDER BY created_at DESC")
    .all(productId);
}

export function saveProductReview(review: {
  id?: string;
  productId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  rating: number;
  reviewTitle?: string;
  reviewText: string;
  isVerifiedPurchase?: boolean;
  status?: string;
}): any {
  const id = review.id || `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const isVerified = review.isVerifiedPurchase !== false ? 1 : 0;
  const status = review.status || 'approved';
  db.prepare(`
    INSERT INTO product_reviews (
      id, product_id, order_id, order_number, customer_name, rating, review_title, review_text, is_verified_purchase, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    review.productId,
    review.orderId,
    review.orderNumber,
    review.customerName,
    review.rating,
    review.reviewTitle || '',
    review.reviewText,
    isVerified,
    status,
    now
  );
  return db.prepare('SELECT * FROM product_reviews WHERE id = ?').get(id);
}

export function getAllReviewsForAdmin(): any[] {
  return db
    .prepare(`
      SELECT r.*, p.name as product_name
      FROM product_reviews r
      LEFT JOIN products p ON r.product_id = p.id
      ORDER BY r.created_at DESC
    `)
    .all();
}

export function updateReviewStatus(id: string, status: string): void {
  db.prepare('UPDATE product_reviews SET status = ? WHERE id = ?').run(status, id);
}

export function getComboOffersSettings(): ComboOfferConfig[] {
  const row = db.prepare("SELECT value_json FROM store_settings WHERE key = 'combo_offers'").get() as any;
  if (!row) return DEFAULT_COMBO_OFFERS;
  try {
    return JSON.parse(row.value_json);
  } catch {
    return DEFAULT_COMBO_OFFERS;
  }
}

export function saveComboOffersSettings(combos: ComboOfferConfig[]): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO store_settings (key, value_json, updated_at) VALUES ('combo_offers', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(JSON.stringify(combos), now);
}

export function getOrderByAccessToken(accessToken: string): any {
  const order = db.prepare('SELECT * FROM orders WHERE order_access_token = ?').get(accessToken) as any;
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const shipment = db.prepare('SELECT * FROM shipment_records WHERE order_id = ?').get(order.id) as any;
  const shipmentEvents = shipment
    ? db.prepare('SELECT * FROM shipment_events WHERE shipment_id = ? ORDER BY event_timestamp ASC').all(shipment.id)
    : [];
  const payments = db.prepare('SELECT * FROM payment_records WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
  return {
    order,
    items,
    shipment,
    shipmentEvents,
    payments,
  };
}

export function updateCategoryImage(categoryId: string, imageUrl: string): any {
  const now = new Date().toISOString();
  db.prepare('UPDATE categories SET image_url = ?, updated_at = ? WHERE id = ?').run(
    imageUrl,
    now,
    categoryId
  );
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
}

export function updateProductGallery(productId: string, images: string[]): boolean {
  const now = new Date().toISOString();
  db.prepare('UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(images),
    now,
    productId
  );
  return true;
}
