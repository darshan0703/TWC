"""
backend/state.py
Authoritative Conversation Context & Session State for Third Wave Coffee Kiosk.
Maintains strict separation between:
1. Authoritative UI State (screen, active product, on-screen controls)
2. Conversational Memory (history, discussed products, pending clarifications)
3. Transactional Cart State (items, quantities, subtotal, 5% GST taxes, total)
"""

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
        return self._data.get("selected_product")

    @focused_product_id.setter
    def focused_product_id(self, val: Optional[str]):
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


# Active in-memory session registry for session isolation
_SESSION_STORE: Dict[str, SessionState] = {}
_ACTIVE_DEFAULT_SESSION_ID = "default"


def create_conversation_state(session_id: Optional[str] = None) -> SessionState:
    sess_id = session_id or str(uuid.uuid4())
    raw = {
        "session_id": sess_id,

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
    if target_id not in _SESSION_STORE:
        _SESSION_STORE[target_id] = create_conversation_state(target_id)
    return _SESSION_STORE[target_id]


def reset_conversation(session_id: Optional[str] = None) -> SessionState:
    global _ACTIVE_DEFAULT_SESSION_ID
    target_id = session_id or str(uuid.uuid4())
    _ACTIVE_DEFAULT_SESSION_ID = target_id
    _SESSION_STORE[target_id] = create_conversation_state(target_id)
    return _SESSION_STORE[target_id]


class StateManager:
    """Session management façade."""
    def get_session(self, session_id: Optional[str] = None) -> SessionState:
        return get_conversation_context(session_id)

    def reset_session(self, session_id: Optional[str] = None) -> SessionState:
        return reset_conversation(session_id)

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
        return state

    def clear_conversation_context(self, session_id: str):
        state = self.get_session(session_id)
        state["conversation_history"] = []
        state["selected_product"] = None
        state["last_item"] = None
        state["pending_clarification"] = None
        state["pending_suggestion"] = None


state_manager = StateManager()
