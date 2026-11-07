import React, { useState, useMemo } from 'react';
import './CustomizationScreen.css';
import { KioskHeader } from '../components/KioskHeader';
import { CUSTOMIZATION_OPTIONS, PASTRY_RECOMMENDATIONS, PRODUCTS } from '../data/products';
import { useKiosk } from '../context/KioskContext';
import { Plus, Minus, Check, Flame, Snowflake, ShoppingBag } from 'lucide-react';

export const CustomizationScreen = () => {
  const { selectedProduct, addToCart, addDirectToCart, navigateTo } = useKiosk();

  // Fallback to Cappuccino if directly opened
  const product = selectedProduct || PRODUCTS.find(p => p.id === 'cappuccino') || PRODUCTS[1];

  // Customization state
  const [size, setSize] = useState('Regular');
  const [temperature, setTemperature] = useState(product.defaultTemperature || 'Hot');
  const [milk, setMilk] = useState('Standard Dairy');
  const [sugar, setSugar] = useState('Regular Sugar');
  const [extraShot, setExtraShot] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Derive available sizes: exact independent prices from photographs
  // If product does not list Large, never display an invented large option
  const availableSizes = useMemo(() => {
    if (product.largePrice != null && product.largePrice > product.price) {
      const diff = product.largePrice - product.price;
      return [
        { id: 'Regular', label: 'Regular', sizeMl: 'Standard Cup', priceDiff: 0 },
        { id: 'Large', label: 'Large', sizeMl: 'Large Cup', priceDiff: diff }
      ];
    }
    return [
      { id: 'Regular', label: 'Regular', sizeMl: 'Standard Cup', priceDiff: 0 }
    ];
  }, [product]);

  // Calculate live item unit price based on customization
  const unitPrice = useMemo(() => {
    let base = product.price;

    // Size add-on (exact menu photograph price)
    if (size === 'Large' && product.largePrice != null) {
      base = product.largePrice;
    }

    // Milk add-on
    const milkConfig = CUSTOMIZATION_OPTIONS.milks.find(m => m.id === milk || m.label === milk);
    if (milkConfig) base += milkConfig.priceDiff;

    // Extra shot
    if (extraShot) base += CUSTOMIZATION_OPTIONS.extraShotPrice;

    return base;
  }, [product.price, product.largePrice, size, milk, extraShot]);

  const totalPrice = unitPrice * quantity;

  // Handle Add to Cart
  const handleAddToCart = () => {
    const customizationsSummary = [
      `${size} (${size === 'Large' ? '350 ml' : '240 ml'})`,
      product.supportsTemperature ? temperature : null,
      product.customizable ? milk : null,
      product.customizable ? sugar : null,
      extraShot ? '+1 Espresso Shot' : null
    ].filter(Boolean);

    const configuredItem = {
      cartId: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice,
      quantity,
      size,
      temperature: product.supportsTemperature ? temperature : (product.defaultTemperature || 'Warm'),
      milk,
      sugar,
      extraShot,
      totalPrice,
      customizationsSummary
    };

    addToCart(configuredItem);
    navigateTo('menu');
  };

  return (
    <div className="customization-screen w-full h-full bg-cream-100 flex flex-col justify-between select-none overflow-hidden">
      
      {/* Kiosk Header */}
      <KioskHeader
        title="Customisation"
        subtitle={product.name}
        showBack={true}
        showCart={true}
        onBackOverride={() => navigateTo('menu')}
      />

      {/* Main Scrollable Content */}
      <main className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3.5">
        
        {/* Product Hero Header */}
        <div className="relative rounded-2xl overflow-hidden bg-white border border-beige-muted/80 shadow-sm aspect-[16/9]">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/35 to-transparent" />

          {/* Badges on image */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            {product.veg && (
              <span className="w-5 h-5 rounded bg-white border border-emerald-700 flex items-center justify-center shadow">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-700"></span>
              </span>
            )}
            {product.badge && (
              <span className="px-2 py-0.5 rounded-md bg-white text-navy text-[10px] font-black uppercase tracking-wider shadow">
                {product.badge}
              </span>
            )}
          </div>

          <div className="absolute bottom-2.5 left-3 right-3 text-white">
            <span className="text-[10px] uppercase font-bold tracking-widest text-beige-light block">
              {product.category === 'specials' ? 'TWC Signature' : product.category === 'combos' ? 'Meal Combo' : 'House Roast'}
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-black font-sans tracking-tight">
                {product.name}
              </h2>
              <span className="text-base sm:text-lg font-black text-white font-sans shrink-0">
                ₹{unitPrice}
              </span>
            </div>
          </div>
        </div>

        {/* Flavour Tasting Notes */}
        <div className="p-2.5 rounded-xl bg-white border border-beige-muted/70 text-xs space-y-1">
          <p className="text-taupe-warm leading-relaxed text-[11px]">
            {product.description}
          </p>
          {product.notes && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {product.notes.map((n, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-cream-200 text-[9px] font-bold text-navy/80">
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Customization Options Container */}
        <div className="bg-white rounded-2xl p-3 border border-beige-muted/80 shadow-sm space-y-3.5">
          
          {/* 1. Size Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-navy">
                1. Select Size
              </label>
              <span className="text-[10px] text-taupe-warm font-medium">Single choice</span>
            </div>

            <div className={`grid ${availableSizes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
              {availableSizes.map((s) => {
                const isSelected = size === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSize(s.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border-2 transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'bg-beige border-navy text-navy font-black shadow-sm'
                        : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold'
                    }`}
                  >
                    <div className="text-left leading-tight">
                      <span className="text-xs sm:text-sm block">{s.label}</span>
                      <span className="text-[9px] text-taupe-warm font-normal">{s.sizeMl}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {s.priceDiff > 0 && (
                        <span className="text-[9px] font-bold bg-white px-1.5 py-0.5 rounded text-navy border border-beige-muted">
                          +₹{s.priceDiff}
                        </span>
                      )}
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-navy bg-navy text-white' : 'border-beige-dark'
                      }`}>
                        {isSelected && <Check className="w-2 h-2" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Temperature (if supported) */}
          {product.supportsTemperature && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-navy">
                  2. Temperature
                </label>
                <span className="text-[10px] text-taupe-warm font-medium">Brew temp</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {CUSTOMIZATION_OPTIONS.temperatures.map((temp) => {
                  const isSelected = temperature === temp.id;
                  const Icon = temp.id === 'Hot' ? Flame : Snowflake;

                  return (
                    <button
                      key={temp.id}
                      type="button"
                      onClick={() => setTemperature(temp.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border-2 transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'bg-beige border-navy text-navy font-black shadow-sm'
                          : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded flex items-center justify-center ${
                          temp.id === 'Hot' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'
                        }`}>
                          <Icon className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-black">{temp.label}</span>
                      </div>

                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-navy bg-navy text-white' : 'border-beige-dark'
                      }`}>
                        {isSelected && <Check className="w-2 h-2" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Milk Choice */}
          {product.customizable && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-navy">
                  3. Choice of Milk
                </label>
                <span className="text-[10px] text-taupe-warm font-medium">Dairy & plant</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {CUSTOMIZATION_OPTIONS.milks.map((m) => {
                  const isSelected = milk === m.label;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMilk(m.label)}
                      className={`p-2 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'bg-beige border-navy text-navy font-black shadow-sm'
                          : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-extrabold truncate">{m.id}</span>
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-navy bg-navy text-white' : 'border-beige-dark'
                        }`}>
                          {isSelected && <Check className="w-1.5 h-1.5" />}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-navy block">
                        {m.priceDiff === 0 ? 'Free' : `+₹${m.priceDiff}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Extra Shot */}
          {product.customizable && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setExtraShot(!extraShot)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all active:scale-[0.98] ${
                  extraShot
                    ? 'bg-beige border-navy text-navy font-black shadow-sm'
                    : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold'
                }`}
              >
                <div className="text-left leading-tight">
                  <span className="text-xs font-extrabold block">Extra Arabica Shot</span>
                  <span className="text-[9px] text-taupe-warm font-normal">Bold crema boost</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded text-navy border border-beige-muted">
                    +₹50
                  </span>
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                    extraShot ? 'border-navy bg-navy text-white' : 'border-beige-dark'
                  }`}>
                    {extraShot && <Check className="w-2.5 h-2.5" />}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* 5. Sugar */}
          {product.customizable && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-navy">
                4. Sweetness
              </label>

              <div className="grid grid-cols-3 gap-1.5">
                {CUSTOMIZATION_OPTIONS.sugar.map((sug) => {
                  const isSelected = sugar === sug.label;
                  return (
                    <button
                      key={sug.id}
                      type="button"
                      onClick={() => setSugar(sug.label)}
                      className={`p-2 rounded-xl border-2 text-center transition-all ${
                        isSelected
                          ? 'bg-beige border-navy text-navy font-black shadow-sm'
                          : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold'
                      }`}
                    >
                      <span className="text-[11px] font-bold block">{sug.id}</span>
                      <span className="text-[9px] text-taupe-warm">{sug.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Quantity Selector */}
          <div className="flex items-center justify-between pt-2 border-t border-beige-muted/70">
            <span className="text-xs font-black uppercase tracking-wider text-navy">
              Quantity
            </span>

            <div className="flex items-center gap-3 bg-cream-100 rounded-xl border border-beige-muted p-1">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-8 h-8 rounded-lg bg-white text-navy flex items-center justify-center hover:bg-cream-200 disabled:opacity-40 transition-all active:scale-95 shadow-sm"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <span className="text-base font-black text-navy w-5 text-center font-sans">
                {quantity}
              </span>

              <button
                type="button"
                onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 rounded-lg bg-white text-navy flex items-center justify-center hover:bg-cream-200 transition-all active:scale-95 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {/* "Pairs Well With" Pastry Cards */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-taupe-warm font-sans">
              Pairs Well With
            </span>
            <span className="text-[10px] font-semibold text-navy/70">Barista pairing</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PASTRY_RECOMMENDATIONS.map((pastry) => (
              <div
                key={pastry.id}
                className="bg-white rounded-xl p-2 border border-beige-muted/80 flex items-center justify-between gap-2 shadow-sm"
              >
                <img
                  src={pastry.image}
                  alt={pastry.name}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h5 className="text-[10px] font-extrabold text-navy truncate">
                    {pastry.name}
                  </h5>
                  <span className="text-[10px] font-black text-navy">
                    ₹{pastry.price}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => addDirectToCart(pastry)}
                  title="Add pastry to tray"
                  className="w-7 h-7 rounded-lg bg-cream-200 hover:bg-navy hover:text-white text-navy flex items-center justify-center transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Sticky Bottom Actions inside the Portrait Kiosk */}
      <footer className="sticky bottom-0 z-30 w-full bg-cream-100/95 backdrop-blur-md border-t border-beige-muted/80 px-4 py-3 shadow-lg space-y-1.5 shrink-0">
        <button
          type="button"
          onClick={handleAddToCart}
          className="w-full py-3.5 rounded-xl bg-navy hover:bg-navy-charcoal active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-kiosk border border-navy transition-all"
        >
          <ShoppingBag className="w-4 h-4 text-white" />
          <span>ADD TO CART • ₹{totalPrice}</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('menu')}
          className="w-full py-1.5 text-[11px] font-bold uppercase tracking-wider text-taupe-warm hover:text-navy text-center transition-colors"
        >
          BACK TO MENU
        </button>
      </footer>

    </div>
  );
};
