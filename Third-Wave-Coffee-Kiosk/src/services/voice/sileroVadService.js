/**
 * Silero VAD Service for Third Wave Coffee Kiosk
 * Uses @ricky0123/vad-web with ONNX Runtime WASM assets loaded from CDN
 * and shares the singleton MediaStream from microphoneService without stopping tracks.
 */

import { MicVAD } from '@ricky0123/vad-web';
import { getMicrophone } from './microphoneService';
import { logVoiceEvent } from './voiceLogger';
import { VOICE_CALIBRATION } from './voiceCalibrationConfig';

let vad = null;
let initializing = false;
let initialized = false;

let speechStartHandler = null;
let speechEndHandler = null;
let frameProcessedHandler = null;
let latestSpeechProbability = 0;

export function getLatestSpeechProbability() {
  return latestSpeechProbability;
}

export function setSileroSpeechStartHandler(handler) {
  speechStartHandler = handler;
}

export function setSileroSpeechEndHandler(handler) {
  speechEndHandler = handler;
}

export function setSileroFrameHandler(handler) {
  frameProcessedHandler = handler;
}

export async function initializeSileroVAD({ onSpeechStart, onSpeechEnd, onFrameProcessed } = {}) {
  if (onSpeechStart) speechStartHandler = onSpeechStart;
  if (onSpeechEnd) speechEndHandler = onSpeechEnd;
  if (onFrameProcessed) frameProcessedHandler = onFrameProcessed;

  if (initialized && vad) {
    return vad;
  }

  if (initializing) {
    while (initializing) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return vad;
  }

  initializing = true;

  try {
    console.log('[SileroVAD] Initializing Silero neural VAD...');

    vad = await MicVAD.new({
      baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/',
      onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',
      positiveSpeechThreshold: VOICE_CALIBRATION.SILERO.positiveSpeechThreshold,
      negativeSpeechThreshold: VOICE_CALIBRATION.SILERO.negativeSpeechThreshold,
      redemptionMs: VOICE_CALIBRATION.SILERO.redemptionMs,
      minSpeechMs: VOICE_CALIBRATION.SILERO.minSpeechMs,

      // CRITICAL: Share persistent microphone stream without stopping hardware tracks on pause
      getStream: async () => {
        return await getMicrophone();
      },
      pauseStream: async () => {
        // No-op: DO NOT kill the shared singleton microphone track!
      },
      resumeStream: async (stream) => {
        return stream && stream.active ? stream : await getMicrophone();
      },

      onSpeechStart: () => {
        if (!speechStartHandler) return;
        logVoiceEvent('VAD_SPEECH_DETECTED', {
          source: 'silero_vad',
          type: 'speech_start',
        });
        speechStartHandler();
      },

      onSpeechEnd: (audio) => {
        if (!speechEndHandler) return;
        logVoiceEvent('VAD_SPEECH_DETECTED', {
          source: 'silero_vad',
          type: 'speech_end',
          sampleCount: audio?.length || 0,
        });
        speechEndHandler(audio);
      },

      onFrameProcessed: (probabilities, frame) => {
        if (probabilities && typeof probabilities.isSpeech === 'number') {
          latestSpeechProbability = probabilities.isSpeech;
        }
        frameProcessedHandler?.(probabilities, frame);
      },

      onVADMisfire: () => {
        console.log('[SileroVAD] VAD misfire (false alarm rejected)');
      },
    });

    initialized = true;
    logVoiceEvent('VAD_INITIALIZED', {
      model: 'legacy',
      positiveSpeechThreshold: 0.65,
      negativeSpeechThreshold: 0.35,
    });

    return vad;
  } catch (error) {
    console.error('[SileroVAD] Initialization error:', error);
    vad = null;
    initialized = false;
    throw error;
  } finally {
    initializing = false;
  }
}

export async function startSileroVAD() {
  if (!vad || !initialized) {
    return;
  }

  try {
    if (!vad.listening) {
      await vad.start();
    }
  } catch (error) {
    console.error('[SileroVAD] Start error:', error);
  }
}

export async function pauseSileroVAD() {
  if (!vad) return;

  try {
    if (vad.listening) {
      await vad.pause();
    }
  } catch (error) {
    console.error('[SileroVAD] Pause error:', error);
  }
}

export async function destroySileroVAD() {
  if (!vad) return;

  try {
    await vad.destroy();
  } catch (error) {
    console.error('[SileroVAD] Destroy error:', error);
  }

  vad = null;
  initialized = false;
  initializing = false;
}

export function isSileroVADReady() {
  return initialized && vad !== null;
}
