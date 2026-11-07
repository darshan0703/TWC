import React, { useState } from 'react';
import './CartScreen.css';
import { KioskHeader } from '../components/KioskHeader';
import { BillSummary } from '../components/BillSummary';
import { CART_RECOMMENDATIONS } from '../data/products';
import { useKiosk } from '../context/KioskContext';
import { Trash2, Plus, Minus, ArrowRight, Wallet, CreditCard, Sparkles, AlertCircle, ShoppingBag } from 'lucide-react';

export const CartScreen = () => {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartTotals,
    addDirectToCart,
    navigateTo,
    confirmOrder,
    walletBalance
  } = useKiosk();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
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

          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-700 hover:bg-red-50 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {cart.length > 0 ? (
          <div className="space-y-3.5">
            
            {/* Cart Items List */}
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.cartId}
                  className="flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl bg-white border border-beige-muted/80 shadow-sm"
                >
                  {/* Thumbnail & Info */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-13 h-13 rounded-xl object-cover shrink-0 border border-beige-muted/50"
                    />

                    <div className="min-w-0 space-y-0.5">
                      <h4 className="text-xs sm:text-sm font-black text-navy font-sans truncate">
                        {item.name}
                      </h4>

                      {item.customizationsSummary && item.customizationsSummary.length > 0 && (
                        <p className="text-[10px] text-taupe-warm truncate">
                          {item.customizationsSummary.join(', ')}
                        </p>
                      )}

                      <div className="text-xs font-black text-navy">
                        ₹{item.totalPrice || item.unitPrice * item.quantity}
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-cream-100 rounded-xl border border-beige-muted p-0.5">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.cartId, -1)}
                        className="w-6 h-6 rounded-lg bg-white text-navy flex items-center justify-center hover:bg-cream-200 transition-all active:scale-95 shadow-sm"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <span className="text-xs font-black text-navy w-4 text-center font-sans">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.cartId, 1)}
                        className="w-6 h-6 rounded-lg bg-white text-navy flex items-center justify-center hover:bg-cream-200 transition-all active:scale-95 shadow-sm"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.cartId)}
                      className="w-7 h-7 rounded-lg bg-cream-200 hover:bg-red-50 text-navy/60 hover:text-red-700 flex items-center justify-center transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
        <footer className="sticky bottom-0 z-30 w-full bg-cream-100/95 backdrop-blur-md border-t border-beige-muted/80 px-4 py-3 shadow-lg space-y-2 shrink-0">
          <button
            type="button"
            onClick={handlePayNow}
            className="w-full py-3.5 rounded-xl bg-navy hover:bg-navy-charcoal active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-kiosk border border-navy transition-all"
          >
            <CreditCard className="w-4 h-4 text-white" />
            <span>PAY NOW • ₹{cartTotals.totalPayable}</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('wallet_topup')}
            className="w-full py-2.5 rounded-xl bg-white hover:bg-cream-200 active:scale-[0.98] border border-beige-muted text-navy text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Wallet className="w-3.5 h-3.5 text-navy" />
            <span>LOAD THIRD WAVE WALLET</span>
          </button>
        </footer>
      )}

      {/* Clear Cart Confirmation Modal */}
      {showClearConfirm && (
        <div className="absolute inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full border border-beige-muted shadow-2xl text-center space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-700 flex items-center justify-center mx-auto border border-red-200">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-navy font-sans">
                Clear Cart?
              </h3>
              <p className="text-xs text-taupe-warm font-serif italic mt-0.5">
                Remove all items from your order tray?
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  clearCart();
                  setShowClearConfirm(false);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-wider"
              >
                Clear All
              </button>

              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 bg-cream-200 hover:bg-beige text-navy rounded-xl font-bold uppercase text-[10px] tracking-wider"
              >
                Keep Items
              </button>
            </div>
          </div>
        </div>
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
