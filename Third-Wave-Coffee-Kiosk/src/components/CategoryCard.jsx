import React from 'react';
import './CategoryCard.css';
import { ArrowRight, Sparkles } from 'lucide-react';

export const CategoryCard = ({ category, onSelect, isHero = false }) => {
  return (
    <button
      onClick={() => onSelect(category.id)}
      className={`category-card group relative overflow-hidden rounded-2xl text-left border border-beige-muted/80 hover:border-navy/50 transition-all duration-300 active:scale-[0.98] shadow-sm hover:shadow-kiosk ${
        isHero 
          ? 'category-card--hero col-span-2 min-h-[145px] sm:min-h-[155px]' 
          : 'category-card--standard col-span-1 min-h-[135px] sm:min-h-[145px]'
      }`}
    >
      {/* Background Image with warm subtle overlay */}
      <img
        src={category.image}
        alt={category.name}
        className="category-card__image absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        loading="lazy"
      />

      {/* Modern Third Wave subtle gradient overlay: deep navy/charcoal gradient for contrast */}
      <div className="category-card__gradient absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-transparent" />
      <div className="absolute inset-0 bg-navy/10 group-hover:bg-transparent transition-colors" />

      {/* Top badges */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
        {category.tag && (
          <span className={`category-card__tag px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md ${
            isHero 
              ? 'bg-white text-navy shadow-sm' 
              : 'bg-white/90 text-navy shadow-sm'
          }`}>
            {category.tag}
          </span>
        )}

        <span className="category-card__count-badge ml-auto px-2 py-0.5 rounded-full bg-navy/70 backdrop-blur-md text-white/90 text-[9px] font-bold border border-white/15">
          {category.itemCount} Items
        </span>
      </div>

      {/* Bottom Content */}
      <div className="category-card__content absolute bottom-0 inset-x-0 p-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {isHero && (
            <div className="flex items-center gap-1 text-white/90 mb-0.5">
              <Sparkles className="w-3 h-3 text-twc-terracotta" />
              <span className="text-[9px] font-bold uppercase tracking-widest font-sans">
                Signature Collection
              </span>
            </div>
          )}

          <h3 className={`category-card__title font-sans font-black uppercase tracking-tight text-white group-hover:text-cream-50 transition-colors ${
            isHero ? 'category-card__title--hero text-xl sm:text-2xl' : 'category-card__title--standard text-base sm:text-lg'
          }`}>
            {category.name}
          </h3>

          <p className="category-card__subtitle text-[10px] sm:text-[11px] text-white/80 font-serif italic truncate mt-0.5">
            {category.subtitle}
          </p>
        </div>

        {/* Action button icon */}
        <div className={`category-card__action-btn shrink-0 rounded-xl flex items-center justify-center transition-all ${
          isHero 
            ? 'w-8 h-8 bg-white text-navy group-hover:scale-105 shadow' 
            : 'w-7 h-7 bg-white/90 text-navy group-hover:bg-white shadow'
        }`}>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </button>
  );
};
