"""
Audio Service for Third Wave Coffee (TWC) Conversational Cashier
Provides Whisper-based Speech-to-Text (STT) and Kokoro-based Text-to-Speech (TTS).
"""

import io
import os
import re
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np

try:
    import whisper
except ImportError:
    whisper = None

try:
    from kokoro import KPipeline
    import soundfile as sf
except ImportError:
    KPipeline = None
    sf = None

WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "small.en")
KOKORO_LANG_CODE = os.getenv("KOKORO_LANG", "a")
KOKORO_DEFAULT_VOICE = os.getenv("KOKORO_VOICE", "af_heart")

class AudioService:
    def __init__(self):
        self._whisper_model = None
        self._kokoro_pipeline = None
        self._lock = threading.Lock()
        self._ffmpeg_path = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"

    @property
    def ffmpeg_available(self) -> bool:
        return bool(self._ffmpeg_path and os.path.exists(self._ffmpeg_path))

    def get_whisper_model(self):
        if self._whisper_model is not None:
            return self._whisper_model
        with self._lock:
            if self._whisper_model is None and whisper is not None:
                print(f"[AudioService] Loading Whisper STT model '{WHISPER_MODEL_NAME}'...")
                self._whisper_model = whisper.load_model(WHISPER_MODEL_NAME)
                print("[AudioService] Whisper STT model loaded.")
        return self._whisper_model

    def get_tts_pipeline(self):
        if self._kokoro_pipeline is not None:
            return self._kokoro_pipeline
        with self._lock:
            if self._kokoro_pipeline is None and KPipeline is not None:
                print(f"[AudioService] Initializing Kokoro TTS pipeline ('{KOKORO_LANG_CODE}')...")
                self._kokoro_pipeline = KPipeline(lang_code=KOKORO_LANG_CODE)
                print("[AudioService] Kokoro TTS pipeline ready.")
        return self._kokoro_pipeline

    def warm_up(self):
        """Pre-warms both models in a worker thread."""
        def _warm():
            try:
                self.get_whisper_model()
            except Exception as e:
                print(f"[AudioService] Whisper warmup error: {e}")
            try:
                self.get_tts_pipeline()
            except Exception as e:
                print(f"[AudioService] Kokoro warmup error: {e}")

        t = threading.Thread(target=_warm, daemon=True)
        t.start()

    def clean_text_for_speech(self, text: str) -> str:
        """Sanitizes text for TTS playback (removes markdown, currency symbols, emojis)."""
        if not text:
            return ""
        # Replace rupee sign with "rupees"
        cleaned = re.sub(r'₹\s*(\d+)', r'\1 rupees', text)
        cleaned = re.sub(r'Rs\.?\s*(\d+)', r'\1 rupees', cleaned)
        # Strip markdown bold, italics, links, backticks
        cleaned = re.sub(r'[*_~`#]', '', cleaned)
        cleaned = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', cleaned)
        # Remove multiple whitespaces or excessive newlines
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

    def transcribe_audio(self, audio_bytes: bytes, filename: str = "audio.webm") -> Dict[str, Any]:
        """Converts incoming audio bytes via FFmpeg to 16kHz mono WAV and transcribes using Whisper."""
        if not audio_bytes:
            return {"success": False, "message": "Uploaded audio is empty"}

        model = self.get_whisper_model()
        if model is None:
            return {"success": False, "message": "Whisper STT is not available or not installed"}

        if not self.ffmpeg_available:
            return {"success": False, "message": "FFmpeg executable not found for audio conversion"}

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            ext = Path(filename).suffix or ".webm"
            in_file = tmp_path / f"input{ext}"
            wav_file = tmp_path / "converted.wav"

            in_file.write_bytes(audio_bytes)

            try:
                # Convert browser audio (WebM/Opus, M4A, etc.) to 16 kHz mono 16-bit PCM WAV
                conv = subprocess.run(
                    [
                        self._ffmpeg_path,
                        "-y",
                        "-i", str(in_file),
                        "-ar", "16000",
                        "-ac", "1",
                        "-c:a", "pcm_s16le",
                        str(wav_file),
                    ],
                    capture_output=True,
                    text=True,
                    timeout=20,
                )
                if conv.returncode != 0:
                    print(f"[AudioService] FFmpeg error: {conv.stderr}")
                    return {"success": False, "message": f"FFmpeg audio conversion failed: {conv.stderr[:100]}"}

                if not wav_file.exists() or wav_file.stat().st_size == 0:
                    return {"success": False, "message": "WAV file was not generated"}

                # Run Whisper transcription
                result = model.transcribe(
                    str(wav_file),
                    language="en",
                    fp16=False,
                )
                transcript = result.get("text", "").strip()
                return {
                    "success": True,
                    "text": transcript,
                }
            except subprocess.TimeoutExpired:
                return {"success": False, "message": "FFmpeg conversion timed out"}
            except Exception as e:
                print(f"[AudioService] STT transcription failed: {e}")
                return {"success": False, "message": f"Transcription error: {str(e)}"}

    def synthesize_speech(self, text: str, voice: str = KOKORO_DEFAULT_VOICE) -> bytes:
        """Synthesizes text into 24kHz WAV audio bytes using Kokoro."""
        clean_text = self.clean_text_for_speech(text)
        if not clean_text:
            return b""

        pipeline = self.get_tts_pipeline()
        if pipeline is None or sf is None:
            raise RuntimeError("Kokoro TTS pipeline is not available")

        generator = pipeline(clean_text, voice=voice)
        audio_segments = []
        for _, _, audio in generator:
            audio_segments.append(np.asarray(audio))

        if not audio_segments:
            raise RuntimeError("Kokoro produced empty audio segments")

        audio_data = np.concatenate(audio_segments)
        buf = io.BytesIO()
        sf.write(buf, audio_data, 24000, format="WAV")
        buf.seek(0)
        return buf.read()

# Global audio service singleton
audio_service = AudioService()

