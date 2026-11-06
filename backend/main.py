"""
FastAPI Server for Third Wave Coffee (TWC) Conversational AI Cashier.
Provides unified REST & Voice endpoints for Kiosk pair-ordering.
"""

import os
import sys
import uuid
import time
from typing import Optional, Dict, Any
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI, UploadFile, File, Form, Request, Response, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from catalog import catalog
from state import state_manager
from session_lifecycle import session_lifecycle, mask_phone_number, mask_pii_in_text, log_safe
from cart_service import cart_service
from agent_runtime import agent_runtime
from audio_service import audio_service

# Initialize FastAPI app
app = FastAPI(
    title="Third Wave Coffee Conversational Cashier API",
    description="Voice and multi-modal conversational cashier engine for TWC kiosk.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pre-warm audio models on startup & start background lifecycle sweeper
@app.on_event("startup")
async def startup_event():
    print("[TWC Server] Starting Third Wave Coffee Cashier API...")
    print(f"[TWC Server] Catalog loaded: {catalog.product_count} products across {len(catalog.categories)} categories.")
    audio_service.warm_up()
    session_lifecycle.start_background_sweeper(interval_seconds=30.0)

@app.on_event("shutdown")
async def shutdown_event():
    session_lifecycle.stop_background_sweeper()

# -------------------------------------------------------------
# Request & Response Schemas
# -------------------------------------------------------------

class SessionStartRequest(BaseModel):
    session_id: Optional[str] = None

class SessionEndRequest(BaseModel):
    session_id: str
    reason: Optional[str] = "reset"

class MessageRequest(BaseModel):
    session_id: str = Field(..., description="Unique customer session identifier")
    message: str = Field(..., description="Customer utterance or query")
    current_screen: Optional[str] = None
    selected_category: Optional[str] = None
    selected_product_id: Optional[str] = None

class ScreenUpdateRequest(BaseModel):
    session_id: str
    screen: str
    category: Optional[str] = None
    product_id: Optional[str] = None

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "af_heart"

class OrderConfirmRequest(BaseModel):
    session_id: str
    order_type: Optional[str] = "DINE_IN"

# -------------------------------------------------------------
# Core API Endpoints
# -------------------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "brand": "Third Wave Coffee",
        "catalog_size": catalog.product_count,
        "categories": len(catalog.categories),
        "ffmpeg_available": audio_service.ffmpeg_available,
        "whisper_ready": audio_service.whisper_loaded,
        "tts_ready": audio_service.tts_loaded,
    }

@app.get("/menu")
def get_menu():
    """Returns the complete structured TWC menu."""
    return catalog.get_all_products()

PAGE_PROMPT_MAP = {
    "welcome": "Hey! Welcome to Third Wave Coffee. Touch start to enter your mobile number and begin your order!",
    "mobile": "Please enter your 10-digit mobile number on the screen to get started, or tell me your number!",
    "categories": "What do you feel like having today — coffee, chilled drinks, or artisanal food?",
    "menu": "Which handcrafted brew or bite would you like to try?",
    "customization": "How would you like your beverage customized? You can choose size, temperature, milk, and sweetness.",
    "cart": "Here is your order tray. Would you like to add anything else or proceed to checkout?",
    "wallet_topup": "How much would you like to add to your Café Wallet today?",
    "order_confirmed": "Your order is confirmed and being handcrafted at the coffee bar. Thank you!",
}

@app.post("/session/start")
def start_session(req: SessionStartRequest):
    """Starts or resets a conversation session."""
    session_id = req.session_id or f"twc-{uuid.uuid4().hex[:8]}"
    state = state_manager.reset_session(session_id)
    
    greeting = (
        "Hey! Welcome to Third Wave Coffee. It's lovely to have you here. Please enter your mobile number on the screen to get started, or tell me your number!"
    )
    
    return {
        "session_id": session_id,
        "greeting": greeting,
        "speakable_greeting": greeting,
        "cart": state.cart.to_dict(),
        "active_screen": state.ui.active_screen,
    }

@app.post("/message")
def send_message(req: MessageRequest):
    """
    Unified conversation turn endpoint for both text input and voice transcripts.
    Receives customer input, updates UI screen state, executes the LLM agent runtime,
    and returns speakable text, UI actions, and updated cart.
    """
    session_id = req.session_id
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    # Update authoritative UI state if provided by frontend
    if req.current_screen or req.selected_category or req.selected_product_id:
        state_manager.update_ui_state(
            session_id=session_id,
            active_screen=req.current_screen,
            selected_category=req.selected_category,
            focused_product_id=req.selected_product_id
        )

    t0 = time.perf_counter()
    response = agent_runtime.process_message(session_id=session_id, user_message=req.message)
    duration_ms = (time.perf_counter() - t0) * 1000.0

    # Ensure speakable_text is clean and speech-friendly
    speakable_text = audio_service.clean_text_for_speech(
        response.get("assistant_message") or response.get("confirmation") or ""
    )

    return {
        "session_id": session_id,
        "response": response.get("assistant_message", ""),
        "speakable_response": speakable_text,
        "actions": response.get("actions", []),
        "cart": response.get("cart", {}),
        "selected_product": response.get("selected_product"),
        "active_screen": response.get("active_screen", "menu"),
        "processing_time_ms": round(duration_ms, 2)
    }

@app.post("/screen")
def update_screen(req: ScreenUpdateRequest):
    """Notifies the backend of user manual UI navigation."""
    state = state_manager.update_ui_state(
        session_id=req.session_id,
        active_screen=req.screen,
        selected_category=req.category,
        focused_product_id=req.product_id
    )
    prompt = PAGE_PROMPT_MAP.get(req.screen, "What handcrafted brew can I get for you today?")
    return {
        "success": True,
        "active_screen": state.ui.active_screen,
        "selected_category": state.ui.selected_category,
        "focused_product_id": state.ui.focused_product_id,
        "page_prompt": prompt,
        "speakable_prompt": audio_service.clean_text_for_speech(prompt),
    }

@app.post("/session/end")
def end_session(req: SessionEndRequest):
    """
    Terminates a customer session, clearing all temporary conversational context,
    preferences, cart, and PII. Idempotent.
    """
    res = state_manager.terminate_session(req.session_id, reason=req.reason or "manual_end")
    return res

@app.get("/session/status/{session_id}")
def get_session_status(session_id: str):
    """Retrieves lifecycle status of a session."""
    return session_lifecycle.get_session_status(session_id)

@app.get("/cart/{session_id}")
def get_cart(session_id: str):
    """Retrieves current cart state."""
    state = state_manager.get_session(session_id)
    return state.cart.to_dict()

@app.post("/order/confirm")
def confirm_order(req: OrderConfirmRequest):
    """
    Finalizes order, archives transactional record in persistent audit store,
    and terminates the temporary customer session context (purging PII).
    """
    order_res = cart_service.confirm_order(req.session_id, order_type=req.order_type or "DINE_IN")
    if not order_res["success"]:
        return order_res

    order = order_res["order"]

    # 1. Permanently archive transactional order record
    state_manager.archive_order(order)

    # 2. Terminate active temporary customer session context (idempotent, DPDP compliant)
    state_manager.terminate_session(req.session_id, reason="order_completed")

    return order_res

@app.get("/orders/{order_number}")
def get_order(order_number: str):
    """Retrieves a completed transactional order by order number."""
    order = state_manager.get_archived_order(order_number)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order '{order_number}' not found")
    return order

@app.get("/orders")
def list_orders():
    """Lists all archived completed orders."""
    return {"orders": state_manager.list_archived_orders()}

# -------------------------------------------------------------
# Voice Endpoints (STT & TTS)
# -------------------------------------------------------------

@app.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    """
    Accepts audio file (WebM/Opus, M4A, WAV), transcribes via Whisper STT,
    and returns transcribed text.
    """
    if not file:
        raise HTTPException(status_code=400, detail="Audio file must be uploaded")

    try:
        audio_data = await file.read()
        if not audio_data:
            return {"success": False, "message": "Uploaded audio file was empty"}

        result = audio_service.transcribe_audio(audio_data, filename=file.filename or "audio.webm")
        return result
    except Exception as e:
        print(f"[TWC Server] STT Error: {repr(e)}")
        return {"success": False, "message": str(e)}

@app.post("/tts")
def text_to_speech(req: TTSRequest):
    """
    Accepts text, synthesizes audio via Kokoro TTS, and returns 24kHz WAV stream.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        audio_bytes = audio_service.synthesize_speech(req.text, voice=req.voice or "af_heart")
        if not audio_bytes:
            raise HTTPException(status_code=500, detail="Failed to synthesize speech")

        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={"Content-Disposition": "inline; filename=speech.wav"}
        )
    except Exception as e:
        print(f"[TWC Server] TTS Error: {repr(e)}")
        return Response(
            content=b"TTS Error",
            media_type="text/plain",
            status_code=500
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

