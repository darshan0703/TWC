import React from 'react';
import './CategorySidebar.css';
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
    <aside className="category-sidebar shrink-0 bg-[#F4EFEA] border-r border-beige-muted/80 overflow-y-auto select-none">
      <div className="category-sidebar__header text-center">
        <span className="category-sidebar__header-text font-black tracking-wider uppercase text-taupe-warm font-sans block leading-tight">
          Sections
        </span>
      </div>

      <nav className="category-sidebar__nav flex flex-col">
        {subcategories.map((sub) => {
          const isActive = activeSubcategory === sub.id;
          const IconComponent = ICON_MAP[sub.icon] || Coffee;

          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => onSelectSubcategory(sub.id)}
              className={`category-sidebar__btn w-full rounded-xl flex flex-col items-center justify-center text-center transition-all duration-200 active:scale-95 border ${
                isActive
                  ? 'category-sidebar__btn--active bg-white text-navy border-navy shadow-sm ring-1 ring-navy/20 font-black'
                  : 'category-sidebar__btn--inactive bg-white/60 hover:bg-white text-navy/70 border-beige-muted/60 hover:border-beige-dark font-medium'
              }`}
            >
              <div
                className={`category-sidebar__icon-box rounded-lg flex items-center justify-center mb-1 transition-colors ${
                  isActive
                    ? 'bg-navy text-white shadow-sm'
                    : 'bg-beige-muted/50 text-navy'
                }`}
              >
                <IconComponent className="w-3.5 h-3.5" />
              </div>

              <span className="category-sidebar__label leading-tight font-sans tracking-tight line-clamp-2">
                {sub.label}
              </span>

              {isActive && (
                <span className="category-sidebar__active-pill rounded-full bg-navy" />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
