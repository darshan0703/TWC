import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import './MilkVisualization.css';
import { RotateCcw } from 'lucide-react';

/**
 * 5 Milk Variants configuration matching Third Wave Coffee specifications
 */
export const MILK_VARIANTS = {
  Regular: {
    id: 'Regular',
    label: 'Regular Milk',
    tag: 'Fresh Dairy',
    desc: 'Natural white',
    colorHex: '#FAF8F5',
    colorNum: 0xFAF8F5,
    roughness: 0.26,
    opacity: 0.98,
    translucent: false
  },
  Skimmed: {
    id: 'Skimmed',
    label: 'Skimmed Milk',
    tag: 'Light & Lean',
    desc: 'Slightly translucent white',
    colorHex: '#E2EBF2',
    colorNum: 0xE2EBF2,
    roughness: 0.18,
    opacity: 0.82,
    translucent: true
  },
  Soy: {
    id: 'Soy',
    label: 'Soy Milk',
    tag: 'Plant Protein',
    desc: 'Creamy warm white',
    colorHex: '#F5EED8',
    colorNum: 0xF5EED8,
    roughness: 0.28,
    opacity: 0.98,
    translucent: false
  },
  Almond: {
    id: 'Almond',
    label: 'Almond Milk',
    tag: 'Nutty & Light',
    desc: 'Subtle warm beige',
    colorHex: '#ECE0CD',
    colorNum: 0xECE0CD,
    roughness: 0.25,
    opacity: 0.94,
    translucent: false
  },
  Oat: {
    id: 'Oat',
    label: 'Oat Milk',
    tag: 'Barista Blend',
    desc: 'Soft creamy ivory',
    colorHex: '#F5EBD7',
    colorNum: 0xF5EBD7,
    roughness: 0.30,
    opacity: 0.97,
    translucent: false
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
 * MilkVisualization Component
 *
 * Dedicated 3D WebGL scene showcasing a transparent glass, barista hand pouring from a milk pitcher,
 * and realistic milk liquid simulation customized for the active milk type.
 *
 * @param {string} selectedMilk - 'Regular' | 'Skimmed' | 'Soy' | 'Almond' | 'Oat'
 * @param {string} size - 'Regular' | 'Large'
 * @param {function} onAnimationComplete - optional callback when pouring finishes
 */
// Error Boundary to prevent any WebGL/GPU crash from taking down the customization screen
class MilkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.warn('MilkVisualization WebGL error caught gracefully:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="milk-vis-container flex items-center justify-center p-3 text-center">
          <span className="text-[11px] font-bold text-navy">Interactive 3D Preview (Offline Mode)</span>
        </div>
      );
    }
    return this.props.children;
  }
}

const MilkVisualizationInner = ({
  selectedMilk = 'Regular',
  size = 'Regular',
  pourTrigger = 0,
  onAnimationComplete
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const activeMilkKey = resolveMilkKey(selectedMilk);
  const currentMilk = MILK_VARIANTS[activeMilkKey] || MILK_VARIANTS.Regular;

  const [isPouring, setIsPouring] = useState(false);
  const [hasPoured, setHasPoured] = useState(false);
  const [webGlSupported, setWebGlSupported] = useState(true);

  // Track initial mount so glass begins empty without immediate auto-pour
  const isFirstMountRef = useRef(true);

  // References to 3D scene objects
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animFrameRef = useRef(null);
  const objectsRef = useRef({
    glassGroup: null,
    liquidMesh: null,
    meniscusMesh: null,
    liquidMaterial: null,
    pitcherGroup: null,
    streamMesh: null,
    rippleMesh: null,
    camera: null
  });

  // Animation timeline control
  const animStateRef = useRef({
    startTime: 0,
    duration: 2600, // 2.6 seconds full pour cycle
    active: false,
    milkKey: activeMilkKey
  });

  // Touch drag rotation
  const pointerRef = useRef({
    isDown: false,
    startX: 0,
    targetRotationY: 0,
    currentRotationY: 0
  });

  // Trigger pour animation
  const triggerPourAnimation = useCallback((milkKey) => {
    const objs = objectsRef.current;
    if (!objs.pitcherGroup || !objs.liquidMesh) return;

    const variant = MILK_VARIANTS[milkKey] || MILK_VARIANTS.Regular;

    // Update liquid material to the chosen milk
    if (objs.liquidMaterial) {
      objs.liquidMaterial.color.setHex(variant.colorNum);
      objs.liquidMaterial.opacity = variant.opacity;
      objs.liquidMaterial.roughness = variant.roughness;
    }

    // Reset liquid to completely empty before starting pour
    objs.liquidMesh.visible = true;
    objs.liquidMesh.scale.set(1, 0.001, 1);
    if (objs.meniscusMesh) {
      objs.meniscusMesh.visible = false;
      objs.meniscusMesh.position.y = -0.84;
    }

    setIsPouring(true);
    setHasPoured(true);
    animStateRef.current = {
      startTime: performance.now(),
      duration: 2600,
      active: true,
      milkKey
    };
  }, []);

  // Initialize Three.js 3D Scene
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 220;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 4.2);
    camera.lookAt(0, -0.1, 0);
    objectsRef.current.camera = camera;

    // 3. Safe WebGL Renderer initialization
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      rendererRef.current = renderer;
    } catch (err) {
      console.warn('WebGL is not available on this device, using 2D fallback:', err);
      setWebGlSupported(false);
      return;
    }

    // 4. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.1);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(2.5, 4, 3.5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe2ecfb, 0.9);
    rimLight.position.set(-3, 2, -2.5);
    scene.add(rimLight);

    const softFill = new THREE.PointLight(0xffedd5, 0.7, 8);
    softFill.position.set(0, -1, 2);
    scene.add(softFill);

    // 5. Build Transparent Glass Model (Double-walled for physical refraction)
    const glassGroup = new THREE.Group();
    scene.add(glassGroup);
    objectsRef.current.glassGroup = glassGroup;

    // Glass Material
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.32,
      roughness: 0.05,
      metalness: 0.02,
      transmission: 0.88,
      ior: 1.5,
      thickness: 0.4,
      specularIntensity: 1.0,
      specularColor: 0xffffff,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Outer wall
    const outerWallGeo = new THREE.CylinderGeometry(0.78, 0.60, 1.85, 48, 1, true);
    const outerWallMesh = new THREE.Mesh(outerWallGeo, glassMaterial);
    glassGroup.add(outerWallMesh);

    // Inner wall
    const innerWallGeo = new THREE.CylinderGeometry(0.74, 0.56, 1.80, 48, 1, true);
    const innerWallMesh = new THREE.Mesh(innerWallGeo, glassMaterial);
    glassGroup.add(innerWallMesh);

    // Thick glass base
    const baseGeo = new THREE.CylinderGeometry(0.60, 0.58, 0.16, 48);
    const baseMesh = new THREE.Mesh(baseGeo, glassMaterial);
    baseMesh.position.y = -0.92;
    glassGroup.add(baseMesh);

    // Polished glass lip rim
    const rimGeo = new THREE.TorusGeometry(0.76, 0.022, 16, 48);
    rimGeo.rotateX(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, glassMaterial);
    rimMesh.position.y = 0.925;
    glassGroup.add(rimMesh);

    // Realistic vertical reflection sheen on glass surface
    const sheenGeo = new THREE.CylinderGeometry(0.785, 0.605, 1.75, 12, 1, true, 0.2, 0.35);
    const sheenMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const sheenMesh = new THREE.Mesh(sheenGeo, sheenMat);
    glassGroup.add(sheenMesh);

    // 6. Build Liquid Column (Milk inside glass)
    const liquidMaterial = new THREE.MeshStandardMaterial({
      color: currentMilk.colorNum,
      roughness: currentMilk.roughness,
      metalness: 0.02,
      transparent: true,
      opacity: currentMilk.opacity,
      depthWrite: true
    });
    objectsRef.current.liquidMaterial = liquidMaterial;

    // Liquid cylinder (pivot at bottom so scale.y fills upwards)
    const liquidHeight = 1.55;
    const liquidGeo = new THREE.CylinderGeometry(0.73, 0.55, liquidHeight, 36);
    liquidGeo.translate(0, liquidHeight / 2, 0); // shift pivot to bottom
    const liquidMesh = new THREE.Mesh(liquidGeo, liquidMaterial);
    liquidMesh.position.y = -0.84;
    liquidMesh.scale.set(1, 0.0001, 1); // starts empty
    liquidMesh.visible = false; // strictly hidden until a milk option is clicked!
    glassGroup.add(liquidMesh);
    objectsRef.current.liquidMesh = liquidMesh;

    // Liquid top surface (meniscus disc)
    const meniscusGeo = new THREE.CircleGeometry(0.73, 36);
    meniscusGeo.rotateX(-Math.PI / 2);
    const meniscusMesh = new THREE.Mesh(meniscusGeo, liquidMaterial);
    meniscusMesh.position.y = -0.84;
    meniscusMesh.visible = false;
    glassGroup.add(meniscusMesh);
    objectsRef.current.meniscusMesh = meniscusMesh;

    // 7. Build Barista Hand & Milk Pitcher (Jug)
    const pitcherGroup = new THREE.Group();
    scene.add(pitcherGroup);
    objectsRef.current.pitcherGroup = pitcherGroup;

    // Stainless steel pitcher material
    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0xdde4ec,
      metalness: 0.92,
      roughness: 0.2,
      envMapIntensity: 1.2
    });

    // Pitcher body (tapered espresso steaming pitcher)
    const pitcherBodyGeo = new THREE.CylinderGeometry(0.38, 0.46, 0.95, 32);
    const pitcherBody = new THREE.Mesh(pitcherBodyGeo, steelMaterial);
    pitcherGroup.add(pitcherBody);

    // Pitcher pointed spout
    const spoutGeo = new THREE.ConeGeometry(0.16, 0.28, 16);
    spoutGeo.rotateZ(Math.PI / 3);
    const spoutMesh = new THREE.Mesh(spoutGeo, steelMaterial);
    spoutMesh.position.set(-0.34, 0.42, 0);
    pitcherGroup.add(spoutMesh);

    // Pitcher curved handle
    const handleGeo = new THREE.TorusGeometry(0.24, 0.04, 12, 24, Math.PI * 0.95);
    handleGeo.rotateZ(-Math.PI / 4);
    const handleMesh = new THREE.Mesh(handleGeo, steelMaterial);
    handleMesh.position.set(0.44, 0.02, 0);
    pitcherGroup.add(handleMesh);

    // Barista Hand (Warm skin tone, gripping the pitcher handle)
    const handGroup = new THREE.Group();
    pitcherGroup.add(handGroup);

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8a379,
      roughness: 0.65,
      metalness: 0.05
    });

    // Palm
    const palmGeo = new THREE.BoxGeometry(0.28, 0.4, 0.22);
    const palmMesh = new THREE.Mesh(palmGeo, skinMaterial);
    palmMesh.position.set(0.62, 0.05, 0);
    palmMesh.rotation.z = -0.25;
    handGroup.add(palmMesh);

    // Thumb across top of handle
    const thumbGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 12);
    thumbGeo.rotateZ(Math.PI / 2.6);
    const thumbMesh = new THREE.Mesh(thumbGeo, skinMaterial);
    thumbMesh.position.set(0.46, 0.24, 0.06);
    handGroup.add(thumbMesh);

    // Fingers curled around the grip
    for (let f = 0; f < 3; f++) {
      const fingerGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.24, 12);
      fingerGeo.rotateZ(Math.PI / 2.2);
      const fingerMesh = new THREE.Mesh(fingerGeo, skinMaterial);
      fingerMesh.position.set(0.54, 0.12 - f * 0.1, -0.02);
      handGroup.add(fingerMesh);
    }

    // Forearm extending out of scene
    const armGeo = new THREE.CylinderGeometry(0.13, 0.16, 0.85, 16);
    armGeo.rotateZ(-Math.PI / 3);
    const armMesh = new THREE.Mesh(armGeo, skinMaterial);
    armMesh.position.set(1.05, 0.35, 0);
    handGroup.add(armMesh);

    // Pitcher initial hidden position (off-screen top-right)
    pitcherGroup.position.set(3.2, 2.8, 0);
    pitcherGroup.rotation.z = 0;
    pitcherGroup.visible = false;

    // 8. Milk Pouring Stream
    const streamGeo = new THREE.CylinderGeometry(0.04, 0.055, 1.8, 16);
    streamGeo.translate(0, -0.9, 0);
    const streamMaterial = new THREE.MeshStandardMaterial({
      color: currentMilk.colorNum,
      roughness: 0.2,
      transparent: true,
      opacity: 0
    });
    const streamMesh = new THREE.Mesh(streamGeo, streamMaterial);
    scene.add(streamMesh);
    streamMesh.visible = false;
    objectsRef.current.streamMesh = streamMesh;

    // Liquid surface impact ripple ring
    const rippleGeo = new THREE.RingGeometry(0.04, 0.14, 24);
    rippleGeo.rotateX(-Math.PI / 2);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
    scene.add(rippleMesh);
    rippleMesh.visible = false;
    objectsRef.current.rippleMesh = rippleMesh;

    // Gentle base shadow
    const shadowGeo = new THREE.CircleGeometry(0.68, 32);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x4a3b32,
      transparent: true,
      opacity: 0.12
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.y = -1.02;
    scene.add(shadowMesh);

    // Animation Loop
    let lastTime = performance.now();

    const animate = (now) => {
      animFrameRef.current = requestAnimationFrame(animate);

      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Handle gentle touch/pointer rotation
      const ptr = pointerRef.current;
      ptr.currentRotationY += (ptr.targetRotationY - ptr.currentRotationY) * 0.1;
      glassGroup.rotation.y = ptr.currentRotationY;

      // Animate Milk Pouring Timeline
      const anim = animStateRef.current;
      if (anim.active) {
        const animVariant = MILK_VARIANTS[anim.milkKey] || MILK_VARIANTS.Regular;
        const elapsed = now - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1.0);

        // Phase 1: Hand & Pitcher Enter and Tilt (0.00 -> 0.25)
        if (progress < 0.25) {
          const p = progress / 0.25;
          const ease = p * p * (3 - 2 * p); // Smooth easeInOut

          pitcherGroup.visible = true;
          // Interpolate position from offscreen (3.2, 2.8) to pouring pose (1.15, 1.35)
          pitcherGroup.position.x = 3.2 + (1.15 - 3.2) * ease;
          pitcherGroup.position.y = 2.8 + (1.35 - 2.8) * ease;
          pitcherGroup.position.z = 0;
          // Tilt pitcher from 0 to -65 degrees (spout aims into glass)
          pitcherGroup.rotation.z = -(Math.PI * 0.36) * ease;

          streamMesh.visible = false;
          rippleMesh.visible = false;
        }
        // Phase 2: Pouring liquid & filling the glass (0.25 -> 0.75)
        else if (progress < 0.75) {
          const p = (progress - 0.25) / 0.50;
          const easeFill = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;

          pitcherGroup.visible = true;
          pitcherGroup.position.set(1.15, 1.35 + Math.sin(now * 0.006) * 0.015, 0);
          pitcherGroup.rotation.z = -(Math.PI * 0.36) + Math.sin(now * 0.008) * 0.02;

          // Stream active
          streamMesh.visible = true;
          streamMaterial.opacity = 0.95;
          streamMaterial.color.setHex(animVariant.colorNum);
          streamMesh.position.set(0.05, 1.15, 0);

          // Liquid level rising smoothly
          const targetFill = 0.82; // Fill up to 82% of glass
          const currentFill = Math.max(0.01, easeFill * targetFill);
          liquidMesh.scale.y = currentFill;

          // Meniscus surface position follows the liquid height
          meniscusMesh.visible = true;
          const topY = -0.84 + currentFill * liquidHeight;
          meniscusMesh.position.y = topY;
          meniscusMesh.scale.setScalar(0.75 + (currentFill * 0.25)); // slight taper expansion

          // Meniscus ripples
          rippleMesh.visible = true;
          rippleMesh.position.set(0.05, topY + 0.005, 0);
          const ripplePhase = (now * 0.006) % 1;
          rippleMesh.scale.setScalar(0.8 + ripplePhase * 0.8);
          rippleMat.opacity = (1 - ripplePhase) * 0.45;
        }
        // Phase 3: Pitcher untilts & Hand Exits Scene (0.75 -> 1.00)
        else {
          const p = (progress - 0.75) / 0.25;
          const ease = p * p * (3 - 2 * p);

          // Stream cuts off immediately
          streamMesh.visible = false;
          rippleMesh.visible = false;

          // Pitcher untilts and moves off-screen
          pitcherGroup.position.x = 1.15 + (3.4 - 1.15) * ease;
          pitcherGroup.position.y = 1.35 + (3.0 - 1.35) * ease;
          pitcherGroup.rotation.z = -(Math.PI * 0.36) * (1 - ease);

          // Liquid remains filled at 82%
          liquidMesh.scale.y = 0.82;
          meniscusMesh.visible = true;
          meniscusMesh.position.y = -0.84 + 0.82 * liquidHeight;

          if (progress >= 1.0) {
            anim.active = false;
            pitcherGroup.visible = false;
            setIsPouring(false);
            setHasPoured(true);
            if (onAnimationComplete) onAnimationComplete(anim.milkKey);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // Responsive Canvas Resize Observer
    const handleResize = () => {
      if (!container || !renderer) return;
      const newW = container.clientWidth || 240;
      const newH = container.clientHeight || 220;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup resources on unmount
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (resizeObserver) resizeObserver.disconnect();

      // Dispose Geometries & Materials safely
      [outerWallGeo, innerWallGeo, baseGeo, rimGeo, sheenGeo, liquidGeo, meniscusGeo,
       pitcherBodyGeo, spoutGeo, handleGeo, palmGeo, thumbGeo, armGeo, streamGeo, rippleGeo, shadowGeo]
        .forEach(g => { if (g && typeof g.dispose === 'function') g.dispose(); });

      [glassMaterial, sheenMat, liquidMaterial, steelMaterial, skinMaterial, streamMaterial, rippleMat, shadowMat]
        .forEach(m => { if (m && typeof m.dispose === 'function') m.dispose(); });

      if (renderer && typeof renderer.dispose === 'function') renderer.dispose();
    };
  }, []);

  // Only trigger pouring animation when customer clicks a milk option (pourTrigger > 0)
  const lastHandledTriggerRef = useRef(0);

  useEffect(() => {
    if (pourTrigger > 0 && pourTrigger !== lastHandledTriggerRef.current) {
      lastHandledTriggerRef.current = pourTrigger;
      if (objectsRef.current.liquidMesh) {
        triggerPourAnimation(activeMilkKey);
      }
    }
  }, [activeMilkKey, pourTrigger, triggerPourAnimation]);

  // Adjust glass height slightly when size prop toggles between Regular and Large
  useEffect(() => {
    const glass = objectsRef.current.glassGroup;
    if (glass) {
      const targetScaleY = size === 'Large' ? 1.08 : 1.0;
      glass.scale.set(1, targetScaleY, 1);
    }
  }, [size]);

  // Touch / Pointer drag handlers for 3D orbital inspection
  const handlePointerDown = (e) => {
    pointerRef.current.isDown = true;
    pointerRef.current.startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
  };

  const handlePointerMove = (e) => {
    if (!pointerRef.current.isDown) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const deltaX = clientX - pointerRef.current.startX;
    pointerRef.current.startX = clientX;
    // Rotate glass within natural viewing angle
    pointerRef.current.targetRotationY = Math.max(-0.9, Math.min(0.9, pointerRef.current.targetRotationY + deltaX * 0.015));
  };

  const handlePointerUp = () => {
    pointerRef.current.isDown = false;
  };

  return (
    <div
      ref={containerRef}
      className="milk-vis-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      title="Interactive 3D Milk Visualization • Drag horizontally to rotate"
    >
      {webGlSupported ? (
        <canvas ref={canvasRef} className="milk-vis-canvas" />
      ) : (
        /* Graceful WebGL Fallback */
        <div className="milk-vis-fallback">
          <div className="milk-vis-fallback__glass">
            <div
              className="milk-vis-fallback__liquid"
              style={{
                height: hasPoured || isPouring ? '80%' : '0%',
                backgroundColor: currentMilk.colorHex
              }}
            />
          </div>
          <span className="text-[11px] font-bold text-navy">{currentMilk.label}</span>
        </div>
      )}

      {/* Floating active milk badge */}
      <div className="milk-vis-badge">
        <span
          className="milk-vis-badge__dot"
          style={{ backgroundColor: hasPoured ? currentMilk.colorHex : '#A89F91' }}
        />
        <span className="milk-vis-badge__text">
          {hasPoured ? `${currentMilk.label} • ${currentMilk.desc}` : 'Empty Glass • Select Milk'}
        </span>
      </div>

      {/* Replay Pour Animation Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          triggerPourAnimation(activeMilkKey);
        }}
        className="milk-vis-replay-btn"
        title="Replay milk pour animation"
        aria-label="Replay milk pour"
      >
        <RotateCcw className={`w-3.5 h-3.5 ${isPouring ? 'animate-spin' : ''}`} />
      </button>

      {/* Pouring status or drag hint */}
      {isPouring ? (
        <div className="milk-vis-pouring-indicator">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Pouring {currentMilk.label}...</span>
        </div>
      ) : (
        <span className="milk-vis-hint">
          {hasPoured ? 'Drag to rotate • 3D Glass' : 'Tap milk below to pour'}
        </span>
      )}
    </div>
  );
};

export const MilkVisualization = (props) => (
  <MilkErrorBoundary>
    <MilkVisualizationInner {...props} />
  </MilkErrorBoundary>
);
