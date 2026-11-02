import React, { useState } from 'react';
import {
  Globe,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Calendar,
  MapPin,
  Save,
  Check,
  Eye,
  Smartphone,
  Monitor,
  Sparkles,
} from 'lucide-react';
import { SeoSettings, DEFAULT_SEO_SETTINGS, getBaseCanonicalUrl } from '../shared/seoConfig';

interface AdminSeoSettingsProps {
  products: any[];
  categories: any[];
  seoSettings: SeoSettings;
  onSaveSeoSettings: (newSettings: SeoSettings) => Promise<boolean>;
}

export const AdminSeoSettings: React.FC<AdminSeoSettingsProps> = ({
  products = [],
  categories = [],
  seoSettings = DEFAULT_SEO_SETTINGS,
  onSaveSeoSettings,
}) => {
  const [formData, setFormData] = useState<SeoSettings>({
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
  });

  const [activeSubTab, setActiveSubTab] = useState<
    'general' | 'categories' | 'products' | 'audit' | 'content-plan' | 'local-seo' | 'search-console'
  >('general');

  const [selectedProductSlug, setSelectedProductSlug] = useState<string>(
    products[0]?.slug || 'pretty-charm-mini-hamper'
  );
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>(
    categories[0]?.slug || 'gift-hampers'
  );
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('mobile');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const ok = await onSaveSeoSettings(formData);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const baseUrl = getBaseCanonicalUrl(formData.canonicalDomain);

  // SEO Health Audit Calculations
  const auditReport = React.useMemo(() => {
    const issues: Array<{ type: 'error' | 'warning' | 'pass'; title: string; desc: string }> = [];

    // Check homepage title
    if (!formData.metaTitle || formData.metaTitle.length < 30) {
      issues.push({
        type: 'warning',
        title: 'Homepage title is too short',
        desc: 'Recommended length is between 40 and 60 characters for maximum search visibility.',
      });
    } else {
      issues.push({
        type: 'pass',
        title: 'Homepage Title is well-optimized',
        desc: `${formData.metaTitle.length} characters (Optimal: 40-65 chars).`,
      });
    }

    // Check homepage description
    if (!formData.metaDescription || formData.metaDescription.length < 80) {
      issues.push({
        type: 'warning',
        title: 'Homepage Meta Description needs more detail',
        desc: 'Search descriptions perform best between 120 and 160 characters.',
      });
    } else {
      issues.push({
        type: 'pass',
        title: 'Homepage Meta Description length is optimal',
        desc: `${formData.metaDescription.length} characters (Optimal: 120-160 chars).`,
      });
    }

    // Check canonical domain
    if (!formData.canonicalDomain) {
      issues.push({
        type: 'warning',
        title: 'Production .store Canonical Domain Not Yet Set',
        desc: 'Currently using active origin. When your .store domain is linked, enter it here (e.g., https://prettycharm.store).',
      });
    } else {
      issues.push({
        type: 'pass',
        title: 'Canonical Domain Configured',
        desc: `Canonical URLs will point to ${formData.canonicalDomain}.`,
      });
    }

    // Products audit
    let productsMissingImages = 0;
    let productsMissingDesc = 0;
    let productsWithShortDesc = 0;

    products.forEach((p) => {
      if (!p.images || p.images.length === 0) productsMissingImages++;
      if (!p.description || p.description.trim().length === 0) productsMissingDesc++;
      else if (p.description.trim().length < 50) productsWithShortDesc++;
    });

    if (productsMissingImages > 0) {
      issues.push({
        type: 'error',
        title: `${productsMissingImages} product(s) missing images`,
        desc: 'Google Product rich results require at least one verified product photograph.',
      });
    } else {
      issues.push({
        type: 'pass',
        title: 'All products have verified primary images',
        desc: `All ${products.length} products meet Google Images specifications.`,
      });
    }

    if (productsMissingDesc > 0) {
      issues.push({
        type: 'error',
        title: `${productsMissingDesc} product(s) missing descriptions`,
        desc: 'Detailed product descriptions prevent duplicate content penalties and help rank for long-tail queries.',
      });
    } else if (productsWithShortDesc > 0) {
      issues.push({
        type: 'warning',
        title: `${productsWithShortDesc} product(s) have brief descriptions`,
        desc: 'Consider expanding product details with dimensions, materials, and gift box inclusions.',
      });
    } else {
      issues.push({
        type: 'pass',
        title: 'All products have comprehensive descriptions',
        desc: `All ${products.length} published products have detailed specifications.`,
      });
    }

    // GA4 Check
    if (!formData.gaMeasurementId) {
      issues.push({
        type: 'warning',
        title: 'Google Analytics 4 Measurement ID Not Configured',
        desc: 'Enter your GA4 Measurement ID (G-XXXXXXXXXX) to track page views and organic conversions.',
      });
    } else {
      issues.push({
        type: 'pass',
        title: 'Google Analytics 4 Integrated',
        desc: `Active measurement ID: ${formData.gaMeasurementId}.`,
      });
    }

    // GSC Check
    if (!formData.googleSiteVerification) {
      issues.push({
        type: 'warning',
        title: 'Google Search Console Verification Tag Not Set',
        desc: 'Add your verification token or use DNS TXT record to verify ownership in Search Console.',
      });
    } else {
      issues.push({
        type: 'pass',
        title: 'Search Console Verification Tag Active',
        desc: 'Verification meta tag is inserted in document head.',
      });
    }

    return issues;
  }, [formData, products]);

  // Selected product data for live SERP snippet preview
  const currentAuditedProduct = products.find((p) => p.slug === selectedProductSlug) || products[0];
  const customProductSeo = currentAuditedProduct
    ? formData.productSeo[currentAuditedProduct.slug] || {}
    : {};
  const currentSerpTitle =
    customProductSeo.title || (currentAuditedProduct ? `${currentAuditedProduct.name} | Pretty Charm` : '');
  const currentSerpDesc =
    customProductSeo.description ||
    (currentAuditedProduct?.description
      ? currentAuditedProduct.description.slice(0, 155) + '...'
      : formData.metaDescription);
  const currentSerpUrl = currentAuditedProduct ? `${baseUrl}/product/${currentAuditedProduct.slug}` : baseUrl;

  // Selected category data
  const currentAuditedCategory =
    categories.find((c) => c.slug === selectedCategorySlug) || categories[0];
  const customCategorySeo = currentAuditedCategory
    ? formData.categorySeo[currentAuditedCategory.slug] || {}
    : {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e4b7c0]">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#9e5461]" />
            <h2 className="text-xl font-bold text-[#2d1e22]">E-Commerce SEO & Google Visibility</h2>
          </div>
          <p className="text-xs text-[#7a3b47] mt-1">
            Production-grade metadata, Google rich snippets (JSON-LD), sitemap, and organic search settings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 animate-fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>SEO Settings Saved!</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#9e5461] text-white text-xs font-semibold hover:bg-[#83424e] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save All SEO Settings'}</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#f0d5da]">
        {[
          { id: 'general', label: '1. Store & Homepage SEO' },
          { id: 'categories', label: '2. Category SEO' },
          { id: 'products', label: '3. Product SEO & SERP Preview' },
          { id: 'audit', label: '4. SEO Health Audit' },
          { id: 'search-console', label: '5. Google Search Console & DNS' },
          { id: 'local-seo', label: '6. Local SEO (Gurugram)' },
          { id: 'content-plan', label: '7. 30-Day Content Strategy' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeSubTab === tab.id
                ? 'bg-[#9e5461] text-white'
                : 'text-[#5c4349] hover:bg-[#fce9ee] bg-white border border-[#f0d5da]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBTAB 1: GENERAL & HOMEPAGE SEO */}
      {activeSubTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-5 bg-white p-6 rounded-2xl border border-[#f0d5da]">
            <h3 className="text-sm font-semibold text-[#2d1e21] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#9e5461]" />
              <span>Homepage Meta Tags & Canonical Domain</span>
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-[#2d1e21]">
                    Homepage Meta Title (Tag)
                  </label>
                  <span
                    className={`text-[11px] ${
                      formData.metaTitle.length > 65
                        ? 'text-rose-600 font-semibold'
                        : 'text-[#7a3b47]'
                    }`}
                  >
                    {formData.metaTitle.length}/65 characters
                  </span>
                </div>
                <input
                  type="text"
                  value={formData.metaTitle}
                  onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                  placeholder="Pretty Charm | Gift Hampers, Jewellery & Hair Accessories Online India"
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                />
                <p className="text-[11px] text-[#7a3b47] mt-1">
                  Appears as the blue clickable headline in Google search results and browser tabs.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-[#2d1e21]">
                    Homepage Meta Description
                  </label>
                  <span
                    className={`text-[11px] ${
                      formData.metaDescription.length > 160
                        ? 'text-rose-600 font-semibold'
                        : 'text-[#7a3b47]'
                    }`}
                  >
                    {formData.metaDescription.length}/160 characters
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={formData.metaDescription}
                  onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                  placeholder="Discover beautiful gift hampers, stylish jewellery and hair accessories at Pretty Charm..."
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461] leading-relaxed"
                />
                <p className="text-[11px] text-[#7a3b47] mt-1">
                  Summarizes the website for search engines and encourages clicks from potential shoppers.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#2d1e21] mb-1">
                  Production Canonical Domain (.store)
                </label>
                <input
                  type="text"
                  value={formData.canonicalDomain}
                  onChange={(e) => setFormData({ ...formData, canonicalDomain: e.target.value })}
                  placeholder="https://prettycharm.store"
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                />
                <p className="text-[11px] text-[#7a3b47] mt-1">
                  Enter your verified <code className="bg-[#fce9ee] px-1 py-0.5 rounded">.store</code> domain once connected to Vercel/hosting. Leave blank to automatically use the current deployment URL.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#2d1e21] mb-1">
                  Social Sharing Image (Open Graph Image)
                </label>
                <input
                  type="text"
                  value={formData.socialShareImage}
                  onChange={(e) => setFormData({ ...formData, socialShareImage: e.target.value })}
                  placeholder="/uploads/products/prod-mini-hamper.jpg"
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                />
                <p className="text-[11px] text-[#7a3b47] mt-1">
                  Preview thumbnail shown when sharing your store link on WhatsApp, Instagram, Facebook, and Twitter.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-[#2d1e21] mb-1">
                    Google Analytics 4 Measurement ID
                  </label>
                  <input
                    type="text"
                    value={formData.gaMeasurementId}
                    onChange={(e) => setFormData({ ...formData, gaMeasurementId: e.target.value })}
                    placeholder="G-XXXXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2d1e21] mb-1">
                    Google Search Console Verification Tag
                  </label>
                  <input
                    type="text"
                    value={formData.googleSiteVerification}
                    onChange={(e) =>
                      setFormData({ ...formData, googleSiteVerification: e.target.value })
                    }
                    placeholder="abc123XYZ_sampleVerificationCode"
                    className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Homepage SERP Live Preview */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-[#f0d5da] space-y-3">
              <h4 className="text-xs font-semibold text-[#2d1e21] uppercase tracking-wider">
                Google Search Snippet Preview
              </h4>
              <div className="p-4 rounded-xl bg-[#f8f9fa] border border-[#e9ecef] space-y-1 text-left">
                <div className="flex items-center gap-1.5 text-xs text-[#202124]">
                  <span className="w-4 h-4 rounded-full bg-[#fce9ee] text-[#9e5461] flex items-center justify-center font-bold text-[10px]">
                    P
                  </span>
                  <div className="truncate text-[12px] leading-tight">
                    <span className="font-semibold text-[#202124]">Pretty Charm</span>
                    <span className="text-[#5f6368] block text-[11px] truncate">{baseUrl}</span>
                  </div>
                </div>
                <h5 className="text-base text-[#1a0dab] font-medium hover:underline cursor-pointer leading-snug pt-1">
                  {formData.metaTitle || 'Pretty Charm | Gift Hampers, Jewellery & Hair Accessories Online India'}
                </h5>
                <p className="text-xs text-[#4d5156] line-clamp-2 leading-relaxed">
                  {formData.metaDescription || 'Discover beautiful gift hampers, stylish jewellery and hair accessories at Pretty Charm...'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#fdf2f4] border border-[#f0d5da] text-[11px] text-[#7a3b47] space-y-1">
                <p className="font-semibold text-[#2d1e21]">Direct Technical Endpoints:</p>
                <div className="flex items-center justify-between">
                  <span>XML Sitemap:</span>
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#9e5461] hover:underline flex items-center gap-1 font-mono"
                  >
                    /sitemap.xml <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span>Robots.txt:</span>
                  <a
                    href="/robots.txt"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#9e5461] hover:underline flex items-center gap-1 font-mono"
                  >
                    /robots.txt <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: CATEGORY SEO */}
      {activeSubTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7a3b47]">
              Select Category to Optimize
            </h3>
            <div className="space-y-1.5">
              {categories.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setSelectedCategorySlug(c.slug)}
                  className={`w-full p-3 rounded-xl text-left text-xs transition-all flex items-center justify-between border cursor-pointer ${
                    selectedCategorySlug === c.slug
                      ? 'bg-[#9e5461] text-white border-[#9e5461]'
                      : 'bg-white text-[#2d1e21] border-[#f0d5da] hover:bg-[#fdf2f4]'
                  }`}
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-[11px] opacity-75">/{c.slug}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-[#f0d5da] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0d5da]">
              <div>
                <h4 className="text-sm font-bold text-[#2d1e21]">
                  SEO Settings for: {currentAuditedCategory?.name}
                </h4>
                <p className="text-xs text-[#7a3b47]">
                  Canonical Route: <code className="bg-[#fce9ee] px-1 py-0.5 rounded font-mono">/category/{currentAuditedCategory?.slug}</code>
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#fdf2f4] text-[#9e5461] font-semibold border border-[#f0d5da]">
                Schema: CollectionPage
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#2d1e21] mb-1">
                  Category Meta Title
                </label>
                <input
                  type="text"
                  value={customCategorySeo.title || ''}
                  onChange={(e) => {
                    const next = { ...formData.categorySeo };
                    next[selectedCategorySlug] = {
                      ...(next[selectedCategorySlug] || {}),
                      title: e.target.value,
                    };
                    setFormData({ ...formData, categorySeo: next });
                  }}
                  placeholder={`${currentAuditedCategory?.name} Online India | Pretty Charm`}
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#2d1e21] mb-1">
                  Category Meta Description
                </label>
                <textarea
                  rows={2}
                  value={customCategorySeo.description || ''}
                  onChange={(e) => {
                    const next = { ...formData.categorySeo };
                    next[selectedCategorySlug] = {
                      ...(next[selectedCategorySlug] || {}),
                      description: e.target.value,
                    };
                    setFormData({ ...formData, categorySeo: next });
                  }}
                  placeholder={currentAuditedCategory?.description || 'Browse curated gifts...'}
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#2d1e21] mb-1">
                  Target SEO Keyword Themes
                </label>
                <input
                  type="text"
                  value={customCategorySeo.keywords || ''}
                  onChange={(e) => {
                    const next = { ...formData.categorySeo };
                    next[selectedCategorySlug] = {
                      ...(next[selectedCategorySlug] || {}),
                      keywords: e.target.value,
                    };
                    setFormData({ ...formData, categorySeo: next });
                  }}
                  placeholder="Gift Hampers Online India, Birthday Gift Hampers, Curated Gift Boxes"
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                />
              </div>

              {/* Category Live SERP Preview */}
              <div className="pt-3">
                <p className="text-xs font-semibold text-[#7a3b47] uppercase tracking-wider mb-2">
                  Category Search Snippet Preview
                </p>
                <div className="p-3.5 rounded-xl bg-[#f8f9fa] border border-[#e9ecef] space-y-1 text-left">
                  <span className="text-[11px] text-[#5f6368] block truncate">
                    {baseUrl} &gt; category &gt; {currentAuditedCategory?.slug}
                  </span>
                  <h5 className="text-sm text-[#1a0dab] font-medium hover:underline cursor-pointer">
                    {customCategorySeo.title || `${currentAuditedCategory?.name} Online India | Pretty Charm`}
                  </h5>
                  <p className="text-xs text-[#4d5156] line-clamp-2">
                    {customCategorySeo.description || currentAuditedCategory?.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: PRODUCT SEO & LIVE SERP PREVIEW */}
      {activeSubTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7a3b47]">
              Select Product ({products.length} Published)
            </h3>
            <div className="space-y-1.5 max-h-[550px] overflow-y-auto pr-1">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProductSlug(p.slug)}
                  className={`w-full p-2.5 rounded-xl text-left text-xs transition-all flex items-center gap-2.5 border cursor-pointer ${
                    selectedProductSlug === p.slug
                      ? 'bg-[#9e5461] text-white border-[#9e5461]'
                      : 'bg-white text-[#2d1e21] border-[#f0d5da] hover:bg-[#fdf2f4]'
                  }`}
                >
                  <img
                    src={p.images?.[0] || '/uploads/products/prod-mini-hamper.jpg'}
                    alt={p.name}
                    className="w-9 h-9 rounded-lg object-cover shrink-0 border border-white/20"
                  />
                  <div className="truncate">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-[11px] opacity-80">₹{(p.sellingPricePaise / 100).toFixed(0)} · SKU: {p.sku}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-5 bg-white p-6 rounded-2xl border border-[#f0d5da]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#f0d5da]">
              <div>
                <h4 className="text-sm font-bold text-[#2d1e21]">
                  Product SEO: {currentAuditedProduct?.name}
                </h4>
                <p className="text-xs text-[#7a3b47]">
                  Canonical Route:{' '}
                  <code className="bg-[#fce9ee] px-1 py-0.5 rounded font-mono">
                    /product/{currentAuditedProduct?.slug}
                  </code>
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-[#fdf2f4] p-1 rounded-xl border border-[#f0d5da]">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer ${
                    previewDevice === 'mobile'
                      ? 'bg-[#9e5461] text-white font-medium'
                      : 'text-[#7a3b47] hover:bg-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer ${
                    previewDevice === 'desktop'
                      ? 'bg-[#9e5461] text-white font-medium'
                      : 'text-[#7a3b47] hover:bg-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
              </div>
            </div>

            {/* Live SERP Snippet Preview */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#7a3b47] uppercase tracking-wider">
                Google Search Rich Snippet Preview ({previewDevice === 'mobile' ? 'Mobile' : 'Desktop'})
              </span>

              <div
                className={`p-4 rounded-xl bg-[#f8f9fa] border border-[#e9ecef] space-y-1.5 ${
                  previewDevice === 'mobile' ? 'max-w-md' : 'w-full'
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-[#202124]">
                  <span className="w-4 h-4 rounded-full bg-[#fce9ee] text-[#9e5461] flex items-center justify-center font-bold text-[10px]">
                    P
                  </span>
                  <div className="truncate text-[12px] leading-tight">
                    <span className="font-semibold text-[#202124]">Pretty Charm</span>
                    <span className="text-[#5f6368] block text-[11px] truncate">
                      {baseUrl} &gt; product &gt; {currentAuditedProduct?.slug}
                    </span>
                  </div>
                </div>

                <h5 className="text-base text-[#1a0dab] font-medium hover:underline cursor-pointer leading-snug">
                  {currentSerpTitle}
                </h5>

                {/* Rich snippet attributes */}
                <div className="flex items-center gap-2 text-xs text-[#4d5156] font-medium pt-0.5">
                  <span className="text-emerald-700 font-semibold">
                    ₹{((currentAuditedProduct?.sellingPricePaise || 0) / 100).toFixed(2)}
                  </span>
                  <span>·</span>
                  <span className="text-emerald-700">In stock</span>
                  <span>·</span>
                  <span>Brand: Pretty Charm</span>
                </div>

                <p className="text-xs text-[#4d5156] line-clamp-2 leading-relaxed">
                  {currentSerpDesc}
                </p>
              </div>
            </div>

            {/* Custom SEO Fields for Product */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-[#2d1e21] mb-1">
                  Custom Product Title Override (Leave blank to use default: "{currentAuditedProduct?.name} | Pretty Charm")
                </label>
                <input
                  type="text"
                  value={customProductSeo.title || ''}
                  onChange={(e) => {
                    const next = { ...formData.productSeo };
                    next[selectedProductSlug] = {
                      ...(next[selectedProductSlug] || {}),
                      title: e.target.value,
                    };
                    setFormData({ ...formData, productSeo: next });
                  }}
                  placeholder={`${currentAuditedProduct?.name} | Pretty Charm`}
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#2d1e21] mb-1">
                  Custom Meta Description Override
                </label>
                <textarea
                  rows={2}
                  value={customProductSeo.description || ''}
                  onChange={(e) => {
                    const next = { ...formData.productSeo };
                    next[selectedProductSlug] = {
                      ...(next[selectedProductSlug] || {}),
                      description: e.target.value,
                    };
                    setFormData({ ...formData, productSeo: next });
                  }}
                  placeholder={currentAuditedProduct?.description || 'Product details...'}
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#2d1e21] mb-1">
                  Descriptive Image Alt Text
                </label>
                <input
                  type="text"
                  value={
                    customProductSeo.altText ||
                    `${currentAuditedProduct?.name} - Curated Pretty Charm ${currentAuditedProduct?.categorySlug}`
                  }
                  onChange={(e) => {
                    const next = { ...formData.productSeo };
                    next[selectedProductSlug] = {
                      ...(next[selectedProductSlug] || {}),
                      altText: e.target.value,
                    };
                    setFormData({ ...formData, productSeo: next });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#fffdfb] border border-[#e4b7c0] text-xs text-[#2d1e21] focus:outline-none focus:border-[#9e5461]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: SEO HEALTH AUDIT */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-[#f0d5da] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0d5da]">
              <div>
                <h3 className="text-sm font-bold text-[#2d1e21]">
                  Automated Technical SEO Health Audit
                </h3>
                <p className="text-xs text-[#7a3b47]">
                  Evaluates meta tags, schema readiness, canonical configuration, and content completeness.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                Lighthouse & Schema Ready
              </span>
            </div>

            <div className="space-y-2.5">
              {auditReport.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    item.type === 'pass'
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : item.type === 'warning'
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                      : 'bg-rose-50/70 border-rose-200 text-rose-900'
                  }`}
                >
                  {item.type === 'pass' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : item.type === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h5 className="text-xs font-bold">{item.title}</h5>
                    <p className="text-[11px] opacity-90 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: SEARCH CONSOLE & DNS GUIDELINES */}
      {activeSubTab === 'search-console' && (
        <div className="bg-white p-6 rounded-2xl border border-[#f0d5da] space-y-6">
          <div>
            <h3 className="text-sm font-bold text-[#2d1e21] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#9e5461]" />
              <span>Google Search Console Setup & DNS Instructions for .store Domain</span>
            </h3>
            <p className="text-xs text-[#7a3b47] mt-1">
              Follow these steps once you purchase or connect your custom domain (e.g. <code className="bg-[#fce9ee] px-1 py-0.5 rounded">prettycharm.store</code>).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#fffdfb] border border-[#f0d5da] space-y-2.5">
              <span className="text-xs font-bold text-[#9e5461] uppercase tracking-wider block">
                Step 1: Connect .store Domain in Hosting / Vercel
              </span>
              <p className="text-xs text-[#5c3d42] leading-relaxed">
                In your domain registrar (GoDaddy, Namecheap, Hostinger, etc.), configure DNS records pointing to your host:
              </p>
              <div className="p-3 bg-[#fdf2f4] rounded-lg font-mono text-xs text-[#2d1e21] space-y-1">
                <p><strong>A Record:</strong> @ &rarr; 76.76.21.21</p>
                <p><strong>CNAME Record:</strong> www &rarr; cname.vercel-dns.com</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#fffdfb] border border-[#f0d5da] space-y-2.5">
              <span className="text-xs font-bold text-[#9e5461] uppercase tracking-wider block">
                Step 2: Google Search Console Domain Verification
              </span>
              <p className="text-xs text-[#5c3d42] leading-relaxed">
                Add a DNS TXT Record in your registrar to verify complete domain ownership:
              </p>
              <div className="p-3 bg-[#fdf2f4] rounded-lg font-mono text-xs text-[#2d1e21] space-y-1">
                <p><strong>Type:</strong> TXT</p>
                <p><strong>Host / Name:</strong> @</p>
                <p><strong>Value:</strong> google-site-verification=YOUR_CODE</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#fdf2f4] border border-[#f0d5da] space-y-2">
            <h4 className="text-xs font-bold text-[#2d1e21]">Step 3: Submit XML Sitemap in Search Console</h4>
            <p className="text-xs text-[#5c3d42]">
              After domain ownership is confirmed, submit the auto-generated XML sitemap URL:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${baseUrl}/sitemap.xml`}
                className="w-full max-w-md px-3 py-1.5 rounded-lg bg-white border border-[#e4b7c0] text-xs font-mono text-[#2d1e21]"
              />
              <button
                type="button"
                onClick={() => handleCopy(`${baseUrl}/sitemap.xml`, 'sitemap')}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#e4b7c0] text-xs font-semibold text-[#7a3b47] hover:bg-[#fce9ee] flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'sitemap' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'sitemap' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 6: LOCAL SEO (GURUGRAM) */}
      {activeSubTab === 'local-seo' && (
        <div className="bg-white p-6 rounded-2xl border border-[#f0d5da] space-y-5">
          <div>
            <h3 className="text-sm font-bold text-[#2d1e21] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#9e5461]" />
              <span>Local SEO Strategy — Operating from Gurugram, Haryana</span>
            </h3>
            <p className="text-xs text-[#7a3b47] mt-1">
              Best practices for e-commerce local relevance without publishing private residential addresses or creating fake storefront locations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#fffdfb] border border-[#f0d5da] space-y-2">
              <h4 className="text-xs font-bold text-[#9e5461] uppercase tracking-wider">
                Google Business Profile (Service-Area Business)
              </h4>
              <ul className="text-xs text-[#5c3d42] space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>Register as a <strong>Service-Area Business (SAB)</strong> in Gurugram, Haryana.</li>
                <li>Set primary category to <strong>Gift Basket Store</strong> or <strong>Jewelry Store</strong>.</li>
                <li>Hide residential address if dispatching from home studio; display service area as Delhi NCR & Pan-India.</li>
                <li>Link directly to your official website (<code className="bg-[#fce9ee] px-1 py-0.5 rounded font-mono">https://prettycharm.store</code>).</li>
                <li>Add verified customer WhatsApp support number.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-[#fffdfb] border border-[#f0d5da] space-y-2">
              <h4 className="text-xs font-bold text-[#9e5461] uppercase tracking-wider">
                On-Page Gurugram Relevance
              </h4>
              <ul className="text-xs text-[#5c3d42] space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>Schema.org JSON-LD contains verified postal code <code className="bg-[#fce9ee] px-1 py-0.5 rounded font-mono">122001</code> and Gurugram origin.</li>
                <li>Delivery notice states: <em>"Dispatched from Gurugram (122001), Haryana"</em>.</li>
                <li>Pan-India courier dispatch with fast 1-2 day delivery across Delhi NCR.</li>
                <li>Transparent customer care email: <code className="bg-[#fce9ee] px-1 py-0.5 rounded font-mono">support@prettycharm.in</code>.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 7: 30-DAY CONTENT STRATEGY */}
      {activeSubTab === 'content-plan' && (
        <div className="bg-white p-6 rounded-2xl border border-[#f0d5da] space-y-5">
          <div>
            <h3 className="text-sm font-bold text-[#2d1e21] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#9e5461]" />
              <span>30-Day E-Commerce SEO Content & Keyword Strategy</span>
            </h3>
            <p className="text-xs text-[#7a3b47] mt-1">
              High-intent blog articles, gifting guides, and product knowledge pieces to capture organic search traffic across India.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                week: 'Week 1: Birthday & Bestie Gifting (High Purchase Intent)',
                items: [
                  {
                    day: 'Day 1-2',
                    title: '10 Thoughtful Birthday Gift Hampers Under ₹500 for Her',
                    keyword: 'Birthday Gift Hampers Under 500',
                    target: '/category/gift-hampers',
                  },
                  {
                    day: 'Day 3-4',
                    title: 'What to Put in a Bestie Care Package: Cute Aesthetic Gifting Ideas',
                    keyword: 'Bestie Gift Hamper Ideas',
                    target: '/product/pretty-charm-bestie-box',
                  },
                  {
                    day: 'Day 5-7',
                    title: 'The Ultimate Guide to Choosing the Perfect Keepsake Gift Box',
                    keyword: 'Curated Gift Boxes India',
                    target: '/category/gift-hampers',
                  },
                ],
              },
              {
                week: 'Week 2: Hair Care & Accessories Styling Guides',
                items: [
                  {
                    day: 'Day 8-10',
                    title: 'Why Mulberry Silk Scrunchies Are the Secret to Frizz-Free Hair',
                    keyword: 'Mulberry Silk Scrunchies Benefits',
                    target: '/product/mulberry-silk-scrunchie-trio',
                  },
                  {
                    day: 'Day 11-13',
                    title: '5 Easy Elegant Hairstyles Using a Pearl Hair Claw',
                    keyword: 'Pearl Hair Claw Hairstyles',
                    target: '/product/rose-gold-pearl-hair-claw',
                  },
                  {
                    day: 'Day 14-15',
                    title: 'Hair Bows Trend: How to Style Satin Bow Barrettes for Parties',
                    keyword: 'Satin Bow Barrette Styling',
                    target: '/product/blush-satin-pearl-bow-barrette',
                  },
                ],
              },
              {
                week: 'Week 3: Anti-Tarnish Jewellery Care & Everyday Elegance',
                items: [
                  {
                    day: 'Day 16-18',
                    title: 'What Does Anti-Tarnish Jewellery Mean? Complete Care Guide',
                    keyword: 'Anti Tarnish Jewellery India',
                    target: '/category/jewellery',
                  },
                  {
                    day: 'Day 19-21',
                    title: 'How to Layer Dainty Necklaces Without Tangling: Stylist Tips',
                    keyword: 'Layered Necklace Styling Guide',
                    target: '/product/blush-quartz-layered-necklace',
                  },
                  {
                    day: 'Day 22-23',
                    title: 'Hypoallergenic Pearl Drop Huggies for Sensitive Ears',
                    keyword: 'Hypoallergenic Pearl Huggies',
                    target: '/product/rose-gold-pearl-drop-huggies',
                  },
                ],
              },
              {
                week: 'Week 4: Festive & Celebration Gifting Preparations',
                items: [
                  {
                    day: 'Day 24-26',
                    title: 'Traditional vs Modern Festive Hampers: Aesthetic Gifting Trends',
                    keyword: 'Festive Gift Hampers Online',
                    target: '/category/festive-collection',
                  },
                  {
                    day: 'Day 27-28',
                    title: 'Budget-Friendly Corporate & Bridesmaid Gifting in Delhi NCR',
                    keyword: 'Bridesmaid Gift Hampers Gurugram',
                    target: '/category/gift-hampers',
                  },
                  {
                    day: 'Day 29-30',
                    title: 'Handmade Packaging & Gift Unboxing: Why Presentation Matters',
                    keyword: 'Aesthetic Gift Packaging India',
                    target: '/about',
                  },
                ],
              },
            ].map((section, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-[#f0d5da] bg-[#fffdfb] space-y-2.5">
                <h4 className="text-xs font-bold text-[#9e5461] uppercase tracking-wider">
                  {section.week}
                </h4>
                <div className="space-y-2">
                  {section.items.map((post, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-2.5 rounded-lg bg-white border border-[#f0d5da] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-[#2d1e21]">{post.title}</span>
                        <div className="flex items-center gap-2 text-[11px] text-[#7a3b47] mt-0.5">
                          <span className="bg-[#fdf2f4] px-1.5 py-0.5 rounded font-medium">
                            {post.day}
                          </span>
                          <span>Target Keyword: <strong>{post.keyword}</strong></span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-[#9e5461] shrink-0">
                        Links to: {post.target}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
