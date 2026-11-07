import React from 'react';
import './KioskHeader.css';
import { ChevronLeft, ShoppingBag, Utensils, ShoppingBag as BagIcon } from 'lucide-react';
import { TwcLogo } from './TwcLogo';
import { useKiosk } from '../context/KioskContext';

export const KioskHeader = ({
  title,
  subtitle,
  showBack = true,
  showCart = true,
  showOrderType = true,
  onBackOverride
}) => {
  const { goBack, navigateTo, cartTotals, orderType, setOrderType, currentScreen } = useKiosk();

  const handleBack = () => {
    if (onBackOverride) {
      onBackOverride();
    } else {
      goBack();
    }
  };

  const hasRightOptions = showOrderType || showCart;

  return (
    <header className="kiosk-header sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-beige-muted/70 px-3.5 py-2.5 transition-all shrink-0">
      <div className={`kiosk-header__row w-full flex items-center ${hasRightOptions ? 'justify-between' : 'justify-between'} gap-2`}>
        
        {/* Left: Back button */}
        <div className="kiosk-header__left flex items-center gap-2 shrink-0">
          {showBack && (
            <button
              onClick={handleBack}
              aria-label="Go Back"
              className="kiosk-header__back-btn flex items-center justify-center w-9 h-9 rounded-xl bg-cream-100 border border-beige-muted hover:border-navy/40 active:scale-95 shadow-sm transition-all text-navy shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 text-navy" />
            </button>
          )}

          {hasRightOptions && (
            <button 
              onClick={() => navigateTo('categories')}
              className="kiosk-header__logo-btn flex items-center focus:outline-none cursor-pointer shrink-0"
              title="Go to Menu Overview"
            >
              <TwcLogo />
            </button>
          )}
        </div>

        {/* Center: Brand Logo when right options are hidden */}
        {!hasRightOptions && (
          <button 
            onClick={() => navigateTo('categories')}
            className="kiosk-header__logo-btn flex items-center justify-center focus:outline-none cursor-pointer flex-1"
            title="Go to Menu Overview"
          >
            <TwcLogo />
          </button>
        )}

        {/* Right side: Either OrderType & Cart, or balancing spacer */}
        {hasRightOptions ? (
          <div className="kiosk-header__right flex items-center gap-2 shrink-0">
            {showOrderType && (
              <div className="kiosk-header__order-type-box flex items-center p-0.5 bg-cream-200/90 rounded-xl border border-beige-muted/80 shadow-inner">
                <button
                  type="button"
                  onClick={() => setOrderType('dine_in')}
                  className={`kiosk-header__order-type-btn flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    orderType === 'dine_in'
                      ? 'kiosk-header__order-type-btn--active bg-navy text-white shadow-sm font-extrabold'
                      : 'kiosk-header__order-type-btn--inactive text-navy/60 hover:text-navy'
                  }`}
                  title="Dine In"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Dine In</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderType('takeaway')}
                  className={`kiosk-header__order-type-btn flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    orderType === 'takeaway'
                      ? 'kiosk-header__order-type-btn--active bg-navy text-white shadow-sm font-extrabold'
                      : 'kiosk-header__order-type-btn--inactive text-navy/60 hover:text-navy'
                  }`}
                  title="Takeaway"
                >
                  <BagIcon className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Takeaway</span>
                </button>
              </div>
            )}

            {showCart && (
              <button
                onClick={() => navigateTo('cart')}
                className={`kiosk-header__cart-btn relative flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 border ${
                  currentScreen === 'cart'
                    ? 'bg-navy text-white border-navy'
                    : 'bg-cream-100 text-navy border-beige-muted hover:border-navy/40'
                }`}
              >
                <div className="relative">
                  <ShoppingBag className="w-4 h-4 text-navy" />
                  {cartTotals.itemCount > 0 && (
                    <span className="kiosk-header__cart-badge absolute -top-2 -right-2 min-w-[17px] h-[17px] px-0.5 rounded-full bg-navy text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                      {cartTotals.itemCount}
                    </span>
                  )}
                </div>

                <span className="text-xs font-black tracking-tight">
                  ₹{cartTotals.totalPayable}
                </span>
              </button>
            )}
          </div>
        ) : (
          /* Balancing spacer matches back button width (36px = w-9) */
          showBack && <div className="w-9 shrink-0" aria-hidden="true" />
        )}

      </div>
    </header>
  );
};
