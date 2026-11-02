// Google Analytics 4 (GA4) Consent-Aware & Privacy-Safe E-Commerce Tracking
// Measurement ID is Admin-Configurable in Store Settings

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

let initializedGaId: string | null = null;

export function initGA4(measurementId?: string) {
  if (!measurementId || !measurementId.startsWith('G-')) {
    return;
  }
  if (typeof window === 'undefined') return;
  if (initializedGaId === measurementId) return;

  initializedGaId = measurementId;

  // Append gtag script if not already present
  const existingScript = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`);
  if (!existingScript) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer?.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false, // We control page_view manually on client route changes
    anonymize_ip: true,
  });
}

function safeGtag(eventName: string, params: Record<string, any>) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    try {
      window.gtag('event', eventName, params);
    } catch (err) {
      console.warn('[GA4] Event dispatch warning:', err);
    }
  }
}

/**
 * Track Page Views on client-side route navigation
 */
export function trackPageView(pagePath: string, pageTitle: string) {
  safeGtag('page_view', {
    page_path: pagePath,
    page_title: pageTitle,
    page_location: typeof window !== 'undefined' ? window.location.href : '',
  });
}

/**
 * Track Product View
 */
export function trackViewItem(product: any) {
  if (!product) return;
  safeGtag('view_item', {
    currency: 'INR',
    value: (product.sellingPricePaise || 0) / 100,
    items: [
      {
        item_id: product.sku || product.id,
        item_name: product.name,
        item_category: product.categorySlug,
        price: (product.sellingPricePaise || 0) / 100,
        quantity: 1,
      },
    ],
  });
}

/**
 * Track Add to Cart
 */
export function trackAddToCart(product: any, quantity = 1, variantName?: string) {
  if (!product) return;
  safeGtag('add_to_cart', {
    currency: 'INR',
    value: ((product.sellingPricePaise || 0) / 100) * quantity,
    items: [
      {
        item_id: product.sku || product.id,
        item_name: product.name,
        item_category: product.categorySlug,
        item_variant: variantName,
        price: (product.sellingPricePaise || 0) / 100,
        quantity,
      },
    ],
  });
}

/**
 * Track Begin Checkout
 */
export function trackBeginCheckout(items: any[], subtotalPaise: number) {
  safeGtag('begin_checkout', {
    currency: 'INR',
    value: (subtotalPaise || 0) / 100,
    items: (items || []).map((item) => ({
      item_id: item.sku || item.productId,
      item_name: item.name,
      price: (item.pricePaise || 0) / 100,
      quantity: item.quantity || 1,
    })),
  });
}

/**
 * Track Verified Successful Purchase Only
 * NEVER record payment credentials, UPI PINs, or raw customer secrets.
 */
export function trackVerifiedPurchase(
  orderId: string,
  totalPaise: number,
  shippingPaise: number,
  items: any[]
) {
  if (!orderId) return;
  safeGtag('purchase', {
    transaction_id: orderId,
    currency: 'INR',
    value: (totalPaise || 0) / 100,
    shipping: (shippingPaise || 0) / 100,
    items: (items || []).map((item) => ({
      item_id: item.sku || item.productId,
      item_name: item.name,
      price: (item.pricePaise || 0) / 100,
      quantity: item.quantity || 1,
    })),
  });
}

/**
 * Track Search events
 */
export function trackSearch(searchTerm: string, resultsCount: number) {
  if (!searchTerm) return;
  safeGtag('search', {
    search_term: searchTerm,
    results_count: resultsCount,
  });
}

/**
 * Track WhatsApp Ordering click
 */
export function trackWhatsAppClick(source: string, productId?: string) {
  safeGtag('whatsapp_order_click', {
    source,
    product_id: productId || 'cart',
  });
}
