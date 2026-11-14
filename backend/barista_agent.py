"""
backend/barista_agent.py
Third Wave Coffee (TWC) Conversational Barista Agent.
Defines the barista persona, context builder, and tools factory.
"""

from typing import Dict, Any, List, Optional
from langchain_core.tools import tool

try:
    from catalog import (
        resolve_product,
        get_product,
        validate_and_configure_item,
        get_products_by_category,
        get_products_by_subcategory,
        PASTRY_RECOMMENDATIONS,
        CART_RECOMMENDATIONS,
    )
    from cart_service import (
        add_item_to_cart,
        update_cart_item_quantity,
        remove_cart_item,
        clear_cart_items,
        confirm_order,
    )
except ImportError:
    from backend.catalog import (
        resolve_product,
        get_product,
        validate_and_configure_item,
        get_products_by_category,
        get_products_by_subcategory,
        PASTRY_RECOMMENDATIONS,
        CART_RECOMMENDATIONS,
    )
    from backend.cart_service import (
        add_item_to_cart,
        update_cart_item_quantity,
        remove_cart_item,
        clear_cart_items,
        confirm_order,
    )

BARISTA_SYSTEM_PROMPT = """
You are the intelligent, warm, and knowledgeable AI barista for Third Wave Coffee (TWC) India.

Your mission is to guide customers through Third Wave Coffee's 100% Arabica specialty coffee roasts, handcrafted beverages, manual brews, and artisanal sourdough bakes.

COMMUNICATION PRINCIPLES:
- Speak naturally and warmly like a passionate, friendly specialty coffee barista.
- Keep your answers concise, clear, and conversational (your responses are spoken aloud on the kiosk).
- Never invent menu items, prices, milks, or availability that do not exist on the TWC menu.
- Use your tools to execute real customer actions (selecting drinks, customizing milk/size/temp, adding to cart, navigating screens).
- Ground all advice in the Authoritative Kiosk State provided below.
- Do not repeat visible screen lists verbatim unless specifically asked.

KNOWLEDGE OF THIRD WAVE COFFEE:
- We serve 100% Arabica coffee, specialty roasted in small batches.
- Milk options: Regular Milk (+₹0), Skimmed Milk (+₹0), Soy Milk (+₹40), Almond Milk (+₹45), Oat Milk (+₹45).
- Sizes: Regular (240 ml, +₹0) and Large (350 ml, +₹40).
- Espresso Strength: Single Shot (+₹0) and Double Shot (+₹50).
- Sweetness: No Sugar (+₹0), Less Sugar (+₹0), Regular Sugar (+₹0).
- Hot-only drinks: Cappuccino, Flat White, Classic Espresso, and Manual Brews do NOT support Iced. Never ask about Hot or Iced for Cappuccino.
- Customization Flow: Ask exactly one question at a time in order: 1. Cup Size -> 2. Strength -> 3. Milk -> 4. Sweetness. Acknowledge each selection with its exact price impact. Summarize and confirm before adding to tray.

TOOL USAGE GUIDELINES:
1. When customer names a drink to browse, select, or customize (e.g. "I want a flat white", "give me a cold brew", "show me latte", "select cappuccino"):
   Call select_product_tool(product_query=...). This opens the product on the Customization screen.
2. When customer specifies customizations for the open product (e.g. "make it large", "with oat milk", "iced", "no sugar", "add an extra shot"):
   Call customize_drink_tool(...).
3. When customer explicitly wants to add an item to the tray or order something directly (e.g. "add to tray", "add that to my cart", "add an almond croissant too", "also add butter croissant", "give me a croissant as well"):
   Call add_to_cart_tool(product_name=...). For food items and pastries that don't need customization, call add_to_cart_tool directly!
4. When customer wants to remove an item from their tray (e.g. "remove the croissant", "take off the coffee", "don't want that anymore"):
   Call screen_action_tool(control="remove_item", value=...).
5. When customer wants to browse a category or asks to see options (e.g. "show me cold brews", "what food do you have?"):
   Call open_category_tool(category=...).
6. When customer wants to navigate or operate the kiosk (e.g. "view my tray", "check out", "confirm order", "go back"):
   Call screen_action_tool(control=...).
7. When customer asks for recommendations (e.g. "something cold and not too sweet", "what goes well with a latte?"):
   Call get_recommendations_tool(...).
8. When customer provides their 10-digit mobile number on the mobile screen (e.g. "my number is 9876543210", "9876543210"):
   Call screen_action_tool(control="set_mobile", value="9876543210"). Ask only: "Is the number correct?" Do NOT read the number aloud.
9. When customer confirms their number (e.g. "yes", "correct", "that's right"):
   Call screen_action_tool(control="confirm_mobile"). Proceed to categories.
10. When customer rejects their number (e.g. "no", "wrong", "incorrect"):
   Call screen_action_tool(control="reject_mobile").
11. When customer says "skip", "no number", or "guest":
   Call screen_action_tool(control="skip_mobile").

PAGE-AWARE CONVERSATIONAL BEHAVIOUR:
Always adapt your advice and follow-up question to the customer's current kiosk page:
- On 'welcome': Welcome the customer warmly and ask what they would like to have today.
- On 'mobile': Ask for their 10-digit Indian mobile number to look up their Café Wallet & loyalty beans, or let them know they can order directly.
- On 'categories': Ask what they feel like having today: handcrafted coffee, chilled beverages, fresh food, or seasonal specials.
- On 'menu': Ask what specific handcrafted brew or item they'd like to try, and offer recommendations if they seem undecided.
- On 'customization': Guide them through their drink options — asking about size (Regular/Large), temperature (Hot/Iced), milk preference (Standard, Oat, Almond), sweetness, or extra shots.
- On 'cart': Ask whether they would like to add an artisanal bake/pastry or proceed directly to checkout.
- On 'wallet_topup': Ask how much they'd like to add to their Café Wallet or guide them to complete UPI payment.
- On 'order_confirmed': Confirm their order details, thank them warmly, and let them know the barista is handcrafting their order.
"""


PAGE_GUIDANCE_MAP = {
    "welcome": "Screen is Welcome. Greet the customer warmly and ask what handcrafted brew or bite they would like.",
    "mobile": "Screen is Mobile Number. Ask for their 10-digit mobile number for loyalty rewards, or invite them to order by voice.",
    "categories": "Screen is Main Categories. Ask what they feel like having today — coffee, chilled beverages, food, or specials.",
    "menu": "Screen is Menu Listing. Ask what item they would like to try or recommend signature roasts.",
    "customization": "Screen is Customization. Ask about their preference for size (Regular/Large), temperature (Hot/Iced), milk, and sweetness.",
    "cart": "Screen is Cart & Tray Summary. Ask whether they would like to add an artisanal bake or proceed to checkout.",
    "wallet_topup": "Screen is Wallet Top-Up. Ask how much they would like to add to their Café Wallet.",
    "order_confirmed": "Screen is Order Confirmed. Confirm order number and thank the customer warmly.",
}


def build_barista_context(context: Dict[str, Any]) -> str:
    lines = []
    screen = context.get("current_screen", "welcome")
    lines.append(f"Authoritative Current Screen: {screen}")

    guidance = PAGE_GUIDANCE_MAP.get(screen, f"Screen is {screen}. Assist the customer naturally.")
    lines.append(f"Screen Objective: {guidance}")

    sel_prod = context.get("selected_product")
    if isinstance(sel_prod, str):
        sel_prod = get_product(sel_prod)

    if isinstance(sel_prod, dict):
        customs = context.get("selected_customizations", {})
        lines.append(
            f"Active Focused Product on Customization Screen: {sel_prod.get('name')} (Base Price: ₹{sel_prod.get('price')})\n"
            f"  - Size: {customs.get('size', 'Regular')}\n"
            f"  - Temperature: {customs.get('temperature', 'Hot')}\n"
            f"  - Milk: {customs.get('milk', 'Standard Dairy')}\n"
            f"  - Sugar: {customs.get('sugar', 'Regular Sugar')}\n"
            f"  - Extra Espresso Shot: {'Yes' if customs.get('extra_shot') else 'No'}\n"
            f"  - Quantity: {customs.get('quantity', 1)}"
        )
    else:
        lines.append("Active Focused Product on Screen: None")

    last_item = context.get("last_item")
    if last_item:
        lines.append(f"Historically Discussed Item: {last_item}")

    cart = context.get("cart", [])
    totals = context.get("cart_totals", {})
    if cart:
        cart_desc = ", ".join(
            f"{it.get('quantity', 1)}x {it.get('name')} [{it.get('size')}, {it.get('temperature')}, {it.get('milk')}] (₹{it.get('totalPrice')})"
            for it in cart
        )
        lines.append(f"Current Cart Items ({len(cart)} items, Total Payable: ₹{totals.get('totalPayable', 0)}): {cart_desc}")
    else:
        lines.append("Current Cart: Empty")

    controls = context.get("available_controls", [])
    if controls:
        lines.append(f"Available UI Capabilities: {', '.join(controls)}")

    return "\n".join(lines)


def create_barista_tools(context: Dict[str, Any]) -> List[Any]:
    """
    Factory creating tools bound to the active customer session context.
    """

    @tool
    def select_product_tool(product_query: str, quantity: int = 1) -> Dict[str, Any]:
        """
        Select a specific coffee or food product and display it on the Customization Screen.
        Use this when the customer names or asks for an item (e.g. "I want a Flat White", "Give me a Vietnamese Shakerato").
        """
        res = resolve_product(product_query)
        if res.get("status") != "selected":
            if res.get("status") == "ambiguous":
                names = [p["name"] for p in res.get("matches", [])]
                return {
                    "success": False,
                    "status": "ambiguous",
                    "message": f"We have multiple options matching that: {', '.join(names)}. Which one would you prefer?",
                }
            return {
                "success": False,
                "status": "not_found",
                "message": f"I couldn't find '{product_query}' on our menu. We offer signature espressos, cold brews, matcha, and artisanal bakes.",
            }

        product = res["product"]
        context["selected_product"] = product
        context["last_item"] = product["name"]
        context["current_screen"] = "customization"
        context["available_controls"] = ["customize_drink", "add_to_cart", "go_back", "open_cart"]

        # Initialize customization state
        context["selected_customizations"] = {
            "size": "Regular",
            "temperature": product.get("defaultTemperature", "Hot"),
            "strength": "Double Shot" if product.get("mainCategory") == "coffee" else "Single Shot",
            "milk": "Regular Milk" if product.get("customizable") else "None",
            "sugar": "Regular Sugar" if product.get("customizable") else "Standard",
            "extra_shot": (product.get("mainCategory") == "coffee"),
            "quantity": max(1, quantity),
        }

        # Start customization session for sequential voice experience
        sess_id = context.get("session_id", "default-session")
        ui_customization = {}
        if product.get("customizable", True):
            try:
                from customization_engine import start_customization_session
            except ImportError:
                from backend.customization_engine import start_customization_session
            cust_sess = start_customization_session(sess_id, product, max(1, quantity))
            ui_customization = cust_sess.get_ui_payload()

        return {
            "success": True,
            "status": "selected",
            "product": {
                "id": product["id"],
                "name": product["name"],
                "price": product["price"],
                "category": product.get("mainCategory"),
                "supportsTemperature": product.get("supportsTemperature", True),
                "defaultTemperature": product.get("defaultTemperature", "Hot"),
                "customizable": product.get("customizable", True),
                "notes": product.get("notes", []),
            },
            "customizations": context["selected_customizations"],
            "customization_payload": ui_customization,
            "step_index": 0,
            "screen": "customization",
            "ui_action": "open_customization",
        }

    @tool
    def customize_drink_tool(
        size: Optional[str] = None,
        temperature: Optional[str] = None,
        milk: Optional[str] = None,
        sugar: Optional[str] = None,
        extra_shot: Optional[bool] = None,
        quantity: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Customize the active drink on the customization screen.
        Options:
        - size: 'Regular' or 'Large' (+₹40)
        - temperature: 'Hot' or 'Iced'
        - milk: 'Standard Dairy', 'Oat Milk' (+₹45), 'Almond Milk' (+₹45)
        - sugar: 'No Sugar', 'Less Sugar', 'Regular Sugar'
        - extra_shot: True (+₹50) or False
        - quantity: integer count
        """
        product = context.get("selected_product")
        if isinstance(product, str):
            product = get_product(product)
        if not product and context.get("last_item"):
            p_obj = get_product(context["last_item"])
            if p_obj:
                context["selected_product"] = p_obj
                product = p_obj

        if not product:
            return {
                "success": False,
                "message": "Please select a beverage before customizing.",
            }

        curr = context.setdefault("selected_customizations", {})

        if size:
            curr["size"] = "Large" if "large" in size.lower() else "Regular"
        if temperature:
            if not product.get("supportsTemperature", True):
                curr["temperature"] = product.get("defaultTemperature", "Hot")
            else:
                curr["temperature"] = "Iced" if "ice" in temperature.lower() else "Hot"
        if milk:
            m_lower = milk.lower()
            if "oat" in m_lower:
                curr["milk"] = "Oat Milk"
            elif "almond" in m_lower:
                curr["milk"] = "Almond Milk"
            else:
                curr["milk"] = "Standard Dairy"
        if sugar:
            s_lower = sugar.lower()
            if "no" in s_lower or "without" in s_lower or "zero" in s_lower:
                curr["sugar"] = "No Sugar"
            elif "less" in s_lower or "half" in s_lower:
                curr["sugar"] = "Less Sugar"
            else:
                curr["sugar"] = "Regular Sugar"
        if extra_shot is not None:
            curr["extra_shot"] = bool(extra_shot)
        if quantity is not None:
            curr["quantity"] = max(1, int(quantity))

        configured = validate_and_configure_item(
            product=product,
            size=curr["size"],
            temperature=curr["temperature"],
            milk=curr["milk"],
            sugar=curr["sugar"],
            extra_shot=curr["extra_shot"],
            quantity=curr["quantity"],
        )

        return {
            "success": True,
            "product_name": product["name"],
            "configured": configured,
            "unitPrice": configured["unitPrice"],
            "totalPrice": configured["totalPrice"],
            "summary": configured["customizationsSummary"],
            "ui_action": "update_customization",
        }

    @tool
    def add_to_cart_tool(
        product_name: Optional[str] = None,
        quantity: int = 1,
        size: Optional[str] = None,
        temperature: Optional[str] = None,
        milk: Optional[str] = None,
        sugar: Optional[str] = None,
        extra_shot: bool = False,
    ) -> Dict[str, Any]:
        """
        Add a product with its customizations to the order tray.
        If product_name is omitted, adds the currently customized item on screen.
        """
        target_name = product_name
        is_new_item = False
        sel = context.get("selected_product")
        if isinstance(sel, str):
            sel = get_product(sel)
        if target_name and isinstance(sel, dict):
            sel_name = sel.get("name", "").lower()
            if target_name.lower() not in sel_name and sel_name not in target_name.lower():
                is_new_item = True

        if not target_name:
            if isinstance(sel, dict):
                target_name = sel.get("name")
            elif context.get("last_item"):
                target_name = context.get("last_item")

        if not target_name:
            return {
                "success": False,
                "message": "No item is currently selected to add to the cart.",
            }

        customs = {} if is_new_item else context.get("selected_customizations", {})
        final_size = size or customs.get("size", "Regular")
        final_temp = temperature or customs.get("temperature", "Hot")
        final_milk = milk or customs.get("milk", "Standard Dairy")
        final_sugar = sugar or customs.get("sugar", "Regular Sugar")
        final_shot = extra_shot if extra_shot else customs.get("extra_shot", False)
        final_qty = max(1, quantity or (1 if is_new_item else customs.get("quantity", 1)))

        res = add_item_to_cart(
            context=context,
            product_id_or_name=target_name,
            quantity=final_qty,
            size=final_size,
            temperature=final_temp,
            milk=final_milk,
            sugar=final_sugar,
            extra_shot=final_shot,
            idempotency_key=context.get("current_idempotency_key"),
        )

        if res.get("success"):
            context["current_screen"] = "menu"
            context["selected_product"] = None
            context["selected_customizations"] = {
                "size": "Regular",
                "temperature": "Hot",
                "milk": "Standard Dairy",
                "sugar": "Regular Sugar",
                "extra_shot": False,
                "quantity": 1,
            }
            context["available_controls"] = ["open_cart", "browse_categories", "checkout"]

        return res

    @tool
    def open_category_tool(category: str, subcategory: Optional[str] = None) -> Dict[str, Any]:
        """
        Navigate to a menu category or subcategory on the kiosk display.
        Categories: 'coffee', 'beverages', 'food', 'specials'.
        """
        cat_lower = category.lower().strip()
        matched_cat = "coffee"
        if "bev" in cat_lower or "drink" in cat_lower or "tea" in cat_lower or "cold brew" in cat_lower or "matcha" in cat_lower:
            matched_cat = "beverages"
        elif "food" in cat_lower or "sandwich" in cat_lower or "bake" in cat_lower or "pastry" in cat_lower or "toast" in cat_lower:
            matched_cat = "food"
        elif "special" in cat_lower or "combo" in cat_lower or "seasonal" in cat_lower:
            matched_cat = "specials"

        items = get_products_by_category(matched_cat)
        top_items = [p["name"] for p in items[:4]]

        context["current_screen"] = "menu"
        context["last_category"] = matched_cat
        context["available_controls"] = ["select_product", "open_cart", "go_back"]

        return {
            "success": True,
            "category": matched_cat,
            "subcategory": subcategory,
            "screen": "menu",
            "ui_action": "open_category",
            "top_items": top_items,
            "total_items": len(items),
        }

    @tool
    def screen_action_tool(control: str, value: Optional[str] = None) -> Dict[str, Any]:
        """
        Operate kiosk navigation and screen controls.
        Controls:
        - 'set_mobile': Sets customer's 10-digit mobile number (value='9876543210') and navigates to menu categories
        - 'skip_mobile': Skips mobile number entry and navigates to menu categories
        - 'open_cart': Opens the order tray screen
        - 'go_back': Navigates back
        - 'checkout': Advances to payment methods on cart screen
        - 'confirm_order': Places the order
        - 'clear_cart': Empties the tray
        - 'remove_item': Removes an item (specify value=name or cartId)
        """
        ctrl = control.lower().strip()
        if ctrl == "open_cart":
            context["current_screen"] = "cart"
            context["available_controls"] = ["checkout", "clear_cart", "remove_item", "go_back"]
            return {"success": True, "screen": "cart", "ui_action": "open_cart", "totals": context.get("cart_totals")}

        elif ctrl == "go_back":
            last_sc = context.get("last_screen", "menu")
            context["current_screen"] = last_sc
            return {"success": True, "screen": last_sc, "ui_action": "go_back"}

        elif ctrl in ["checkout", "pay"]:
            context["current_screen"] = "cart"
            return {"success": True, "screen": "cart", "ui_action": "checkout", "message": "Ready to complete payment with UPI, Card, or Café Wallet."}

        elif ctrl in ["confirm_order", "place_order"]:
            pm = value or "UPI"
            res = confirm_order(context, payment_method=pm)
            res["ui_action"] = "order_confirmed"
            res["screen"] = "order_confirmed"
            return res

        elif ctrl == "clear_cart":
            return clear_cart_items(context)

        elif ctrl == "remove_item":
            return remove_cart_item(context, value or "last")

        elif ctrl in ["set_mobile", "enter_mobile", "mobile_number", "phone_number"]:
            import re
            digits = re.sub(r"\D", "", value or "")
            if len(digits) >= 10:
                clean_phone = digits[-10:]
                context["staged_mobile_number"] = clean_phone
                context["pending_number_confirmation"] = True
                context["current_screen"] = "mobile"
                return {
                    "success": True,
                    "screen": "mobile",
                    "ui_action": "await_number_confirmation",
                    "mobile_number": clean_phone,
                    "message": "Is the number correct?",
                }
            else:
                return {
                    "success": False,
                    "message": "Could you please repeat your 10-digit mobile number?",
                }

        elif ctrl in ["confirm_mobile", "confirm_number", "confirm"]:
            clean_phone = context.get("staged_mobile_number") or context.get("mobile_number") or ""
            context["mobile_number"] = clean_phone
            context["staged_mobile_number"] = None
            context["pending_number_confirmation"] = False
            context["current_screen"] = "categories"
            return {
                "success": True,
                "screen": "categories",
                "ui_action": "set_mobile",
                "mobile_number": clean_phone,
                "message": "What do you feel like having today — coffee, chilled drinks, or artisanal food?",
            }

        elif ctrl in ["reject_mobile", "wrong_number", "reenter_mobile"]:
            context["staged_mobile_number"] = None
            context["pending_number_confirmation"] = False
            context["current_screen"] = "mobile"
            return {
                "success": True,
                "screen": "mobile",
                "ui_action": "clear_mobile",
                "message": "No problem, please say or enter your mobile number again.",
            }

        elif ctrl in ["skip_mobile", "skip"]:
            context["current_screen"] = "categories"
            return {
                "success": True,
                "screen": "categories",
                "ui_action": "navigate",
                "message": "No problem! You can order as our guest. What would you like to explore today — coffee, chilled drinks, or bakes?",
            }

        return {"success": False, "message": f"Control '{control}' not recognized."}

    @tool
    def get_recommendations_tool(preference: Optional[str] = None) -> Dict[str, Any]:
        """
        Provide coffee and pastry recommendations based on customer preferences or active cart.
        """
        pref = (preference or "").lower()
        if "cold" in pref or "iced" in pref or "refresh" in pref:
            return {
                "recommendations": ["Classic 18-Hr Cold Brew", "Vietnamese Shakerato", "Peach & Hibiscus Iced Tea"],
                "reason": "Chilled, smooth, and refreshing specialty brews.",
            }
        elif "sweet" in pref or "dessert" in pref or "pastry" in pref:
            return {
                "recommendations": ["Sea Salt Mocha", "Butter Croissant", "Banana Walnut Tea Cake"],
                "reason": "Rich handcrafted chocolate-coffee and freshly baked European pastries.",
            }
        else:
            return {
                "recommendations": ["Signature Cappuccino", "Vietnamese Shakerato", "Avocado Sourdough Toast"],
                "reason": "Customer favourites and signature roasts.",
            }

    return [
        select_product_tool,
        customize_drink_tool,
        add_to_cart_tool,
        open_category_tool,
        screen_action_tool,
        get_recommendations_tool,
    ]
