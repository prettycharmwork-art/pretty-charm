// Comprehensive E-Commerce SEO Configuration and Structured Data Generators
// Brand: Pretty Charm
// Location: Gurugram, Haryana, India

export interface SeoSettings {
  metaTitle: string;
  metaDescription: string;
  canonicalDomain: string; // e.g. "https://prettycharm.store"
  googleSiteVerification: string;
  gaMeasurementId: string;
  socialShareImage: string;
  categorySeo: Record<string, { title?: string; description?: string; keywords?: string; h1?: string }>;
  productSeo: Record<string, { title?: string; description?: string; keywords?: string; altText?: string }>;
}

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  metaTitle: 'Pretty Charm | Gift Hampers, Jewellery & Hair Accessories Online India',
  metaDescription:
    'Discover beautiful gift hampers, stylish jewellery and hair accessories at Pretty Charm. Explore thoughtful gifts and pretty essentials online with fast dispatch from Gurugram.',
  canonicalDomain: '', // When empty, dynamically falls back to current window.location.origin
  googleSiteVerification: '',
  gaMeasurementId: '',
  socialShareImage: '/uploads/products/prod-mini-hamper.jpg',
  categorySeo: {
    'gift-hampers': {
      title: 'Gift Hampers Online India | Curated Gift Boxes | Pretty Charm',
      description:
        'Shop curated gift hampers online in India for birthdays, best friends, and celebrations. Aesthetic keepsake gift boxes dispatched with care from Gurugram.',
      keywords: 'Gift Hampers Online India, Birthday Gift Hampers, Gifts for Best Friends, Curated Gift Boxes, Pretty Charm Hampers',
      h1: 'Curated Gift Hampers Online India',
    },
    'hair-accessories': {
      title: 'Hair Accessories for Women & Girls Online India | Pretty Charm',
      description:
        'Explore mulberry silk scrunchies, pearl hair claws, and satin bow barrettes online. Chic hair styling essentials crafted for everyday elegance.',
      keywords: 'Hair Accessories for Women, Mulberry Silk Scrunchies, Pearl Hair Claws, Hair Bows, Pretty Charm Hair Accessories',
      h1: 'Hair Accessories & Styling Essentials',
    },
    'jewellery': {
      title: 'Dainty Jewellery Online India | Anti-Tarnish & Rose Gold | Pretty Charm',
      description:
        'Shop anti-tarnish dainty necklaces, rose gold plated huggies, and charm bracelets online in India. Everyday elegance with premium finish.',
      keywords: 'Jewellery Online India, Anti Tarnish Jewellery, Rose Gold Earrings, Charm Bracelets, Dainty Necklaces',
      h1: 'Dainty & Anti-Tarnish Jewellery',
    },
    'cosmetics-beauty': {
      title: 'Cosmetics & Beauty Essentials | Coming Soon | Pretty Charm',
      description:
        'Preview hydrating lip & cheek tints, soothing rose mists, and clean vanity essentials. Coming soon to Pretty Charm India.',
      keywords: 'Cosmetics Online India, Lip Tint, Rose Water Glow Mist, Clean Beauty Essentials',
      h1: 'Cosmetics & Beauty (Coming Soon)',
    },
    'festive-collection': {
      title: 'Festive Collection & Celebration Gift Boxes | Coming Soon | Pretty Charm',
      description:
        'Explore artisanal brass diya gift boxes, zardozi velvet potlis, and festive celebration hampers. Coming soon to Pretty Charm.',
      keywords: 'Festive Gift Hampers, Diwali Gift Hampers, Brass Diya Gift Box, Velvet Potli Gift',
      h1: 'Festive Collection & Celebration Gifting',
    },
  },
  productSeo: {},
};

export const BUSINESS_INFO = {
  name: 'Pretty Charm',
  legalName: 'Pretty Charm',
  url: 'https://prettycharm.store',
  logo: '/icon.svg',
  telephone: '+919000000000',
  email: 'support@prettycharm.in',
  city: 'Gurugram',
  region: 'Haryana',
  postalCode: '122001',
  country: 'IN',
  currency: 'INR',
  priceRange: '₹199 - ₹999',
  sameAs: [
    'https://instagram.com/prettycharm.in',
  ],
};

/**
 * Returns the effective base canonical URL.
 * If canonicalDomain is configured (e.g. "https://prettycharm.store"), uses that;
 * otherwise uses window.location.origin when in browser.
 */
export function getBaseCanonicalUrl(configuredDomain?: string): string {
  if (configuredDomain && configuredDomain.trim().length > 0) {
    return configuredDomain.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'https://prettycharm.store';
}

/**
 * Generates an Organization JSON-LD object adhering to Schema.org standards.
 */
export function generateOrganizationSchema(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': `${baseUrl}/#organization`,
    name: BUSINESS_INFO.name,
    legalName: BUSINESS_INFO.legalName,
    url: baseUrl,
    logo: `${baseUrl}${BUSINESS_INFO.logo}`,
    description: DEFAULT_SEO_SETTINGS.metaDescription,
    currenciesAccepted: 'INR',
    paymentAccepted: 'UPI, Online Bank Transfer, Cash on Delivery where serviceable',
    priceRange: BUSINESS_INFO.priceRange,
    address: {
      '@type': 'PostalAddress',
      addressLocality: BUSINESS_INFO.city,
      addressRegion: BUSINESS_INFO.region,
      postalCode: BUSINESS_INFO.postalCode,
      addressCountry: BUSINESS_INFO.country,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: BUSINESS_INFO.telephone,
      contactType: 'customer support',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi'],
    },
    sameAs: BUSINESS_INFO.sameAs,
  };
}

/**
 * Generates a WebSite JSON-LD object with Sitelinks SearchBox.
 */
export function generateWebSiteSchema(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    url: baseUrl,
    name: BUSINESS_INFO.name,
    description: DEFAULT_SEO_SETTINGS.metaDescription,
    publisher: {
      '@id': `${baseUrl}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/shop?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: 'en-IN',
  };
}

/**
 * Generates BreadcrumbList JSON-LD object.
 */
export function generateBreadcrumbSchema(
  baseUrl: string,
  items: Array<{ name: string; path: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.path.startsWith('/') ? item.path : '/' + item.path}`,
    })),
  };
}

/**
 * Generates Product & Offer JSON-LD object based on actual product data.
 * Never invents fake reviews, ratings, or prices.
 */
export function generateProductSchema(baseUrl: string, product: any) {
  if (!product) return null;

  const productUrl = `${baseUrl}/product/${product.slug}`;
  const primaryImg = product.images?.[0]
    ? product.images[0].startsWith('http')
      ? product.images[0]
      : `${baseUrl}${product.images[0]}`
    : `${baseUrl}/uploads/products/prod-mini-hamper.jpg`;

  const images = (product.images || []).map((img: string) =>
    img.startsWith('http') ? img : `${baseUrl}${img}`
  );

  const priceInr = (product.sellingPricePaise / 100).toFixed(2);
  const isAvailable = product.status === 'active' && product.availableQty > 0;
  const isComingSoon = product.status === 'coming_soon' || product.status === 'coming-soon';

  let itemAvailability = 'https://schema.org/InStock';
  if (isComingSoon) {
    itemAvailability = 'https://schema.org/PreOrder';
  } else if (!isAvailable) {
    itemAvailability = 'https://schema.org/OutOfStock';
  }

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: product.name,
    description: product.description,
    sku: product.sku || product.id,
    image: images.length > 0 ? images : [primaryImg],
    brand: {
      '@type': 'Brand',
      name: 'Pretty Charm',
    },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'INR',
      price: priceInr,
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      availability: itemAvailability,
      seller: {
        '@type': 'Organization',
        name: 'Pretty Charm',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '39.00',
          currency: 'INR',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'IN',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 2,
            unitCode: 'd',
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 3,
            maxValue: 6,
            unitCode: 'd',
          },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 2,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    },
  };

  return schema;
}

/**
 * Generates CollectionPage JSON-LD for Category listing.
 */
export function generateCollectionPageSchema(
  baseUrl: string,
  category: any,
  products: any[]
) {
  const categoryUrl = `${baseUrl}/category/${category.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${categoryUrl}#collection`,
    name: category.name,
    description: category.description,
    url: categoryUrl,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: (products || []).map((p, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `${baseUrl}/product/${p.slug}`,
        name: p.name,
      })),
    },
  };
}

/**
 * Build clean canonical URL for any route.
 */
export function buildCanonicalUrl(
  baseUrl: string,
  screen: string,
  slug?: string | null
): string {
  if (screen === 'home' || screen === 'splash') return `${baseUrl}/`;
  if (screen === 'product-details' && slug) return `${baseUrl}/product/${slug}`;
  if (screen === 'shop' && slug && slug !== 'all') return `${baseUrl}/category/${slug}`;
  if (screen === 'shop' || screen === 'categories') return `${baseUrl}/shop`;
  if (screen === 'about') return `${baseUrl}/about`;
  if (screen === 'contact') return `${baseUrl}/contact`;
  if (screen === 'faq') return `${baseUrl}/faq`;
  if (screen === 'shipping-policy') return `${baseUrl}/shipping-policy`;
  if (screen === 'return-policy') return `${baseUrl}/return-policy`;
  if (screen === 'privacy-policy') return `${baseUrl}/privacy-policy`;
  if (screen === 'terms') return `${baseUrl}/terms`;
  if (screen === 'track-order') return `${baseUrl}/track-order`;
  if (screen === 'cart') return `${baseUrl}/cart`;
  if (screen === 'wishlist') return `${baseUrl}/wishlist`;
  if (screen === 'checkout') return `${baseUrl}/checkout`;
  return `${baseUrl}/${screen}`;
}
