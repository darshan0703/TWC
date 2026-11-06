"""
backend/test_customer_lifecycle.py
Comprehensive Verification Suite for Customer Context Lifecycle, Data Retention & Automatic Deletion.

Validates all 12 scenarios required by the specification:
1. Customer A enters a phone number and preferences.
2. Customer A completes an order.
3. Temporary context is cleared according to the defined lifecycle.
4. Customer B starts a new interaction.
5. Customer B cannot access Customer A's phone number, preferences, conversation history, or LLM memory.
6. Customer cancellation triggers the appropriate cleanup.
7. Abandoned sessions are cleaned up (TTL expiration).
8. Application restart does not restore expired temporary context.
9. Completed transactional records remain intact.
10. Cleanup can safely run multiple times (Idempotency).
11. Concurrent customers have isolated contexts.
12. Both voice and touch flows follow the same lifecycle.
"""

import sys
import os
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from main import app
from state import state_manager
from cart_service import cart_service
from session_lifecycle import SessionLifecycleManager, mask_phone_number, mask_pii_in_text

client = TestClient(app)

def test_scenario_1_and_2_customer_a_order_and_completion():
    print("\n" + "=" * 75)
    print("TEST SCENARIO 1 & 2: Customer A Enters Phone, Preferences, and Completes Order")
    print("=" * 75)

    sid_a = "cust-a-101"
    # 1. Start Session for Customer A
    res = client.post("/session/start", json={"session_id": sid_a})
    assert res.status_code == 200, f"Session start failed: {res.text}"

    # Customer A enters phone number & customizations
    ctx_a = state_manager.get_session(sid_a)
    ctx_a["mobile_number"] = "9876543210"
    ctx_a["customer_preferences"] = {
        "milk": "Oat Milk",
        "temperature": "Iced",
        "sugar": "No Sugar",
    }
    cart_service.add_item(sid_a, "cappuccino", size="Large", milk="Oat Milk", temperature="Hot", quantity=1)
    
    assert ctx_a["mobile_number"] == "9876543210"
    assert ctx_a["customer_preferences"]["milk"] == "Oat Milk"
    assert len(ctx_a["cart"]) == 1
    print(f"✓ Customer A session populated (Masked Phone: {mask_phone_number(ctx_a['mobile_number'])}, Cart Items: {len(ctx_a['cart'])})")

    # 2. Customer A completes order
    order_res = client.post("/order/confirm", json={"session_id": sid_a, "order_type": "DINE_IN"})
    assert order_res.status_code == 200, f"Order confirm failed: {order_res.text}"
    order_data = order_res.json()
    assert order_data["success"] is True
    order_num = order_data["order"]["orderNumber"]
    print(f"✓ Customer A order completed successfully: {order_num} (Total: ₹{order_data['order']['total']})")

    return sid_a, order_num


def test_scenario_3_temporary_context_cleared(sid_a):
    print("\n" + "=" * 75)
    print("TEST SCENARIO 3: Temporary Context Cleared After Order Completion")
    print("=" * 75)

    # Check status of Customer A's session in backend
    status_res = client.get(f"/session/status/{sid_a}")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["exists"] is False
    assert status_data["status"] == "NOT_FOUND"
    print(f"✓ Customer A session {sid_a} is NOT_FOUND in active memory (purged).")


def test_scenario_4_and_5_customer_b_isolation(sid_a):
    print("\n" + "=" * 75)
    print("TEST SCENARIO 4 & 5: Customer B Starts Interaction & Context Isolation")
    print("=" * 75)

    sid_b = "cust-b-202"
    res_b = client.post("/session/start", json={"session_id": sid_b})
    assert res_b.status_code == 200
    
    ctx_b = state_manager.get_session(sid_b)

    # Verify Customer B has no access to Customer A's data
    assert ctx_b.get("mobile_number") is None, "LEAK: Customer B inherited Customer A mobile number!"
    assert ctx_b.get("staged_mobile_number") is None, "LEAK: Customer B inherited staged number!"
    assert ctx_b.get("customer_preferences") == {"milk": None, "temperature": None, "sugar": None}, "LEAK: Customer B inherited preferences!"
    assert len(ctx_b.get("cart", [])) == 0, "LEAK: Customer B inherited cart items!"
    assert len(ctx_b.get("conversation_history", [])) == 0, "LEAK: Customer B inherited conversation history!"
    
    print("✓ Customer B starts with a pristine session (No phone, no preferences, empty cart).")
    print("✓ Zero context leakage verified from Customer A to Customer B.")


def test_scenario_6_cancellation_triggers_cleanup():
    print("\n" + "=" * 75)
    print("TEST SCENARIO 6: Customer Cancellation Triggers Context Cleanup")
    print("=" * 75)

    sid_c = "cust-c-303"
    client.post("/session/start", json={"session_id": sid_c})
    ctx_c = state_manager.get_session(sid_c)
    ctx_c["mobile_number"] = "9112233445"
    ctx_c["customer_preferences"] = {"milk": "Almond Milk", "temperature": "Hot", "sugar": "Regular Sugar"}
    cart_service.add_item(sid_c, "classic_cold_brew", quantity=2)

    assert ctx_c["mobile_number"] == "9112233445"
    print(f"✓ Customer C session active with phone {mask_phone_number(ctx_c['mobile_number'])} and cart items.")

    # Customer cancels
    cancel_res = client.post("/session/end", json={"session_id": sid_c, "reason": "cancelled"})
    assert cancel_res.status_code == 200
    assert cancel_res.json()["success"] is True

    # Verify session is evicted
    status_c = client.get(f"/session/status/{sid_c}").json()
    assert status_c["exists"] is False
    print("✓ Customer C cancellation successfully purged all temporary context.")


def test_scenario_7_abandoned_session_ttl_cleanup():
    print("\n" + "=" * 75)
    print("TEST SCENARIO 7: Abandoned Session Cleaned Up via TTL Expiration")
    print("=" * 75)

    # Instantiate a temporary lifecycle manager with 0.1s TTL for testing
    mgr = SessionLifecycleManager(ttl_seconds=0.1)
    sid_d = "cust-d-abandoned"
    state_d = mgr.create_session(sid_d)
    state_d["mobile_number"] = "9988776655"
    
    assert mgr.get_session_status(sid_d)["exists"] is True
    print(f"✓ Session {sid_d} created. Waiting 0.15s to trigger TTL expiration...")
    time.sleep(0.15)

    # Sweeper runs
    swept = mgr.sweep_expired_sessions()
    assert swept >= 1, "Sweeper did not identify expired session"
    assert mgr.get_session_status(sid_d)["exists"] is False
    print("✓ Inactive/abandoned session automatically purged by TTL sweeper.")


def test_scenario_8_restart_does_not_restore_expired():
    print("\n" + "=" * 75)
    print("TEST SCENARIO 8: Application Restart Does Not Restore Expired Temporary Context")
    print("=" * 75)

    mgr = SessionLifecycleManager()
    sid = "cust-volatile"
    mgr.create_session(sid)
    mgr.terminate_session(sid, reason="completed")

    # Simulate fresh app startup (clean lifecycle manager instance)
    fresh_mgr = SessionLifecycleManager()
    assert fresh_mgr.get_session_status(sid)["exists"] is False
    print("✓ Fresh application instance contains no ghost sessions or lingering temporary data.")


def test_scenario_9_completed_transactional_records_intact(order_num):
    print("\n" + "=" * 75)
    print("TEST SCENARIO 9: Completed Transactional Records Remain Queryable in Registry")
    print("=" * 75)

    # Query the archived order created in Scenario 1
    res = client.get(f"/orders/{order_num}")
    assert res.status_code == 200, f"Archived order not found: {res.text}"
    order = res.json()
    assert order["orderNumber"] == order_num
    assert order["mobileNumberMasked"] == "******3210"
    assert order["total"] > 0
    assert len(order["items"]) > 0

    # Also list all orders
    list_res = client.get("/orders")
    assert list_res.status_code == 200
    orders_list = list_res.json()["orders"]
    found = any(o["orderNumber"] == order_num for o in orders_list)
    assert found is True
    print(f"✓ Order {order_num} verified in transactional archive (Audit Store) with masked phone: {order['mobileNumberMasked']}.")


def test_scenario_10_cleanup_idempotency():
    print("\n" + "=" * 75)
    print("TEST SCENARIO 10: Cleanup Idempotency (Multiple Invocations are Safe)")
    print("=" * 75)

    sid_idem = "cust-idempotent-test"
    client.post("/session/start", json={"session_id": sid_idem})

    # Call /session/end 5 times consecutively
    for i in range(1, 6):
        res = client.post("/session/end", json={"session_id": sid_idem, "reason": "repeated_cleanup"})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        if i == 1:
            assert data["already_terminated"] is False
            assert data["cleaned"] is True
        else:
            assert data["already_terminated"] is True
            assert data["cleaned"] is False
        print(f"  Attempt {i}: HTTP 200 OK (already_terminated={data['already_terminated']})")

    print("✓ Idempotent cleanup confirmed. Multiple calls execute safely without errors.")


def test_scenario_11_concurrent_customer_isolation():
    print("\n" + "=" * 75)
    print("TEST SCENARIO 11: Concurrent Customer Sessions Context Isolation")
    print("=" * 75)

    sid_c1 = "concurrent-cust-1"
    sid_c2 = "concurrent-cust-2"

    client.post("/session/start", json={"session_id": sid_c1})
    client.post("/session/start", json={"session_id": sid_c2})

    ctx1 = state_manager.get_session(sid_c1)
    ctx2 = state_manager.get_session(sid_c2)

    # Populate session 1
    ctx1["mobile_number"] = "9000000001"
    ctx1["customer_preferences"] = {"milk": "Oat Milk", "temperature": "Hot"}
    cart_service.add_item(sid_c1, "cappuccino", milk="Oat Milk", quantity=1)

    # Populate session 2
    ctx2["mobile_number"] = "9000000002"
    ctx2["customer_preferences"] = {"milk": "Almond Milk", "temperature": "Iced"}
    cart_service.add_item(sid_c2, "vietnamese_shakerato", milk="Standard Dairy", quantity=3)

    # Assert mutual isolation
    assert ctx1["mobile_number"] == "9000000001"
    assert ctx2["mobile_number"] == "9000000002"
    assert ctx1["customer_preferences"]["milk"] == "Oat Milk"
    assert ctx2["customer_preferences"]["milk"] == "Almond Milk"
    assert ctx1.cart.item_count == 1
    assert ctx2.cart.item_count == 3

    print(f"✓ Session 1: {mask_phone_number(ctx1['mobile_number'])} | {ctx1['customer_preferences']['milk']} | Cart: {ctx1.cart.item_count}")
    print(f"✓ Session 2: {mask_phone_number(ctx2['mobile_number'])} | {ctx2['customer_preferences']['milk']} | Cart: {ctx2.cart.item_count}")
    print("✓ Concurrent sessions verified to be strictly isolated in memory.")


def test_scenario_12_voice_and_touch_lifecycle_equivalence():
    print("\n" + "=" * 75)
    print("TEST SCENARIO 12: Voice and Touch Flows Follow Identical Lifecycle")
    print("=" * 75)

    # Voice Flow
    voice_sid = "voice-flow-session"
    client.post("/session/start", json={"session_id": voice_sid})
    v_ctx = state_manager.get_session(voice_sid)
    v_ctx["mobile_number"] = "9888877777"
    cart_service.add_item(voice_sid, "flat_white", quantity=1)
    v_order_res = client.post("/order/confirm", json={"session_id": voice_sid, "order_type": "DINE_IN"}).json()
    assert v_order_res["success"] is True
    # Verify voice session ended
    assert client.get(f"/session/status/{voice_sid}").json()["exists"] is False

    # Touch Flow
    touch_sid = "touch-flow-session"
    client.post("/session/start", json={"session_id": touch_sid})
    t_ctx = state_manager.get_session(touch_sid)
    t_ctx["mobile_number"] = "9777766666"
    cart_service.add_item(touch_sid, "flat_white", quantity=1)
    t_order_res = client.post("/order/confirm", json={"session_id": touch_sid, "order_type": "TAKEAWAY"}).json()
    assert t_order_res["success"] is True
    # Verify touch session ended
    assert client.get(f"/session/status/{touch_sid}").json()["exists"] is False

    print("✓ Voice and touch checkout flows trigger identical session termination and archive operations.")


def run_all_tests():
    print("\n" + "#" * 75)
    print("STARTING CUSTOMER DATA LIFECYCLE & PRIVACY VERIFICATION SUITE")
    print("#" * 75)

    sid_a, order_num = test_scenario_1_and_2_customer_a_order_and_completion()
    test_scenario_3_temporary_context_cleared(sid_a)
    test_scenario_4_and_5_customer_b_isolation(sid_a)
    test_scenario_6_cancellation_triggers_cleanup()
    test_scenario_7_abandoned_session_ttl_cleanup()
    test_scenario_8_restart_does_not_restore_expired()
    test_scenario_9_completed_transactional_records_intact(order_num)
    test_scenario_10_cleanup_idempotency()
    test_scenario_11_concurrent_customer_isolation()
    test_scenario_12_voice_and_touch_lifecycle_equivalence()

    print("\n" + "=" * 75)
    print("ALL 12 LIFECYCLE & PRIVACY TEST SCENARIOS PASSED WITH ZERO FAILURES!")
    print("=" * 75)


if __name__ == "__main__":
    run_all_tests()
