import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import './MilkVisualization.css';

/**
 * 5 Milk Variants configuration matching Third Wave Coffee specifications
 */
export const MILK_VARIANTS = {
  Regular: {
    id: 'Regular',
    label: 'Regular Milk',
    tag: 'Fresh Dairy',
    desc: 'Natural fresh white',
    colorHex: '#FAF8F5',
    blendColor: '#c49a6c'
  },
  Skimmed: {
    id: 'Skimmed',
    label: 'Skimmed Milk',
    tag: 'Light & Lean',
    desc: 'Low-fat dairy',
    colorHex: '#EAF0F6',
    blendColor: '#b89066'
  },
  Soy: {
    id: 'Soy',
    label: 'Soy Milk',
    tag: 'Plant Protein',
    desc: 'Creamy warm white',
    colorHex: '#F5EED8',
    blendColor: '#c09565'
  },
  Almond: {
    id: 'Almond',
    label: 'Almond Milk',
    tag: 'Nutty & Light',
    desc: 'Subtle warm beige',
    colorHex: '#ECE0CD',
    blendColor: '#b08354'
  },
  Oat: {
    id: 'Oat',
    label: 'Oat Milk',
    tag: 'Barista Blend',
    desc: 'Soft velvety creamy ivory',
    colorHex: '#F5EBD7',
    blendColor: '#bd8f5c'
  }
};

/**
 * Approved Cappuccino Media Assets in public/assets/cappuccino/
 */
export const CAPPUCCINO_ASSETS = {
  regularCup: '/assets/cappuccino/regular-cup.png',
  regularToLarge: '/assets/cappuccino/regular-to-large.mp4',
  regularEspresso: '/assets/cappuccino/regular-espresso.mp4',
  largeEspresso: '/assets/cappuccino/large-espresso.mp4',
  regularMilkPour: '/assets/cappuccino/regular-milk-pour.mp4',
  largeMilkPour: '/assets/cappuccino/large-milk-pour.mp4'
};

/**
 * Helper to normalize selectedMilk prop to one of the 5 keys
 */
export const resolveMilkKey = (val) => {
  if (!val) return 'Regular';
  const str = String(val).toLowerCase();
  if (str.includes('skim')) return 'Skimmed';
  if (str.includes('soy')) return 'Soy';
  if (str.includes('almond')) return 'Almond';
  if (str.includes('oat')) return 'Oat';
  return 'Regular';
};

/**
 * MilkVisualization Component
 *
 * Dedicated live visualization for hot coffee craft experience.
 * For Cappuccino, coordinates seamless playback across the 6 approved assets:
 * - STEP 1 (Size): Regular displays regular-cup.png; Large plays regular-to-large.mp4 & holds last frame.
 * - STEP 2/3 (Espresso): Plays regular-espresso.mp4 or large-espresso.mp4 & holds last frame.
 * - STEP 4 (Milk): Plays regular-milk-pour.mp4 or large-milk-pour.mp4 & holds last frame.
 * - STEP 5 (Ready/Cart Confirm): Retains finished cappuccino visual with steam.
 *
 * Uses a dual-slot video mechanism to ensure zero visual jump or black frames during transitions.
 */
export const MilkVisualization = ({
  drinkStyle = 'cappuccino', // 'cappuccino' | 'cold'
  stepKey = 'size', // 'size' | 'strength' | 'milk' | 'sweetness' | 'ready'
  currentStep = 1,
  isReady = false,
  selectedMilk = 'Regular',
  size = 'Regular',
  strength = 'Single Shot',
  sweetness = 'Regular Sugar',
  animStage = null, // 'size' | 'espresso' | 'milk' | 'ready' | 'reset'
  animTrigger = 0,
  pourTrigger = 0,
  productImage = null,
  productName = 'Cappuccino',
  unitPrice = null,
  onAnimationDone,
  className = '',
  children
}) => {
  const isCold = drinkStyle === 'cold';
  const isLarge = size === 'Large';
  const activeMilkKey = resolveMilkKey(selectedMilk);
  const currentMilk = MILK_VARIANTS[activeMilkKey] || MILK_VARIANTS.Regular;

  // Video references for alternating dual-slot seamless handover
  const videoRefA = useRef(null);
  const videoRefB = useRef(null);

  // Active slot currently visible ('A' or 'B')
  const [activeSlot, setActiveSlot] = useState('A');
  const [slotASrc, setSlotASrc] = useState(null);
  const [slotBSrc, setSlotBSrc] = useState(null);

  // Static cup image visibility (true when showing regular-cup.png)
  const [showStaticCup, setShowStaticCup] = useState(true);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [tiltAngle, setTiltAngle] = useState(0);

  // Current visual stage
  // 'regular_empty' | 'large_empty' | 'espresso_filled' | 'milk_finished'
  const [visualStage, setVisualStage] = useState('regular_empty');

  // Callback ref to prevent stale closures in onEnded
  const onAnimationDoneRef = useRef(onAnimationDone);
  onAnimationDoneRef.current = onAnimationDone;

  const currentPlayingStageRef = useRef(null);

  /**
   * Seamless video player: alternates between Slot A and Slot B
   * to guarantee zero blank frame or flicker during source transition.
   */
  const playVideoSource = useCallback((src, stageName) => {
    if (!src || isCold) return;

    setVideoError(false);
    setIsPlaying(true);
    currentPlayingStageRef.current = stageName;

    // Determine target slot (opposite of current active slot)
    const targetSlot = activeSlot === 'A' ? 'B' : 'A';
    const targetVideo = targetSlot === 'A' ? videoRefA.current : videoRefB.current;

    if (targetSlot === 'A') {
      setSlotASrc(src);
    } else {
      setSlotBSrc(src);
    }

    if (targetVideo) {
      targetVideo.src = src;
      targetVideo.currentTime = 0;
      targetVideo.muted = true;
      targetVideo.play().catch((err) => {
        console.warn(`[MilkVisualization] Slot ${targetSlot} play caught:`, err);
        setIsPlaying(false);
      });
    }
  }, [activeSlot, isCold]);

  /**
   * Slot onPlaying handler: swap activeSlot to the newly playing video
   * and hide the previous video or static image cleanly.
   */
  const handleSlotPlaying = useCallback((slotName) => {
    setActiveSlot(slotName);
    setShowStaticCup(false);
    setIsPlaying(true);

    // Pause the other slot if running
    const otherVideo = slotName === 'A' ? videoRefB.current : videoRefA.current;
    if (otherVideo && !otherVideo.paused) {
      otherVideo.pause();
    }
  }, []);

  /**
   * Slot onEnded handler: pause at final frame and fire onAnimationDone
   */
  const handleSlotEnded = useCallback((slotName) => {
    setIsPlaying(false);
    const stage = currentPlayingStageRef.current;

    if (stage === 'size') {
      setVisualStage('large_empty');
      if (onAnimationDoneRef.current) {
        onAnimationDoneRef.current('size');
      }
    } else if (stage === 'espresso') {
      setVisualStage('espresso_filled');
      if (onAnimationDoneRef.current) {
        onAnimationDoneRef.current('strength');
      }
    } else if (stage === 'milk') {
      setVisualStage('milk_finished');
      if (onAnimationDoneRef.current) {
        onAnimationDoneRef.current('milk');
      }
    }
  }, []);

  // Handle external animStage and triggers from parent
  const lastProcessedTriggerRef = useRef(null);
  const prevSizeRef = useRef(size);

  useEffect(() => {
    if (isCold) return;

    const sizeChanged = prevSizeRef.current !== size;
    prevSizeRef.current = size;

    // 1. Explicit animStage triggers from parent
    if (animTrigger && animTrigger !== lastProcessedTriggerRef.current) {
      lastProcessedTriggerRef.current = animTrigger;

      if (animStage === 'espresso') {
        const espSrc = isLarge ? CAPPUCCINO_ASSETS.largeEspresso : CAPPUCCINO_ASSETS.regularEspresso;
        playVideoSource(espSrc, 'espresso');
        return;
      } else if (animStage === 'milk') {
        const milkSrc = isLarge ? CAPPUCCINO_ASSETS.largeMilkPour : CAPPUCCINO_ASSETS.regularMilkPour;
        playVideoSource(milkSrc, 'milk');
        return;
      }
    }

    // 2. Reset or size explicitly changed to Regular
    if (animStage === 'reset' || (sizeChanged && size === 'Regular')) {
      setShowStaticCup(true);
      setVisualStage('regular_empty');
      setIsPlaying(false);
      const vA = videoRefA.current;
      const vB = videoRefB.current;
      if (vA) vA.pause();
      if (vB) vB.pause();
      return;
    }

    // 3. Size explicitly changed to Large
    if (sizeChanged && size === 'Large') {
      if (visualStage !== 'large_empty') {
        playVideoSource(CAPPUCCINO_ASSETS.regularToLarge, 'size');
      }
      return;
    }
  }, [size, stepKey, animStage, animTrigger, isLarge, isCold, visualStage, playVideoSource]);

  // Handle step jumping or ready state
  useEffect(() => {
    if (isCold) return;

    if (isReady && visualStage !== 'milk_finished') {
      setVisualStage('milk_finished');
    }
  }, [isReady, visualStage, isCold]);

  // Touch / pointer drag for slight 3D perspective tilt
  const dragStartRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    dragStartRef.current = e.clientX || (e.touches && e.touches[0].clientX) || 0;
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const delta = clientX - dragStartRef.current;
    setTiltAngle(Math.max(-8, Math.min(8, delta * 0.1)));
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    setTiltAngle(0);
  };

  return (
    <div
      className={`milk-vis-stage ${isCold ? 'milk-vis-stage--cold' : 'milk-vis-stage--hot'} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      style={{
        transform: `perspective(600px) rotateY(${tiltAngle}deg)`,
        transition: isDraggingRef.current ? 'none' : 'transform 0.4s ease-out'
      }}
    >
      {/* =========================================================================
          UPPER PORTION: APPROVED CAPPUCCINO MEDIA (Preserving Natural Cup Aspect Ratio)
          ========================================================================= */}
      {!isCold && (
        <div className="milk-vis-media-container">
          <div className="milk-vis-cup-assembly">
            {/* 1. Static Regular Cup (Initial State & Regular Size) */}
            {showStaticCup && !videoError && (
              <img
                src={CAPPUCCINO_ASSETS.regularCup}
                alt="Cappuccino Regular Cup"
                className="milk-vis-video"
                style={{ zIndex: 3 }}
              />
            )}

            {/* 2. Video Slot A */}
            <video
              ref={videoRefA}
              src={slotASrc || undefined}
              className="milk-vis-video"
              muted
              playsInline
              preload="auto"
              onPlaying={() => handleSlotPlaying('A')}
              onEnded={() => handleSlotEnded('A')}
              onError={(e) => {
                console.error('[MilkVisualization] Slot A video error:', e);
                setVideoError(true);
              }}
              style={{
                opacity: activeSlot === 'A' && !showStaticCup ? 1 : 0,
                zIndex: activeSlot === 'A' ? 2 : 1,
                pointerEvents: 'none'
              }}
            />

            {/* 3. Video Slot B */}
            <video
              ref={videoRefB}
              src={slotBSrc || undefined}
              className="milk-vis-video"
              muted
              playsInline
              preload="auto"
              onPlaying={() => handleSlotPlaying('B')}
              onEnded={() => handleSlotEnded('B')}
              onError={(e) => {
                console.error('[MilkVisualization] Slot B video error:', e);
                setVideoError(true);
              }}
              style={{
                opacity: activeSlot === 'B' && !showStaticCup ? 1 : 0,
                zIndex: activeSlot === 'B' ? 2 : 1,
                pointerEvents: 'none'
              }}
            />

            {/* Fallback Image on Error */}
            {videoError && (
              <img
                src={CAPPUCCINO_ASSETS.regularCup}
                alt="Cappuccino Fallback"
                className="milk-vis-fallback-img"
              />
            )}

            {/* Rising steam overlay when drink is completed */}
            {(isReady || visualStage === 'milk_finished') && (
              <div className="milk-vis-steam-overlay pointer-events-none">
                <div className="steam-line steam-line-1" />
                <div className="steam-line steam-line-2" />
                <div className="steam-line steam-line-3" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* COLD COFFEE HIGHBALL GLASS STAGE (Retained for Cold Drink compatibility) */}
      {isCold && (
        <div
          className="milk-vis-cold-stage"
          style={{
            transform: isLarge ? 'scale(1.14)' : 'scale(1)',
            transformOrigin: '50% 90%',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {isReady ? (
            <div className="milk-vis-cold-finished">
              <img
                src="/craft/cold_coffee_thumb.jpg"
                alt="Classic Cold Coffee"
                className="cold-coffee-img rounded-2xl shadow-md"
              />
              <div className="cold-frost-glow" />
            </div>
          ) : (
            <div className="cold-glass-tumbler">
              <div className="cold-glass-rim" />
              <div className="cold-liquid-column">
                <div
                  className="cold-espresso-layer"
                  style={{
                    height: stepKey !== 'size' ? (strength === 'Double Shot' ? '42%' : '32%') : '0%',
                    backgroundColor: strength === 'Double Shot' ? '#221109' : '#381C10'
                  }}
                />
                <div
                  className="cold-milk-layer"
                  style={{
                    height: (stepKey === 'milk' || stepKey === 'sweetness' || isReady) ? '76%' : '0%',
                    backgroundColor: currentMilk.colorHex
                  }}
                />
                <div
                  className="cold-foam-head"
                  style={{
                    opacity: (stepKey === 'sweetness' || isReady) ? 1 : 0,
                    height: (stepKey === 'sweetness' || isReady) ? '16%' : '0%'
                  }}
                />
                <div className="cold-ice-cube ice-1" />
                <div className="cold-ice-cube ice-2" />
                <div className="cold-ice-cube ice-3" />
              </div>
              <div className="cold-glass-coaster" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
