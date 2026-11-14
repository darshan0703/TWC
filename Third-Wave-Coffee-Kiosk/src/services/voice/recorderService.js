/**
 * Customer Audio Recorder Service for Third Wave Coffee Kiosk
 *
 * Implements high-fidelity 16-bit PCM WAV recording with rolling 400ms pre-roll buffer:
 * 1. Maintains a rolling 400ms circular audio buffer while assistant TTS is speaking.
 * 2. On barge-in interruption, prepends the pre-roll buffer in chronological order so opening words are preserved.
 * 3. Preserves exact sample rate, 1 channel mono, 16-bit PCM Little Endian encoding.
 * 4. Zero duplicate audio at the boundary; zero restarted microphone streams.
 * 5. Optional browser-native SpeechRecognition for live interim feedback on mobile screen.
 */

import { getMicrophone } from './microphoneService';
import { getAudioContext, getAnalyserSource } from './audioAnalyser';
import { logVoiceEvent } from './voiceLogger';

const MAX_RECORDING_MS = 12000;
const PRE_ROLL_TARGET_MS = 400;

let preRollProcessor = null;
let preRollSilentGain = null;
let preRollChunks = [];
let preRollTotalSamples = 0;

let isPcmRecording = false;
let activePcmChunks = [];
let activeSampleRate = 44100;

let listening = false;
let speechRecognizer = null;
let activeLiveTranscript = '';
let currentOnComplete = null;
let currentOnError = null;
let stopResolvers = [];
let recordingTimer = null;

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Encodes Float32Array PCM samples into standard 16-bit PCM WAV ArrayBuffer.
 */
function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (1 = PCM) */
  view.setUint16(20, 1, true);
  /* channel count (1 = mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channels * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample (16) */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM Little Endian samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

/**
 * Initializes continuous pre-roll audio capture into a rolling 400ms ring buffer.
 * Reuses the existing AudioContext and AnalyserSource singleton without stopping hardware tracks.
 */
export async function initPreRollBuffer() {
  try {
    const ctx = getAudioContext();
    const source = getAnalyserSource();
    if (!ctx || !source || ctx.state === 'closed') return;

    if (preRollProcessor) return; // already active

    activeSampleRate = ctx.sampleRate || 44100;
    const targetSamples = Math.round(activeSampleRate * (PRE_ROLL_TARGET_MS / 1000));

    // 2048 samples = ~46ms at 44.1kHz
    const processor = ctx.createScriptProcessor(2048, 1, 1);
    preRollChunks = [];
    preRollTotalSamples = 0;

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const chunk = new Float32Array(input);

      // 1. Maintain circular rolling 400ms pre-roll buffer while idle or speaking
      preRollChunks.push(chunk);
      preRollTotalSamples += chunk.length;

      while (
        preRollChunks.length > 0 &&
        preRollTotalSamples - preRollChunks[0].length >= targetSamples
      ) {
        const removed = preRollChunks.shift();
        preRollTotalSamples -= removed.length;
      }

      // 2. If customer recording is active, append live chunk
      if (isPcmRecording) {
        activePcmChunks.push(chunk);
      }
    };

    // Prevent speaker feedback by routing to silent gain
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);

    preRollProcessor = processor;
    preRollSilentGain = silentGain;

    console.log(
      `[Recorder] Pre-roll buffer initialized (${targetSamples} samples, ~${PRE_ROLL_TARGET_MS}ms at ${activeSampleRate}Hz)`
    );
  } catch (err) {
    console.warn('[Recorder] Pre-roll setup warning:', err);
  }
}

export function teardownPreRoll() {
  if (preRollProcessor) {
    try {
      preRollProcessor.disconnect();
    } catch (_) {}
    preRollProcessor = null;
  }
  if (preRollSilentGain) {
    try {
      preRollSilentGain.disconnect();
    } catch (_) {}
    preRollSilentGain = null;
  }
  preRollChunks = [];
  preRollTotalSamples = 0;
}

export function isRecording() {
  return listening || isPcmRecording;
}

/**
 * Starts capturing customer speech.
 * If isBargeIn is true, prepends the rolling 400ms pre-roll buffer so opening words are preserved.
 */
export async function startRecording({ onComplete, onError, onInterim, isBargeIn = false } = {}) {
  if (listening || isPcmRecording) {
    return;
  }

  activeLiveTranscript = '';
  currentOnComplete = onComplete;
  currentOnError = onError;
  stopResolvers = [];

  try {
    await initPreRollBuffer();
    const ctx = getAudioContext();
    if (ctx) activeSampleRate = ctx.sampleRate || 44100;

    activePcmChunks = [];

    // Prepend pre-roll buffer on barge-in
    if (isBargeIn && preRollChunks.length > 0) {
      let prependedSamples = 0;
      for (const c of preRollChunks) {
        activePcmChunks.push(new Float32Array(c));
        prependedSamples += c.length;
      }
      const prependedMs = Math.round((prependedSamples / activeSampleRate) * 1000);
      console.log(
        `[Recorder] Barge-in: prepended ${prependedSamples} samples (~${prependedMs}ms) pre-roll buffer to recording`
      );
      logVoiceEvent('PRE_ROLL_BUFFER_PREPENDED', {
        samples: prependedSamples,
        durationMs: prependedMs,
        sampleRate: activeSampleRate,
      });
    }

    isPcmRecording = true;
    listening = true;

    logVoiceEvent('RECORDER_STARTED', {
      format: 'audio/wav',
      sampleRate: activeSampleRate,
      isBargeIn,
    });

    // Optional browser SpeechRecognition for immediate visual interim feedback
    const SpeechRecognitionClass =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (SpeechRecognitionClass) {
      try {
        const recognizer = new SpeechRecognitionClass();
        recognizer.continuous = true;
        recognizer.interimResults = true;
        recognizer.lang = 'en-IN';
        recognizer.maxAlternatives = 1;

        let finalAcc = '';

        recognizer.onresult = (event) => {
          let interimAcc = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              finalAcc += res[0].transcript + ' ';
            } else {
              interimAcc += res[0].transcript;
            }
          }
          activeLiveTranscript = (finalAcc + ' ' + interimAcc).trim();
          onInterim?.(activeLiveTranscript);
        };

        recognizer.onerror = (e) => {
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn('[Recorder] SpeechRecognition error:', e.error);
          }
        };

        recognizer.start();
        speechRecognizer = recognizer;
      } catch (recErr) {
        console.warn('[Recorder] SpeechRecognition not initialized:', recErr);
      }
    }

    // Safety timeout
    recordingTimer = setTimeout(() => {
      if (isPcmRecording) {
        console.log('[Recorder] Maximum recording time reached');
        stopRecording();
      }
    }, MAX_RECORDING_MS);
  } catch (error) {
    console.error('[Recorder] Recording start error:', error);
    listening = false;
    isPcmRecording = false;
    onError?.(error);
  }
}

/**
 * Stops recording, serializes accumulated PCM frames to 16-bit PCM WAV,
 * and delivers the complete audio blob.
 */
export function stopRecording() {
  if (recordingTimer) {
    clearTimeout(recordingTimer);
    recordingTimer = null;
  }

  if (speechRecognizer) {
    try {
      speechRecognizer.stop();
    } catch (_) {}
    speechRecognizer = null;
  }

  return new Promise((resolve) => {
    if (!listening && !isPcmRecording) {
      resolve({ blob: null, mimeType: '', transcript: activeLiveTranscript });
      return;
    }

    stopResolvers.push(resolve);

    isPcmRecording = false;
    listening = false;

    // Flatten all active PCM chunks (pre-roll + live)
    let totalSamples = 0;
    for (const c of activePcmChunks) {
      totalSamples += c.length;
    }

    let result;
    if (totalSamples === 0) {
      console.log('[Recorder] Empty audio recording');
      result = { blob: null, mimeType: '', transcript: activeLiveTranscript };
      logVoiceEvent('CUSTOMER_UTTERANCE_CAPTURED', {
        bytes: 0,
        interimLength: activeLiveTranscript.length,
      });
    } else {
      const flatSamples = new Float32Array(totalSamples);
      let offset = 0;
      for (const c of activePcmChunks) {
        flatSamples.set(c, offset);
        offset += c.length;
      }

      const wavBuffer = encodeWAV(flatSamples, activeSampleRate);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const durationMs = Math.round((totalSamples / activeSampleRate) * 1000);

      console.log(
        `[Recorder] Audio captured: ${blob.size} bytes (audio/wav, ${durationMs}ms, ${activeSampleRate}Hz), interim: "${activeLiveTranscript}"`
      );

      result = {
        blob,
        mimeType: 'audio/wav',
        transcript: activeLiveTranscript,
      };

      logVoiceEvent('CUSTOMER_UTTERANCE_CAPTURED', {
        bytes: blob.size,
        mimeType: 'audio/wav',
        durationMs,
        interimLength: activeLiveTranscript.length,
      });
    }

    activePcmChunks = [];

    const cb = currentOnComplete;
    currentOnComplete = null;
    cb?.(result);

    const resolvers = [...stopResolvers];
    stopResolvers = [];
    resolvers.forEach((r) => r(result));
  });
}

export function cleanupRecorder() {
  if (recordingTimer) {
    clearTimeout(recordingTimer);
    recordingTimer = null;
  }

  if (speechRecognizer) {
    try {
      speechRecognizer.stop();
    } catch (_) {}
    speechRecognizer = null;
  }

  isPcmRecording = false;
  listening = false;
  activePcmChunks = [];
  currentOnComplete = null;
  currentOnError = null;
  stopResolvers = [];
}
