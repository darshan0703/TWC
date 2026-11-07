import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useKiosk } from './KioskContext';
import { PRODUCTS } from '../data/products';
import {
  startSession,
  endSession,
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

export function convertSpokenTextToDigits(text) {
  if (!text) return '';

  const WORD_TO_DIGIT = {
    zero: '0', oh: '0', o: '0', nil: '0',
    one: '1', two: '2', three: '3', four: '4',
    five: '5', six: '6', seven: '7', eight: '8', nine: '9',
    ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14',
    fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19',
    twenty: '20', thirty: '30', forty: '40', fourty: '40', fifty: '50',
    sixty: '60', seventy: '70', eighty: '80', ninety: '90',
  };

  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = clean.split(/\s+/).filter(Boolean);

  let digits = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === 'double' && i + 1 < tokens.length) {
      const nextToken = tokens[i + 1];
      const nextDigit = WORD_TO_DIGIT[nextToken] || (/^\d$/.test(nextToken) ? nextToken : null);
      if (nextDigit) {
        digits += nextDigit + nextDigit;
        i++;
        continue;
      }
    }

    if (token === 'triple' && i + 1 < tokens.length) {
      const nextToken = tokens[i + 1];
      const nextDigit = WORD_TO_DIGIT[nextToken] || (/^\d$/.test(nextToken) ? nextToken : null);
      if (nextDigit) {
        digits += nextDigit + nextDigit + nextDigit;
        i++;
        continue;
      }
    }

    if (WORD_TO_DIGIT[token] !== undefined) {
      digits += WORD_TO_DIGIT[token];
    } else if (/^\d+$/.test(token)) {
      digits += token;
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
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);

  const activeTurnIdRef = useRef(0);
  const activeSessionIdRef = useRef(null);
  const prevScreenRef = useRef(kiosk.currentScreen);
  const handleStopListeningRef = useRef(null);
  const isAwaitingConfirmationRef = useRef(false);
  isAwaitingConfirmationRef.current = isAwaitingConfirmation;
  activeSessionIdRef.current = sessionId;

  // Initialize session ID silently on mount WITHOUT activating microphone or speaking audio
  useEffect(() => {
    let isMounted = true;
    const initialId = `twc-${Math.random().toString(36).substr(2, 8)}`;
    activeSessionIdRef.current = initialId;
    setSessionId(initialId);
    kiosk.setMobileNumber('');

    // Warm session with backend in background without audio
    startSession(initialId).then((data) => {
      if (isMounted && data && data.session_id === activeSessionIdRef.current) {
        if (data.mobile_number !== undefined && data.mobile_number !== null) {
          kiosk.setMobileNumber(data.mobile_number);
        }
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
      stopSpeaking();
    };
  }, []);

  // Handle Barista Action Payload against Kiosk Context
  const handleAssistantActions = useCallback((response) => {
    if (!response) return;
    // Strict race guard: discard if response belongs to a previous / superseded session
    if (response.session_id && response.session_id !== activeSessionIdRef.current) {
      console.warn('[VoiceBarista] Discarding actions from outdated session:', response.session_id, 'current:', activeSessionIdRef.current);
      return;
    }

    const { actions = [], active_screen, cart: backendCart, mobile_number } = response;

    // Sync canonical mobile number from backend response if returned
    if (mobile_number !== undefined && mobile_number !== null) {
      kiosk.setMobileNumber(mobile_number);
    }

    // 1. Specific UI Actions
    for (const act of actions) {
      if (act.ui_action === 'await_number_confirmation') {
        setIsAwaitingConfirmation(true);
        if (act.mobile_number) {
          kiosk.setMobileNumber(act.mobile_number);
        }
      } else if (act.ui_action === 'set_mobile') {
        setIsAwaitingConfirmation(false);
        if (act.mobile_number) {
          kiosk.setMobileNumber(act.mobile_number);
        }
        kiosk.navigateTo('categories');
      } else if (act.ui_action === 'clear_mobile') {
        setIsAwaitingConfirmation(false);
        kiosk.setMobileNumber('');
      } else if (act.ui_action === 'open_customization' && act.product) {
        const prod = PRODUCTS.find((p) => p.id === act.product.id) || act.product;
        kiosk.openCustomization(prod);
      } else if (act.ui_action === 'open_category' && act.category) {
        kiosk.openCategory(act.category, act.subcategory);
      } else if (act.ui_action === 'navigate' && act.screen) {
        kiosk.navigateTo(act.screen);
      }
    }

    // 2. Screen navigation following backend's active_screen
    if (active_screen && active_screen !== kiosk.currentScreen) {
      if (active_screen === 'menu' && kiosk.currentScreen !== 'menu') {
        kiosk.navigateTo('menu');
      } else if (active_screen === 'cart' && kiosk.currentScreen !== 'cart') {
        kiosk.navigateTo('cart');
      } else if (active_screen === 'categories' && kiosk.currentScreen !== 'categories') {
        kiosk.navigateTo('categories');
      } else if (active_screen === 'mobile' && kiosk.currentScreen !== 'mobile') {
        kiosk.navigateTo('mobile');
      }
    }

    // 3. Sync cart items if provided
    if (backendCart && Array.isArray(backendCart.items)) {
      kiosk.setCart(backendCart.items);
    }
  }, [kiosk]);

  // Start recording speech with state transition and live interim transcript hooks
  const handleStartListening = useCallback(async () => {
    try {
      stopSpeaking();
      setErrorMessage(null);
      setTranscript('');
      setVoiceState('listening');
      await startRecording({
        onInterim: (liveTranscript) => {
          setTranscript(liveTranscript);
          // Progressively update digits on mobile number screen during active speech
          if (kiosk.currentScreen === 'mobile' && !isAwaitingConfirmationRef.current) {
            const digits = convertSpokenTextToDigits(liveTranscript);
            if (digits) {
              kiosk.setMobileNumber(digits.slice(0, 10));
            }
          }
        },
        onSilence: () => {
          handleStopListeningRef.current?.();
        },
      });
    } catch (err) {
      console.error('[VoiceBarista] Microphone error:', err);
      setErrorMessage('Microphone access denied. Please allow microphone permissions.');
      setVoiceState('error');
    }
  }, [kiosk]);

  // Dispatch message to Conversational Agent and play spoken audio
  const processCustomerMessage = useCallback(async (customerText) => {
    const currentTurn = ++activeTurnIdRef.current;
    setVoiceState('processing');
    setErrorMessage(null);

    // If customer was speaking digits on mobile screen, ensure normalized value is updated
    if (kiosk.currentScreen === 'mobile' && !isAwaitingConfirmationRef.current) {
      const lower = (customerText || '').toLowerCase();
      if (!lower.includes('skip') && !lower.includes('guest')) {
        const digits = convertSpokenTextToDigits(customerText);
        if (digits) {
          kiosk.setMobileNumber(digits.slice(0, 10));
        }
      }
    }

    const requestSessionId = sessionId;
    try {
      const resp = await sendMessage({
        sessionId: requestSessionId,
        message: customerText,
        currentScreen: kiosk.currentScreen,
        selectedCategory: kiosk.selectedMainCategory,
        selectedProductId: kiosk.selectedProduct?.id,
      });

      // Strict race & stale guards: discard if turn advanced or session changed
      if (currentTurn !== activeTurnIdRef.current || requestSessionId !== activeSessionIdRef.current) {
        console.warn('[VoiceBarista] Discarding response from obsolete session or stale turn');
        return;
      }

      const replyText = resp.response || "Here's what I found for you!";
      setAssistantReply(replyText);

      // Execute UI actions (navigation, cart updates, drink customizer, confirmation)
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
  }, [sessionId, kiosk, handleAssistantActions, handleStartListening]);

  // Stop recording, transcribe via live SpeechRecognition or Whisper, and process
  const handleStopListening = useCallback(async () => {
    if (voiceState !== 'listening') return;

    setVoiceState('processing');
    try {
      const recordResult = await stopRecording();
      let spokenText = (recordResult?.transcript || '').trim();

      // If live SpeechRecognition didn't produce text, fallback to Whisper STT
      if (!spokenText && recordResult?.blob && recordResult.blob.size > 0) {
        const stt = await transcribeAudio(recordResult.blob);
        if (stt && stt.success && stt.text && stt.text.trim()) {
          spokenText = stt.text.trim();
        }
      }

      if (!spokenText) {
        setVoiceState('idle');
        setErrorMessage(null);
        return;
      }

      setTranscript(spokenText);
      await processCustomerMessage(spokenText);
    } catch (err) {
      console.error('[VoiceBarista] STT Error:', err);
      setErrorMessage('Could not recognize speech. Tap mic to try again.');
      setVoiceState('error');
    }
  }, [voiceState, processCustomerMessage]);

  handleStopListeningRef.current = handleStopListening;

  // Session lifecycle: cleanly renew customer session and purge previous context
  const renewSession = useCallback((reason = 'reset') => {
    if (sessionId) {
      endSession(sessionId, reason).catch(() => {});
    }
    stopSpeaking();
    stopRecording().catch(() => {});
    setSessionActive(false);
    setHasGreeted(false);
    setVoiceState('idle');
    setErrorMessage(null);
    setAssistantReply('');
    setTranscript('');
    setIsAwaitingConfirmation(false);
    setPageHint(PAGE_HINTS.welcome);
    kiosk.setMobileNumber('');
    const freshId = `twc-${Math.random().toString(36).substr(2, 8)}`;
    activeSessionIdRef.current = freshId;
    setSessionId(freshId);
    return freshId;
  }, [sessionId, kiosk]);

  // Listen for global session reset events dispatched across kiosk components
  useEffect(() => {
    const handleReset = (e) => {
      const reason = e?.detail?.reason || 'reset';
      renewSession(reason);
    };

    window.addEventListener('twc:session-reset', handleReset);
    return () => window.removeEventListener('twc:session-reset', handleReset);
  }, [renewSession]);

  // Touch-to-Start Voice Session Initiator
  const startVoiceSession = useCallback(async () => {
    // Generate and initialize fresh session ID for this customer interaction
    const freshId = `twc-${Math.random().toString(36).substr(2, 8)}`;
    activeSessionIdRef.current = freshId;
    setSessionId(freshId);
    kiosk.setMobileNumber('');
    startSession(freshId).catch(() => {});

    const currentTurn = ++activeTurnIdRef.current;
    setSessionActive(true);
    setVoiceState('speaking');
    setErrorMessage(null);
    setTranscript('');
    setAssistantReply(DEFAULT_GREETING);
    setIsAwaitingConfirmation(false);

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
  }, [handleStartListening]);

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

      // If user went back to welcome screen, terminate previous customer session and mint clean context
      if (kiosk.currentScreen === 'welcome') {
        stopSpeaking();
        if (sessionId) {
          endSession(sessionId, 'returned_to_welcome').catch(() => {});
        }
        setSessionActive(false);
        setHasGreeted(false);
        setVoiceState('idle');
        setErrorMessage(null);
        setAssistantReply('');
        setTranscript('');
        setIsAwaitingConfirmation(false);
        setPageHint(PAGE_HINTS.welcome);
        kiosk.setMobileNumber('');
        const freshId = `twc-${Math.random().toString(36).substr(2, 8)}`;
        activeSessionIdRef.current = freshId;
        setSessionId(freshId);
        return;
      }

      // If navigating away from mobile, reset number confirmation state
      if (kiosk.currentScreen !== 'mobile') {
        setIsAwaitingConfirmation(false);
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

  // Number confirmation helpers for UI/Touch
  const confirmNumber = useCallback(async () => {
    setIsAwaitingConfirmation(false);
    await processCustomerMessage('Yes');
  }, [processCustomerMessage]);

  const cancelConfirmation = useCallback(async () => {
    setIsAwaitingConfirmation(false);
    kiosk.setMobileNumber('');
    await processCustomerMessage('No');
  }, [kiosk, processCustomerMessage]);

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
    isAwaitingConfirmation,
    setIsAwaitingConfirmation,
    confirmNumber,
    cancelConfirmation,
    startVoiceSession,
    renewSession,
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
