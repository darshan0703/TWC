/**
 * Audio Analyser Service for Third Wave Coffee Kiosk
 * Provides Web Audio API AnalyserNode and real-time RMS volume extraction.
 */

import { getMicrophone } from './microphoneService';
import { logVoiceEvent } from './voiceLogger';

let audioContext = null;
let analyser = null;
let analyserSource = null;
let hasLoggedFirstData = false;

export async function setupAnalyser() {
  const stream = await getMicrophone();

  if (!audioContext || audioContext.state === 'closed') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch (err) {
      console.warn('[AudioAnalyser] AudioContext resume warning:', err);
    }
  }

  if (!analyser) {
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
  }

  if (!analyserSource) {
    analyserSource = audioContext.createMediaStreamSource(stream);
    analyserSource.connect(analyser);
  }

  logVoiceEvent('AUDIO_CONTEXT_RUNNING', {
    state: audioContext.state,
    sampleRate: audioContext.sampleRate,
  });

  return analyser;
}

export function getAudioContext() {
  return audioContext;
}

export function getAnalyserSource() {
  return analyserSource;
}

export function getVolume() {
  if (!analyser) return 0;

  // Ensure suspended AudioContext resumes if needed
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }

  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);

  let mean = 0;
  for (let i = 0; i < data.length; i++) {
    mean += data[i];
  }
  mean /= data.length;

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - mean) / 128;
    sum += normalized * normalized;
  }

  const rms = Math.sqrt(sum / data.length);

  if (!hasLoggedFirstData && rms > 0) {
    hasLoggedFirstData = true;
    logVoiceEvent('AUDIO_ANALYSER_RECEIVING_DATA', {
      initialVolume: rms.toFixed(4),
      contextState: audioContext?.state,
    });
  }

  return rms;
}

export function hasAnalyser() {
  return Boolean(analyser);
}

export async function cleanupAnalyser() {
  hasLoggedFirstData = false;
  if (analyserSource) {
    try {
      analyserSource.disconnect();
    } catch (_) {}
    analyserSource = null;
  }

  analyser = null;

  if (audioContext) {
    try {
      if (audioContext.state !== 'closed') {
        await audioContext.close();
      }
    } catch (_) {}
    audioContext = null;
  }
}
