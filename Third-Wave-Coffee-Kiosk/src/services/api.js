/**
 * API Service for Third Wave Coffee (TWC) Conversational Cashier
 * Connects Frontend Kiosk to FastAPI backend endpoints.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function startSession(sessionId = null) {
  const res = await fetch(`${BASE_URL}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error(`Failed to start session: ${res.statusText}`);
  return await res.json();
}

export async function sendMessage({ sessionId, message, currentScreen, selectedCategory, selectedProductId }) {
  const res = await fetch(`${BASE_URL}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      message,
      current_screen: currentScreen,
      selected_category: selectedCategory,
      selected_product_id: selectedProductId,
    }),
  });
  if (!res.ok) throw new Error(`Message request failed: ${res.statusText}`);
  return await res.json();
}

export async function updateScreenState({ sessionId, screen, category, productId }) {
  try {
    const res = await fetch(`${BASE_URL}/screen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        screen,
        category,
        product_id: productId,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[TWC API] Could not sync screen state:', err);
    return null;
  }
}

export async function syncCustomizationState({
  sessionId,
  stepIndex,
  size,
  temperature,
  strength,
  milk,
  sugar,
  quantity,
  pendingConfirmation,
}) {
  try {
    const res = await fetch(`${BASE_URL}/customization/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        step_index: stepIndex,
        size,
        temperature,
        strength,
        milk,
        sugar,
        quantity,
        pending_confirmation: pendingConfirmation,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[TWC API] Could not sync customization state:', err);
    return null;
  }
}

export async function transcribeAudio(audioBlob, filename = 'speech.webm') {
  const formData = new FormData();
  formData.append('file', audioBlob, filename);

  const res = await fetch(`${BASE_URL}/stt`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`STT request failed: ${res.statusText}`);
  return await res.json();
}

export async function fetchTTSAudio(text, voice = 'af_heart') {
  const res = await fetch(`${BASE_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) throw new Error(`TTS request failed: ${res.statusText}`);
  return await res.blob();
}

export async function fetchCart(sessionId) {
  const res = await fetch(`${BASE_URL}/cart/${sessionId}`);
  if (!res.ok) throw new Error(`Failed to fetch cart: ${res.statusText}`);
  return await res.json();
}

export async function confirmOrderAPI(sessionId, orderType = 'DINE_IN') {
  const res = await fetch(`${BASE_URL}/order/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, order_type: orderType }),
  });
  if (!res.ok) throw new Error(`Order confirmation failed: ${res.statusText}`);
  return await res.json();
}

export async function endSession(sessionId, reason = 'reset') {
  if (!sessionId) return { success: true };
  try {
    const res = await fetch(`${BASE_URL}/session/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, reason }),
    });
    if (!res.ok) return { success: false };
    return await res.json();
  } catch (err) {
    console.warn('[TWC API] Could not end session:', err);
    return { success: false };
  }
}

export async function fetchSessionStatus(sessionId) {
  if (!sessionId) return null;
  try {
    const res = await fetch(`${BASE_URL}/session/status/${sessionId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[TWC API] Could not fetch session status:', err);
    return null;
  }
}

export async function fetchArchivedOrder(orderNumber) {
  if (!orderNumber) return null;
  try {
    const res = await fetch(`${BASE_URL}/orders/${orderNumber}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[TWC API] Could not fetch order:', err);
    return null;
  }
}

export async function updateCustomerPhone({ sessionId, phoneNumber, action = 'set' }) {
  const res = await fetch(`${BASE_URL}/session/phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      phone_number: phoneNumber,
      action,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update phone: ${res.statusText}`);
  }
  return await res.json();
}

export async function fetchSessionState(sessionId) {
  if (!sessionId) return null;
  try {
    const res = await fetch(`${BASE_URL}/session/${sessionId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[TWC API] Could not fetch session state:', err);
    return null;
  }
}

