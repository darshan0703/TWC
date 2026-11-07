import React from 'react';
import './TwcLogo.css';

export const TwcLogo = ({ className = 'h-10', variant = 'dark' }) => {
  const isLight = variant === 'light';
  const waveColor = isLight ? '#EAE3D9' : '#1C2A39';
  const textColor = isLight ? '#FFFFFF' : '#1C2A39';

  return (
    <div className={`twc-logo ${isLight ? 'twc-logo--light' : 'twc-logo--dark'} flex items-center gap-2.5 select-none ${className}`}>
      {/* Triple Wave Specialty Coffee Icon */}
      <div className={`twc-logo__icon-wrapper relative flex items-center justify-center w-9 h-9 rounded-full ${
        isLight ? 'bg-white/10 border border-white/20' : 'bg-cream-200/90 border border-beige-muted/70'
      } p-1.5 shadow-sm shrink-0`}>
        <svg viewBox="0 0 32 32" className="twc-logo__svg w-full h-full" fill="none">
          {/* Three harmonious coffee extraction waves */}
          <path
            d="M5 12C9 10 13 15 17 12C21 9 24 14 27 12"
            stroke={waveColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M5 17C9 15 13 20 17 17C21 14 24 19 27 17"
            stroke={textColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M5 22C9 20 13 25 17 22C21 19 24 24 27 22"
            stroke={waveColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeOpacity="0.8"
          />
        </svg>
      </div>

      {/* Brand Wordmark */}
      <div className="twc-logo__wordmark flex flex-col leading-none text-left">
        <span className="twc-logo__title text-[15px] font-black tracking-[0.2em] uppercase font-sans">
          THIRD WAVE
        </span>
        <span className="twc-logo__subtitle text-[9px] font-bold tracking-[0.38em] uppercase font-sans mt-0.5">
          COFFEE
        </span>
      </div>
    </div>
  );
};
