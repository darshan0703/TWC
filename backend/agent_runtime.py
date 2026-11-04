"""
backend/agent_runtime.py
ReAct Runtime Engine for Third Wave Coffee Conversational Barista.
Executes tool-calling, multi-provider invocation, tool deduplication, and Fast-Path Confirmation.
"""

import json
from typing import Dict, Any, List, Optional
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

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
                notes = ", ".join(prod.get("notes", []))
                notes_str = f" with tasting notes of {notes}" if notes else ""
                if prod.get("customizable"):
                    return f"Great choice! I've opened the {name}{notes_str}. Would you like it regular or large, and hot or iced?"
                else:
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
                elif ctrl in ["set_mobile", "enter_mobile", "mobile_number", "phone_number", "skip_mobile", "skip"]:
                    return t_res.get("message")

        return None

    def process_message(self, session_id: str, user_message: str) -> Dict[str, Any]:
        """
        Unified entrypoint for user messages (both text and transcribed voice).
        Retrieves session context, executes agent runtime, and formats response.
        """
        state = get_conversation_context(session_id)
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

