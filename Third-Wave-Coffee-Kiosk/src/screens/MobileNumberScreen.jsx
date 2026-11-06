import React, { useState } from 'react';
import { TwcLogo } from '../components/TwcLogo';
import { TouchKeypad } from '../components/TouchKeypad';
import { useKiosk } from '../context/KioskContext';
import { useVoiceBarista } from '../context/VoiceBaristaContext';
import { ShieldCheck, ArrowRight, AlertCircle, Check, RotateCcw } from 'lucide-react';

export const MobileNumberScreen = () => {
  const { mobileNumber, setMobileNumber, navigateTo } = useKiosk();
  const {
    isAwaitingConfirmation,
    confirmNumber,
    cancelConfirmation,
    setIsAwaitingConfirmation,
  } = useVoiceBarista();
  const [error, setError] = useState('');

  const handleKeyPress = (num) => {
    if (isAwaitingConfirmation && setIsAwaitingConfirmation) {
      setIsAwaitingConfirmation(false);
    }
    if (mobileNumber.length >= 10) return;
    const nextVal = mobileNumber + num;
    setMobileNumber(nextVal);
    if (nextVal.length === 10) {
      setError('');
    }
  };

  const handleBackspace = () => {
    if (isAwaitingConfirmation && setIsAwaitingConfirmation) {
      setIsAwaitingConfirmation(false);
    }
    setMobileNumber(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    if (isAwaitingConfirmation && setIsAwaitingConfirmation) {
      setIsAwaitingConfirmation(false);
    }
    setMobileNumber('');
    setError('');
  };

  const handleContinue = () => {
    if (mobileNumber.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    setError('');
    navigateTo('categories');
  };

  const handleSkip = () => {
    setError('');
    navigateTo('categories');
  };

  // Format 10-digit number like "98765 43210"
  const formattedDisplay = () => {
    if (!mobileNumber) return '';
    if (mobileNumber.length <= 5) return mobileNumber;
    return `${mobileNumber.slice(0, 5)} ${mobileNumber.slice(5)}`;
  };

  return (
    <div className="w-full h-full bg-cream-100 flex flex-col justify-between p-4 sm:p-6 select-none overflow-y-auto">
      
      {/* Top Header: Brand Logo */}
      <header className="w-full flex justify-center py-2 shrink-0">
        <TwcLogo className="scale-95" />
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-sm mx-auto my-auto flex flex-col items-center text-center space-y-4">
        
        {/* Headings */}
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black text-navy tracking-tight font-sans transition-all">
            {isAwaitingConfirmation ? 'Is the number correct?' : 'Enter your mobile number'}
          </h2>
          <p className="text-xs sm:text-sm text-taupe-warm font-serif italic">
            {isAwaitingConfirmation ? 'Say "Yes" to confirm or "No" to re-enter' : 'Welcome to Third Wave Coffee'}
          </p>
        </div>

        {/* Phone Input Box with India Flag & +91 */}
        <div className="w-full">
          <div className={`relative flex items-center bg-white rounded-2xl border-2 transition-all p-2.5 sm:p-3 shadow-sm ${
            error 
              ? 'border-red-400 ring-2 ring-red-100' 
              : isAwaitingConfirmation
                ? 'border-navy ring-2 ring-navy/20 shadow-md'
                : 'border-beige-muted hover:border-navy/40 focus-within:border-navy'
          }`}>
            {/* Country Code Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cream-200 border border-beige-muted/60 shrink-0">
              <span className="text-base" role="img" aria-label="India Flag">🇮🇳</span>
              <span className="text-sm font-black text-navy font-sans">+91</span>
            </div>

            {/* Display digits */}
            <div className="flex-1 px-3 text-left">
              {mobileNumber ? (
                <span className="text-xl sm:text-2xl font-extrabold text-navy tracking-widest font-sans">
                  {formattedDisplay()}
                </span>
              ) : (
                <span className="text-base sm:text-lg font-medium text-taupe-warm/60 tracking-wider">
                  Mobile Number
                </span>
              )}
            </div>

            {/* Digit counter */}
            <div className="px-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                mobileNumber.length === 10
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-cream-200 text-taupe-warm'
              }`}>
                {mobileNumber.length}/10
              </span>
            </div>
          </div>

          {/* Inline friendly error */}
          {error && (
            <div className="flex items-center justify-center gap-1.5 text-red-600 text-[11px] font-bold mt-1.5 animate-shake">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Touch Keypad */}
        <div className="w-full">
          <TouchKeypad
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onClear={handleClear}
          />
        </div>

        {/* Action Buttons: Continue & Skip / Voice Confirmation */}
        <div className="w-full flex flex-col gap-2 pt-1">
          {isAwaitingConfirmation ? (
            <>
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => confirmNumber ? confirmNumber() : handleContinue()}
                  className="flex-1 py-3.5 rounded-xl bg-navy hover:bg-navy-charcoal text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 border border-navy transition-all"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>YES, IT'S CORRECT</span>
                </button>

                <button
                  type="button"
                  onClick={() => cancelConfirmation ? cancelConfirmation() : handleClear()}
                  className="flex-1 py-3.5 rounded-xl bg-white hover:bg-cream-200 text-navy text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 border border-beige-muted transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-navy/70" />
                  <span>NO, RE-ENTER</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSkip}
                className="w-full py-1.5 text-[11px] font-bold uppercase tracking-widest text-navy/60 hover:text-navy transition-colors"
              >
                SKIP FOR NOW / CONTINUE AS GUEST
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleContinue}
                disabled={mobileNumber.length > 0 && mobileNumber.length < 10}
                className={`w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-sm ${
                  mobileNumber.length === 10
                    ? 'bg-navy hover:bg-navy-charcoal text-white cursor-pointer border border-navy'
                    : 'bg-beige-muted text-navy/40 cursor-not-allowed border border-beige-muted'
                }`}
              >
                <span>CONTINUE</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>

              <button
                type="button"
                onClick={handleSkip}
                className="w-full py-2 text-xs font-bold uppercase tracking-widest text-navy/70 hover:text-navy transition-colors"
              >
                SKIP FOR NOW / CONTINUE AS GUEST
              </button>
            </>
          )}
        </div>

        {/* Privacy Note */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-taupe-warm font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-navy shrink-0" />
          <span>Your number helps us personalize your order & rewards</span>
        </div>

      </main>

      {/* Minimal Footer */}
      <footer className="text-center text-[10px] text-taupe-warm font-semibold py-1 shrink-0">
        Third Wave Coffee Kiosk • Touchscreen Self-Ordering
      </footer>
    </div>
  );
};
