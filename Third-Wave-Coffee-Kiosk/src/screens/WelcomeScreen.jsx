import React from 'react';
import { TwcLogo } from '../components/TwcLogo';
import { useKiosk } from '../context/KioskContext';
import { useVoiceBarista } from '../context/VoiceBaristaContext';
import { CoffeeMomentIllustration } from '../components/LineArtIllustrations';
import { Utensils, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';

export const WelcomeScreen = () => {
  const { navigateTo, orderType, setOrderType } = useKiosk();
  const { startVoiceSession } = useVoiceBarista();

  const handleStart = () => {
    startVoiceSession();
    navigateTo('mobile');
  };

  return (
    <div
      onClick={handleStart}
      className="relative w-full h-full bg-cream-100 overflow-hidden flex flex-col justify-between cursor-pointer select-none p-6 sm:p-8"
    >
      {/* Subtle Warm Background Aesthetics */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Soft radial warm highlight */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-cream-200/50 filter blur-3xl" />
        
        {/* Minimal 2D navy pencil / line-art background motifs */}
        <svg
          className="absolute inset-0 w-full h-full opacity-10"
          viewBox="0 0 1080 1920"
          fill="none"
        >
          <path
            d="M-50 400 C200 350, 400 500, 700 420 C1000 340, 1100 480, 1200 440"
            stroke="#1C2A39"
            strokeWidth="2.5"
            strokeDasharray="8 8"
          />
          <path
            d="M-50 850 C300 750, 600 950, 900 850 C1200 750, 1300 900, 1500 800"
            stroke="#1C2A39"
            strokeWidth="2"
          />
          <path
            d="M-50 1400 C250 1300, 650 1500, 1000 1380 C1350 1260, 1450 1450, 1600 1350"
            stroke="#1C2A39"
            strokeWidth="1.8"
          />
        </svg>
      </div>

      {/* Top Header: Third Wave Coffee Brand Logo */}
      <header className="relative z-20 w-full pt-2 flex justify-center items-center">
        <div className="bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-beige-muted/60 shadow-sm">
          <TwcLogo variant="dark" className="scale-105" />
        </div>
      </header>

      {/* Central Portrait Hero Content */}
      <main className="relative z-20 w-full flex-1 flex flex-col items-center justify-center my-auto py-2 space-y-5 text-center">
        
        {/* Editorial Subtitle Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-beige-muted/80 text-navy text-[11px] font-black uppercase tracking-[0.22em] shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-twc-terracotta" />
          <span>Specialty Coffee Roasters</span>
        </div>

        {/* Main Headline */}
        <div className="space-y-1.5 px-2">
          <h1 className="text-4xl sm:text-5xl font-black text-navy tracking-tight leading-[1.08] font-sans uppercase">
            GOOD COFFEE.<br />
            <span className="font-serif italic font-normal text-navy/85">
              YOUR WAY.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-taupe-warm font-serif italic tracking-wide">
            Craft your coffee moment
          </p>
        </div>

        {/* Premium Coffee Photography + Minimal 2D Line-Art Blend */}
        <div className="relative w-full max-w-[320px] mx-auto my-1">
          {/* Card Presentation with clean white surface and soft warm shadow */}
          <div className="relative rounded-3xl p-3 bg-white border border-beige-muted/70 shadow-kiosk">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-cream-200">
              <img
                src="https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=800&q=85"
                alt="Third Wave Coffee Cappuccino with Latte Art"
                className="w-full h-full object-cover filter contrast-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent" />
              
              <div className="absolute bottom-2.5 left-3 right-3 text-left">
                <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest font-sans block">
                  100% Arabica
                </span>
                <h4 className="text-sm font-black text-white tracking-tight font-sans">
                  Artisanal House Brew
                </h4>
              </div>
            </div>

            {/* Minimal Navy Line-Art Floating Badge */}
            <div className="absolute -top-6 -right-6 w-20 h-20 pointer-events-none hidden sm:block">
              <CoffeeMomentIllustration className="w-full h-full" color="#1C2A39" />
            </div>
          </div>
        </div>

        {/* Dine-In / Takeaway Selection (clicks don't propagate to start immediately) */}
        <div 
          onClick={(e) => e.stopPropagation()} 
          className="flex items-center p-1 bg-white rounded-2xl border border-beige-muted/80 shadow-sm"
        >
          <button
            type="button"
            onClick={() => setOrderType('dine_in')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              orderType === 'dine_in'
                ? 'bg-navy text-white shadow-sm font-black'
                : 'text-navy/70 hover:text-navy'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Dine In</span>
          </button>

          <button
            type="button"
            onClick={() => setOrderType('takeaway')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              orderType === 'takeaway'
                ? 'bg-navy text-white shadow-sm font-black'
                : 'text-navy/70 hover:text-navy'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Takeaway</span>
          </button>
        </div>

        {/* Primary TOUCH TO START Button in Deep Charcoal Navy */}
        <div className="w-full pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
            className="group relative w-full max-w-xs mx-auto flex items-center justify-center gap-4 py-4 px-8 rounded-2xl bg-navy hover:bg-navy-charcoal text-white font-black text-base uppercase tracking-wider shadow-kiosk transition-all duration-300 hover:scale-102 active:scale-98 border border-navy"
          >
            <span className="font-sans tracking-[0.18em]">
              TOUCH TO START
            </span>
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </button>
        </div>

        <p className="text-[11px] font-semibold text-taupe-warm tracking-wider uppercase font-sans">
          Tap anywhere on screen to begin your order
        </p>

      </main>

      {/* Footer Info */}
      <footer className="relative z-20 w-full text-center text-taupe-warm/70 text-[10px] font-medium tracking-widest uppercase pb-1">
        Specialty Coffee Association (SCA) Standard • India
      </footer>
    </div>
  );
};
