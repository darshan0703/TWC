"""
Regression tests for selected product context resolution and voice input flow.
Covers:
1. A selected product ID string (e.g. 'cappuccino').
2. A resolved product dictionary.
3. No selected product (None).
4. An invalid or unavailable product ID.
5. Normal English voice input reaching process_message() across the 4 test phrases without AttributeError.
"""

import os
import sys
import pytest
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from catalog import get_product
from barista_agent import build_barista_context
from state import state_manager, SessionState
from agent_runtime import agent_runtime


def test_build_barista_context_with_product_id_string():
    """1. Test context builder when selected_product is a string ID."""
    context = {
        "current_screen": "customization",
        "selected_product": "cappuccino",
        "selected_customizations": {"size": "Large", "milk": "Oat Milk"},
    }
    result = build_barista_context(context)
    assert "Active Focused Product on Customization Screen: Signature Cappuccino" in result
    assert "Size: Large" in result
    assert "Milk: Oat Milk" in result


def test_build_barista_context_with_product_dictionary():
    """2. Test context builder when selected_product is already a resolved dictionary."""
    prod = get_product("cappuccino")
    assert prod is not None
    context = {
        "current_screen": "customization",
        "selected_product": prod,
        "selected_customizations": {"size": "Regular", "milk": "Standard Dairy"},
    }
    result = build_barista_context(context)
    assert "Active Focused Product on Customization Screen: Signature Cappuccino" in result
    assert "Size: Regular" in result
    assert "Milk: Standard Dairy" in result


def test_build_barista_context_with_no_product():
    """3. Test context builder when no product is selected (None)."""
    context = {
        "current_screen": "categories",
        "selected_product": None,
    }
    result = build_barista_context(context)
    assert "Active Focused Product on Screen: None" in result


def test_build_barista_context_with_invalid_product_id():
    """4. Test context builder when selected_product is an invalid/unavailable string ID."""
    context = {
        "current_screen": "customization",
        "selected_product": "non_existent_drink_999",
    }
    result = build_barista_context(context)
    # Should safely indicate None without raising AttributeError
    assert "Active Focused Product on Screen: None" in result


def test_state_manager_focused_product_id_resolution():
    """Verify state manager update_ui_state resolves string product ID to canonical product."""
    sid = "test-state-res-1"
    state = state_manager.update_ui_state(
        session_id=sid,
        active_screen="customization",
        focused_product_id="cappuccino"
    )
    # Focused product ID getter returns string ID
    assert state.ui.focused_product_id == "cappuccino"
    # Canonical selected_product in state is resolved product dict
    assert isinstance(state["selected_product"], dict)
    assert state["selected_product"]["id"] == "cappuccino"
    assert state["selected_product"]["name"] == "Signature Cappuccino"

    # Test invalid product ID does not crash
    state_invalid = state_manager.update_ui_state(
        session_id=sid,
        focused_product_id="invalid_xyz"
    )
    assert state_invalid.ui.focused_product_id == "invalid_xyz"


def test_process_message_with_4_test_phrases_and_selected_product():
    """
    5. Test normal English voice inputs reaching process_message() without exception
    across all 4 test phrases when on customization screen with selected_product_id.
    """
    sid = "test-voice-phrases-regression"
    state_manager.reset_session(sid)

    # Put customer on customization screen with cappuccino selected
    state_manager.update_ui_state(
        session_id=sid,
        active_screen="customization",
        selected_category="coffee",
        focused_product_id="cappuccino"
    )

    phrases = [
        "Hello.",
        "I want a cappuccino.",
        "Can I get a large iced latte?",
        "I would like a cappuccino with oat milk."
    ]

    for phrase in phrases:
        # Must execute cleanly without throwing AttributeError or 500
        res = agent_runtime.process_message(session_id=sid, user_message=phrase)
        assert isinstance(res, dict)
        assert "assistant_message" in res
        assert len(res["assistant_message"]) > 0
        assert res.get("active_screen") in ["customization", "menu", "cart", "categories"]


if __name__ == "__main__":
    test_build_barista_context_with_product_id_string()
    print("✓ 1. Product ID string test passed")
    test_build_barista_context_with_product_dictionary()
    print("✓ 2. Product dictionary test passed")
    test_build_barista_context_with_no_product()
    print("✓ 3. No product test passed")
    test_build_barista_context_with_invalid_product_id()
    print("✓ 4. Invalid product ID test passed")
    test_state_manager_focused_product_id_resolution()
    print("✓ 5. State manager resolution test passed")
    test_process_message_with_4_test_phrases_and_selected_product()
    print("✓ 6. Process message 4 test phrases passed")
    print("\nALL REGRESSION TESTS PASSED SUCCESSFULLY!")

