/**
 * Whisper STT Service for Third Wave Coffee Kiosk
 * Dispatches captured audio to backend Whisper speech-to-text endpoint.
 */

import { transcribeAudio } from '../api';
import { logVoiceEvent } from './voiceLogger';

export async function sendAudioToWhisper(blob) {
  if (!blob || blob.size === 0) {
    return { success: false, transcript: '' };
  }

  const start = performance.now();
  logVoiceEvent('STT_TRANSCRIPTION_STARTED', {
    provider: 'whisper',
    bytes: blob.size,
    mimeType: blob.type,
  });

  try {
    const result = await transcribeAudio(blob);
    const durationMs = Math.round(performance.now() - start);
    const transcript = result?.text?.trim() ?? '';

    logVoiceEvent('STT_TRANSCRIPT_RECEIVED', {
      provider: 'whisper',
      success: result?.success ?? false,
      transcript,
      durationMs,
    });

    return {
      success: result?.success ?? false,
      transcript,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    console.error('[WhisperService] STT transcription failed:', error);
    logVoiceEvent('STT_TRANSCRIPT_RECEIVED', {
      provider: 'whisper',
      success: false,
      error: error.message,
      durationMs,
    });
    return { success: false, transcript: '' };
  }
}
