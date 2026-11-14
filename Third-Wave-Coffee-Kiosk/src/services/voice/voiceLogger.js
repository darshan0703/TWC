/**
 * Voice Runtime Diagnostic Logger for Third Wave Coffee Kiosk
 * Provides structured runtime telemetry for voice events, interruption (barge-in),
 * and audio processing lifecycle without logging sensitive customer PII.
 * Persists to sessionStorage so telemetry survives screen transitions.
 */

function getStorageEvents() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem('__TWC_VOICE_EVENTS__');
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveStorageEvents(events) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('__TWC_VOICE_EVENTS__', JSON.stringify(events.slice(-200)));
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  window.__TWC_VOICE_EVENTS__ = getStorageEvents();
}

export function logVoiceEvent(eventName, payload = {}) {
  const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
  const entry = {
    timestamp,
    event: eventName,
    ...payload,
  };

  if (typeof window !== 'undefined') {
    if (!window.__TWC_VOICE_EVENTS__) {
      window.__TWC_VOICE_EVENTS__ = [];
    }
    window.__TWC_VOICE_EVENTS__.push(entry);
    if (window.__TWC_VOICE_EVENTS__.length > 200) {
      window.__TWC_VOICE_EVENTS__.shift();
    }
    saveStorageEvents(window.__TWC_VOICE_EVENTS__);
  }

  // Structured console log
  const payloadStr = Object.keys(payload).length > 0 ? JSON.stringify(payload) : '';
  console.log(`%c[VOICE_DIAGNOSTIC] ${timestamp} %c${eventName}%c ${payloadStr}`,
    'color: #94a3b8; font-weight: normal;',
    'color: #38bdf8; font-weight: bold;',
    'color: #cbd5e1;'
  );
}

export function getVoiceEvents() {
  return (typeof window !== 'undefined' && window.__TWC_VOICE_EVENTS__) || [];
}

export function clearVoiceEvents() {
  if (typeof window !== 'undefined') {
    window.__TWC_VOICE_EVENTS__ = [];
    try {
      sessionStorage.removeItem('__TWC_VOICE_EVENTS__');
    } catch (_) {}
  }
}
