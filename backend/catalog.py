"""
backend/catalog.py
Authoritative Third Wave Coffee (TWC) Menu Catalog and Product Resolver.
Loads the official menu dataset (72 products, 4 main categories, 18 subcategories, and customization options).
Provides high-performance exact and token-based product resolution with customization validation.
"""

import json
import os
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

_CURRENT_DIR = Path(__file__).resolve().parent
_DATA_PATH = _CURRENT_DIR / "products_data.json"

if not _DATA_PATH.exists():
    raise FileNotFoundError(f"TWC Products data file not found at {_DATA_PATH}")

with open(_DATA_PATH, "r", encoding="utf-8") as f:
    _RAW_DATA = json.load(f)

MAIN_CATEGORIES: List[Dict[str, Any]] = _RAW_DATA.get("MAIN_CATEGORIES", [])
PRODUCTS: List[Dict[str, Any]] = _RAW_DATA.get("PRODUCTS", [])
CUSTOMIZATION_OPTIONS: Dict[str, Any] = _RAW_DATA.get("CUSTOMIZATION_OPTIONS", {})
PASTRY_RECOMMENDATIONS: List[Dict[str, Any]] = _RAW_DATA.get("PASTRY_RECOMMENDATIONS", [])
CART_RECOMMENDATIONS: List[Dict[str, Any]] = _RAW_DATA.get("CART_RECOMMENDATIONS", [])

# Quick index by product ID
_PRODUCTS_BY_ID: Dict[str, Dict[str, Any]] = {p["id"]: p for p in PRODUCTS if "id" in p}


def normalize_text(text: Any) -> str:
    """Normalizes string for robust comparison."""
    if not text:
        return ""
    clean = re.sub(r"[^a-zA-Z0-9\s]", " ", str(text).lower())
    return " ".join(clean.split())


def tokenize(text: Any) -> set:
    """Returns normalized set of tokens."""
    return set(normalize_text(text).split())


class _TWCProductIndex:
    """
    In-memory search index mapping normalized names and token sets to products.
    """
    def __init__(self, products: List[Dict[str, Any]]):
        self.exact_map: Dict[str, Dict[str, Any]] = {}
        self.token_list: List[Tuple[frozenset, Dict[str, Any]]] = []

        # Common coffee shop aliases / colloquial terms
        self.aliases: Dict[str, str] = {
            "latte": "cafe_latte",
            "cappuccino": "cappuccino",
            "americano": "americano_reserve",
            "flat white": "flat_white_estate",
            "espresso": "double_espresso",
            "double espresso": "double_espresso",
            "mocha": "sea_salt_mocha_reserve",
            "sea salt mocha": "sea_salt_mocha_reserve",
            "orange zest mocha": "orange_zest_mocha_gold",
            "cold brew": "classic_cold_brew",
            "iced cold brew": "classic_cold_brew",
            "shakerato": "vietnamese_shakerato",
            "vietnamese": "vietnamese_shakerato",
            "matcha": "ceremonial_matcha_latte",
            "matcha latte": "ceremonial_matcha_latte",
            "iced matcha": "iced_strawberry_matcha",
            "croissant": "butter_croissant",
            "butter croissant": "butter_croissant",
            "almond croissant": "almond_frangipane_croissant",
            "avocado toast": "avocado_sourdough_toast",
            "toast": "avocado_sourdough_toast",
            "banana cake": "banana_walnut_cake",
            "banana bread": "banana_walnut_cake",
            "walnut cake": "banana_walnut_cake",
            "frappe": "classic_coffee_frappe",
            "iced tea": "peach_iced_tea",
            "peach iced tea": "peach_iced_tea",
            "hot tea": "darjeeling_white_tea",
        }

        for p in products:
            norm_name = normalize_text(p.get("name"))
            if norm_name:
                self.exact_map[norm_name] = p
            p_id = p.get("id")
            if p_id:
                self.exact_map[p_id.lower()] = p

            tokens = frozenset(tokenize(p.get("name")))
            if tokens:
                self.token_list.append((tokens, p))

    def resolve(self, query: str) -> Dict[str, Any]:
        norm = normalize_text(query)
        if not norm:
            return {"status": "not_found", "matches": []}

        # 1. Alias check
        if norm in self.aliases:
            target_id = self.aliases[norm]
            if target_id in _PRODUCTS_BY_ID:
                prod = _PRODUCTS_BY_ID[target_id]
                return {"status": "selected", "product": prod, "matches": [prod]}

        # Check multi-word aliases inside query (e.g. "can I have a flat white")
        for alias, target_id in self.aliases.items():
            pattern = r"\b" + re.escape(alias) + r"\b"
            if re.search(pattern, norm):
                if target_id in _PRODUCTS_BY_ID:
                    prod = _PRODUCTS_BY_ID[target_id]
                    return {"status": "selected", "product": prod, "matches": [prod]}

        # 2. Exact match
        if norm in self.exact_map:
            prod = self.exact_map[norm]
            return {"status": "selected", "product": prod, "matches": [prod]}

        # 3. Token subset matching
        q_tokens = tokenize(norm)
        # Strip common stopwords that might confuse matching
        stopwords = {"can", "i", "get", "a", "an", "the", "want", "have", "please", "some", "give", "me", "need", "like", "order"}
        meaningful_tokens = q_tokens - stopwords
        if not meaningful_tokens:
            meaningful_tokens = q_tokens

        candidates = []
        for name_tokens, prod in self.token_list:
            # If name tokens are a subset of user tokens, or user tokens are subset of name tokens
            if name_tokens.issubset(meaningful_tokens) or (meaningful_tokens and meaningful_tokens.issubset(name_tokens)):
                candidates.append(prod)

        # Remove duplicate candidate instances
        unique_cands = []
        seen_ids = set()
        for c in candidates:
            if c["id"] not in seen_ids:
                seen_ids.add(c["id"])
                unique_cands.append(c)

        if len(unique_cands) == 1:
            return {"status": "selected", "product": unique_cands[0], "matches": unique_cands}
        elif len(unique_cands) > 1:
            return {"status": "ambiguous", "matches": unique_cands}

        # 4. Partial substring match
        sub_matches = [
            p for p in PRODUCTS
            if norm in normalize_text(p.get("name")) or normalize_text(p.get("name")) in norm
        ]
        if len(sub_matches) == 1:
            return {"status": "selected", "product": sub_matches[0], "matches": sub_matches}
        elif len(sub_matches) > 1:
            return {"status": "ambiguous", "matches": sub_matches}

        return {"status": "not_found", "matches": []}


_INDEX = _TWCProductIndex(PRODUCTS)


def get_all_products() -> List[Dict[str, Any]]:
    return PRODUCTS


def get_product(product_id_or_name: str) -> Optional[Dict[str, Any]]:
    if not product_id_or_name:
        return None
    if product_id_or_name in _PRODUCTS_BY_ID:
        return _PRODUCTS_BY_ID[product_id_or_name]
    res = _INDEX.resolve(product_id_or_name)
    if res.get("status") == "selected":
        return res.get("product")
    return None


def resolve_product(query: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Resolves customer product request against authoritative TWC products."""
    return _INDEX.resolve(query)


def get_products_by_category(category_id: str) -> List[Dict[str, Any]]:
    cat_norm = category_id.lower().strip()
    return [p for p in PRODUCTS if p.get("mainCategory", "").lower() == cat_norm]


def get_products_by_subcategory(subcategory_id: str) -> List[Dict[str, Any]]:
    sub_norm = subcategory_id.lower().strip()
    return [p for p in PRODUCTS if p.get("subcategory", "").lower() == sub_norm]


def calculate_customized_price(
    product: Dict[str, Any],
    size: Optional[str] = "Regular",
    milk: Optional[str] = "Regular Milk",
    extra_shot: bool = False,
    strength: Optional[str] = None,
) -> int:
    """Calculates deterministic unit price for a configured TWC item."""
    base = int(product.get("price", 0))

    # Size: Large is +40 (or largePrice - price if specified)
    if size and "large" in size.lower():
        if product.get("largePrice") is not None and product["largePrice"] > product.get("price", 0):
            base += (product["largePrice"] - product.get("price", 0))
        else:
            base += 40

    # Espresso Strength / Extra Shot:
    # Double Shot is +50; Single Shot is +0
    if strength:
        s_clean = strength.lower()
        if "double" in s_clean or "extra" in s_clean or "bold" in s_clean:
            base += 50
    elif extra_shot:
        base += 50

    # Milk:
    # Soy Milk: +40
    # Oat Milk / Almond Milk: +45
    # Regular Milk / Skimmed Milk: +0
    if milk:
        m_clean = milk.lower()
        if "soy" in m_clean:
            base += 40
        elif "oat" in m_clean or "almond" in m_clean:
            base += 45

    return base


def validate_and_configure_item(
    product: Dict[str, Any],
    size: Optional[str] = None,
    temperature: Optional[str] = None,
    milk: Optional[str] = None,
    sugar: Optional[str] = None,
    extra_shot: bool = False,
    strength: Optional[str] = None,
    quantity: int = 1,
) -> Dict[str, Any]:
    """
    Validates and formats a complete customized item adhering to TWC business rules.
    """
    is_customizable = product.get("customizable", True)
    is_coffee = product.get("mainCategory") == "coffee"

    # 1. Size
    canonical_size = "Large" if (size and "large" in size.lower()) else "Regular"

    # 2. Temperature validation
    supports_temp = product.get("supportsTemperature", True)
    default_temp = product.get("defaultTemperature", "Hot")
    if not supports_temp:
        canonical_temp = default_temp
    else:
        if temperature and "ice" in temperature.lower():
            canonical_temp = "Iced"
        elif temperature and "hot" in temperature.lower():
            canonical_temp = "Hot"
        else:
            canonical_temp = default_temp

    # 3. Strength validation
    if strength:
        s_lower = strength.lower()
        if "single" in s_lower or "mild" in s_lower or "one" in s_lower:
            canonical_strength = "Single Shot"
            has_extra_shot = False
        else:
            canonical_strength = "Double Shot"
            has_extra_shot = True
    elif extra_shot:
        canonical_strength = "Double Shot"
        has_extra_shot = True
    else:
        # Default for coffee is Double Shot as per touch screen configuration
        canonical_strength = "Double Shot" if is_coffee else "Single Shot"
        has_extra_shot = (canonical_strength == "Double Shot")

    # 4. Milk validation
    if not is_customizable:
        canonical_milk = "None"
    else:
        milk_lower = (milk or "").lower()
        if "oat" in milk_lower:
            canonical_milk = "Oat Milk"
        elif "almond" in milk_lower:
            canonical_milk = "Almond Milk"
        elif "soy" in milk_lower:
            canonical_milk = "Soy Milk"
        elif "skim" in milk_lower:
            canonical_milk = "Skimmed Milk"
        elif "dairy" in milk_lower or "standard" in milk_lower or "whole" in milk_lower:
            canonical_milk = "Regular Milk"
        else:
            canonical_milk = "Regular Milk"

    # 5. Sugar validation
    if not is_customizable:
        canonical_sugar = "Standard"
    else:
        sugar_lower = (sugar or "").lower()
        if "no" in sugar_lower or "zero" in sugar_lower or "without" in sugar_lower or "none" in sugar_lower:
            canonical_sugar = "No Sugar"
        elif "less" in sugar_lower or "half" in sugar_lower or "50" in sugar_lower or "little" in sugar_lower:
            canonical_sugar = "Less Sugar"
        else:
            canonical_sugar = "Regular Sugar"

    unit_price = calculate_customized_price(
        product,
        size=canonical_size,
        milk=canonical_milk,
        extra_shot=has_extra_shot,
        strength=canonical_strength,
    )
    total_price = unit_price * max(1, quantity)

    summary = [
        f"{canonical_size} ({'350 ml' if canonical_size == 'Large' else '240 ml'})" if is_customizable else None,
        canonical_temp if (supports_temp and is_customizable) else None,
        canonical_strength if (is_coffee and is_customizable) else None,
        canonical_milk if is_customizable and canonical_milk != "None" else None,
        canonical_sugar if is_customizable and canonical_sugar != "Standard" else None,
    ]
    customizations_summary = [s for s in summary if s is not None]

    return {
        "productId": product["id"],
        "name": product["name"],
        "image": product.get("image", ""),
        "unitPrice": unit_price,
        "quantity": max(1, quantity),
        "size": canonical_size,
        "temperature": canonical_temp,
        "strength": canonical_strength,
        "milk": canonical_milk,
        "sugar": canonical_sugar,
        "extraShot": bool(has_extra_shot),
        "totalPrice": total_price,
        "customizationsSummary": customizations_summary,
    }


class TWCCatalog:
    def __init__(self):
        self.categories = MAIN_CATEGORIES
        self.products = PRODUCTS
        self.customization_options = CUSTOMIZATION_OPTIONS
        self.pastry_recommendations = PASTRY_RECOMMENDATIONS
        self.cart_recommendations = CART_RECOMMENDATIONS
        self.index = _INDEX

    @property
    def product_count(self) -> int:
        return len(self.products)

    def get_all_products(self) -> List[Dict[str, Any]]:
        return get_all_products()

    def get_product(self, product_id_or_name: str) -> Optional[Dict[str, Any]]:
        return get_product(product_id_or_name)

    def resolve_product(self, query: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return resolve_product(query, context)

    def get_products_by_category(self, category_id: str) -> List[Dict[str, Any]]:
        return get_products_by_category(category_id)

    def get_products_by_subcategory(self, subcategory_id: str) -> List[Dict[str, Any]]:
        return get_products_by_subcategory(subcategory_id)

    def calculate_customized_price(self, product: Dict[str, Any], size: str = "Regular", milk: str = "Regular Milk", extra_shot: bool = False, strength: Optional[str] = None) -> int:
        return calculate_customized_price(product, size, milk, extra_shot, strength)

    def validate_and_configure_item(self, product: Dict[str, Any], size: Optional[str] = None, temperature: Optional[str] = None, milk: Optional[str] = None, sugar: Optional[str] = None, extra_shot: bool = False, strength: Optional[str] = None, quantity: int = 1) -> Dict[str, Any]:
        return validate_and_configure_item(product, size, temperature, milk, sugar, extra_shot, strength, quantity)


catalog = TWCCatalog()

