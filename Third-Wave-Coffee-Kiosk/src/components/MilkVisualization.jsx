import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import './MilkVisualization.css';
import { RotateCcw, Sparkles, Coffee } from 'lucide-react';

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
    tintFilter: 'none',
    blendColor: '#c49a6c'
  },
  Skimmed: {
    id: 'Skimmed',
    label: 'Skimmed Milk',
    tag: 'Light & Lean',
    desc: 'Slightly translucent white',
    colorHex: '#EAF0F6',
    tintFilter: 'brightness(1.05) contrast(0.95) saturate(0.85)',
    blendColor: '#b89066'
  },
  Soy: {
    id: 'Soy',
    label: 'Soy Milk',
    tag: 'Plant Protein',
    desc: 'Creamy warm white',
    colorHex: '#F5EED8',
    tintFilter: 'sepia(0.08) hue-rotate(-5deg) saturate(1.05)',
    blendColor: '#c09565'
  },
  Almond: {
    id: 'Almond',
    label: 'Almond Milk',
    tag: 'Nutty & Light',
    desc: 'Subtle warm beige',
    colorHex: '#ECE0CD',
    tintFilter: 'sepia(0.18) hue-rotate(5deg) saturate(1.1)',
    blendColor: '#b08354'
  },
  Oat: {
    id: 'Oat',
    label: 'Oat Milk',
    tag: 'Barista Blend',
    desc: 'Soft velvety creamy ivory',
    colorHex: '#F5EBD7',
    tintFilter: 'sepia(0.12) hue-rotate(10deg) saturate(1.12)',
    blendColor: '#bd8f5c'
  }
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
 * Step configuration with video start/end boundaries and high-res studio posters
 * 4-Step Flow: Size (0%) -> Strength (35%) -> Milk (75%) -> Sweetness / Ready (92%)
 */
const STEP_CONFIG = {
  size: {
    start: 0.0,
    end: 1.8,
    hold: 1.6,
    poster: '/craft/craft_step_1.jpg',
    label: 'Empty Glass Cup',
    fillPct: 0
  },
  strength: {
    start: 1.8,
    end: 3.8,
    hold: 3.7,
    poster: '/craft/craft_step_2.jpg',
    label: 'Espresso Crema',
    fillPct: 35
  },
  milk: {
    start: 3.8,
    end: 5.8,
    hold: 5.7,
    poster: '/craft/craft_step_3.jpg',
    label: 'Steamed Milk',
    fillPct: 75
  },
  sweetness: {
    start: 5.8,
    end: 9.8,
    hold: 9.8,
    poster: '/craft/craft_step_6.jpg',
    label: 'Finished Latte Art',
    fillPct: 92
  },
  ready: {
    start: 9.2,
    end: 10.0,
    hold: 9.8,
    poster: '/craft/craft_step_6.jpg',
    label: 'Ready to Serve',
    fillPct: 92
  }
};

/**
 * MilkVisualization Component
 *
 * Layer 1: Large, extended visual background area with live coffee preparation.
 * Layer 2: Floating AI Cashier card slot rendered over its lower portion via children.
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

  // Resolve active step key across 4 steps + ready
  const activeKey = useMemo(() => {
    if (stepKey) return stepKey;
    if (isReady) return 'ready';
    const keyMap = ['size', 'strength', 'milk', 'sweetness', 'ready'];
    return keyMap[currentStep - 1] || 'size';
  }, [isReady, stepKey, currentStep]);

  const config = STEP_CONFIG[activeKey] || STEP_CONFIG.size;

  // High-resolution studio poster: step 4 (sweetness) & ready both display the finished 92% cup
  const activePoster = useMemo(() => {
    if (activeKey === 'ready' || activeKey === 'sweetness') return '/craft/craft_step_6.jpg';
    if (activeKey === 'milk') return '/craft/craft_step_3.jpg';
    if (activeKey === 'strength') return '/craft/craft_step_2.jpg';
    return '/craft/craft_step_1.jpg';
  }, [activeKey]);

  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [tiltAngle, setTiltAngle] = useState(0);

  // Play video segment for active step
  const playStepSegment = useCallback((key) => {
    const video = videoRef.current;
    if (!video || isCold || videoError) return;

    const conf = STEP_CONFIG[key] || STEP_CONFIG.size;
    video.currentTime = conf.start;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Video auto-play handled:', err);
          setIsPlaying(false);
        });
    }
  }, [isCold, videoError]);

  // Handle time update boundaries
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isCold) return;

    const conf = STEP_CONFIG[activeKey] || STEP_CONFIG.size;

    const handleTimeUpdate = () => {
      if (video.currentTime >= conf.end) {
        if (activeKey === 'size') {
          // Loop empty glass gently
          video.currentTime = conf.start;
        } else if (activeKey === 'ready') {
          video.pause();
          video.currentTime = conf.hold;
          setIsPlaying(false);
          if (onAnimationDone) onAnimationDone('ready');
        } else {
          video.pause();
          video.currentTime = conf.hold;
          setIsPlaying(false);
          if (onAnimationDone) onAnimationDone(activeKey);
        }
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [activeKey, isCold, onAnimationDone]);

  // Trigger segment when step or pourTrigger changes
  useEffect(() => {
    if (!isCold) {
      playStepSegment(activeKey);
    }
  }, [activeKey, pourTrigger, isCold, playStepSegment]);

  // Manual replay button
  const handleReplay = (e) => {
    e.stopPropagation();
    if (!isCold) {
      playStepSegment(activeKey);
    }
  };

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
          UPPER PORTION: LIVE COFFEE PREPARATION (Unobscured Cup & Pouring Action)
          - Stable unclipped container
          - Unified cup assembly scaled anchored to table base (50% 82%)
          ========================================================================= */}
      {!isCold && (
        <div className="milk-vis-media-container">
          <div
            className="milk-vis-cup-assembly"
            style={{
              transform: isLarge ? 'scale(1.12)' : 'scale(1)',
              transformOrigin: '50% 78%',
              transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {!videoError && (
              <video
                ref={videoRef}
                src="/cappuccino_craft.mp4"
                className="milk-vis-video"
                muted
                playsInline
                preload="auto"
                poster={activePoster}
                onLoadedData={() => setVideoLoaded(true)}
                onError={() => setVideoError(true)}
                style={{
                  filter: activeKey === 'milk'
                    ? currentMilk.tintFilter
                    : activeKey === 'strength' && strength === 'Double Shot'
                    ? 'contrast(1.08) brightness(0.96) saturate(1.12)'
                    : 'none'
                }}
              />
            )}

            {(!videoLoaded || videoError) && (
              <img
                src={activePoster}
                alt={config.label}
                className="milk-vis-fallback-img"
                style={{
                  filter: activeKey === 'milk'
                    ? currentMilk.tintFilter
                    : activeKey === 'strength' && strength === 'Double Shot'
                    ? 'contrast(1.08) brightness(0.96) saturate(1.12)'
                    : 'none'
                }}
              />
            )}

            {activeKey === 'ready' && (
              <div className="milk-vis-steam-overlay pointer-events-none">
                <div className="steam-line steam-line-1" />
                <div className="steam-line steam-line-2" />
                <div className="steam-line steam-line-3" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* COLD COFFEE HIGHBALL GLASS STAGE */}
      {isCold && (
        <div
          className="milk-vis-cold-stage"
          style={{
            transform: isLarge ? 'scale(1.14)' : 'scale(1)',
            transformOrigin: '50% 90%',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {activeKey === 'ready' ? (
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
                    height: activeKey !== 'size' ? (strength === 'Double Shot' ? '42%' : '32%') : '0%',
                    backgroundColor: strength === 'Double Shot' ? '#221109' : '#381C10'
                  }}
                />
                <div
                  className="cold-milk-layer"
                  style={{
                    height: (activeKey === 'milk' || activeKey === 'sweetness' || activeKey === 'ready') ? '76%' : '0%',
                    backgroundColor: currentMilk.colorHex
                  }}
                />
                <div
                  className="cold-foam-head"
                  style={{
                    opacity: (activeKey === 'sweetness' || activeKey === 'ready') ? 1 : 0,
                    height: (activeKey === 'sweetness' || activeKey === 'ready') ? '16%' : '0%'
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

      {/* =========================================================================
          TOP OVERLAYS: INGREDIENT BADGE, PRICE PILL, REPLAY ACTION
          ========================================================================= */}

      {/* Top Left: Active Ingredient & Size Badge */}
      <div className="milk-vis-pill milk-vis-pill--left">
        <span
          className="milk-vis-dot"
          style={{
            backgroundColor: activeKey !== 'size' ? currentMilk.colorHex : '#A89F91'
          }}
        />
        <span className="milk-vis-pill-text">
          {activeKey === 'size' && (isCold ? (isLarge ? 'Highball Glass • Large (450ml)' : 'Highball Glass • Regular (350ml)') : (isLarge ? 'Glass Cup • Large (350ml)' : 'Glass Cup • Regular (240ml)'))}
          {activeKey === 'strength' && `Espresso (${strength})`}
          {activeKey === 'milk' && currentMilk.label}
          {activeKey === 'sweetness' && (isCold ? `Chilled • ${sweetness}` : `Latte Art • ${sweetness}`)}
          {activeKey === 'ready' && 'Ready to Serve'}
        </span>
      </div>

      {/* Top Right: Product Name & Price Pill + Replay Button */}
      <div className="milk-vis-top-right">
        {unitPrice != null && (
          <div className="milk-vis-price-pill">
            <span className="text-[10px] font-black uppercase tracking-wider text-navy truncate max-w-[110px]">
              {productName}
            </span>
            <span className="text-xs font-black text-navy">
              ₹{unitPrice}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={handleReplay}
          className="milk-vis-replay-action"
          title="Replay step animation"
          aria-label="Replay animation"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isPlaying ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* =========================================================================
          LAYER 2: FLOATING AI CASHIER CUSTOMIZATION CARD (Overlaid at Lower Portion)
          ========================================================================= */}
      {children && (
        <div className="milk-vis-floating-card-slot">
          {children}
        </div>
      )}
    </div>
  );
};
