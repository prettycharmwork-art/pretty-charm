import React, { useState } from 'react';
import { Search, Home, Gift, Sparkles, ArrowRight } from 'lucide-react';

interface NotFoundPageProps {
  onGoHome: () => void;
  onGoCategory: (categorySlug: string) => void;
  onSearch: (query: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  onGoHome,
  onGoCategory,
  onSearch,
}) => {
  const [searchInput, setSearchInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
    }
  };

  return (
    <div className="py-12 sm:py-20 px-4 text-center max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="space-y-3">
        <p className="text-sm font-semibold tracking-widest text-[#9e5461] uppercase">
          404 Error · Page Not Found
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#2d1e21]">
          Looking for Something Pretty?
        </h1>
        <p className="text-sm sm:text-base text-[#5c3d42] leading-relaxed max-w-lg mx-auto">
          The page you are looking for might have been moved, renamed, or is temporarily unavailable. Explore our curated collections below.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSubmit} className="relative max-w-md mx-auto">
        <Search className="w-4 h-4 text-[#7c5c63] absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search hampers, jewellery, scrunchies..."
          className="w-full pl-11 pr-24 py-3 rounded-full bg-white border border-[#f0d5da] text-sm text-[#2d1e21] shadow-xs focus:outline-none focus:border-[#9e5461]"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-[#9e5461] text-white text-xs font-semibold hover:bg-[#83424e] transition-colors"
        >
          Search
        </button>
      </form>

      {/* Suggested Categories */}
      <div className="pt-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[#7c5c63]">
          Popular Gifting Collections
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => onGoCategory('gift-hampers')}
            className="p-4 rounded-2xl bg-white border border-[#f0d5da] hover:border-[#9e5461] hover:shadow-xs transition-all flex flex-col items-center gap-2 group text-center cursor-pointer"
          >
            <Gift className="w-5 h-5 text-[#9e5461] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-[#2d1e21]">Gift Hampers</span>
            <span className="text-[11px] text-[#7c5c63]">Curated for Birthdays & Besties</span>
          </button>

          <button
            type="button"
            onClick={() => onGoCategory('hair-accessories')}
            className="p-4 rounded-2xl bg-white border border-[#f0d5da] hover:border-[#9e5461] hover:shadow-xs transition-all flex flex-col items-center gap-2 group text-center cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-[#9e5461] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-[#2d1e21]">Hair Accessories</span>
            <span className="text-[11px] text-[#7c5c63]">Silk Scrunchies & Pearl Claws</span>
          </button>

          <button
            type="button"
            onClick={() => onGoCategory('jewellery')}
            className="p-4 rounded-2xl bg-white border border-[#f0d5da] hover:border-[#9e5461] hover:shadow-xs transition-all flex flex-col items-center gap-2 group text-center cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-[#9e5461] group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-[#2d1e21]">Jewellery</span>
            <span className="text-[11px] text-[#7c5c63]">Anti-Tarnish Rose Gold</span>
          </button>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2d1e21] text-white text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
        >
          <Home className="w-4 h-4" />
          <span>Return to Homepage</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
