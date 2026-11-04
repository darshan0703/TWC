# Third Wave Coffee — Premium 9:16 Portrait Self-Ordering Kiosk

A clean, touchscreen self-ordering kiosk frontend built for **Third Wave Coffee India**, designed exclusively for a **fixed 1080 × 1920 reference portrait display (9:16 aspect ratio)** and aligned with Third Wave Coffee's official minimal cream, white, and charcoal navy visual identity.

---

## 📱 Fixed 9:16 Portrait Architecture (1080 × 1920 Reference)

- **Strict 9:16 Portrait Aspect Ratio:** The kiosk interface uses a fixed `aspect-[9/16]` container on every page.
- **Centered Canvas Presentation:** In desktop/browser preview, the portrait kiosk is displayed centrally with neutral ambient dark space around it, preserving its exact kiosk hardware proportions without stretching.
- **Proportional Scaling:** The canvas scales to fit any browser height and width without cropping, distortion, or horizontal scrolling (`h-[min(94vh,calc(100vw*16/9))] w-[min(calc(94vh*9/16),98vw)]`).
- **No Mobile/Browser Clutter:** No phone status bars, phone notches, or simulated mobile navigation bars inside the kiosk canvas.

---

## ☕ Visual Identity & Color System

Aligned with Third Wave Coffee's clean, specialty-coffee branding:
- **Main Background:** Warm Cream / Ivory (`#F8F5EE` / `#FCFBF8`)
- **Primary Text & Buttons:** Deep Charcoal Navy (`#1C2A39` / `#243342`)
- **Card Surfaces:** Crisp White (`#FFFFFF`)
- **Selected States:** Soft Muted Beige (`#EAE3D9`) with Navy accents
- **Borders & Dividers:** Subtle Beige / Warm Grey (`#D8CFC4` / `#E6DDD1`)
- **Accent Details:** Coffee Terracotta (`#C36B46`) & Green Veg indicators (`#2B7A4B`)
- **Illustrations:** Minimal 2D navy line-art illustrations of coffee moments and pairings.
- *No gold-heavy styling, no black cards, and no excessive shadows.*

---

## 📋 Main Category Screen — Exactly Five Choices

The category landing page contains exclusively these 5 choices:

1. **Specials** — Signature sips and handcrafted innovations (Vietnamese Shakerato, Sea Salt Mocha, Orange Zest Mocha, etc.)
2. **Meal Combos** — Coffee & food combinations with savings (Cappuccino & Croissant, Shakerato & Avocado Toast, Latte & Cookie, Cold Brew & Panini)
3. **Beverages** — Opens the beverage menu with subcategories:
   - Classics (Americano, Cappuccino, Café Latte, Flat White, Mocha, Espresso)
   - TWC Specials
   - Cold Brew
   - Matcha
   - Frappe
   - Manual Brew
   - Tea & Refreshers
4. **Food** — Opens food menu with subcategories:
   - Artisanal Savouries & Sandwiches
   - Bakes & Viennoiserie
5. **View Full Menu** — Clear shortcut to browse all café categories.

*Beverage subcategories do not clutter the main landing page; they appear only after opening Beverages or View Full Menu.*

---

## 📱 Complete Kiosk Flow

1. **Welcome / Touch to Start (`WelcomeScreen.jsx`)**
   - Centered Third Wave Coffee logo
   - Headline: `GOOD COFFEE. YOUR WAY.` with `Craft your coffee moment`
   - Premium coffee photograph card
   - Minimal 2D navy line-art illustration
   - Dine-In / Takeaway selector
   - Large `TOUCH TO START` button in deep charcoal navy

2. **Mobile Number Entry (`MobileNumberScreen.jsx`)**
   - `Enter your mobile number` / `Welcome to Third Wave Coffee`
   - Formatted phone display with India `+91` badge (`98765 43210`)
   - 3×4 Touch Keypad with `Clear` and `Delete`
   - Real-time 10-digit validation with inline error handling
   - `CONTINUE` and `SKIP FOR NOW / CONTINUE AS GUEST` buttons

3. **Main Category Selection (`MainCategoryScreen.jsx`)**
   - Exactly the 5 choices in a balanced portrait layout (Hero Specials card + 2 pairs)
   - Touch-friendly, image-based cards with subtitles and item counts

4. **Category Menu (`MenuScreen.jsx`)**
   - Dynamic subcategory pill bar (`CategoryNavBar.jsx`)
   - 2-Column touch product grid with photo, veg tag, tasting notes, price, and `+ Add` button

5. **Product Customization (`CustomizationScreen.jsx`)**
   - Hero photo and description
   - Touch options: Size (Regular / Large), Temperature (Hot / Iced), Milk (Dairy / Oat / Almond), Extra Espresso Shot (+₹50), Sweetness, Quantity `[-] N [+]`
   - Pastry pairing suggestions
   - Live price updates with sticky `ADD TO CART • ₹XXX` and `BACK TO MENU`

6. **Cart (`CartScreen.jsx`)**
   - Customized item list with modifiers and quantity controls
   - Clear Cart confirmation modal
   - *You May Also Enjoy* recommendations
   - Bill summary (Subtotal, 5% GST, Free service fee, Grand Total)
   - `PAY NOW` (simulated payment selection) and `LOAD THIRD WAVE WALLET`

7. **Wallet Top-Up (`WalletTopUpScreen.jsx`)**
   - Digital Café Wallet balance card in charcoal navy
   - Preset buttons (₹300, ₹600, ₹1000, Custom)
   - Clean placeholder QR labeled `DEMO QR — NOT A REAL PAYMENT CODE`
   - `PAY ₹XXX` and `BACK TO CART`

8. **Wallet Payment Success (`WalletSuccessScreen.jsx`)**
   - Simulated confirmation checkmark with animated ripple
   - Updated Available Balance card
   - `CONTINUE TO ORDER` and `BACK TO CART`

9. **Order Confirmation (`OrderConfirmationScreen.jsx`)**
   - Confirmation checkmark
   - Dynamic order token (e.g. `Order #TWC-1024`)
   - 3-step progress bar: `Order Received → Preparing → Ready for Pickup`
   - Ordered items receipt summary and total paid
   - `START A NEW ORDER` button resetting state to welcome screen

---

## 🛠️ Running the Application

```powershell
# From the project root:
npm run dev

# Or inside Third-Wave-Coffee-Kiosk:
cd Third-Wave-Coffee-Kiosk
npm run dev
```

Open `http://localhost:5173` in any browser.
