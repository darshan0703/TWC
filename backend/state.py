"""
backend/state.py
Authoritative Conversation Context & Session State for Third Wave Coffee Kiosk.
Maintains strict separation between:
1. Authoritative UI State (screen, active product, on-screen controls)
2. Conversational Memory (history, discussed products, pending clarifications)
3. Transactional Cart State (items, quantities, subtotal, 5% GST taxes, total)
"""

import time
import uuid
from typing import Dict, Any, Optional, List

class UIState:
    def __init__(self, data: dict):
        self._data = data

    @property
    def active_screen(self) -> str:
        return self._data.get("current_screen", "welcome")

    @active_screen.setter
    def active_screen(self, val: str):
        self._data["current_screen"] = val

    @property
    def selected_category(self) -> Optional[str]:
        return self._data.get("last_category")

    @selected_category.setter
    def selected_category(self, val: Optional[str]):
        self._data["last_category"] = val

    @property
    def focused_product_id(self) -> Optional[str]:
        val = self._data.get("selected_product")
        if isinstance(val, dict):
            return val.get("id")
        return val

    @focused_product_id.setter
    def focused_product_id(self, val: Optional[Any]):
        if not val:
            self._data["selected_product"] = None
        elif isinstance(val, dict):
            self._data["selected_product"] = val
        elif isinstance(val, str):
            try:
                from catalog import get_product
            except ImportError:
                from backend.catalog import get_product
            prod = get_product(val)
            self._data["selected_product"] = prod if prod is not None else val
        else:
            self._data["selected_product"] = val


class MemoryState:
    def __init__(self, data: dict):
        self._data = data

    @property
    def focused_product(self) -> Dict[str, Any]:
        return {
            "productId": self._data.get("selected_product"),
            "customizations": self._data.get("selected_customizations", {}),
            "last_item": self._data.get("last_item"),
        }

    @property
    def conversation_history(self) -> List[Any]:
        return self._data.get("conversation_history", [])

    @property
    def last_item(self) -> Optional[str]:
        return self._data.get("last_item")


class CartState:
    def __init__(self, data: dict):
        self._data = data

    @property
    def items(self) -> List[Dict[str, Any]]:
        return self._data.setdefault("cart", [])

    @property
    def subtotal(self) -> int:
        return self._data.get("cart_totals", {}).get("subtotal", 0)

    @property
    def taxes(self) -> int:
        return self._data.get("cart_totals", {}).get("taxes", 0)

    @property
    def total(self) -> int:
        return self._data.get("cart_totals", {}).get("totalPayable", 0)

    @property
    def item_count(self) -> int:
        return self._data.get("cart_totals", {}).get("itemCount", len(self.items))

    def to_dict(self) -> Dict[str, Any]:
        totals = self._data.get("cart_totals", {})
        return {
            "items": self.items,
            "item_count": totals.get("itemCount", len(self.items)),
            "subtotal": totals.get("subtotal", 0),
            "taxes": totals.get("taxes", 0),
            "total": totals.get("totalPayable", 0),
        }


class SessionState(dict):
    """
    Unified Session State supporting both dictionary indexing and property attributes.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.ui = UIState(self)
        self.memory = MemoryState(self)
        self.cart = CartState(self)

    def to_dict(self) -> Dict[str, Any]:
        return dict(self)


from session_lifecycle import session_lifecycle

# Active in-memory session registry for session isolation (backed by session_lifecycle)
_SESSION_STORE: Dict[str, SessionState] = session_lifecycle._active_sessions
_ACTIVE_DEFAULT_SESSION_ID = "default"


def create_conversation_state(session_id: Optional[str] = None) -> SessionState:
    sess_id = session_id or str(uuid.uuid4())
    raw = {
        "session_id": sess_id,
        "created_at": time.time(),
        "last_active_at": time.time(),

        # Authoritative UI State
        "current_screen": "welcome",
        "available_controls": ["start_order", "open_cart", "browse_categories"],
        "selected_product": None,            # Actively selected product on CustomizationScreen
        "selected_customizations": {         # Active configuration being customized
            "size": "Regular",
            "temperature": "Hot",
            "milk": "Standard Dairy",
            "sugar": "Regular Sugar",
            "extra_shot": False,
            "quantity": 1,
        },
        "_screen_seq": 0,
        "_last_action_rejected": None,

        # Navigation & Category Memory
        "last_category": "coffee",
        "last_subcategory": "coffee_classics",
        "last_screen": "welcome",
        "mobile_number": None,
        "staged_mobile_number": None,
        "pending_number_confirmation": False,

        # Conversational Memory & Anaphora
        "last_item": None,                   # Historical memory of previous item
        "pending_clarification": None,       # e.g. "temperature", "milk", "size"
        "pending_suggestion": None,          # e.g. pastry pairing recommendation
        "customer_preferences": {
            "milk": None,
            "temperature": None,
            "sugar": None,
        },
        "conversation_history": [],

        # Transactional Cart State
        "cart": [],
        "cart_totals": {
            "itemCount": 0,
            "subtotal": 0,
            "taxes": 0,                      # 5% GST
            "totalPayable": 0,
        },
        "order_type": "dine_in",             # "dine_in" or "takeaway"
        "processed_idempotency_keys": {},
        "current_interaction_id": None,
        "current_idempotency_key": None,
        "last_confirmed_order": None,
    }
    return SessionState(raw)


def get_conversation_context(session_id: Optional[str] = None) -> SessionState:
    global _ACTIVE_DEFAULT_SESSION_ID
    target_id = session_id or _ACTIVE_DEFAULT_SESSION_ID
    return session_lifecycle.get_session(target_id)


def reset_conversation(session_id: Optional[str] = None) -> SessionState:
    global _ACTIVE_DEFAULT_SESSION_ID
    target_id = session_id or str(uuid.uuid4())
    _ACTIVE_DEFAULT_SESSION_ID = target_id
    return session_lifecycle.create_session(target_id)


class StateManager:
    """Session management façade."""
    def get_session(self, session_id: Optional[str] = None) -> SessionState:
        return get_conversation_context(session_id)

    def reset_session(self, session_id: Optional[str] = None) -> SessionState:
        return reset_conversation(session_id)

    def terminate_session(self, session_id: str, reason: str = "completed") -> Dict[str, Any]:
        return session_lifecycle.terminate_session(session_id, reason=reason)

    def archive_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        return session_lifecycle.archive_order(order_data)

    def get_archived_order(self, order_number: str) -> Optional[Dict[str, Any]]:
        return session_lifecycle.get_archived_order(order_number)

    def list_archived_orders(self) -> List[Dict[str, Any]]:
        return session_lifecycle.list_archived_orders()

    def update_ui_state(
        self,
        session_id: str,
        active_screen: Optional[str] = None,
        selected_category: Optional[str] = None,
        focused_product_id: Optional[str] = None,
    ) -> SessionState:
        state = self.get_session(session_id)
        if active_screen:
            state.ui.active_screen = active_screen
        if selected_category:
            state.ui.selected_category = selected_category
        if focused_product_id is not None:
            state.ui.focused_product_id = focused_product_id
        session_lifecycle.touch_session(session_id)
        return state

    def update_customization_state(
        self,
        session_id: str,
        size: Optional[str] = None,
        temperature: Optional[str] = None,
        strength: Optional[str] = None,
        milk: Optional[str] = None,
        sugar: Optional[str] = None,
        extra_shot: Optional[bool] = None,
        quantity: Optional[int] = None,
    ) -> SessionState:
        state = self.get_session(session_id)
        customs = state.setdefault("selected_customizations", {})
        if size:
            customs["size"] = size
        if temperature:
            customs["temperature"] = temperature
        if strength:
            customs["strength"] = strength
        if milk:
            customs["milk"] = milk
        if sugar:
            customs["sugar"] = sugar
        if extra_shot is not None:
            customs["extra_shot"] = extra_shot
        if quantity:
            customs["quantity"] = max(1, quantity)
        session_lifecycle.touch_session(session_id)
        return state

    def clear_conversation_context(self, session_id: str):
        state = self.get_session(session_id, touch=False)
        state["conversation_history"] = []
        state["selected_product"] = None
        state["last_item"] = None
        state["pending_clarification"] = None
        state["pending_suggestion"] = None
        state["pending_number_confirmation"] = False
        state["staged_mobile_number"] = None
        state["mobile_number"] = None
        state["customer_preferences"] = {
            "milk": None,
            "temperature": None,
            "sugar": None,
        }
        state["cart"] = []
        state["cart_totals"] = {
            "itemCount": 0,
            "subtotal": 0,
            "taxes": 0,
            "totalPayable": 0,
        }


state_manager = StateManager()
