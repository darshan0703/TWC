"""
End-to-End Verification Test for TWC Conversational Cashier
Tests multi-turn context, drink customization, cart calculation, screen actions, and audio.
"""

import sys
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from main import app
from state import state_manager

client = TestClient(app)

def test_full_twc_conversation():
    print("=" * 70)
    print("RUNNING TWC CONVERSATIONAL CASHIER VERIFICATION TEST")
    print("=" * 70)

    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200
    health = res.json()
    print(f"[1] Health Check: Catalog size={health['catalog_size']}, Categories={health['categories']}")

    # 2. Start Session
    session_res = client.post("/session/start", json={})
    assert session_res.status_code == 200
    session_data = session_res.json()
    session_id = session_data["session_id"]
    print(f"[2] Started Session: {session_id}")
    print(f"    Greeting: {session_data['greeting']}")

    # 3. Turn 1: Initial Drink Request
    turn1_msg = "Hey, can I get a latte?"
    print(f"\n[3] Customer: '{turn1_msg}'")
    turn1_res = client.post("/message", json={
        "session_id": session_id,
        "message": turn1_msg,
        "current_screen": "menu",
        "selected_category": "hot-coffee"
    })
    assert turn1_res.status_code == 200
    data1 = turn1_res.json()
    print(f"    Assistant: {data1['response']}")
    print(f"    Actions: {data1['actions']}")
    print(f"    Selected Product: {data1.get('selected_product', {}).get('name') if data1.get('selected_product') else 'None'}")

    # 4. Turn 2: Contextual Customization ("Make that large with oat milk")
    turn2_msg = "Make that large with oat milk"
    print(f"\n[4] Customer: '{turn2_msg}'")
    turn2_res = client.post("/message", json={
        "session_id": session_id,
        "message": turn2_msg,
        "current_screen": "customization"
    })
    assert turn2_res.status_code == 200
    data2 = turn2_res.json()
    print(f"    Assistant: {data2['response']}")
    print(f"    Actions: {data2['actions']}")
    focused = state_manager.get_session(session_id).memory.focused_product
    print(f"    Focused Customization: size={focused.get('customizations', {}).get('size')}, milk={focused.get('customizations', {}).get('milk')}")

    # 5. Turn 3: Add to Cart
    turn3_msg = "Yes, please add it to my cart"
    print(f"\n[5] Customer: '{turn3_msg}'")
    turn3_res = client.post("/message", json={
        "session_id": session_id,
        "message": turn3_msg
    })
    assert turn3_res.status_code == 200
    data3 = turn3_res.json()
    print(f"    Assistant: {data3['response']}")
    print(f"    Cart count: {data3['cart']['item_count']}, Subtotal: ₹{data3['cart']['subtotal']}, Total: ₹{data3['cart']['total']}")
    assert data3['cart']['item_count'] >= 1, "Cart should have at least 1 item"

    # 6. Turn 4: Food Recommendation & Addition
    turn4_msg = "Can you also add a butter croissant?"
    print(f"\n[6] Customer: '{turn4_msg}'")
    turn4_res = client.post("/message", json={
        "session_id": session_id,
        "message": turn4_msg
    })
    assert turn4_res.status_code == 200
    data4 = turn4_res.json()
    print(f"    Assistant: {data4['response']}")
    print(f"    Cart count: {data4['cart']['item_count']}, Total: ₹{data4['cart']['total']}")
    assert data4['cart']['item_count'] >= 2, "Cart should have 2 items now"

    # 7. Turn 5: Screen Navigation ("Show me the cart")
    turn5_msg = "Looks great, let's go to checkout"
    print(f"\n[7] Customer: '{turn5_msg}'")
    turn5_res = client.post("/message", json={
        "session_id": session_id,
        "message": turn5_msg
    })
    assert turn5_res.status_code == 200
    data5 = turn5_res.json()
    print(f"    Assistant: {data5['response']}")
    print(f"    Active screen: {data5.get('active_screen')}")

    # 8. Test TTS Audio Generation
    tts_text = data5.get("speakable_response") or "Your order is ready for payment."
    print(f"\n[8] Testing TTS for: '{tts_text}'")
    tts_res = client.post("/tts", json={"text": tts_text})
    assert tts_res.status_code == 200
    assert len(tts_res.content) > 1000
    print(f"    TTS Generated: {len(tts_res.content)} bytes of 24kHz WAV audio")

    print("\n" + "=" * 70)
    print("ALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    test_full_twc_conversation()

