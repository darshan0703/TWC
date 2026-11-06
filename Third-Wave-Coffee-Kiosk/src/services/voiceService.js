/**
 * Voice Service for Third Wave Coffee Kiosk
 * Handles microphone recording (MediaRecorder) and audio playback with barge-in support.
 */

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let currentAudio = null;
let currentAudioUrl = null;

// Real-time Speech Recognition
let speechRecognizer = null;
let activeLiveTranscript = '';

// Voice Activity & Silence Detection
let audioCtx = null;
let analyserNode = null;
let sourceNode = null;
let silenceTimer = null;
let maxRecordingTimer = null;
let vadCheckInterval = null;

function cleanupVAD() {
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (maxRecordingTimer) {
    clearTimeout(maxRecordingTimer);
    maxRecordingTimer = null;
  }
  if (vadCheckInterval) {
    clearInterval(vadCheckInterval);
    vadCheckInterval = null;
  }
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch (_) {}
    sourceNode = null;
  }
}

/**
 * Returns a supported audio MIME type for MediaRecorder.
 */
function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    '',
  ];
  for (const type of types) {
    if (!type || MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

/**
 * Requests microphone permission and returns MediaStream.
 */
export async function getMicrophone() {
  if (mediaStream && mediaStream.active) {
    return mediaStream;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    return mediaStream;
  } catch (err) {
    console.error('[VoiceService] Microphone access error:', err);
    throw err;
  }
}

/**
 * Releases microphone tracks and audio context.
 */
export function releaseMicrophone() {
  cleanupVAD();
  if (audioCtx && audioCtx.state !== 'closed') {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
}

/**
 * Starts recording user speech with optional silence detection and live interim speech transcription.
 */
export async function startRecording({ onSilence, onInterim, onFinal, silenceDelay = 1500, maxDuration = 10000 } = {}) {
  // If barista is currently speaking, barge-in immediately!
  stopSpeaking();
  cleanupVAD();

  // Reset speech recognizer
  if (speechRecognizer) {
    try {
      speechRecognizer.stop();
    } catch (_) {}
    speechRecognizer = null;
  }
  activeLiveTranscript = '';

  const stream = await getMicrophone();
  recordedChunks = [];

  const mimeType = getSupportedMimeType();
  const options = mimeType ? { mimeType } : undefined;

  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (err) {
    console.warn('[VoiceService] MediaRecorder options failed, trying default:', err);
    mediaRecorder = new MediaRecorder(stream);
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.start(100); // 100ms slice
  console.log('[VoiceService] Recording started with MIME:', mediaRecorder.mimeType);

  // Initialize browser-native SpeechRecognition for live interim speech events
  const SpeechRecognitionClass = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
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
          console.warn('[VoiceService] SpeechRecognition error:', e.error);
        }
      };

      recognizer.onend = () => {
        onFinal?.(activeLiveTranscript);
      };

      recognizer.start();
      speechRecognizer = recognizer;
    } catch (recErr) {
      console.warn('[VoiceService] SpeechRecognition start warning:', recErr);
    }
  }

  // Set up silence detection (VAD) via Web Audio API if callback provided
  if (onSilence && typeof window !== 'undefined') {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        if (!audioCtx || audioCtx.state === 'closed') {
          audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 512;
        sourceNode = audioCtx.createMediaStreamSource(stream);
        sourceNode.connect(analyserNode);

        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let hasSpoken = false;
        let speechStartTime = 0;

        vadCheckInterval = setInterval(() => {
          if (!mediaRecorder || mediaRecorder.state !== 'recording') {
            cleanupVAD();
            return;
          }

          analyserNode.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;

          // Sound above ambient noise threshold
          if (avg > 15) {
            if (!hasSpoken) {
              hasSpoken = true;
              speechStartTime = Date.now();
            }
            if (silenceTimer) {
              clearTimeout(silenceTimer);
              silenceTimer = null;
            }
          } else if (hasSpoken && Date.now() - speechStartTime > 500) {
            // Customer spoke and is now silent
            if (!silenceTimer) {
              silenceTimer = setTimeout(() => {
                console.log('[VoiceService] Silence detected after speech.');
                cleanupVAD();
                onSilence?.();
              }, silenceDelay);
            }
          }
        }, 100);

        // Max recording safety timer
        maxRecordingTimer = setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            console.log('[VoiceService] Max recording duration reached.');
            cleanupVAD();
            onSilence?.();
          }
        }, maxDuration);
      }
    } catch (vadErr) {
      console.warn('[VoiceService] Web Audio VAD initialization skipped:', vadErr);
    }
  }
}

/**
 * Stops recording and returns the recorded audio Blob along with any live recognized transcript.
 */
export function stopRecording() {
  cleanupVAD();

  if (speechRecognizer) {
    try {
      speechRecognizer.stop();
    } catch (_) {}
    speechRecognizer = null;
  }

  const finalRecordedText = activeLiveTranscript;

  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve({ blob: null, mimeType: '', transcript: finalRecordedText });
      return;
    }

    mediaRecorder.onstop = () => {
      try {
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(recordedChunks, { type: mime });
        recordedChunks = [];
        resolve({ blob, mimeType: mime, transcript: finalRecordedText });
      } catch (err) {
        reject(err);
      }
    };

    mediaRecorder.onerror = (err) => {
      reject(err);
    };

    mediaRecorder.stop();
    console.log('[VoiceService] Recording stopped.');
  });
}

/**
 * Checks if actively recording.
 */
export function isRecording() {
  return mediaRecorder && mediaRecorder.state === 'recording';
}

/**
 * Stops any active TTS playback (Barge-in / interruption).
 */
export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
}

/**
 * Checks if currently playing audio.
 */
export function isSpeaking() {
  return currentAudio && !currentAudio.paused && !currentAudio.ended;
}

/**
 * Plays an audio Blob (Kokoro 24kHz WAV) through the browser.
 */
export function playAudioBlob(blob, { onStart, onEnd, onError } = {}) {
  stopSpeaking();

  if (!blob || blob.size === 0) {
    onEnd?.();
    return;
  }

  currentAudioUrl = URL.createObjectURL(blob);
  currentAudio = new Audio(currentAudioUrl);

  currentAudio.onplay = () => {
    onStart?.();
  };

  currentAudio.onended = () => {
    stopSpeaking();
    onEnd?.();
  };

  currentAudio.onerror = (e) => {
    console.error('[VoiceService] Audio playback error:', e);
    stopSpeaking();
    onError?.(e);
  };

  currentAudio.play().catch((err) => {
    console.warn('[VoiceService] Play() was prevented by browser autoplay policy:', err);
    stopSpeaking();
    onError?.(err);
  });
}

