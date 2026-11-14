/**
 * Voice Activity Detection (VAD) Service for Third Wave Coffee Kiosk
 * Handles background noise floor calibration, continuous ambient noise adaptation,
 * hysteresis thresholds, and dual-layer interruption thresholds.
 */

import { getVolume, hasAnalyser } from './audioAnalyser';
import { isSpeaking } from './ttsService';
import { logVoiceEvent } from './voiceLogger';
import { VOICE_CALIBRATION } from './voiceCalibrationConfig';

const SPEECH_CONFIRMATION_MS = 250;

let noiseFloor = 0.015;
let calibrating = false;
let vadAnimationFrame = null;
const rollingAmbientSamples = [];

export async function calibrateNoiseFloor() {
  if (!hasAnalyser() || calibrating) return;

  calibrating = true;
  const samples = [];
  const targetMs = VOICE_CALIBRATION.NOISE_FLOOR.initialCalibrationMs;

  logVoiceEvent('CALIBRATION_STARTED', {
    targetMs,
    initialNoiseFloor: noiseFloor.toFixed(4),
  });

  console.log('[VoiceVAD] Calibrating microphone noise floor...');

  const start = performance.now();
  while (performance.now() - start < targetMs) {
    samples.push(getVolume());
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  if (samples.length > 0) {
    const sorted = [...samples].sort((a, b) => a - b);
    // Use calibrated percentile to reject sudden clicks, counter knocks, or door slams
    const percentileIndex = Math.floor(sorted.length * VOICE_CALIBRATION.NOISE_FLOOR.percentile);
    const baseline = sorted[percentileIndex] || 0.015;
    const prev = noiseFloor;
    noiseFloor = Math.min(
      Math.max(baseline, VOICE_CALIBRATION.NOISE_FLOOR.minNoiseFloor),
      VOICE_CALIBRATION.NOISE_FLOOR.maxNoiseFloor
    );

    rollingAmbientSamples.length = 0;
    rollingAmbientSamples.push(...sorted.slice(0, VOICE_CALIBRATION.NOISE_FLOOR.rollingWindowSize));

    logVoiceEvent('NOISE_FLOOR_UPDATED', {
      previous: prev.toFixed(4),
      newNoiseFloor: noiseFloor.toFixed(4),
      reason: 'initial_calibration',
      sampleCount: samples.length,
    });
  }

  console.log('[VoiceVAD] Calibrated Noise Floor:', noiseFloor.toFixed(4));
  console.log('[VoiceVAD] Normal Speech Threshold:', getNormalSpeechThreshold().toFixed(4));
  console.log('[VoiceVAD] Interruption Threshold:', getInterruptionThreshold().toFixed(4));
  calibrating = false;
}

export function getNormalSpeechThreshold() {
  const base = noiseFloor + VOICE_CALIBRATION.THRESHOLDS.normalSpeechMargin;
  return Math.min(
    Math.max(base, VOICE_CALIBRATION.THRESHOLDS.normalMinThreshold),
    VOICE_CALIBRATION.THRESHOLDS.normalMaxThreshold
  );
}

export function getSpeechStopThreshold() {
  const startThreshold = getNormalSpeechThreshold();
  return Math.max(
    noiseFloor + 0.012,
    startThreshold * 0.65
  );
}

export function getInterruptionThreshold() {
  const base = noiseFloor + VOICE_CALIBRATION.THRESHOLDS.interruptionSpeechMargin;
  const clampedBase = Math.min(
    Math.max(base, VOICE_CALIBRATION.THRESHOLDS.interruptionMinThreshold),
    VOICE_CALIBRATION.THRESHOLDS.interruptionMaxThreshold
  );

  // If cashier TTS is actively speaking, dynamically scale to suppress speaker bleed
  if (isSpeaking()) {
    const scaled = clampedBase * VOICE_CALIBRATION.THRESHOLDS.ttsActiveVolumeMultiplier;
    return Math.max(scaled, VOICE_CALIBRATION.THRESHOLDS.ttsActiveMinThreshold);
  }

  return clampedBase;
}

export function adaptNoiseFloor(volume) {
  const currentSpeechThreshold = getNormalSpeechThreshold();
  // Continuous customer speech or loud sounds must NEVER be treated as ambient noise
  if (volume >= currentSpeechThreshold) {
    return;
  }

  rollingAmbientSamples.push(volume);
  if (rollingAmbientSamples.length > VOICE_CALIBRATION.NOISE_FLOOR.rollingWindowSize) {
    rollingAmbientSamples.shift();
  }

  // Calculate candidate noise floor using percentile of rolling buffer
  const sorted = [...rollingAmbientSamples].sort((a, b) => a - b);
  const pIdx = Math.floor(sorted.length * VOICE_CALIBRATION.NOISE_FLOOR.percentile);
  const candidate = sorted[pIdx] || volume;

  // Rate-limited adaptation to reject sudden bangs or tray drops
  const maxStep = VOICE_CALIBRATION.NOISE_FLOOR.maxStepChange;
  const delta = Math.max(-maxStep, Math.min(maxStep, (candidate - noiseFloor) * VOICE_CALIBRATION.NOISE_FLOOR.adaptationRate));
  const newFloor = Math.min(
    Math.max(noiseFloor + delta, VOICE_CALIBRATION.NOISE_FLOOR.minNoiseFloor),
    VOICE_CALIBRATION.NOISE_FLOOR.maxNoiseFloor
  );

  if (Math.abs(newFloor - noiseFloor) >= 0.006) {
    const prev = noiseFloor;
    noiseFloor = newFloor;
    logVoiceEvent('NOISE_FLOOR_UPDATED', {
      previous: prev.toFixed(4),
      newNoiseFloor: noiseFloor.toFixed(4),
      reason: 'ambient_drift',
    });
  } else {
    noiseFloor = newFloor;
  }
}

export function startVoiceDetection({
  shouldDetect,
  onSpeechDetected,
  onSilence,
  silenceDelay = 1000,
  isBargeIn = false,
}) {
  stopVoiceDetection();

  let speechStartTime = null;
  let hasSpoken = Boolean(isBargeIn);
  let silenceStartTime = null;

  const check = () => {
    if (!shouldDetect?.()) {
      vadAnimationFrame = requestAnimationFrame(check);
      return;
    }

    const volume = getVolume();
    adaptNoiseFloor(volume);

    const speechStartThreshold = getNormalSpeechThreshold();
    const speechStopThreshold = getSpeechStopThreshold();

    if (volume > speechStartThreshold) {
      silenceStartTime = null;
      if (speechStartTime === null) {
        speechStartTime = performance.now();
      }

      const duration = performance.now() - speechStartTime;
      if (duration >= SPEECH_CONFIRMATION_MS) {
        if (!hasSpoken) {
          console.log('[VoiceVAD] Customer speech confirmed (volume:', volume.toFixed(4), ')');
          hasSpoken = true;
          onSpeechDetected?.();
        }
      }
    } else if (volume < speechStopThreshold) {
      speechStartTime = null;
      if (hasSpoken) {
        if (silenceStartTime === null) {
          silenceStartTime = performance.now();
        } else if (performance.now() - silenceStartTime >= silenceDelay) {
          console.log('[VoiceVAD] Silence detected after customer speech');
          stopVoiceDetection();
          onSilence?.();
          return;
        }
      }
    } else {
      // Inside hysteresis deadband
      speechStartTime = null;
    }

    vadAnimationFrame = requestAnimationFrame(check);
  };

  vadAnimationFrame = requestAnimationFrame(check);
}

export function stopVoiceDetection() {
  if (!vadAnimationFrame) return;
  cancelAnimationFrame(vadAnimationFrame);
  vadAnimationFrame = null;
}

export function getNoiseFloor() {
  return noiseFloor;
}

export function resetVAD() {
  stopVoiceDetection();
  noiseFloor = 0;
  calibrating = false;
}
