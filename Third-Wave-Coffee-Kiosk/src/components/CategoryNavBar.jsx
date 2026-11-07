import React, { useRef, useEffect } from 'react';
import './CategoryNavBar.css';
import { Sparkles, Coffee, CupSoda, Flame, Snowflake, Clock, UtensilsCrossed, Cake, Utensils } from 'lucide-react';

const TAB_ICONS = {
  specials: Sparkles,
  combos: Utensils,
  classics: Coffee,
  matcha: Flame,
  frappe: Snowflake,
  cold_brew: Clock,
  manual_brew: Coffee,
  tea_refreshers: CupSoda,
  food: UtensilsCrossed,
  desserts: Cake,
};

export const CategoryNavBar = ({ tabs = [], activeCategory, onSelectCategory }) => {
  const scrollContainerRef = useRef(null);

  // Scroll active tab into view smoothly
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeBtn = scrollContainerRef.current.querySelector('[data-active="true"]');
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeCategory]);

  if (!tabs || tabs.length <= 1) return null;

  return (
    <div className="category-navbar w-full bg-white border-b border-beige-muted/70 sticky top-0 z-20 shadow-sm shrink-0">
      <div
        ref={scrollContainerRef}
        className="category-navbar__scroll-container flex items-center gap-1.5 overflow-x-auto px-3.5 py-2.5 no-scrollbar scroll-smooth"
      >
        {tabs.map((tab) => {
          const isActive = activeCategory === tab.id;
          const Icon = TAB_ICONS[tab.id] || Coffee;

          return (
            <button
              key={tab.id}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => onSelectCategory(tab.id)}
              className={`category-navbar__tab flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap text-[11px] font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 shrink-0 border ${
                isActive
                  ? 'category-navbar__tab--active bg-beige text-navy border-navy font-black shadow-sm'
                  : 'category-navbar__tab--inactive bg-cream-100/70 hover:bg-cream-200 text-navy/70 border-beige-muted/80 font-semibold'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-navy' : 'text-taupe-warm'}`} />
              <span>{tab.label}</span>
              <span className={`category-navbar__count px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                isActive ? 'bg-navy/15 text-navy' : 'bg-beige-muted/40 text-taupe-warm'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
