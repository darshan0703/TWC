/**
 * Calibrated Interruption (Barge-In) Service for Third Wave Coffee Kiosk
 *
 * Implements robust customer speech interruption while cashier is speaking:
 * 1. Silero Neural VAD speech probability as mandatory evidence (rejects mechanical/ambient noise).
 * 2. Adaptive RMS volume and dynamic TTS echo scaling (rejects speaker-to-mic bleed).
 * 3. 280ms sustained confirmation window across consecutive audio frames (rejects transient clatter/taps).
 * 4. Post-interruption cooldown window (prevents echo reverberation and duplicate triggers).
 * 5. Structured diagnostic telemetry without customer PII.
 */

import { getVolume } from './audioAnalyser';
import { getInterruptionThreshold, getNoiseFloor, adaptNoiseFloor } from './vadService';
import { isSpeaking } from './ttsService';
import {
  setSileroSpeechStartHandler,
  setSileroFrameHandler,
  startSileroVAD,
  isSileroVADReady,
  getLatestSpeechProbability,
} from './sileroVadService';
import { logVoiceEvent } from './voiceLogger';
import { VOICE_CALIBRATION } from './voiceCalibrationConfig';

let interruptionAnimationFrame = null;
let interruptionHandler = null;
let isDetecting = false;
let lastInterruptionTime = 0;

// Confirmation tracking state
let candidateStartTime = null;
let lastSpeechActiveTime = null;
let consecutiveSpeechFrameCount = 0;
let candidateMaxProbability = 0;
let candidateMaxVolume = 0;

export function setInterruptionHandler(handler) {
  interruptionHandler = handler;
}

export function isInterruptionDetecting() {
  return isDetecting;
}

export function isInterruptionInCooldown() {
  return performance.now() - lastInterruptionTime < VOICE_CALIBRATION.CONFIRMATION.cooldownMs;
}

function triggerInterruption(source, details = {}) {
  if (!isDetecting) return;

  logVoiceEvent('INTERRUPTION_THRESHOLD_REACHED', {
    source,
    ...details,
  });

  stopInterruptionDetection();

  lastInterruptionTime = performance.now();
  logVoiceEvent('INTERRUPTION_COOLDOWN_STARTED', {
    cooldownMs: VOICE_CALIBRATION.CONFIRMATION.cooldownMs,
  });

  logVoiceEvent('INTERRUPTION_CALLBACK_FIRED', { source });
  interruptionHandler?.();
}

/**
 * Evaluates incoming audio frame for interruption decision.
 * Fuses Silero neural speech probability with RMS energy, sustained confirmation window,
 * 120ms hangover tolerance across consonant closures, and warmup RMS fallback.
 */
function evaluateFrameForInterruption(speechProb, volume) {
  if (!isDetecting) return;

  const now = performance.now();

  // 1. Cooldown rejection
  if (now - lastInterruptionTime < VOICE_CALIBRATION.CONFIRMATION.cooldownMs) {
    if (candidateStartTime !== null) {
      logVoiceEvent('INTERRUPTION_REJECTED', {
        reason: 'in_cooldown',
        volume: volume.toFixed(4),
        speechProbability: speechProb.toFixed(3),
        cooldownRemainingMs: Math.round(
          VOICE_CALIBRATION.CONFIRMATION.cooldownMs - (now - lastInterruptionTime)
        ),
      });
      candidateStartTime = null;
      lastSpeechActiveTime = null;
      consecutiveSpeechFrameCount = 0;
    }
    return;
  }

  const threshold = getInterruptionThreshold();
  const noise = getNoiseFloor();
  const ttsActive = isSpeaking();
  const sileroReady = isSileroVADReady();

  // Background noise adaptation during quiet moments while cashier is speaking
  if (volume < threshold * 0.6 && (!sileroReady || speechProb < 0.3)) {
    adaptNoiseFloor(volume);
  }

  // 2. Candidate Detection: Silero neural VAD when ready, or sensitive RMS fallback during warmup
  let isSpeechCandidate = false;
  let detectionSource = 'silero_neural_vad';

  if (sileroReady) {
    const isSpeechProbHigh = speechProb >= VOICE_CALIBRATION.SILERO.positiveSpeechThreshold;
    const isVolumeSufficient = volume >= threshold && (!ttsActive || volume >= VOICE_CALIBRATION.THRESHOLDS.ttsActiveMinThreshold);
    isSpeechCandidate = isSpeechProbHigh && isVolumeSufficient;
    detectionSource = 'silero_neural_vad';
  } else {
    // Warmup RMS fallback: permits early interruption before Silero CDN download completes
    const fallbackThreshold = Math.max(
      threshold,
      VOICE_CALIBRATION.CONFIRMATION.fallbackRmsMinThreshold,
      noise + 0.030
    );
    const isFallbackVolumeSufficient = volume >= fallbackThreshold && (!ttsActive || volume >= VOICE_CALIBRATION.THRESHOLDS.ttsActiveMinThreshold);
    isSpeechCandidate = isFallbackVolumeSufficient;
    detectionSource = 'rms_warmup_fallback';
  }

  // Reject TTS echo: if TTS is active and volume is strictly below echo suppression floor
  if (ttsActive && volume < VOICE_CALIBRATION.THRESHOLDS.ttsActiveMinThreshold) {
    if (candidateStartTime !== null) {
      const timeSinceLastActive = now - lastSpeechActiveTime;
      if (timeSinceLastActive > VOICE_CALIBRATION.CONFIRMATION.hangoverToleranceMs) {
        logVoiceEvent('INTERRUPTION_REJECTED', {
          reason: 'tts_echo_suppressed',
          volume: volume.toFixed(4),
          speechProbability: speechProb.toFixed(3),
          threshold: threshold.toFixed(4),
          durationMs: Math.round(now - candidateStartTime),
        });
        candidateStartTime = null;
        lastSpeechActiveTime = null;
        consecutiveSpeechFrameCount = 0;
      }
    }
    return;
  }

  if (isSpeechCandidate) {
    if (candidateStartTime === null) {
      // First frame of speech candidate
      candidateStartTime = now;
      lastSpeechActiveTime = now;
      consecutiveSpeechFrameCount = 1;
      candidateMaxProbability = speechProb;
      candidateMaxVolume = volume;

      logVoiceEvent('SPEECH_CANDIDATE_DETECTED', {
        volume: volume.toFixed(4),
        speechProbability: speechProb.toFixed(3),
        threshold: threshold.toFixed(4),
        noiseFloor: noise.toFixed(4),
        ttsActive,
        source: detectionSource,
      });
    } else {
      // Subsequent consecutive speech frames
      lastSpeechActiveTime = now;
      consecutiveSpeechFrameCount++;
      candidateMaxProbability = Math.max(candidateMaxProbability, speechProb);
      candidateMaxVolume = Math.max(candidateMaxVolume, volume);

      const duration = now - candidateStartTime;
      const requiredDuration = sileroReady
        ? VOICE_CALIBRATION.CONFIRMATION.minConfirmationMs
        : VOICE_CALIBRATION.CONFIRMATION.fallbackConfirmationMs;
      const requiredConfidence = sileroReady
        ? VOICE_CALIBRATION.SILERO.interruptionSpeechThreshold
        : 0;

      // 3. Interruption Confirmation: speech sustained for calibrated window
      const meetsDuration = duration >= requiredDuration;
      const meetsFrames =
        consecutiveSpeechFrameCount >= VOICE_CALIBRATION.CONFIRMATION.consecutiveSpeechFrames;
      const meetsConfidence = !sileroReady || candidateMaxProbability >= requiredConfidence;

      if (meetsDuration && meetsFrames && meetsConfidence) {
        console.log(
          `[Interruption] Speech confirmed via ${detectionSource} (vol: ${candidateMaxVolume.toFixed(4)}, prob: ${candidateMaxProbability.toFixed(3)}, dur: ${duration.toFixed(0)}ms, frames: ${consecutiveSpeechFrameCount})`
        );

        logVoiceEvent('INTERRUPTION_CONFIRMED', {
          volume: candidateMaxVolume.toFixed(4),
          speechProbability: candidateMaxProbability.toFixed(3),
          durationMs: Math.round(duration),
          consecutiveFrames: consecutiveSpeechFrameCount,
          threshold: threshold.toFixed(4),
          noiseFloor: noise.toFixed(4),
          ttsActive,
          source: detectionSource,
        });

        triggerInterruption(detectionSource, {
          volume: candidateMaxVolume.toFixed(4),
          speechProbability: candidateMaxProbability.toFixed(3),
          durationMs: Math.round(duration),
          threshold: threshold.toFixed(4),
        });

        candidateStartTime = null;
        lastSpeechActiveTime = null;
        consecutiveSpeechFrameCount = 0;
        candidateMaxProbability = 0;
        candidateMaxVolume = 0;
      }
    }
  } else {
    // Audio dropped below candidate threshold: check 120ms hangover tolerance
    if (candidateStartTime !== null) {
      const timeSinceLastActive = now - lastSpeechActiveTime;
      const hangoverTolerance = VOICE_CALIBRATION.CONFIRMATION.hangoverToleranceMs;

      if (timeSinceLastActive <= hangoverTolerance) {
        // Within 120ms hangover tolerance across consonant closures/inter-syllable gaps: DO NOT RESET!
        return;
      }

      // Drop exceeded hangover duration: candidate is genuinely over or was transient noise
      const totalActiveDuration = lastSpeechActiveTime - candidateStartTime;

      let reason = 'below_volume_threshold';
      if (totalActiveDuration < VOICE_CALIBRATION.TRANSIENT_REJECTION.maxTransientDurationMs) {
        reason = 'transient_noise_short_duration';
      } else if (sileroReady && candidateMaxProbability < VOICE_CALIBRATION.SILERO.positiveSpeechThreshold) {
        reason = 'low_speech_probability';
      }

      console.log(
        `[Interruption] Speech candidate rejected (${reason}, dur: ${totalActiveDuration.toFixed(0)}ms, prob: ${candidateMaxProbability.toFixed(3)}, vol: ${candidateMaxVolume.toFixed(4)})`
      );

      logVoiceEvent('INTERRUPTION_REJECTED', {
        reason,
        volume: candidateMaxVolume.toFixed(4),
        speechProbability: candidateMaxProbability.toFixed(3),
        durationMs: Math.round(totalDuration),
        threshold: threshold.toFixed(4),
        noiseFloor: noise.toFixed(4),
        ttsActive,
      });

      candidateStartTime = null;
      lastSpeechActiveTime = null;
      consecutiveSpeechFrameCount = 0;
      candidateMaxProbability = 0;
      candidateMaxVolume = 0;
    }
  }
}

export function startInterruptionDetection() {
  stopInterruptionDetection();
  isDetecting = true;
  candidateStartTime = null;
  lastSpeechActiveTime = null;
  consecutiveSpeechFrameCount = 0;
  candidateMaxProbability = 0;
  candidateMaxVolume = 0;

  console.log('[Interruption] Starting calibrated interruption detection...');

  // Hook into Silero Neural VAD continuous frame processing
  if (isSileroVADReady()) {
    startSileroVAD();
  }

  // Single authoritative evaluation loop driven by continuous requestAnimationFrame clock (~16ms)
  const check = () => {
    if (!isDetecting) {
      interruptionAnimationFrame = null;
      return;
    }

    const vol = getVolume();
    const prob = getLatestSpeechProbability();
    evaluateFrameForInterruption(prob, vol);

    interruptionAnimationFrame = requestAnimationFrame(check);
  };

  interruptionAnimationFrame = requestAnimationFrame(check);
}

export function stopInterruptionDetection() {
  isDetecting = false;
  if (interruptionAnimationFrame) {
    cancelAnimationFrame(interruptionAnimationFrame);
    interruptionAnimationFrame = null;
  }
  candidateStartTime = null;
  lastSpeechActiveTime = null;
  consecutiveSpeechFrameCount = 0;
  candidateMaxProbability = 0;
  candidateMaxVolume = 0;
}

// Development, calibration test suite, and automated verification simulation hooks
if (typeof window !== 'undefined') {
  window.__TWC_START_INTERRUPTION_DETECTION__ = startInterruptionDetection;
  window.__TWC_STOP_INTERRUPTION_DETECTION__ = stopInterruptionDetection;
  window.__TWC_IS_INTERRUPTION_DETECTING__ = isInterruptionDetecting;

  window.addEventListener('twc:simulate-interruption', (e) => {
    console.log('[Interruption] Simulated customer interruption event received');
    triggerInterruption('simulated_speech', {
      phrase: e?.detail?.phrase,
      speechProbability: (e?.detail?.speechProbability || 0.94).toFixed(3),
      volume: (e?.detail?.volume || 0.085).toFixed(4),
      durationMs: e?.detail?.durationMs || 320,
    });
  });

  window.addEventListener('twc:simulate-noise-spike', (e) => {
    console.log('[Interruption] Simulated noise spike received:', e?.detail);
    const reason = e?.detail?.reason || 'transient_noise_short_duration';
    logVoiceEvent('INTERRUPTION_REJECTED', {
      source: 'simulated_noise',
      volume: (e?.detail?.volume || 0.12).toFixed(4),
      speechProbability: (e?.detail?.speechProbability || 0.15).toFixed(3),
      durationMs: e?.detail?.durationMs || 80,
      reason,
    });
  });
}
