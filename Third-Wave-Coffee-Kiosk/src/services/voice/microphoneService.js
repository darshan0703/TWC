/**
 * Microphone Service for Third Wave Coffee Kiosk
 * Manages persistent singleton MediaStream with hardware acoustic echo cancellation
 * and noise suppression.
 */

import { logVoiceEvent } from './voiceLogger';

let mediaStream = null;

export async function getMicrophone() {
  if (mediaStream) {
    const hasLiveTrack = mediaStream
      .getAudioTracks()
      .some((track) => track.readyState === 'live' && track.enabled);

    if (hasLiveTrack) {
      return mediaStream;
    }

    mediaStream = null;
  }

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });

  const tracks = mediaStream.getAudioTracks();
  const primaryTrack = tracks[0];

  logVoiceEvent('MIC_STREAM_ACTIVE', {
    trackCount: tracks.length,
    label: primaryTrack?.label || 'Microphone',
    enabled: primaryTrack?.enabled,
    muted: primaryTrack?.muted,
    readyState: primaryTrack?.readyState,
  });

  return mediaStream;
}

export function releaseMicrophone() {
  if (!mediaStream) return;

  mediaStream.getTracks().forEach((track) => track.stop());
  mediaStream = null;
}

export function hasMicrophone() {
  return (
    mediaStream !== null &&
    mediaStream.getAudioTracks().some((track) => track.readyState === 'live' && track.enabled)
  );
}
