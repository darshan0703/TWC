/**
 * Transcript Filter Service for Third Wave Coffee Kiosk
 * Filters non-speech hallucination tags from Whisper STT such as [BLANK_AUDIO],
 * (coughing), background chatter, etc.
 */

export function isNonSpeechTranscript(transcript) {
  const normalized = transcript
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (!normalized) return true;

  // Bracketed audio annotations like [applause], (coughing), [music]
  if (/^(\(|\[).*(\)|\])$/.test(normalized)) {
    return true;
  }

  const soundEventPattern =
    /^(?:a |an )?(?:bell|beep|beeping|alarm|siren|engine|car|horn|music|background noise|noise|indistinct chatter|chatter|laughter|laughing|coughing|cough|sneezing|breathing|applause|clapping|clicking|typing|door|phone|ringing|ringtone)(?: .*)?$/;

  return soundEventPattern.test(normalized);
}

export function isValidTranscript(transcript) {
  if (!transcript) return false;

  const normalized = transcript.trim();
  if (!normalized) return false;

  if (normalized === '[BLANK_AUDIO]') {
    return false;
  }

  if (isNonSpeechTranscript(normalized)) {
    return false;
  }

  return true;
}

