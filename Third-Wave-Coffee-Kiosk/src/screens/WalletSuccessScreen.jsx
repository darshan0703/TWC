import React from 'react';
import './WalletSuccessScreen.css';
import { TwcLogo } from '../components/TwcLogo';
import { useKiosk } from '../context/KioskContext';
import { Check, Wallet, ArrowRight, Sparkles } from 'lucide-react';

export const WalletSuccessScreen = () => {
  const { walletBalance, lastTopupAmount, navigateTo } = useKiosk();

  return (
    <div className="wallet-success-screen w-full h-full bg-cream-100 flex flex-col justify-between p-4 sm:p-6 select-none overflow-y-auto">
      
      {/* Top Header: Logo */}
      <header className="w-full flex justify-center py-2 shrink-0">
        <TwcLogo className="scale-95" />
      </header>

      {/* Main Confirmation Content */}
      <main className="w-full max-w-sm mx-auto my-auto flex flex-col items-center text-center space-y-4 bg-white p-5 rounded-3xl border border-beige-muted/80 shadow-kiosk">
        
        {/* Large Elegant Checkmark inside Soft Beige Circle */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-cream-200 border-2 border-beige-muted flex items-center justify-center text-navy shadow-inner">
            <Check className="w-8 h-8 text-navy stroke-[3]" />
          </div>
          <div className="absolute -inset-1.5 rounded-full border border-navy/20 animate-ping -z-10" />
        </div>

        {/* Headings */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cream-200 text-[10px] font-bold uppercase tracking-wider text-navy">
            <Sparkles className="w-3 h-3 text-twc-terracotta" />
            <span>Simulated Frontend Demo Confirmation</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-navy tracking-tight uppercase font-sans">
            Wallet Top-up Successful
          </h2>

          <p className="text-xs sm:text-sm text-taupe-warm font-serif italic">
            ₹{lastTopupAmount} has been added to your wallet.
          </p>
        </div>

        {/* Wallet Balance Card */}
        <div className="w-full p-3.5 rounded-2xl bg-cream-100 border border-beige-muted/80 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-navy shadow-sm border border-beige-muted/50">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-taupe-warm block">
                Updated Wallet
              </span>
              <span className="text-xs font-bold text-navy">
                Available Balance
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black text-navy font-sans">
              ₹{walletBalance}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => navigateTo('cart')}
            className="w-full py-3.5 rounded-xl bg-navy hover:bg-navy-charcoal active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-kiosk transition-all border border-navy"
          >
            <span>CONTINUE TO ORDER</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>

          <button
            type="button"
            onClick={() => navigateTo('cart')}
            className="w-full py-2.5 rounded-xl bg-white hover:bg-cream-200 border border-beige-muted text-navy text-xs font-extrabold uppercase tracking-wider transition-all"
          >
            BACK TO CART
          </button>
        </div>

      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-taupe-warm font-semibold py-1 shrink-0">
        Third Wave Coffee Kiosk • Instant Contactless Digital Wallet
      </footer>
    </div>
  );
};
