import React from 'react';
import { Plus, Check, Sparkles } from 'lucide-react';

export const ProductCard = ({ product, onAdd, onOpenDetail }) => {
  const isPremium = product.badgeType === 'premium' || product.badge === 'Premium';

  return (
    <div
      onClick={() => onOpenDetail ? onOpenDetail(product) : onAdd(product)}
      className="group relative flex flex-col justify-between bg-white rounded-2xl p-2.5 sm:p-3 border border-beige-muted/80 hover:border-navy/40 shadow-sm hover:shadow-kiosk transition-all duration-300 active:scale-[0.98] cursor-pointer"
    >
      <div>
        {/* Product Image Frame */}
        <div className="relative w-full h-28 sm:h-32 rounded-xl overflow-hidden bg-cream-200 mb-2 border border-beige-muted/40">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />

          {/* Badges Overlay */}
          <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1 items-center max-w-[85%]">
            {/* Indian 100% Veg Symbol */}
            {product.veg && (
              <span className="w-3.5 h-3.5 rounded-sm bg-white border border-emerald-700 flex items-center justify-center shadow-sm shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-700"></span>
              </span>
            )}

            {product.badge && (
              <span
                className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shadow-sm ${
                  isPremium
                    ? 'bg-navy text-white border border-navy/40'
                    : 'bg-[#E25C38] text-white border border-[#E25C38]'
                }`}
              >
                {product.badge}
              </span>
            )}
          </div>

          {/* Calories Chip */}
          {product.calories && (
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-navy/80 backdrop-blur-md text-white text-[8px] font-semibold">
              {product.calories}
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="space-y-0.5">
          <h4 className="text-xs sm:text-[13px] font-black text-navy tracking-tight font-sans line-clamp-1">
            {product.name}
          </h4>

          <p className="text-[10px] text-taupe-warm leading-tight line-clamp-2 min-h-[26px]">
            {product.description}
          </p>

          {/* Flavour notes tags */}
          {product.notes && product.notes.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {product.notes.slice(0, 2).map((note, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.2 rounded bg-cream-100 text-[8px] font-bold text-navy/80 border border-beige-muted/50"
                >
                  {note}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer: Price & Add Button */}
      <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-beige-muted/60">
        <div>
          <span className="text-[8px] uppercase tracking-wider text-taupe-warm font-bold block leading-none">
            Price
          </span>
          <span className="text-sm font-black text-navy font-sans">
            ₹{product.price}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(product);
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-navy hover:bg-navy-charcoal active:scale-90 text-white text-[11px] font-bold shadow-sm transition-all border border-navy"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>ADD</span>
        </button>
      </div>
    </div>
  );
};
