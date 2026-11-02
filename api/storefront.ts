import { FALLBACK_CATEGORIES, FALLBACK_PRODUCTS } from '../src/shared/fallbackData';
import {
  DEFAULT_SHIPPING_RULES,
  DEFAULT_DELIVERY_POLICY,
  DEFAULT_COMBO_OFFERS,
} from '../src/shared/domainLogic';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
