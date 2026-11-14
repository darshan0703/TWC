"""
backend/customization_engine.py
Modular Customization Engine for Third Wave Coffee (TWC) Kiosk.
Drives sequential, voice-driven beverage customization with deterministic pricing,
bidirectional touch synchronization, and human-like barista dialogue.
"""

from typing import Dict, Any, List, Optional, Tuple
import re

try:
    from catalog import (
        get_product,
        calculate_customized_price,
        validate_and_configure_item,
    )
    from cart_service import add_item_to_cart
    from semantic_resolver import semantic_resolver
except ImportError:
    from backend.catalog import (
        get_product,
        calculate_customized_price,
        validate_and_configure_item,
    )
    from backend.cart_service import add_item_to_cart
    from backend.semantic_resolver import semantic_resolver


def get_customization_steps(product: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Derives the ordered list of customization steps based on product configuration.
    Cappuccino (hot-only, espresso-based) generates:
    1. Cup Size (Regular / Large)
    2. Espresso Strength (Single Shot / Double Shot)
    3. Milk Selection (Regular Milk, Skimmed Milk, Soy Milk, Almond Milk, Oat Milk)
    4. Sweetness (No Sugar, Less Sugar, Regular Sugar)
    """
    steps = []
    step_num = 1

    # 1. Size step (if product has sizes or customizable)
    has_large = product.get("largePrice") is not None and product["largePrice"] > product.get("price", 0)
    large_diff = (product["largePrice"] - product.get("price", 0)) if has_large else 40
    size_options = [
        {"id": "Regular", "label": "Regular", "sizeMl": "240 ml", "priceDiff": 0, "desc": "Standard Cup (240ml)"},
        {"id": "Large", "label": "Large", "sizeMl": "350 ml", "priceDiff": large_diff, "desc": "Large Cup (350ml)"},
    ]
    steps.append({
        "key": "size",
        "stepNum": step_num,
        "label": "Cup Size",
        "question": "Which cup size would you prefer today?",
        "hint": "Regular (240 ml) or Large (350 ml)",
        "options": size_options,
        "default": "Regular",
    })
    step_num += 1

    # 2. Temperature step ONLY if supportsTemperature is True
    if product.get("supportsTemperature", True):
        steps.append({
            "key": "temperature",
            "stepNum": step_num,
            "label": "Temperature",
            "question": "Would you like that Hot or Iced?",
            "hint": "Freshly steamed hot or served over ice",
            "options": [
                {"id": "Hot", "label": "Hot", "priceDiff": 0, "desc": "Freshly steamed hot"},
                {"id": "Iced", "label": "Iced", "priceDiff": 0, "desc": "Served over ice"},
            ],
            "default": product.get("defaultTemperature", "Hot"),
        })
        step_num += 1

    # 3. Espresso Strength step (for coffee drinks)
    if product.get("mainCategory") == "coffee":
        steps.append({
            "key": "strength",
            "stepNum": step_num,
            "label": "Strength",
            "question": "How bold would you like your espresso shot?",
            "hint": "Single Shot (+₹0) or Double Shot (+₹50)",
            "options": [
                {"id": "Single Shot", "label": "Single Shot", "desc": "Smooth & balanced Arabica", "priceDiff": 0},
                {"id": "Double Shot", "label": "Double Shot", "desc": "Bold crema punch", "priceDiff": 50},
            ],
            "default": "Double Shot",
        })
        step_num += 1

    # 4. Milk step (for customizable drinks)
    if product.get("customizable", True):
        steps.append({
            "key": "milk",
            "stepNum": step_num,
            "label": "Milk",
            "question": "Which type of milk shall I steam for you?",
            "hint": "Fresh dairy, skimmed, or artisanal plant milks",
            "options": [
                {"id": "Regular", "label": "Regular Milk", "priceDiff": 0, "tag": "Included", "desc": "Fresh dairy milk"},
                {"id": "Skimmed", "label": "Skimmed Milk", "priceDiff": 0, "tag": "Included", "desc": "Low-fat dairy skimmed milk"},
                {"id": "Soy", "label": "Soy Milk", "priceDiff": 40, "tag": "Plant-Based", "desc": "Organic soy plant milk"},
                {"id": "Almond", "label": "Almond Milk", "priceDiff": 45, "tag": "Nutty & Light", "desc": "Nutty & light almond milk"},
                {"id": "Oat", "label": "Oat Milk", "priceDiff": 45, "tag": "Barista Blend", "desc": "Creamy oat barista blend"},
            ],
            "default": "Regular",
        })
        step_num += 1

    # 5. Sweetness step (for customizable drinks)
    if product.get("customizable", True):
        steps.append({
            "key": "sweetness",
            "stepNum": step_num,
            "label": "Sweetness",
            "question": "What sweetness level suits your taste?",
            "hint": "Standard café recipe or customized sugar",
            "options": [
                {"id": "No Sugar", "label": "No Sugar", "desc": "0% Added, unsweetened", "priceDiff": 0},
                {"id": "Less Sugar", "label": "Less Sugar", "desc": "50% Sweetness, mild sweet", "priceDiff": 0},
                {"id": "Regular Sugar", "label": "Regular Sugar", "desc": "Standard Café Recipe", "priceDiff": 0},
            ],
            "default": "Regular Sugar",
        })

    return steps

def calculate_step_price_statement(step_key: str, option: Dict[str, Any]) -> str:
    """
    Produces deterministic statement of price impact for a selected option.
    """
    price_diff = option.get("priceDiff", 0)
    opt_label = option.get("label", option.get("id"))

    if price_diff == 0:
        if step_key == "size":
            return "Okay, Regular. There's no additional charge."
        elif step_key == "strength":
            return f"Got it, {opt_label}. There's no additional charge."
        elif step_key == "milk":
            return f"Perfect, {opt_label} with no extra charge."
        elif step_key == "sweetness":
            return f"{opt_label}, got it. There's no additional charge."
        else:
            return f"{opt_label}, got it. There's no additional charge."
    else:
        if step_key == "size":
            return f"Great choice! {opt_label} will cost an additional ₹{price_diff}."
        elif step_key == "strength":
            return f"{opt_label}, excellent! That will be an additional ₹{price_diff}."
        elif step_key == "milk":
            return f"{opt_label} it is! That will be an additional ₹{price_diff}."
        else:
            return f"{opt_label}, noted! That will be an additional ₹{price_diff}."


def build_confirmation_summary(
    product: Dict[str, Any],
    selections: Dict[str, Any],
    quantity: int = 1,
) -> Tuple[str, int]:
    """
    Builds the explicit final review summary and total price before cart insertion.
    Example:
    "I've set up a Large Cappuccino with a Double Shot, Oat Milk, and Less Sugar.
     The additional customization charges are ₹40 for Large, ₹50 for Double Shot and ₹45 for Oat Milk.
     Your total is ₹400. Shall I add it to your tray?"
    """
    size = selections.get("size", "Regular")
    strength = selections.get("strength", "Double Shot")
    milk = selections.get("milk", "Regular Milk")
    sugar = selections.get("sugar") or selections.get("sweetness") or "Regular Sugar"
    prod_name = product.get("name", "Cappuccino")

    # Map milk id to label if needed
    milk_label = milk
    if milk == "Regular":
        milk_label = "Regular Milk"
    elif milk == "Skimmed":
        milk_label = "Skimmed Milk"
    elif milk == "Soy":
        milk_label = "Soy Milk"
    elif milk == "Almond":
        milk_label = "Almond Milk"
    elif milk == "Oat":
        milk_label = "Oat Milk"

    unit_price = calculate_customized_price(
        product,
        size=size,
        milk=milk_label,
        extra_shot=(strength == "Double Shot"),
        strength=strength,
    )
    total_price = unit_price * max(1, quantity)

    # Calculate additional charges breakdown
    charges = []
    base_price = product.get("price", 0)
    has_large = product.get("largePrice") is not None and product["largePrice"] > base_price
    large_diff = (product["largePrice"] - base_price) if has_large else 40

    if size == "Large":
        charges.append(f"₹{large_diff} for Large")
    if strength == "Double Shot":
        charges.append("₹50 for Double Shot")
    if "soy" in milk_label.lower():
        charges.append("₹40 for Soy Milk")
    elif "oat" in milk_label.lower():
        charges.append("₹45 for Oat Milk")
    elif "almond" in milk_label.lower():
        charges.append("₹45 for Almond Milk")

    if charges:
        if len(charges) == 1:
            charges_str = f"The additional customization charge is {charges[0]}."
        elif len(charges) == 2:
            charges_str = f"The additional customization charges are {charges[0]} and {charges[1]}."
        else:
            charges_str = f"The additional customization charges are {', '.join(charges[:-1])} and {charges[-1]}."
    else:
        charges_str = "There are no additional customization charges."

    summary_text = (
        f"I've set up a {size} {prod_name} with a {strength}, {milk_label}, and {sugar}. "
        f"{charges_str} Your total is ₹{total_price}. Shall I add it to your tray?"
    )
    return summary_text, total_price


class CustomizationSession:
    """
    Manages active step-by-step customization state for a customer session.
    """
    def __init__(self, product: Dict[str, Any], initial_quantity: int = 1):
        self.product = product
        self.steps = get_customization_steps(product)
        self.current_step_index = 0
        self.quantity = max(1, initial_quantity)
        self.pending_confirmation = False
        self.is_completed = False
        self.answered_step_indices = set()

        # Pre-populate selections with reference defaults
        self.selections = {
            "size": "Regular",
            "temperature": product.get("defaultTemperature", "Hot"),
            "strength": "Double Shot" if product.get("mainCategory") == "coffee" else "Single Shot",
            "milk": "Regular Milk",
            "sugar": "Regular Sugar",
            "sweetness": "Regular Sugar",
            "quantity": self.quantity,
        }

    @property
    def current_step(self) -> Optional[Dict[str, Any]]:
        if 0 <= self.current_step_index < len(self.steps):
            return self.steps[self.current_step_index]
        return None

    def get_ui_payload(self) -> Dict[str, Any]:
        """Constructs canonical payload sent to React frontend."""
        milk_val = self.selections.get("milk", "Regular Milk")
        ui_milk = milk_val.replace(" Milk", "").strip() if " " in milk_val else milk_val

        unit_p = calculate_customized_price(
            self.product,
            size=self.selections.get("size", "Regular"),
            milk=self.selections.get("milk", "Regular Milk"),
            strength=self.selections.get("strength", "Double Shot"),
        )
        total_p = unit_p * max(1, self.quantity)

        sugar_val = self.selections.get("sugar") or self.selections.get("sweetness") or "Regular Sugar"

        return {
            "ui_action": "update_customization",
            "step_index": min(self.current_step_index, len(self.steps) - 1),
            "step_key": self.current_step["key"] if self.current_step else "sweetness",
            "size": self.selections.get("size", "Regular"),
            "temperature": self.selections.get("temperature", "Hot"),
            "strength": self.selections.get("strength", "Double Shot"),
            "milk": ui_milk,
            "sugar": sugar_val,
            "quantity": self.quantity,
            "unit_price": unit_p,
            "total_price": total_p,
            "pending_confirmation": self.pending_confirmation,
            "is_completed": self.is_completed,
            "product_id": self.product.get("id"),
            "product_name": self.product.get("name"),
        }

    def sync_from_touch(self, payload: Dict[str, Any]):
        """Synchronizes touch screen selections into canonical backend state."""
        if "step_index" in payload:
            target_idx = max(0, min(int(payload["step_index"]), len(self.steps) - 1))
            self.current_step_index = target_idx
            # Mark all preceding steps as answered since user reached target_idx
            for i in range(target_idx):
                self.answered_step_indices.add(i)
        if "size" in payload and payload["size"]:
            self.selections["size"] = "Large" if "large" in str(payload["size"]).lower() else "Regular"
            if self.current_step_index > 0:
                self.answered_step_indices.add(0)
        if "strength" in payload and payload["strength"]:
            self.selections["strength"] = "Single Shot" if "single" in str(payload["strength"]).lower() else "Double Shot"
            if self.current_step_index > 1:
                self.answered_step_indices.add(1)
        if "milk" in payload and payload["milk"]:
            m_raw = str(payload["milk"]).lower()
            if "oat" in m_raw:
                self.selections["milk"] = "Oat Milk"
            elif "almond" in m_raw:
                self.selections["milk"] = "Almond Milk"
            elif "soy" in m_raw:
                self.selections["milk"] = "Soy Milk"
            elif "skim" in m_raw:
                self.selections["milk"] = "Skimmed Milk"
            else:
                self.selections["milk"] = "Regular Milk"
            if self.current_step_index > 2:
                self.answered_step_indices.add(2)
        if "sugar" in payload and payload["sugar"]:
            s_raw = str(payload["sugar"]).lower()
            if "no" in s_raw or "zero" in s_raw or "without" in s_raw:
                val = "No Sugar"
            elif "less" in s_raw or "half" in s_raw or "50" in s_raw:
                val = "Less Sugar"
            else:
                val = "Regular Sugar"
            self.selections["sugar"] = val
            self.selections["sweetness"] = val
            if self.current_step_index > 3:
                self.answered_step_indices.add(3)
        if "quantity" in payload and payload["quantity"]:
            self.quantity = max(1, int(payload["quantity"]))
            self.selections["quantity"] = self.quantity
        if payload.get("pending_confirmation"):
            self.pending_confirmation = True

    def process_spoken_turn(
        self,
        user_text: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Processes a single conversational turn in the customization flow.
        Adheres strictly to conversation rules:
        - Asks exactly one question at a time.
        - Uses LLM-driven semantic option resolution grounded in dynamic UI options.
        - Acknowledges choice and states exact price impact.
        - Supports natural spoken responses and multi-step utterances.
        - Supports changing previous selections.
        - Provides full summary and requests explicit confirmation.
        - Adds to cart only after confirmation.
        """
        clean_text = user_text.lower().strip()

        # CASE 1: Pending Confirmation
        if self.pending_confirmation:
            # 1. Positive confirmation: add to cart!
            if any(w in clean_text for w in ["yes", "confirm", "add it", "add to cart", "add to tray", "go ahead", "sounds good", "sure", "yeah", "yep", "okay please", "yes please"]):
                configured = validate_and_configure_item(
                    product=self.product,
                    size=self.selections.get("size"),
                    temperature=self.selections.get("temperature"),
                    milk=self.selections.get("milk"),
                    sugar=self.selections.get("sugar"),
                    strength=self.selections.get("strength"),
                    extra_shot=(self.selections.get("strength") == "Double Shot"),
                    quantity=self.quantity,
                )
                cart_res = add_item_to_cart(
                    context=context,
                    product_id_or_name=self.product["id"],
                    quantity=self.quantity,
                    size=configured["size"],
                    temperature=configured["temperature"],
                    milk=configured["milk"],
                    sugar=configured["sugar"],
                    extra_shot=configured["extraShot"],
                    strength=configured.get("strength"),
                    idempotency_key=context.get("current_idempotency_key"),
                )
                self.is_completed = True
                self.pending_confirmation = False

                reply = (
                    f"I've added your {configured['size']} {self.product['name']} to your tray! "
                    "Would you like to add an artisanal bake or proceed to checkout?"
                )
                return {
                    "reply": reply,
                    "screen": "menu",
                    "data": {
                        "ui_action": "add_to_cart",
                        "item": configured,
                        "cart": cart_res.get("cart", []),
                        "totals": cart_res.get("totals", {}),
                    },
                    "completed": True,
                }

            # 2. Negative confirmation: ask what to change
            if any(w in clean_text for w in ["no", "cancel", "don't", "stop", "wait"]):
                self.pending_confirmation = False
                reply = "No problem! What would you like to change — cup size, espresso strength, milk, or sweetness?"
                return {
                    "reply": reply,
                    "screen": "customization",
                    "data": self.get_ui_payload(),
                    "completed": False,
                }

            # 3. Customer wants to change/modify an option during confirmation
            res = semantic_resolver.resolve(
                user_utterance=user_text,
                product=self.product,
                steps=self.steps,
                current_step_index=self.current_step_index,
                current_selections=self.selections,
                conversation_history=context.get("conversation_history"),
            )

            if res.decision == "selected" and res.selections:
                update_notes = []
                price_statements = []
                for sel in res.selections:
                    matched_step_idx = next((i for i, s in enumerate(self.steps) if s["key"] == sel.step_id), None)
                    if matched_step_idx is None:
                        continue
                    matched_step = self.steps[matched_step_idx]
                    matched_opt = next((o for o in matched_step.get("options", []) if o["id"] == sel.option_id), None)
                    if not matched_opt:
                        continue

                    matched_step_key = matched_step["key"]
                    opt_id = matched_opt["id"]
                    opt_display_name = matched_opt.get("label", opt_id)

                    if matched_step_key == "size":
                        self.selections["size"] = opt_id
                    elif matched_step_key == "temperature":
                        self.selections["temperature"] = opt_id
                    elif matched_step_key == "strength":
                        self.selections["strength"] = opt_id
                    elif matched_step_key == "milk":
                        self.selections["milk"] = opt_display_name
                    elif matched_step_key == "sweetness":
                        self.selections["sugar"] = opt_id
                        self.selections["sweetness"] = opt_id

                    self.answered_step_indices.add(matched_step_idx)
                    update_notes.append(f"Updated to {opt_display_name}.")
                    price_statements.append(calculate_step_price_statement(matched_step_key, matched_opt))

                combined_update_note = " ".join(update_notes)
                combined_price_stmt = " ".join(price_statements)
                summary_msg, _ = build_confirmation_summary(self.product, self.selections, self.quantity)
                reply = f"{combined_update_note} {combined_price_stmt} {summary_msg}".strip()
                return {
                    "reply": reply,
                    "screen": "customization",
                    "data": self.get_ui_payload(),
                    "completed": False,
                }

        # Explicit customer command to add to cart directly:
        if any(w in clean_text for w in ["add to cart", "add to my cart", "add to tray", "add it to my cart", "add it to tray", "add this to my cart", "add this to tray", "please add it"]):
            configured = validate_and_configure_item(
                product=self.product,
                size=self.selections.get("size"),
                temperature=self.selections.get("temperature"),
                milk=self.selections.get("milk"),
                sugar=self.selections.get("sugar"),
                strength=self.selections.get("strength"),
                extra_shot=(self.selections.get("strength") == "Double Shot"),
                quantity=self.quantity,
            )
            cart_res = add_item_to_cart(
                context=context,
                product_id_or_name=self.product["id"],
                quantity=self.quantity,
                size=configured["size"],
                temperature=configured["temperature"],
                milk=configured["milk"],
                sugar=configured["sugar"],
                extra_shot=configured["extraShot"],
                strength=configured.get("strength"),
                idempotency_key=context.get("current_idempotency_key"),
            )
            self.is_completed = True
            self.pending_confirmation = False

            reply = (
                f"I've added your {configured['size']} {self.product['name']} to your tray! "
                "Would you like to add an artisanal bake or proceed to checkout?"
            )
            return {
                "reply": reply,
                "screen": "menu",
                "data": {
                    "ui_action": "add_to_cart",
                    "item": configured,
                    "cart": cart_res.get("cart", []),
                    "totals": cart_res.get("totals", {}),
                },
                "completed": True,
            }

        # CASE 2: Customer specifies options for steps (supports multi-option utterances and changing previous answers)
        res = semantic_resolver.resolve(
            user_utterance=user_text,
            product=self.product,
            steps=self.steps,
            current_step_index=self.current_step_index,
            current_selections=self.selections,
            conversation_history=context.get("conversation_history"),
        )

        if res.decision == "selected" and res.selections:
            price_statements = []
            for sel in res.selections:
                matched_step_idx = next((i for i, s in enumerate(self.steps) if s["key"] == sel.step_id), None)
                if matched_step_idx is None:
                    continue
                matched_step = self.steps[matched_step_idx]
                matched_opt = next((o for o in matched_step.get("options", []) if o["id"] == sel.option_id), None)
                if not matched_opt:
                    continue

                matched_step_key = matched_step["key"]
                opt_id = matched_opt["id"]
                opt_display_name = matched_opt.get("label", opt_id)

                # Save selection
                if matched_step_key == "size":
                    self.selections["size"] = opt_id
                elif matched_step_key == "temperature":
                    self.selections["temperature"] = opt_id
                elif matched_step_key == "strength":
                    self.selections["strength"] = opt_id
                elif matched_step_key == "milk":
                    self.selections["milk"] = opt_display_name
                elif matched_step_key == "sweetness":
                    self.selections["sugar"] = opt_id
                    self.selections["sweetness"] = opt_id

                self.answered_step_indices.add(matched_step_idx)
                price_statements.append(calculate_step_price_statement(matched_step_key, matched_opt))

            combined_price_stmt = " ".join(price_statements)

            # Find next unanswered step index
            next_idx = None
            for idx in range(len(self.steps)):
                if idx not in self.answered_step_indices:
                    next_idx = idx
                    break

            if next_idx is not None:
                self.current_step_index = next_idx
                next_step = self.steps[next_idx]
                reply = f"{combined_price_stmt} {next_step['question']}".strip()
                return {
                    "reply": reply,
                    "screen": "customization",
                    "data": self.get_ui_payload(),
                    "completed": False,
                }
            else:
                # All steps have been answered! Present final review & ask for confirmation
                self.pending_confirmation = True
                self.current_step_index = len(self.steps) - 1
                summary_msg, _ = build_confirmation_summary(self.product, self.selections, self.quantity)
                reply = f"{combined_price_stmt} {summary_msg}".strip()
                return {
                    "reply": reply,
                    "screen": "customization",
                    "data": self.get_ui_payload(),
                    "completed": False,
                }

        curr_step = self.current_step or self.steps[0]

        # CASE 3: Needs clarification
        if res.decision == "needs_clarification":
            reply = res.clarification_question or f"Could you clarify what you would prefer for {curr_step['label']}?"
            return {
                "reply": reply,
                "screen": "customization",
                "data": self.get_ui_payload(),
                "completed": False,
            }

        # CASE 4: Conversational question / chat
        if res.decision == "conversation":
            reply = f"{res.assistant_reply} Now, {curr_step['question']}" if res.assistant_reply else curr_step['question']
            return {
                "reply": reply,
                "screen": "customization",
                "data": self.get_ui_payload(),
                "completed": False,
            }

        # CASE 5: Unrecognized / No Match
        # Repeat the current question and clearly explain available choices
        opts_desc = []
        for o in curr_step.get("options", []):
            p_diff = o.get("priceDiff", 0)
            diff_str = f" (+₹{p_diff})" if p_diff > 0 else " (no extra charge)"
            opts_desc.append(f"{o.get('label', o.get('id'))}{diff_str}")

        options_hint = ", ".join(opts_desc)
        reply = (
            f"I didn't quite catch that. For {curr_step['label']}, you can choose: {options_hint}. "
            f"{curr_step['question']}"
        )
        return {
            "reply": reply,
            "screen": "customization",
            "data": self.get_ui_payload(),
            "completed": False,
        }


# Global registry of active customization sessions per customer session ID
_active_customizations: Dict[str, CustomizationSession] = {}


def get_customization_session(session_id: str) -> Optional[CustomizationSession]:
    return _active_customizations.get(session_id)


def start_customization_session(session_id: str, product: Dict[str, Any], quantity: int = 1) -> CustomizationSession:
    sess = CustomizationSession(product=product, initial_quantity=quantity)
    _active_customizations[session_id] = sess
    return sess


def clear_customization_session(session_id: str):
    if session_id in _active_customizations:
        del _active_customizations[session_id]
