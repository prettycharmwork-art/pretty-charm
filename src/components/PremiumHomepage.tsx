import React from 'react';
import {
  Heart,
  ShoppingBag,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import {
  formatINR,
  getHomepageFeaturedProducts,
  getHomepageGiftHampers,
  getVerifiedWhyShopBenefits,
  buildInstagramProfileUrl,
  ShippingRuleConfig,
} from '../shared/domainLogic';
import { ARTWORK } from '../assets/productArtwork';

export interface PremiumHomepageProps {
  categories: any[];
  products: any[];
  wishlist: string[];
  recentlyViewed: string[];
  generalSettings: Record<string, any>;
  shippingRules: ShippingRuleConfig;
  categoryNameMap: Map<string, string>;
  onShopCategory: (categorySlug: string) => void;
  onViewAllCategories: () => void;
  onSelectProduct: (product: any) => void;
  onAddToCart: (product: any) => void;
  onToggleWishlist: (productId: string) => void;
}

export const PremiumHomepage: React.FC<PremiumHomepageProps> = ({
  categories,
  products,
  wishlist,
  recentlyViewed,
  generalSettings,
  shippingRules,
  categoryNameMap,
  onShopCategory,
  onViewAllCategories,
  onSelectProduct,
  onAddToCart,
  onToggleWishlist,
}) => {
  const featuredProducts = getHomepageFeaturedProducts(products);
  const giftHampers = getHomepageGiftHampers(products);
  const whyShopBenefits = getVerifiedWhyShopBenefits(generalSettings, shippingRules);
  const instagram = buildInstagramProfileUrl(generalSettings?.instagramHandle);

  // Pick real available products from the database for the editorial Hero showcase
  const heroPrimaryProduct =
    featuredProducts.find((p) => p.id === 'prod-pearl-claw') || featuredProducts[0] || null;
  const heroSecondaryProduct =
    featuredProducts.find((p) => p.id === 'prod-pearl-drop-huggies') ||
    featuredProducts[1] ||
    null;
  const heroTertiaryProduct =
    featuredProducts.find((p) => p.id === 'prod-silk-scrunchie-trio') ||
    featuredProducts[2] ||
    null;

  // Map each category to its verified high-resolution photograph or graceful fallback
  const getCategoryCardImage = (cat: any): string => {
    if (cat.imageUrl && !cat.imageUrl.startsWith('data:image/svg')) {
      return cat.imageUrl;
    }
    if (cat.slug === 'hair-accessories') {
      const hairProd = featuredProducts.find((p) => p.categorySlug === 'hair-accessories');
      if (hairProd?.images?.[0]) return hairProd.images[0];
    }
    if (cat.slug === 'jewellery') {
      const jwlProd = featuredProducts.find((p) => p.categorySlug === 'jewellery');
      if (jwlProd?.images?.[0]) return jwlProd.images[0];
    }
    return cat.imageUrl || ARTWORK.heroBanner;
  };

  return (
    <div className="space-y-16 sm:space-y-24 pb-8" data-testid="premium-homepage">
      {/* =================================================================== */}
      {/* C. PREMIUM EDITORIAL HERO SECTION                                   */}
      {/* =================================================================== */}
      <section
        data-testid="homepage-hero-section"
        className="rounded-3xl bg-[#faf5f2] border border-[#ebd7dc] overflow-hidden"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
          {/* Left Editorial Column */}
          <div className="lg:col-span-6 p-6 sm:p-10 lg:p-14 space-y-6">
            <p className="text-xs tracking-[0.18em] uppercase text-[#9e5461] font-medium">
              Pretty Charm · Gift Hampers, Hair Accessories &amp; Jewellery
            </p>

            <h1
              data-testid="hero-headline"
              className="font-serif text-4xl sm:text-5xl lg:text-[54px] text-[#2b1c20] font-semibold leading-[1.08] tracking-tight"
            >
              Little Things. Beautiful Moments.
            </h1>

            <p
              data-testid="hero-supporting-text"
              className="text-sm sm:text-base text-[#5c4046] max-w-lg leading-relaxed"
            >
              Thoughtfully chosen gifts and pretty essentials for moments worth celebrating.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                data-testid="hero-primary-cta"
                onClick={() => onShopCategory('gift-hampers')}
                className="px-6 py-3.5 rounded-full bg-[#9e5461] hover:bg-[#85424e] text-white text-sm font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <span>Shop Gift Hampers</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                data-testid="hero-secondary-cta"
                onClick={() => onShopCategory('hair-accessories')}
                className="px-6 py-3.5 rounded-full bg-[#fffdfb] hover:bg-[#f7e8ec] text-[#2b1c20] border border-[#dfc1c8] text-sm font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <span>Explore Accessories</span>
              </button>
            </div>

            <div className="pt-4 border-t border-[#ebd7dc] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6f5057]">
              <span>Curated in Gurugram, Haryana</span>
              <span aria-hidden="true">·</span>
              <span>Transparent INR Pricing</span>
              <span aria-hidden="true">·</span>
              <span>Pan-India Dispatch</span>
            </div>
          </div>

          {/* Right Editorial Product Composition (Using Real Database Products) */}
          <div className="lg:col-span-6 p-5 sm:p-8 lg:p-10 bg-[#f6ebee]/60 border-t lg:border-t-0 lg:border-l border-[#ebd7dc]">
            <div className="grid grid-cols-12 gap-3.5 items-stretch">
              {/* Primary Hero Product Showcase */}
              <div className="col-span-12 sm:col-span-7 flex flex-col justify-between rounded-2xl bg-[#fffdfb] border border-[#e7cfd5] overflow-hidden shadow-2xs">
                <div
                  onClick={() => heroPrimaryProduct && onSelectProduct(heroPrimaryProduct)}
                  className="aspect-4/5 bg-[#fdf5f7] overflow-hidden cursor-pointer"
                >
                  <img
                    src={heroPrimaryProduct?.images?.[0] || ARTWORK.heroBanner}
                    alt={heroPrimaryProduct?.name || 'Pretty Charm Signature Piece'}
                    referrerPolicy="no-referrer"
                    data-testid="hero-primary-product-img"
                    className="w-full h-full object-cover hover:scale-103 transition-transform duration-500"
                  />
                </div>
                {heroPrimaryProduct && (
                  <div className="p-3.5 flex items-center justify-between gap-2 border-t border-[#f0dce1]">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#9e5461] truncate">
                        {categoryNameMap.get(heroPrimaryProduct.categorySlug) || 'Hair Accessories'}
                      </p>
                      <button
                        type="button"
                        onClick={() => onSelectProduct(heroPrimaryProduct)}
                        className="font-serif text-base font-semibold text-[#2b1c20] hover:text-[#9e5461] truncate block text-left"
                      >
                        {heroPrimaryProduct.name}
                      </button>
                    </div>
                    <span className="text-xs font-semibold font-tabular text-[#2b1c20] shrink-0">
                      {formatINR(heroPrimaryProduct.sellingPricePaise)}
                    </span>
                  </div>
                )}
              </div>

              {/* Secondary Editorial Stack */}
              <div className="col-span-12 sm:col-span-5 grid grid-cols-2 sm:grid-cols-1 gap-3.5">
                {heroSecondaryProduct && (
                  <div
                    onClick={() => onSelectProduct(heroSecondaryProduct)}
                    className="rounded-2xl bg-[#fffdfb] border border-[#e7cfd5] overflow-hidden cursor-pointer flex flex-col justify-between shadow-2xs"
                  >
                    <div className="aspect-4/3 bg-[#fdf5f7] overflow-hidden">
                      <img
                        src={heroSecondaryProduct.images?.[0] || ARTWORK.heroBanner}
                        alt={heroSecondaryProduct.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover hover:scale-103 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-3 border-t border-[#f0dce1]">
                      <p className="font-serif text-sm font-semibold text-[#2b1c20] truncate">
                        {heroSecondaryProduct.name}
                      </p>
                      <p className="text-xs text-[#9e5461] font-tabular mt-0.5">
                        {formatINR(heroSecondaryProduct.sellingPricePaise)}
                      </p>
                    </div>
                  </div>
                )}

                {heroTertiaryProduct && (
                  <div
                    onClick={() => onSelectProduct(heroTertiaryProduct)}
                    className="rounded-2xl bg-[#fffdfb] border border-[#e7cfd5] overflow-hidden cursor-pointer flex flex-col justify-between shadow-2xs"
                  >
                    <div className="aspect-4/3 bg-[#fdf5f7] overflow-hidden">
                      <img
                        src={heroTertiaryProduct.images?.[0] || ARTWORK.heroBanner}
                        alt={heroTertiaryProduct.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover hover:scale-103 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-3 border-t border-[#f0dce1]">
                      <p className="font-serif text-sm font-semibold text-[#2b1c20] truncate">
                        {heroTertiaryProduct.name}
                      </p>
                      <p className="text-xs text-[#9e5461] font-tabular mt-0.5">
                        {formatINR(heroTertiaryProduct.sellingPricePaise)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* D. SHOP BY CATEGORY                                                 */}
      {/* =================================================================== */}
      <section data-testid="homepage-categories-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#efe0e4] pb-4">
          <div>
            <p className="text-xs tracking-[0.16em] uppercase text-[#9e5461] font-medium">
              Collections
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#2b1c20] font-semibold mt-0.5">
              Shop by Category
            </h2>
          </div>
          <button
            type="button"
            onClick={onViewAllCategories}
            className="text-xs font-medium text-[#9e5461] hover:text-[#7c3d48] inline-flex items-center gap-1 self-start sm:self-auto whitespace-nowrap cursor-pointer"
          >
            <span>Browse All Categories</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {categories.map((cat) => {
            const isComingSoon = cat.status === 'coming-soon';
            const cardImg = getCategoryCardImage(cat);

            return (
              <div
                key={cat.id}
                data-testid={`homepage-category-card-${cat.slug}`}
                className={`group rounded-2xl border overflow-hidden flex flex-col justify-between transition-all ${
                  isComingSoon
                    ? 'bg-[#faf6f4] border-[#eadadd]'
                    : 'bg-white border-[#ebd7dc] hover:border-[#9e5461] shadow-2xs'
                }`}
              >
                <div>
                  <div className="aspect-4/3 bg-[#fdf3f6] overflow-hidden relative">
                    <img
                      src={cardImg}
                      alt={cat.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = ARTWORK.heroBanner;
                      }}
                      className={`w-full h-full object-cover transition-transform duration-500 ${
                        isComingSoon ? 'opacity-85' : 'group-hover:scale-105 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!isComingSoon) onShopCategory(cat.slug);
                      }}
                    />
                  </div>

                  <div className="p-4 space-y-1.5">
                    <p className="text-[11px] text-[#9e5461] font-medium">
                      {isComingSoon ? 'Coming Soon · Non-purchasable' : 'Explore Collection'}
                    </p>
                    <h3 className="font-serif text-xl font-semibold text-[#2b1c20] leading-snug">
                      {isComingSoon ? `${cat.name} — Coming Soon` : cat.name}
                    </h3>
                    <p className="text-xs text-[#6f5057] line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-1">
                  {isComingSoon ? (
                    <span
                      data-testid={`category-coming-soon-${cat.slug}`}
                      className="block w-full py-2 px-3 rounded-xl bg-[#f5eaed] text-[#7c5c63] text-xs font-medium text-center select-none"
                    >
                      Coming Soon
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid={`category-explore-btn-${cat.slug}`}
                      onClick={() => onShopCategory(cat.slug)}
                      className="w-full py-2 px-3 rounded-xl bg-[#fdf2f4] hover:bg-[#9e5461] text-[#9e5461] hover:text-white text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Shop {cat.name}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =================================================================== */}
      {/* E. FEATURED PRODUCTS (ACTIVE, IN-STOCK DATABASE ITEMS ONLY)         */}
      {/* =================================================================== */}
      <section data-testid="homepage-featured-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#efe0e4] pb-4">
          <div>
            <p className="text-xs tracking-[0.16em] uppercase text-[#9e5461] font-medium">
              In Stock · Ready to Ship
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#2b1c20] font-semibold mt-0.5">
              Featured Products
            </h2>
            <p className="text-xs text-[#6f5057] mt-1">
              Every piece below reflects live inventory from our Gurugram studio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onShopCategory('all')}
            className="text-xs font-medium text-[#9e5461] hover:text-[#7c3d48] inline-flex items-center gap-1 self-start sm:self-auto whitespace-nowrap cursor-pointer"
          >
            <span>View Full Catalogue</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredProducts.map((product) => {
            const isWishlisted = wishlist.includes(product.id);
            const variantSummary =
              product.variants && product.variants.length > 0
                ? product.variants.map((v: any) => v.name).join(' · ')
                : null;

            return (
              <article
                key={product.id}
                data-testid={`product-card-${product.slug}`}
                className="group rounded-2xl bg-white border border-[#ebd7dc] hover:border-[#9e5461] overflow-hidden flex flex-col justify-between transition-all shadow-2xs"
              >
                <div>
                  <div className="relative aspect-4/3 bg-[#fdf3f6] overflow-hidden">
                    <img
                      src={product.images?.[0] || ARTWORK.heroBanner}
                      alt={product.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      data-testid={`product-card-img-${product.slug}`}
                      onClick={() => onSelectProduct(product)}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = ARTWORK.heroBanner;
                      }}
                      className="w-full h-full object-cover cursor-pointer group-hover:scale-104 transition-transform duration-500"
                    />
                    <button
                      type="button"
                      onClick={() => onToggleWishlist(product.id)}
                      aria-label={
                        isWishlisted
                          ? `Remove ${product.name} from Wishlist`
                          : `Save ${product.name} to Wishlist`
                      }
                      className={`absolute top-3 right-3 p-2.5 rounded-full bg-white/95 border border-[#ebd7dc] shadow-2xs transition-colors cursor-pointer ${
                        isWishlisted ? 'text-[#9e5461]' : 'text-[#6f5057] hover:text-[#9e5461]'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-[#9e5461]' : ''}`} />
                    </button>
                  </div>

                  <div className="p-5 space-y-2">
                    <p className="text-[11px] text-[#9e5461] font-medium">
                      {categoryNameMap.get(product.categorySlug) || product.categorySlug} ·{' '}
                      <span className="font-tabular">{product.availableQty} in stock</span>
                    </p>

                    <h3
                      onClick={() => onSelectProduct(product)}
                      className="font-serif text-xl font-semibold text-[#2b1c20] cursor-pointer hover:text-[#9e5461] leading-snug"
                    >
                      {product.name}
                    </h3>

                    {variantSummary && (
                      <p
                        data-testid={`product-variants-${product.slug}`}
                        className="text-xs text-[#6f5057] truncate"
                      >
                        Options: {variantSummary}
                      </p>
                    )}

                    <p className="text-base font-semibold text-[#2b1c20] font-tabular pt-0.5">
                      {formatINR(product.sellingPricePaise)}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-1 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSelectProduct(product)}
                    data-testid={`view-product-${product.slug}`}
                    className="py-2.5 px-3 rounded-full bg-[#faf5f2] hover:bg-[#f5e6ea] text-[#2b1c20] border border-[#e5cdd3] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                  >
                    View Product
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddToCart(product)}
                    data-testid={`add-to-cart-${product.slug}`}
                    className="py-2.5 px-3 rounded-full bg-[#9e5461] hover:bg-[#84414d] text-white text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* =================================================================== */}
      {/* F. GIFT HAMPERS COLLECTION                                          */}
      {/* =================================================================== */}
      <section
        data-testid="homepage-hampers-section"
        className="rounded-3xl bg-[#faf4f5] border border-[#ebd7dc] p-6 sm:p-10 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#e8d2d8] pb-5">
          <div className="space-y-1">
            <p className="text-xs tracking-[0.16em] uppercase text-[#9e5461] font-medium">
              Signature Keepsake Boxes
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#2b1c20] font-semibold">
              Gift Hampers Collection
            </h2>
            <p className="text-xs sm:text-sm text-[#5c4046] max-w-2xl leading-relaxed">
              Explore our curated gift hamper collection below. Items marked as Draft display their saved proposed prices and open for ordering as soon as box contents and stock are confirmed in the Admin Panel.
            </p>
          </div>

          <button
            type="button"
            data-testid="view-all-hampers-link"
            onClick={() => onShopCategory('gift-hampers')}
            className="px-5 py-2.5 rounded-full bg-white hover:bg-[#9e5461] text-[#9e5461] hover:text-white border border-[#dfc1c8] text-xs font-medium transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap cursor-pointer"
          >
            <span>View All Hampers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {giftHampers.map((hamper) => {
            const isPurchasable = hamper.status === 'active' && (hamper.availableQty || 0) > 0;
            const isWishlisted = wishlist.includes(hamper.id);

            return (
              <article
                key={hamper.id}
                data-testid={`hamper-card-${hamper.slug}`}
                className="rounded-2xl bg-white border border-[#ebd7dc] overflow-hidden flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="relative aspect-4/3 bg-[#fdf3f6] overflow-hidden">
                    <img
                      src={hamper.images?.[0] || ARTWORK.hamperCelebration}
                      alt={hamper.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onClick={() => onSelectProduct(hamper)}
                      className="w-full h-full object-cover cursor-pointer hover:scale-103 transition-transform duration-500"
                    />
                    <button
                      type="button"
                      onClick={() => onToggleWishlist(hamper.id)}
                      aria-label={
                        isWishlisted
                          ? `Remove ${hamper.name} from Wishlist`
                          : `Save ${hamper.name} to Wishlist`
                      }
                      className={`absolute top-2.5 right-2.5 p-2 rounded-full bg-white/95 border border-[#ebd7dc] cursor-pointer ${
                        isWishlisted ? 'text-[#9e5461]' : 'text-[#6f5057]'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-[#9e5461]' : ''}`} />
                    </button>
                  </div>

                  <div className="p-4 space-y-1.5">
                    <p className="text-[11px] text-[#9e5461] font-medium">
                      Gift Hampers ·{' '}
                      {isPurchasable
                        ? `${hamper.availableQty} in stock`
                        : hamper.status === 'draft'
                        ? 'Saved Draft · Awaiting Confirmation'
                        : 'Out of Stock'}
                    </p>

                    <h3
                      onClick={() => onSelectProduct(hamper)}
                      className="font-serif text-lg font-semibold text-[#2b1c20] cursor-pointer hover:text-[#9e5461] leading-snug"
                    >
                      {hamper.name}
                    </h3>

                    <p className="text-xs text-[#6f5057] line-clamp-2 leading-relaxed">
                      {hamper.description}
                    </p>

                    <p className="text-sm font-semibold text-[#2b1c20] font-tabular pt-1">
                      {hamper.status === 'draft' ? 'Proposed ' : ''}
                      {formatINR(hamper.sellingPricePaise)}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-1">
                  {isPurchasable ? (
                    <button
                      type="button"
                      onClick={() => onAddToCart(hamper)}
                      className="w-full py-2.5 px-4 rounded-full bg-[#9e5461] hover:bg-[#84414d] text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      Add Hamper to Cart
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectProduct(hamper)}
                      className="w-full py-2.5 px-4 rounded-full bg-[#faf5f2] hover:bg-[#f3e4e8] text-[#5c4046] border border-[#e5cdd3] text-xs font-medium transition-colors cursor-pointer"
                    >
                      View Saved Details
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* =================================================================== */}
      {/* G. BRAND STORY                                                      */}
      {/* =================================================================== */}
      <section
        data-testid="homepage-brand-story"
        className="rounded-3xl bg-[#fffdfb] border border-[#ebd7dc] p-6 sm:p-12"
      >
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <p className="text-xs tracking-[0.2em] uppercase text-[#9e5461] font-medium">
            The Pretty Charm Philosophy
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#2b1c20] font-semibold leading-tight">
            Thoughtful Gifting &amp; Everyday Finishing Touches
          </h2>
          <p className="text-sm sm:text-base text-[#5c4046] leading-relaxed">
            Pretty Charm brings together soft satin hair accessories, pearl-accented claws, dainty rose-gold toned jewellery, and keepsake gift hampers. Whether you are choosing a small gesture for someone dear or a quiet everyday essential for yourself, every piece in our catalogue is listed with clear specifications and honest availability.
          </p>
        </div>
      </section>

      {/* =================================================================== */}
      {/* H. WHY SHOP WITH US (ADMIN-CONFIGURABLE VERIFIED BENEFITS)          */}
      {/* =================================================================== */}
      <section data-testid="homepage-why-shop-section" className="space-y-6">
        <div className="border-b border-[#efe0e4] pb-4">
          <p className="text-xs tracking-[0.16em] uppercase text-[#9e5461] font-medium">
            Verified Store Commitments
          </p>
          <h2 className="font-serif text-3xl text-[#2b1c20] font-semibold mt-0.5">
            Why Shop With Us
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {whyShopBenefits.map((benefit, idx) => (
            <div
              key={benefit.id}
              data-testid={`why-shop-card-${benefit.id}`}
              className="rounded-2xl bg-white border border-[#ebd7dc] p-5 space-y-2"
            >
              <p className="text-xs font-tabular text-[#9e5461] font-medium">
                0{idx + 1}.
              </p>
              <h3 className="font-serif text-xl font-semibold text-[#2b1c20]">
                {benefit.title}
              </h3>
              <p className="text-xs text-[#5c4046] leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =================================================================== */}
      {/* I. INSTAGRAM SECTION & J. NEWSLETTER PLACEHOLDER                    */}
      {/* =================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* I. Follow Pretty Charm on Instagram */}
        <div
          data-testid="homepage-instagram-section"
          className="lg:col-span-7 rounded-3xl bg-[#faf4f5] border border-[#ebd7dc] p-6 sm:p-8 flex flex-col justify-between space-y-5"
        >
          <div className="space-y-2">
            <p className="text-xs tracking-[0.18em] uppercase text-[#9e5461] font-medium">
              Official Social Profile
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#2b1c20] font-semibold">
              Follow Pretty Charm
            </h2>
            <p className="text-xs sm:text-sm text-[#5c4046] max-w-xl leading-relaxed">
              Connect with us on Instagram at <strong>{instagram.handle}</strong> for new accessory arrivals, hamper release announcements, and styling inspiration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href={instagram.url}
              target="_blank"
              rel="noreferrer"
              data-testid="homepage-instagram-link"
              className="px-5 py-2.5 rounded-full bg-[#9e5461] hover:bg-[#84414d] text-white text-xs font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              <span>Follow {instagram.handle} on Instagram</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* J. Newsletter or Offers (Clearly Labelled Disabled Placeholder in Development) */}
        <div
          data-testid="homepage-newsletter-section"
          className="lg:col-span-5 rounded-3xl bg-[#fffdfb] border border-[#ebd7dc] p-6 sm:p-8 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-1.5">
            <p className="text-xs tracking-[0.16em] uppercase text-[#7c5c63] font-medium">
              Newsletter &amp; Offers · Disabled in Development
            </p>
            <h2 className="font-serif text-2xl text-[#2b1c20] font-semibold">
              Studio Updates &amp; Releases
            </h2>
            <p className="text-xs text-[#6f5057] leading-relaxed">
              Email subscription is currently a disabled placeholder until a privacy-compliant mailing service is configured by the store administrator.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="email"
              disabled
              aria-label="Email address (disabled in development)"
              placeholder="Newsletter signup disabled in dev"
              className="flex-1 px-3.5 py-2.5 rounded-full bg-[#f7f2f3] border border-[#e5d5d9] text-xs text-[#8c6f75] cursor-not-allowed"
            />
            <button
              type="button"
              disabled
              className="px-4 py-2.5 rounded-full bg-[#eadadd] text-[#7c5c63] text-xs font-medium cursor-not-allowed whitespace-nowrap"
            >
              Coming Soon
            </button>
          </div>
        </div>
      </section>

      {/* Recently Viewed Items (if any) */}
      {recentlyViewed.length > 0 && (
        <section className="space-y-4 pt-2">
          <h2 className="font-serif text-2xl text-[#2b1c20] font-semibold">
            Recently Viewed
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentlyViewed
              .map((id) => products.find((p) => p.id === id))
              .filter(Boolean)
              .map((product: any) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelectProduct(product)}
                  className="text-left p-3 rounded-2xl bg-white border border-[#ebd7dc] hover:border-[#9e5461] transition-all flex items-center gap-3 cursor-pointer"
                >
                  <img
                    src={product.images?.[0] || ARTWORK.heroBanner}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-xl object-cover bg-[#fdf2f4] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#2b1c20] truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-[#9e5461] font-tabular mt-0.5">
                      {formatINR(product.sellingPricePaise)}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
};
