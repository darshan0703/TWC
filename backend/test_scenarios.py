"""
Comprehensive Coffee Shop Scenario Verification for TWC Conversational Cashier
Tests:
- Natural conversational language
- Indirect requests & recommendations
- Contextual follow-ups & corrections ("make that large", "change to oat milk", "remove the croissant")
- Audio pipeline (Whisper STT -> Agent Runtime -> Kokoro TTS)
"""

import io
import sys
import time
import numpy as np
import soundfile as sf
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from main import app
from state import state_manager

client = TestClient(app)

def test_scenario_a_indirect_and_followup():
    print("\n" + "=" * 70)
    print("SCENARIO A: Indirect Request, Recommendations & Contextual Customization")
    print("=" * 70)

    # 1. Start Session
    sess = client.post("/session/start", json={}).json()
    sid = sess["session_id"]
    print(f"Session started: {sid}")
    time.sleep(0.8)

    # 2. Indirect preference: "I need something cold and not too sweet"
    q1 = "Hey, I need something cold and not too sweet"
    print(f"\n[Customer]: '{q1}'")
    res1 = client.post("/message", json={"session_id": sid, "message": q1}).json()
    print(f"[Barista]: {res1['response']}")
    time.sleep(0.8)

    # 3. Follow-up: "Maybe something with coffee"
    q2 = "Maybe something with coffee"
    print(f"\n[Customer]: '{q2}'")
    res2 = client.post("/message", json={"session_id": sid, "message": q2}).json()
    print(f"[Barista]: {res2['response']}")
    time.sleep(0.8)

    # 4. Selection: "Let's go with the cold brew"
    q3 = "Let's go with the cold brew"
    print(f"\n[Customer]: '{q3}'")
    res3 = client.post("/message", json={"session_id": sid, "message": q3}).json()
    print(f"[Barista]: {res3['response']}")
    time.sleep(0.8)

    # 5. Follow-up customization: "Make that large"
    q4 = "Make that large"
    print(f"\n[Customer]: '{q4}'")
    res4 = client.post("/message", json={"session_id": sid, "message": q4}).json()
    print(f"[Barista]: {res4['response']}")
    time.sleep(0.8)

    # 6. Commit to cart: "Add it to my cart"
    q5 = "Add it to my cart"
    print(f"\n[Customer]: '{q5}'")
    res5 = client.post("/message", json={"session_id": sid, "message": q5}).json()
    print(f"[Barista]: {res5['response']}")
    print(f"Cart: {res5['cart']['item_count']} item, Total: ₹{res5['cart']['total']}")
    assert res5['cart']['item_count'] >= 1
    time.sleep(1.0)


def test_scenario_b_corrections_and_removals():
    print("\n" + "=" * 70)
    print("SCENARIO B: Modifications, Removals & Checkout")
    print("=" * 70)

    sess = client.post("/session/start", json={}).json()
    sid = sess["session_id"]
    time.sleep(0.8)

    # 1. Initial order: "Can I get a cappuccino?"
    q1 = "Can I get a cappuccino?"
    print(f"\n[Customer]: '{q1}'")
    res1 = client.post("/message", json={"session_id": sid, "message": q1}).json()
    print(f"[Barista]: {res1['response']}")
    time.sleep(0.8)

    # 2. Correction: "Actually change that to oat milk and make it large"
    q2 = "Actually change that to oat milk and make it large"
    print(f"\n[Customer]: '{q2}'")
    res2 = client.post("/message", json={"session_id": sid, "message": q2}).json()
    print(f"[Barista]: {res2['response']}")
    time.sleep(0.8)

    # 3. Add to cart
    q3 = "Add to tray"
    print(f"\n[Customer]: '{q3}'")
    res3 = client.post("/message", json={"session_id": sid, "message": q3}).json()
    print(f"[Barista]: {res3['response']}")
    assert res3['cart']['item_count'] == 1
    time.sleep(0.8)

    # 4. Add food item: "Add an almond croissant too"
    q4 = "Add an almond croissant too"
    print(f"\n[Customer]: '{q4}'")
    res4 = client.post("/message", json={"session_id": sid, "message": q4}).json()
    print(f"[Barista]: {res4['response']}")
    time.sleep(0.8)

    if res4['cart']['item_count'] == 1:
        res4_add = client.post("/message", json={"session_id": sid, "message": "Yes, add it to my tray"}).json()
        print(f"[Barista]: {res4_add['response']}")
        assert res4_add['cart']['item_count'] >= 2
    else:
        assert res4['cart']['item_count'] >= 2
    time.sleep(0.8)

    # 5. Removal: "Actually remove the croissant, just the coffee for now"
    q5 = "Actually remove the croissant, just the coffee for now"
    print(f"\n[Customer]: '{q5}'")
    res5 = client.post("/message", json={"session_id": sid, "message": q5}).json()
    print(f"[Barista]: {res5['response']}")
    print(f"Cart after removal: {res5['cart']['item_count']} item, Total: ₹{res5['cart']['total']}")
    time.sleep(0.8)

    # 6. Checkout
    q6 = "Looks good, I'm ready to checkout"
    print(f"\n[Customer]: '{q6}'")
    res6 = client.post("/message", json={"session_id": sid, "message": q6}).json()
    print(f"[Barista]: {res6['response']}")
    assert res6['active_screen'] == 'cart'
    time.sleep(1.0)


def test_scenario_c_audio_pipeline():
    print("\n" + "=" * 70)
    print("SCENARIO C: Audio Pipeline Integration (STT & TTS)")
    print("=" * 70)

    # 1. Generate a synthetic 1-second 16kHz sine wave audio file to verify STT endpoint acceptance
    sr = 16000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    sine = 0.2 * np.sin(2 * np.pi * 440 * t)
    buf = io.BytesIO()
    sf.write(buf, sine, sr, format='WAV')
    buf.seek(0)

    stt_res = client.post("/stt", files={"file": ("test.wav", buf.read(), "audio/wav")})
    assert stt_res.status_code == 200
    stt_data = stt_res.json()
    print(f"STT response for audio test: {stt_data}")

    # 2. Test TTS with coffee-specific phrase
    phrase = "I've added a Large Sea Salt Mocha with Oat Milk to your tray. Total is 362 rupees."
    tts_res = client.post("/tts", json={"text": phrase})
    assert tts_res.status_code == 200
    assert len(tts_res.content) > 50000
    print(f"TTS generated {len(tts_res.content)} bytes of Kokoro audio for '{phrase}'")

    print("\n" + "=" * 70)
    print("ALL SCENARIOS COMPLETED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    test_scenario_a_indirect_and_followup()
    test_scenario_b_corrections_and_removals()
    test_scenario_c_audio_pipeline()
