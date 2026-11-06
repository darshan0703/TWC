"""
Verification Test Suite for Touch-to-Start Voice-First Customer Experience
Tests:
1. Session start greeting asking for mobile number
2. Mobile number screen voice interaction and advance to categories
3. Page-aware prompt map across all 8 kiosk screens
4. Multi-turn ordering after mobile number entry
5. Kokoro TTS synthesis of barista greeting
"""

import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from main import app, PAGE_PROMPT_MAP

client = TestClient(app)

def test_touch_to_start_greeting():
    print("\n" + "=" * 70)
    print("TEST 1: TOUCH-TO-START GREETING ASKING FOR MOBILE NUMBER")
    print("=" * 70)

    res = client.post("/session/start", json={})
    assert res.status_code == 200
    data = res.json()

    expected_greeting = "Hey! Welcome to Third Wave Coffee. It's lovely to have you here. Please enter your mobile number on the screen to get started, or tell me your number!"
    print(f"Session ID: {data['session_id']}")
    print(f"Greeting: {data['greeting']}")
    print(f"Speakable Greeting: {data['speakable_greeting']}")

    assert data["greeting"] == expected_greeting
    assert "mobile number" in data["greeting"]
    print("Touch-to-start greeting verified successfully!")


def test_mobile_number_voice_flow():
    print("\n" + "=" * 70)
    print("TEST 2: MOBILE NUMBER VOICE FLOW ON 'MOBILE' SCREEN")
    print("=" * 70)

    sess = client.post("/session/start", json={}).json()
    sid = sess["session_id"]

    # 1. User is on 'mobile' screen
    client.post("/screen", json={"session_id": sid, "screen": "mobile"})
    time.sleep(0.5)

    # 2. Customer speaks their 10-digit mobile number
    q1 = "My mobile number is 9876543210"
    print(f"[Customer on mobile screen]: '{q1}'")
    res1 = client.post("/message", json={
        "session_id": sid,
        "message": q1,
        "current_screen": "mobile"
    }).json()
    print(f"[Barista]: {res1['response']}")
    print(f"Active Screen after mobile number: {res1['active_screen']}")
    assert res1['active_screen'] == "mobile"
    assert res1['response'] == "Is the number correct?"
    assert res1.get('speakable_response') == "Is the number correct?"
    time.sleep(0.5)

    # 2b. Customer confirms number: "Yes"
    q_conf = "Yes, correct"
    print(f"[Customer confirms number]: '{q_conf}'")
    res_conf = client.post("/message", json={
        "session_id": sid,
        "message": q_conf,
        "current_screen": "mobile"
    }).json()
    print(f"[Barista after confirmation]: {res_conf['response']}")
    print(f"Active Screen after confirmation: {res_conf['active_screen']}")
    assert res_conf['active_screen'] == "categories"
    time.sleep(0.8)

    # 3. Customer now orders from categories: "I want a cappuccino"
    q2 = "Can I get a cappuccino?"
    print(f"\n[Customer on categories screen]: '{q2}'")
    res2 = client.post("/message", json={
        "session_id": sid,
        "message": q2,
        "current_screen": "categories"
    }).json()
    print(f"[Barista]: {res2['response']}")
    assert res2.get("selected_product") is not None
    time.sleep(0.8)

    print("Mobile number voice flow verified successfully!")


def test_page_aware_prompts():
    print("\n" + "=" * 70)
    print("TEST 3: PAGE-AWARE CONTEXT ACROSS ALL 8 SCREENS")
    print("=" * 70)

    sess = client.post("/session/start", json={}).json()
    sid = sess["session_id"]

    screens_to_test = [
        "welcome",
        "mobile",
        "categories",
        "menu",
        "customization",
        "cart",
        "wallet_topup",
        "order_confirmed",
    ]

    for sc in screens_to_test:
        res = client.post("/screen", json={"session_id": sid, "screen": sc})
        assert res.status_code == 200
        data = res.json()
        assert data["active_screen"] == sc
        assert "page_prompt" in data
        assert len(data["page_prompt"]) > 10
        print(f"Screen: {sc:15} -> Page Prompt: {data['page_prompt']}")

    print("All 8 screen prompts verified successfully!")


def test_greeting_tts():
    print("\n" + "=" * 70)
    print("TEST 4: KOKORO TTS SYNTHESIS OF MOBILE GREETING")
    print("=" * 70)

    greeting = "Hey! Welcome to Third Wave Coffee. It's lovely to have you here. Please enter your mobile number on the screen to get started, or tell me your number!"
    res = client.post("/tts", json={"text": greeting})
    assert res.status_code == 200
    assert len(res.content) > 50000
    print(f"Generated {len(res.content)} bytes of Kokoro 24kHz WAV audio for greeting!")
    print("=" * 70)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    test_touch_to_start_greeting()
    test_mobile_number_voice_flow()
    test_page_aware_prompts()
    test_greeting_tts()
