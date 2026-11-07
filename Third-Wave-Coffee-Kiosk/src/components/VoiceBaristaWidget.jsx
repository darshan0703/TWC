import React from 'react';
import './VoiceBaristaWidget.css';
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
  const getBottomModifier = () => {
    switch (currentScreen) {
      case 'menu':
      case 'categories':
        return 'voice-barista-widget--menu bottom-[4.15rem]';
      case 'customization':
      case 'cart':
      case 'wallet_topup':
        return 'voice-barista-widget--customization bottom-[5.15rem]';
      case 'welcome':
      case 'mobile':
      case 'wallet_success':
      case 'order_confirmed':
      default:
        return 'voice-barista-widget--default bottom-5';
    }
  };

  // Map internal state to the 5 specified display states
  const currentState =
    voiceState === 'greeting' || voiceState === 'speaking' ? 'speaking' : voiceState;

  // Format concise error message for pill display
  const briefError = errorMessage
    ? errorMessage.length > 24
      ? errorMessage.slice(0, 22) + '...'
      : errorMessage
    : 'Audio error';

  const getStateModifier = () => {
    switch (currentState) {
      case 'listening':
        return 'voice-barista-widget__pill--listening bg-navy/95 text-white border-rose-500/50 ring-1 ring-rose-500/25 shadow-[0_2px_12px_rgba(244,63,94,0.25)]';
      case 'speaking':
        return 'voice-barista-widget__pill--speaking bg-navy/95 text-white border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-[0_2px_12px_rgba(16,185,129,0.25)]';
      case 'processing':
        return 'voice-barista-widget__pill--processing bg-navy/95 text-white/95 border-twc-sand/40 ring-1 ring-twc-sand/20 shadow-[0_2px_12px_rgba(28,42,57,0.35)] cursor-wait';
      case 'error':
        return 'voice-barista-widget__pill--error bg-navy/95 text-rose-200 border-rose-500/50 ring-1 ring-rose-500/20 shadow-[0_2px_12px_rgba(244,63,94,0.2)]';
      default:
        return 'voice-barista-widget__pill--idle bg-navy/95 text-cream-100 border-white/15 hover:border-white/30 shadow-[0_2px_12px_rgba(28,42,57,0.35)]';
    }
  };

  return (
    <div
      className={`voice-barista-widget ${getBottomModifier()} absolute left-1/2 -translate-x-1/2 z-40 flex items-center justify-center pointer-events-none select-none transition-all duration-300`}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Voice status: ${currentState}`}
        className={`voice-barista-widget__pill ${getStateModifier()} pointer-events-auto group relative flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-sans text-[10px] font-semibold shadow-md backdrop-blur-md transition-all duration-200 active:scale-95 border`}
      >
        {/* 1. IDLE STATE: Small microphone icon with "Touch to start" */}
        {currentState === 'idle' && (
          <>
            <Mic className="w-2.5 h-2.5 text-cream-200 shrink-0" />
            <span className="voice-barista-widget__text tracking-wide text-cream-100 font-semibold text-[10px]">
              Touch to start
            </span>
          </>
        )}

        {/* 2. LISTENING STATE: Small animated microphone icon with "Listening..." */}
        {currentState === 'listening' && (
          <>
            <div className="relative flex items-center justify-center shrink-0">
              <span className="absolute -inset-0.5 rounded-full bg-rose-500/40 animate-ping" />
              <Mic className="w-2.5 h-2.5 text-rose-400 relative z-10 animate-pulse" />
            </div>
            <span className="voice-barista-widget__text tracking-wide text-white font-semibold text-[10px]">
              Listening...
            </span>
            <div className="voice-barista-widget__wave flex items-center gap-0.5 ml-0.5">
              <span className="voice-barista-widget__wave-bar w-0.5 h-2 bg-rose-400 rounded-full animate-pulse" />
              <span className="voice-barista-widget__wave-bar w-0.5 h-3 bg-rose-400 rounded-full animate-pulse [animation-delay:150ms]" />
              <span className="voice-barista-widget__wave-bar w-0.5 h-1.5 bg-rose-400 rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
          </>
        )}

        {/* 3. PROCESSING STATE: Small subtle animated indicator with "Processing..." */}
        {currentState === 'processing' && (
          <>
            <Loader2 className="w-2.5 h-2.5 text-twc-sand animate-spin shrink-0" />
            <span className="voice-barista-widget__text tracking-wide text-cream-100 font-semibold text-[10px]">
              Processing...
            </span>
          </>
        )}

        {/* 4. SPEAKING STATE: Small speaker or sound-wave animation with "Speaking..." */}
        {currentState === 'speaking' && (
          <>
            <Volume2 className="w-2.5 h-2.5 text-emerald-400 animate-pulse shrink-0" />
            <span className="voice-barista-widget__text tracking-wide text-white font-semibold text-[10px]">
              Speaking...
            </span>
            <div className="voice-barista-widget__wave flex items-center gap-0.5 ml-0.5">
              <span className="voice-barista-widget__wave-bar w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="voice-barista-widget__wave-bar w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="voice-barista-widget__wave-bar w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
            </div>
          </>
        )}

        {/* 5. ERROR STATE: Small microphone/error indicator with brief error message */}
        {currentState === 'error' && (
          <>
            <AlertCircle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
            <span className="voice-barista-widget__text voice-barista-widget__text--error tracking-wide text-rose-200 font-medium truncate max-w-[140px] text-[10px]">
              {briefError}
            </span>
            <RotateCcw className="w-2.5 h-2.5 text-rose-300 hover:text-white shrink-0 ml-0.5" />
          </>
        )}
      </button>
    </div>
  );
};
