import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useKiosk } from './KioskContext';
import { PRODUCTS } from '../data/products';
import {
  startSession,
  sendMessage,
  updateScreenState,
  transcribeAudio,
  fetchTTSAudio,
} from '../services/api';
import {
  startRecording,
  stopRecording,
  playAudioBlob,
  stopSpeaking,
} from '../services/voiceService';

const VoiceBaristaContext = createContext(null);

const DEFAULT_GREETING =
  "Hey! Welcome to Third Wave Coffee. It's lovely to have you here. Please enter your mobile number on the screen to get started, or tell me your number!";

const PAGE_HINTS = {
  welcome: "Touch to start your handcrafted coffee order.",
  mobile: "Please enter your 10-digit mobile number, or say it aloud.",
  categories: "What do you feel like having today — coffee, food, or chilled drinks?",
  menu: "Explore our specialty roasts or ask me for a recommendation.",
  customization: "Customize size, milk, temperature, and espresso shots.",
  cart: "Review your tray or proceed to checkout.",
  wallet_topup: "Select top-up amount or scan to pay with UPI.",
  order_confirmed: "Your order is confirmed and being crafted at the bar!",
};

function extractSpokenDigits(text) {
  if (!text) return '';
  const wordMap = {
    zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4',
    five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  };
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  let digits = '';
  for (const w of words) {
    if (wordMap[w]) {
      digits += wordMap[w];
    } else if (/^\d+$/.test(w)) {
      digits += w;
    }
  }
  return digits;
}

export const VoiceBaristaProvider = ({ children }) => {
  const kiosk = useKiosk();

  // Voice Interaction States: 'idle' | 'listening' | 'processing' | 'speaking' | 'error'
  const [voiceState, setVoiceState] = useState('idle');
  const [sessionActive, setSessionActive] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [assistantReply, setAssistantReply] = useState('');
  const [pageHint, setPageHint] = useState(PAGE_HINTS.welcome);
  const [sessionId, setSessionId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const activeTurnIdRef = useRef(0);
  const prevScreenRef = useRef(kiosk.currentScreen);
  const handleStopListeningRef = useRef(null);

  // Initialize session ID silently on mount WITHOUT activating microphone or speaking audio
  useEffect(() => {
    let isMounted = true;
    const initialId = `twc-${Math.random().toString(36).substr(2, 8)}`;
    setSessionId(initialId);

    // Warm session with backend in background without audio
    startSession(initialId).catch(() => {});

    return () => {
      isMounted = false;
      stopSpeaking();
    };
  }, []);

  // Handle Barista Action Payload against Kiosk Context
  const handleAssistantActions = useCallback((response) => {
    const { actions = [], active_screen, cart: backendCart } = response;

    // 1. Screen navigation
    if (active_screen && active_screen !== kiosk.currentScreen) {
      if (active_screen === 'menu' && kiosk.currentScreen !== 'menu') {
        kiosk.navigateTo('menu');
      } else if (active_screen === 'cart' && kiosk.currentScreen !== 'cart') {
        kiosk.navigateTo('cart');
      } else if (active_screen === 'categories' && kiosk.currentScreen !== 'categories') {
        kiosk.navigateTo('categories');
      }
    }

    // 2. Specific UI Actions
    for (const act of actions) {
      if (act.ui_action === 'set_mobile' && act.mobile_number) {
        kiosk.setMobileNumber(act.mobile_number);
        kiosk.navigateTo('categories');
      } else if (act.ui_action === 'open_customization' && act.product) {
        const prod = PRODUCTS.find((p) => p.id === act.product.id) || act.product;
        kiosk.openCustomization(prod);
      } else if (act.ui_action === 'open_category' && act.category) {
        kiosk.openCategory(act.category, act.subcategory);
      } else if (act.ui_action === 'navigate' && act.screen) {
        kiosk.navigateTo(act.screen);
      }
    }

    // 3. Sync cart items if provided
    if (backendCart && Array.isArray(backendCart.items)) {
      kiosk.setCart(backendCart.items);
    }
  }, [kiosk]);

  // Start recording speech with state transition
  const handleStartListening = useCallback(async () => {
    try {
      stopSpeaking();
      setErrorMessage(null);
      setTranscript('');
      setVoiceState('listening');
      await startRecording({
        onSilence: () => {
          handleStopListeningRef.current?.();
        },
      });
    } catch (err) {
      console.error('[VoiceBarista] Microphone error:', err);
      setErrorMessage('Microphone access denied. Please allow microphone permissions.');
      setVoiceState('error');
    }
  }, []);

  // Dispatch message to Conversational Agent and play spoken audio
  const processCustomerMessage = useCallback(async (customerText) => {
    const currentTurn = ++activeTurnIdRef.current;
    setVoiceState('processing');
    setErrorMessage(null);

    // Fast-path client check if customer is on mobile number screen
    if (kiosk.currentScreen === 'mobile') {
      const lower = (customerText || '').toLowerCase();
      if (lower.includes('skip') || lower.includes('no number') || lower.includes('guest')) {
        kiosk.navigateTo('categories');
      } else {
        const digits = extractSpokenDigits(customerText);
        if (digits.length >= 10) {
          kiosk.setMobileNumber(digits.slice(-10));
          kiosk.navigateTo('categories');
        }
      }
    }

    try {
      const resp = await sendMessage({
        sessionId,
        message: customerText,
        currentScreen: kiosk.currentScreen,
        selectedCategory: kiosk.selectedMainCategory,
        selectedProductId: kiosk.selectedProduct?.id,
      });

      if (currentTurn !== activeTurnIdRef.current) return; // Stale turn

      const replyText = resp.response || "Here's what I found for you!";
      setAssistantReply(replyText);

      // Execute UI actions (navigation, cart updates, drink customizer)
      handleAssistantActions(resp);

      // Synthesize and play Kokoro TTS
      const speakText = resp.speakable_response || replyText;
      try {
        const audioBlob = await fetchTTSAudio(speakText);
        if (currentTurn !== activeTurnIdRef.current) return;

        setVoiceState('speaking');
        playAudioBlob(audioBlob, {
          onStart: () => {
            if (currentTurn === activeTurnIdRef.current) setVoiceState('speaking');
          },
          onEnd: () => {
            if (currentTurn === activeTurnIdRef.current) {
              // If order was confirmed, remain idle; otherwise listen for follow-up response
              if (resp.active_screen === 'order_confirmed') {
                setVoiceState('idle');
        setErrorMessage(null);
              } else {
                handleStartListening();
              }
            }
          },
          onError: (err) => {
            console.warn('[VoiceBarista] Audio playback warning:', err);
            if (currentTurn === activeTurnIdRef.current) setVoiceState('idle');
          },
        });
      } catch (ttsErr) {
        console.warn('[VoiceBarista] TTS playback skipped:', ttsErr);
        if (resp.active_screen === 'order_confirmed') {
          setVoiceState('idle');
        setErrorMessage(null);
        } else {
          handleStartListening();
        }
      }
    } catch (err) {
      console.error('[VoiceBarista] Process message error:', err);
      setErrorMessage("Sorry, I had trouble processing that. Please tap the mic to try again!");
      setVoiceState('error');
    }
  }, [sessionId, kiosk.currentScreen, kiosk.selectedMainCategory, kiosk.selectedProduct, handleAssistantActions, handleStartListening]);

  // Stop recording, transcribe via Whisper, and process
  const handleStopListening = useCallback(async () => {
    if (voiceState !== 'listening') return;

    setVoiceState('processing');
    try {
      const recordResult = await stopRecording();
      if (!recordResult || !recordResult.blob || recordResult.blob.size === 0) {
        setVoiceState('idle');
        setErrorMessage(null);
        return;
      }

      // Transcribe via Whisper STT
      const stt = await transcribeAudio(recordResult.blob);
      if (!stt || !stt.success || !stt.text || !stt.text.trim()) {
        setAssistantReply("I didn't catch that. Could you please tap the mic and repeat?");
        setVoiceState('idle');
        setErrorMessage(null);
        return;
      }

      const spokenText = stt.text.trim();
      setTranscript(spokenText);
      await processCustomerMessage(spokenText);
    } catch (err) {
      console.error('[VoiceBarista] STT Error:', err);
      setErrorMessage('Could not recognize speech. Tap mic to try again.');
      setVoiceState('error');
    }
  }, [voiceState, processCustomerMessage]);

  handleStopListeningRef.current = handleStopListening;

  // Touch-to-Start Voice Session Initiator
  const startVoiceSession = useCallback(async () => {
    // If already active and has greeted, avoid replaying greeting
    if (sessionActive && hasGreeted) {
      return;
    }

    const currentTurn = ++activeTurnIdRef.current;
    setSessionActive(true);
    setVoiceState('speaking');
    setErrorMessage(null);
    setTranscript('');
    setAssistantReply(DEFAULT_GREETING);

    try {
      // Synthesize and play initial welcoming greeting
      const audioBlob = await fetchTTSAudio(DEFAULT_GREETING);
      if (currentTurn !== activeTurnIdRef.current) return;

      playAudioBlob(audioBlob, {
        onStart: () => {
          if (currentTurn === activeTurnIdRef.current) {
            setVoiceState('speaking');
          }
        },
        onEnd: () => {
          if (currentTurn === activeTurnIdRef.current) {
            setHasGreeted(true);
            // Speech recognition starts ONLY after greeting has finished speaking
            handleStartListening();
          }
        },
        onError: (err) => {
          console.warn('[VoiceBarista] Greeting audio error:', err);
          if (currentTurn === activeTurnIdRef.current) {
            setHasGreeted(true);
            handleStartListening();
          }
        },
      });
    } catch (err) {
      console.warn('[VoiceBarista] Could not play greeting audio, starting listener:', err);
      if (currentTurn === activeTurnIdRef.current) {
        setHasGreeted(true);
        handleStartListening();
      }
    }
  }, [sessionActive, hasGreeted, handleStartListening]);

  // Stop listening when navigating away or ending session
  useEffect(() => {
    if (prevScreenRef.current !== kiosk.currentScreen) {
      const prev = prevScreenRef.current;
      prevScreenRef.current = kiosk.currentScreen;

      // Stop listening if user navigated by touch
      if (voiceState === 'listening') {
        stopRecording().catch(() => {});
        setVoiceState('idle');
        setErrorMessage(null);
      }

      // If user went back to welcome screen, reset customer session
      if (kiosk.currentScreen === 'welcome') {
        stopSpeaking();
        setSessionActive(false);
        setHasGreeted(false);
        setVoiceState('idle');
        setErrorMessage(null);
        setAssistantReply('');
        setTranscript('');
        setPageHint(PAGE_HINTS.welcome);
        return;
      }

      // Update page-specific hint
      setPageHint(PAGE_HINTS[kiosk.currentScreen] || PAGE_HINTS.categories);

      // Sync screen state with backend (does NOT replay greeting)
      if (sessionId) {
        updateScreenState({
          sessionId,
          screen: kiosk.currentScreen,
          category: kiosk.selectedMainCategory,
          productId: kiosk.selectedProduct?.id,
        }).then((data) => {
          if (data && data.page_prompt) {
            setPageHint(data.page_prompt);
          }
        }).catch(() => {});
      }
    }
  }, [kiosk.currentScreen, kiosk.selectedMainCategory, kiosk.selectedProduct, sessionId, voiceState]);

  // Instant interruption / barge-in
  const handleInterruptSpeaking = useCallback(() => {
    stopSpeaking();
    setVoiceState('idle');
  }, []);

  // Cancel listening
  const handleCancelListening = useCallback(async () => {
    try {
      await stopRecording();
    } catch (_) {}
    setVoiceState('idle');
  }, []);

  // Visible microphone toggle control
  const handleToggleMic = useCallback(async () => {
    if (voiceState === 'listening') {
      await handleStopListening();
    } else if (voiceState === 'speaking' || voiceState === 'greeting') {
      handleInterruptSpeaking();
      await handleStartListening();
    } else {
      await handleStartListening();
    }
  }, [voiceState, handleStopListening, handleInterruptSpeaking, handleStartListening]);

  // Manual text submission fallback for internal testing
  const handleSendText = useCallback(async (text) => {
    if (!text || !text.trim()) return;
    setTranscript(text);
    await processCustomerMessage(text);
  }, [processCustomerMessage]);

  const value = {
    voiceState,
    sessionActive,
    hasGreeted,
    transcript,
    assistantReply,
    pageHint,
    sessionId,
    errorMessage,
    startVoiceSession,
    startListening: handleStartListening,
    stopListeningAndProcess: handleStopListening,
    cancelListening: handleCancelListening,
    interruptSpeaking: handleInterruptSpeaking,
    toggleMic: handleToggleMic,
    sendTextMessage: handleSendText,
  };

  return (
    <VoiceBaristaContext.Provider value={value}>
      {children}
    </VoiceBaristaContext.Provider>
  );
};

export const useVoiceBarista = () => {
  const ctx = useContext(VoiceBaristaContext);
  if (!ctx) {
    throw new Error('useVoiceBarista must be used within a VoiceBaristaProvider');
  }
  return ctx;
};
