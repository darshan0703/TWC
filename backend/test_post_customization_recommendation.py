"""
backend/test_post_customization_recommendation.py
Comprehensive Verification Suite for Post-Customization 'Pairs Well With' Recommendations,
LLM Semantic Intent Understanding, and Zero-Regression Video Handling.
"""

import sys
import unittest
from typing import Dict, Any

from catalog import get_product, PASTRY_RECOMMENDATIONS
from customization_engine import CustomizationSession, start_customization_session, get_customization_session, clear_customization_session
from semantic_resolver import semantic_resolver, RecommendationDecision
import model


class TestPostCustomizationRecommendation(unittest.TestCase):

    def setUp(self):
        self.session_id = "test-post-custom-sess"
        clear_customization_session(self.session_id)
        self.product = get_product("cappuccino")
        self.context = {
            "session_id": self.session_id,
            "cart": [],
            "cart_totals": {},
            "selected_product": self.product,
            "current_screen": "customization",
            "conversation_history": [],
        }

    def tearDown(self):
        clear_customization_session(self.session_id)

    def test_01_llm_provider_and_invocation(self):
        """Verify LLM adapter loads provider, basic invoke works, and structured output works."""
        self.assertIsNotNone(model.model.provider, "Expected an active LLM provider (e.g. cerebras/groq/gemini)")
        
        # 1. Real minimal LLM invocation
        from langchain_core.messages import HumanMessage
        basic_resp = model.model.invoke([HumanMessage(content="Reply with exactly 'OK'")])
        self.assertTrue(len(basic_resp.content.strip()) > 0)

        # 2. Structured output verification
        structured = model.model.with_structured_output(RecommendationDecision)
        self.assertIsNotNone(structured)

    def test_02_customization_completion_triggers_recommendation(self):
        """Verify completing all steps triggers the first Pairs Well With recommendation prompt."""
        cust_sess = start_customization_session(self.session_id, self.product)
        first_rec = PASTRY_RECOMMENDATIONS[0]

        # Step 1: Size -> Large
        res1 = cust_sess.process_spoken_turn("Make it large", self.context)
        self.assertEqual(cust_sess.selections["size"], "Large")
        self.assertEqual(res1["data"]["selected_step"], "size")
        self.assertFalse(res1.get("completed", False))

        # Step 2: Strength -> Single Shot
        res2 = cust_sess.process_spoken_turn("Single shot please", self.context)
        self.assertEqual(cust_sess.selections["strength"], "Single Shot")
        self.assertEqual(res2["data"]["selected_step"], "strength")
        self.assertFalse(res2.get("completed", False))

        # Step 3: Milk -> Regular Milk (Final step for Cappuccino)
        res3 = cust_sess.process_spoken_turn("Regular milk", self.context)
        self.assertEqual(res3["data"]["selected_step"], "milk")
        self.assertTrue(cust_sess.pending_confirmation)
        self.assertEqual(cust_sess.recommendation_state, "offered")
        self.assertIsNotNone(cust_sess.pending_recommendation)
        self.assertEqual(cust_sess.pending_recommendation["id"], first_rec["id"])

        # Spoken reply must naturally say:
        # "This goes really well with your [selected coffee name]. Would you like me to add [recommended product name] to your order?"
        coffee_name = self.product["name"]
        rec_name = first_rec["name"]
        expected_phrase = f"This goes really well with your {coffee_name}. Would you like me to add {rec_name} to your order?"
        self.assertIn(expected_phrase, res3["reply"])

        # Verify recommendation is NOT automatically added to cart!
        self.assertEqual(len(self.context["cart"]), 0, "Cart must remain empty until customer confirms!")

    def test_03_customer_accepts_recommendation(self):
        """Verify affirmative customer response adds the recommended pastry through authoritative cart service."""
        cust_sess = start_customization_session(self.session_id, self.product)
        first_rec = PASTRY_RECOMMENDATIONS[0]

        # Complete steps to reach recommendation
        cust_sess.process_spoken_turn("Large", self.context)
        cust_sess.process_spoken_turn("Single shot", self.context)
        res_rec = cust_sess.process_spoken_turn("Regular milk", self.context)
        self.assertEqual(cust_sess.recommendation_state, "offered")

        # Customer accepts: "Yes, add it."
        accept_res = cust_sess.process_spoken_turn("Yes, add it.", self.context)

        # 1. State marked accepted
        self.assertEqual(cust_sess.recommendation_state, "accepted")
        self.assertIsNone(cust_sess.pending_recommendation)

        # 2. Spoken confirmation
        rec_name = first_rec["name"]
        self.assertIn(f"Perfect! I've added the {rec_name} to your order.", accept_res["reply"])

        # 3. Item added to authoritative cart
        cart_items = self.context.get("cart", [])
        self.assertEqual(len(cart_items), 1)
        self.assertEqual(cart_items[0]["productId"], first_rec["id"])
        self.assertEqual(cart_items[0]["quantity"], 1)
        self.assertEqual(cart_items[0]["totalPrice"], first_rec["price"])

        # 4. Action emitted is update_cart, NOT update_customization
        self.assertEqual(accept_res["data"]["ui_action"], "update_cart")

    def test_04_customer_declines_recommendation(self):
        """Verify declining recommendation adds nothing and does not repeat prompt."""
        cust_sess = start_customization_session(self.session_id, self.product)

        # Complete steps to reach recommendation
        cust_sess.process_spoken_turn("Large", self.context)
        cust_sess.process_spoken_turn("Single shot", self.context)
        cust_sess.process_spoken_turn("Regular milk", self.context)
        self.assertEqual(cust_sess.recommendation_state, "offered")

        # Customer declines: "Not now, just the coffee."
        decline_res = cust_sess.process_spoken_turn("Not now, just the coffee.", self.context)

        # 1. State marked declined
        self.assertEqual(cust_sess.recommendation_state, "declined")
        self.assertIsNone(cust_sess.pending_recommendation)

        # 2. Spoken response explains other recommendations remain available
        self.assertIn("No problem! You can explore the other recommendations whenever you like.", decline_res["reply"])

        # 3. Cart remains empty
        self.assertEqual(len(self.context["cart"]), 0)

        # 4. No spurious update_customization emitted
        self.assertIsNone(decline_res["data"]["ui_action"])

    def test_05_question_about_recommendation_does_not_add_to_cart(self):
        """Verify questions about price, veg, or details are answered without adding item to cart."""
        cust_sess = start_customization_session(self.session_id, self.product)
        first_rec = PASTRY_RECOMMENDATIONS[0]

        # Complete steps to reach recommendation
        cust_sess.process_spoken_turn("Large", self.context)
        cust_sess.process_spoken_turn("Single shot", self.context)
        cust_sess.process_spoken_turn("Regular milk", self.context)
        self.assertEqual(cust_sess.recommendation_state, "offered")

        # Customer asks: "Is it vegetarian?"
        q_res1 = cust_sess.process_spoken_turn("Is it vegetarian?", self.context)
        self.assertIn("vegetarian", q_res1["reply"].lower())
        self.assertEqual(len(self.context["cart"]), 0, "Question must not add item to cart!")
        self.assertEqual(cust_sess.recommendation_state, "offered", "Recommendation must stay pending")

        # Customer asks: "How much does it cost?"
        q_res2 = cust_sess.process_spoken_turn("How much does it cost?", self.context)
        self.assertIn(str(first_rec["price"]), q_res2["reply"])
        self.assertEqual(len(self.context["cart"]), 0, "Price inquiry must not add item to cart!")
        self.assertEqual(cust_sess.recommendation_state, "offered")

    def test_06_ambiguous_response_clarifies_without_adding(self):
        """Verify ambiguous responses like 'Okay.' do not mutate cart."""
        cust_sess = start_customization_session(self.session_id, self.product)
        first_rec = PASTRY_RECOMMENDATIONS[0]

        # Complete steps to reach recommendation
        cust_sess.process_spoken_turn("Large", self.context)
        cust_sess.process_spoken_turn("Single shot", self.context)
        cust_sess.process_spoken_turn("Regular milk", self.context)

        # Customer responds ambiguously
        ambig_res = cust_sess.process_spoken_turn("Okay.", self.context)
        self.assertEqual(len(self.context["cart"]), 0, "Ambiguous turn must never add item to cart!")
        self.assertIn(first_rec["name"], ambig_res["reply"])

    def test_07_healthy_fats_question_does_not_restart_espresso_video(self):
        """Verify asking a healthy fats question during milk step answers conversationally with ui_action=None."""
        cust_sess = start_customization_session(self.session_id, self.product)

        # Step 1: Large -> Step 2: Double shot
        cust_sess.process_spoken_turn("Large", self.context)
        cust_sess.process_spoken_turn("Double shot", self.context)
        self.assertEqual(cust_sess.current_step_index, 2)  # On Milk step

        # Customer asks: "Which one do you think has the highest healthy fats?"
        fat_res = cust_sess.process_spoken_turn("Which one do you think has the highest healthy fats?", self.context)

        # 1. Answered conversationally
        self.assertTrue(any(w in fat_res["reply"].lower() for w in ["almond", "oat", "fat"]))

        # 2. ui_action is None -> frontend will NOT emit update_customization, avoiding espresso video restart!
        self.assertIsNone(fat_res["data"]["ui_action"])
        self.assertIsNone(fat_res["data"]["selected_step"])


if __name__ == "__main__":
    unittest.main()

