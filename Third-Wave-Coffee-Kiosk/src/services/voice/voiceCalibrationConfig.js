/**
 * Centralized Voice Barge-In & Sensitivity Calibration Configuration
 * for Third Wave Coffee Kiosk.
 *
 * Defines calibrated thresholds, noise floor boundaries, sustained confirmation
 * durations, and transient noise rejection parameters for real café environments.
 */

export const VOICE_CALIBRATION = {
  // 1. Silero Neural VAD Parameters
  SILERO: {
    positiveSpeechThreshold: 0.60,     // Probability threshold for normal customer turn-taking
    interruptionSpeechThreshold: 0.70, // Elevated probability required to interrupt over active cashier TTS
    negativeSpeechThreshold: 0.35,     // Speech-end probability hysteresis threshold
    redemptionMs: 800,                 // Hangover duration before speech is considered ended
    minSpeechMs: 200,                  // Minimum sustained speech ms inside Silero model
  },

  // 2. Adaptive Noise Floor Tracking
  NOISE_FLOOR: {
    initialCalibrationMs: 1200,        // Initial warmup noise floor calibration window
    minNoiseFloor: 0.008,              // Absolute minimum floor (quiet room)
    maxNoiseFloor: 0.090,              // Absolute maximum floor (prevents loud environments from locking out speech)
    percentile: 0.30,                  // 30th percentile rejects clicks, transient spikes, and door closures
    rollingWindowSize: 60,             // Number of ambient frames in rolling buffer
    adaptationRate: 0.025,             // Slew rate for continuous ambient noise adaptation
    maxStepChange: 0.004,              // Maximum delta per update to reject sudden clatter or tray drops
  },

  // 3. RMS Volume & SNR Thresholds
  THRESHOLDS: {
    normalSpeechMargin: 0.022,         // Adaptive margin added to noise floor for normal speech
    normalMinThreshold: 0.025,         // Absolute minimum volume for normal listening
    normalMaxThreshold: 0.120,         // Ceiling clamp for normal speech threshold

    interruptionSpeechMargin: 0.025,    // Adaptive margin required specifically to interrupt
    interruptionMinThreshold: 0.035,   // Minimum volume required to trigger interruption candidate
    interruptionMaxThreshold: 0.180,   // Maximum clamp for interruption threshold

    ttsActiveVolumeMultiplier: 1.20,   // Scaling multiplier applied when cashier TTS is actively speaking
    ttsActiveMinThreshold: 0.035,      // Minimum volume floor during active assistant speech (suppresses speaker bleed)
  },

  // 4. Interruption Confirmation Window (Evidence Fusion)
  CONFIRMATION: {
    minConfirmationMs: 180,            // Customer speech sustained >= 180ms with Silero probability
    hangoverToleranceMs: 120,          // 120ms speech hangover tolerance across consonant closures/syllable gaps
    fallbackRmsMinThreshold: 0.035,    // Sensitive RMS floor during initial Silero VAD warmup
    fallbackConfirmationMs: 200,       // Duration required for RMS-only warmup fallback
    maxConfirmationMs: 500,            // Upper bound for confirmation window
    consecutiveSpeechFrames: 3,        // Minimum consecutive speech frames (Silero frameProcessed)
    requireSileroSpeech: true,         // Silero neural speech is preferred; RMS fallback active during warmup
    cooldownMs: 800,                   // Cooldown after an interruption before another can be evaluated
  },

  // 5. Transient & Impulse Noise Rejection
  TRANSIENT_REJECTION: {
    maxTransientDurationMs: 160,       // Impulses shorter than this are rejected as transient noise
  },
};

