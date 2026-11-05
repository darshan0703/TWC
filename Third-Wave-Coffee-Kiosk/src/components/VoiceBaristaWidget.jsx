import React from 'react';
import { useVoiceBarista } from '../context/VoiceBaristaContext';
import { useKiosk } from '../context/KioskContext';
import {
  Mic,
  Volume2,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

/**
 * Minimal Voice Indicator for Third Wave Coffee Kiosk
 *
 * Implements a small, elegant voice-status indicator with exactly 5 states:
 * 1. Idle: Small microphone icon with "Touch to start"
 * 2. Listening: Small animated microphone icon with "Listening..."
 * 3. Processing: Small subtle animated indicator with "Processing..."
 * 4. Speaking: Small speaker or sound-wave animation with "Speaking..."
 * 5. Error: Small microphone/error indicator with a brief error message
 *
 * Strictly NO chat boxes, prompt inputs, speech bubbles, or conversation transcripts.
 */
export const VoiceBaristaWidget = () => {
  const {
    voiceState,
    sessionActive,
    errorMessage,
    startVoiceSession,
    startListening,
    stopListeningAndProcess,
    interruptSpeaking,
  } = useVoiceBarista();

  const { currentScreen, navigateTo } = useKiosk();

  // On the welcome screen, suppress the voice widget and all error notifications completely
  if (currentScreen === 'welcome') {
    return null;
  }

  // Unified click/touch handler on the indicator
  const handleClick = (e) => {
    e.stopPropagation();

    // Welcome Screen Touch-to-Start
    if (currentScreen === 'welcome' && !sessionActive) {
      startVoiceSession();
      navigateTo('mobile');
      return;
    }

    if (voiceState === 'listening') {
      // Tap to complete listening and trigger processing
      stopListeningAndProcess();
    } else if (voiceState === 'speaking' || voiceState === 'greeting') {
      // Barge-in: interrupt speech and start listening
      interruptSpeaking();
      startListening();
    } else if (voiceState === 'error' || voiceState === 'idle') {
      // Tap to start listening / retry
      startListening();
    }
  };

  // Adaptive bottom placement based on active screen to avoid overlapping action bars
  const getBottomClass = () => {
    switch (currentScreen) {
      case 'menu':
      case 'categories':
        // Float cleanly right above KioskFooter (~52px)
        return 'bottom-[4.5rem]';
      case 'customization':
      case 'cart':
      case 'wallet_topup':
        // Float cleanly right above sticky action buttons (~70px)
        return 'bottom-[5.5rem]';
      case 'welcome':
      case 'mobile':
      case 'wallet_success':
      case 'order_confirmed':
      default:
        // Float near the bottom on screens with no tall footer
        return 'bottom-7';
    }
  };

  // Map internal state to the 5 specified display states
  const currentState =
    voiceState === 'greeting' || voiceState === 'speaking' ? 'speaking' : voiceState;

  // Format concise error message for pill display
  const briefError = errorMessage
    ? errorMessage.length > 28
      ? errorMessage.slice(0, 26) + '...'
      : errorMessage
    : 'Audio error';

  return (
    <div
      className={`absolute ${getBottomClass()} left-1/2 -translate-x-1/2 z-40 flex items-center justify-center pointer-events-none select-none transition-all duration-300`}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Voice status: ${currentState}`}
        className={`pointer-events-auto group relative flex items-center gap-2 px-3.5 py-1.5 rounded-full font-sans text-xs font-semibold shadow-lg backdrop-blur-md transition-all duration-200 active:scale-95 border ${
          currentState === 'listening'
            ? 'bg-navy/95 text-white border-rose-500/50 ring-2 ring-rose-500/25 shadow-[0_4px_20px_rgba(244,63,94,0.25)]'
            : currentState === 'speaking'
            ? 'bg-navy/95 text-white border-emerald-500/50 ring-2 ring-emerald-500/20 shadow-[0_4px_20px_rgba(16,185,129,0.25)]'
            : currentState === 'processing'
            ? 'bg-navy/95 text-white/95 border-twc-sand/40 ring-1 ring-twc-sand/20 shadow-[0_4px_20px_rgba(28,42,57,0.35)] cursor-wait'
            : currentState === 'error'
            ? 'bg-navy/95 text-rose-200 border-rose-500/50 ring-1 ring-rose-500/20 shadow-[0_4px_20px_rgba(244,63,94,0.2)]'
            : 'bg-navy/95 text-cream-100 border-white/15 hover:border-white/30 shadow-[0_4px_20px_rgba(28,42,57,0.35)]'
        }`}
      >
        {/* 1. IDLE STATE: Small microphone icon with "Touch to start" */}
        {currentState === 'idle' && (
          <>
            <Mic className="w-3.5 h-3.5 text-cream-200 shrink-0" />
            <span className="tracking-wide text-cream-100 font-semibold">
              Touch to start
            </span>
          </>
        )}

        {/* 2. LISTENING STATE: Small animated microphone icon with "Listening..." */}
        {currentState === 'listening' && (
          <>
            <div className="relative flex items-center justify-center shrink-0">
              <span className="absolute -inset-1 rounded-full bg-rose-500/40 animate-ping" />
              <Mic className="w-3.5 h-3.5 text-rose-400 relative z-10 animate-pulse" />
            </div>
            <span className="tracking-wide text-white font-semibold">
              Listening...
            </span>
            <div className="flex items-center gap-0.5 ml-0.5">
              <span className="w-0.5 h-2.5 bg-rose-400 rounded-full animate-pulse" />
              <span className="w-0.5 h-4 bg-rose-400 rounded-full animate-pulse [animation-delay:150ms]" />
              <span className="w-0.5 h-2 bg-rose-400 rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
          </>
        )}

        {/* 3. PROCESSING STATE: Small subtle animated indicator with "Processing..." */}
        {currentState === 'processing' && (
          <>
            <Loader2 className="w-3.5 h-3.5 text-twc-sand animate-spin shrink-0" />
            <span className="tracking-wide text-cream-100 font-semibold">
              Processing...
            </span>
          </>
        )}

        {/* 4. SPEAKING STATE: Small speaker or sound-wave animation with "Speaking..." */}
        {currentState === 'speaking' && (
          <>
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span className="tracking-wide text-white font-semibold">
              Speaking...
            </span>
            <div className="flex items-center gap-0.5 ml-0.5">
              <span className="w-0.5 h-2.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-0.5 h-3.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce" />
            </div>
          </>
        )}

        {/* 5. ERROR STATE: Small microphone/error indicator with brief error message */}
        {currentState === 'error' && (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="tracking-wide text-rose-200 font-medium truncate max-w-[200px]">
              {briefError}
            </span>
            <RotateCcw className="w-3 h-3 text-rose-300 hover:text-white shrink-0 ml-0.5" />
          </>
        )}
      </button>
    </div>
  );
};
