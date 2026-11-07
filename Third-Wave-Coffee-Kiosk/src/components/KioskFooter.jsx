import React from 'react';
import './KioskFooter.css';
import { Home, ShoppingBag, ArrowRight } from 'lucide-react';
import { useKiosk } from '../context/KioskContext';

export const KioskFooter = ({ activeTab = 'home' }) => {
  const { navigateTo, cartTotals } = useKiosk();

  return (
    <footer className="kiosk-footer sticky bottom-0 z-30 w-full bg-white/95 backdrop-blur-md border-t border-beige-muted/80 px-3.5 py-2.5 shadow-lg shrink-0">
      <div className="kiosk-footer__row w-full flex items-center justify-between gap-2.5">
        
        {/* Left: Home / All Categories */}
        <button
          onClick={() => navigateTo('categories')}
          className={`kiosk-footer__categories-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 border ${
            activeTab === 'home'
              ? 'bg-navy text-white border-navy shadow-sm'
              : 'bg-cream-100 text-navy border-beige-muted hover:border-navy/40'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Categories</span>
        </button>

        {/* Right: Quick Cart Overview & View Cart CTA */}
        <button
          onClick={() => navigateTo('cart')}
          className="kiosk-footer__cart-btn group flex-1 flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl bg-navy hover:bg-navy-charcoal active:scale-[0.98] transition-all text-white shadow-kiosk border border-navy"
        >
          <div className="flex items-center gap-2">
            <div className="kiosk-footer__cart-icon-box relative flex items-center justify-center w-6 h-6 rounded-lg bg-white/15 text-white">
              <ShoppingBag className="w-3.5 h-3.5" />
              {cartTotals.itemCount > 0 && (
                <span className="kiosk-footer__badge absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-navy font-black text-[9px] flex items-center justify-center shadow-sm">
                  {cartTotals.itemCount}
                </span>
              )}
            </div>

            <div className="flex flex-col text-left leading-tight">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/80">
                {cartTotals.itemCount === 0 ? 'Tray Empty' : `${cartTotals.itemCount} ${cartTotals.itemCount === 1 ? 'Item' : 'Items'}`}
              </span>
              <span className="text-xs font-extrabold text-white">
                {cartTotals.itemCount === 0 ? 'Start Ordering' : `View Tray • ₹${cartTotals.totalPayable}`}
              </span>
            </div>
          </div>

          <div className="kiosk-footer__arrow-box w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </div>
        </button>

      </div>
    </footer>
  );
};
