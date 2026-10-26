import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Heart,
  Search,
  User,
  Home,
  Grid,
  Truck,
  Sparkles,
  Box,
  ChevronRight,
  ArrowLeft,
  Plus,
  Minus,
  MapPin,
  Mail,
  CheckCircle2,
  MessageCircle,
  Menu,
  X,
  Navigation,
  Compass,
  AlertTriangle,
  Info,
  Loader2,
  ShieldCheck,
  RotateCcw,
  Gift,
  Star,
  Copy,
  Check,
  Tag
} from 'lucide-react';
import {
  formatINR,
  calculateCustomerShippingFeePaise,
  canCustomerPurchaseProduct,
  validateIndianPinCodeFormat,
  validateIndianMobile,
  getHonestEtaDisplay,
  buildSafeWhatsAppUrl,
  buildInstagramProfileUrl,
  buildCustomerOrderWhatsAppUrl,
  buildCustomerOrderWhatsAppMessage,
  formatCompleteDeliveryAddress,
  sortCatalogueProducts,
  PRODUCT_SORT_OPTIONS,
  ProductSortOption,
  DEFAULT_SHIPPING_RULES,
  ShippingRuleConfig,
  ALL_INDIAN_STATES_AND_UTS,
  detectPinCodeLocationMismatch,
  normalizeIndianStateName,
  DEFAULT_COMBO_OFFERS,
  ComboOfferConfig,
  evaluateCartComboOffers,
  calculateFreeShippingProgress,
  validateGiftPersonalization,
  GiftPersonalizationInput,
  GiftOccasion,
  maskCustomerMobile,
  maskCustomerAddress,
  maskCustomerEmail,
  canOrderReviewProduct,
} from './shared/domainLogic';
import { FALLBACK_CATEGORIES, FALLBACK_PRODUCTS } from './shared/fallbackData';
import { ARTWORK } from './assets/productArtwork';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallBanner';
import { ThreeHamperViewer } from './components/ThreeHamperViewer';
import { GeminiStudioModal } from './components/GeminiStudioModal';
import { AdminDashboard } from './components/AdminDashboard';
import { PremiumHomepage } from './components/PremiumHomepage';

const INDIAN_STATES_AND_UTS = ALL_INDIAN_STATES_AND_UTS;

const DEFAULT_FAQS = [
  {
    id: 'faq-1',
    question: 'Where does Pretty Charm ship from and what are the shipping charges?',
    answer:
      'All orders are packed and dispatched from our studio in Gurugram, Haryana (PIN 122001). Shipping across India is ₹59 for orders below ₹499, ₹39 for orders from ₹499 to ₹998, and FREE on orders ₹999 and above.'
  },
  {
    id: 'faq-2',
    question: 'Why are the 4 initial Gift Hampers marked as Draft Preview?',
    answer:
      'In accordance with Pretty Charm transparency rules, draft hampers (Mini Hamper, Bestie Box, Premium Box, Celebration Box) display their proposed prices and cannot be purchased until the store owner confirms their exact contents, photography, and physical stock in the Admin Panel.'
  },
  {
    id: 'faq-3',
    question: 'Do I need an account to place an order?',
    answer:
      'No! Guest checkout is always enabled. You can also optionally create an account to save multiple Indian delivery addresses and view your order history.'
  },
  {
    id: 'faq-4',
    question: 'How does order tracking work?',
    answer:
      'Visit Track My Order and enter your Order Number (e.g., PC-2026-1001) along with the 10-digit recipient mobile number used at checkout. We display only verified status updates and real courier AWB scans.'
  }
];

export type ScreenName =
  | 'splash'
  | 'auth'
  | 'home'
  | 'categories'
  | 'shop'
  | 'product-details'
  | 'wishlist'
  | 'cart'
  | 'checkout'
  | 'payment-status'
  | 'order-success'
  | 'track-order'
  | 'about'
  | 'contact'
  | 'faq'
  | 'account'
  | 'my-orders'
  | 'saved-addresses'
  | 'shipping-policy'
  | 'return-policy'
  | 'privacy-policy'
  | 'terms'
  | '3d-studio'
  | 'admin'
  | 'not-found';

interface CartItem {
  productId: string;
  variantId?: string | null;
  variantName?: string;
  quantity: number;
}

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const isAutostart = urlParams.get('autostart') === '1';
  const initialScreenParam = urlParams.get('screen') as ScreenName | null;

  const [screen, setScreen] = useState<ScreenName>(
    initialScreenParam || 'home'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(null);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<ProductSortOption>('featured');
  const [showInStockOnly, setShowInStockOnly] = useState<boolean>(false);

  // Storefront data (initialized with full catalogue, refreshed from /api/storefront)
  const [categories, setCategories] = useState<any[]>(FALLBACK_CATEGORIES);
  const [products, setProducts] = useState<any[]>(FALLBACK_PRODUCTS);
  const [shippingRules, setShippingRules] = useState<ShippingRuleConfig>(DEFAULT_SHIPPING_RULES);
  const [generalSettings, setGeneralSettings] = useState<Record<string, any>>({});
  const [policies, setPolicies] = useState<Record<string, string>>({});
  const [loadingCatalogue, setLoadingCatalogue] = useState<boolean>(false);

  // Local non-sensitive convenience state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('pretty_charm_cart_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pretty_charm_wishlist_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pretty_charm_recent_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Customer Auth & Account State
  const [customerToken, setCustomerToken] = useState<string>(() => sessionStorage.getItem('pc_customer_token') || '');
  const [customerUser, setCustomerUser] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ fullName: '', email: '', mobile: '', password: '' });
  const [authError, setAuthError] = useState('');

  // Product Detail state
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [pinCheckInput, setPinCheckInput] = useState('');
  const [pinCheckResult, setPinCheckResult] = useState<any>(null);

  // Checkout state
  const [checkoutForm, setCheckoutForm] = useState({
    fullName: '',
    mobile: '',
    houseFlat: '',
    street: '',
    locality: '',
    streetLocality: '',
    landmark: '',
    city: 'Gurugram',
    district: 'Gurgaon',
    state: 'Haryana',
    pincode: '122001',
    selectedPostOffice: '',
    deliveryInstructions: ''
  });
  const [checkoutError, setCheckoutError] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Indian PIN code validation & GPS Location state
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationNotice, setLocationNotice] = useState('');
  const [pincodeLookupState, setPincodeLookupState] = useState<'idle' | 'loading' | 'valid' | 'invalid' | 'unserviceable' | 'api_error'>('idle');
  const [postalLookupData, setPostalLookupData] = useState<any>(null);
  const [availablePostOffices, setAvailablePostOffices] = useState<string[]>([]);
  const [locationMismatch, setLocationMismatch] = useState<{
    hasMismatch: boolean;
    mismatchedField?: string;
    expectedState?: string;
    expectedDistrict?: string;
    actualValue?: string;
  } | null>(null);

  // Active Order / Payment / Tracking state (persisted so returning customers can access saved orders even if WhatsApp wasn't sent)
  const [savedOrders, setSavedOrders] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('pretty_charm_saved_orders_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [lastCreatedOrder, setLastCreatedOrder] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('pretty_charm_last_order_v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [utrReferenceInput, setUtrReferenceInput] = useState('');
  const [utrSubmittedMsg, setUtrSubmittedMsg] = useState('');
  const [utrErrorMsg, setUtrErrorMsg] = useState('');
  const [trackOrderForm, setTrackOrderForm] = useState({ orderNumber: '', mobile: '' });
  const [trackedOrderResult, setTrackedOrderResult] = useState<any>(null);
  const [trackOrderError, setTrackOrderError] = useState('');

  // Contact Inquiry state
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactSuccess, setContactSuccess] = useState('');

  // New Saved Address form
  const [newAddressForm, setNewAddressForm] = useState({
    label: 'Home',
    fullName: '',
    mobile: '',
    houseFlat: '',
    street: '',
    locality: '',
    streetLocality: '',
    landmark: '',
    city: 'Gurugram',
    district: 'Gurgaon',
    state: 'Haryana',
    pincode: '122001'
  });

  // Gemini AI Concierge Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Smart Cart Combo Offers & Gift Personalization
  const [comboOffers, setComboOffers] = useState<ComboOfferConfig[]>([]);
  const [giftPersonalization, setGiftPersonalization] = useState<GiftPersonalizationInput>({
    isGift: false,
    recipientName: '',
    occasion: 'Birthday',
    giftNote: '',
  });

  // Product Reviews State (Real verified buyers only)
  const [productReviews, setProductReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    reviewTitle: '',
    reviewText: '',
    orderNumber: '',
    token: '',
    mobile: '',
  });
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewMessage, setReviewMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedTrackingLink, setCopiedTrackingLink] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3200);
  };

  const fetchCatalogue = async () => {
    setLoadingCatalogue(true);
    try {
      const res = await fetch('/api/storefront');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load storefront');
      if (data.categories && data.categories.length > 0) setCategories(data.categories);
      if (data.products && data.products.length > 0) setProducts(data.products);
      if (data.comboOffers) setComboOffers(data.comboOffers);
      if (data.shippingRules) setShippingRules(data.shippingRules);
      setGeneralSettings(data.generalSettings || {});
      setPolicies(data.policies || {});
    } catch {
      // Offline or transient error handled gracefully
    } finally {
      setLoadingCatalogue(false);
    }
  };

  useEffect(() => {
    fetchCatalogue();
    const trackToken = urlParams.get('token') || urlParams.get('track');
    if (trackToken) {
      setScreen('track-order');
      fetch(`/api/orders/track/${encodeURIComponent(trackToken)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) {
            setTrackedOrderResult(data);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pretty_charm_cart_v2', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('pretty_charm_wishlist_v2', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('pretty_charm_recent_v2', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  useEffect(() => {
    localStorage.setItem('pretty_charm_saved_orders_v1', JSON.stringify(savedOrders));
  }, [savedOrders]);

  useEffect(() => {
    if (lastCreatedOrder) {
      localStorage.setItem('pretty_charm_last_order_v1', JSON.stringify(lastCreatedOrder));
    }
  }, [lastCreatedOrder]);

  useEffect(() => {
    if (!customerToken) {
      setCustomerUser(null);
      return;
    }
    fetch('/api/customer/me', {
      headers: { Authorization: `Bearer ${customerToken}` }
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setCustomerUser(data.customer);
        setCustomerOrders(data.orders || []);
        setCustomerAddresses(data.addresses || []);
        setCheckoutForm((prev) => ({
          ...prev,
          fullName: prev.fullName || data.customer.fullName || '',
          mobile: prev.mobile || data.customer.mobile || ''
        }));
      })
      .catch(() => {
        sessionStorage.removeItem('pc_customer_token');
        setCustomerToken('');
      });
  }, [customerToken]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.slug, c.name));
    return map;
  }, [categories]);

  const categoryStatusMap = useMemo(() => {
    const map = new Map<string, 'active' | 'coming-soon'>();
    categories.forEach((c) => map.set(c.slug, c.status));
    return map;
  }, [categories]);

  const navigateToProduct = (product: any) => {
    setSelectedProductSlug(product.slug);
    setActiveImageIdx(0);
    setSelectedVariantId(product.variants?.[0]?.id || null);
    setDetailQty(1);
    setPinCheckResult(null);
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((id) => id !== product.id);
      return [product.id, ...filtered].slice(0, 8);
    });
    setScreen('product-details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleWishlist = (productId: string) => {
    setWishlist((prev) => {
      if (prev.includes(productId)) {
        showToast('Removed from your Wishlist');
        return prev.filter((id) => id !== productId);
      } else {
        showToast('Saved to your Wishlist');
        return [...prev, productId];
      }
    });
  };

  const handleAddToCart = (product: any, qty = 1, variantId?: string | null) => {
    const chosenVariant = product.variants?.find((v: any) => v.id === variantId) || null;
    const catStatus = categoryStatusMap.get(product.categorySlug) || 'active';

    const check = canCustomerPurchaseProduct(
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        categorySlug: product.categorySlug,
        status: product.status,
        sellingPricePaise: product.sellingPricePaise,
        purchaseCostPaise: 0,
        packagingCostPaise: 0,
        stockQty: product.availableQty,
        reservedQty: 0,
        lowStockThreshold: product.lowStockThreshold
      },
      qty,
      catStatus,
      chosenVariant
        ? {
            id: chosenVariant.id,
            productId: product.id,
            name: chosenVariant.name,
            sku: chosenVariant.sku,
            priceDeltaPaise: chosenVariant.priceDeltaPaise,
            stockQty: chosenVariant.availableQty,
            reservedQty: 0
          }
        : null
    );

    if (!check.allowed) {
      showToast(check.reason || 'Cannot add this item right now.');
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.productId === product.id && (item.variantId || null) === (variantId || null)
      );
      if (existingIdx > -1) {
        const nextQty = prev[existingIdx].quantity + qty;
        if (nextQty > product.availableQty) {
          showToast(`Only ${product.availableQty} units available in stock.`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: nextQty };
        showToast(`Updated ${product.name} quantity in bag`);
        return updated;
      }
      showToast(`Added ${product.name} to your bag`);
      return [
        ...prev,
        {
          productId: product.id,
          variantId: variantId || null,
          variantName: chosenVariant ? chosenVariant.name : undefined,
          quantity: qty
        }
      ];
    });
  };

  const updateCartItemQty = (productId: string, variantId: string | null | undefined, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId && (item.variantId || null) === (variantId || null)) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            if (nextQty > product.availableQty) {
              showToast(`Maximum available stock is ${product.availableQty}`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const hydratedCart = useMemo(() => {
    return cart
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return null;
        const variant = product.variants?.find((v: any) => v.id === item.variantId);
        const unitPricePaise = product.sellingPricePaise + (variant?.priceDeltaPaise || 0);
        return {
          ...item,
          product,
          unitPricePaise,
          lineTotalPaise: unitPricePaise * item.quantity
        };
      })
      .filter(Boolean) as Array<{
      productId: string;
      variantId?: string | null;
      variantName?: string;
      quantity: number;
      product: any;
      unitPricePaise: number;
      lineTotalPaise: number;
    }>;
  }, [cart, products]);

  const cartSubtotalPaise = useMemo(
    () => hydratedCart.reduce((acc, item) => acc + item.lineTotalPaise, 0),
    [hydratedCart]
  );

  const cartComboEvaluation = useMemo(() => {
    const itemsForCombo = hydratedCart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      categorySlug: item.product.categorySlug,
      unitPricePaise: item.unitPricePaise,
    }));
    return evaluateCartComboOffers(
      itemsForCombo,
      comboOffers.length > 0 ? comboOffers : DEFAULT_COMBO_OFFERS
    );
  }, [hydratedCart, comboOffers]);

  const comboDiscountPaise = Math.min(
    cartSubtotalPaise,
    cartComboEvaluation.totalComboDiscountPaise
  );
  const discountedSubtotalPaise = Math.max(0, cartSubtotalPaise - comboDiscountPaise);

  const shippingPaise = useMemo(
    () =>
      hydratedCart.length > 0
        ? calculateCustomerShippingFeePaise(discountedSubtotalPaise, shippingRules)
        : 0,
    [hydratedCart.length, discountedSubtotalPaise, shippingRules]
  );
  const grandTotalPaise = discountedSubtotalPaise + shippingPaise;

  const freeShippingProgress = useMemo(
    () =>
      calculateFreeShippingProgress(
        discountedSubtotalPaise,
        shippingRules.freeShippingThresholdPaise
      ),
    [discountedSubtotalPaise, shippingRules.freeShippingThresholdPaise]
  );

  const filteredProducts = useMemo(() => {
    const matching = products.filter((p) => {
      if (p.status === 'archived') return false;
      if (selectedCategorySlug !== 'all' && p.categorySlug !== selectedCategorySlug) return false;
      if (showInStockOnly && (p.status !== 'active' || p.availableQty <= 0)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const catName = (categoryNameMap.get(p.categorySlug) || '').toLowerCase();
        if (!matchName && !matchDesc && !catName.includes(q)) return false;
      }
      return true;
    });
    return sortCatalogueProducts(matching, sortBy);
  }, [products, selectedCategorySlug, showInStockOnly, searchQuery, sortBy, categoryNameMap]);

  const currentProduct = useMemo(
    () => products.find((p) => p.slug === selectedProductSlug) || null,
    [products, selectedProductSlug]
  );

  const handleCheckPinServiceability = async () => {
    if (!validateIndianPinCodeFormat(pinCheckInput)) {
      setPinCheckResult({
        isServiceable: false,
        message: 'Please enter a valid 6-digit Indian PIN code (e.g. 122001).'
      });
      return;
    }
    const res = await fetch(`/api/pincode/${pinCheckInput.trim()}`);
    const data = await res.json();
    setPinCheckResult(data);
  };

  useEffect(() => {
    if (currentProduct) {
      setLoadingReviews(true);
      fetch(`/api/products/${currentProduct.id}/reviews`)
        .then((r) => r.json())
        .then((data) => setProductReviews(data.reviews || []))
        .catch(() => setProductReviews([]))
        .finally(() => setLoadingReviews(false));
    }
  }, [currentProduct?.id]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) return;
    setSubmittingReview(true);
    setReviewMessage(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: currentProduct.id,
          orderNumber: reviewForm.orderNumber.trim(),
          token: reviewForm.token.trim() || undefined,
          mobile: reviewForm.mobile.trim() || undefined,
          rating: reviewForm.rating,
          reviewTitle: reviewForm.reviewTitle.trim(),
          reviewText: reviewForm.reviewText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewMessage({ type: 'error', text: data.error || 'Failed to submit review' });
        return;
      }
      setReviewMessage({ type: 'success', text: 'Thank you! Your verified purchase review has been published.' });
      setReviewForm({ rating: 5, reviewTitle: '', reviewText: '', orderNumber: '', token: '', mobile: '' });
      const revRes = await fetch(`/api/products/${currentProduct.id}/reviews`);
      const revData = await revRes.json();
      setProductReviews(revData.reviews || []);
      setTimeout(() => {
        setShowReviewModal(false);
        setReviewMessage(null);
      }, 2500);
    } catch {
      setReviewMessage({ type: 'error', text: 'Network error submitting review.' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please enter your address details manually.');
      return;
    }

    setIsLocating(true);
    setLocationError('');
    setLocationNotice('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const res = await fetch('/api/location/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: lat, longitude: lon }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            setLocationError(data.error || 'Could not resolve your location details. Please enter manually.');
            return;
          }

          setCheckoutForm((prev) => ({
            ...prev,
            pincode: data.estimatedPincode || prev.pincode,
            state: data.estimatedState || prev.state,
            district: data.estimatedDistrict || prev.district,
            city: data.estimatedCity || prev.city,
            locality: data.estimatedLocality || prev.locality,
            street: data.estimatedStreet || prev.street,
            streetLocality: [data.estimatedStreet, data.estimatedLocality].filter(Boolean).join(', ') || prev.streetLocality,
            selectedPostOffice: data.postalInfo?.postOffices?.[0] || prev.selectedPostOffice,
          }));

          if (data.postalInfo) {
            setPostalLookupData(data.postalInfo);
            setAvailablePostOffices(data.postalInfo.postOffices || []);
            setPincodeLookupState(data.postalInfo.isServiceable ? 'valid' : 'unserviceable');
          }

          setLocationNotice(
            data.disclaimer ||
              'GPS and PIN code matching estimate your geographic area for courier routing, but do not prove residence at the entered address. Please verify your exact house/flat and street number.'
          );
          showToast('Location estimated! Please confirm your exact flat and street.');
        } catch (err: any) {
          setLocationError('Network error while looking up location. Please enter your address manually.');
        } finally {
          setIsLocating(false);
        }
      },
      (geoErr) => {
        setIsLocating(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setLocationError('Location access was denied. You can enter your address details manually below.');
        } else if (geoErr.code === geoErr.TIMEOUT) {
          setLocationError('Location request timed out. Please enter your address manually.');
        } else {
          setLocationError('Unable to determine location. Please enter your address manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
    );
  };

  const handleLookupPincode = async (rawPin: string) => {
    const clean = rawPin.trim();
    if (!validateIndianPinCodeFormat(clean)) {
      if (clean.length === 6) {
        setPincodeLookupState('invalid');
      } else {
        setPincodeLookupState('idle');
      }
      setPostalLookupData(null);
      setAvailablePostOffices([]);
      return;
    }

    setPincodeLookupState('loading');
    try {
      const res = await fetch(`/api/pincode/lookup/${clean}`);
      const data = await res.json();
      if (!res.ok || !data.isValid) {
        setPincodeLookupState(data.isValid === false ? 'invalid' : 'api_error');
        setPostalLookupData(data);
        return;
      }

      setPostalLookupData(data);
      setAvailablePostOffices(data.postOffices || []);
      setPincodeLookupState(data.isServiceable ? 'valid' : 'unserviceable');

      setCheckoutForm((prev) => ({
        ...prev,
        state: data.state || prev.state,
        district: data.district || prev.district,
        city: data.city || prev.city,
        selectedPostOffice: prev.selectedPostOffice && data.postOffices?.includes(prev.selectedPostOffice)
          ? prev.selectedPostOffice
          : data.postOffices?.[0] || '',
      }));
    } catch {
      setPincodeLookupState('api_error');
    }
  };

  const handleAutoCorrectLocation = () => {
    if (!locationMismatch) return;
    setCheckoutForm((prev) => ({
      ...prev,
      district: locationMismatch.expectedDistrict || prev.district,
      state: locationMismatch.expectedState || prev.state,
    }));
    setLocationMismatch(null);
    showToast(`Address updated to ${locationMismatch.expectedDistrict || ''}, ${locationMismatch.expectedState || ''}`);
  };

  useEffect(() => {
    if (validateIndianPinCodeFormat(checkoutForm.pincode)) {
      const mismatch = detectPinCodeLocationMismatch(
        checkoutForm.pincode,
        checkoutForm.district,
        checkoutForm.state,
        postalLookupData ? { state: postalLookupData.state, district: postalLookupData.district } : null
      );
      setLocationMismatch(mismatch.hasMismatch ? mismatch : null);
    } else {
      setLocationMismatch(null);
    }
  }, [checkoutForm.pincode, checkoutForm.district, checkoutForm.state, postalLookupData]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');
    if (!validateIndianMobile(checkoutForm.mobile)) {
      setCheckoutError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    if (!validateIndianPinCodeFormat(checkoutForm.pincode)) {
      setCheckoutError('Please enter a valid 6-digit Indian PIN code.');
      return;
    }
    if (hydratedCart.length === 0) {
      setCheckoutError('Your shopping bag is empty.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (customerToken) headers.Authorization = `Bearer ${customerToken}`;

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: hydratedCart.map((i) => ({
            productId: i.productId,
            variantId: i.variantId || undefined,
            quantity: i.quantity
          })),
          address: {
            fullName: checkoutForm.fullName,
            mobile: checkoutForm.mobile,
            houseFlat: checkoutForm.houseFlat,
            street: checkoutForm.street,
            locality: checkoutForm.locality,
            streetLocality: checkoutForm.streetLocality || `${checkoutForm.street}, ${checkoutForm.locality}`,
            landmark: checkoutForm.landmark,
            city: checkoutForm.city,
            district: checkoutForm.district || checkoutForm.city,
            state: checkoutForm.state,
            pincode: checkoutForm.pincode,
            selectedPostOffice: checkoutForm.selectedPostOffice,
            deliveryInstructions: checkoutForm.deliveryInstructions
          },
          customerNotes: checkoutForm.deliveryInstructions,
          giftPersonalization: giftPersonalization.isGift ? giftPersonalization : null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || 'Could not process checkout.');
        return;
      }
      setLastCreatedOrder(data);
      setSavedOrders((prev) => {
        const filtered = prev.filter((o) => o.orderNumber !== data.orderNumber);
        return [data, ...filtered].slice(0, 10);
      });
      setCart([]);
      await fetchCatalogue();
      setScreen('order-success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setCheckoutError(err.message || 'Network error while creating order.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleSubmitUtrReference = async (e: React.FormEvent) => {
    e.preventDefault();
    setUtrErrorMsg('');
    setUtrSubmittedMsg('');
    if (!lastCreatedOrder || !utrReferenceInput.trim()) return;
    const res = await fetch(`/api/orders/${lastCreatedOrder.orderNumber}/payment-reference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: lastCreatedOrder.shippingAddress?.mobile || checkoutForm.mobile,
        customerReferenceUtr: utrReferenceInput.trim()
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setUtrErrorMsg(data.error || 'Could not record UTR reference');
      return;
    }
    setUtrSubmittedMsg(data.message);
    setLastCreatedOrder((prev: any) => ({ ...prev, paymentStatus: data.paymentStatus }));
  };

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackOrderError('');
    setTrackedOrderResult(null);
    const payload: Record<string, string> = {};
    const anyForm = trackOrderForm as any;
    if (anyForm.token && anyForm.token.trim()) {
      payload.token = anyForm.token.trim();
    } else {
      payload.orderNumber = trackOrderForm.orderNumber.trim();
      payload.mobile = trackOrderForm.mobile.trim();
    }
    const res = await fetch('/api/orders/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setTrackOrderError(data.error || 'Unable to locate order with those details.');
      return;
    }
    setTrackedOrderResult(data);
  };

  const handleCustomerAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? '/api/customer/login' : '/api/customer/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authForm)
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || 'Authentication failed');
      return;
    }
    sessionStorage.setItem('pc_customer_token', data.token);
    setCustomerToken(data.token);
    setCustomerUser(data.customer);
    showToast(`Welcome to Pretty Charm, ${data.customer.fullName}!`);
    setScreen('account');
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerToken) return;
    const res = await fetch('/api/customer/addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify(newAddressForm)
    });
    if (res.ok) {
      const meRes = await fetch('/api/customer/me', {
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      const meData = await meRes.json();
      setCustomerAddresses(meData.addresses || []);
      showToast('Address saved to your account');
    } else {
      const errData = await res.json();
      showToast(errData.error || 'Failed to save address');
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSuccess(
      'Thank you! Our Gurugram studio team has noted your inquiry. You can also click "Chat on WhatsApp" for immediate assistance.'
    );
    setContactForm({ name: '', email: '', phone: '', message: '' });
  };

  // If Admin Panel screen is active, render full 15-section Admin Suite
  if (screen === 'admin') {
    return (
      <>
        <OfflineIndicator />
        <AdminDashboard
          onBackToStorefront={() => {
            fetchCatalogue();
            setScreen('home');
          }}
          onCatalogueUpdated={() => {
            fetchCatalogue();
          }}
        />
      </>
    );
  }

  // Screen 1: Splash Screen (from uploaded UI reference)
  if (screen === 'splash') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fdf2f4] via-[#fffdfb] to-[#f8e5e8] flex flex-col items-center justify-between p-6 text-center select-none">
        <OfflineIndicator />
        <div className="w-full flex justify-end max-w-md">
          <button
            onClick={() => setScreen('admin')}
            className="text-xs text-[#7c5c63] hover:text-[#9e5461] px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
          >
            Admin Suite
          </button>
        </div>

        <div className="my-auto max-w-md w-full space-y-6 py-8">
          <div className="w-28 h-28 mx-auto rounded-full bg-white shadow-md border border-[#f0d5da] flex items-center justify-center relative">
            <div className="w-24 h-24 rounded-full border border-[#e6b8c1] flex flex-col items-center justify-center bg-[#fdf2f4]/60">
              <Sparkles className="w-7 h-7 text-[#9e5461] mb-0.5" />
              <span className="font-serif text-xs tracking-[0.22em] uppercase text-[#9e5461] font-semibold">
                PC
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-[#9e5461] font-semibold">
              Gurugram · Haryana · India
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl text-[#2d1e21] font-semibold tracking-tight">
              Pretty Charm
            </h1>
            <p className="text-sm text-[#7c5c63] max-w-xs mx-auto leading-relaxed">
              Curated Keepsake Gift Hampers, Satin Hair Accessories &amp; Anti-Tarnish Demifine Jewellery.
            </p>
          </div>

          <div className="w-64 h-44 mx-auto rounded-2xl overflow-hidden border border-[#f0d5da] shadow-sm bg-white">
            <img
              src={ARTWORK.heroBanner}
              alt="Pretty Charm Keepsake Collection"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-3 pt-2 max-w-xs mx-auto">
            <button
              onClick={() => setScreen('home')}
              data-testid="enter-store-btn"
              className="w-full py-3.5 px-6 rounded-full bg-[#9e5461] hover:bg-[#86434f] text-white font-medium text-sm shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span>Enter Pretty Charm Store</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="flex items-center justify-center gap-4 text-xs text-[#7c5c63]">
              <button
                onClick={() => setScreen('auth')}
                className="hover:text-[#9e5461] underline underline-offset-4 whitespace-nowrap"
              >
                Sign In / Create Account
              </button>
              <span>·</span>
              <button
                onClick={() => setScreen('track-order')}
                className="hover:text-[#9e5461] underline underline-offset-4 whitespace-nowrap"
              >
                Track Order
              </button>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[#7c5c63]">
          Free Pan-India Shipping on orders ₹999+ · Guest Checkout Enabled
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffdfb] text-[#2d1e21] flex flex-col pb-20 md:pb-0">
      <OfflineIndicator />

      {/* A. Slim, Elegant Admin-Configurable Announcement Bar */}
      <div
        data-testid="announcement-bar"
        className="bg-[#f6e6ea] border-b border-[#ebd5dc] text-[#4a2c33] text-[11px] sm:text-xs py-2 px-4 text-center font-medium tracking-wide"
      >
        <span>
          {generalSettings.announcementBanner ||
            `Ships from Gurugram across India · Shipping ${formatINR(
              shippingRules.tier1FeePaise
            )} (<${formatINR(shippingRules.tier1MaxSubtotalPaise)}) · ${formatINR(
              shippingRules.tier2FeePaise
            )} (${formatINR(shippingRules.tier1MaxSubtotalPaise)}–${formatINR(
              shippingRules.freeShippingThresholdPaise - 100
            )}) · Free Shipping on ${formatINR(shippingRules.freeShippingThresholdPaise)}+`}
        </span>
      </div>

      {/* B. Redesigned Header with Logo, Search Field, Category Navigation & Accessible Controls */}
      <header className="sticky top-0 z-30 bg-[#fffdfb]/95 backdrop-blur-md border-b border-[#ebd7dc]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-1.5 sm:gap-5">
          {/* Left: Mobile Menu Button + Pretty Charm Logo */}
          <div className="flex items-center gap-1 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              data-testid="mobile-menu-toggle"
              className="lg:hidden p-1.5 sm:p-2 rounded-full hover:bg-[#faf2f4] text-[#5c3d42] transition-colors shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {screen !== 'home' && (
              <button
                type="button"
                onClick={() => setScreen('home')}
                aria-label="Back to Home"
                className="p-1.5 rounded-full hover:bg-[#fdf2f4] text-[#7c5c63] shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setScreen('home');
              }}
              className="text-left group focus:outline-none whitespace-nowrap cursor-pointer min-w-0"
            >
              <span className="font-serif text-lg sm:text-[26px] font-semibold text-[#2b1c20] tracking-tight block leading-none whitespace-nowrap">
                Pretty Charm
              </span>
              <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.16em] sm:tracking-[0.18em] text-[#9e5461] block mt-0.5 whitespace-nowrap">
                Gurugram Studio
              </span>
            </button>
          </div>

          {/* Center: Clean Navigation for Home, Gift Hampers, Hair Accessories, Jewellery, Coming Soon */}
          <nav
            aria-label="Main navigation"
            className="hidden lg:flex items-center gap-6 text-xs xl:text-sm font-medium text-[#5c3d42]"
          >
            <button
              type="button"
              onClick={() => setScreen('home')}
              className={`hover:text-[#9e5461] transition-colors whitespace-nowrap cursor-pointer ${
                screen === 'home' ? 'text-[#9e5461] font-semibold' : ''
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategorySlug('gift-hampers');
                setScreen('shop');
              }}
              className={`hover:text-[#9e5461] transition-colors whitespace-nowrap cursor-pointer ${
                screen === 'shop' && selectedCategorySlug === 'gift-hampers'
                  ? 'text-[#9e5461] font-semibold'
                  : ''
              }`}
            >
              Gift Hampers
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategorySlug('hair-accessories');
                setScreen('shop');
              }}
              className={`hover:text-[#9e5461] transition-colors whitespace-nowrap cursor-pointer ${
                screen === 'shop' && selectedCategorySlug === 'hair-accessories'
                  ? 'text-[#9e5461] font-semibold'
                  : ''
              }`}
            >
              Hair Accessories
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategorySlug('jewellery');
                setScreen('shop');
              }}
              className={`hover:text-[#9e5461] transition-colors whitespace-nowrap cursor-pointer ${
                screen === 'shop' && selectedCategorySlug === 'jewellery'
                  ? 'text-[#9e5461] font-semibold'
                  : ''
              }`}
            >
              Jewellery
            </button>
            <button
              type="button"
              onClick={() => setScreen('categories')}
              className={`hover:text-[#9e5461] transition-colors whitespace-nowrap cursor-pointer ${
                screen === 'categories' ? 'text-[#9e5461] font-semibold' : ''
              }`}
            >
              Coming Soon
            </button>
          </nav>

          {/* Right: Search Products Field + Account, Wishlist, Cart & Admin Controls */}
          <div className="flex items-center gap-0.5 sm:gap-2.5 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setScreen('shop');
              }}
              className="hidden md:flex items-center relative"
              role="search"
            >
              <Search className="w-3.5 h-3.5 text-[#7c5c63] absolute left-3 pointer-events-none" />
              <input
                type="search"
                data-testid="header-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
                className="w-40 xl:w-52 pl-8 pr-3 py-1.5 rounded-full bg-[#faf5f6] border border-[#e8d2d8] text-xs text-[#2b1c20] placeholder:text-[#8c6c73] focus:outline-none focus:border-[#9e5461]"
              />
            </form>

            <div className="hidden sm:block">
              <PWAInstallButton />
            </div>

            <button
              type="button"
              onClick={() => setScreen(customerUser ? 'account' : 'auth')}
              aria-label="Account"
              data-testid="header-account-btn"
              className="p-1.5 sm:p-2 rounded-full hover:bg-[#fdf2f4] text-[#5c3d42] transition-colors cursor-pointer"
            >
              <User className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setScreen('wishlist')}
              aria-label="Wishlist"
              data-testid="header-wishlist-btn"
              className="relative p-1.5 sm:p-2 rounded-full hover:bg-[#fdf2f4] text-[#5c3d42] transition-colors cursor-pointer"
            >
              <Heart className="w-5 h-5" />
              {wishlist.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#9e5461] text-white text-[10px] font-tabular flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setScreen('cart')}
              data-testid="header-cart-btn"
              aria-label="Shopping Bag"
              className="relative p-1.5 sm:p-2 rounded-full hover:bg-[#fdf2f4] text-[#5c3d42] transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5" />
              {hydratedCart.length > 0 && (
                <span
                  data-testid="cart-badge-count"
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#9e5461] text-white text-[10px] font-tabular flex items-center justify-center"
                >
                  {hydratedCart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setScreen('admin')}
              data-testid="open-admin-btn"
              className="px-2 sm:px-2.5 py-1 rounded-lg border border-[#ebd7dc] text-[10px] sm:text-[11px] font-medium text-[#7c5c63] hover:text-[#9e5461] hover:border-[#9e5461] whitespace-nowrap cursor-pointer"
            >
              Admin
            </button>
          </div>
        </div>

        {/* Mobile Search Bar (Always accessible on <768px without overflow) */}
        <div className="md:hidden px-3 pb-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setMobileMenuOpen(false);
              setScreen('shop');
            }}
            className="relative flex items-center"
            role="search"
          >
            <Search className="w-3.5 h-3.5 text-[#7c5c63] absolute left-3.5 pointer-events-none" />
            <input
              type="search"
              data-testid="mobile-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hair claws, jewellery, gift hampers..."
              aria-label="Search products on mobile"
              className="w-full pl-9 pr-16 py-2 rounded-full bg-[#faf5f6] border border-[#e8d2d8] text-xs text-[#2b1c20] placeholder:text-[#8c6c73] focus:outline-none focus:border-[#9e5461]"
            />
            <button
              type="submit"
              className="absolute right-1.5 px-3 py-1 rounded-full bg-[#9e5461] text-white text-[11px] font-medium"
            >
              Search
            </button>
          </form>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            data-testid="mobile-nav-drawer"
            className="lg:hidden border-t border-[#ebd7dc] bg-[#fffdfb] px-4 py-4 space-y-2 shadow-md"
          >
            {[
              {
                label: 'Home',
                action: () => setScreen('home'),
              },
              {
                label: 'Gift Hampers',
                action: () => {
                  setSelectedCategorySlug('gift-hampers');
                  setScreen('shop');
                },
              },
              {
                label: 'Hair Accessories',
                action: () => {
                  setSelectedCategorySlug('hair-accessories');
                  setScreen('shop');
                },
              },
              {
                label: 'Jewellery',
                action: () => {
                  setSelectedCategorySlug('jewellery');
                  setScreen('shop');
                },
              },
              {
                label: 'Cosmetics & Beauty — Coming Soon',
                action: () => setScreen('categories'),
              },
              {
                label: 'Festive Collection — Coming Soon',
                action: () => setScreen('categories'),
              },
              {
                label: 'Track My Order',
                action: () => setScreen('track-order'),
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.action();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 rounded-xl text-xs font-medium text-[#2b1c20] hover:bg-[#fdf2f4] flex items-center justify-between"
              >
                <span>{item.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#9e5461]" />
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-50 bg-[#2d1e21] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 border border-[#9e5461]/40">
          <CheckCircle2 className="w-4 h-4 text-[#f5b8c3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* SCREEN 3: REDESIGNED PREMIUM HOMEPAGE */}
        {screen === 'home' && (
          <PremiumHomepage
            categories={categories}
            products={products}
            wishlist={wishlist}
            recentlyViewed={recentlyViewed}
            generalSettings={generalSettings}
            shippingRules={shippingRules}
            categoryNameMap={categoryNameMap}
            onShopCategory={(slug) => {
              setSelectedCategorySlug(slug);
              setScreen('shop');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onViewAllCategories={() => {
              setScreen('categories');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectProduct={(product) => navigateToProduct(product)}
            onAddToCart={(product) =>
              handleAddToCart(product, 1, product.variants?.[0]?.id || null)
            }
            onToggleWishlist={(productId) => toggleWishlist(productId)}
          />
        )}

        {/* SCREEN 4: SHOP / CATEGORIES */}
        {screen === 'categories' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#f0d5da] pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9e5461] font-semibold">
                  Pretty Charm Collections
                </p>
                <h1 className="font-serif text-3xl sm:text-4xl text-[#2d1e21] font-semibold">
                  Browse Categories
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="categories-sort-select" className="text-xs font-medium text-[#5c3d42]">
                  Sort Products:
                </label>
                <select
                  id="categories-sort-select"
                  data-testid="product-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ProductSortOption)}
                  aria-label="Sort products"
                  className="px-3.5 py-2 rounded-full bg-white border border-[#f0d5da] text-xs font-medium text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                >
                  {PRODUCT_SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((cat) => {
                const catProducts = sortCatalogueProducts(
                  products.filter((p) => p.categorySlug === cat.slug && p.status !== 'archived'),
                  sortBy
                );
                return (
                  <div
                    key={cat.id}
                    className="rounded-3xl bg-white border border-[#f0d5da] overflow-hidden shadow-2xs flex flex-col sm:flex-row"
                  >
                    <div className="sm:w-48 h-48 sm:h-auto bg-[#fdf2f4] shrink-0">
                      <img
                        src={cat.imageUrl || ARTWORK.heroBanner}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-6 flex flex-col justify-between flex-1">
                      <div className="space-y-2">
                        <p className="text-xs text-[#9e5461] font-medium">
                          {cat.status === 'coming-soon'
                            ? 'Coming Soon · Preview Only'
                            : `${catProducts.length} Catalogue Items`}
                        </p>
                        <h2 className="font-serif text-2xl font-semibold text-[#2d1e21]">
                          {cat.name}
                        </h2>
                        <p className="text-xs text-[#5c3d42] leading-relaxed">
                          {cat.description}
                        </p>
                      </div>
                      <div className="pt-4">
                        <button
                          onClick={() => {
                            setSelectedCategorySlug(cat.slug);
                            setScreen('shop');
                          }}
                          className="px-4 py-2 rounded-full bg-[#fdf2f4] hover:bg-[#9e5461] text-[#9e5461] hover:text-white text-xs font-medium transition-colors whitespace-nowrap"
                        >
                          {cat.status === 'coming-soon' ? 'View Preview' : `Explore ${cat.name}`}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Category Product Listing Preview with Active Sorting */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-2xl font-semibold text-[#2d1e21]">
                  All Category Products ({filteredProducts.length})
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRODUCT_SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`sort-btn-${opt.value}`}
                      onClick={() => setSortBy(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                        sortBy === opt.value
                          ? 'bg-[#9e5461] text-white'
                          : 'bg-white border border-[#f0d5da] text-[#5c3d42] hover:border-[#9e5461]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    categoryName={categoryNameMap.get(product.categorySlug) || product.categorySlug}
                    isWishlisted={wishlist.includes(product.id)}
                    onToggleWishlist={() => toggleWishlist(product.id)}
                    onSelect={() => navigateToProduct(product)}
                    onAddToCart={() =>
                      handleAddToCart(product, 1, product.variants?.[0]?.id || null)
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 5: PRODUCT LISTING AND FILTERING (CATEGORY PAGE) */}
        {screen === 'shop' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#f0d5da] pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9e5461] font-semibold">
                  Pretty Charm Catalogue
                </p>
                <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
                  {selectedCategorySlug === 'all'
                    ? 'All Collections'
                    : categories.find((c) => c.slug === selectedCategorySlug)?.name || 'Shop'}
                </h1>
              </div>

              {/* Filter & Sort Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#7c5c63] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by keyword..."
                    className="pl-8 pr-3 py-1.5 rounded-full bg-white border border-[#f0d5da] text-xs focus:outline-none focus:border-[#9e5461]"
                  />
                </div>

                <label className="flex items-center gap-1.5 text-xs text-[#5c3d42] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showInStockOnly}
                    onChange={(e) => setShowInStockOnly(e.target.checked)}
                    className="rounded accent-[#9e5461]"
                  />
                  <span>Ready-to-Ship Only</span>
                </label>

                <select
                  data-testid="product-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ProductSortOption)}
                  aria-label="Sort products"
                  className="px-3.5 py-1.5 rounded-full bg-white border border-[#f0d5da] text-xs font-medium text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                >
                  {PRODUCT_SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick-Select Sort Bar & Active Count */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p data-testid="active-sort-summary" className="text-xs text-[#7c5c63]">
                Showing <strong className="text-[#2d1e21] font-tabular">{filteredProducts.length}</strong>{' '}
                products · Sorted by{' '}
                <strong className="text-[#9e5461]">
                  {PRODUCT_SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Featured'}
                </strong>
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                {PRODUCT_SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    data-testid={`sort-btn-${opt.value}`}
                    onClick={() => setSortBy(opt.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      sortBy === opt.value
                        ? 'bg-[#9e5461] text-white'
                        : 'bg-white border border-[#f0d5da] text-[#5c3d42] hover:border-[#9e5461]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategorySlug('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategorySlug === 'all'
                    ? 'bg-[#9e5461] text-white'
                    : 'bg-white border border-[#f0d5da] text-[#5c3d42] hover:border-[#9e5461]'
                }`}
              >
                All Items
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategorySlug(cat.slug)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    selectedCategorySlug === cat.slug
                      ? 'bg-[#9e5461] text-white'
                      : 'bg-white border border-[#f0d5da] text-[#5c3d42] hover:border-[#9e5461]'
                  }`}
                >
                  {cat.name}
                  {cat.status === 'coming-soon' ? ' · Coming Soon' : ''}
                </button>
              ))}
            </div>

            {/* Coming Soon Category Banner */}
            {categories.find((c) => c.slug === selectedCategorySlug)?.status === 'coming-soon' && (
              <div className="rounded-2xl bg-[#fdf2f4] border border-[#f0d5da] p-8 text-center space-y-2">
                <Sparkles className="w-7 h-7 text-[#9e5461] mx-auto" />
                <h3 className="font-serif text-2xl font-semibold text-[#2d1e21]">
                  {categories.find((c) => c.slug === selectedCategorySlug)?.name} — Launching Soon
                </h3>
                <p className="text-xs text-[#5c3d42] max-w-md mx-auto">
                  Our Gurugram studio is curating and quality-testing this collection. Purchases are disabled for Coming Soon categories until official release.
                </p>
              </div>
            )}

            {loadingCatalogue ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-80 rounded-2xl bg-[#fdf2f4]/60 animate-pulse border border-[#f0d5da]"
                  />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-2xl bg-white border border-[#f0d5da] p-12 text-center space-y-3">
                <p className="font-serif text-xl text-[#2d1e21]">
                  No products match your current filter.
                </p>
                <button
                  onClick={() => {
                    setSelectedCategorySlug('all');
                    setSearchQuery('');
                    setShowInStockOnly(false);
                  }}
                  className="px-4 py-2 rounded-full bg-[#9e5461] text-white text-xs font-medium"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    categoryName={categoryNameMap.get(product.categorySlug) || product.categorySlug}
                    isWishlisted={wishlist.includes(product.id)}
                    onToggleWishlist={() => toggleWishlist(product.id)}
                    onSelect={() => navigateToProduct(product)}
                    onAddToCart={() =>
                      handleAddToCart(product, 1, product.variants?.[0]?.id || null)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* SCREEN 6: PRODUCT DETAILS */}
        {screen === 'product-details' && currentProduct && (
          <div className="space-y-8">
            <button
              onClick={() => setScreen('shop')}
              className="text-xs text-[#7c5c63] hover:text-[#9e5461] flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Catalogue</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white rounded-3xl border border-[#f0d5da] p-5 sm:p-8 shadow-2xs">
              {/* Image Gallery */}
              <div className="lg:col-span-6 space-y-3">
                <div className="aspect-4/3 rounded-2xl overflow-hidden bg-[#fdf2f4] border border-[#f0d5da]">
                  <img
                    src={
                      currentProduct.images?.[activeImageIdx] ||
                      currentProduct.images?.[0] ||
                      ARTWORK.heroBanner
                    }
                    alt={currentProduct.name}
                    referrerPolicy="no-referrer"
                    data-testid="product-detail-main-image"
                    className="w-full h-full object-cover"
                  />
                </div>
                {currentProduct.images?.length > 1 && (
                  <div className="flex items-center gap-2">
                    {currentProduct.images.map((imgUrl: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIdx(idx)}
                        data-testid={`product-detail-thumb-${idx}`}
                        className={`w-16 h-16 rounded-xl overflow-hidden border-2 ${
                          activeImageIdx === idx ? 'border-[#9e5461]' : 'border-transparent'
                        }`}
                      >
                        <img
                          src={imgUrl}
                          alt={`${currentProduct.name} view ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Details & Controls */}
              <div className="lg:col-span-6 space-y-5">
                <div className="space-y-1.5">
                  <p className="text-xs text-[#9e5461] font-medium">
                    {categoryNameMap.get(currentProduct.categorySlug) || currentProduct.categorySlug} · SKU:{' '}
                    {currentProduct.sku}
                  </p>
                  <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#2d1e21]">
                    {currentProduct.name}
                  </h1>
                  <div className="flex items-baseline gap-3 pt-1">
                    <span className="text-2xl font-semibold text-[#2d1e21] font-tabular">
                      {formatINR(
                        currentProduct.sellingPricePaise +
                          (currentProduct.variants?.find((v: any) => v.id === selectedVariantId)
                            ?.priceDeltaPaise || 0)
                      )}
                    </span>
                    <span className="text-xs text-[#7c5c63]">Inclusive of all taxes</span>
                  </div>
                </div>

                {/* Availability Status */}
                <div className="text-xs text-[#5c3d42]">
                  {currentProduct.status === 'active' && currentProduct.availableQty > 0 ? (
                    <span className="text-emerald-800 font-medium">
                      In Stock ({currentProduct.availableQty} units ready in Gurugram warehouse)
                    </span>
                  ) : currentProduct.status === 'draft' ? (
                    <span className="text-amber-800 font-medium">
                      Draft Catalogue Entry — Proposed Price {formatINR(currentProduct.sellingPricePaise)}. Awaiting admin confirmation before orders open.
                    </span>
                  ) : currentProduct.status === 'coming-soon' ? (
                    <span className="text-[#9e5461] font-medium">
                      Coming Soon — Not yet open for purchase
                    </span>
                  ) : (
                    <span className="text-rose-700 font-medium">Currently Out of Stock</span>
                  )}
                </div>

                <p className="text-sm text-[#5c3d42] leading-relaxed">
                  {currentProduct.description}
                </p>

                {/* Variant Selection */}
                {currentProduct.variants?.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#7c5c63] block">
                      Select Option
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {currentProduct.variants.map((v: any) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
                            selectedVariantId === v.id
                              ? 'bg-[#9e5461] text-white border-[#9e5461]'
                              : 'bg-white text-[#2d1e21] border-[#f0d5da] hover:border-[#9e5461]'
                          }`}
                        >
                          {v.name}
                          {v.priceDeltaPaise > 0 ? ` (+${formatINR(v.priceDeltaPaise)})` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity & Add to Cart */}
                {currentProduct.status === 'active' && currentProduct.availableQty > 0 ? (
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <div className="flex items-center border border-[#f0d5da] rounded-full bg-[#fffdfb]">
                      <button
                        onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                        aria-label="Decrease quantity"
                        className="p-2.5 text-[#5c3d42] hover:text-[#9e5461]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-4 text-sm font-medium font-tabular">{detailQty}</span>
                      <button
                        onClick={() =>
                          setDetailQty((q) => Math.min(currentProduct.availableQty, q + 1))
                        }
                        aria-label="Increase quantity"
                        className="p-2.5 text-[#5c3d42] hover:text-[#9e5461]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        handleAddToCart(currentProduct, detailQty, selectedVariantId)
                      }
                      data-testid="detail-add-to-cart"
                      className="flex-1 py-3 px-6 rounded-full bg-[#9e5461] hover:bg-[#84414d] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add to Shopping Bag</span>
                    </button>

                    <button
                      onClick={() => toggleWishlist(currentProduct.id)}
                      aria-label="Toggle Wishlist"
                      className={`p-3 rounded-full border ${
                        wishlist.includes(currentProduct.id)
                          ? 'bg-[#fdf2f4] border-[#9e5461] text-[#9e5461]'
                          : 'border-[#f0d5da] text-[#5c3d42]'
                      }`}
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-[#fdf2f4] border border-[#f0d5da] text-xs text-[#5c3d42]">
                    Ordering is locked while this item is in{' '}
                    <strong className="uppercase">{currentProduct.status}</strong> status.
                  </div>
                )}

                {/* Indian PIN Code Serviceability Check */}
                <div className="pt-4 border-t border-[#f0d5da] space-y-2">
                  <label className="text-xs font-semibold text-[#2d1e21] flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-[#9e5461]" />
                    <span>Check Delivery Serviceability (Dispatched from Gurugram 122001)</span>
                  </label>
                  <div className="flex items-center gap-2 max-w-sm">
                    <input
                      type="text"
                      maxLength={6}
                      value={pinCheckInput}
                      onChange={(e) => setPinCheckInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit PIN code"
                      className="flex-1 px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs font-tabular focus:outline-none focus:border-[#9e5461]"
                    />
                    <button
                      onClick={handleCheckPinServiceability}
                      className="px-4 py-2 rounded-xl bg-[#fdf2f4] hover:bg-[#9e5461] text-[#9e5461] hover:text-white text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      Check PIN
                    </button>
                  </div>
                  {pinCheckResult && (
                    <p
                      className={`text-xs ${
                        pinCheckResult.isServiceable ? 'text-emerald-800' : 'text-rose-700'
                      }`}
                    >
                      {pinCheckResult.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Real Verified Product Reviews Section */}
            <div className="rounded-3xl bg-white border border-[#f0d5da] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f0d5da] pb-4">
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-[#2d1e21] flex items-center gap-2">
                    Verified Customer Reviews
                    <span className="text-xs font-sans px-2.5 py-0.5 rounded-full bg-[#fdf2f4] text-[#9e5461] border border-[#f0d5da]">
                      Verified Buyers Only
                    </span>
                  </h2>
                  <p className="text-xs text-[#7c5c63] mt-1">
                    Reviews can only be submitted by verified purchasers with confirmed Pretty Charm orders.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  className="px-4 py-2 rounded-full bg-[#9e5461] text-white text-xs font-semibold hover:bg-[#84414d] transition shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Write a Verified Review</span>
                </button>
              </div>

              {/* Review Modal */}
              {showReviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                  <div className="w-full max-w-lg rounded-3xl bg-white border border-[#f0d5da] p-6 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-[#f0d5da] pb-3">
                      <h3 className="font-serif text-xl font-semibold text-[#2d1e21]">
                        Review {currentProduct.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowReviewModal(false)}
                        className="text-[#7c5c63] hover:text-[#2d1e21]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleReviewSubmit} className="space-y-3.5 text-xs">
                      <div>
                        <label className="block text-[#5c3d42] mb-1 font-medium">
                          Star Rating *
                        </label>
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                              onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                              className="p-1 focus:outline-none"
                            >
                              <Star
                                className={`w-6 h-6 ${
                                  star <= reviewForm.rating
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            </button>
                          ))}
                          <span className="ml-2 text-xs font-semibold text-[#2d1e21]">
                            {reviewForm.rating} / 5 Stars
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[#5c3d42] mb-1 font-medium">
                            Order Number * (e.g. PC-2026-1001)
                          </label>
                          <input
                            required
                            type="text"
                            placeholder="PC-2026-1001"
                            value={reviewForm.orderNumber}
                            onChange={(e) =>
                              setReviewForm({ ...reviewForm, orderNumber: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[#5c3d42] mb-1 font-medium">
                            Order Access Token or Phone *
                          </label>
                          <input
                            required
                            type="text"
                            placeholder="pc_tok_... or 9876543210"
                            value={reviewForm.token || reviewForm.mobile}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v.startsWith('pc_tok_') || v.length > 15) {
                                setReviewForm({ ...reviewForm, token: v, mobile: '' });
                              } else {
                                setReviewForm({ ...reviewForm, mobile: v, token: '' });
                              }
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[#5c3d42] mb-1 font-medium">Review Title (Optional)</label>
                        <input
                          type="text"
                          maxLength={100}
                          placeholder="e.g. Elegant packaging and beautiful pearl shine!"
                          value={reviewForm.reviewTitle}
                          onChange={(e) =>
                            setReviewForm({ ...reviewForm, reviewTitle: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[#5c3d42] mb-1 font-medium">Review Details *</label>
                        <textarea
                          required
                          rows={4}
                          maxLength={1000}
                          placeholder="Tell future customers about quality, packaging, and real experience with this product..."
                          value={reviewForm.reviewText}
                          onChange={(e) =>
                            setReviewForm({ ...reviewForm, reviewText: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs"
                        />
                      </div>

                      {reviewMessage && (
                        <div
                          className={`p-3 rounded-xl text-xs ${
                            reviewMessage.type === 'success'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {reviewMessage.text}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2 border-t border-[#f0d5da]">
                        <button
                          type="button"
                          onClick={() => setShowReviewModal(false)}
                          className="px-4 py-2 rounded-xl border border-[#f0d5da] text-xs text-[#5c3d42]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingReview}
                          className="px-5 py-2 rounded-xl bg-[#9e5461] text-white text-xs font-semibold hover:bg-[#84414d] disabled:opacity-50"
                        >
                          {submittingReview ? 'Verifying...' : 'Submit Review'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Reviews List */}
              {loadingReviews ? (
                <div className="py-8 text-center text-xs text-[#7c5c63]">Loading verified reviews...</div>
              ) : productReviews.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Star className="w-8 h-8 text-[#ebd7dc] mx-auto" />
                  <p className="font-serif text-lg text-[#2d1e21]">No customer reviews yet.</p>
                  <p className="text-xs text-[#7c5c63]">
                    Be the first verified buyer to review this item after receiving your Pretty Charm parcel!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {productReviews.map((rev: any) => (
                    <div
                      key={rev.id}
                      className="rounded-2xl border border-[#f0d5da] bg-[#fffdfb] p-4 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                          ✓ Verified Purchase
                        </span>
                      </div>
                      {rev.review_title && (
                        <p className="font-semibold text-[#2d1e21] text-sm">{rev.review_title}</p>
                      )}
                      <p className="text-[#5c3d42] leading-relaxed">{rev.review_text}</p>
                      <div className="flex justify-between items-center text-[10px] text-[#7c5c63] pt-1 border-t border-[#f5e4e8]">
                        <span>{rev.customer_name}</span>
                        <span>{new Date(rev.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recently Viewed Products Section */}
            {recentlyViewed.filter((id) => id !== currentProduct.id).length > 0 && (
              <div className="space-y-4 pt-4">
                <h3 className="font-serif text-2xl font-semibold text-[#2d1e21]">
                  Recently Viewed
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {products
                    .filter((p) => recentlyViewed.includes(p.id) && p.id !== currentProduct.id)
                    .slice(0, 4)
                    .map((rp) => (
                      <ProductCard
                        key={rp.id}
                        product={rp}
                        categoryName={categoryNameMap.get(rp.categorySlug) || rp.categorySlug}
                        isWishlisted={wishlist.includes(rp.id)}
                        onToggleWishlist={() => toggleWishlist(rp.id)}
                        onSelect={() => navigateToProduct(rp)}
                        onAddToCart={() => handleAddToCart(rp, 1, rp.variants?.[0]?.id || null)}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 7: WISHLIST */}
        {screen === 'wishlist' && (
          <div className="space-y-6">
            <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
              My Saved Wishlist ({wishlist.length})
            </h1>
            {wishlist.length === 0 ? (
              <div className="rounded-3xl bg-white border border-[#f0d5da] p-12 text-center space-y-3">
                <Heart className="w-8 h-8 text-[#9e5461] mx-auto" />
                <p className="font-serif text-xl text-[#2d1e21]">
                  Your Pretty Charm wishlist is empty.
                </p>
                <button
                  onClick={() => setScreen('shop')}
                  className="px-5 py-2.5 rounded-full bg-[#9e5461] text-white text-xs font-medium"
                >
                  Explore Accessories &amp; Jewellery
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {products
                  .filter((p) => wishlist.includes(p.id))
                  .map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      categoryName={categoryNameMap.get(product.categorySlug) || product.categorySlug}
                      isWishlisted={true}
                      onToggleWishlist={() => toggleWishlist(product.id)}
                      onSelect={() => navigateToProduct(product)}
                      onAddToCart={() =>
                        handleAddToCart(product, 1, product.variants?.[0]?.id || null)
                      }
                    />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* SCREEN 8: CART */}
        {screen === 'cart' && (
          <div className="space-y-6">
            <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
              Your Shopping Bag
            </h1>

            {savedOrders.length > 0 && (
              <div
                data-testid="saved-orders-banner"
                className="rounded-2xl bg-[#fdf2f4] border border-[#e8c6ce] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-[#9e5461]">
                    Saved Order on This Device: #{savedOrders[0].orderNumber}
                  </p>
                  <p className="text-[11px] text-[#5c3d42]">
                    Returned without pressing Send in WhatsApp? Your saved order ({formatINR(savedOrders[0].totalPaise)}) is still stored and ready to resume.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="resume-saved-order-btn"
                    onClick={() => {
                      setLastCreatedOrder(savedOrders[0]);
                      setScreen('order-success');
                    }}
                    className="px-4 py-2 rounded-full bg-[#9e5461] text-white text-xs font-medium whitespace-nowrap"
                  >
                    Open Saved Order #{savedOrders[0].orderNumber}
                  </button>
                </div>
              </div>
            )}

            {hydratedCart.length === 0 ? (
              <div className="rounded-3xl bg-white border border-[#f0d5da] p-12 text-center space-y-3">
                <ShoppingBag className="w-8 h-8 text-[#9e5461] mx-auto" />
                <p className="font-serif text-xl text-[#2d1e21]">
                  Your shopping bag is currently empty.
                </p>
                <p className="text-xs text-[#7c5c63]">
                  Add gift hampers (₹299 &amp; ₹499), satin hair claws, or rose-gold jewellery to begin.
                </p>
                <button
                  onClick={() => setScreen('shop')}
                  className="px-5 py-2.5 rounded-full bg-[#9e5461] text-white text-xs font-medium"
                >
                  Shop Collection
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-4">
                  {/* Free Shipping Progress Bar */}
                  <div className="rounded-2xl bg-white border border-[#f0d5da] p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#2d1e21] flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-[#9e5461]" />
                        Pan-India Delivery Progress (from Gurugram)
                      </span>
                      <span className="font-medium text-[#9e5461]">{freeShippingProgress.progressPercentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#fce9ee] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#df9ea8] to-[#9e5461] transition-all duration-500"
                        style={{ width: `${freeShippingProgress.progressPercentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-[#7c5c63]">
                      {freeShippingProgress.message}
                    </p>
                  </div>

                  {/* Active Combo Offers Pill / Banner */}
                  {cartComboEvaluation.appliedCombos.length > 0 && (
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2 text-xs">
                      <div className="flex items-center gap-2 font-semibold text-emerald-800">
                        <Tag className="w-4 h-4 text-emerald-600" />
                        <span>Combo Offer Discounts Applied!</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cartComboEvaluation.appliedCombos.map((c) => (
                          <span key={c.comboId} className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-medium">
                            🎉 {c.comboName}: {c.badge} (-{formatINR(c.discountPaise)})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {hydratedCart.map((item) => (
                    <div
                      key={`${item.productId}-${item.variantId || 'default'}`}
                      className="rounded-2xl bg-white border border-[#f0d5da] p-4 flex items-center gap-4"
                    >
                      <img
                        src={item.product.images?.[0] || ARTWORK.heroBanner}
                        alt={item.product.name}
                        referrerPolicy="no-referrer"
                        data-testid={`cart-item-thumb-${item.productId}`}
                        className="w-20 h-20 rounded-xl object-cover bg-[#fdf2f4] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif text-lg font-semibold text-[#2d1e21] truncate">
                          {item.product.name}
                        </h3>
                        {item.variantName && (
                          <p className="text-xs text-[#7c5c63]">{item.variantName}</p>
                        )}
                        <p className="text-xs text-[#9e5461] font-tabular mt-1">
                          {formatINR(item.unitPricePaise)} each
                        </p>
                      </div>

                      <div className="flex items-center border border-[#f0d5da] rounded-full">
                        <button
                          onClick={() => updateCartItemQty(item.productId, item.variantId, -1)}
                          aria-label="Decrease quantity"
                          className="p-2 text-[#5c3d42] hover:text-[#9e5461]"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 text-xs font-medium font-tabular">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartItemQty(item.productId, item.variantId, 1)}
                          aria-label="Increase quantity"
                          className="p-2 text-[#5c3d42] hover:text-[#9e5461]"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#2d1e21] font-tabular">
                          {formatINR(item.lineTotalPaise)}
                        </p>
                        <button
                          onClick={() =>
                            updateCartItemQty(item.productId, item.variantId, -item.quantity)
                          }
                          className="text-[11px] text-rose-700 hover:underline mt-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Gift Personalization Card */}
                  <div className="rounded-2xl bg-[#fffdfb] border border-[#f0d5da] p-4 sm:p-5 space-y-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={giftPersonalization.isGift}
                        onChange={(e) =>
                          setGiftPersonalization({ ...giftPersonalization, isGift: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-[#9e5461] focus:ring-[#9e5461]"
                      />
                      <span className="text-xs sm:text-sm font-semibold text-[#2d1e21] flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-[#9e5461]" />
                        Complimentary Gift Note &amp; Occasion (Free Keepsake Card)
                      </span>
                    </label>
                    {giftPersonalization.isGift && (
                      <div className="pt-2 border-t border-[#f0d5da] space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[#5c3d42] mb-1 font-medium">Recipient Name (Optional)</label>
                            <input
                              type="text"
                              maxLength={80}
                              placeholder="e.g. Diya Sen"
                              value={giftPersonalization.recipientName || ''}
                              onChange={(e) =>
                                setGiftPersonalization({ ...giftPersonalization, recipientName: e.target.value })
                              }
                              className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[#5c3d42] mb-1 font-medium">Occasion</label>
                            <select
                              value={giftPersonalization.occasion || 'Birthday'}
                              onChange={(e) =>
                                setGiftPersonalization({ ...giftPersonalization, occasion: e.target.value as GiftOccasion })
                              }
                              className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs bg-white"
                            >
                              <option value="Birthday">Birthday</option>
                              <option value="Anniversary">Anniversary</option>
                              <option value="Rakhi / Bhai Dooj">Rakhi / Bhai Dooj</option>
                              <option value="Congratulations">Congratulations</option>
                              <option value="Festive Celebration">Festive Celebration</option>
                              <option value="Just Because / Self Love">Just Because / Self Love</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[#5c3d42] font-medium">Gift Note Message (up to 300 characters)</label>
                            <span className="text-[11px] text-[#7c5c63]">{(giftPersonalization.giftNote || '').length}/300</span>
                          </div>
                          <textarea
                            maxLength={300}
                            rows={3}
                            placeholder="Write your heartfelt message here. We will print it on our complimentary blush-pink gift card!"
                            value={giftPersonalization.giftNote || ''}
                            onChange={(e) =>
                              setGiftPersonalization({ ...giftPersonalization, giftNote: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Summary Box */}
                <div className="lg:col-span-4">
                  <div className="rounded-3xl bg-white border border-[#f0d5da] p-6 space-y-4">
                    <h2 className="font-serif text-2xl font-semibold text-[#2d1e21]">
                      Order Summary
                    </h2>

                    <div className="space-y-2 text-xs border-t border-[#f0d5da] pt-3">
                      <div className="flex justify-between">
                        <span className="text-[#7c5c63]">Subtotal</span>
                        <span className="font-medium font-tabular">
                          {formatINR(cartSubtotalPaise)}
                        </span>
                      </div>
                      {comboDiscountPaise > 0 && (
                        <div className="flex justify-between text-emerald-700 font-medium">
                          <span>Combo Offer Discount</span>
                          <span className="font-tabular">-{formatINR(comboDiscountPaise)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#7c5c63]">
                          Pan-India Shipping (from Gurugram)
                        </span>
                        <span className="font-medium font-tabular">
                          {shippingPaise === 0 ? 'FREE' : formatINR(shippingPaise)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold text-[#2d1e21] border-t border-[#f0d5da] pt-2.5">
                        <span>Total Payable (INR)</span>
                        <span data-testid="cart-grand-total" className="font-tabular">
                          {formatINR(grandTotalPaise)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#7c5c63]">
                      {discountedSubtotalPaise < 49900
                        ? `Add ${formatINR(49900 - discountedSubtotalPaise)} more to reduce shipping to ₹39, or ${formatINR(99900 - discountedSubtotalPaise)} for FREE shipping.`
                        : discountedSubtotalPaise < 99900
                        ? `Add ${formatINR(99900 - discountedSubtotalPaise)} more for FREE shipping!`
                        : 'Your order qualifies for FREE Pan-India shipping!'}
                    </p>

                    <button
                      onClick={() => setScreen('checkout')}
                      data-testid="proceed-to-checkout-btn"
                      className="w-full py-3.5 rounded-full bg-[#9e5461] hover:bg-[#84414d] text-white text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Proceed to Checkout (Guest or Account)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 9: CHECKOUT AND ADDRESS ENTRY */}
        {screen === 'checkout' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
              Secure Checkout · Indian Delivery Address
            </h1>

            {customerAddresses.length > 0 && (
              <div className="rounded-2xl bg-[#fdf2f4] border border-[#f0d5da] p-4 space-y-2">
                <p className="text-xs font-semibold text-[#9e5461]">
                  Use a Saved Address from Your Account:
                </p>
                <div className="flex flex-wrap gap-2">
                  {customerAddresses.map((addr: any) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => {
                        setCheckoutForm((prev) => ({
                          ...prev,
                          fullName: addr.fullName,
                          mobile: addr.mobile,
                          houseFlat: addr.houseFlat,
                          street: addr.street || addr.streetLocality || '',
                          locality: addr.locality || addr.streetLocality || '',
                          streetLocality: addr.streetLocality || '',
                          landmark: addr.landmark || '',
                          city: addr.city,
                          district: addr.district || addr.city,
                          state: addr.state,
                          pincode: addr.pincode,
                          selectedPostOffice: addr.selectedPostOffice || '',
                          deliveryInstructions: addr.deliveryInstructions || '',
                        }));
                        if (addr.pincode && addr.pincode.length === 6) {
                          handleLookupPincode(addr.pincode);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#e5c2c9] text-xs text-[#2d1e21] hover:border-[#9e5461]"
                    >
                      {addr.label}: {addr.fullName} ({addr.pincode})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={handlePlaceOrder}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              <div className="lg:col-span-7 rounded-3xl bg-white border border-[#f0d5da] p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#f0d5da]">
                  <div>
                    <h2 className="font-serif text-xl font-semibold text-[#2d1e21]">
                      1. Delivery Address &amp; Indian Postal Verification
                    </h2>
                    <p className="text-[11px] text-[#7a5960]">
                      Dispatching safely from our Gurugram, Haryana studio with live India Post validation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#fdf2f4] hover:bg-[#fce7eb] border border-[#e5c2c9] text-xs font-semibold text-[#9e5461] transition disabled:opacity-50 shrink-0 shadow-sm"
                  >
                    {isLocating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Detecting Location...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Use My Current Location</span>
                      </>
                    )}
                  </button>
                </div>

                {locationError && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-amber-950">Location Detection Notice</p>
                      <p className="text-amber-800">{locationError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocationError('')}
                      className="text-amber-600 hover:text-amber-900 font-bold text-xs"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {locationNotice && (
                  <div className="p-3 rounded-2xl bg-rose-50/80 border border-rose-200 text-[#7a3b47] text-xs flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[#9e5461] shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-[#592531]">Residence Disclosure Notice</p>
                      <p>{locationNotice}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocationNotice('')}
                      className="text-[#9e5461] hover:text-[#592531] font-bold text-xs"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {locationMismatch && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 text-xs space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-amber-950">Location Inconsistency Detected</p>
                        <p className="text-amber-800">
                          PIN code <strong>{checkoutForm.pincode}</strong> officially corresponds to{' '}
                          <strong>{locationMismatch.expectedDistrict || locationMismatch.expectedState}</strong>, but "
                          <span className="underline decoration-amber-500 font-medium">
                            {locationMismatch.actualValue}
                          </span>
                          " is currently entered.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-6">
                      <button
                        type="button"
                        onClick={handleAutoCorrectLocation}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm transition inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Auto-correct to {locationMismatch.expectedDistrict ? `${locationMismatch.expectedDistrict}, ` : ''}
                        {locationMismatch.expectedState}
                      </button>
                      <span className="text-[11px] text-amber-700">or verify your 6-digit PIN code</span>
                    </div>
                  </div>
                )}

                {/* Recipient Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#5c3d42] block mb-1">Full Name *</label>
                    <input
                      required
                      name="fullName"
                      value={checkoutForm.fullName}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, fullName: e.target.value })
                      }
                      placeholder="Ananya Sharma"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs focus:ring-1 focus:ring-[#9e5461] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#5c3d42] block mb-1">
                      10-Digit Indian Mobile *
                    </label>
                    <input
                      required
                      name="mobile"
                      maxLength={10}
                      value={checkoutForm.mobile}
                      onChange={(e) =>
                        setCheckoutForm({
                          ...checkoutForm,
                          mobile: e.target.value.replace(/\D/g, '')
                        })
                      }
                      placeholder="9876543210"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs font-tabular focus:ring-1 focus:ring-[#9e5461] focus:outline-none"
                    />
                  </div>
                </div>

                {/* PIN Code with Real-time Postal Directory Status */}
                <div className="p-3.5 rounded-2xl bg-[#faf6f7] border border-[#f0d5da] space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-[#5c3d42] font-semibold">
                          6-Digit Indian PIN Code *
                        </label>
                        {pincodeLookupState === 'loading' && (
                          <span className="text-[11px] text-[#9e5461] flex items-center gap-1 font-medium">
                            <Loader2 className="w-3 h-3 animate-spin" /> Verifying...
                          </span>
                        )}
                      </div>
                      <input
                        required
                        name="pincode"
                        maxLength={6}
                        value={checkoutForm.pincode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setCheckoutForm({ ...checkoutForm, pincode: val });
                          if (val.length === 6) {
                            handleLookupPincode(val);
                          } else {
                            setPincodeLookupState('idle');
                          }
                        }}
                        placeholder="e.g. 122001 or 110001"
                        className="w-full px-3.5 py-2 rounded-xl border border-[#e5c2c9] bg-white text-xs font-tabular text-[#2d1e21] focus:ring-2 focus:ring-[#9e5461]/30 focus:outline-none"
                      />
                    </div>

                    {/* Post Office Selector (if multiple exist for PIN) */}
                    <div>
                      <label className="text-xs text-[#5c3d42] block mb-1 font-semibold">
                        Post Office / Hub {availablePostOffices.length > 0 ? `(${availablePostOffices.length} options)` : ''}
                      </label>
                      {availablePostOffices.length > 0 ? (
                        <select
                          value={checkoutForm.selectedPostOffice}
                          onChange={(e) =>
                            setCheckoutForm({ ...checkoutForm, selectedPostOffice: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#e5c2c9] bg-white text-xs text-[#2d1e21] focus:ring-2 focus:ring-[#9e5461]/30 focus:outline-none"
                        >
                          {availablePostOffices.map((po) => (
                            <option key={po} value={po}>
                              {po}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-3.5 py-2 rounded-xl border border-dashed border-[#e5c2c9] bg-white/60 text-xs text-[#8c6b72]">
                          {pincodeLookupState === 'loading' ? 'Resolving post offices...' : 'Enter 6-digit PIN to load post offices'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Postal Verification & Delivery Status Indicator */}
                  <div className="pt-1">
                    {pincodeLookupState === 'valid' && (
                      <div className="text-xs text-emerald-800 bg-emerald-50/90 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          <strong>India Post Verified:</strong> {postalLookupData?.state || checkoutForm.state} ({postalLookupData?.district || checkoutForm.district}) · Delivery Serviceable (Pan-India Dispatch)
                        </span>
                      </div>
                    )}
                    {pincodeLookupState === 'unserviceable' && (
                      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          <strong>Postal Hub Verified:</strong> {postalLookupData?.district || checkoutForm.district}, {postalLookupData?.state || checkoutForm.state} · Outside our current active delivery routes.
                        </span>
                      </div>
                    )}
                    {pincodeLookupState === 'invalid' && (
                      <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>
                          Invalid Indian PIN code format. Must be exactly 6 numeric digits and cannot begin with 0.
                        </span>
                      </div>
                    )}
                    {pincodeLookupState === 'api_error' && (
                      <div className="text-xs text-[#6e5259] bg-white border border-[#f0d5da] px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-[#9e5461] shrink-0" />
                        <span>
                          Postal directory service unavailable. You can enter your district and state manually below.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 8-Part Specific Address Fields */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-xs text-[#5c3d42] block mb-1">
                      House / Flat / Building No. *
                    </label>
                    <input
                      required
                      name="houseFlat"
                      value={checkoutForm.houseFlat}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, houseFlat: e.target.value })
                      }
                      placeholder="e.g. Flat 402, Tower B, Palm Grove Apts"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs focus:ring-1 focus:ring-[#9e5461] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#5c3d42] block mb-1">
                        Street / Road / Lane *
                      </label>
                      <input
                        required
                        name="street"
                        value={checkoutForm.street}
                        onChange={(e) =>
                          setCheckoutForm({
                            ...checkoutForm,
                            street: e.target.value,
                            streetLocality: [e.target.value, checkoutForm.locality].filter(Boolean).join(', ')
                          })
                        }
                        placeholder="e.g. Galleria Market Road"
                        className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs focus:ring-1 focus:ring-[#9e5461] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#5c3d42] block mb-1">
                        Locality / Area / Sector *
                      </label>
                      <input
                        required
                        name="locality"
                        value={checkoutForm.locality}
                        onChange={(e) =>
                          setCheckoutForm({
                            ...checkoutForm,
                            locality: e.target.value,
                            streetLocality: [checkoutForm.street, e.target.value].filter(Boolean).join(', ')
                          })
                        }
                        placeholder="e.g. DLF Phase 4 / Sector 28"
                        className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs focus:ring-1 focus:ring-[#9e5461] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#5c3d42] block mb-1">
                      Landmark (Optional)
                    </label>
                    <input
                      name="landmark"
                      value={checkoutForm.landmark}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, landmark: e.target.value })
                      }
                      placeholder="e.g. Opposite Apollo Pharmacy / Near Community Centre"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs focus:ring-1 focus:ring-[#9e5461] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-[#5c3d42] block mb-1">City / Town *</label>
                      <input
                        required
                        name="city"
                        value={checkoutForm.city}
                        onChange={(e) =>
                          setCheckoutForm({ ...checkoutForm, city: e.target.value })
                        }
                        placeholder="Gurugram"
                        className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs focus:ring-1 focus:ring-[#9e5461] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#5c3d42] block mb-1">District *</label>
                      <input
                        required
                        name="district"
                        value={checkoutForm.district}
                        onChange={(e) =>
                          setCheckoutForm({ ...checkoutForm, district: e.target.value })
                        }
                        placeholder="Gurgaon"
                        className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs focus:ring-1 focus:ring-[#9e5461] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#5c3d42] block mb-1">State / UT *</label>
                      <select
                        value={checkoutForm.state}
                        onChange={(e) =>
                          setCheckoutForm({ ...checkoutForm, state: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs bg-white focus:ring-1 focus:ring-[#9e5461] focus:outline-none"
                      >
                        {INDIAN_STATES_AND_UTS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Logistics Transparency Notice */}
                <div className="p-3.5 rounded-2xl bg-[#fdf2f4]/70 border border-[#f0d5da] text-[11px] text-[#5c3d42] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#2d1e21] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#9e5461]" />
                      Postal Code Verification vs Logistics Serviceability
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#e5c2c9] text-[#9e5461] font-semibold">
                      India Post OGD
                    </span>
                  </div>
                  <p>
                    A valid Indian PIN code registers postal area delivery. Courier dispatch operates from Gurugram (PIN 122001), Haryana. Standard Pan-India transit ETA is 3 to 6 business days.
                  </p>
                </div>

                <div>
                  <label className="text-xs text-[#5c3d42] block mb-1">
                    Gift Message / Delivery Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={checkoutForm.deliveryInstructions}
                    onChange={(e) =>
                      setCheckoutForm({
                        ...checkoutForm,
                        deliveryInstructions: e.target.value
                      })
                    }
                    placeholder="Add a handwritten gift card note or gate instructions..."
                    className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs focus:ring-1 focus:ring-[#9e5461] focus:outline-none"
                  />
                </div>
              </div>

              {/* Payment Mode Info & Final Confirmation */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-3xl bg-white border border-[#f0d5da] p-6 space-y-4">
                  <h2 className="font-serif text-xl font-semibold text-[#2d1e21]">
                    2. Payment &amp; Order Review
                  </h2>

                  {/* Checkout Item Thumbnails */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1" data-testid="checkout-items-list">
                    {hydratedCart.map((item) => (
                      <div
                        key={`chk-${item.productId}-${item.variantId || 'default'}`}
                        className="flex items-center gap-3 p-2 rounded-xl bg-[#fffdfb] border border-[#f0d5da]"
                      >
                        <img
                          src={item.product.images?.[0] || ARTWORK.heroBanner}
                          alt={item.product.name}
                          referrerPolicy="no-referrer"
                          data-testid={`checkout-item-thumb-${item.productId}`}
                          className="w-12 h-12 rounded-lg object-cover bg-[#fdf2f4] shrink-0"
                        />
                        <div className="flex-1 min-w-0 text-xs">
                          <p className="font-semibold text-[#2d1e21] truncate">{item.product.name}</p>
                          <p className="text-[11px] text-[#7c5c63]">
                            Qty: {item.quantity} × {formatINR(item.unitPricePaise)}
                          </p>
                        </div>
                        <span className="text-xs font-semibold font-tabular text-[#2d1e21]">
                          {formatINR(item.lineTotalPaise)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#fdf2f4] border border-[#f0d5da] text-xs space-y-1.5">
                    <p className="font-semibold text-[#2d1e21]">
                      WhatsApp-Assisted Order &amp; Verified Payment Workflow
                    </p>
                    <p className="text-[#5c3d42] leading-relaxed">
                      1. Your order is first validated and saved in our database with a unique Order ID (status: <strong className="text-[#2d1e21]">awaiting_payment</strong>, payment: <strong className="text-[#2d1e21]">pending</strong>).
                    </p>
                    <p className="text-[#5c3d42] leading-relaxed">
                      2. Next, open WhatsApp with your prefilled order summary and press <strong className="text-[#2d1e21]">Send</strong> to receive our official payment link or QR code.
                    </p>
                  </div>

                  <div className="border-t border-[#f0d5da] pt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#7c5c63]">Items Subtotal</span>
                      <span className="font-tabular">{formatINR(cartSubtotalPaise)}</span>
                    </div>
                    {comboDiscountPaise > 0 && (
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>Combo Offer Discount</span>
                        <span className="font-tabular">-{formatINR(comboDiscountPaise)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#7c5c63]">Shipping (from Gurugram)</span>
                      <span className="font-tabular">
                        {shippingPaise === 0 ? 'FREE' : formatINR(shippingPaise)}
                      </span>
                    </div>
                    {giftPersonalization.isGift && (
                      <div className="p-2.5 rounded-xl bg-[#fffdfb] border border-[#f0d5da] text-[11px] text-[#5c3d42] space-y-1">
                        <p className="font-semibold text-[#9e5461] flex items-center gap-1">
                          <Gift className="w-3.5 h-3.5" />
                          Complimentary Gift Card Included
                        </p>
                        {giftPersonalization.recipientName && (
                          <p>For: {giftPersonalization.recipientName} ({giftPersonalization.occasion})</p>
                        )}
                        {giftPersonalization.giftNote && (
                          <p className="italic text-[#7c5c63]">"{giftPersonalization.giftNote}"</p>
                        )}
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold text-[#2d1e21] pt-1">
                      <span>Grand Total</span>
                      <span data-testid="checkout-grand-total" className="font-tabular">
                        {formatINR(grandTotalPaise)}
                      </span>
                    </div>
                  </div>

                  {checkoutError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                      {checkoutError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingOrder}
                    data-testid="place-order-submit-btn"
                    className="w-full py-3.5 px-4 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>
                      {submittingOrder
                        ? 'Saving Order in Database...'
                        : 'Order via WhatsApp'}
                    </span>
                  </button>

                  <p className="text-[11px] text-[#7c5c63] text-center leading-relaxed">
                    Saves your order first, then prepares your WhatsApp message. Remember to press <strong>Send</strong> in WhatsApp.
                  </p>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* SCREEN 10: PAYMENT INSTRUCTIONS / PAYMENT STATUS */}
        {screen === 'payment-status' && lastCreatedOrder && (
          <div className="max-w-xl mx-auto rounded-3xl bg-white border border-[#f0d5da] p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-[#9e5461] font-semibold">
                Order #{lastCreatedOrder.orderNumber}
              </span>
              <span className="text-xs font-medium text-amber-800">
                Payment Status: {lastCreatedOrder.paymentStatus}
              </span>
            </div>

            <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
              Complete Your Manual UPI Payment
            </h1>

            <p className="text-xs text-[#5c3d42] leading-relaxed">
              Your stock has been reserved. Please transfer{' '}
              <strong className="font-tabular text-[#2d1e21]">
                {formatINR(lastCreatedOrder.totalPaise)}
              </strong>{' '}
              to our official UPI ID below and submit your UPI Reference / UTR number.
              In accordance with Pretty Charm financial controls, orders are never marked Paid until our Admin team verifies the credit in our bank statement.
            </p>

            <div className="p-4 rounded-2xl bg-[#fdf2f4] border border-[#f0d5da] space-y-1">
              <p className="text-xs text-[#7c5c63]">Official Pretty Charm UPI Handle</p>
              <p className="text-lg font-semibold text-[#9e5461] font-tabular">
                {generalSettings.manualPaymentUpiId || 'prettycharm@upi'}
              </p>
            </div>

            <form onSubmit={handleSubmitUtrReference} className="space-y-3">
              <label className="text-xs font-medium text-[#2d1e21] block">
                Enter UPI UTR / Transaction Reference Number
              </label>
              <div className="flex gap-2">
                <input
                  required
                  value={utrReferenceInput}
                  onChange={(e) => setUtrReferenceInput(e.target.value)}
                  placeholder="e.g. 412389012345"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#f0d5da] text-xs font-tabular"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#9e5461] text-white text-xs font-medium whitespace-nowrap"
                >
                  Submit UTR
                </button>
              </div>
              {utrErrorMsg && <p className="text-xs text-rose-700">{utrErrorMsg}</p>}
              {utrSubmittedMsg && (
                <p className="text-xs text-emerald-800">{utrSubmittedMsg}</p>
              )}
            </form>

            <div className="pt-3 border-t border-[#f0d5da] flex justify-end">
              <button
                onClick={() => setScreen('order-success')}
                className="px-5 py-2.5 rounded-full bg-[#2d1e21] text-white text-xs font-medium whitespace-nowrap"
              >
                View Order Confirmation Summary →
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 11: SAVED ORDER & WHATSAPP HANDOFF */}
        {screen === 'order-success' && lastCreatedOrder && (
          <div className="max-w-2xl mx-auto rounded-3xl bg-white border border-[#f0d5da] p-5 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#fdf2f4] text-[#9e5461] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#9e5461] font-semibold">
                  Step 1 Complete · Order Saved in Database
                </p>
                <h1
                  data-testid="order-success-heading"
                  className="font-serif text-2xl sm:text-3xl text-[#2d1e21] font-semibold"
                >
                  Send Your Saved Order on WhatsApp
                </h1>
              </div>
            </div>

            {/* CRITICAL HONESTY NOTICE: Must press Send in WhatsApp */}
            <div
              data-testid="whatsapp-press-send-notice"
              className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-1.5 text-xs text-amber-950"
            >
              <p className="font-semibold">
                Action Required: Please Press &ldquo;Send&rdquo; in WhatsApp
              </p>
              <p className="leading-relaxed">
                Your order <strong className="font-tabular">{lastCreatedOrder.orderNumber}</strong> is saved on our website, but opening WhatsApp does <strong>not</strong> automatically send your message. Tap <strong>&ldquo;Order via WhatsApp&rdquo;</strong> below and press <strong>Send</strong> inside WhatsApp so our team can share your payment link or QR code.
              </p>
              <p className="text-[11px] text-amber-900">
                If you return without sending the message, this saved order remains accessible on our website anytime.
              </p>
            </div>

            {/* Order Status & Metadata Summary */}
            <div className="rounded-2xl bg-[#fdf2f4]/60 border border-[#f0d5da] p-4 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-[#7c5c63]">Order ID</span>
                <span
                  data-testid="confirmed-order-number"
                  className="font-semibold text-[#2d1e21] font-tabular"
                >
                  {lastCreatedOrder.orderNumber}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#7c5c63]">Order Status</span>
                <span
                  data-testid="confirmed-order-status"
                  className="font-semibold text-[#9e5461]"
                >
                  {lastCreatedOrder.orderStatus}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#7c5c63]">Payment Status</span>
                <span
                  data-testid="confirmed-payment-status"
                  className="font-semibold text-amber-800"
                >
                  {lastCreatedOrder.paymentStatus}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#7c5c63]">Total Amount</span>
                <span className="font-semibold font-tabular text-[#2d1e21]">
                  {formatINR(lastCreatedOrder.totalPaise)}
                </span>
              </div>
              {lastCreatedOrder.shippingAddress && (
                <div className="pt-2 border-t border-[#f0d5da] space-y-1">
                  <p className="text-[#7c5c63]">Customer &amp; Delivery Address</p>
                  <p className="font-medium text-[#2d1e21]">
                    {lastCreatedOrder.shippingAddress.fullName} · +91 {lastCreatedOrder.shippingAddress.mobile}
                  </p>
                  <p className="text-[#5c3d42]">
                    {formatCompleteDeliveryAddress(lastCreatedOrder.shippingAddress)}
                  </p>
                  {lastCreatedOrder.shippingAddress.deliveryInstructions && (
                    <p className="text-[#7c5c63] italic">
                      Note: {lastCreatedOrder.shippingAddress.deliveryInstructions}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Saved Order Items */}
            {Array.isArray(lastCreatedOrder.items) && lastCreatedOrder.items.length > 0 && (
              <div className="rounded-2xl bg-white border border-[#f0d5da] p-4 space-y-2 text-xs">
                <p className="font-semibold text-[#2d1e21]">Saved Order Items</p>
                {lastCreatedOrder.items.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between gap-2 py-1 border-b last:border-b-0 border-[#f5e4e8]">
                    <span className="text-[#2d1e21]">
                      {it.productName}
                      {it.variantName ? ` (${it.variantName})` : ''} × {it.quantity}
                    </span>
                    <span className="font-tabular font-medium text-[#2d1e21]">
                      {formatINR(it.lineTotalPaise ?? it.unitPricePaise * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Secure 1-Click Guest Order Tracking Link */}
            {lastCreatedOrder.orderAccessToken && (
              <div className="rounded-2xl bg-[#fffdfb] border border-[#f0d5da] p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#2d1e21] flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#9e5461]" />
                    Private Guest Tracking Link
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Token Protected
                  </span>
                </div>
                <p className="text-[11px] text-[#7c5c63]">
                  Bookmark this link to track your shipment anytime without needing to log in:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`${window.location.origin}/?screen=track-order&token=${lastCreatedOrder.orderAccessToken}`}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#f0d5da] bg-[#faf5f6] text-[11px] font-mono text-[#5c3d42]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        `${window.location.origin}/?screen=track-order&token=${lastCreatedOrder.orderAccessToken}`
                      );
                      setCopiedTrackingLink(true);
                      setTimeout(() => setCopiedTrackingLink(false), 3000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#9e5461] text-white text-[11px] font-medium flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedTrackingLink ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Primary CTA: Order via WhatsApp */}
            {(() => {
              const waPayload = {
                orderNumber: lastCreatedOrder.orderNumber,
                customerName: lastCreatedOrder.shippingAddress?.fullName || checkoutForm.fullName || 'Customer',
                customerMobile: lastCreatedOrder.shippingAddress?.mobile || checkoutForm.mobile || '',
                address: lastCreatedOrder.shippingAddress || checkoutForm,
                items: lastCreatedOrder.items || [],
                subtotalPaise: lastCreatedOrder.subtotalPaise || lastCreatedOrder.totalPaise,
                shippingFeePaise: lastCreatedOrder.shippingFeePaise || 0,
                totalPaise: lastCreatedOrder.totalPaise,
              };
              const waUrl =
                lastCreatedOrder.whatsappOrderUrl ||
                buildCustomerOrderWhatsAppUrl(
                  generalSettings.supportWhatsapp || '919000000000',
                  waPayload
                );
              const waMessage =
                lastCreatedOrder.whatsappOrderMessage ||
                buildCustomerOrderWhatsAppMessage(waPayload);

              return (
                <div className="space-y-3">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="order-via-whatsapp-btn"
                    className="w-full py-3.5 px-5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>Order via WhatsApp</span>
                  </a>

                  <div className="rounded-2xl bg-[#faf5f6] border border-[#ebd7dc] p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#5c3d42]">
                        Prefilled WhatsApp Order Message Preview
                      </span>
                      <button
                        type="button"
                        data-testid="copy-whatsapp-message-btn"
                        onClick={() => {
                          navigator.clipboard?.writeText(waMessage);
                          showToast('Order message copied to clipboard');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-[#e5c2c9] text-[11px] font-medium text-[#9e5461] hover:border-[#9e5461] cursor-pointer"
                      >
                        Copy Message
                      </button>
                    </div>
                    <pre
                      data-testid="whatsapp-order-message-preview"
                      className="text-[11px] text-[#2d1e21] whitespace-pre-wrap break-words font-sans bg-white p-3 rounded-xl border border-[#f0d5da] max-h-44 overflow-y-auto"
                    >
                      {waMessage}
                    </pre>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#f0d5da]">
              <button
                onClick={() => {
                  setTrackOrderForm({
                    orderNumber: lastCreatedOrder.orderNumber,
                    mobile:
                      lastCreatedOrder.shippingAddress?.mobile || checkoutForm.mobile
                  });
                  setScreen('track-order');
                }}
                data-testid="track-this-order-btn"
                className="px-5 py-2.5 rounded-full bg-[#9e5461] text-white text-xs font-medium cursor-pointer"
              >
                Track Saved Order Status
              </button>

              <button
                type="button"
                onClick={() => setScreen('shop')}
                className="px-4 py-2 rounded-full border border-[#f0d5da] text-xs font-medium text-[#5c3d42] hover:border-[#9e5461] cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 12: TRACK MY ORDER */}
        {screen === 'track-order' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#9e5461] font-semibold">
                Real-Time Shipment &amp; Fulfilment Status
              </p>
              <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
                Track My Pretty Charm Order
              </h1>
              <p className="text-xs text-[#7c5c63] mt-1">
                For customer privacy, both your Order ID and the 10-digit recipient mobile number used at checkout are required.
              </p>
            </div>

            {savedOrders.length > 0 && (
              <div
                data-testid="track-saved-orders-list"
                className="rounded-2xl bg-[#fdf2f4] border border-[#e8c6ce] p-4 space-y-2.5"
              >
                <p className="text-xs font-semibold text-[#9e5461]">
                  Saved Orders on This Device (Accessible Anytime)
                </p>
                <div className="space-y-2">
                  {savedOrders.map((ord: any) => (
                    <div
                      key={ord.orderNumber}
                      className="rounded-xl bg-white border border-[#f0d5da] p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#2d1e21] font-tabular">
                          {ord.orderNumber} · {formatINR(ord.totalPaise)}
                        </p>
                        <p className="text-[11px] text-[#7c5c63]">
                          Status: {ord.orderStatus} · Payment: {ord.paymentStatus}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLastCreatedOrder(ord);
                            setScreen('order-success');
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#9e5461] text-white text-[11px] font-medium cursor-pointer"
                        >
                          Open Saved Order
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={handleTrackOrder}
              className="rounded-3xl bg-white border border-[#f0d5da] p-6 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#5c3d42] block mb-1">Order Number (e.g. PC-2026-1001)</label>
                  <input
                    name="orderNumber"
                    value={trackOrderForm.orderNumber}
                    onChange={(e) =>
                      setTrackOrderForm({ ...trackOrderForm, orderNumber: e.target.value })
                    }
                    placeholder="PC-2026-1001"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs font-tabular"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#5c3d42] block mb-1">
                    10-Digit Mobile Number
                  </label>
                  <input
                    name="mobile"
                    value={trackOrderForm.mobile}
                    onChange={(e) =>
                      setTrackOrderForm({ ...trackOrderForm, mobile: e.target.value })
                    }
                    placeholder="9876543210"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs font-tabular"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px bg-[#f0d5da] flex-1" />
                <span className="text-[11px] font-semibold text-[#7c5c63] uppercase tracking-wider">OR</span>
                <div className="h-px bg-[#f0d5da] flex-1" />
              </div>

              <div>
                <label className="text-xs text-[#5c3d42] block mb-1">
                  Secure Order Access Token (1-Click Guest Token)
                </label>
                <input
                  name="token"
                  value={(trackOrderForm as any).token || ''}
                  onChange={(e) =>
                    setTrackOrderForm({ ...trackOrderForm, token: e.target.value } as any)
                  }
                  placeholder="pc_tok_... (from your order success link or SMS)"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                data-testid="track-order-submit-btn"
                className="w-full py-2.5 px-5 rounded-xl bg-[#9e5461] text-white text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-[#84414d] transition"
              >
                Verify &amp; Track Order Status
              </button>
            </form>

            {trackOrderError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {trackOrderError}
              </div>
            )}

            {trackedOrderResult && (
              <div
                data-testid="tracked-order-card"
                className="rounded-3xl bg-white border border-[#f0d5da] p-6 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0d5da] pb-4">
                  <div>
                    <p className="text-xs text-[#7c5c63]">Order ID</p>
                    <p className="text-lg font-semibold text-[#2d1e21] font-tabular">
                      {trackedOrderResult.orderNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#9e5461] font-semibold">
                      Order Status: {trackedOrderResult.orderStatus}
                    </p>
                    <p className="text-xs text-[#7c5c63]">
                      Payment: {trackedOrderResult.paymentStatus}
                    </p>
                  </div>
                </div>

                {trackedOrderResult.whatsappOrderUrl && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-emerald-950 space-y-0.5">
                      <p className="font-semibold">Need to send or resend your order on WhatsApp?</p>
                      <p className="text-[11px] text-emerald-900">
                        Remember to press <strong>Send</strong> inside WhatsApp after opening the chat.
                      </p>
                    </div>
                    <a
                      href={trackedOrderResult.whatsappOrderUrl}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="tracked-order-whatsapp-btn"
                      className="px-4 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Order via WhatsApp</span>
                    </a>
                  </div>
                )}

                {/* Honest Delivery Estimate */}
                <div className="p-4 rounded-2xl bg-[#fdf2f4] border border-[#f0d5da] flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#2d1e21]">
                      Estimated Delivery
                    </p>
                    <p
                      data-testid="tracked-order-eta"
                      className="text-xs text-[#5c3d42] mt-0.5"
                    >
                      {trackedOrderResult.shipment?.estimatedDelivery ||
                        'Estimated delivery not available yet.'}
                    </p>
                  </div>
                  {trackedOrderResult.shipment?.awbNumber && (
                    <div className="text-right text-xs">
                      <p className="font-medium text-[#2d1e21]">
                        {trackedOrderResult.shipment.courierName}
                      </p>
                      <p className="font-tabular text-[#7c5c63]">
                        AWB: {trackedOrderResult.shipment.awbNumber}
                      </p>
                    </div>
                  )}
                </div>

                {/* Protected Customer & Shipping Address */}
                <div className="p-4 rounded-2xl bg-[#fffdfb] border border-[#f0d5da] space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[#7c5c63]">
                    <span>Protected Customer Details</span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      PII Protected
                    </span>
                  </div>
                  <p className="font-semibold text-[#2d1e21]">
                    {trackedOrderResult.customerName} · {trackedOrderResult.customerMobile}
                  </p>
                  <p className="text-[#5c3d42]">
                    {trackedOrderResult.shippingAddress?.maskedSummary ||
                      trackedOrderResult.shippingAddress?.maskedHouseFlat ||
                      (typeof trackedOrderResult.shippingAddress === 'string'
                        ? trackedOrderResult.shippingAddress
                        : `${trackedOrderResult.shippingAddress?.city}, ${trackedOrderResult.shippingAddress?.state} - ${trackedOrderResult.shippingAddress?.pincode}`)}
                  </p>
                  {trackedOrderResult.giftPersonalization && trackedOrderResult.giftPersonalization.isGift && (
                    <div className="pt-2 border-t border-[#f0d5da] text-[11px] text-[#9e5461]">
                      <span className="font-semibold">🎁 Gift: </span>
                      For {trackedOrderResult.giftPersonalization.recipientName || 'Recipient'} ({trackedOrderResult.giftPersonalization.occasion || 'Special Occasion'})
                    </div>
                  )}
                </div>

                {/* Authentic Timeline Events */}
                <div className="space-y-3">
                  <h3 className="font-serif text-lg font-semibold text-[#2d1e21]">
                    Verified Fulfilment Timeline
                  </h3>
                  <div className="space-y-2.5">
                    {(trackedOrderResult.statusHistory || []).map((ev: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between text-xs border-b border-[#f0d5da]/60 pb-2"
                      >
                        <div>
                          <p className="font-semibold text-[#2d1e21]">{ev.status}</p>
                          {ev.note && <p className="text-[#7c5c63]">{ev.note}</p>}
                        </div>
                        <span className="text-[11px] text-[#7c5c63] font-tabular">
                          {new Date(ev.timestamp).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 2: SIGN-UP / LOGIN SCREEN */}
        {screen === 'auth' && (
          <div className="max-w-md mx-auto rounded-3xl bg-white border border-[#f0d5da] p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-[#9e5461] font-semibold">
                Pretty Charm Member Club
              </p>
              <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
                {authMode === 'login' ? 'Welcome Back' : 'Create Your Account'}
              </h1>
              <p className="text-xs text-[#7c5c63]">
                Accounts are optional — you can always check out as a guest.
              </p>
            </div>

            <div className="grid grid-cols-2 rounded-full bg-[#fdf2f4] p-1 text-xs font-medium">
              <button
                onClick={() => setAuthMode('login')}
                className={`py-2 rounded-full transition-colors ${
                  authMode === 'login' ? 'bg-[#9e5461] text-white' : 'text-[#5c3d42]'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthMode('register')}
                className={`py-2 rounded-full transition-colors ${
                  authMode === 'register' ? 'bg-[#9e5461] text-white' : 'text-[#5c3d42]'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleCustomerAuth} className="space-y-3">
              {authMode === 'register' && (
                <div>
                  <label className="text-xs text-[#5c3d42] block mb-1">Full Name *</label>
                  <input
                    required
                    value={authForm.fullName}
                    onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-[#5c3d42] block mb-1">
                  10-Digit Mobile Number *
                </label>
                <input
                  required
                  maxLength={10}
                  value={authForm.mobile}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, mobile: e.target.value.replace(/\D/g, '') })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs font-tabular"
                />
              </div>
              {authMode === 'register' && (
                <div>
                  <label className="text-xs text-[#5c3d42] block mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-[#5c3d42] block mb-1">Password *</label>
                <input
                  required
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs"
                />
              </div>
              {authError && <p className="text-xs text-rose-700">{authError}</p>}
              <button
                type="submit"
                className="w-full py-3 rounded-full bg-[#9e5461] text-white text-xs font-medium"
              >
                {authMode === 'login' ? 'Sign In to Pretty Charm' : 'Register Account'}
              </button>
            </form>
          </div>
        )}

        {/* SCREEN 16, 17, 18: MY ACCOUNT, MY ORDERS, SAVED ADDRESSES */}
        {(screen === 'account' || screen === 'my-orders' || screen === 'saved-addresses') && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9e5461] font-semibold">
                  Customer Portal
                </p>
                <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
                  {customerUser ? `Hello, ${customerUser.fullName}` : 'My Account'}
                </h1>
              </div>
              {customerUser && (
                <button
                  onClick={() => {
                    sessionStorage.removeItem('pc_customer_token');
                    setCustomerToken('');
                    setCustomerUser(null);
                    setScreen('home');
                  }}
                  className="px-4 py-1.5 rounded-full border border-[#f0d5da] text-xs text-rose-700"
                >
                  Sign Out
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setScreen('account')}
                className={`px-4 py-2 rounded-full text-xs font-medium ${
                  screen === 'account'
                    ? 'bg-[#9e5461] text-white'
                    : 'bg-white border border-[#f0d5da]'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setScreen('my-orders')}
                className={`px-4 py-2 rounded-full text-xs font-medium ${
                  screen === 'my-orders'
                    ? 'bg-[#9e5461] text-white'
                    : 'bg-white border border-[#f0d5da]'
                }`}
              >
                My Orders ({customerOrders.length})
              </button>
              <button
                onClick={() => setScreen('saved-addresses')}
                className={`px-4 py-2 rounded-full text-xs font-medium ${
                  screen === 'saved-addresses'
                    ? 'bg-[#9e5461] text-white'
                    : 'bg-white border border-[#f0d5da]'
                }`}
              >
                Saved Addresses ({customerAddresses.length})
              </button>
            </div>

            {screen === 'account' && customerUser && (
              <div className="rounded-3xl bg-white border border-[#f0d5da] p-6 space-y-2 text-xs">
                <p>
                  <strong>Name:</strong> {customerUser.fullName}
                </p>
                <p>
                  <strong>Mobile:</strong> {customerUser.mobile}
                </p>
                {customerUser.email && (
                  <p>
                    <strong>Email:</strong> {customerUser.email}
                  </p>
                )}
              </div>
            )}

            {screen === 'my-orders' && (
              <div className="space-y-3">
                {customerOrders.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-[#f0d5da] p-8 text-center text-xs text-[#7c5c63]">
                    No orders placed under this account yet.
                  </div>
                ) : (
                  customerOrders.map((ord: any) => (
                    <div
                      key={ord.id}
                      className="rounded-2xl bg-white border border-[#f0d5da] p-4 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#2d1e21] font-tabular">
                          {ord.orderNumber}
                        </p>
                        <p className="text-[#7c5c63]">
                          Status: {ord.orderStatus} · Payment: {ord.paymentStatus}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold font-tabular">
                          {formatINR(ord.totalPaise)}
                        </p>
                        <button
                          onClick={() => {
                            setTrackOrderForm({
                              orderNumber: ord.orderNumber,
                              mobile: customerUser?.mobile || ''
                            });
                            setScreen('track-order');
                          }}
                          className="text-[#9e5461] underline mt-1"
                        >
                          Track Shipment
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {screen === 'saved-addresses' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {customerAddresses.map((addr: any) => (
                    <div
                      key={addr.id}
                      className="rounded-2xl bg-white border border-[#f0d5da] p-4 text-xs space-y-1"
                    >
                      <p className="font-semibold text-[#9e5461]">{addr.label}</p>
                      <p className="font-medium text-[#2d1e21]">
                        {addr.fullName} · {addr.mobile}
                      </p>
                      <p className="text-[#5c3d42]">
                        {addr.houseFlat}, {addr.streetLocality}
                      </p>
                      <p className="text-[#5c3d42]">
                        {addr.city}, {addr.state} — {addr.pincode}
                      </p>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleSaveAddress}
                  className="rounded-2xl bg-white border border-[#f0d5da] p-5 space-y-3"
                >
                  <h3 className="font-serif text-lg font-semibold">Add New Address</h3>
                  <input
                    required
                    placeholder="Recipient Full Name"
                    value={newAddressForm.fullName}
                    onChange={(e) =>
                      setNewAddressForm({ ...newAddressForm, fullName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs"
                  />
                  <input
                    required
                    maxLength={10}
                    placeholder="10-Digit Mobile"
                    value={newAddressForm.mobile}
                    onChange={(e) =>
                      setNewAddressForm({
                        ...newAddressForm,
                        mobile: e.target.value.replace(/\D/g, '')
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs font-tabular"
                  />
                  <input
                    required
                    placeholder="House / Flat / Building No. *"
                    value={newAddressForm.houseFlat}
                    onChange={(e) =>
                      setNewAddressForm({ ...newAddressForm, houseFlat: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      placeholder="Street / Road *"
                      value={newAddressForm.street}
                      onChange={(e) =>
                        setNewAddressForm({
                          ...newAddressForm,
                          street: e.target.value,
                          streetLocality: [e.target.value, newAddressForm.locality].filter(Boolean).join(', ')
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs"
                    />
                    <input
                      required
                      placeholder="Locality / Sector *"
                      value={newAddressForm.locality}
                      onChange={(e) =>
                        setNewAddressForm({
                          ...newAddressForm,
                          locality: e.target.value,
                          streetLocality: [newAddressForm.street, e.target.value].filter(Boolean).join(', ')
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs"
                    />
                  </div>
                  <input
                    placeholder="Landmark (Optional)"
                    value={newAddressForm.landmark}
                    onChange={(e) =>
                      setNewAddressForm({ ...newAddressForm, landmark: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      placeholder="City *"
                      value={newAddressForm.city}
                      onChange={(e) =>
                        setNewAddressForm({ ...newAddressForm, city: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs"
                    />
                    <input
                      required
                      placeholder="District *"
                      value={newAddressForm.district}
                      onChange={(e) =>
                        setNewAddressForm({ ...newAddressForm, district: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newAddressForm.state}
                      onChange={(e) =>
                        setNewAddressForm({ ...newAddressForm, state: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs bg-white"
                    >
                      {INDIAN_STATES_AND_UTS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <input
                      required
                      maxLength={6}
                      placeholder="6-Digit PIN Code *"
                      value={newAddressForm.pincode}
                      onChange={(e) =>
                        setNewAddressForm({
                          ...newAddressForm,
                          pincode: e.target.value.replace(/\D/g, '')
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#f0d5da] text-xs font-tabular"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-full bg-[#9e5461] text-white text-xs font-medium"
                  >
                    Save Address
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* INTERACTIVE 3D STUDIO SCREEN */}
        {screen === '3d-studio' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9e5461] font-semibold">
                  Interactive Spatial Preview
                </p>
                <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
                  3D Keepsake Box &amp; Accessory Inspector
                </h1>
              </div>
              <button
                onClick={() => setScreen('shop')}
                className="text-xs text-[#9e5461] font-medium hover:underline"
              >
                Return to Product Catalogue →
              </button>
            </div>
            <ThreeHamperViewer onClose={() => setScreen('home')} />
          </div>
        )}

        {/* SCREEN 13: ABOUT US */}
        {screen === 'about' && (
          <div className="max-w-3xl mx-auto rounded-3xl bg-white border border-[#f0d5da] p-8 space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#9e5461] font-semibold">
              Our Story · Gurugram, Haryana
            </p>
            <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
              About Pretty Charm
            </h1>
            <p className="text-sm text-[#5c3d42] leading-relaxed whitespace-pre-line">
              {policies.aboutUs ||
                'Pretty Charm is an Indian online store based in Gurugram, Haryana (122001), dedicated to thoughtfully packaged gift hampers, hair accessories, and anti-tarnish demifine jewellery.'}
            </p>
          </div>
        )}

        {/* SCREEN 14: CONTACT US */}
        {screen === 'contact' && (
          <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-3xl bg-white border border-[#f0d5da] p-6 space-y-4">
              <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
                Contact Our Studio
              </h1>
              <p className="text-xs text-[#5c3d42] leading-relaxed">
                Dispatched &amp; managed from Gurugram, Haryana (122001). Reach out for hamper customisation, bulk gifting, or order assistance.
              </p>
              <div className="space-y-2 text-xs text-[#2d1e21]">
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#9e5461]" />
                  <span>Gurugram, Haryana 122001, India</span>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#9e5461]" />
                  <span>{generalSettings.supportEmail || 'care@prettycharm.in'}</span>
                </p>
              </div>
              <a
                href={buildSafeWhatsAppUrl(
                  generalSettings.supportWhatsapp || '919876543210',
                  'support',
                  {}
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-700 text-white text-xs font-medium"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat on WhatsApp</span>
              </a>
            </div>

            <form
              onSubmit={handleContactSubmit}
              className="rounded-3xl bg-white border border-[#f0d5da] p-6 space-y-3"
            >
              <h2 className="font-serif text-xl font-semibold">Send an Inquiry</h2>
              <input
                required
                placeholder="Your Name"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs"
              />
              <input
                required
                type="email"
                placeholder="Email Address"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs"
              />
              <input
                placeholder="10-Digit Phone"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs font-tabular"
              />
              <textarea
                required
                rows={3}
                placeholder="How can we help you?"
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#f0d5da] text-xs"
              />
              {contactSuccess && <p className="text-xs text-emerald-800">{contactSuccess}</p>}
              <button
                type="submit"
                className="w-full py-2.5 rounded-full bg-[#9e5461] text-white text-xs font-medium"
              >
                Submit Inquiry
              </button>
            </form>
          </div>
        )}

        {/* SCREEN 15: FAQ */}
        {screen === 'faq' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
              Frequently Asked Questions
            </h1>
            <div className="space-y-3">
              {DEFAULT_FAQS.map((f) => (
                <div
                  key={f.id}
                  className="rounded-2xl bg-white border border-[#f0d5da] p-5 space-y-1.5"
                >
                  <h3 className="font-serif text-lg font-semibold text-[#2d1e21]">
                    {f.question}
                  </h3>
                  <p className="text-xs text-[#5c3d42] leading-relaxed">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCREENS 19, 20, 21, 22: POLICIES */}
        {(screen === 'shipping-policy' ||
          screen === 'return-policy' ||
          screen === 'privacy-policy' ||
          screen === 'terms') && (
          <div className="max-w-3xl mx-auto rounded-3xl bg-white border border-[#f0d5da] p-8 space-y-4">
            <h1 className="font-serif text-3xl text-[#2d1e21] font-semibold">
              {screen === 'shipping-policy' && 'Shipping Policy'}
              {screen === 'return-policy' && 'Return & Refund Policy'}
              {screen === 'privacy-policy' && 'Privacy Policy'}
              {screen === 'terms' && 'Terms & Conditions'}
            </h1>
            <p className="text-sm text-[#5c3d42] leading-relaxed whitespace-pre-line">
              {screen === 'shipping-policy' &&
                (policies.shippingPolicy ||
                  'Orders are dispatched from Gurugram, Haryana (122001). Shipping charges are ₹59 below ₹499, ₹39 from ₹499–₹998, and FREE on orders ₹999+.')}
              {screen === 'return-policy' &&
                (policies.returnRefundPolicy ||
                  'Damaged or incorrect items can be reported within 48 hours of delivery with an unboxing video for replacement or refund.')}
              {screen === 'privacy-policy' &&
                (policies.privacyPolicy ||
                  'We collect only essential contact and Indian shipping address details required to fulfil and track your order.')}
              {screen === 'terms' &&
                (policies.termsAndConditions ||
                  'All prices are listed in Indian Rupees (INR). Draft and Coming Soon products are non-purchasable until published by the store administrator.')}
            </p>
          </div>
        )}

        {/* SCREEN 23: CUSTOM 404 PAGE */}
        {screen === 'not-found' && (
          <div className="max-w-md mx-auto text-center py-16 space-y-4">
            <h1 className="font-serif text-4xl text-[#2d1e21] font-semibold">
              Page Not Found
            </h1>
            <p className="text-xs text-[#7c5c63]">
              The page or product you requested could not be found in the Pretty Charm store.
            </p>
            <button
              onClick={() => setScreen('home')}
              className="px-5 py-2.5 rounded-full bg-[#9e5461] text-white text-xs font-medium"
            >
              Back to Home
            </button>
          </div>
        )}
      </main>

      {/* K. Redesigned Footer with All Required Working Links */}
      <footer
        data-testid="site-footer"
        className="bg-[#faf4f5] border-t border-[#ebd7dc] mt-16 py-12 px-4 sm:px-6 text-xs text-[#5c3d42]"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1 space-y-2.5">
            <span className="font-serif text-2xl font-semibold text-[#2b1c20] block">
              Pretty Charm
            </span>
            <p className="text-[#6f5057] leading-relaxed">
              Curated gift hampers, satin hair accessories &amp; demifine jewellery dispatched pan-India from Gurugram, Haryana (122001).
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="font-semibold text-[#2b1c20] uppercase tracking-wider">
              Explore &amp; Care
            </p>
            <ul className="space-y-1.5">
              <li>
                <button
                  type="button"
                  onClick={() => setScreen('about')}
                  className="hover:text-[#9e5461] cursor-pointer"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setScreen('contact')}
                  className="hover:text-[#9e5461] cursor-pointer"
                >
                  Contact
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setScreen('faq')}
                  className="hover:text-[#9e5461] cursor-pointer"
                >
                  FAQ
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setScreen('track-order')}
                  className="hover:text-[#9e5461] cursor-pointer"
                >
                  Track My Order
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <p className="font-semibold text-[#2b1c20] uppercase tracking-wider">Policies</p>
            <ul className="space-y-1.5">
              <li>
                <button
                  type="button"
                  onClick={() => setScreen('shipping-policy')}
                  className="hover:text-[#9e5461] cursor-pointer"
                >
                  Shipping Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setScreen('return-policy')}
                  className="hover:text-[#9e5461] cursor-pointer"
                >
                  Returns and Refunds
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setScreen('privacy-policy')}
                  className="hover:text-[#9e5461] cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setScreen('terms')}
                  className="hover:text-[#9e5461] cursor-pointer"
                >
                  Terms and Conditions
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <p className="font-semibold text-[#2b1c20] uppercase tracking-wider">Connect</p>
            <ul className="space-y-1.5">
              <li>
                <a
                  href={buildInstagramProfileUrl(generalSettings.instagramHandle).url}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="footer-instagram-link"
                  className="hover:text-[#9e5461]"
                >
                  Instagram ({buildInstagramProfileUrl(generalSettings.instagramHandle).handle})
                </a>
              </li>
              {generalSettings.supportWhatsapp && (
                <li>
                  <a
                    href={buildSafeWhatsAppUrl(generalSettings.supportWhatsapp, 'support', {})}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="footer-whatsapp-link"
                    className="hover:text-[#9e5461]"
                  >
                    WhatsApp Support
                  </a>
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => setScreen('3d-studio')}
                  className="hover:text-[#9e5461] cursor-pointer"
                >
                  3D Hamper Studio
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setScreen('splash')}
                  className="hover:text-[#9e5461] cursor-pointer"
                >
                  Brand Welcome Screen
                </button>
              </li>
            </ul>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (Preserving Reference Layout for 360px-430px screens) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#f0d5da] h-16 grid grid-cols-5 items-center text-[10px] font-medium text-[#7c5c63]">
        <button
          onClick={() => setScreen('home')}
          className={`flex flex-col items-center gap-1 ${
            screen === 'home' ? 'text-[#9e5461] font-semibold' : ''
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>
        <button
          onClick={() => setScreen('categories')}
          className={`flex flex-col items-center gap-1 ${
            screen === 'categories' || screen === 'shop' ? 'text-[#9e5461] font-semibold' : ''
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Shop</span>
        </button>
        <button
          onClick={() => setScreen('cart')}
          className={`flex flex-col items-center gap-1 relative ${
            screen === 'cart' ? 'text-[#9e5461] font-semibold' : ''
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Bag ({hydratedCart.reduce((s, i) => s + i.quantity, 0)})</span>
        </button>
        <button
          onClick={() => setScreen('track-order')}
          className={`flex flex-col items-center gap-1 ${
            screen === 'track-order' ? 'text-[#9e5461] font-semibold' : ''
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Track</span>
        </button>
        <button
          onClick={() => setScreen(customerUser ? 'account' : 'auth')}
          className={`flex flex-col items-center gap-1 ${
            screen === 'account' || screen === 'auth' ? 'text-[#9e5461] font-semibold' : ''
          }`}
        >
          <User className="w-4 h-4" />
          <span>Account</span>
        </button>
      </nav>

      {/* Gemini AI Styling Concierge Modal */}
      <GeminiStudioModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </div>
  );
}

function ProductCard({
  product,
  categoryName,
  isWishlisted,
  onToggleWishlist,
  onSelect,
  onAddToCart
}: {
  product: any;
  categoryName: string;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  onSelect: () => void;
  onAddToCart: () => void;
}) {
  const isPurchasable = product.status === 'active' && product.availableQty > 0;

  return (
    <div
      data-testid={`product-card-${product.slug}`}
      className="group rounded-2xl bg-white border border-[#f0d5da] hover:border-[#9e5461] overflow-hidden flex flex-col justify-between transition-all shadow-2xs"
    >
      <div>
        <div className="relative aspect-4/3 bg-[#fdf2f4] overflow-hidden">
          <img
            src={product.images?.[0] || ARTWORK.heroBanner}
            alt={product.name}
            referrerPolicy="no-referrer"
            data-testid={`product-card-img-${product.slug}`}
            onClick={onSelect}
            className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
          />
          <button
            onClick={onToggleWishlist}
            aria-label="Save to Wishlist"
            className={`absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 shadow-2xs ${
              isWishlisted ? 'text-[#9e5461]' : 'text-[#7c5c63]'
            }`}
          >
            <Heart className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-1.5">
          {/* Plain typographical metadata with middot separator (Zero-Pill Discipline) */}
          <p className="text-[11px] text-[#9e5461] font-medium">
            {categoryName} ·{' '}
            {product.status === 'active'
              ? `${product.availableQty} in stock`
              : product.status === 'draft'
              ? 'Draft Preview'
              : product.status === 'coming-soon'
              ? 'Coming Soon'
              : 'Out of Stock'}
          </p>

          <h3
            onClick={onSelect}
            className="font-serif text-lg font-semibold text-[#2d1e21] cursor-pointer hover:text-[#9e5461] leading-snug"
          >
            {product.name}
          </h3>

          <p className="text-sm font-semibold text-[#2d1e21] font-tabular">
            {product.status === 'draft' ? 'Proposed ' : ''}
            {formatINR(product.sellingPricePaise)}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 pt-1">
        {isPurchasable ? (
          <button
            onClick={onAddToCart}
            data-testid={`add-to-cart-${product.slug}`}
            className="w-full py-2.5 px-4 rounded-full bg-[#9e5461] hover:bg-[#84414d] text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Add to Bag</span>
          </button>
        ) : (
          <button
            onClick={onSelect}
            data-testid={`non-purchasable-${product.slug}`}
            className="w-full py-2.5 px-4 rounded-full bg-[#fdf2f4] text-[#7c5c63] text-xs font-medium whitespace-nowrap"
          >
            {product.status === 'draft'
              ? 'Draft · Awaiting Admin Confirmation'
              : product.status === 'coming-soon'
              ? 'Coming Soon'
              : 'Out of Stock'}
          </button>
        )}
      </div>
    </div>
  );
}
