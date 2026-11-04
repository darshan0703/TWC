import React from 'react';
import {
  Coffee,
  Sparkles,
  Flame,
  Filter,
  Clock,
  Leaf,
  Snowflake,
  CupSoda,
  UtensilsCrossed,
  Utensils,
  Croissant,
  Cake,
  Salad,
  Sun,
  Gift,
  Award
} from 'lucide-react';

const ICON_MAP = {
  Coffee,
  Sparkles,
  Flame,
  Filter,
  Clock,
  Leaf,
  Snowflake,
  CupSoda,
  UtensilsCrossed,
  Utensils,
  Croissant,
  Cake,
  Salad,
  Sun,
  Gift,
  Award
};

export const CategorySidebar = ({
  subcategories = [],
  activeSubcategory,
  onSelectSubcategory
}) => {
  return (
    <aside className="w-20 sm:w-24 shrink-0 bg-[#F4EFEA] border-r border-beige-muted/80 py-2.5 px-1.5 flex flex-col gap-2 overflow-y-auto select-none">
      <div className="text-center px-1 pb-1 border-b border-beige-muted/60">
        <span className="text-[9px] font-black tracking-wider uppercase text-taupe-warm font-sans block leading-tight">
          Sections
        </span>
      </div>

      <nav className="flex flex-col gap-2">
        {subcategories.map((sub) => {
          const isActive = activeSubcategory === sub.id;
          const IconComponent = ICON_MAP[sub.icon] || Coffee;

          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => onSelectSubcategory(sub.id)}
              className={`w-full min-h-[60px] p-2 rounded-xl flex flex-col items-center justify-center text-center transition-all duration-200 active:scale-95 border ${
                isActive
                  ? 'bg-white text-navy border-navy shadow-sm ring-1 ring-navy/20 font-black'
                  : 'bg-white/60 hover:bg-white text-navy/70 border-beige-muted/60 hover:border-beige-dark font-medium'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1 transition-colors ${
                  isActive
                    ? 'bg-navy text-white shadow-sm'
                    : 'bg-beige-muted/50 text-navy'
                }`}
              >
                <IconComponent className="w-4 h-4" />
              </div>

              <span className="text-[10px] leading-tight font-sans tracking-tight line-clamp-2">
                {sub.label}
              </span>

              {isActive && (
                <span className="w-3 h-0.5 rounded-full bg-navy mt-1" />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
