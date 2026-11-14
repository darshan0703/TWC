/**
 * Unified Voice Service Coordinator for Third Wave Coffee Kiosk
 *
 * Implements the full Intelligent Agent voice architecture:
 * 1. Persistent microphone stream singleton (microphoneService)
 * 2. Real-time audio analyser and RMS volume monitoring (audioAnalyser)
 * 3. Noise floor calibration and adaptive thresholds (vadService)
 * 4. Silero neural VAD for speech turn-taking and real-time interruption (sileroVadService)
 * 5. Instant barge-in / interruption detection during assistant speech (interruptionService)
 * 6. Customer speech recording with interim feedback (recorderService)
 * 7. Whisper STT transcription and non-speech filtering (whisperService, transcriptFilter)
 * 8. Kokoro audio playback management with immediate cutoff (ttsService)
 */

import { getMicrophone, releaseMicrophone, hasMicrophone } from './microphoneService';
import { setupAnalyser, cleanupAnalyser, getVolume, hasAnalyser } from './audioAnalyser';
import {
  calibrateNoiseFloor,
  getNormalSpeechThreshold,
  getSpeechStopThreshold,
  getInterruptionThreshold,
  getNoiseFloor,
  resetVAD,
  startVoiceDetection,
  stopVoiceDetection,
} from './vadService';
import {
  initializeSileroVAD,
  startSileroVAD,
  pauseSileroVAD,
  destroySileroVAD,
  isSileroVADReady,
  setSileroSpeechStartHandler,
  setSileroSpeechEndHandler,
} from './sileroVadService';
import {
  startRecording as startCustomerRecording,
  stopRecording as stopCustomerRecording,
  isRecording as isCustomerRecording,
  cleanupRecorder,
  initPreRollBuffer,
  teardownPreRoll,
} from './recorderService';
import { sendAudioToWhisper } from './whisperService';
import { isValidTranscript, isNonSpeechTranscript } from './transcriptFilter';
import {
  playAudioBlob as playAudioBlobInternal,
  speakText,
  stopSpeaking as stopSpeakingInternal,
  isSpeaking as isSpeakingInternal,
} from './ttsService';
import {
  startInterruptionDetection,
  stopInterruptionDetection,
  setInterruptionHandler as setInterruptionHandlerInternal,
  isInterruptionDetecting,
  isInterruptionInCooldown,
} from './interruptionService';
import { VOICE_CALIBRATION } from './voiceCalibrationConfig';
import { logVoiceEvent } from './voiceLogger';

let stopping = false;
let transcriptCallback = null;
let interimCallback = null;
let silenceCallback = null;
let speechTriggered = false;
let sileroInitialized = false;

// ======================================================
// PREPARE VOICE INPUT
// ======================================================
/**
 * Warms up microphone, audio analyser, and arms interruption detection immediately (~10ms).
 * Calibrates noise floor and initializes Silero neural VAD concurrently in the background
 * so there is ZERO blind spot when speech begins.
 */
export async function prepareVoiceInput() {
  try {
    console.log('[VoiceService] Preparing voice input (microphone & analyser)...');
    await getMicrophone();
    await setupAnalyser();

    // Start 400ms pre-roll rolling buffer
    initPreRollBuffer().catch(() => {});

    // Arm interruption detection immediately so early speech is never missed
    startInterruptionDetection();

    // Background noise floor calibration (non-blocking)
    calibrateNoiseFloor().catch((err) => {
      console.warn('[VoiceService] Noise calibration warning:', err);
    });

    // Background Silero Neural VAD initialization (non-blocking)
    if (!sileroInitialized) {
      initializeSileroVAD()
        .then(() => {
          sileroInitialized = true;
          console.log('[VoiceService] Silero neural VAD ready');
          if (isInterruptionDetecting()) {
            startSileroVAD();
          }
        })
        .catch((vadErr) => {
          console.warn('[VoiceService] Silero VAD warmup warning:', vadErr);
        });
    }

    console.log('[VoiceService] Voice input ready for speech/barge-in in ~10ms');
  } catch (error) {
    console.warn('[VoiceService] Voice input preparation warning:', error);
  }
}

// ======================================================
// SILERO VAD CUSTOMER TURN HANDLERS
// ======================================================
function handleSileroSpeechStart() {
  if (stopping || isSpeakingInternal() || !isCustomerRecording()) {
    return;
  }
  speechTriggered = true;
  console.log('[VoiceService] Silero: Customer turn started');
}

function handleSileroSpeechEnd() {
  if (stopping || !isCustomerRecording()) return;

  console.log('[VoiceService] Silero: Customer turn ended');
  logVoiceEvent('CUSTOMER_SPEECH_ENDED', { detector: 'silero_vad' });

  // Detach VAD handlers immediately to prevent late ghost events
  setSileroSpeechStartHandler(null);
  setSileroSpeechEndHandler(null);
  stopVoiceDetection();

  // Stop customer recording promptly without timeout
  stopCustomerRecording();
}

if (typeof window !== 'undefined') {
  window.addEventListener('twc:simulate-speech-end', () => {
    console.log('[VoiceService] Simulated customer speech end event received');
    handleSileroSpeechEnd();
  });
}

// ======================================================
// AUDIO PLAYBACK & BARGE-IN ORCHESTRATION
// ======================================================

/**
 * Plays Kokoro TTS audio blob and simultaneously arms interruption detection
 * so the customer can speak over the assistant at any time.
 */
export function playAudioBlob(blob, { onStart, onEnd, onError } = {}) {
  // Ensure customer recording is halted while assistant is speaking
  stopVoiceDetection();
  stopCustomerRecording();
  cleanupRecorder();
  speechTriggered = false;

  // Ensure pre-roll buffer is active while assistant is speaking
  initPreRollBuffer().catch(() => {});

  // Arm interruption detection immediately upon audio queuing
  if (!stopping) {
    console.log('[VoiceService] Assistant speaking: arming interruption detection');
    startInterruptionDetection();
  }

  playAudioBlobInternal(blob, {
    onStart: () => {
      if (!stopping) {
        startInterruptionDetection();
      }
      onStart?.();
    },
    onEnd: () => {
      stopInterruptionDetection();
      onEnd?.();
    },
    onError: (err) => {
      stopInterruptionDetection();
      onError?.(err);
    },
  });
}

/**
 * Synthesizes text via Kokoro and plays with interruption detection.
 */
export async function speak(text, onComplete, { onError } = {}) {
  stopVoiceDetection();
  stopCustomerRecording();
  cleanupRecorder();
  speechTriggered = false;

  // Arm interruption detection immediately upon speech request
  if (!stopping) {
    startInterruptionDetection();
  }

  await speakText(text, {
    onStart: () => {
      if (!stopping) {
        startInterruptionDetection();
      }
    },
    onEnd: () => {
      stopInterruptionDetection();
      onComplete?.();
    },
    onError: (err) => {
      stopInterruptionDetection();
      onError?.(err);
    },
  });
}

/**
 * Stops assistant speech immediately (instant barge-in).
 */
export function stopSpeaking() {
  stopInterruptionDetection();
  stopSpeakingInternal();
}

export function isSpeaking() {
  return isSpeakingInternal();
}

// ======================================================
// INTERRUPTION (BARGE-IN) HANDLER
// ======================================================
/**
 * Registers callback invoked when customer interrupts cashier speech.
 * Automatically halts assistant speech and clears queued audio.
 */
export function setInterruptionHandler(handler) {
  setInterruptionHandlerInternal(() => {
    console.log('[VoiceService] Interruption triggered: halting assistant speech immediately');
    stopSpeaking();
    handler?.();
  });
}

// ======================================================
// CUSTOMER LISTENING & RECORDING
// ======================================================

/**
 * Starts customer speech listening with dual-layer detection:
 * 1. Silero Neural VAD (primary turn-taking)
 * 2. Web Audio API VAD fallback (silence and energy detection)
 * 3. Browser SpeechRecognition (interim visual transcript)
 */
export async function startListening(onTranscript, { onInterim, onSilence, silenceDelay = 1000, isBargeIn = false } = {}) {
  if (isCustomerRecording()) return;
  if (isSpeakingInternal()) stopSpeaking();

  transcriptCallback = onTranscript;
  interimCallback = onInterim;
  silenceCallback = onSilence;

  stopping = false;
  speechTriggered = Boolean(isBargeIn);

  try {
    await getMicrophone();
    await setupAnalyser();

    // Attach Silero handlers for customer speech turn
    setSileroSpeechStartHandler(handleSileroSpeechStart);
    setSileroSpeechEndHandler(handleSileroSpeechEnd);

    if (sileroInitialized) {
      startSileroVAD();
    } else {
      initializeSileroVAD()
        .then(() => {
          sileroInitialized = true;
          setSileroSpeechStartHandler(handleSileroSpeechStart);
          setSileroSpeechEndHandler(handleSileroSpeechEnd);
          startSileroVAD();
        })
        .catch(() => {});
    }

    if (stopping || isSpeakingInternal()) return;

    await startCustomerRecording({
      isBargeIn,
      onInterim: (liveText) => {
        speechTriggered = true;
        interimCallback?.(liveText);
      },
      onComplete: async ({ blob, mimeType, transcript }) => {
        stopVoiceDetection();
        setSileroSpeechStartHandler(null);
        setSileroSpeechEndHandler(null);

        if (stopping) return;

        let finalSpokenText = (transcript || '').trim();

        // If SpeechRecognition didn't produce text, use Whisper STT
        if (!finalSpokenText && blob && blob.size > 0) {
          const sttResult = await sendAudioToWhisper(blob);
          if (sttResult.success && sttResult.transcript) {
            finalSpokenText = sttResult.transcript;
          }
        }

        if (!isValidTranscript(finalSpokenText)) {
          console.log('[VoiceService] Filtered invalid or non-speech transcript:', finalSpokenText);
          silenceCallback?.();
          return;
        }

        console.log('[VoiceService] Final customer transcript resolved:', finalSpokenText);
        transcriptCallback?.(finalSpokenText, { blob, mimeType });
      },
      onError: (err) => {
        stopVoiceDetection();
        setSileroSpeechStartHandler(null);
        setSileroSpeechEndHandler(null);
        console.error('[VoiceService] Recording error:', err);
      },
    });

    // Web Audio VAD fallback for energy detection and silence timing
    startVoiceDetection({
      isBargeIn,
      shouldDetect: () => isCustomerRecording() && !isSpeakingInternal(),
      onSpeechDetected: () => {
        speechTriggered = true;
      },
      onSilence: () => {
        setSileroSpeechStartHandler(null);
        setSileroSpeechEndHandler(null);
        stopCustomerRecording();
      },
      silenceDelay,
    });

    console.log('[VoiceService] Listening for customer speech (bargeIn:', isBargeIn, ')...');
  } catch (err) {
    console.error('[VoiceService] Failed to start customer listener:', err);
    throw err;
  }
}

/**
 * Stops customer listening and flushes any active recording.
 */
export function stopListening() {
  speechTriggered = false;
  setSileroSpeechStartHandler(null);
  setSileroSpeechEndHandler(null);
  stopVoiceDetection();
  stopCustomerRecording();
  cleanupRecorder();
}

export function isRecording() {
  return isCustomerRecording();
}

// ======================================================
// BACKWARDS-COMPATIBLE API EXPORTS
// ======================================================

/**
 * Legacy startRecording adapter for existing VoiceBaristaContext callers.
 */
export async function startRecording({ onSilence, onInterim, onFinal, silenceDelay = 1000, isBargeIn = false } = {}) {
  stopSpeaking();
  return startListening(
    (text, extra) => {
      onFinal?.(text, extra);
    },
    {
      onInterim,
      onSilence,
      silenceDelay,
      isBargeIn,
    }
  );
}

/**
 * Legacy stopRecording adapter returning a Promise<{ blob, mimeType, transcript }>.
 */
export async function stopRecording() {
  setSileroSpeechStartHandler(null);
  setSileroSpeechEndHandler(null);
  stopVoiceDetection();
  return await stopCustomerRecording();
}

// ======================================================
// TEARDOWN ENTIRE VOICE SUBSYSTEM
// ======================================================
export function stopVoiceSession() {
  console.log('[VoiceService] Tearing down voice session');
  stopping = true;
  speechTriggered = false;

  stopVoiceDetection();
  stopInterruptionDetection();
  stopCustomerRecording();
  cleanupRecorder();
  teardownPreRoll();
  stopSpeaking();
  cleanupAnalyser();
  releaseMicrophone();
  destroySileroVAD();

  sileroInitialized = false;
  transcriptCallback = null;
  interimCallback = null;
  silenceCallback = null;
}

if (typeof window !== 'undefined') {
  window.__TWC_STOP_SPEAKING__ = stopSpeaking;
  window.__TWC_IS_SPEAKING__ = isSpeaking;
}

export {
  getMicrophone,
  releaseMicrophone,
  hasMicrophone,
  setupAnalyser,
  cleanupAnalyser,
  getVolume,
  calibrateNoiseFloor,
  getNormalSpeechThreshold,
  getSpeechStopThreshold,
  getInterruptionThreshold,
  getNoiseFloor,
  isValidTranscript,
  isNonSpeechTranscript,
  startInterruptionDetection,
  stopInterruptionDetection,
  isInterruptionDetecting,
  isInterruptionInCooldown,
  VOICE_CALIBRATION,
};
