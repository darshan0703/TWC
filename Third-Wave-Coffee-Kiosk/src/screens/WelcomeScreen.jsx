import React from 'react';
import { useKiosk } from '../context/KioskContext';
import { useVoiceBarista } from '../context/VoiceBaristaContext';

export const WelcomeScreen = () => {
  const { navigateTo } = useKiosk();
  const { startVoiceSession } = useVoiceBarista();

  const handleStart = () => {
    startVoiceSession();
    navigateTo('mobile');
  };

  return (
    <div className="relative w-full h-full bg-[#1C2A39] overflow-hidden flex flex-col select-none m-0 p-0 border-0">
      {/* 1. MAIN: Full-Bleed Rectangular Media Area (Uploaded Video - Zero Overlays) */}
      <main className="relative w-full flex-1 min-h-0 overflow-hidden bg-[#1C2A39] m-0 p-0 border-0 outline-none">
        <video
          className="w-full h-full object-cover block m-0 p-0 border-0 outline-none"
          style={{ objectPosition: 'center top' }}
          autoPlay
          muted
          loop
          playsInline
          poster="/welcome-video-poster.jpg"
        >
          <source src="/welcome-video.mp4" type="video/mp4" />
          <source src="/Video%20Project%206.mp4" type="video/mp4" />
          <img
            src="/welcome-video-poster.jpg"
            alt="Third Wave Coffee"
            className="w-full h-full object-cover block m-0 p-0 border-0"
            style={{ objectPosition: 'center top' }}
          />
        </video>
      </main>

      {/* 2. BOTTOM: Full-Width Rectangular "TOUCH TO START" CTA (Seamlessly connected to video) */}
      <footer className="w-full shrink-0 m-0 p-0 border-0 outline-none bg-[#1C2A39] block">
        <button
          type="button"
          onClick={handleStart}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleStart();
            }
          }}
          className="w-full h-16 sm:h-20 md:h-24 bg-[#1C2A39] active:bg-[#121c27] text-[#F8F5EE] flex items-center justify-center px-4 cursor-pointer border-0 outline-none focus:outline-none focus:ring-4 focus:ring-inset focus:ring-twc-terracotta/50 transition-colors m-0 p-0 rounded-none shadow-none block"
          aria-label="Touch to start kiosk order"
        >
          <span className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-[0.16em] sm:tracking-[0.2em] font-sans text-center select-none whitespace-nowrap">
            TOUCH TO START
          </span>
        </button>
      </footer>
    </div>
  );
};
