import { useEffect } from 'react';
import {
  DEFAULT_SEO_SETTINGS,
  SeoSettings,
  getBaseCanonicalUrl,
  buildCanonicalUrl,
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateProductSchema,
  generateCollectionPageSchema,
  generateBreadcrumbSchema,
} from './seoConfig';
import { initGA4, trackPageView } from './analytics';

export interface UseSeoOptions {
  screen: string;
  seoSettings?: Partial<SeoSettings>;
  product?: any;
  category?: any;
  categoryProducts?: any[];
  breadcrumbs?: Array<{ name: string; path: string }>;
  searchQuery?: string;
  isNotFound?: boolean;
}

function setOrCreateMeta(nameAttr: 'name' | 'property', attrValue: string, content: string) {
  if (typeof document === 'undefined') return;
  let element = document.querySelector(`meta[${nameAttr}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(nameAttr, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setOrCreateCanonical(href: string) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function injectStructuredData(schemaObj: any | any[]) {
  if (typeof document === 'undefined') return;
  const scriptId = 'pretty-charm-json-ld';
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schemaObj, null, 2);
}

export function useSeo({
  screen,
  seoSettings = {},
  product,
  category,
  categoryProducts = [],
  breadcrumbs = [],
  isNotFound = false,
}: UseSeoOptions) {
  const mergedSettings: SeoSettings = {
    ...DEFAULT_SEO_SETTINGS,
    ...seoSettings,
    categorySeo: {
      ...DEFAULT_SEO_SETTINGS.categorySeo,
      ...(seoSettings?.categorySeo || {}),
    },
    productSeo: {
      ...DEFAULT_SEO_SETTINGS.productSeo,
      ...(seoSettings?.productSeo || {}),
    },
  };

  const baseUrl = getBaseCanonicalUrl(mergedSettings.canonicalDomain);

  useEffect(() => {
    // 1. Initialize GA4 if ID is present
    if (mergedSettings.gaMeasurementId) {
      initGA4(mergedSettings.gaMeasurementId);
    }

    // 2. Google Search Console Verification Meta Tag
    if (mergedSettings.googleSiteVerification) {
      setOrCreateMeta('name', 'google-site-verification', mergedSettings.googleSiteVerification.trim());
    }

    // 3. Determine Page Specific Metadata
    let title = mergedSettings.metaTitle;
    let description = mergedSettings.metaDescription;
    let ogImage = mergedSettings.socialShareImage.startsWith('http')
      ? mergedSettings.socialShareImage
      : `${baseUrl}${mergedSettings.socialShareImage}`;
    let ogType = 'website';
    let robots = 'index, follow, max-image-preview:large';
    let canonicalUrl = buildCanonicalUrl(baseUrl, screen);

    const schemas: any[] = [];

    // Always include Organization & WebSite on standard pages
    schemas.push(generateOrganizationSchema(baseUrl));
    schemas.push(generateWebSiteSchema(baseUrl));

    if (screen === 'admin') {
      title = 'Admin Suite | Pretty Charm';
      description = 'Secure Pretty Charm administration dashboard.';
      robots = 'noindex, nofollow';
      canonicalUrl = `${baseUrl}/admin`;
    } else if (isNotFound || screen === 'not-found') {
      title = '404 - Page Not Found | Pretty Charm';
      description = 'Sorry, the requested page could not be found on Pretty Charm.';
      robots = 'noindex, follow';
      canonicalUrl = `${baseUrl}/404`;
    } else if (screen === 'product-details' && product) {
      const customP = mergedSettings.productSeo[product.slug] || {};
      title = customP.title || `${product.name} | Pretty Charm`;
      description =
        customP.description ||
        (product.description ? product.description.slice(0, 155) + '...' : mergedSettings.metaDescription);
      
      if (product.images?.[0]) {
        ogImage = product.images[0].startsWith('http')
          ? product.images[0]
          : `${baseUrl}${product.images[0]}`;
      }
      ogType = 'product';
      canonicalUrl = `${baseUrl}/product/${product.slug}`;

      // Only index published products with active status
      if (product.status === 'draft') {
        robots = 'noindex, nofollow';
      }

      // Add Product Schema
      const pSchema = generateProductSchema(baseUrl, product);
      if (pSchema) schemas.push(pSchema);

      // Add Breadcrumb Schema
      if (breadcrumbs.length > 0) {
        schemas.push(generateBreadcrumbSchema(baseUrl, breadcrumbs));
      }
    } else if (screen === 'shop' && category && category.slug !== 'all') {
      const customC = mergedSettings.categorySeo[category.slug] || {};
      title = customC.title || `${category.name} Online India | Pretty Charm`;
      description = customC.description || category.description || mergedSettings.metaDescription;
      
      if (category.imageUrl) {
        ogImage = category.imageUrl.startsWith('http')
          ? category.imageUrl
          : `${baseUrl}${category.imageUrl}`;
      }
      canonicalUrl = `${baseUrl}/category/${category.slug}`;

      // Add CollectionPage Schema
      schemas.push(generateCollectionPageSchema(baseUrl, category, categoryProducts));

      // Add Breadcrumb Schema
      if (breadcrumbs.length > 0) {
        schemas.push(generateBreadcrumbSchema(baseUrl, breadcrumbs));
      }
    } else if (screen === 'shop' || screen === 'categories') {
      title = 'Shop All Collections | Gift Hampers, Jewellery & Accessories | Pretty Charm';
      description =
        'Explore all handcrafted gift hampers, aesthetic hair accessories, and anti-tarnish jewellery collections at Pretty Charm.';
      canonicalUrl = `${baseUrl}/shop`;
    } else if (screen === 'about') {
      title = 'About Us | Pretty Charm Studio & Gifting Philosophy';
      description =
        'Learn about Pretty Charm, an artisanal gifting, jewellery, and hair accessories brand originating from Gurugram, Haryana, India.';
      canonicalUrl = `${baseUrl}/about`;
    } else if (screen === 'contact') {
      title = 'Contact Pretty Charm | Customer Support & Gurugram Studio';
      description =
        'Get in touch with Pretty Charm support for orders, custom hampers, and queries. Dispatched from Gurugram, Haryana.';
      canonicalUrl = `${baseUrl}/contact`;
    } else if (screen === 'faq') {
      title = 'Frequently Asked Questions (FAQ) | Pretty Charm';
      description =
        'Find answers regarding dispatch timelines, Indian courier tracking, packaging, gift hampers, and hygiene policies at Pretty Charm.';
      canonicalUrl = `${baseUrl}/faq`;
    } else if (screen === 'shipping-policy') {
      title = 'Shipping & Delivery Policy | Pretty Charm Pan-India';
      description =
        'Read our transparent Pan-India shipping rates, dispatch timelines from Gurugram (122001), and courier tracking details.';
      canonicalUrl = `${baseUrl}/shipping-policy`;
    } else if (screen === 'return-policy') {
      title = 'Returns & Refund Policy | Pretty Charm';
      description: 'Understanding hygiene standards on accessories and our transparent damaged-transit return policy at Pretty Charm.';
      canonicalUrl = `${baseUrl}/return-policy`;
    } else if (screen === 'privacy-policy') {
      title = 'Privacy Policy | Pretty Charm India';
      description = 'How Pretty Charm protects your personal information and respects customer privacy during checkout.';
      canonicalUrl = `${baseUrl}/privacy-policy`;
    } else if (screen === 'terms') {
      title = 'Terms & Conditions | Pretty Charm';
      description = 'Terms and conditions governing orders, payments, and product purchases at Pretty Charm.';
      canonicalUrl = `${baseUrl}/terms`;
    } else if (screen === 'track-order') {
      title = 'Track Your Order | Pretty Charm India';
      description = 'Track real-time verified courier status of your Pretty Charm gift hampers and accessories order.';
      robots = 'noindex, follow';
      canonicalUrl = `${baseUrl}/track-order`;
    } else if (screen === 'cart' || screen === 'checkout' || screen === 'account' || screen === 'wishlist') {
      title = `${screen.charAt(0).toUpperCase() + screen.slice(1)} | Pretty Charm`;
      robots = 'noindex, nofollow';
      canonicalUrl = `${baseUrl}/${screen}`;
    }

    // 4. Update Document Title
    document.title = title;

    // 5. Update Meta Tags
    setOrCreateMeta('name', 'description', description);
    setOrCreateMeta('name', 'robots', robots);

    // 6. Update Canonical URL
    setOrCreateCanonical(canonicalUrl);

    // 7. Update OpenGraph Tags
    setOrCreateMeta('property', 'og:title', title);
    setOrCreateMeta('property', 'og:description', description);
    setOrCreateMeta('property', 'og:url', canonicalUrl);
    setOrCreateMeta('property', 'og:image', ogImage);
    setOrCreateMeta('property', 'og:type', ogType);
    setOrCreateMeta('property', 'og:site_name', 'Pretty Charm');
    setOrCreateMeta('property', 'og:locale', 'en_IN');

    // 8. Update Twitter Card Tags
    setOrCreateMeta('name', 'twitter:card', 'summary_large_image');
    setOrCreateMeta('name', 'twitter:title', title);
    setOrCreateMeta('name', 'twitter:description', description);
    setOrCreateMeta('name', 'twitter:image', ogImage);

    // 9. Inject JSON-LD Schema
    injectStructuredData(schemas);

    // 10. Fire GA4 Page View
    const pagePath = typeof window !== 'undefined' ? window.location.pathname : '/';
    trackPageView(pagePath, title);
  }, [
    screen,
    product?.id,
    product?.updatedAt,
    category?.slug,
    isNotFound,
    mergedSettings.canonicalDomain,
    mergedSettings.metaTitle,
    mergedSettings.metaDescription,
    mergedSettings.gaMeasurementId,
    mergedSettings.googleSiteVerification,
  ]);
}
