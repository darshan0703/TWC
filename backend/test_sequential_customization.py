"""
backend/test_sequential_customization.py
Comprehensive Verification Suite for Sequential Voice-Driven Product Customization.
Tests exact multi-turn barista interview, deterministic pricing diff communication,
bidirectional touch sync, changing previous answers, and final confirmation.
"""

import unittest
from fastapi.testclient import TestClient
from main import app
from catalog import get_product, calculate_customized_price
from customization_engine import get_customization_steps, get_customization_session


class TestSequentialCustomization(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Create fresh session for each test
        resp = self.client.post("/session/start", json={})
        self.assertEqual(resp.status_code, 200)
        self.session_id = resp.json()["session_id"]

    def test_cappuccino_configuration(self):
        """Verify Cappuccino catalog properties: hot-only, correct prices."""
        capp = get_product("cappuccino")
        self.assertIsNotNone(capp)
        self.assertEqual(capp["price"], 265)
        self.assertEqual(capp["largePrice"], 305)
        self.assertFalse(capp["supportsTemperature"])  # Hot-only
        self.assertEqual(capp["defaultTemperature"], "Hot")

        steps = get_customization_steps(capp)
        self.assertEqual(len(steps), 4)
        step_keys = [s["key"] for s in steps]
        self.assertEqual(step_keys, ["size", "strength", "milk", "sweetness"])
        # Verify no temperature step
        self.assertNotIn("temperature", step_keys)

    def test_main_cappuccino_voice_to_cart_journey(self):
        """
        Main scenario:
        1. Select Cappuccino through voice.
        2. Answer Regular.
        3. Answer Double Shot.
        4. Answer Oat Milk.
        5. Answer Less Sugar.
        6. Verify each price difference is communicated deterministically.
        7. Confirm order -> verify cart insertion and exact total (₹360).
        """
        sid = self.session_id

        # Step 0: Open Cappuccino
        r0 = self.client.post("/message", json={
            "session_id": sid,
            "message": "I'd like a Cappuccino",
            "current_screen": "menu"
        })
        self.assertEqual(r0.status_code, 200)
        d0 = r0.json()
        self.assertEqual(d0["active_screen"], "customization")
        self.assertIn("Which cup size would you prefer today?", d0["response"])
        action0 = d0["actions"][0]
        self.assertEqual(action0["ui_action"], "open_customization")
        self.assertEqual(action0["step_index"], 0)

        # Step 1: Cup Size -> Regular
        r1 = self.client.post("/message", json={
            "session_id": sid,
            "message": "Regular please",
            "current_screen": "customization"
        })
        self.assertEqual(r1.status_code, 200)
        d1 = r1.json()
        self.assertEqual(d1["active_screen"], "customization")
        self.assertIn("no additional charge", d1["response"].lower())
        self.assertIn("How bold would you like your espresso shot?", d1["response"])
        action1 = d1["actions"][0]
        self.assertEqual(action1["ui_action"], "update_customization")
        self.assertEqual(action1["step_index"], 1)
        self.assertEqual(action1["size"], "Regular")

        # Step 2: Strength -> Double Shot
        r2 = self.client.post("/message", json={
            "session_id": sid,
            "message": "Double shot",
            "current_screen": "customization"
        })
        self.assertEqual(r2.status_code, 200)
        d2 = r2.json()
        self.assertEqual(d2["active_screen"], "customization")
        self.assertIn("50", d2["response"])
        self.assertIn("Which type of milk shall I steam for you?", d2["response"])
        action2 = d2["actions"][0]
        self.assertEqual(action2["ui_action"], "update_customization")
        self.assertEqual(action2["step_index"], 2)
        self.assertEqual(action2["strength"], "Double Shot")

        # Step 3: Milk -> Oat Milk
        r3 = self.client.post("/message", json={
            "session_id": sid,
            "message": "Oat milk",
            "current_screen": "customization"
        })
        self.assertEqual(r3.status_code, 200)
        d3 = r3.json()
        self.assertEqual(d3["active_screen"], "customization")
        self.assertIn("45", d3["response"])
        self.assertIn("What sweetness level suits your taste?", d3["response"])
        action3 = d3["actions"][0]
        self.assertEqual(action3["ui_action"], "update_customization")
        self.assertEqual(action3["step_index"], 3)
        self.assertEqual(action3["milk"], "Oat")

        # Step 4: Sweetness -> Less Sugar
        r4 = self.client.post("/message", json={
            "session_id": sid,
            "message": "Less sugar",
            "current_screen": "customization"
        })
        self.assertEqual(r4.status_code, 200)
        d4 = r4.json()
        self.assertEqual(d4["active_screen"], "customization")
        self.assertIn("no additional charge", d4["response"].lower())
        self.assertIn("total is ₹360", d4["response"])
        self.assertIn("Shall I add it to your tray?", d4["response"])
        action4 = d4["actions"][0]
        self.assertEqual(action4["ui_action"], "update_customization")
        self.assertTrue(action4["pending_confirmation"])
        self.assertEqual(action4["total_price"], 360)

        # Cart should still be empty before confirmation!
        cart_before = self.client.get(f"/cart/{sid}").json()
        self.assertEqual(len(cart_before.get("items", [])), 0)

        # Step 5: Confirmation -> "Yes please, add it"
        r5 = self.client.post("/message", json={
            "session_id": sid,
            "message": "Yes please, add it!",
            "current_screen": "customization"
        })
        self.assertEqual(r5.status_code, 200)
        d5 = r5.json()
        self.assertIn("added your Regular Signature Cappuccino to your tray", d5["response"])

        # Cart must now contain exactly 1 customized item with total ₹360!
        cart_after = self.client.get(f"/cart/{sid}").json()
        items = cart_after.get("items", [])
        self.assertEqual(len(items), 1)
        item = items[0]
        self.assertEqual(item["name"], "Signature Cappuccino")
        self.assertEqual(item["size"], "Regular")
        self.assertEqual(item["strength"], "Double Shot")
        self.assertEqual(item["milk"], "Oat Milk")
        self.assertEqual(item["sugar"], "Less Sugar")
        self.assertEqual(item["totalPrice"], 360)
        self.assertEqual(cart_after["subtotal"], 360)
        self.assertEqual(cart_after["total"], 378)

    def test_large_cappuccino_flow(self):
        """Test ordering Large (+₹40) with Single Shot (+₹0) and Soy Milk (+₹40)."""
        sid = self.session_id

        # Open Cappuccino
        self.client.post("/message", json={
            "session_id": sid,
            "message": "I want a cappuccino",
            "current_screen": "menu"
        })

        # Size: Large
        r1 = self.client.post("/message", json={
            "session_id": sid,
            "message": "Make it large",
            "current_screen": "customization"
        })
        self.assertIn("additional ₹40", r1.json()["response"])

        # Strength: Single shot
        r2 = self.client.post("/message", json={
            "session_id": sid,
            "message": "Single shot",
            "current_screen": "customization"
        })
        self.assertIn("no additional charge", r2.json()["response"].lower())

        # Milk: Soy milk
        r3 = self.client.post("/message", json={
            "session_id": sid,
            "message": "Soy milk",
            "current_screen": "customization"
        })
        self.assertIn("additional ₹40", r3.json()["response"])

        # Sugar: No sugar
        r4 = self.client.post("/message", json={
            "session_id": sid,
            "message": "No sugar",
            "current_screen": "customization"
        })
        # Base: 265 + Large 40 + Single 0 + Soy 40 + Sugar 0 = 345
        self.assertIn("total is ₹345", r4.json()["response"])

        # Confirm
        r5 = self.client.post("/message", json={
            "session_id": sid,
            "message": "Confirm",
            "current_screen": "customization"
        })
        cart = self.client.get(f"/cart/{sid}").json()
        self.assertEqual(cart["subtotal"], 345)
        self.assertEqual(cart["total"], 362)

    def test_changing_earlier_selection(self):
        """Test customer changing earlier selection (e.g. changing milk)."""
        sid = self.session_id

        self.client.post("/message", json={
            "session_id": sid,
            "message": "Cappuccino please",
            "current_screen": "menu"
        })
        self.client.post("/message", json={"session_id": sid, "message": "Regular", "current_screen": "customization"})
        self.client.post("/message", json={"session_id": sid, "message": "Double shot", "current_screen": "customization"})
        self.client.post("/message", json={"session_id": sid, "message": "Oat milk", "current_screen": "customization"})
        r4 = self.client.post("/message", json={"session_id": sid, "message": "Less sugar", "current_screen": "customization"})
        self.assertIn("total is ₹360", r4.json()["response"])

        # Change milk to regular milk
        r_change = self.client.post("/message", json={
            "session_id": sid,
            "message": "Actually, make it regular milk",
            "current_screen": "customization"
        })
        d_change = r_change.json()
        self.assertIn("Updated to Regular Milk", d_change["response"])
        # Base: 265 + Regular 0 + Double Shot 50 + Regular Milk 0 + Less Sugar 0 = 315
        self.assertIn("total is ₹315", d_change["response"])
        self.assertIn("Shall I add it to your tray?", d_change["response"])

        # Confirm after change
        self.client.post("/message", json={"session_id": sid, "message": "Yes, add it", "current_screen": "customization"})
        cart = self.client.get(f"/cart/{sid}").json()
        self.assertEqual(cart["subtotal"], 315)
        self.assertEqual(cart["total"], 331)

    def test_touch_synchronization_endpoint(self):
        """Test POST /customization/sync keeps backend and voice synchronized."""
        sid = self.session_id

        # Open Cappuccino via touch
        self.client.post("/screen", json={
            "session_id": sid,
            "screen": "customization",
            "product_id": "cappuccino"
        })

        # Touch user selects Large and Single Shot on screen
        r_sync = self.client.post("/customization/sync", json={
            "session_id": sid,
            "step_index": 2,
            "size": "Large",
            "strength": "Single Shot",
            "milk": "Almond",
            "sugar": "Regular Sugar"
        })
        self.assertEqual(r_sync.status_code, 200)
        d_sync = r_sync.json()
        self.assertTrue(d_sync["success"])
        # Base 265 + Large 40 + Single 0 + Almond 45 = 350
        self.assertEqual(d_sync["customization"]["unit_price"], 350)
        self.assertEqual(d_sync["customization"]["step_index"], 2)

        # Now customer speaks into mic: "Almond milk"
        r_speak = self.client.post("/message", json={
            "session_id": sid,
            "message": "Almond milk please",
            "current_screen": "customization"
        })
        self.assertEqual(r_speak.status_code, 200)
        # Assistant acknowledges Almond milk and asks step 4 (sweetness)
        self.assertIn("What sweetness level suits your taste?", r_speak.json()["response"])

    def test_unrecognized_spoken_answer(self):
        """Test unrecognized answer prompts user with available options."""
        sid = self.session_id

        self.client.post("/message", json={
            "session_id": sid,
            "message": "I'd like a cappuccino",
            "current_screen": "menu"
        })

        r_gibberish = self.client.post("/message", json={
            "session_id": sid,
            "message": "banana pineapple sunshine",
            "current_screen": "customization"
        })
        self.assertEqual(r_gibberish.status_code, 200)
        reply = r_gibberish.json()["response"]
        self.assertIn("I didn't quite catch that", reply)
        self.assertIn("Regular", reply)
        self.assertIn("Large", reply)
        self.assertIn("Which cup size would you prefer today?", reply)


if __name__ == "__main__":
    unittest.main()
