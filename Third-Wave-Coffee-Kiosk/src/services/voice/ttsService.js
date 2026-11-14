/**
 * TTS Audio Playback Service for Third Wave Coffee Kiosk
 * Manages audio playback lifecycle, immediate stopping, and URL revocation.
 */

import { fetchTTSAudio } from '../api';
import { logVoiceEvent } from './voiceLogger';

let currentAudio = null;
let currentAudioUrl = null;
let speaking = false;

export function isSpeaking() {
  return speaking;
}

function cleanupAudio() {
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.onplay = null;

    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (error) {
      console.warn('[TTSService] Audio cleanup error:', error);
    }

    currentAudio = null;
  }

  if (currentAudioUrl) {
    try {
      URL.revokeObjectURL(currentAudioUrl);
    } catch (_) {}
    currentAudioUrl = null;
  }

  speaking = false;
  logVoiceEvent('TTS_PLAYBACK_STOPPED');
}

/**
 * Plays an audio Blob (Kokoro 24kHz WAV).
 */
export function playAudioBlob(blob, { onStart, onEnd, onError } = {}) {
  cleanupAudio();

  if (!blob || blob.size === 0) {
    onEnd?.();
    return;
  }

  speaking = true;
  currentAudioUrl = URL.createObjectURL(blob);
  const audio = new Audio(currentAudioUrl);
  currentAudio = audio;

  let completed = false;
  const finish = () => {
    if (completed) return;
    completed = true;
    speaking = false;

    if (currentAudio === audio) {
      currentAudio = null;
    }
    if (currentAudioUrl) {
      try {
        URL.revokeObjectURL(currentAudioUrl);
      } catch (_) {}
      currentAudioUrl = null;
    }

    logVoiceEvent('TTS_PLAYBACK_STOPPED');
    onEnd?.();
  };

  audio.onplay = () => {
    speaking = true;
    onStart?.();
  };

  audio.onended = () => {
    finish();
  };

  audio.onerror = (err) => {
    console.error('[TTSService] Playback error:', err);
    finish();
    onError?.(err);
  };

  audio.play().catch((err) => {
    console.warn('[TTSService] Play prevented by browser autoplay policy:', err);
    finish();
    onError?.(err);
  });
}

/**
 * Convenience method to synthesize and speak text via Kokoro TTS.
 */
export async function speakText(text, { onStart, onEnd, onError } = {}) {
  if (!text || !text.trim()) {
    onEnd?.();
    return;
  }

  cleanupAudio();
  speaking = true;

  try {
    const audioBlob = await fetchTTSAudio(text);
    if (!speaking) return; // Discard if stopped while fetching

    playAudioBlob(audioBlob, { onStart, onEnd, onError });
  } catch (err) {
    speaking = false;
    console.warn('[TTSService] TTS synthesis failed:', err);
    onError?.(err);
    onEnd?.();
  }
}

/**
 * Immediately stops any currently playing audio (instant barge-in).
 */
export function stopSpeaking() {
  if (!speaking && !currentAudio) return;
  logVoiceEvent('TTS_STOP_REQUESTED', { active: speaking });
  cleanupAudio();
}
