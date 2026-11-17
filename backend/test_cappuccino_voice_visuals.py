"""
backend/test_cappuccino_voice_visuals.py
Regression tests for Cappuccino Voice Customization & Visual Synchronization:
- Verifies that Voice selections emit exact selected_step and selected_option matching Touch
- Verifies that all 9 required customization options resolve accurately:
    1. Regular cup
    2. Large cup
    3. Single shot
    4. Double shot
    5. Regular milk
    6. Skimmed milk
    7. Oat milk
    8. Almond milk
    9. Soy milk
- Verifies repeated changing of selections via voice without page reload
- Verifies cart confirmation question timing and successful cart addition
- Verifies approved video assets in public/assets/cappuccino/
"""

import os
from pathlib import Path
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_approved_media_assets():
    print("\n--- TEST 1: Verify Approved Media Assets ---")
    base_assets = Path("../Third-Wave-Coffee-Kiosk/public/assets/cappuccino")
    required_files = [
        "regular-cup.png",
        "regular-to-large.mp4",
        "regular-espresso.mp4",
        "large-espresso.mp4",
        "regular-milk-pour.mp4",
        "large-milk-pour.mp4",
    ]
    for filename in required_files:
        filepath = base_assets / filename
        assert filepath.exists(), f"Asset {filename} must exist at {filepath}"
        size_kb = filepath.stat().st_size / 1024
        assert size_kb > 10, f"Asset {filename} is unexpectedly small ({size_kb} KB)"
        print(f"  ✓ {filename} ({size_kb:.1f} KB)")
    print("✓ TEST 1 Passed: All 6 approved Cappuccino media assets exist and are verified.")


def test_voice_options_equivalence():
    print("\n--- TEST 2: Voice Customization Resolution & Actions for All 9 Options ---")
    session_id = "test-voice-options-9"

    # Start by requesting Cappuccino
    res = client.post("/message", json={
        "session_id": session_id,
        "message": "I want a cappuccino",
        "current_screen": "categories"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["active_screen"] == "customization"
    print("✓ Opened Cappuccino Customization Screen")

    # 1. Voice selects Large cup
    res_large = client.post("/message", json={
        "session_id": session_id,
        "message": "Make it large",
        "current_screen": "customization"
    })
    assert res_large.status_code == 200
    d_large = res_large.json()
    action = d_large["actions"][0]
    assert action["ui_action"] == "update_customization"
    assert action["size"] == "Large"
    assert action["selected_step"] == "size"
    assert action["selected_option"] == "Large"
    print("  ✓ Option 1 (Large Cup): Voice returns size='Large', selected_step='size' -> triggers regular-to-large.mp4")

    # 2. Voice selects Regular cup (changing mind)
    res_reg = client.post("/message", json={
        "session_id": session_id,
        "message": "Actually make it regular cup",
        "current_screen": "customization"
    })
    assert res_reg.status_code == 200
    d_reg = res_reg.json()
    action = d_reg["actions"][0]
    assert action["size"] == "Regular"
    assert action["selected_step"] == "size"
    assert action["selected_option"] == "Regular"
    print("  ✓ Option 2 (Regular Cup): Voice returns size='Regular', selected_step='size' -> triggers regular-cup.png reset")

    # Change back to Large for testing large espresso & milk assets
    client.post("/message", json={
        "session_id": session_id,
        "message": "Make it large",
        "current_screen": "customization"
    })

    # 3. Voice selects Single Shot
    res_single = client.post("/message", json={
        "session_id": session_id,
        "message": "Single shot",
        "current_screen": "customization"
    })
    assert res_single.status_code == 200
    d_single = res_single.json()
    action = d_single["actions"][0]
    assert action["strength"] == "Single Shot"
    assert action["selected_step"] == "strength"
    assert action["selected_option"] == "Single Shot"
    print("  ✓ Option 3 (Single Shot): Voice returns strength='Single Shot', selected_step='strength' -> triggers espresso video")

    # 4. Voice selects Double Shot
    res_double = client.post("/message", json={
        "session_id": session_id,
        "message": "Make it a double shot",
        "current_screen": "customization"
    })
    assert res_double.status_code == 200
    d_double = res_double.json()
    action = d_double["actions"][0]
    assert action["strength"] == "Double Shot"
    assert action["selected_step"] == "strength"
    assert action["selected_option"] == "Double Shot"
    print("  ✓ Option 4 (Double Shot): Voice returns strength='Double Shot', selected_step='strength' -> triggers espresso video")

    # Test all 5 milks
    milks_to_test = [
        ("Regular milk", "Regular", "Regular"),
        ("Skimmed milk", "Skimmed", "Skimmed"),
        ("Oat milk", "Oat", "Oat"),
        ("Almond milk", "Almond", "Almond"),
        ("Soy milk", "Soy", "Soy"),
    ]

    for utterance, expected_milk_ui, opt_id in milks_to_test:
        res_m = client.post("/message", json={
            "session_id": session_id,
            "message": utterance,
            "current_screen": "customization"
        })
        assert res_m.status_code == 200
        d_m = res_m.json()
        action = d_m["actions"][0]
        assert action["milk"] == expected_milk_ui, f"Expected {expected_milk_ui}, got {action['milk']}"
        assert action["selected_step"] == "milk"
        assert action["selected_option"] == opt_id
        print(f"  ✓ Milk Option ({utterance}): Voice returns milk='{expected_milk_ui}', selected_step='milk' -> triggers milk pour video")

    print("✓ TEST 2 Passed: All 9 customization options verified with voice payloads matching touch mechanics.")


def test_repeated_changes_and_cart_addition():
    print("\n--- TEST 3: Repeated Voice Selections & Cart Addition ---")
    session_id = "test-repeated-voice"

    # Start Cappuccino
    client.post("/message", json={"session_id": session_id, "message": "I want a cappuccino", "current_screen": "categories"})

    # Sequence of voice commands changing options repeatedly:
    client.post("/message", json={"session_id": session_id, "message": "Make it large", "current_screen": "customization"})
    client.post("/message", json={"session_id": session_id, "message": "No, regular cup", "current_screen": "customization"})
    client.post("/message", json={"session_id": session_id, "message": "Actually large is fine", "current_screen": "customization"})
    client.post("/message", json={"session_id": session_id, "message": "Double shot", "current_screen": "customization"})
    res_milk = client.post("/message", json={"session_id": session_id, "message": "Oat milk", "current_screen": "customization"})

    data_milk = res_milk.json()
    action = data_milk["actions"][0]
    assert action["size"] == "Large"
    assert action["strength"] == "Double Shot"
    assert action["milk"] == "Oat"
    assert action["pending_confirmation"] is True
    # Base 305 (Large) + 50 (Double Shot) + 45 (Oat) = 400
    assert action["unit_price"] == 400
    assert (
        "This goes really well with your" in data_milk["response"]
        or data_milk["response"] == "Would you like me to add this to your cart?"
    )
    print("✓ Reached Post-Customization State / Confirmation (Total: ₹400)")

    # Confirm order addition: "Yes, please add it"
    res_add = client.post("/message", json={
        "session_id": session_id,
        "message": "Yes, please add it",
        "current_screen": "customization"
    })
    assert res_add.status_code == 200
    data_add = res_add.json()

    # If recommendation was offered, 'Yes, please add it' accepted the pastry recommendation
    if any(a.get("recommendation_state") == "accepted" for a in data_add.get("actions", [])):
        print("✓ Post-customization recommendation accepted into cart.")
        # Now explicitly add coffee to cart
        res_coffee = client.post("/message", json={
            "session_id": session_id,
            "message": "Add coffee to cart",
            "current_screen": "customization"
        })
        assert res_coffee.status_code == 200
        data_add = res_coffee.json()

    assert data_add["active_screen"] == "menu"
    assert any(a.get("ui_action") == "add_to_cart" for a in data_add.get("actions", []))
    added_item = next((i for i in data_add["cart"]["items"] if i.get("id") == "cappuccino" or i.get("name") == "Signature Cappuccino"), None)
    assert added_item is not None
    assert added_item["size"] == "Large"
    assert added_item["strength"] == "Double Shot"
    assert added_item["milk"] == "Oat Milk"
    assert added_item["totalPrice"] == 400
    print(f"✓ TEST 3 Passed: Successfully added {added_item['size']} Cappuccino ({added_item['milk']}, {added_item['strength']}) to tray for ₹{added_item['totalPrice']}.")


if __name__ == "__main__":
    test_approved_media_assets()
    test_voice_options_equivalence()
    test_repeated_changes_and_cart_addition()
    print("\n" + "=" * 65)
    print("ALL CAPPUCCINO VOICE-TO-VISUALIZATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)
