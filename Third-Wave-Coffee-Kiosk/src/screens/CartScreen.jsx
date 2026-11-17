import React, { useState } from 'react';
import './CartScreen.css';
import { KioskHeader } from '../components/KioskHeader';
import { BillSummary } from '../components/BillSummary';
import { CART_RECOMMENDATIONS } from '../data/products';
import { useKiosk } from '../context/KioskContext';
import { Trash2, Plus, Minus, ArrowRight, Wallet, CreditCard, Sparkles, ShoppingBag } from 'lucide-react';

export const CartScreen = () => {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    cartTotals,
    addDirectToCart,
    navigateTo,
    confirmOrder,
    walletBalance
  } = useKiosk();

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handlePayNow = () => {
    setShowPaymentModal(true);
  };

  const handleCompletePayment = (method) => {
    setShowPaymentModal(false);
    confirmOrder(method);
  };

  return (
    <div className="cart-screen w-full h-full bg-cream-100 flex flex-col justify-between select-none overflow-hidden">
      
      {/* Header */}
      <KioskHeader
        title="Your Cart"
        subtitle="Review tray"
        showBack={true}
        showCart={false}
        onBackOverride={() => navigateTo('menu')}
      />

      {/* Main Content Area (Vertically Scrollable) */}
      <main className="w-full px-3.5 sm:px-4 py-3 flex-1 overflow-y-auto space-y-3.5">
        
        {/* Cart Top Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-beige-muted/70">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-navy tracking-tight uppercase font-sans">
              Your Order Tray
            </h2>
            <p className="text-[11px] text-taupe-warm font-serif italic">
              Review your customized specialty beverages & bakes
            </p>
          </div>
        </div>

        {cart.length > 0 ? (
          <div className="space-y-3.5">
            
            {/* Cart Items List */}
            <div className="space-y-1.5 sm:space-y-2">
              {cart.map((item) => (
                <div
                  key={item.cartId}
                  className="flex items-center justify-between gap-2.5 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl bg-white border border-beige-muted/80 shadow-sm"
                >
                  {/* Thumbnail & Product Info on the Left */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-cover shrink-0 border border-beige-muted/50"
                    />

                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-[13px] font-black text-navy font-sans truncate leading-tight">
                        {item.name}
                      </h4>

                      {item.customizationsSummary && item.customizationsSummary.length > 0 && (
                        <p className="text-[10px] text-taupe-warm truncate leading-tight mt-0.5">
                          {item.customizationsSummary.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quantity Controls, Price & Remove on the Right */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Stepper Controls */}
                    <div className="flex items-center gap-1 bg-cream-100 rounded-lg border border-beige-muted p-0.5">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.cartId, -1)}
                        className="w-5.5 h-5.5 rounded-md bg-white text-navy flex items-center justify-center hover:bg-cream-200 transition-all active:scale-95 shadow-sm"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>

                      <span className="text-xs font-black text-navy w-4 text-center font-sans">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.cartId, 1)}
                        className="w-5.5 h-5.5 rounded-md bg-white text-navy flex items-center justify-center hover:bg-cream-200 transition-all active:scale-95 shadow-sm"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* Product Price (Right-aligned) */}
                    <div className="min-w-[46px] sm:min-w-[54px] text-right text-xs sm:text-[13px] font-black text-navy font-sans">
                      ₹{item.totalPrice || item.unitPrice * item.quantity}
                    </div>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.cartId)}
                      className="w-6.5 h-6.5 rounded-lg bg-cream-200 hover:bg-red-50 text-navy/60 hover:text-red-700 flex items-center justify-center transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* "You may also enjoy" Recommendation Tray */}
            <div className="p-3 rounded-2xl bg-cream-200/60 border border-beige-muted/80">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-twc-terracotta" />
                <h4 className="text-[11px] font-black uppercase tracking-wider text-navy font-sans">
                  You May Also Enjoy
                </h4>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {CART_RECOMMENDATIONS.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-white rounded-xl p-2 border border-beige-muted/80 flex flex-col justify-between shadow-sm"
                  >
                    <img
                      src={rec.image}
                      alt={rec.name}
                      className="w-full h-12 rounded-lg object-cover mb-1"
                    />
                    <div className="min-w-0">
                      <h5 className="text-[10px] font-black text-navy truncate">
                        {rec.name}
                      </h5>
                      <span className="text-[10px] font-black text-navy block">
                        ₹{rec.price}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addDirectToCart(rec)}
                      title="Add to tray"
                      className="w-full mt-1.5 py-0.5 rounded bg-cream-100 hover:bg-navy hover:text-white text-navy text-[9px] font-bold uppercase transition-colors border border-beige-muted"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Bill Summary */}
            <BillSummary
              totals={cartTotals}
              note="Review your order before payment"
            />

            {/* Wallet Info Banner */}
            <div className="p-3 rounded-xl bg-white border border-beige-muted/80 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cream-200 flex items-center justify-center text-navy">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-taupe-warm block">
                    Third Wave Wallet
                  </span>
                  <span className="text-xs font-black text-navy font-sans">
                    Balance: ₹{walletBalance}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigateTo('wallet_topup')}
                className="px-2.5 py-1 rounded-lg bg-cream-200 hover:bg-beige text-navy text-[10px] font-bold uppercase tracking-wider transition-colors"
              >
                Top Up
              </button>
            </div>

          </div>
        ) : (
          /* Empty Cart State */
          <div className="text-center py-12 bg-white rounded-2xl border border-beige-muted/80 p-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-cream-200 flex items-center justify-center mx-auto text-taupe-warm">
              <ShoppingBag className="w-8 h-8 text-navy/40" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-navy font-sans">
                Your Tray is Empty
              </h3>
              <p className="text-xs text-taupe-warm font-serif italic">
                Add some of our freshly roasted coffees or sweet pastries
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigateTo('menu')}
              className="px-6 py-2.5 bg-navy text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow"
            >
              Explore Menu
            </button>
          </div>
        )}

      </main>

      {/* Sticky Bottom Actions inside Portrait Kiosk */}
      {cart.length > 0 && (
        <footer className="sticky bottom-0 z-30 w-full bg-cream-100/95 backdrop-blur-md border-t border-beige-muted/80 px-4 py-3 shadow-lg flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handlePayNow}
            className="flex-1 h-12 px-3 rounded-xl bg-navy hover:bg-navy-charcoal active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-kiosk border border-navy transition-all"
          >
            <CreditCard className="w-4 h-4 text-white shrink-0" />
            <span className="truncate">PAY NOW • ₹{cartTotals.totalPayable}</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('wallet_topup')}
            className="flex-1 h-12 px-3 rounded-xl bg-white hover:bg-cream-200 active:scale-[0.98] border border-beige-muted text-navy text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Wallet className="w-3.5 h-3.5 text-navy shrink-0" />
            <span className="truncate">LOAD THIRD WAVE WALLET</span>
          </button>
        </footer>
      )}

      {/* Simulated Payment Modal */}
      {showPaymentModal && (
        <div className="absolute inset-0 z-50 bg-navy/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full border border-beige-muted shadow-2xl space-y-3.5 animate-scale-in">
            
            <div className="flex items-center justify-between border-b border-beige-muted/80 pb-2.5">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-twc-terracotta">
                  Simulated Checkout
                </span>
                <h3 className="text-base sm:text-lg font-black text-navy font-sans">
                  Select Payment Method
                </h3>
              </div>
              <span className="text-lg sm:text-xl font-black text-navy">
                ₹{cartTotals.totalPayable}
              </span>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleCompletePayment('Third Wave Wallet')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-beige-muted hover:border-navy hover:bg-cream-100 transition-all text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cream-200 flex items-center justify-center text-navy">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-navy block">
                      Third Wave Wallet
                    </span>
                    <span className="text-[10px] text-taupe-warm font-medium">
                      Available: ₹{walletBalance}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-navy" />
              </button>

              <button
                type="button"
                onClick={() => handleCompletePayment('UPI (GPay / PhonePe / Paytm)')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-beige-muted hover:border-navy hover:bg-cream-100 transition-all text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cream-200 flex items-center justify-center text-navy">
                    <span className="font-black text-[10px]">UPI</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-navy block">
                      UPI / QR Code
                    </span>
                    <span className="text-[10px] text-taupe-warm font-medium">
                      GPay, PhonePe, Paytm, CRED
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-navy" />
              </button>

              <button
                type="button"
                onClick={() => handleCompletePayment('Card at Counter')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-beige-muted hover:border-navy hover:bg-cream-100 transition-all text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cream-200 flex items-center justify-center text-navy">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-navy block">
                      Card Tap
                    </span>
                    <span className="text-[10px] text-taupe-warm font-medium">
                      Tap contactless card on terminal
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-navy" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="w-full py-2 bg-cream-200 hover:bg-beige text-navy rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all"
            >
              Cancel
            </button>

          </div>
        </div>
      )}

    </div>
  );
};
