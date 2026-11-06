import React from 'react';
import { KioskHeader } from '../components/KioskHeader';
import { KioskFooter } from '../components/KioskFooter';
import { CategorySidebar } from '../components/CategorySidebar';
import { ProductCard } from '../components/ProductCard';
import { MAIN_CATEGORIES, PRODUCTS } from '../data/products';
import { useKiosk } from '../context/KioskContext';
import { Coffee, CupSoda, UtensilsCrossed, Sparkles, Award, Flame } from 'lucide-react';

const MAIN_ICONS = {
  coffee: Coffee,
  beverages: CupSoda,
  food: UtensilsCrossed,
  specials: Sparkles
};

export const MenuScreen = () => {
  const {
    selectedMainCategory,
    selectMainCategory,
    selectedSubcategory,
    selectSubcategory,
    openCustomization,
    addDirectToCart,
    navigateTo
  } = useKiosk();

  // Active main category object
  const currentMain = MAIN_CATEGORIES.find(c => c.id === selectedMainCategory) || MAIN_CATEGORIES[0];
  const subcategories = currentMain.subcategories || [];

  // Active subcategory object
  const currentSub = subcategories.find(s => s.id === selectedSubcategory) || subcategories[0] || {
    id: 'coffee_classics',
    label: 'Classics',
    description: 'Specialty coffee roasts'
  };

  // Products belonging strictly to this subcategory (exactly 4 products)
  const currentProducts = PRODUCTS.filter(p => p.subcategory === currentSub.id);

  // Group cleanly into Popular & Specials vs Premium Selection (no duplicate rendering)
  const popularProducts = currentProducts.filter(p => p.badgeType !== 'premium');
  const premiumProducts = currentProducts.filter(p => p.badgeType === 'premium');

  return (
    <div className="w-full h-full bg-cream-100 flex flex-col justify-between select-none overflow-hidden">
      
      {/* Kiosk Header */}
      <KioskHeader
        title={currentMain.name}
        subtitle={currentSub.label}
        showBack={true}
        showCart={true}
        onBackOverride={() => navigateTo('categories')}
      />

      {/* Primary Category Quick Switcher (Top horizontal bar for 4 main categories) */}
      <div className="shrink-0 bg-white border-b border-beige-muted/80 px-2 py-1.5 flex items-center justify-between gap-1 shadow-sm overflow-x-auto">
        {MAIN_CATEGORIES.map((cat) => {
          const isActive = cat.id === currentMain.id;
          const Icon = MAIN_ICONS[cat.id] || Coffee;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => selectMainCategory(cat.id)}
              className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 border ${
                isActive
                  ? 'bg-navy text-white border-navy shadow-sm font-bold'
                  : 'bg-cream-100/70 hover:bg-cream-200 text-navy/70 border-beige-muted/60 font-semibold'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] uppercase tracking-wider font-sans whitespace-nowrap">
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Body: Subcategory Sidebar on left + Products on right */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Category-Specific Subcategory Sidebar */}
        <CategorySidebar
          subcategories={subcategories}
          activeSubcategory={currentSub.id}
          onSelectSubcategory={(subId) => selectSubcategory(subId)}
        />

        {/* Product Display Area (Scrollable) */}
        <main className="flex-1 p-2.5 sm:p-3 overflow-y-auto space-y-3">
          
          {/* Subcategory Banner */}
          <div className="bg-white rounded-xl p-2.5 border border-beige-muted/80 shadow-sm flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-navy/70 font-sans">
                <Sparkles className="w-3 h-3 text-[#E25C38]" />
                <span>{currentMain.name} &bull; {currentSub.label}</span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-navy uppercase tracking-tight font-sans mt-0.5">
                {currentSub.label}
              </h2>
              <p className="text-[10px] text-taupe-warm font-serif italic line-clamp-1">
                {currentSub.description || 'Specialty selections crafted to perfection'}
              </p>
            </div>

            <div className="shrink-0 px-2 py-0.5 rounded-lg bg-cream-200 text-[9px] font-bold text-navy uppercase font-sans">
              {currentProducts.length} {currentProducts.length === 1 ? 'Product' : 'Products'}
            </div>
          </div>

          {/* SECTION 1: Popular & Specials */}
          {popularProducts.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1">
                <Sparkles className="w-3.5 h-3.5 text-[#E25C38]" />
                <h3 className="text-[11px] font-black uppercase tracking-wider text-navy font-sans">
                  Popular & Specials
                </h3>
                <span className="text-[9px] text-taupe-warm font-serif italic">
                  (Customer Favourites)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {popularProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={addDirectToCart}
                    onOpenDetail={openCustomization}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: Premium Selection */}
          {premiumProducts.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 px-1">
                <Award className="w-3.5 h-3.5 text-navy" />
                <h3 className="text-[11px] font-black uppercase tracking-wider text-navy font-sans">
                  Premium Selection
                </h3>
                <span className="text-[9px] text-taupe-warm font-serif italic">
                  (Master Barista Reserve)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {premiumProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={addDirectToCart}
                    onOpenDetail={openCustomization}
                  />
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Kiosk Footer with persistent tray controls */}
      <KioskFooter activeTab="menu" />

    </div>
  );
};
