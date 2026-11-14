import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import './CustomizationScreen.css';
import { KioskHeader } from '../components/KioskHeader';
import { MilkVisualization, resolveMilkKey } from '../components/MilkVisualization';
import { ColdDrinkVisualization, resolveColdDrinkRecipe } from '../components/ColdDrinkVisualization';
import { CUSTOMIZATION_OPTIONS, PASTRY_RECOMMENDATIONS, PRODUCTS } from '../data/products';
import { useKiosk } from '../context/KioskContext';
import { useVoiceBarista } from '../context/VoiceBaristaContext';
import { syncCustomizationState } from '../services/api';
import {
  Plus,
  Minus,
  Check,
  Flame,
  Snowflake,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  RotateCcw,
  ChevronLeft
} from 'lucide-react';


/**
 * Accurately determines if a product is an eligible HOT COFFEE product for live visualization.
 * Per requirements:
 * - Eligible products: Hot espresso/filter coffees (Cappuccino, Americano, Latte, Flat White, Espresso Doppio, Mochas, etc.)
 * - Products that must NOT use live visualization:
 *   - Cold Brew (e.g. Classic Cold Brew, Citrus Orange Cold Brew)
 *   - Iced Coffee / Cold coffee drinks (e.g. Vietnamese Shakerato, Classic Cold Coffee, Frappes)
 *   - Other cold beverages (iced teas, juices, milkshakes)
 *   - Hot Chocolate (not coffee)
 *   - Hot teas / Matcha
 *   - Food products (pizzas, sandwiches, bakery)
 */
export const isEligibleHotCoffee = (p) => {
  if (!p) return false;

  // 1. Food products are never coffee visualization
  if (p.mainCategory === 'food' || p.category === 'food' || (p.subcategory && p.subcategory.startsWith('food_'))) {
    return false;
  }

  // 2. Non-coffee beverages & cold drink categories (cold brew, frappes, juices, teas, shakes, matcha)
  if (p.mainCategory === 'beverages' || p.category === 'beverages' || (p.subcategory && p.subcategory.startsWith('bev_'))) {
    return false;
  }

  // 3. Specials / combos / seasonal drinks
  if (p.mainCategory === 'specials' || p.category === 'specials' || (p.subcategory && p.subcategory.startsWith('spec_'))) {
    return false;
  }

  // 4. Hot Chocolate must NOT be classified as coffee
  const id = (p.id || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  if (id === 'hot_chocolate' || name.includes('chocolate') || id.includes('hot_chocolate')) {
    return false;
  }

  // 5. Must NOT be cold or iced drinks (e.g. Vietnamese Shakerato, Cold Brew, Iced Coffee)
  if (
    p.defaultTemperature === 'Iced' ||
    id.includes('cold') ||
    id.includes('iced') ||
    name.includes('cold') ||
    name.includes('iced')
  ) {
    return false;
  }

  // 6. Must be in the coffee category
  const isCoffeeCategory =
    p.mainCategory === 'coffee' ||
    p.category === 'coffee' ||
    (p.subcategory && p.subcategory.startsWith('coffee_'));

  if (!isCoffeeCategory) {
    return false;
  }

  // 7. Must be a hot coffee product (defaultTemperature Hot or supports temperature)
  const isHot = p.defaultTemperature === 'Hot' || p.supportsTemperature;

  return Boolean(isHot);
};

/**
 * Accurately determines if a product is an eligible COLD BEVERAGE for the 3D transparent glass visualization.
 * Supports all cold coffees, cold brews, milkshakes, iced teas, lemonades, juices and iced matchas.
 */
export const isEligibleColdBeverage = (p) => {
  if (!p) return false;

  // 1. Food products are never cold beverage visualization
  if (p.mainCategory === 'food' || p.category === 'food' || (p.subcategory && p.subcategory.startsWith('food_'))) {
    return false;
  }

  // 2. Hot coffee products use MilkVisualization, never ColdDrinkVisualization
  if (isEligibleHotCoffee(p)) {
    return false;
  }

  // 3. Hot chocolate & hot teas are not cold
  if (p.id === 'hot_chocolate' || p.defaultTemperature === 'Hot') {
    return false;
  }

  // 4. Explicit Iced temperature
  if (p.defaultTemperature === 'Iced') {
    return true;
  }

  // 5. Cold beverage subcategories
  const subcat = (p.subcategory || '').toLowerCase();
  if (
    subcat.includes('cold_brew') ||
    subcat.includes('frappe') ||
    subcat.includes('milkshake') ||
    subcat.includes('iced_tea') ||
    subcat.includes('juice')
  ) {
    return true;
  }

  // 6. Name / ID identification
  const text = ((p.id || '') + ' ' + (p.name || '')).toLowerCase();
  if (
    text.includes('cold brew') ||
    text.includes('cold coffee') ||
    text.includes('iced') ||
    text.includes('frappe') ||
    text.includes('milkshake') ||
    text.includes('shake') ||
    text.includes('shakerato') ||
    text.includes('juice') ||
    text.includes('lemonade')
  ) {
    return true;
  }

  return false;
};

/**
 * Backwards compatibility helper alias
 */
export const isCoffeeProduct = isEligibleHotCoffee;

/**
 * =========================================================================
 * 1. HOT COFFEE CUSTOMIZATION VIEW (Live MilkCraft Cup & Voice Barista)
 * =========================================================================
 */
const CoffeeCustomizationView = ({ product: propProduct, addToCart: propAddToCart, addDirectToCart: propAddDirectToCart, navigateTo: propNavigateTo }) => {
  const { selectedProduct, addToCart: kioskAddToCart, addDirectToCart: kioskAddDirectToCart, navigateTo: kioskNavigateTo, activeCustomization, syncCustomization } = useKiosk();
  const { sessionId } = useVoiceBarista();

  const addToCart = propAddToCart || kioskAddToCart;
  const addDirectToCart = propAddDirectToCart || kioskAddDirectToCart;
  const navigateTo = propNavigateTo || kioskNavigateTo;

  // Fallback to propProduct, selectedProduct, or Cappuccino if directly opened
  const product = propProduct || selectedProduct || PRODUCTS.find(p => p.id === 'cappuccino') || PRODUCTS[1];


  // Determine if drink is Cold Coffee or Hot Cappuccino
  const isColdCoffee = useMemo(() => {
    const id = (product.id || '').toLowerCase();
    const name = (product.name || '').toLowerCase();
    return (
      id.includes('cold') ||
      id.includes('iced') ||
      name.includes('cold') ||
      name.includes('iced') ||
      product.defaultTemperature === 'Iced'
    );
  }, [product]);

  // Standard 4-Step Customization Sequence:
  // 1. Cup Size, 2. Strength, 3. Milk, 4. Sweetness
  const STEPS = [
    {
      key: 'size',
      stepNum: 1,
      label: 'Cup Size',
      question: 'Which cup size would you prefer today?',
      hint: 'Choose your preferred volume'
    },
    {
      key: 'strength',
      stepNum: 2,
      label: 'Strength',
      question: 'How bold would you like your espresso shot?',
      hint: 'Arabica espresso extraction'
    },
    {
      key: 'milk',
      stepNum: 3,
      label: 'Milk',
      question: 'Which type of milk shall I steam for you?',
      hint: 'Fresh dairy or artisanal plant milks'
    },
    {
      key: 'sweetness',
      stepNum: 4,
      label: 'Sweetness',
      question: 'What sweetness level suits your taste?',
      hint: 'Standard café recipe or customized sugar'
    }
  ];

  // Primary Customization State Bound to Canonical Context
  const [displayedStepIndex, setDisplayedStepIndex] = useState(() => activeCustomization?.stepIndex ?? 0);
  const [isConfirmedReview, setIsConfirmedReview] = useState(() => !!activeCustomization?.pendingConfirmation);
  const [transitionPhase, setTransitionPhase] = useState('idle'); // 'idle' | 'holding' | 'fading_out' | 'fading_in'

  const activeStep = STEPS[displayedStepIndex] || STEPS[0];

  const size = activeCustomization?.size ?? 'Regular';
  const strength = activeCustomization?.strength ?? 'Double Shot';
  const milk = activeCustomization?.milk ?? 'Regular';
  const sugar = activeCustomization?.sugar ?? 'Regular Sugar';
  const pourTrigger = activeCustomization?.pourTrigger ?? 0;
  const quantity = activeCustomization?.quantity ?? 1;

  // Timers and mount tracking for controlled transitions
  const holdTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastProcessedVoiceTimestampRef = useRef(null);
  const lastProductIdRef = useRef(product?.id);

  const cancelPendingTransition = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cancelPendingTransition();
    };
  }, [cancelPendingTransition]);

  // Cancel transitions if product changes
  useEffect(() => {
    if (product?.id && product.id !== lastProductIdRef.current) {
      lastProductIdRef.current = product.id;
      cancelPendingTransition();
      setDisplayedStepIndex(activeCustomization?.stepIndex ?? 0);
      setIsConfirmedReview(false);
      setTransitionPhase('idle');
    }
  }, [product?.id, activeCustomization?.stepIndex, cancelPendingTransition]);

  // Voice Selection Smooth Transition Coordination
  // Phase 1: Option immediately lights up with selected state on the current question
  // Phase 2: Confirmation hold (~800ms) keeps question visible and selected option readable
  // Phase 3: Smooth fade out (250ms) -> update displayed step -> smooth fade in (250ms)
  useEffect(() => {
    const isVoice = !!activeCustomization?.isVoiceSelection;
    const voiceTimestamp = activeCustomization?.voiceTimestamp;
    const targetStepIndex = activeCustomization?.stepIndex ?? 0;
    const isPendingConfirm = !!activeCustomization?.pendingConfirmation;

    if (isVoice && voiceTimestamp && voiceTimestamp !== lastProcessedVoiceTimestampRef.current) {
      lastProcessedVoiceTimestampRef.current = voiceTimestamp;

      const shouldAdvanceStep = targetStepIndex !== displayedStepIndex;
      const shouldTransitionToConfirm = isPendingConfirm && !isConfirmedReview;

      if (shouldAdvanceStep || shouldTransitionToConfirm) {
        cancelPendingTransition();
        setTransitionPhase('holding');

        const prefersReducedMotion = typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const fadeDuration = prefersReducedMotion ? 0 : 250;
        const holdDuration = 800;

        holdTimerRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          setTransitionPhase('fading_out');

          fadeTimerRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            setDisplayedStepIndex(targetStepIndex);
            if (isPendingConfirm) {
              setIsConfirmedReview(true);
            }
            setTransitionPhase('fading_in');

            fadeTimerRef.current = setTimeout(() => {
              if (!isMountedRef.current) return;
              setTransitionPhase('idle');
            }, fadeDuration);
          }, fadeDuration);
        }, holdDuration);
      }
    } else if (!isVoice) {
      // Direct touch or programmatic synchronization when idle
      if (activeCustomization?.stepIndex !== undefined &&
          activeCustomization.stepIndex !== displayedStepIndex &&
          transitionPhase === 'idle') {
        setDisplayedStepIndex(activeCustomization.stepIndex);
      }
      if (activeCustomization?.pendingConfirmation !== undefined &&
          activeCustomization.pendingConfirmation !== isConfirmedReview &&
          transitionPhase === 'idle') {
        setIsConfirmedReview(activeCustomization.pendingConfirmation);
      }
    }
  }, [
    activeCustomization?.isVoiceSelection,
    activeCustomization?.voiceTimestamp,
    activeCustomization?.stepIndex,
    activeCustomization?.pendingConfirmation,
    displayedStepIndex,
    isConfirmedReview,
    transitionPhase,
    cancelPendingTransition,
  ]);

  // Available Sizes: exact independent prices from photographs
  // If product does not list Large, never display an invented large option
  const availableSizes = useMemo(() => {
    if (product.largePrice != null && product.largePrice > product.price) {
      const diff = product.largePrice - product.price;
      return [
        { id: 'Regular', label: 'Regular', sizeMl: 'Standard Cup (240ml)', priceDiff: 0 },
        { id: 'Large', label: 'Large', sizeMl: 'Large Cup (350ml)', priceDiff: diff }
      ];
    }
    return [
      { id: 'Regular', label: 'Regular', sizeMl: 'Standard Cup (240ml)', priceDiff: 0 }
    ];
  }, [product]);

  // Reset size if current selection is not available for this product
  useEffect(() => {
    if (!availableSizes.find(s => s.id === size)) {
      syncCustomization({ size: 'Regular' });
    }
  }, [availableSizes, size, syncCustomization]);

  // Available Strengths
  const STRENGTH_OPTIONS = [
    { id: 'Single Shot', label: 'Single Shot', desc: 'Smooth & balanced Arabica', priceDiff: 0 },
    { id: 'Double Shot', label: 'Double Shot', desc: 'Bold crema punch', priceDiff: 50 }
  ];

  // Unit Price Calculation
  const unitPrice = useMemo(() => {
    let base = product.price;

    if (size === 'Large' && product.largePrice != null) {
      base = product.largePrice;
    }

    if (strength === 'Double Shot') {
      base += 50;
    }

    const milkConfig = CUSTOMIZATION_OPTIONS.milks.find(m => m.id === milk || m.label === milk);
    if (milkConfig) base += milkConfig.priceDiff;

    return base;
  }, [product.price, product.largePrice, size, strength, milk]);

  const totalPrice = unitPrice * quantity;

  // Sync touch selection changes to backend canonical session
  const handleSelectSize = (newSize) => {
    cancelPendingTransition();
    setTransitionPhase('idle');
    syncCustomization({ size: newSize, isVoiceSelection: false });
    if (sessionId) {
      syncCustomizationState({
        sessionId,
        stepIndex: displayedStepIndex,
        size: newSize,
        strength,
        milk,
        sugar,
        quantity,
      });
    }
  };

  const handleSelectStrength = (newStrength) => {
    cancelPendingTransition();
    setTransitionPhase('idle');
    syncCustomization({ strength: newStrength, isVoiceSelection: false });
    if (sessionId) {
      syncCustomizationState({
        sessionId,
        stepIndex: displayedStepIndex,
        size,
        strength: newStrength,
        milk,
        sugar,
        quantity,
      });
    }
  };

  const handleSelectMilk = (newMilk) => {
    cancelPendingTransition();
    setTransitionPhase('idle');
    syncCustomization({ milk: newMilk, isVoiceSelection: false });
    if (sessionId) {
      syncCustomizationState({
        sessionId,
        stepIndex: displayedStepIndex,
        size,
        strength,
        milk: newMilk,
        sugar,
        quantity,
      });
    }
  };

  const handleSelectSugar = (newSugar) => {
    cancelPendingTransition();
    setTransitionPhase('idle');
    syncCustomization({ sugar: newSugar, isVoiceSelection: false });
    if (sessionId) {
      syncCustomizationState({
        sessionId,
        stepIndex: displayedStepIndex,
        size,
        strength,
        milk,
        sugar: newSugar,
        quantity,
      });
    }
  };

  const handleStepJump = (idx) => {
    cancelPendingTransition();
    setDisplayedStepIndex(idx);
    setIsConfirmedReview(false);
    setTransitionPhase('idle');
    syncCustomization({ stepIndex: idx, isVoiceSelection: false });
    if (sessionId) {
      syncCustomizationState({
        sessionId,
        stepIndex: idx,
        size,
        strength,
        milk,
        sugar,
        quantity,
      });
    }
  };

  const handleNextCard = () => {
    cancelPendingTransition();
    if (displayedStepIndex < STEPS.length - 1) {
      const nextIdx = displayedStepIndex + 1;
      setDisplayedStepIndex(nextIdx);
      setIsConfirmedReview(false);
      setTransitionPhase('idle');
      syncCustomization({ stepIndex: nextIdx, isVoiceSelection: false });
      if (sessionId) {
        syncCustomizationState({
          sessionId,
          stepIndex: nextIdx,
          size,
          strength,
          milk,
          sugar,
          quantity,
        });
      }
    } else {
      setIsConfirmedReview(true);
      setTransitionPhase('idle');
      syncCustomization({ pendingConfirmation: true, isVoiceSelection: false });
      if (sessionId) {
        syncCustomizationState({
          sessionId,
          stepIndex: displayedStepIndex,
          size,
          strength,
          milk,
          sugar,
          quantity,
          pendingConfirmation: true,
        });
      }
    }
  };

  const handleQuantityChange = (newQty) => {
    const safeQty = Math.max(1, newQty);
    syncCustomization({ quantity: safeQty, isVoiceSelection: false });
    if (sessionId) {
      syncCustomizationState({
        sessionId,
        stepIndex: displayedStepIndex,
        size,
        strength,
        milk,
        sugar,
        quantity: safeQty,
      });
    }
  };

  // Handle Add to Cart
  const handleAddToCart = () => {
    const customizationsSummary = [
      `${size} (${size === 'Large' ? '350 ml' : '240 ml'})`,
      strength,
      `${milk} Milk`,
      sugar
    ].filter(Boolean);

    const configuredItem = {
      cartId: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice,
      quantity,
      size,
      temperature: isColdCoffee ? 'Iced' : 'Hot',
      milk,
      sugar,
      strength,
      totalPrice,
      customizationsSummary
    };

    addToCart(configuredItem);
    navigateTo('menu');
  };

  return (
    <div className="customization-screen w-full h-full bg-[#F8F5EE] flex flex-col justify-between select-none overflow-hidden font-sans">
      
      {/* =========================================================================
          1. HEADER (Existing Third Wave Coffee Header)
          ========================================================================= */}
      <KioskHeader
        title="Customisation"
        subtitle={product.name}
        showBack={true}
        showCart={true}
        onBackOverride={() => navigateTo('menu')}
      />

      {/* Main Responsive Viewport: Distributes expanded coffee visualization and moves content downward */}
      <main className="customization-screen__main flex-1 min-h-0 px-3 sm:px-4 pt-1 pb-1 overflow-y-auto flex flex-col justify-between">
        
        {/* =========================================================================
            2. EXPANDED COFFEE PREPARATION SCENE
            - Consumes all remaining vertical screen height
            - Original cup remains in upper position with natural proportions
            - Extended marble table & café background fills previously empty region
            - Floating AI Cashier card shifted downward into the extended scene
            - Existing Quantity UI positioned directly below AI Cashier card
            ========================================================================= */}
        <div className="customization-screen__vis-container flex-1 min-h-[500px] sm:min-h-[540px] w-full flex flex-col mb-1.5">
          <MilkVisualization
            drinkStyle={isColdCoffee ? 'cold' : 'cappuccino'}
            stepKey={activeStep.key}
            isReady={displayedStepIndex === 3 && isConfirmedReview}
            selectedMilk={milk}
            size={size}
            strength={strength}
            sweetness={sugar}
            pourTrigger={pourTrigger}
            productImage={product.image}
            productName={product.name}
            unitPrice={unitPrice}
            className="flex-1 w-full h-full"
          >
            {/* FLOATING AI CASHIER CARD (Shifted slightly down into extended table area) */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-white/80 shadow-[0_8px_30px_rgba(28,42,57,0.12)] space-y-2.5 transition-all duration-300">
              
              {/* Card Header: Step Indicator & Step Jump Dots */}
              <div className="flex items-center justify-between border-b border-navy/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-navy text-white text-[10px] font-black uppercase tracking-wider">
                    {activeStep.stepNum}/4
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-taupe-warm">
                    AI Cashier • {activeStep.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {STEPS.map((st, idx) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => handleStepJump(idx)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        displayedStepIndex === idx
                          ? 'w-6 bg-navy shadow-xs'
                          : displayedStepIndex > idx
                          ? 'w-2 bg-emerald-600'
                          : 'w-2 bg-beige-muted/70 hover:bg-beige-dark'
                      }`}
                      title={`Step ${idx + 1}: ${st.label}`}
                    />
                  ))}
                </div>
              </div>

              {/* Step Question and Options Body Wrapped for Smooth Transition */}
              <div
                className={`customization-step-content ${
                  transitionPhase === 'fading_out'
                    ? 'customization-step-content--fading-out'
                    : transitionPhase === 'fading_in'
                    ? 'customization-step-content--fading-in'
                    : transitionPhase === 'holding'
                    ? 'customization-step-content--confirming'
                    : ''
                }`}
              >
                {/* Conversational AI Question */}
              <div>
                <h3 className="text-xs sm:text-sm font-black text-navy leading-snug">
                  {activeStep.question}
                </h3>
                <span className="text-[9.5px] text-taupe-warm font-medium">
                  {activeStep.hint}
                </span>
              </div>

              {/* Selection Options Body */}
              <div>
                {/* Step 1: Cup Size */}
                {activeStep.key === 'size' && (
                  <div className={`grid ${availableSizes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                    {availableSizes.map((s) => {
                      const isSelected = size === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectSize(s.id)}
                          className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border-2 transition-all cursor-pointer active:scale-98 ${
                            isSelected
                              ? 'bg-beige border-navy text-navy font-black shadow-sm ring-1 ring-navy/20'
                              : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold hover:border-beige-dark'
                          }`}
                        >
                          <div className="text-left">
                            <span className="text-xs font-black block">{s.label}</span>
                            <span className="text-[8.5px] text-taupe-warm font-medium">{s.sizeMl}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {s.priceDiff > 0 && (
                              <span className="text-[9px] font-bold bg-white px-1.5 py-0.5 rounded text-navy border border-beige-muted">
                                +₹{s.priceDiff}
                              </span>
                            )}
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-navy bg-navy text-white' : 'border-beige-dark'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Step 2: Strength */}
                {activeStep.key === 'strength' && (
                  <div className="grid grid-cols-2 gap-2">
                    {STRENGTH_OPTIONS.map((st) => {
                      const isSelected = strength === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSelectStrength(st.id)}
                          className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border-2 transition-all cursor-pointer active:scale-98 ${
                            isSelected
                              ? 'bg-beige border-navy text-navy font-black shadow-sm ring-1 ring-navy/20'
                              : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold hover:border-beige-dark'
                          }`}
                        >
                          <div className="text-left">
                            <span className="text-xs font-black block">{st.label}</span>
                            <span className="text-[8.5px] text-taupe-warm font-medium">{st.desc}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {st.priceDiff > 0 && (
                              <span className="text-[9px] font-bold bg-white px-1.5 py-0.5 rounded text-navy border border-beige-muted">
                                +₹{st.priceDiff}
                              </span>
                            )}
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-navy bg-navy text-white' : 'border-beige-dark'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Step 3: Milk Selection */}
                {activeStep.key === 'milk' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {CUSTOMIZATION_OPTIONS.milks.map((m) => {
                      const isSelected = resolveMilkKey(milk) === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectMilk(m.id)}
                          className={`p-2 rounded-xl border-2 text-left transition-all cursor-pointer active:scale-98 ${
                            isSelected
                              ? 'bg-beige border-navy text-navy font-black shadow-sm ring-1 ring-navy/20'
                              : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold hover:border-beige-dark'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-extrabold truncate">{m.id}</span>
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-navy bg-navy text-white' : 'border-beige-dark'
                            }`}>
                              {isSelected && <Check className="w-2 h-2" />}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[9.5px]">
                            <span className="text-navy font-bold">
                              {m.priceDiff === 0 ? 'Free' : `+₹${m.priceDiff}`}
                            </span>
                            <span className="text-[8px] text-taupe-warm font-medium truncate">
                              {m.tag}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Step 4: Sweetness */}
                {activeStep.key === 'sweetness' && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {CUSTOMIZATION_OPTIONS.sugar.map((sug) => {
                      const isSelected = sugar === sug.label;
                      return (
                        <button
                          key={sug.id}
                          type="button"
                          onClick={() => handleSelectSugar(sug.label)}
                          className={`p-2 rounded-xl border-2 text-center transition-all cursor-pointer active:scale-98 ${
                            isSelected
                              ? 'bg-beige border-navy text-navy font-black shadow-sm ring-1 ring-navy/20'
                              : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold hover:border-beige-dark'
                          }`}
                        >
                          <span className="text-[11px] font-black block">{sug.id}</span>
                          <span className="text-[8.5px] text-taupe-warm block">{sug.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* Continue / Next Button */}
              <div className="pt-0.5">
                {displayedStepIndex < 3 ? (
                  <button
                    type="button"
                    onClick={handleNextCard}
                    className="w-full py-2.5 rounded-xl bg-navy text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:bg-navy-charcoal transition-all active:scale-99"
                  >
                    <span>Continue to {STEPS[displayedStepIndex + 1].label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : isConfirmedReview ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                    <span className="text-[10.5px] font-extrabold text-emerald-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Ready to Add to Cart!</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStepJump(0)}
                      className="text-[10px] font-bold text-taupe-warm hover:text-navy cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Change</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleNextCard}
                    className="w-full py-2.5 rounded-xl bg-navy text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:bg-navy-charcoal transition-all active:scale-99"
                  >
                    <span>Review Customisation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

            </div>
          </div>

            {/* EXISTING QUANTITY UI (Positioned inside the extended scene, directly below the card) */}
            <div className="bg-white/95 backdrop-blur-md rounded-xl p-2.5 px-3 border border-white/80 shadow-md flex items-center justify-between mt-2">
              <span className="text-xs font-black uppercase tracking-wider text-navy">
                Quantity
              </span>

              <div className="flex items-center gap-3 bg-cream-100 rounded-lg border border-beige-muted p-1">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1}
                  className="w-7 h-7 rounded-md bg-white text-navy flex items-center justify-center hover:bg-cream-200 disabled:opacity-40 transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <span className="text-sm font-black text-navy w-4 text-center font-sans">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={() => handleQuantityChange(quantity + 1)}
                  className="w-7 h-7 rounded-md bg-white text-navy flex items-center justify-center hover:bg-cream-200 transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </MilkVisualization>
        </div>

        {/* =========================================================================
            3. PAIRS WELL WITH RECOMMENDATIONS
            Positioned immediately below the expanded visualization with minimal gap,
            sitting right above the fixed Add to Cart bar.
            ========================================================================= */}
        <div className="customization-screen__pairs-section shrink-0 pt-0.5 pb-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-taupe-warm font-sans">
              Pairs Well With
            </span>
            <span className="text-[10px] text-taupe-warm font-medium">
              Barista pairing
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PASTRY_RECOMMENDATIONS.slice(0, 2).map((pastry) => (
              <div
                key={pastry.id}
                className="bg-white rounded-2xl p-2.5 border border-beige-muted/80 shadow-sm flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={pastry.image}
                    alt={pastry.name}
                    className="w-10 h-10 rounded-xl object-cover border border-beige-muted shrink-0"
                  />
                  <div className="truncate">
                    <span className="text-[11px] font-black text-navy truncate block">
                      {pastry.name}
                    </span>
                    <span className="text-[10px] font-extrabold text-navy">
                      ₹{pastry.price}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => addDirectToCart(pastry)}
                  className="w-7 h-7 rounded-lg bg-cream-100 hover:bg-cream-200 border border-beige-muted text-navy flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                  title={`Add ${pastry.name}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* =========================================================================
          4. FIXED ADD TO CART BUTTON
          ========================================================================= */}
      <footer className="customization-screen__bottom-bar">
        <button
          type="button"
          onClick={handleAddToCart}
          className="customization-screen__add-btn"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Add to Cart • ₹{totalPrice}</span>
        </button>
      </footer>

    </div>
  );
};


/**
 * =========================================================================
 * 2. 3D COLD DRINK CUSTOMIZATION VIEW (Tall Transparent Glass Experience)
 * =========================================================================
 */
const ColdDrinkCustomizationView = ({ product, addToCart, addDirectToCart, navigateTo }) => {
  const recipe = useMemo(() => resolveColdDrinkRecipe(product), [product]);

  // Available Sizes for Cold Drinks
  const availableSizes = useMemo(() => {
    if (product.largePrice != null && product.largePrice > product.price) {
      const diff = product.largePrice - product.price;
      return [
        { id: 'Regular', label: 'Regular', sizeMl: 'Regular Glass (350ml)', priceDiff: 0 },
        { id: 'Large', label: 'Large', sizeMl: 'Large Glass (475ml)', priceDiff: diff }
      ];
    }
    return [
      { id: 'Regular', label: 'Regular', sizeMl: 'Regular Glass (350ml)', priceDiff: 0 }
    ];
  }, [product]);

  // Ice Level Options (Cold drinks with ice only)
  const ICE_OPTIONS = [
    { id: 'Light Ice', label: 'Light Ice', desc: 'Less ice, maximum drink' },
    { id: 'Regular Ice', label: 'Regular Ice', desc: 'Standard café recipe' },
    { id: 'Extra Ice', label: 'Extra Ice', desc: 'Extra chilled & crisp' }
  ];

  // Dynamic Step Sequence Tailored Strictly to Product Recipe & Metadata
  const STEPS = useMemo(() => {
    const list = [];

    // Step: Glass Size (only if product offers multiple sizes)
    if (availableSizes.length > 1) {
      list.push({
        key: 'size',
        label: 'Glass Size',
        question: 'Which glass size would you prefer today?',
        hint: 'Choose your preferred volume'
      });
    }

    // Step: Choice of Milk (only if product is customizable AND recipe contains milk)
    if (product.customizable && recipe.hasMilk) {
      list.push({
        key: 'milk',
        label: 'Milk Choice',
        question: 'Which milk shall I blend into your cold drink?',
        hint: 'Fresh dairy or artisanal plant milks'
      });
    }

    // Step: Sweetness Level (only if product is customizable)
    if (product.customizable) {
      list.push({
        key: 'sweetness',
        label: 'Sweetness',
        question: 'What sweetness level suits your taste?',
        hint: 'Standard café recipe or customized sugar'
      });
    }

    // Fallback if no customizable options (e.g. single-size cold-pressed juice)
    if (list.length === 0) {
      list.push({
        key: 'ready',
        label: 'Signature Serve',
        question: 'Crafted fresh upon order',
        hint: 'Chilled in our signature tall glass'
      });
    }

    return list.map((step, idx) => ({ ...step, stepNum: idx + 1 }));
  }, [availableSizes.length, recipe.hasMilk, product.customizable]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const activeStep = STEPS[currentStepIndex] || STEPS[0];

  // State Selections
  const [size, setSize] = useState('Regular');
  const [iceLevel, setIceLevel] = useState('Regular Ice');
  const [milk, setMilk] = useState('Regular');
  const [sugar, setSugar] = useState('Regular Sugar');
  const [pourTrigger, setPourTrigger] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Unit Price Calculation
  const unitPrice = useMemo(() => {
    let base = product.price;

    if (size === 'Large' && product.largePrice != null) {
      base = product.largePrice;
    } else if (size === 'Large') {
      base += 40;
    }

    if (product.customizable && recipe.hasMilk) {
      const milkConfig = CUSTOMIZATION_OPTIONS.milks.find(m => m.id === milk || m.label === milk);
      if (milkConfig) base += milkConfig.priceDiff;
    }

    return base;
  }, [product.price, product.largePrice, product.customizable, recipe.hasMilk, size, milk]);

  const totalPrice = unitPrice * quantity;

  // Handle Add to Cart
  const handleAddToCart = () => {
    const customizationsSummary = [
      availableSizes.length > 1 ? `${size} (${size === 'Large' ? '475 ml' : '350 ml'})` : null,
      recipe.hasIce ? iceLevel : null,
      (product.customizable && recipe.hasMilk) ? `${milk} Milk` : null,
      product.customizable ? sugar : null
    ].filter(Boolean);

    const configuredItem = {
      cartId: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice,
      quantity,
      size,
      temperature: 'Iced',
      milk: (product.customizable && recipe.hasMilk) ? milk : null,
      sugar: product.customizable ? sugar : null,
      iceLevel: recipe.hasIce ? iceLevel : null,
      totalPrice,
      customizationsSummary
    };

    addToCart(configuredItem);
    navigateTo('menu');
  };

  const handleNextCard = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setPourTrigger(prev => prev + 1);
    } else {
      handleAddToCart();
    }
  };

  const handlePrevCard = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setPourTrigger(prev => prev + 1);
    } else {
      navigateTo('menu');
    }
  };

  const sugarOptions = useMemo(() => {
    return CUSTOMIZATION_OPTIONS.sugar || CUSTOMIZATION_OPTIONS.sugars || [
      { id: 'No Sugar', label: 'No Sugar', desc: '0% Added' },
      { id: 'Less Sugar', label: 'Less Sugar', desc: '50% Sweetness' },
      { id: 'Regular Sugar', label: 'Regular Sugar', desc: 'Standard Café Recipe' }
    ];
  }, []);

  return (
    <div className="customization-screen w-full h-full bg-cream-100 flex flex-col justify-between select-none overflow-hidden">

      {/* Header */}
      <KioskHeader
        title="Customisation"
        subtitle={product.name}
        showBack={true}
        showCart={true}
        onBackOverride={handlePrevCard}
      />

      {/* Main Container */}
      <main className="customization-screen__main flex-1 p-3 flex flex-col justify-between overflow-hidden">

        {/* 1. 3D Cold Drink Preparation Scene */}
        <div className="customization-screen__vis-container">
          <ColdDrinkVisualization
            product={product}
            currentStep={activeStep.stepNum}
            totalSteps={STEPS.length}
            stepKey={activeStep.key}
            size={size}
            iceLevel={iceLevel}
            selectedMilk={milk}
            sweetness={sugar}
            pourTrigger={pourTrigger}
            productName={product.name}
            unitPrice={unitPrice}
            className="w-full flex-1"
          >
            {/* 2. Floating AI Cashier Customization Card */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-white/80 shadow-lg space-y-2.5">

              {/* Card Header & Step Tracker */}
              <div className="flex items-center justify-between border-b border-beige-muted/60 pb-2">
                <div className="flex items-center gap-1.5">
                  {currentStepIndex > 0 && (
                    <button
                      type="button"
                      onClick={handlePrevCard}
                      className="p-1 -ml-1 rounded-lg hover:bg-cream-200 text-navy transition-all active:scale-95 cursor-pointer"
                      title="Previous Step"
                      aria-label="Previous step"
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-navy text-white text-[10px] font-black tracking-wide font-sans">
                    {activeStep.stepNum}/{STEPS.length}
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-navy">
                    AI CASHIER • {activeStep.label}
                  </span>
                </div>

                {/* Step indicator dots */}
                <div className="flex items-center gap-1.5">
                  {STEPS.map((s, idx) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setCurrentStepIndex(idx);
                        setPourTrigger(p => p + 1);
                      }}
                      title={`Go to ${s.label}`}
                      aria-label={`Go to ${s.label}`}
                      className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                        idx === currentStepIndex
                          ? 'w-5 bg-navy shadow-xs'
                          : idx < currentStepIndex
                          ? 'w-2 bg-emerald-600 hover:bg-emerald-700'
                          : 'w-2 bg-beige-muted hover:bg-beige-dark'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Card Question */}
              <div>
                <h4 className="text-xs font-black text-navy leading-snug">
                  {activeStep.question}
                </h4>
                <p className="text-[10px] text-taupe-warm font-medium">
                  {activeStep.hint}
                </p>
              </div>

              {/* Step Options Area */}
              <div className="min-h-[64px] flex flex-col justify-center">

                {/* STEP: GLASS SIZE */}
                {activeStep.key === 'size' && (
                  <div className="grid grid-cols-2 gap-2">
                    {availableSizes.map((sz) => {
                      const isSelected = size === sz.id;
                      return (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => {
                            setSize(sz.id);
                            setPourTrigger(p => p + 1);
                          }}
                          className={`p-2.5 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer active:scale-98 ${
                            isSelected
                              ? 'bg-beige border-navy text-navy font-black shadow-sm ring-1 ring-navy/20'
                              : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold hover:border-beige-dark'
                          }`}
                        >
                          <div className="text-left">
                            <span className="text-xs font-black block">{sz.label}</span>
                            <span className="text-[9px] text-taupe-warm font-medium">{sz.sizeMl}</span>
                          </div>
                          {sz.priceDiff > 0 && (
                            <span className="text-[10px] font-bold text-taupe-warm">
                              +₹{sz.priceDiff}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* STEP: ICE LEVEL */}
                {activeStep.key === 'ice' && (
                  <div className="grid grid-cols-3 gap-2">
                    {ICE_OPTIONS.map((opt) => {
                      const isSelected = iceLevel === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setIceLevel(opt.id);
                            setPourTrigger(p => p + 1);
                          }}
                          className={`p-2 rounded-xl border-2 text-center transition-all cursor-pointer active:scale-98 ${
                            isSelected
                              ? 'bg-beige border-navy text-navy font-black shadow-sm ring-1 ring-navy/20'
                              : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold hover:border-beige-dark'
                          }`}
                        >
                          <span className="text-[11px] font-black block">{opt.label}</span>
                          <span className="text-[8.5px] text-taupe-warm block">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* STEP: MILK */}
                {activeStep.key === 'milk' && (
                  <div className="grid grid-cols-5 gap-1.5">
                    {CUSTOMIZATION_OPTIONS.milks.map((m) => {
                      const isSelected = milk === m.label || milk === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setMilk(m.label);
                            setPourTrigger(p => p + 1);
                          }}
                          className={`p-1.5 py-2 rounded-xl border-2 flex flex-col items-center justify-between text-center transition-all cursor-pointer active:scale-98 ${
                            isSelected
                              ? 'bg-beige border-navy text-navy font-black shadow-sm ring-1 ring-navy/20'
                              : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold hover:border-beige-dark'
                          }`}
                        >
                          <span className="text-[10.5px] font-black truncate w-full block">
                            {m.id}
                          </span>
                          <span className="text-[8.5px] text-taupe-warm block mt-0.5">
                            {m.priceDiff > 0 ? `+₹${m.priceDiff}` : 'Free'}
                          </span>
                          <div className={`w-3.5 h-3.5 mt-1 rounded-full border flex items-center justify-center ${
                            isSelected ? 'bg-navy border-navy text-white' : 'border-beige-muted bg-white'
                          }`}>
                            {isSelected && <Check className="w-2 h-2 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* STEP: SWEETNESS */}
                {activeStep.key === 'sweetness' && (
                  <div className="grid grid-cols-3 gap-2">
                    {sugarOptions.map((sug) => {
                      const isSelected = sugar === sug.label || sugar === sug.id;
                      return (
                        <button
                          key={sug.id}
                          type="button"
                          onClick={() => {
                            setSugar(sug.label);
                            setPourTrigger(p => p + 1);
                          }}
                          className={`p-2 rounded-xl border-2 text-center transition-all cursor-pointer active:scale-98 ${
                            isSelected
                              ? 'bg-beige border-navy text-navy font-black shadow-sm ring-1 ring-navy/20'
                              : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold hover:border-beige-dark'
                          }`}
                        >
                          <span className="text-[11px] font-black block">{sug.id}</span>
                          <span className="text-[8.5px] text-taupe-warm block">{sug.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* STEP: READY FALLBACK */}
                {activeStep.key === 'ready' && (
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center">
                    <span className="text-xs font-black text-emerald-800">
                      Signature Café Cold Recipe
                    </span>
                    <p className="text-[10px] text-emerald-700 mt-0.5">
                      Served chilled in a tall transparent tumbler
                    </p>
                  </div>
                )}

              </div>

              {/* Continue / Next Button */}
              <div className="pt-0.5">
                {currentStepIndex < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNextCard}
                    className="w-full py-2.5 rounded-xl bg-navy text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:bg-navy-charcoal transition-all active:scale-99"
                  >
                    <span>Continue to {STEPS[currentStepIndex + 1].label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                    <span className="text-[10.5px] font-extrabold text-emerald-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Ready to Add to Cart!</span>
                    </span>
                    {STEPS.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCurrentStepIndex(0)}
                        className="text-[10px] font-bold text-taupe-warm hover:text-navy cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Change</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Quantity Selector inside extended scene */}
            <div className="bg-white/95 backdrop-blur-md rounded-xl p-2.5 px-3 border border-white/80 shadow-md flex items-center justify-between mt-2">
              <span className="text-xs font-black uppercase tracking-wider text-navy">
                Quantity
              </span>

              <div className="flex items-center gap-3 bg-cream-100 rounded-lg border border-beige-muted p-1">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-7 h-7 rounded-md bg-white text-navy flex items-center justify-center hover:bg-cream-200 disabled:opacity-40 transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <span className="text-sm font-black text-navy w-4 text-center font-sans">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-7 h-7 rounded-md bg-white text-navy flex items-center justify-center hover:bg-cream-200 transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </ColdDrinkVisualization>
        </div>

        {/* 3. Pairs Well With Recommendations */}
        <div className="customization-screen__pairs-section shrink-0 pt-0.5 pb-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-taupe-warm font-sans">
              Pairs Well With
            </span>
            <span className="text-[10px] text-taupe-warm font-medium">
              Bestseller pairing
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PASTRY_RECOMMENDATIONS.slice(0, 2).map((pastry) => (
              <div
                key={pastry.id}
                className="bg-white rounded-2xl p-2.5 border border-beige-muted/80 shadow-sm flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={pastry.image}
                    alt={pastry.name}
                    className="w-10 h-10 rounded-xl object-cover border border-beige-muted shrink-0"
                  />
                  <div className="truncate">
                    <span className="text-[11px] font-black text-navy truncate block">
                      {pastry.name}
                    </span>
                    <span className="text-[10px] font-extrabold text-navy">
                      ₹{pastry.price}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => addDirectToCart(pastry)}
                  className="w-7 h-7 rounded-lg bg-cream-100 hover:bg-cream-200 border border-beige-muted text-navy flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                  title={`Add ${pastry.name}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* 4. Fixed Add to Cart Button */}
      <footer className="customization-screen__bottom-bar">
        <button
          type="button"
          onClick={handleAddToCart}
          className="customization-screen__add-btn"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Add to Cart • ₹{totalPrice}</span>
        </button>
      </footer>

    </div>
  );
};

/**
 * =========================================================================
 * 3. FOOD & NON-COFFEE CUSTOMIZATION VIEW (Original Product Experience)
 * =========================================================================
 */
const NonCoffeeCustomizationView = ({ product, addToCart, addDirectToCart, navigateTo }) => {
  // Customization state
  const [size, setSize] = useState('Regular');
  const [temperature, setTemperature] = useState(product.defaultTemperature || 'Hot');
  const [milk, setMilk] = useState('Standard Dairy');
  const [sugar, setSugar] = useState('Regular Sugar');
  const [extraShot, setExtraShot] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Derive available sizes: exact independent prices
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

  // Safe sugar options
  const sugarOptions = useMemo(() => {
    return CUSTOMIZATION_OPTIONS.sugar || CUSTOMIZATION_OPTIONS.sugars || [
      { id: 'No Sugar', label: 'No Sugar', desc: '0% Added' },
      { id: 'Less Sugar', label: 'Less Sugar', desc: '50% Sweetness' },
      { id: 'Regular Sugar', label: 'Regular Sugar', desc: 'Standard Café Recipe' }
    ];
  }, []);

  // Unit Price Calculation
  const unitPrice = useMemo(() => {
    let base = product.price;

    // Size add-on
    if (size === 'Large' && product.largePrice != null) {
      base = product.largePrice;
    }

    // Milk add-on (only if product is customizable)
    if (product.customizable) {
      const milkConfig = CUSTOMIZATION_OPTIONS.milks.find(m => m.id === milk || m.label === milk);
      if (milkConfig) base += milkConfig.priceDiff;

      // Extra shot
      if (extraShot) base += CUSTOMIZATION_OPTIONS.extraShotPrice;
    }

    return base;
  }, [product.price, product.largePrice, product.customizable, size, milk, extraShot]);

  const totalPrice = unitPrice * quantity;

  // Handle Add to Cart
  const handleAddToCart = () => {
    const customizationsSummary = [
      availableSizes.length > 1 ? `${size} (${size === 'Large' ? '350 ml' : '240 ml'})` : null,
      product.supportsTemperature ? temperature : null,
      product.customizable ? milk : null,
      product.customizable ? sugar : null,
      (product.customizable && extraShot) ? '+1 Espresso Shot' : null
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
      milk: product.customizable ? milk : null,
      sugar: product.customizable ? sugar : null,
      extraShot: product.customizable ? extraShot : false,
      totalPrice,
      customizationsSummary
    };

    addToCart(configuredItem);
    navigateTo('menu');
  };

  return (
    <div className="customization-screen w-full h-full bg-cream-100 flex flex-col justify-between select-none overflow-hidden">

      {/* Header */}
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
            <span className="text-[10px] uppercase font-bold tracking-wider text-cream-200 block">
              {product.subcategory
                ? product.subcategory.replace(/^(food_|bev_|coffee_)/, '').replace(/_/g, ' ')
                : product.category}
            </span>
            <div className="flex items-center justify-between mt-0.5">
              <h2 className="text-lg font-black tracking-tight leading-tight truncate">
                {product.name}
              </h2>
              <span className="text-base font-black text-amber-200 shrink-0 font-sans">
                ₹{product.price}
              </span>
            </div>
          </div>
        </div>

        {/* Tasting Notes & Description */}
        {(product.notes || product.description) && (
          <div className="bg-white/80 rounded-xl p-2.5 border border-beige-muted/60 space-y-1">
            {product.description && (
              <p className="text-[11px] text-navy/80 leading-relaxed font-medium">
                {product.description}
              </p>
            )}
            {product.notes && product.notes.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {product.notes.map((note, idx) => (
                  <span key={idx} className="customization-screen__note-pill">
                    {note}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Customization Options Panel */}
        <div className="bg-white rounded-2xl p-3 border border-beige-muted/80 shadow-sm space-y-3">

          {/* 1. Size Options (Only if product has size choices) */}
          {availableSizes.length > 1 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-taupe-warm">
                Select Size
              </span>
              <div className="grid grid-cols-2 gap-2">
                {availableSizes.map(sz => (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => setSize(sz.id)}
                    className={`p-2.5 rounded-xl border-2 flex items-center justify-between transition-all ${
                      size === sz.id
                        ? 'bg-beige border-navy text-navy font-black shadow-sm'
                        : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-black block">{sz.label}</span>
                      <span className="text-[10px] text-taupe-warm">{sz.sizeMl}</span>
                    </div>
                    {sz.priceDiff > 0 && (
                      <span className="text-[11px] font-bold text-taupe-warm">
                        +₹{sz.priceDiff}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Temperature Options (Only if product supports temperature) */}
          {product.supportsTemperature && (
            <div className="space-y-1.5 pt-2 border-t border-beige-muted/70">
              <span className="text-[10px] font-black uppercase tracking-wider text-taupe-warm">
                Temperature
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'Hot', icon: Flame, color: 'text-amber-700' },
                  { id: 'Iced', icon: Snowflake, color: 'text-sky-700' }
                ].map(({ id, icon: Icon, color }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTemperature(id)}
                    className={`p-2.5 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      temperature === id
                        ? 'bg-beige border-navy text-navy font-black shadow-sm'
                        : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xs font-black">{id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Choice of Milk (Only if product is customizable) */}
          {product.customizable && (
            <div className="space-y-1.5 pt-2 border-t border-beige-muted/70">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-taupe-warm">
                  Choice of Milk
                </span>
                <span className="text-[10px] font-bold text-taupe-warm">
                  Fresh dairy or artisanal plant
                </span>
              </div>
              <div className="space-y-1.5">
                {CUSTOMIZATION_OPTIONS.milks.map(m => {
                  const isSelected = milk === m.label;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMilk(m.label)}
                      className={`w-full p-2.5 rounded-xl border-2 flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-beige border-navy text-navy font-black shadow-sm'
                          : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-navy bg-navy text-white' : 'border-beige-muted bg-white'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-bold block leading-tight">{m.label}</span>
                          <span className="text-[10px] text-taupe-warm">{m.desc}</span>
                        </div>
                      </div>
                      {m.priceDiff > 0 ? (
                        <span className="text-xs font-bold text-taupe-warm">+₹{m.priceDiff}</span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700">Included</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Extra Espresso Shot (Only if product is customizable) */}
          {product.customizable && (
            <div className="pt-2 border-t border-beige-muted/70">
              <button
                type="button"
                onClick={() => setExtraShot(!extraShot)}
                className={`w-full p-2.5 rounded-xl border-2 flex items-center justify-between transition-all ${
                  extraShot
                    ? 'bg-beige border-navy text-navy font-black shadow-sm'
                    : 'bg-cream-100/60 border-beige-muted text-navy/80 font-bold'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    extraShot ? 'border-navy bg-navy text-white' : 'border-beige-muted'
                  }`}>
                    {extraShot && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold block leading-tight">Extra Espresso Shot</span>
                    <span className="text-[10px] text-taupe-warm">Bold arabica extraction</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-taupe-warm">+₹{CUSTOMIZATION_OPTIONS.extraShotPrice}</span>
              </button>
            </div>
          )}

          {/* 5. Sweetness Level (Only if product is customizable) */}
          {product.customizable && (
            <div className="space-y-1.5 pt-2 border-t border-beige-muted/70">
              <span className="text-[10px] font-black uppercase tracking-wider text-taupe-warm">
                Sweetness Level
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {sugarOptions.map(sug => {
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


/**
 * =========================================================================
 * 4. MAIN EXPORTED COMPONENT (Product Type Dispatcher)
 * =========================================================================
 */
export const CustomizationScreen = () => {
  const { selectedProduct, addToCart, addDirectToCart, navigateTo } = useKiosk();

  // Fallback to Cappuccino if directly opened without a selectedProduct
  const product = selectedProduct || PRODUCTS.find(p => p.id === 'cappuccino') || PRODUCTS[1];

  // 1. Eligible Hot Coffee -> Live MilkVisualization + Voice Barista Integration
  if (isEligibleHotCoffee(product)) {
    return (
      <CoffeeCustomizationView
        product={product}
        addToCart={addToCart}
        addDirectToCart={addDirectToCart}
        navigateTo={navigateTo}
      />
    );
  }

  // 2. Eligible Cold Beverage -> ColdDrinkCustomizationView (3D Cold Drink experience)
  if (isEligibleColdBeverage(product)) {
    return (
      <ColdDrinkCustomizationView
        product={product}
        addToCart={addToCart}
        addDirectToCart={addDirectToCart}
        navigateTo={navigateTo}
      />
    );
  }

  // 3. Other Products (Food, Bakery, Hot Chocolate, Hot Teas) -> NonCoffeeCustomizationView
  return (
    <NonCoffeeCustomizationView
      product={product}
      addToCart={addToCart}
      addDirectToCart={addDirectToCart}
      navigateTo={navigateTo}
    />
  );
};

