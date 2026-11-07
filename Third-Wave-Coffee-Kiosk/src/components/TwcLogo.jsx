import React from 'react';
import './TwcLogo.css';

export const TwcLogo = ({ className = 'h-9', variant = 'dark' }) => {
  const isLight = variant === 'light';

  return (
    <div className={`twc-logo ${isLight ? 'twc-logo--light' : 'twc-logo--dark'} ${className}`}>
      {/* Third Wave Coffee Cup Icon from Official Logo */}
      <img
        src="/twc-cup-logo.png"
        alt="Third Wave Coffee"
        className={`twc-logo__cup-icon ${isLight ? 'brightness-0 invert' : ''}`}
      />

      {/* Brand Wordmark in ONE Single Line */}
      <span className="twc-logo__wordmark-single">
        THIRD WAVE COFFEE
      </span>
    </div>
  );
};
