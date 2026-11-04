import React from 'react';
import { TwcLogo } from '../components/TwcLogo';
import { useKiosk } from '../context/KioskContext';
import { Check, Sparkles, RotateCcw, Coffee } from 'lucide-react';

export const OrderConfirmationScreen = () => {
  const { lastOrder, startNewOrder } = useKiosk();

  // Fallback demo order if directly previewed
  const order = lastOrder || {
    orderNumber: 'TWC-1024',
    orderType: 'dine_in',
    items: [
      {
        name: 'Cappuccino',
        quantity: 1,
        totalPrice: 260,
        customizationsSummary: ['Regular (240ml)', 'Hot']
      },
      {
        name: 'French Butter Croissant',
        quantity: 1,
        totalPrice: 195,
        customizationsSummary: ['Café Fresh']
      }
    ],
    total: 478,
    timestamp: 'Just now',
    mobileNumber: '98765 43210',
    status: 'Preparing'
  };

  return (
    <div className="relative w-full h-full bg-cream-100 flex flex-col justify-between p-4 sm:p-6 select-none overflow-y-auto">
      
      {/* Background Soft Line Art Graphic */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <svg viewBox="0 0 1000 1000" className="w-full h-full" preserveAspectRatio="none">
          <path
            d="M0,300 C300,200 400,500 1000,350 L1000,1000 L0,1000 Z"
            fill="#1C2A39"
          />
        </svg>
      </div>

      {/* Top Header: Logo */}
      <header className="relative z-10 w-full flex justify-center py-2 shrink-0">
        <TwcLogo className="scale-95" />
      </header>

      {/* Main Confirmation Content */}
      <main className="relative z-10 w-full max-w-sm mx-auto my-auto flex flex-col items-center text-center space-y-4 bg-white p-5 rounded-3xl border border-beige-muted/80 shadow-kiosk">
        
        {/* Large Confirmation Checkmark */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-cream-200 border-2 border-beige-muted flex items-center justify-center text-navy shadow-inner">
            <Check className="w-8 h-8 text-navy stroke-[3]" />
          </div>
          <div className="absolute -inset-1.5 rounded-full border border-navy/20 animate-ping -z-10" />
        </div>

        {/* Headings & Order Token */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cream-200 text-[10px] font-bold uppercase tracking-wider text-navy">
            <Coffee className="w-3 h-3 text-navy" />
            <span>Serving: {order.orderType === 'dine_in' ? 'Dine In' : 'Takeaway'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-navy tracking-tight uppercase font-sans">
            Order Confirmed!
          </h2>

          <div className="pt-0.5">
            <span className="px-4 py-1.5 rounded-xl bg-navy text-white text-base font-black font-sans tracking-widest inline-block shadow-sm">
              Order #{order.orderNumber}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-taupe-warm font-serif italic pt-0.5">
            Your coffee is being prepared.
          </p>
        </div>

        {/* Reassuring Progress Indicator */}
        <div className="w-full py-2.5 px-3.5 rounded-xl bg-cream-100 border border-beige-muted/70">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-navy mb-2">
            <span className="text-emerald-800 flex items-center gap-1">
              <Check className="w-3 h-3" /> Received
            </span>
            <span className="text-navy flex items-center gap-1 font-extrabold">
              <Sparkles className="w-3 h-3 text-twc-terracotta" /> Preparing
            </span>
            <span className="text-taupe-warm opacity-60">
              Pickup
            </span>
          </div>

          <div className="relative w-full h-1.5 bg-cream-200 rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-2/3 bg-navy rounded-full" />
          </div>
        </div>

        {/* Small Order Summary */}
        <div className="w-full text-left space-y-1.5 bg-cream-100/60 p-3 rounded-xl border border-beige-muted/60">
          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-taupe-warm pb-1.5 border-b border-beige-muted/60">
            <span>Ordered Items</span>
            <span className="text-navy font-black">Total: ₹{order.total}</span>
          </div>

          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-black text-navy">{item.quantity}x</span>
                  <span className="font-bold text-navy truncate">{item.name}</span>
                </div>
                <span className="font-extrabold text-navy font-sans shrink-0 ml-2">
                  ₹{item.totalPrice}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Primary Button: START A NEW ORDER */}
        <div className="w-full pt-1">
          <button
            type="button"
            onClick={startNewOrder}
            className="w-full py-3.5 rounded-xl bg-navy hover:bg-navy-charcoal active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-kiosk border border-navy transition-all"
          >
            <RotateCcw className="w-4 h-4 text-white" />
            <span>START A NEW ORDER</span>
          </button>
        </div>

        <p className="text-[10px] text-taupe-warm font-medium">
          Please retain your order token. Your number will be called at the counter.
        </p>

      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[10px] text-taupe-warm font-semibold py-1 shrink-0">
        Third Wave Coffee India • Specialty Coffee & Roasters
      </footer>
    </div>
  );
};
