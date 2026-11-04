# Third Wave Coffee (TWC) — Voice-Enabled AI Cashier Kiosk

An intelligent, voice-first self-service kiosk for **Third Wave Coffee**, combining a portrait React 18 touchscreen with a deterministic, LLM-powered voice barista agent.

---

## Architecture Overview

- **Deterministic Business Truth**: 72 specialty items, customizable drink formulas (Large +₹40, Oat/Almond Milk +₹45, Extra Shot +₹50), 5% GST taxes, and thread-safe session cart management.
- **Linguistic Reasoning**: Cerebras LLM (`llama3.3-70b`) with Gemini (`gemini-2.0-flash`) fallback and exponential backoff retry.
- **Audio Pipeline**:
  - **Speech-to-Text (STT)**: OpenAI Whisper (`small.en`) via FFmpeg 16 kHz PCM conversion.
  - **Text-to-Speech (TTS)**: Kokoro TTS (`af_heart`) delivering 24 kHz natural audio.
  - **Voice Activity Detection (VAD)**: Real-time native Web Audio RMS silence detection for hands-free conversational turns.
- **Minimal Voice Indicator**:
  - 5 explicit states: `Idle`, `Listening...`, `Processing...`, `Speaking...`, `Error`.
  - Zero conversational chat bubbles or text captions on screen — delivers a genuine coffee kiosk experience.

---

## Directory Structure

```
├── backend/
│   ├── main.py                    # FastAPI server & endpoints (/session, /message, /stt, /tts, /cart)
│   ├── agent_runtime.py           # ReAct runtime with fast-path deterministic confirmations
│   ├── barista_agent.py           # TWC Barista prompt, tone, & LangChain tools
│   ├── audio_service.py           # Whisper STT & Kokoro 24kHz TTS engine
│   ├── catalog.py                 # 72-item authoritative menu catalog & aliases
│   ├── cart_service.py            # Transactional cart manager with taxes & pricing
│   ├── model.py                   # Multi-provider LLM adapter (Cerebras + Gemini fallback)
│   ├── state.py                   # Session-isolated state manager (UI, Memory, Cart)
│   ├── products_data.json         # Complete TWC menu database
│   ├── test_touch_to_start.py     # Verification suite for touch-to-start voice flow
│   ├── test_scenarios.py          # Multi-turn recommendations, customizations, and audio tests
│   └── test_twc_flow.py           # End-to-end 5-turn customer dialogue test
├── Third-Wave-Coffee-Kiosk/       # Frontend (React 18 / Vite / Tailwind CSS)
│   ├── src/
│   │   ├── components/            # UI components (VoiceBaristaWidget, KioskHeader, etc.)
│   │   ├── context/               # KioskContext & VoiceBaristaContext
│   │   ├── screens/               # 8 Kiosk screens (Welcome, Mobile, Categories, Menu, Cart, etc.)
│   │   └── services/              # API and Web Audio recording/playback service
│   ├── package.json
│   └── vite.config.js
└── INTELLIGENT_AGENT_ARCHITECTURE_AND_REPLICATION_BLUEPRINT.md
```

---

## Quick Start

### 1. Backend Setup
```bash
# Navigate to project root
cd third-wave-coffee-kiosk

# Install backend dependencies (Python 3.11 recommended)
pip install fastapi uvicorn langchain langchain-core langchain-openai langchain-google-genai kokoro soundfile openai-whisper ffmpeg-python

# Set API keys in .env
CEREBRAS_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here

# Start the FastAPI server
python backend/main.py
```
*Backend runs on `http://localhost:8000` (docs available at `/docs`).*

### 2. Frontend Setup
```bash
cd Third-Wave-Coffee-Kiosk
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## Running Verification Tests

```bash
# Test 1: Touch-to-Start voice flow & 8 screen prompts
python backend/test_touch_to_start.py

# Test 2: Complex multi-turn scenarios & audio pipeline
python backend/test_scenarios.py

# Test 3: End-to-end customer order dialogue
python backend/test_twc_flow.py
```
