import React from 'react';
import './DemoQrCode.css';
import { AlertTriangle } from 'lucide-react';

export const DemoQrCode = ({ amount = 600 }) => {
  return (
    <div className="demo-qr-code bg-white rounded-2xl p-3.5 border-2 border-dashed border-beige-muted flex flex-col items-center text-center shadow-sm">
      {/* Clear Warning Banner */}
      <div className="demo-qr-code__warning w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 mb-2.5 flex items-center justify-center gap-1.5 text-amber-900 font-extrabold text-[10px] uppercase tracking-wider">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>DEMO QR — NOT A REAL PAYMENT CODE</span>
      </div>

      {/* QR Code Container */}
      <div className="demo-qr-code__svg-card relative p-3 bg-white rounded-xl shadow-inner border border-beige-muted/60 mb-2.5">
        {/* Crisp High-Res Stylized QR Code SVG in Charcoal Navy */}
        <svg
          viewBox="0 0 160 160"
          className="demo-qr-code__svg w-36 h-36 sm:w-40 sm:h-40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background */}
          <rect width="160" height="160" fill="white" />

          {/* Top-Left Finder */}
          <rect x="10" y="10" width="40" height="40" rx="6" fill="#1C2A39" />
          <rect x="18" y="18" width="24" height="24" rx="3" fill="white" />
          <rect x="23" y="23" width="14" height="14" rx="2" fill="#1C2A39" />

          {/* Top-Right Finder */}
          <rect x="110" y="10" width="40" height="40" rx="6" fill="#1C2A39" />
          <rect x="118" y="18" width="24" height="24" rx="3" fill="white" />
          <rect x="123" y="23" width="14" height="14" rx="2" fill="#1C2A39" />

          {/* Bottom-Left Finder */}
          <rect x="10" y="110" width="40" height="40" rx="6" fill="#1C2A39" />
          <rect x="18" y="118" width="24" height="24" rx="3" fill="white" />
          <rect x="23" y="123" width="14" height="14" rx="2" fill="#1C2A39" />

          {/* Timing Patterns */}
          <g fill="#1C2A39">
            <rect x="58" y="26" width="6" height="6" rx="1" />
            <rect x="70" y="26" width="6" height="6" rx="1" />
            <rect x="82" y="26" width="6" height="6" rx="1" />
            <rect x="94" y="26" width="6" height="6" rx="1" />

            <rect x="26" y="58" width="6" height="6" rx="1" />
            <rect x="26" y="70" width="6" height="6" rx="1" />
            <rect x="26" y="82" width="6" height="6" rx="1" />
            <rect x="26" y="94" width="6" height="6" rx="1" />

            <rect x="58" y="42" width="6" height="6" rx="1" />
            <rect x="68" y="42" width="12" height="6" rx="1" />
            <rect x="86" y="42" width="6" height="6" rx="1" />
            <rect x="96" y="42" width="12" height="6" rx="1" />

            <rect x="10" y="58" width="8" height="6" rx="1" />
            <rect x="38" y="58" width="14" height="6" rx="1" />
            <rect x="58" y="58" width="6" height="12" rx="1" />
            <rect x="70" y="58" width="18" height="6" rx="1" />
            <rect x="94" y="58" width="10" height="6" rx="1" />
            <rect x="110" y="58" width="16" height="6" rx="1" />
            <rect x="132" y="58" width="18" height="6" rx="1" />

            <rect x="10" y="70" width="12" height="6" rx="1" />
            <rect x="36" y="70" width="10" height="6" rx="1" />
            <rect x="52" y="70" width="12" height="6" rx="1" />
            <rect x="98" y="70" width="14" height="6" rx="1" />
            <rect x="120" y="70" width="10" height="6" rx="1" />
            <rect x="136" y="70" width="14" height="6" rx="1" />

            <rect x="12" y="82" width="8" height="6" rx="1" />
            <rect x="38" y="82" width="10" height="6" rx="1" />
            <rect x="54" y="82" width="16" height="6" rx="1" />
            <rect x="94" y="82" width="12" height="6" rx="1" />
            <rect x="114" y="82" width="16" height="6" rx="1" />
            <rect x="136" y="82" width="14" height="6" rx="1" />

            <rect x="10" y="94" width="10" height="6" rx="1" />
            <rect x="36" y="94" width="12" height="6" rx="1" />
            <rect x="58" y="94" width="10" height="12" rx="1" />
            <rect x="74" y="94" width="14" height="6" rx="1" />
            <rect x="94" y="94" width="8" height="6" rx="1" />
            <rect x="110" y="94" width="14" height="6" rx="1" />
            <rect x="130" y="94" width="20" height="6" rx="1" />

            <rect x="58" y="112" width="16" height="6" rx="1" />
            <rect x="80" y="112" width="10" height="6" rx="1" />
            <rect x="96" y="112" width="18" height="6" rx="1" />
            <rect x="120" y="112" width="14" height="6" rx="1" />
            <rect x="140" y="112" width="10" height="6" rx="1" />

            <rect x="58" y="124" width="8" height="12" rx="1" />
            <rect x="72" y="124" width="14" height="6" rx="1" />
            <rect x="92" y="124" width="12" height="6" rx="1" />
            <rect x="110" y="124" width="8" height="12" rx="1" />
            <rect x="124" y="124" width="26" height="6" rx="1" />

            <rect x="72" y="136" width="14" height="14" rx="1" />
            <rect x="92" y="136" width="12" height="14" rx="1" />
            <rect x="124" y="136" width="26" height="14" rx="1" />
          </g>

          {/* Center Brand Badge */}
          <rect x="66" y="66" width="28" height="28" rx="8" fill="#FFFFFF" stroke="#1C2A39" strokeWidth="2" />
          <path d="M74 76C74 81 78 84 80 84C82 84 86 81 86 76H74Z" fill="#1C2A39" />
          <path d="M86 77C88 77 89 78 89 80C89 82 88 83 86 83" stroke="#1C2A39" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        {/* Amount Pill */}
        <div className="absolute -bottom-2 inset-x-0 flex justify-center">
          <span className="bg-navy text-white px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider shadow">
            ₹{amount}
          </span>
        </div>
      </div>

      <p className="text-xs font-bold text-navy mb-0.5">
        Scan with any UPI app to pay
      </p>

      <div className="flex items-center gap-1.5 justify-center text-[10px] text-taupe-warm font-semibold">
        <span>GPay</span>
        <span>•</span>
        <span>PhonePe</span>
        <span>•</span>
        <span>Paytm</span>
        <span>•</span>
        <span>BHIM</span>
      </div>
    </div>
  );
};
