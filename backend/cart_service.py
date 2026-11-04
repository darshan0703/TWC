"""
backend/cart_service.py
Thread-safe, Idempotent Transactional Cart Service for Third Wave Coffee.
Calculates subtotals, 5% GST, item counts, and manages item modifications adhering to TWC rules.
"""

import copy
import threading
import time
from typing import Dict, Any, List, Optional

try:
    from catalog import get_product, validate_and_configure_item
    from state import get_conversation_context
except ImportError:
    from backend.catalog import get_product, validate_and_configure_item
    from backend.state import get_conversation_context

cart_lock = threading.RLock()


def _calculate_cart_totals(cart: List[Dict[str, Any]]) -> Dict[str, int]:
    item_count = sum(item.get("quantity", 1) for item in cart)
    subtotal = sum(item.get("totalPrice", item.get("unitPrice", 0) * item.get("quantity", 1)) for item in cart)
    taxes = round(subtotal * 0.05)
    total_payable = subtotal + taxes
    return {
        "itemCount": item_count,
        "subtotal": subtotal,
        "taxes": taxes,
        "totalPayable": total_payable,
    }


def add_item_to_cart(
    context: Dict[str, Any],
    product_id_or_name: str,
    quantity: int = 1,
    size: Optional[str] = None,
    temperature: Optional[str] = None,
    milk: Optional[str] = None,
    sugar: Optional[str] = None,
    extra_shot: bool = False,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    with cart_lock:
        store = context.setdefault("processed_idempotency_keys", {})
        if idempotency_key and idempotency_key in store:
            return copy.deepcopy(store[idempotency_key])

        product = get_product(product_id_or_name)
        if not product:
            return {
                "success": False,
                "message": f"Sorry, we couldn't find '{product_id_or_name}' on our menu.",
                "cart": context.get("cart", []),
                "totals": context.get("cart_totals", {}),
            }

        qty = max(1, int(quantity or 1))
        configured = validate_and_configure_item(
            product=product,
            size=size,
            temperature=temperature,
            milk=milk,
            sugar=sugar,
            extra_shot=extra_shot,
            quantity=qty,
        )

        cart = context.setdefault("cart", [])

        # Check for existing identical item
        match_idx = -1
        for idx, item in enumerate(cart):
            if (
                item.get("productId") == configured["productId"]
                and item.get("size") == configured["size"]
                and item.get("temperature") == configured["temperature"]
                and item.get("milk") == configured["milk"]
                and item.get("sugar") == configured["sugar"]
                and item.get("extraShot") == configured["extraShot"]
            ):
                match_idx = idx
                break

        if match_idx >= 0:
            existing = cart[match_idx]
            new_qty = existing["quantity"] + qty
            existing["quantity"] = new_qty
            existing["totalPrice"] = new_qty * existing["unitPrice"]
            cart_id = existing.get("cartId")
        else:
            cart_id = f"custom-{int(time.time()*1000)}"
            configured["cartId"] = cart_id
            cart.insert(0, configured)

        totals = _calculate_cart_totals(cart)
        context["cart_totals"] = totals
        context["last_item"] = product["name"]

        res = {
            "success": True,
            "message": f"Added {qty}x {product['name']} to your tray.",
            "item": configured,
            "cartId": cart_id,
            "cart": cart,
            "totals": totals,
        }

        if idempotency_key:
            store[idempotency_key] = copy.deepcopy(res)

        return res


def update_cart_item_quantity(
    context: Dict[str, Any],
    cart_id: str,
    delta: int,
) -> Dict[str, Any]:
    with cart_lock:
        cart = context.setdefault("cart", [])
        target = None
        target_idx = -1

        for idx, item in enumerate(cart):
            if item.get("cartId") == cart_id:
                target = item
                target_idx = idx
                break

        if not target:
            return {
                "success": False,
                "message": "Item not found in tray.",
                "cart": cart,
                "totals": context.get("cart_totals", {}),
            }

        new_qty = target["quantity"] + delta
        if new_qty <= 0:
            cart.pop(target_idx)
            msg = f"Removed {target['name']} from your tray."
        else:
            target["quantity"] = new_qty
            target["totalPrice"] = new_qty * target["unitPrice"]
            msg = f"Updated {target['name']} quantity to {new_qty}."

        totals = _calculate_cart_totals(cart)
        context["cart_totals"] = totals

        return {
            "success": True,
            "message": msg,
            "cart": cart,
            "totals": totals,
        }


def remove_cart_item(
    context: Dict[str, Any],
    item_identifier: str,
) -> Dict[str, Any]:
    with cart_lock:
        cart = context.setdefault("cart", [])
        norm = (item_identifier or "").lower().strip()

        target_idx = -1
        # Try match by cartId first
        for idx, item in enumerate(cart):
            if item.get("cartId") == item_identifier:
                target_idx = idx
                break

        # Then try match by product name or productId
        if target_idx < 0:
            for idx, item in enumerate(cart):
                name = item.get("name", "").lower()
                p_id = item.get("productId", "").lower()
                if norm in name or norm == p_id:
                    target_idx = idx
                    break

        # If user said "last item" or "that"
        if target_idx < 0 and norm in ["last item", "last", "that", "it"] and cart:
            target_idx = 0

        if target_idx < 0:
            return {
                "success": False,
                "message": f"Couldn't find '{item_identifier}' in your tray.",
                "cart": cart,
                "totals": context.get("cart_totals", {}),
            }

        removed = cart.pop(target_idx)
        totals = _calculate_cart_totals(cart)
        context["cart_totals"] = totals

        return {
            "success": True,
            "message": f"Removed {removed['name']} from your tray.",
            "removedItem": removed,
            "cart": cart,
            "totals": totals,
        }


def clear_cart_items(context: Dict[str, Any]) -> Dict[str, Any]:
    with cart_lock:
        context["cart"] = []
        totals = {
            "itemCount": 0,
            "subtotal": 0,
            "taxes": 0,
            "totalPayable": 0,
        }
        context["cart_totals"] = totals
        return {
            "success": True,
            "message": "Cleared all items from your tray.",
            "cart": [],
            "totals": totals,
        }


def confirm_order(
    context: Dict[str, Any],
    payment_method: str = "UPI",
    mobile_number: Optional[str] = None,
) -> Dict[str, Any]:
    with cart_lock:
        cart = context.get("cart", [])
        if not cart:
            return {
                "success": False,
                "message": "Your tray is currently empty. Please select an item first.",
            }

        totals = context.get("cart_totals") or _calculate_cart_totals(cart)
        import random
        order_num = f"TWC-{random.randint(1000, 9999)}"
        confirmed_order = {
            "orderNumber": order_num,
            "orderType": context.get("order_type", "dine_in"),
            "items": copy.deepcopy(cart),
            "itemCount": totals["itemCount"],
            "subtotal": totals["subtotal"],
            "taxes": totals["taxes"],
            "total": totals["totalPayable"],
            "paymentMethod": payment_method.upper(),
            "timestamp": time.strftime("%I:%M %p"),
            "mobileNumber": mobile_number or "Walk-in Guest",
            "status": "Preparing",
        }

        context["last_confirmed_order"] = confirmed_order
        context["cart"] = []
        context["cart_totals"] = {"itemCount": 0, "subtotal": 0, "taxes": 0, "totalPayable": 0}
        context["current_screen"] = "order_confirmed"

        return {
            "success": True,
            "order": confirmed_order,
            "message": f"Your order {order_num} has been confirmed and sent to the coffee bar! Total: ₹{totals['totalPayable']}.",
        }


class CartService:
    def add_item(self, session_or_context, product_id_or_name, **kwargs):
        ctx = get_conversation_context(session_or_context) if isinstance(session_or_context, str) else session_or_context
        return add_item_to_cart(ctx, product_id_or_name, **kwargs)

    def remove_item(self, session_or_context, item_identifier):
        ctx = get_conversation_context(session_or_context) if isinstance(session_or_context, str) else session_or_context
        return remove_cart_item(ctx, item_identifier)

    def update_quantity(self, session_or_context, cart_id, delta):
        ctx = get_conversation_context(session_or_context) if isinstance(session_or_context, str) else session_or_context
        return update_cart_item_quantity(ctx, cart_id, delta)

    def clear(self, session_or_context):
        ctx = get_conversation_context(session_or_context) if isinstance(session_or_context, str) else session_or_context
        return clear_cart_items(ctx)

    def confirm_order(self, session_or_context, payment_method="UPI", mobile_number=None, order_type="DINE_IN"):
        ctx = get_conversation_context(session_or_context) if isinstance(session_or_context, str) else session_or_context
        if order_type:
            ctx["order_type"] = order_type.lower()
        return confirm_order(ctx, payment_method=payment_method, mobile_number=mobile_number)


cart_service = CartService()

