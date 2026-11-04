import React, { useState } from 'react';
import { KioskHeader } from '../components/KioskHeader';
import { DemoQrCode } from '../components/DemoQrCode';
import { useKiosk } from '../context/KioskContext';
import { Wallet, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';

export const WalletTopUpScreen = () => {
  const {
    walletBalance,
    selectedTopupAmount,
    setSelectedTopupAmount,
    customTopupInput,
    setCustomTopupInput,
    processWalletTopup,
    navigateTo
  } = useKiosk();

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [error, setError] = useState('');

  const PRESET_AMOUNTS = [300, 600, 1000];

  const handleSelectPreset = (amt) => {
    setIsCustomMode(false);
    setSelectedTopupAmount(amt);
    setCustomTopupInput('');
    setError('');
  };

  const handleCustomSelect = () => {
    setIsCustomMode(true);
    if (!customTopupInput) {
      setCustomTopupInput('500');
      setSelectedTopupAmount(500);
    }
  };

  const handleCustomChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomTopupInput(val);
    const num = Number(val) || 0;
    if (num > 0) {
      setSelectedTopupAmount(num);
      setError('');
    } else {
      setError('Please enter an amount greater than ₹0');
    }
  };

  const handlePay = () => {
    const finalAmt = isCustomMode ? Number(customTopupInput) : selectedTopupAmount;
    if (!finalAmt || finalAmt <= 0) {
      setError('Please choose or enter a valid top-up amount');
      return;
    }
    processWalletTopup(finalAmt);
  };

  const effectiveAmount = isCustomMode ? (Number(customTopupInput) || 0) : selectedTopupAmount;

  return (
    <div className="w-full h-full bg-cream-100 flex flex-col justify-between select-none overflow-hidden">
      
      {/* Kiosk Header */}
      <KioskHeader
        title="Wallet Top-Up"
        subtitle="Contactless checkout"
        showBack={true}
        showCart={true}
        onBackOverride={() => navigateTo('cart')}
      />

      {/* Main Content (Vertically Scrollable) */}
      <main className="w-full px-4 py-3 flex-1 overflow-y-auto space-y-3.5">
        
        {/* Wallet Hero Card in Deep Charcoal Navy */}
        <div className="rounded-2xl p-4 bg-navy text-white shadow-sm border border-navy relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-beige-muted block">
                  Third Wave Pass
                </span>
                <h3 className="text-base font-black text-white">
                  Digital Café Wallet
                </h3>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-beige-muted uppercase tracking-wider block">
                Balance
              </span>
              <span className="text-xl font-black text-white font-sans">
                ₹{walletBalance}
              </span>
            </div>
          </div>

          <p className="text-xs text-white/80 font-serif italic">
            Enjoy smoother coffee checkout with one-tap digital payments.
          </p>
        </div>

        {/* Amount Presets */}
        <div className="bg-white rounded-2xl p-3.5 border border-beige-muted/80 shadow-sm space-y-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-taupe-warm block">
              Choose Top-Up Amount
            </span>
            <h4 className="text-base font-black text-navy font-sans">
              Select or Enter Amount
            </h4>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map((amt) => {
              const isSelected = !isCustomMode && selectedTopupAmount === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleSelectPreset(amt)}
                  className={`py-2.5 px-2 rounded-xl border-2 text-center transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-beige border-navy text-navy font-black shadow-sm ring-1 ring-navy/20'
                      : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold'
                  }`}
                >
                  <span className="text-[9px] text-taupe-warm font-semibold block uppercase">
                    {amt === 600 ? 'Popular' : 'Top-up'}
                  </span>
                  <span className="text-base font-black text-navy font-sans">
                    ₹{amt}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleCustomSelect}
              className={`py-2.5 px-2 rounded-xl border-2 text-center transition-all active:scale-95 ${
                isCustomMode
                  ? 'bg-beige border-navy text-navy font-black shadow-sm ring-1 ring-navy/20'
                  : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold'
              }`}
            >
              <span className="text-[9px] text-taupe-warm font-semibold block uppercase">
                Other
              </span>
              <span className="text-xs font-black text-navy font-sans">
                Custom
              </span>
            </button>
          </div>

          {/* Custom Amount Numeric Input */}
          {isCustomMode && (
            <div className="pt-1 animate-scale-in">
              <label className="text-[10px] font-bold text-navy uppercase tracking-wider block mb-1">
                Enter Custom Amount (₹)
              </label>
              <div className="relative flex items-center bg-cream-100 rounded-xl border-2 border-navy p-1.5">
                <span className="text-base font-black text-navy px-3 font-sans">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customTopupInput}
                  onChange={handleCustomChange}
                  placeholder="e.g. 500"
                  className="w-full bg-transparent text-base font-black text-navy focus:outline-none font-sans"
                  autoFocus
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 text-red-600 text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Selected Amount Banner */}
          <div className="p-2 rounded-xl bg-cream-100 border border-beige-muted/60 flex items-center justify-between">
            <span className="text-xs font-bold text-navy uppercase tracking-wider">
              Selected Top-up:
            </span>
            <span className="text-base font-black text-navy font-sans">
              ₹{effectiveAmount}
            </span>
          </div>
        </div>

        {/* Demo QR Code Panel */}
        <DemoQrCode amount={effectiveAmount} />

        {/* Security Note */}
        <div className="flex items-center gap-1.5 text-[10px] text-taupe-warm font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-navy shrink-0" />
          <span>Simulated frontend demonstration • No real charge</span>
        </div>

      </main>

      {/* Sticky Bottom Actions inside Portrait Kiosk */}
      <footer className="sticky bottom-0 z-30 w-full bg-cream-100/95 backdrop-blur-md border-t border-beige-muted/80 px-4 py-3 shadow-lg space-y-1.5 shrink-0">
        <button
          type="button"
          onClick={handlePay}
          disabled={effectiveAmount <= 0}
          className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-kiosk transition-all active:scale-[0.98] ${
            effectiveAmount > 0
              ? 'bg-navy hover:bg-navy-charcoal text-white cursor-pointer border border-navy'
              : 'bg-beige-muted text-navy/40 cursor-not-allowed border border-beige-muted'
          }`}
        >
          <span>PAY ₹{effectiveAmount}</span>
          <ArrowRight className="w-4 h-4 text-white" />
        </button>

        <button
          type="button"
          onClick={() => navigateTo('cart')}
          className="w-full py-1.5 text-[11px] font-bold uppercase tracking-wider text-taupe-warm hover:text-navy text-center transition-colors"
        >
          BACK TO CART
        </button>
      </footer>

    </div>
  );
};
