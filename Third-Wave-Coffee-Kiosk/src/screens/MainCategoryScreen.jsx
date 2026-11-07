import React from 'react';
import './MainCategoryScreen.css';
import { KioskHeader } from '../components/KioskHeader';
import { KioskFooter } from '../components/KioskFooter';
import { CategoryCard } from '../components/CategoryCard';
import { MAIN_CATEGORIES } from '../data/products';
import { useKiosk } from '../context/KioskContext';
import { CoffeeAndPastryIllustration } from '../components/LineArtIllustrations';
import { Sparkles, ArrowRight } from 'lucide-react';

export const MainCategoryScreen = () => {
  const { openCategory, navigateTo } = useKiosk();

  // Category badge & meta mapping
  const categoryMeta = {
    coffee: { tag: '100% Arabica', accent: 'from-[#2A1810]/85' },
    beverages: { tag: 'Cold & Chilled', accent: 'from-[#10232A]/85' },
    food: { tag: 'Fresh Bakes', accent: 'from-[#2A1E10]/85' },
    specials: { tag: 'Limited Harvest', accent: 'from-[#1C2A39]/85' }
  };

  return (
    <div className="main-category-screen w-full h-full bg-cream-100 flex flex-col justify-between select-none overflow-hidden">
      
      {/* Kiosk Header: Back button + Centered Logo (Top OrderType & Cart removed as requested) */}
      <KioskHeader
        showBack={true}
        showCart={false}
        showOrderType={false}
        onBackOverride={() => navigateTo('mobile')}
      />

      {/* Main Content Area (Scrollable within 9:16 portrait canvas) */}
      <main className="w-full px-4 py-3 flex-1 flex flex-col overflow-y-auto">
        
        {/* Editorial Heading (Reduced size) */}
        <div className="main-category-screen__heading-box mb-2.5 pb-2 border-b border-beige-muted/70 shrink-0">
          <div className="flex items-center gap-1.5 text-navy text-[9px] font-black uppercase tracking-[0.2em] mb-0.5 font-sans">
            <Sparkles className="w-3 h-3 text-twc-terracotta" />
            <span>Third Wave Coffee Menu</span>
          </div>
          <h2 className="main-category-screen__title text-lg sm:text-xl font-black text-navy tracking-tight uppercase font-sans">
            What are you craving today?
          </h2>
          <p className="text-[11px] text-taupe-warm font-serif italic mt-0.5">
            Select a category to explore our handcrafted coffees & food
          </p>
        </div>

        {/* 4 PRIMARY CATEGORIES IN PORTRAIT 2x2 GRID */}
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-[360px]">
          {MAIN_CATEGORIES.map((category) => {
            const meta = categoryMeta[category.id] || { tag: 'Specialty', accent: 'from-navy/85' };
            const enrichedCategory = {
              ...category,
              tag: meta.tag,
              itemCount: (category.subcategories?.length || 0) * 4
            };

            return (
              <button
                key={category.id}
                onClick={() => openCategory(category.id)}
                className="group relative overflow-hidden rounded-2xl text-left border border-beige-muted/80 hover:border-navy/50 transition-all duration-300 active:scale-[0.98] shadow-sm hover:shadow-kiosk flex flex-col justify-between p-3.5 min-h-[160px] sm:min-h-[180px]"
              >
                {/* Background Image */}
                <img
                  src={category.image}
                  alt={category.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  loading="lazy"
                />

                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-navy/95 via-navy/50 to-transparent" />
                <div className="absolute inset-0 bg-navy/15 group-hover:bg-transparent transition-colors" />

                {/* Top Badges */}
                <div className="relative z-10 flex items-center justify-between w-full">
                  <span className="px-2 py-0.5 rounded-full bg-white/95 text-navy text-[9px] font-black uppercase tracking-wider shadow-sm">
                    {enrichedCategory.tag}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-navy/70 backdrop-blur-md text-white/90 text-[9px] font-bold border border-white/15">
                    {category.subcategories?.length} Sections
                  </span>
                </div>

                {/* Bottom Content */}
                <div className="relative z-10 flex items-end justify-between gap-2 mt-auto">
                  <div className="min-w-0">
                    <h3 className="font-sans font-black uppercase tracking-tight text-white text-lg sm:text-xl group-hover:text-cream-50 transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-white/80 font-serif italic truncate mt-0.5">
                      {category.subtitle}
                    </p>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-white text-navy flex items-center justify-center group-hover:scale-105 shadow transition-all shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Restrained 2D Line-Art Graphic Note */}
        <div className="mt-3 pt-2 flex items-center justify-center gap-3 text-taupe-warm text-[10px] font-medium opacity-75 shrink-0">
          <CoffeeAndPastryIllustration className="w-7 h-7" color="#1C2A39" />
          <span>Freshly pulled single-origin Arabica & daily artisanal bakes</span>
        </div>

      </main>

      {/* Persistent Bottom Bar */}
      <KioskFooter />

    </div>
  );
};
