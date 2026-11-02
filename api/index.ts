import { FALLBACK_CATEGORIES, FALLBACK_PRODUCTS } from '../src/shared/fallbackData';
import {
  DEFAULT_SHIPPING_RULES,
  DEFAULT_DELIVERY_POLICY,
  DEFAULT_COMBO_OFFERS,
  lookupBuiltinIndianPostalInfo,
  validateIndianPinCodeFormat,
} from '../src/shared/domainLogic';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';

  // 1. Storefront Endpoint - Always returns full product catalogue reliably
  if (url.includes('/storefront')) {
    return res.status(200).json({
      categories: FALLBACK_CATEGORIES,
      products: FALLBACK_PRODUCTS,
      shippingRules: DEFAULT_SHIPPING_RULES,
      generalSettings: {
        storeName: 'Pretty Charm',
        tagline: 'Gift Hampers, Hair Accessories & Jewellery',
        shippingOrigin: 'Gurugram, Haryana',
        supportWhatsapp: '919000000000',
        supportEmail: 'support@prettycharm.in',
        instagramHandle: 'prettycharm.in',
        announcementBanner:
          'Thoughtfully chosen gifts & pretty essentials · Verified studio dispatch',
        paymentMode: 'whatsapp',
        manualPaymentUpiId: '',
        manualPaymentLink: '',
        manualPaymentQrUrl: '',
        manualPaymentInstructions: '',
      },
      policies: {},
      deliveryPolicy: DEFAULT_DELIVERY_POLICY,
      comboOffers: DEFAULT_COMBO_OFFERS,
      serviceablePincodes: [],
    });
  }

  // 2. PIN Code verification endpoint
  if (url.includes('/pincode/')) {
    const parts = url.split('/pincode/')[1]?.split('?')[0]?.replace('lookup/', '') || '';
    const clean = parts.trim();
    const postal = lookupBuiltinIndianPostalInfo(clean);
    return res.status(200).json(
      postal || {
        pincode: clean,
        isValid: validateIndianPinCodeFormat(clean),
        isServiceable: true,
        codAvailable: false,
        state: 'Haryana',
        district: 'Gurugram',
        city: 'Gurugram',
        postOffices: [],
        source: 'builtin_fallback',
        serviceabilityMessage: 'Standard dispatch available.',
      }
    );
  }

  // 3. Fallback try Express app if available
  try {
    const appModule = await import('../server');
    const app = appModule.default || appModule.app;
    if (app && typeof app === 'function') {
      return app(req, res);
    }
  } catch (err: any) {
    console.warn('[Vercel Serverless Fallback] Error in express handler:', err?.message || err);
  }

  // Default fallback response
  return res.status(200).json({ status: 'ok', message: 'Pretty Charm Serverless API' });
}
