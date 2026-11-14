import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import './CustomizationScreen.css';
import { KioskHeader } from '../components/KioskHeader';
import { MilkVisualization, resolveMilkKey } from '../components/MilkVisualization';
import { CUSTOMIZATION_OPTIONS, PASTRY_RECOMMENDATIONS, PRODUCTS } from '../data/products';
import { useKiosk } from '../context/KioskContext';
import { useVoiceBarista } from '../context/VoiceBaristaContext';
import { syncCustomizationState } from '../services/api';
import { Plus, Minus, Check, ArrowRight, Sparkles, ShoppingBag, RotateCcw } from 'lucide-react';

export const CustomizationScreen = () => {
  const { selectedProduct, addToCart, addDirectToCart, navigateTo, activeCustomization, syncCustomization } = useKiosk();
  const { sessionId } = useVoiceBarista();

  // Fallback to Cappuccino if directly opened
  const product = selectedProduct || PRODUCTS.find(p => p.id === 'cappuccino') || PRODUCTS[1];

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
