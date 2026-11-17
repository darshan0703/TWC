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
  animSize = null,
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
  const effectiveSize = animSize || size;
  const isLarge = effectiveSize === 'Large';
  const activeMilkKey = resolveMilkKey(selectedMilk);
  const currentMilk = MILK_VARIANTS[activeMilkKey] || MILK_VARIANTS.Regular;

  // Video references for alternating dual-slot seamless handover
  const videoRefA = useRef(null);
  const videoRefB = useRef(null);

  // Layer visibility state:
  // activeSlot: primary front layer ('image' | 'A' | 'B')
  // underlyingSlot: secondary underlying layer holding previous visual at 100% opacity ('image' | 'A' | 'B' | null)
  const [activeSlot, setActiveSlot] = useState('image');
  const [underlyingSlot, setUnderlyingSlot] = useState(null);
  const activeSlotRef = useRef('image');
  const underlyingSlotRef = useRef(null);

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
  const activeTurnIdRef = useRef(0);
  const crossfadeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (crossfadeTimerRef.current) {
        clearTimeout(crossfadeTimerRef.current);
      }
    };
  }, []);

  /**
   * Layer style calculator ensuring true underlying crossfade:
   * The incoming layer transitions opacity from 0 -> 1 at zIndex 20.
   * The outgoing layer REMAINS at opacity 1 at zIndex 10 until the crossfade finishes.
   * This guarantees that the background is NEVER exposed at any point.
   */
  const getLayerStyle = useCallback((layerName) => {
    const isActive = activeSlot === layerName;
    const isUnderlying = underlyingSlot === layerName;
    const isVisible = isActive || isUnderlying;

    return {
      opacity: isVisible ? 1 : 0,
      zIndex: isActive ? 20 : (isUnderlying ? 10 : 1),
      transition: 'opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      pointerEvents: 'none'
    };
  }, [activeSlot, underlyingSlot]);

  /**
   * Seamless video player: alternates between Slot A and Slot B
   * to guarantee zero blank frame or flicker during source transition.
   * Manages DOM video.src imperatively and synchronizes crossfading strictly
   * after the first video frame is decoded and rendered.
   */
  const playVideoSource = useCallback((src, stageName) => {
    if (!src || isCold) return;

    const turnId = ++activeTurnIdRef.current;
    setVideoError(false);
    setIsPlaying(true);
    currentPlayingStageRef.current = stageName;

    // Target slot is the opposite of currently visible video slot
    const currentActive = activeSlotRef.current;
    const targetSlot = currentActive === 'A' ? 'B' : 'A';
    const targetVideo = targetSlot === 'A' ? videoRefA.current : videoRefB.current;

    console.log(`[MilkVisualization] playVideoSource(turn=${turnId}) -> stage=${stageName}, slot=${targetSlot}, isLarge=${isLarge}, src=${src}`);

    if (targetVideo) {
      targetVideo.defaultMuted = true;
      targetVideo.muted = true;
      targetVideo.playsInline = true;
      targetVideo.src = src;
      targetVideo.currentTime = 0;
      targetVideo.load();

      let frameRendered = false;
      const onFrameReady = () => {
        if (frameRendered || turnId !== activeTurnIdRef.current) return;
        frameRendered = true;

        console.log(`[MilkVisualization] First frame rendered for slot ${targetSlot} (stage=${stageName})`);

        // Lock current visual at 100% opacity underneath at zIndex 10
        const outgoing = activeSlotRef.current;
        underlyingSlotRef.current = outgoing;
        setUnderlyingSlot(outgoing);

        // Incoming slot fades in at zIndex 20
        activeSlotRef.current = targetSlot;
        setActiveSlot(targetSlot);
        setIsPlaying(true);

        // After crossfade finishes, clear underlying layer and pause outgoing video
        if (crossfadeTimerRef.current) clearTimeout(crossfadeTimerRef.current);
        crossfadeTimerRef.current = setTimeout(() => {
          if (turnId !== activeTurnIdRef.current) return;
          underlyingSlotRef.current = null;
          setUnderlyingSlot(null);

          if (outgoing === 'A' && videoRefA.current) {
            videoRefA.current.pause();
          } else if (outgoing === 'B' && videoRefB.current) {
            videoRefB.current.pause();
          }
        }, 240);
      };

      // 1. Preferred: requestVideoFrameCallback (Chrome, Safari, modern Firefox)
      if ('requestVideoFrameCallback' in targetVideo) {
        targetVideo.requestVideoFrameCallback(() => {
          onFrameReady();
        });
      }

      // 2. Secondary listener: timeupdate
      const onTimeUpdate = () => {
        if (targetVideo.currentTime > 0) {
          targetVideo.removeEventListener('timeupdate', onTimeUpdate);
          onFrameReady();
        }
      };
      targetVideo.addEventListener('timeupdate', onTimeUpdate);

      // 3. Fallback listener: playing + readyState >= 2
      const onPlaying = () => {
        targetVideo.removeEventListener('playing', onPlaying);
        requestAnimationFrame(() => {
          if (targetVideo.readyState >= 2) {
            onFrameReady();
          }
        });
      };
      targetVideo.addEventListener('playing', onPlaying);

      // 4. Safety maximum delay fallback
      setTimeout(() => {
        if (!frameRendered && turnId === activeTurnIdRef.current) {
          onFrameReady();
        }
      }, 250);

      const playPromise = targetVideo.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`[MilkVisualization] Slot ${targetSlot} play initiated successfully for ${stageName}`);
          })
          .catch((err) => {
            console.warn(`[MilkVisualization] Slot ${targetSlot} play caught:`, err);
            if (err.name !== 'AbortError') {
              setIsPlaying(false);
            }
          });
      }
    }
  }, [isCold, isLarge]);

  /**
   * Reset to Static Cup (Regular cup initial appearance):
   * Fades regular-cup.png in smoothly over current video slot.
   */
  const resetToStaticCup = useCallback(() => {
    const turnId = ++activeTurnIdRef.current;
    console.log(`[MilkVisualization] resetToStaticCup(turn=${turnId})`);
    currentPlayingStageRef.current = 'reset';
    setVisualStage('regular_empty');
    setIsPlaying(false);

    const outgoing = activeSlotRef.current;
    if (outgoing === 'image') return;

    // Lock outgoing video at 100% opacity underneath at zIndex 10
    underlyingSlotRef.current = outgoing;
    setUnderlyingSlot(outgoing);

    // Static cup image fades in at zIndex 20
    activeSlotRef.current = 'image';
    setActiveSlot('image');

    if (crossfadeTimerRef.current) clearTimeout(crossfadeTimerRef.current);
    crossfadeTimerRef.current = setTimeout(() => {
      if (turnId !== activeTurnIdRef.current) return;
      underlyingSlotRef.current = null;
      setUnderlyingSlot(null);

      const vA = videoRefA.current;
      const vB = videoRefB.current;
      if (vA) { vA.pause(); vA.currentTime = 0; }
      if (vB) { vB.pause(); vB.currentTime = 0; }
    }, 240);
  }, []);

  /**
   * Slot onEnded handler: pause at final frame and fire onAnimationDone
   */
  const handleSlotEnded = useCallback((slotName) => {
    // Only process end event if this slot is the active slot
    if (slotName !== activeSlotRef.current) {
      console.log(`[MilkVisualization] Ignoring onEnded from inactive slot ${slotName}`);
      return;
    }

    const stage = currentPlayingStageRef.current;
    console.log(`[MilkVisualization] Slot ${slotName} onEnded fired (stage=${stage})`);
    setIsPlaying(false);

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

  useEffect(() => {
    if (isCold) return;

    // 1. Explicit animStage triggers from parent (touch or voice selection events)
    if (animTrigger && animTrigger !== lastProcessedTriggerRef.current) {
      lastProcessedTriggerRef.current = animTrigger;

      if (animStage === 'size') {
        playVideoSource(CAPPUCCINO_ASSETS.regularToLarge, 'size');
        return;
      } else if (animStage === 'reset') {
        resetToStaticCup();
        return;
      } else if (animStage === 'espresso') {
        const espSrc = isLarge ? CAPPUCCINO_ASSETS.largeEspresso : CAPPUCCINO_ASSETS.regularEspresso;
        playVideoSource(espSrc, 'espresso');
        return;
      } else if (animStage === 'milk') {
        const milkSrc = isLarge ? CAPPUCCINO_ASSETS.largeMilkPour : CAPPUCCINO_ASSETS.regularMilkPour;
        playVideoSource(milkSrc, 'milk');
        return;
      }
    }

    // 2. Direct fallback for switching back to Regular while on Size step
    if (size === 'Regular' && stepKey === 'size' && animStage === 'reset' && !isPlaying) {
      resetToStaticCup();
      return;
    }

    // 3. Fallback: Size changed to Large on Step 1 if not already triggered
    if (size === 'Large' && stepKey === 'size' && visualStage !== 'large_empty' && !isPlaying && !animTrigger) {
      playVideoSource(CAPPUCCINO_ASSETS.regularToLarge, 'size');
      return;
    }
  }, [size, stepKey, animStage, animTrigger, isLarge, isCold, visualStage, isPlaying, playVideoSource, resetToStaticCup]);

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
            <img
              src={CAPPUCCINO_ASSETS.regularCup}
              alt="Cappuccino Regular Cup"
              className="milk-vis-video"
              style={getLayerStyle('image')}
            />

            {/* 2. Video Slot A */}
            <video
              ref={videoRefA}
              className="milk-vis-video"
              muted
              playsInline
              preload="auto"
              onEnded={() => handleSlotEnded('A')}
              onError={(e) => {
                console.error('[MilkVisualization] Slot A video error:', e);
                setVideoError(true);
              }}
              style={getLayerStyle('A')}
            />

            {/* 3. Video Slot B */}
            <video
              ref={videoRefB}
              className="milk-vis-video"
              muted
              playsInline
              preload="auto"
              onEnded={() => handleSlotEnded('B')}
              onError={(e) => {
                console.error('[MilkVisualization] Slot B video error:', e);
                setVideoError(true);
              }}
              style={getLayerStyle('B')}
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
