"""
test_cappuccino_flow.py
Comprehensive verification of the TWC Cappuccino Customization Flow:
- Excludes Sweetness/Sugar completely from Cappuccino
- Preserves Sweetness/Sugar on other products (Latte, Cold Brew)
- Verifies 3-Step Sequence: Cup Size -> Coffee Strength -> Milk Selection
- Verifies Cart Confirmation Question: "Would you like me to add this to your cart?"
- Verifies YES adds item with exact pricing and selections
- Verifies NO asks what to change without mentioning sweetness
- Verifies all 5 milks across both Regular and Large sizes
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from catalog import get_product, calculate_customized_price
from customization_engine import (
    get_customization_steps,
    start_customization_session,
    clear_customization_session,
    is_cappuccino_product,
)
from semantic_resolver import semantic_resolver, SemanticResolutionDecision, OptionSelection


def test_customization_step_definitions():
    print("\n--- TEST 1: Step Definitions for Cappuccino vs Other Drinks ---")
    capp = get_product("cappuccino")
    assert capp is not None, "cappuccino product must exist in catalog"
    assert is_cappuccino_product(capp) is True

    capp_steps = get_customization_steps(capp)
    capp_keys = [s["key"] for s in capp_steps]
    print(f"Cappuccino Steps: {capp_keys}")
    assert capp_keys == ["size", "strength", "milk"], f"Expected ['size', 'strength', 'milk'], got {capp_keys}"
    assert "sweetness" not in capp_keys, "Sweetness must NOT appear in cappuccino steps!"

    # Verify cold drinks and other hot drinks keep sweetness
    latte = get_product("cafe_latte")
    latte_keys = [s["key"] for s in get_customization_steps(latte)]
    print(f"Latte Steps: {latte_keys}")
    assert "sweetness" in latte_keys, "Latte must keep sweetness!"

    cold_brew = get_product("classic_cold_brew")
    cb_keys = [s["key"] for s in get_customization_steps(cold_brew)]
    print(f"Cold Brew Steps: {cb_keys}")
    assert "sweetness" in cb_keys, "Cold brew must keep sweetness!"
    print("✓ Test 1 Passed: Cappuccino has only 3 steps; other drinks retain sweetness.")


def test_pricing_and_milk_combinations():
    print("\n--- TEST 2: Pricing Across Sizes and All 5 Milk Choices ---")
    capp = get_product("cappuccino")
    # Base prices: Regular = 265, Large = 305
    # Extra shot (Double Shot) = +50
    # Regular Milk = +0, Skimmed = +0, Soy = +40, Almond = +45, Oat = +45

    milks = [
        ("Regular Milk", 0),
        ("Skimmed Milk", 0),
        ("Soy Milk", 40),
        ("Almond Milk", 45),
        ("Oat Milk", 45),
    ]

    for size in ["Regular", "Large"]:
        base_size_price = 305 if size == "Large" else 265
        for strength in ["Single Shot", "Double Shot"]:
            extra_shot = (strength == "Double Shot")
            shot_price = 50 if extra_shot else 0
            for milk_label, milk_diff in milks:
                expected_price = base_size_price + shot_price + milk_diff
                computed_price = calculate_customized_price(
                    capp,
                    size=size,
                    milk=milk_label,
                    extra_shot=extra_shot,
                    strength=strength
                )
                assert computed_price == expected_price, (
                    f"Mismatch for {size} {strength} {milk_label}: "
                    f"expected {expected_price}, got {computed_price}"
                )
    print("✓ Test 2 Passed: Deterministic pricing verified for all 20 size/strength/milk combinations.")


def test_full_cappuccino_dialogue_flow():
    print("\n--- TEST 3: Cappuccino Dialogue Flow & Cart Confirmation ---")
    capp = get_product("cappuccino")

    def mock_semantic_handler(user_utterance, product, steps, current_step_index, current_selections, **kwargs):
        text = user_utterance.lower()
        if "large" in text:
            return SemanticResolutionDecision(
                decision="selected",
                selections=[OptionSelection(step_id="size", option_id="Large")]
            )
        if "regular" in text and "milk" not in text:
            return SemanticResolutionDecision(
                decision="selected",
                selections=[OptionSelection(step_id="size", option_id="Regular")]
            )
        if "single" in text:
            return SemanticResolutionDecision(
                decision="selected",
                selections=[OptionSelection(step_id="strength", option_id="Single Shot")]
            )
        if "double" in text:
            return SemanticResolutionDecision(
                decision="selected",
                selections=[OptionSelection(step_id="strength", option_id="Double Shot")]
            )
        if "oat" in text:
            return SemanticResolutionDecision(
                decision="selected",
                selections=[OptionSelection(step_id="milk", option_id="Oat")]
            )
        if "almond" in text:
            return SemanticResolutionDecision(
                decision="selected",
                selections=[OptionSelection(step_id="milk", option_id="Almond")]
            )
        return SemanticResolutionDecision(decision="no_match")

    semantic_resolver.set_mock_handler(mock_semantic_handler)

    try:
        # FLOW 1: Regular -> Single Shot -> Oat Milk -> YES (Add to Cart)
        sid1 = "test-capp-session-1"
        clear_customization_session(sid1)
        sess1 = start_customization_session(sid1, capp)
        context1 = {"session_id": sid1, "cart": [], "cart_totals": {}}

        # Turn 1: Customer chooses Regular size
        t1 = sess1.process_spoken_turn("regular cup please", context1)
        print(f"Turn 1 reply: {t1['reply']}")
        assert sess1.selections["size"] == "Regular"
        assert sess1.current_step_index == 1
        assert "strength" in sess1.current_step["key"]

        # Turn 2: Customer chooses Single Shot
        t2 = sess1.process_spoken_turn("single shot", context1)
        print(f"Turn 2 reply: {t2['reply']}")
        assert sess1.selections["strength"] == "Single Shot"
        assert sess1.current_step_index == 2
        assert "milk" in sess1.current_step["key"]

        # Turn 3: Customer chooses Oat Milk (Last customization step!)
        t3 = sess1.process_spoken_turn("oat milk", context1)
        print(f"Turn 3 reply: {t3['reply']}")
        assert sess1.selections["milk"] == "Oat Milk"
        assert sess1.pending_confirmation is True
        assert (
            "This goes really well with your" in t3["reply"]
            or t3["reply"] == "Would you like me to add this to your cart?"
        )

        # Turn 4: Post-customization Recommendation Acceptance - YES (Adds Croissant)
        t4 = sess1.process_spoken_turn("yes please", context1)
        print(f"Turn 4 reply: {t4['reply']}")
        if "Perfect! I've added" in t4["reply"]:
            assert t4["data"]["ui_action"] == "update_cart"
            # Turn 5: Explicitly Add Coffee to Cart
            t5 = sess1.process_spoken_turn("add coffee to cart", context1)
            print(f"Turn 5 reply: {t5['reply']}")
            assert t5["completed"] is True
            item = t5["data"]["item"]
        else:
            assert t4["completed"] is True
            item = t4["data"]["item"]

        print(f"Added item: {item['name']}, Size: {item['size']}, Milk: {item['milk']}, Price: ₹{item['totalPrice']}")
        assert item["size"] == "Regular"
        assert item["strength"] == "Single Shot"
        assert item["milk"] == "Oat Milk"
        assert item["totalPrice"] == 265 + 0 + 45  # ₹310
        # Verify sugar is excluded from summary
        assert "Regular Sugar" not in item.get("customizationsSummary", [])

        # FLOW 2: Large -> Double Shot -> Almond Milk -> NO (Decline confirmation)
        sid2 = "test-capp-session-2"
        clear_customization_session(sid2)
        sess2 = start_customization_session(sid2, capp)
        context2 = {"session_id": sid2, "cart": [], "cart_totals": {}}

        sess2.process_spoken_turn("make it large", context2)
        assert sess2.selections["size"] == "Large"

        sess2.process_spoken_turn("double shot", context2)
        assert sess2.selections["strength"] == "Double Shot"

        t_milk = sess2.process_spoken_turn("almond milk", context2)
        assert sess2.pending_confirmation is True
        assert (
            "This goes really well with your" in t_milk["reply"]
            or t_milk["reply"] == "Would you like me to add this to your cart?"
        )

        # Turn: Customer declines recommendation or declines confirmation
        t_no = sess2.process_spoken_turn("no wait", context2)
        print(f"Negative confirmation reply: {t_no['reply']}")
        if "explore the other recommendations" in t_no["reply"]:
            # Recommendation declined, now ask what to change in coffee
            t_change = sess2.process_spoken_turn("no wait", context2)
            assert sess2.pending_confirmation is False
            assert t_change["completed"] is False
            assert "sweetness" not in t_change["reply"].lower(), "Decline reply must not mention sweetness!"
            assert "milk choice" in t_change["reply"].lower()
        else:
            assert sess2.pending_confirmation is False
            assert t_no["completed"] is False
            assert "sweetness" not in t_no["reply"].lower(), "Decline reply must not mention sweetness!"
            assert "milk choice" in t_no["reply"].lower()
        print("✓ Test 3 Passed: Both complete dialogue flows verified successfully.")

    finally:
        semantic_resolver.set_mock_handler(None)


if __name__ == "__main__":
    test_customization_step_definitions()
    test_pricing_and_milk_combinations()
    test_full_cappuccino_dialogue_flow()
    print("\n==========================================")
    print("ALL CAPPUCCINO FLOW UNIT TESTS PASSED!")
    print("==========================================")

