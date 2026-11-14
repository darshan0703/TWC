"""
backend/agent_runtime.py
ReAct Runtime Engine for Third Wave Coffee Conversational Barista.
Executes tool-calling, multi-provider invocation, tool deduplication, and Fast-Path Confirmation.
"""

import json
import re
from typing import Dict, Any, List, Optional
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

WORD_TO_DIGIT = {
    "zero": "0", "oh": "0", "o": "0", "nil": "0",
    "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
    "ten": "10", "eleven": "11", "twelve": "12", "thirteen": "13", "fourteen": "14",
    "fifteen": "15", "sixteen": "16", "seventeen": "17", "eighteen": "18", "nineteen": "19",
    "twenty": "20", "thirty": "30", "forty": "40", "fourty": "40", "fifty": "50",
    "sixty": "60", "seventy": "70", "eighty": "80", "ninety": "90",
}

def extract_spoken_digits(text: str) -> str:
    """Extracts numeric digits from speech, supporting word numbers and multipliers while preserving leading zeros."""
    if not text:
        return ""
    clean = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
    tokens = clean.split()
    digits = []
    i = 0
    while i < len(tokens):
        token = tokens[i]
        # Multipliers
        if token == "double" and i + 1 < len(tokens):
            next_t = tokens[i + 1]
            d = WORD_TO_DIGIT.get(next_t) or (next_t if next_t.isdigit() and len(next_t) == 1 else None)
            if d:
                digits.append(d * 2)
                i += 2
                continue
        elif token == "triple" and i + 1 < len(tokens):
            next_t = tokens[i + 1]
            d = WORD_TO_DIGIT.get(next_t) or (next_t if next_t.isdigit() and len(next_t) == 1 else None)
            if d:
                digits.append(d * 3)
                i += 2
                continue

        if token in WORD_TO_DIGIT:
            digits.append(WORD_TO_DIGIT[token])
        elif token.isdigit():
            digits.append(token)
        i += 1
    return "".join(digits)

def is_positive_confirmation(text: str) -> bool:
    """Returns True if user affirms/confirms the displayed number."""
    t = text.lower().strip()
    patterns = [
        r"\byes\b", r"\byeah\b", r"\byep\b", r"\byup\b", r"\bcorrect\b",
        r"\bthat'?s\s+right\b", r"\bright\b", r"\bsure\b", r"\bconfirm\b",
        r"\bconfirmed\b", r"\bproceed\b", r"\bcontinue\b", r"\bok\b", r"\bokay\b",
        r"\bperfect\b", r"\bya\b"
    ]
    return any(re.search(p, t) for p in patterns)

def is_negative_confirmation(text: str) -> bool:
    """Returns True if user rejects/corrects the displayed number."""
    t = text.lower().strip()
    patterns = [
        r"\bno\b", r"\bnope\b", r"\bwrong\b", r"\bincorrect\b",
        r"\bthat'?s\s+wrong\b", r"\bnot\s+right\b", r"\bnot\s+correct\b",
        r"\bchange\b", r"\bclear\b", r"\bfalse\b"
    ]
    return any(re.search(p, t) for p in patterns)

try:
    from barista_agent import BARISTA_SYSTEM_PROMPT, build_barista_context, create_barista_tools
    from model import model
    from state import get_conversation_context
except ImportError:
    from backend.barista_agent import BARISTA_SYSTEM_PROMPT, build_barista_context, create_barista_tools
    from backend.model import model
    from backend.state import get_conversation_context


class AgentRuntime:
    def __init__(self):
        self.model = model

    def run(self, user_input: str, context: Dict[str, Any]) -> Dict[str, Any]:
        current_screen = context.get("current_screen", "welcome")

        # -------------------------------------------------------------
        # FAST-PATH 1: Pending Mobile Number Confirmation Handling
        # -------------------------------------------------------------
        if context.get("pending_number_confirmation"):
            if is_positive_confirmation(user_input):
                clean_phone = context.get("staged_mobile_number") or context.get("mobile_number") or ""
                context["mobile_number"] = clean_phone
                context["staged_mobile_number"] = None
                context["pending_number_confirmation"] = False
                context["current_screen"] = "categories"

                reply = "What do you feel like having today — coffee, chilled drinks, or artisanal food?"
                context.setdefault("conversation_history", []).extend([
                    HumanMessage(content=user_input),
                    AIMessage(content=reply)
                ])

                return {
                    "screen": "categories",
                    "message": reply,
                    "data": {
                        "ui_action": "set_mobile",
                        "mobile_number": clean_phone,
                    },
                    "cart": context.get("cart", []),
                    "totals": context.get("cart_totals", {}),
                }

            elif is_negative_confirmation(user_input):
                context["staged_mobile_number"] = None
                context["pending_number_confirmation"] = False
                context["current_screen"] = "mobile"

                reply = "No problem, please say or enter your mobile number again."
                context.setdefault("conversation_history", []).extend([
                    HumanMessage(content=user_input),
                    AIMessage(content=reply)
                ])

                return {
                    "screen": "mobile",
                    "message": reply,
                    "data": {
                        "ui_action": "clear_mobile",
                    },
                    "cart": context.get("cart", []),
                    "totals": context.get("cart_totals", {}),
                }

            # If user provided a new number directly while in confirmation mode
            new_digits = extract_spoken_digits(user_input)
            if len(new_digits) >= 10:
                clean_phone = new_digits[:10] if new_digits.startswith('0') and len(new_digits) == 10 else new_digits[-10:]
                context["staged_mobile_number"] = clean_phone
                context["pending_number_confirmation"] = True
                context["current_screen"] = "mobile"

                reply = "Is the number correct?"
                context.setdefault("conversation_history", []).extend([
                    HumanMessage(content=user_input),
                    AIMessage(content=reply)
                ])

                return {
                    "screen": "mobile",
                    "message": reply,
                    "data": {
                        "ui_action": "stage_mobile",
                        "mobile_number": clean_phone,
                        "pending_confirmation": True,
                    },
                    "cart": context.get("cart", []),
                    "totals": context.get("cart_totals", {}),
                }

        # -------------------------------------------------------------
        # FAST-PATH 2: Mobile Number Screen Live Spoken Digit Processing
        # -------------------------------------------------------------
        if current_screen == "mobile":
            clean_lower = user_input.lower().strip()
            if any(w in clean_lower for w in ["skip", "no number", "guest", "continue as guest"]):
                context["current_screen"] = "categories"
                context["pending_number_confirmation"] = False
                reply = "No problem! You can order as our guest. What would you like to explore today — coffee, chilled drinks, or bakes?"
                context.setdefault("conversation_history", []).extend([
                    HumanMessage(content=user_input),
                    AIMessage(content=reply)
                ])
                return {
                    "screen": "categories",
                    "message": reply,
                    "data": {
                        "ui_action": "navigate",
                        "screen": "categories",
                    },
                    "cart": context.get("cart", []),
                    "totals": context.get("cart_totals", {}),
                }

            digits = extract_spoken_digits(user_input)
            if len(digits) >= 10:
                clean_phone = digits[:10] if digits.startswith('0') and len(digits) == 10 else digits[-10:]
                context["staged_mobile_number"] = clean_phone
                context["pending_number_confirmation"] = True
                context["current_screen"] = "mobile"

                reply = "Is the number correct?"
                context.setdefault("conversation_history", []).extend([
                    HumanMessage(content=user_input),
                    AIMessage(content=reply)
                ])
                return {
                    "screen": "mobile",
                    "message": reply,
                    "data": {
                        "ui_action": "stage_mobile",
                        "mobile_number": clean_phone,
                        "pending_confirmation": True,
                    },
                    "cart": context.get("cart", []),
                    "totals": context.get("cart_totals", {}),
                }

        # -------------------------------------------------------------
        # FAST-PATH 3: Active Customization Flow (One Question At A Time)
        # -------------------------------------------------------------
        if current_screen == "customization":
            sess_id = context.get("session_id", "default-session")
            try:
                from customization_engine import (
                    get_customization_session,
                    start_customization_session,
                    clear_customization_session,
                )
            except ImportError:
                from backend.customization_engine import (
                    get_customization_session,
                    start_customization_session,
                    clear_customization_session,
                )

            cust_sess = get_customization_session(sess_id)
            if not cust_sess and context.get("selected_product"):
                prod = context["selected_product"]
                if isinstance(prod, str):
                    try:
                        from catalog import get_product
                    except ImportError:
                        from backend.catalog import get_product
                    prod = get_product(prod)
                if prod and prod.get("customizable", True):
                    cust_sess = start_customization_session(sess_id, prod)

            if cust_sess:
                clean_lower = user_input.lower().strip()

                # Handle navigation out of customization screen
                if any(w in clean_lower for w in ["go back", "back to menu", "return to menu", "cancel order", "cancel customization"]):
                    clear_customization_session(sess_id)
                    context["current_screen"] = "menu"
                    reply = "No problem, let's head back to the roasts and bakes menu. What would you like to explore?"
                    context.setdefault("conversation_history", []).extend([
                        HumanMessage(content=user_input),
                        AIMessage(content=reply)
                    ])
                    return {
                        "screen": "menu",
                        "message": reply,
                        "data": {"ui_action": "navigate", "screen": "menu"},
                        "cart": context.get("cart", []),
                        "totals": context.get("cart_totals", {}),
                    }

                # Handle opening tray (if not a confirmation utterance)
                if any(w in clean_lower for w in ["view tray", "open tray", "view cart", "open cart", "show tray"]) and not cust_sess.pending_confirmation:
                    context["current_screen"] = "cart"
                    totals = context.get("cart_totals", {})
                    items = len(context.get("cart", []))
                    reply = f"Here is your order tray! You have {items} items with a total of ₹{totals.get('totalPayable', 0)}. Ready to check out?"
                    context.setdefault("conversation_history", []).extend([
                        HumanMessage(content=user_input),
                        AIMessage(content=reply)
                    ])
                    return {
                        "screen": "cart",
                        "message": reply,
                        "data": {"ui_action": "navigate", "screen": "cart"},
                        "cart": context.get("cart", []),
                        "totals": totals,
                    }

                # Process spoken turn through Customization Engine
                turn_res = cust_sess.process_spoken_turn(user_input, context)
                final_reply = turn_res["reply"]
                is_completed = turn_res.get("completed", False)
                next_screen = "menu" if is_completed else "customization"

                if is_completed:
                    clear_customization_session(sess_id)
                    context["current_screen"] = "menu"

                context.setdefault("conversation_history", []).extend([
                    HumanMessage(content=user_input),
                    AIMessage(content=final_reply)
                ])

                return {
                    "screen": next_screen,
                    "message": final_reply,
                    "data": turn_res["data"],
                    "cart": context.get("cart", []),
                    "totals": context.get("cart_totals", {}),
                }

        tools = create_barista_tools(context)
        llm_with_tools = self.model.bind_tools(tools)
        tool_map = {t.name: t for t in tools}

        customer_context = build_barista_context(context)
        system_msg = SystemMessage(
            content=f"{BARISTA_SYSTEM_PROMPT}\n\nCURRENT KIOSK CONTEXT:\n{customer_context}"
        )

        history = context.get("conversation_history", [])
        messages: List[Any] = [system_msg]
        messages.extend(history[-6:])  # Sliding window of last 6 messages
        messages.append(HumanMessage(content=user_input))

        # First LLM invocation
        response = llm_with_tools.invoke(messages)
        messages.append(response)

        executed_results = []
        last_ui_action_data = None
        last_screen = context.get("current_screen")

        # Execute tools if called
        if getattr(response, "tool_calls", None):
            for tc in response.tool_calls:
                t_name = tc["name"]
                t_args = tc.get("args") or {}
                t_id = tc["id"]
                tool_fn = tool_map.get(t_name)

                if tool_fn:
                    try:
                        res = tool_fn.invoke(t_args)
                    except Exception as ex:
                        res = {"success": False, "error": str(ex)}
                else:
                    res = {"success": False, "error": f"Tool '{t_name}' not found."}

                executed_results.append((t_name, t_args, res))
                messages.append(ToolMessage(content=json.dumps(res), tool_call_id=t_id))

                if isinstance(res, dict):
                    if "ui_action" in res:
                        last_ui_action_data = res
                    if "screen" in res:
                        last_screen = res["screen"]

            # Fast-path deterministic confirmation check
            confirmation_text = self._get_deterministic_confirmation(executed_results, context)
            if confirmation_text:
                final_reply = confirmation_text
            else:
                # Second LLM call to synthesize response
                followup_resp = llm_with_tools.invoke(messages)
                final_reply = followup_resp.content or "Sure, I've got that taken care of for you!"
        else:
            final_reply = response.content or "Welcome to Third Wave Coffee! How can I brew your day?"

        # Save clean conversation history in context (HumanMessage and final AIMessage only)
        # Authoritative state (cart, screen, customizations) is injected via SystemMessage
        history_list = context.setdefault("conversation_history", [])
        history_list.append(HumanMessage(content=user_input))
        history_list.append(AIMessage(content=final_reply))
        # Keep sliding window of last 10 messages
        context["conversation_history"] = history_list[-10:]

        # Assemble unified response object
        return {
            "screen": last_screen or context.get("current_screen", "menu"),
            "message": final_reply,
            "data": last_ui_action_data or {},
            "cart": context.get("cart", []),
            "totals": context.get("cart_totals", {}),
        }

    def _get_deterministic_confirmation(
        self,
        executed_results: List[Any],
        context: Dict[str, Any],
    ) -> Optional[str]:
        """
        Produces immediate, natural barista responses for deterministic actions,
        bypassing an expensive second LLM roundtrip.
        """
        if not executed_results:
            return None

        for t_name, t_args, t_res in executed_results:
            if not isinstance(t_res, dict) or not t_res.get("success"):
                continue

            if t_name == "add_to_cart_tool":
                item = t_res.get("item", {})
                name = item.get("name", "beverage")
                qty = item.get("quantity", 1)
                customs = ", ".join(item.get("customizationsSummary", []))
                cart_total = t_res.get("totals", {}).get("totalPayable", 0)

                qty_str = f"{qty}x " if qty > 1 else ""
                desc = f" ({customs})" if customs else ""
                return f"I've added {qty_str}{name}{desc} to your tray! Total is now ₹{cart_total}. Would you like to add an artisanal bake, or review your order?"

            elif t_name == "select_product_tool":
                prod = t_res.get("product", {})
                name = prod.get("name", "beverage")
                if prod.get("customizable"):
                    sess_id = context.get("session_id", "default-session")
                    try:
                        from customization_engine import get_customization_session
                    except ImportError:
                        from backend.customization_engine import get_customization_session
                    cust_sess = get_customization_session(sess_id)
                    first_q = cust_sess.steps[0]["question"] if cust_sess and cust_sess.steps else "Which cup size would you prefer today?"
                    return f"Great choice! I've opened the {name}. {first_q}"
                else:
                    notes = ", ".join(prod.get("notes", []))
                    notes_str = f" with tasting notes of {notes}" if notes else ""
                    return f"I've selected the {name}{notes_str}. Would you like to add it to your tray?"

            elif t_name == "customize_drink_tool":
                name = t_res.get("product_name", "drink")
                summary = ", ".join(t_res.get("summary", []))
                price = t_res.get("totalPrice", 0)
                return f"Got it! I've updated your {name} to {summary} (₹{price}). Shall I add this to your tray?"

            elif t_name == "screen_action_tool":
                ctrl = t_args.get("control", "")
                if ctrl == "open_cart":
                    totals = context.get("cart_totals", {})
                    items = len(context.get("cart", []))
                    if items == 0:
                        return "Your tray is currently empty. What coffee or snack can I get for you?"
                    return f"Here is your order tray! You have {items} items with a total of ₹{totals.get('totalPayable', 0)}. Ready to check out?"
                elif ctrl == "confirm_order":
                    return t_res.get("message")
                elif ctrl == "clear_cart":
                    return "I've emptied your tray. Feel free to browse our roasts and bakes whenever you're ready!"
                elif ctrl in ["set_mobile", "enter_mobile", "mobile_number", "phone_number", "confirm_mobile", "confirm_number", "reject_mobile", "wrong_number", "skip_mobile", "skip"]:
                    return t_res.get("message")

        return None

    def process_message(self, session_id: str, user_message: str) -> Dict[str, Any]:
        """
        Unified entrypoint for user messages (both text and transcribed voice).
        Retrieves session context, executes agent runtime, and formats response.
        """
        state = get_conversation_context(session_id)
        state["session_id"] = session_id
        result = self.run(user_input=user_message, context=state)

        actions = []
        if result.get("data") and result["data"].get("ui_action"):
            actions.append(result["data"])

        selected_prod = None
        if state.get("selected_product"):
            # Can be id or full dict
            if isinstance(state["selected_product"], dict):
                selected_prod = state["selected_product"]
            else:
                from catalog import get_product
                selected_prod = get_product(state["selected_product"])

        return {
            "assistant_message": result.get("message", ""),
            "active_screen": result.get("screen", state.get("current_screen", "menu")),
            "actions": actions,
            "cart": state.cart.to_dict() if hasattr(state, "cart") else {"items": state.get("cart", [])},
            "selected_product": selected_prod,
        }


runtime = AgentRuntime()
agent_runtime = runtime

