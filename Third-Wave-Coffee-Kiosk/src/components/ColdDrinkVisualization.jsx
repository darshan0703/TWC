import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import './ColdDrinkVisualization.css';
import { RotateCcw, Sparkles } from 'lucide-react';
import { resolveMilkKey, MILK_VARIANTS } from './MilkVisualization';

/**
 * Procedurally creates a studio café equirectangular environment texture
 * for physically accurate glass refraction, specular sheen, and realistic lighting.
 */
function createStudioCafeEnvironment(renderer) {
  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Warm ambient café backdrop gradient (warm ceiling -> soft stone wall -> rich counter)
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#fffbf4');
    grad.addColorStop(0.25, '#f4ece2');
    grad.addColorStop(0.65, '#e0cfbe');
    grad.addColorStop(1.0, '#7a6552');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Primary studio softbox highlight stripe (creates signature vertical glass reflection)
    const softboxGrad = ctx.createLinearGradient(70, 0, 170, 0);
    softboxGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0)');
    softboxGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.95)');
    softboxGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.95)');
    softboxGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = softboxGrad;
    ctx.fillRect(70, 15, 100, 210);

    // Secondary subtle rim reflection on opposite side
    const rimGrad = ctx.createLinearGradient(380, 0, 440, 0);
    rimGrad.addColorStop(0.0, 'rgba(255, 250, 240, 0)');
    rimGrad.addColorStop(0.5, 'rgba(255, 250, 240, 0.7)');
    rimGrad.addColorStop(1.0, 'rgba(255, 250, 240, 0)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(380, 30, 60, 190);

    // Warm golden tabletop bounce highlight at the bottom
    const bounceGrad = ctx.createRadialGradient(256, 230, 10, 256, 230, 180);
    bounceGrad.addColorStop(0.0, 'rgba(235, 195, 150, 0.85)');
    bounceGrad.addColorStop(1.0, 'rgba(235, 195, 150, 0)');
    ctx.fillStyle = bounceGrad;
    ctx.fillRect(50, 160, 412, 90);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;

    texture.dispose();
    pmremGenerator.dispose();
    return envMap;
  } catch (e) {
    console.warn('Could not generate procedural environment map:', e);
    return null;
  }
}

/**
 * Generates an organic marbled cream & espresso swirl texture for iced coffees & lattes.
 */
function createMarbleSwirlTexture(coffeeHex, milkHex) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Rich dark espresso base
    ctx.fillStyle = coffeeHex;
    ctx.fillRect(0, 0, 512, 512);

    // Flowing milk cream ribbons
    for (let i = 0; i < 22; i++) {
      ctx.save();
      ctx.beginPath();
      const startX = (i * 28) % 512;
      ctx.moveTo(startX, 0);
      ctx.bezierCurveTo(
        startX + Math.sin(i * 1.3) * 110,
        130,
        startX - Math.cos(i * 0.9) * 90,
        340,
        startX + ((i % 2 === 0) ? 60 : -60),
        512
      );
      ctx.lineWidth = 14 + (i % 4) * 7;
      ctx.strokeStyle = milkHex;
      ctx.globalAlpha = 0.55 + (i % 3) * 0.15;
      ctx.stroke();
      ctx.restore();
    }

    // Soft milky cloud blooms
    for (let j = 0; j < 14; j++) {
      const x = (j * 67) % 480 + 16;
      const y = 60 + (j * 33) % 380;
      const rad = 28 + (j % 4) * 14;
      const radial = ctx.createRadialGradient(x, y, 0, x, y, rad);
      radial.addColorStop(0, milkHex);
      radial.addColorStop(1, 'transparent');
      ctx.fillStyle = radial;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  } catch (e) {
    console.warn('Could not generate marble texture:', e);
    return null;
  }
}

/**
 * Derives visual recipe configuration for any cold beverage product.
 */
export const resolveColdDrinkRecipe = (product) => {
  if (!product) {
    return {
      type: 'cold_brew',
      label: 'Cold Brew',
      hasIce: true,
      hasMilk: false,
      hasSauce: false,
      primaryColor: '#1c0c05',
      transmission: 0.5,
      roughness: 0.1,
      opacity: 0.88
    };
  }

  const id = (product.id || '').toLowerCase();
  const name = (product.name || '').toLowerCase();
  const subcat = (product.subcategory || '').toLowerCase();

  // 1. Milkshakes (e.g. Chocolicious, Strawberry Dream, Cookie & Cream)
  const isMilkshake =
    subcat.includes('milkshake') ||
    id.includes('milkshake') ||
    name.includes('milkshake') ||
    name.endsWith(' shake');

  if (isMilkshake) {
    if (id.includes('choco') || name.includes('choco')) {
      return {
        type: 'milkshake',
        label: 'Chocolate Milkshake',
        hasIce: false,
        hasMilk: true,
        hasSauce: true,
        primaryColor: '#3d2114',
        sauceColor: '#1a0b04',
        transmission: 0.0,
        roughness: 0.45,
        opacity: 1.0,
        hasWhippedTop: true
      };
    }
    if (id.includes('straw') || name.includes('straw')) {
      return {
        type: 'milkshake',
        label: 'Strawberry Milkshake',
        hasIce: false,
        hasMilk: true,
        hasSauce: false,
        primaryColor: '#e57c91',
        transmission: 0.0,
        roughness: 0.42,
        opacity: 1.0,
        hasWhippedTop: true
      };
    }
    return {
      type: 'milkshake',
      label: 'Cookie & Cream Milkshake',
      hasIce: false,
      hasMilk: true,
      hasSauce: true,
      primaryColor: '#ece3d6',
      sauceColor: '#25150d',
      transmission: 0.0,
      roughness: 0.44,
      opacity: 1.0,
      hasWhippedTop: true
    };
  }

  // 2. Cold Brews (Classic, Citrus Orange, Lemon)
  if (subcat.includes('cold_brew') || id.includes('cold_brew') || name.includes('cold brew')) {
    const isCitrus = id.includes('citrus') || id.includes('orange') || name.includes('orange');
    const isLemon = id.includes('lemon') || name.includes('lemon');
    return {
      type: 'cold_brew',
      label: isCitrus ? 'Citrus Orange Cold Brew' : (isLemon ? 'Lemon Cold Brew' : 'Classic Cold Brew'),
      hasIce: true,
      hasMilk: false,
      hasSauce: false,
      primaryColor: isCitrus ? '#2b1307' : (isLemon ? '#220f05' : '#1a0b04'),
      garnishColor: isCitrus ? '#e87313' : (isLemon ? '#edd13b' : null),
      transmission: 0.52,
      roughness: 0.08,
      opacity: 0.86
    };
  }

  // 3. Frappes (Caramel, Choco Hazelnut, Mocha Choco Chip, Toffee Nut)
  if (id.includes('mocha') || name.includes('mocha') || id.includes('choco')) {
    return {
      type: 'frappe',
      label: 'Mocha Choco Chip Frappe',
      hasIce: true,
      hasMilk: true,
      hasSauce: true,
      primaryColor: '#361b11',
      milkColor: '#f7ede2',
      sauceColor: '#170802',
      transmission: 0.05,
      roughness: 0.48,
      opacity: 1.0,
      isFrappeBlended: true
    };
  }

  if (id.includes('caramel') || name.includes('caramel') || id.includes('toffee')) {
    return {
      type: 'frappe',
      label: id.includes('toffee') ? 'Toffee Nut Frappe' : 'Caramel Frappe',
      hasIce: true,
      hasMilk: true,
      hasSauce: true,
      primaryColor: '#8a562d',
      milkColor: '#f8efe4',
      sauceColor: '#c7741d',
      transmission: 0.05,
      roughness: 0.46,
      opacity: 1.0,
      isFrappeBlended: true
    };
  }

  // 4. Iced Coffees & Shakerato (e.g. Classic Cold Coffee, Vietnamese Shakerato, Iced Latte)
  if (id.includes('cold_coffee') || id.includes('shakerato') || name.includes('cold coffee') || name.includes('shakerato') || id.includes('iced_latte')) {
    return {
      type: 'iced_latte',
      label: id.includes('shakerato') ? 'Vietnamese Shakerato' : 'Classic Cold Coffee',
      hasIce: true,
      hasMilk: true,
      hasSauce: false,
      primaryColor: '#2b1408',
      milkColor: '#f6ece0',
      transmission: 0.38,
      roughness: 0.16,
      opacity: 0.92,
      hasMarbleSwirl: true
    };
  }

  // 5. Iced Matcha (e.g. Strawberry Matcha Latte)
  if (subcat.includes('matcha') || id.includes('matcha')) {
    return {
      type: 'iced_matcha',
      label: 'Strawberry Matcha Latte',
      hasIce: true,
      hasMilk: true,
      hasSauce: true,
      primaryColor: '#4f7833',
      milkColor: '#faf7f0',
      sauceColor: '#b81f33',
      transmission: 0.35,
      roughness: 0.22,
      opacity: 0.94,
      isLayeredMatcha: true
    };
  }

  // 6. Iced Teas & Lemonades
  if (subcat.includes('iced_tea') || id.includes('tea') || id.includes('lemonade')) {
    const isStrawberry = id.includes('straw') || name.includes('straw');
    const isLemon = id.includes('lemon') || name.includes('lemon');
    return {
      type: 'iced_tea',
      label: isStrawberry ? 'Strawberry Iced Tea' : (isLemon ? 'Classic Lemonade' : 'Citrus Iced Tea'),
      hasIce: true,
      hasMilk: false,
      hasSauce: false,
      primaryColor: isStrawberry ? '#c42f41' : (isLemon ? '#e0c228' : '#be6522'),
      transmission: 0.74,
      roughness: 0.06,
      opacity: 0.76
    };
  }

  // 7. Cold-Pressed Juices (ABC, Valencia Orange)
  if (subcat.includes('juice') || id.includes('juice')) {
    const isABC = id.includes('abc');
    return {
      type: 'juice',
      label: isABC ? 'ABC Juice' : 'Valencia Orange Juice',
      hasIce: true,
      hasMilk: false,
      hasSauce: false,
      primaryColor: isABC ? '#6e0c15' : '#e2690d',
      transmission: 0.44,
      roughness: 0.14,
      opacity: 0.88
    };
  }

  // Neutral Fallback
  return {
    type: 'iced_drink',
    label: product.name || 'Cold Drink',
    hasIce: true,
    hasMilk: Boolean(product.customizable),
    hasSauce: false,
    primaryColor: '#261208',
    milkColor: '#f5ece1',
    transmission: 0.48,
    roughness: 0.14,
    opacity: 0.88
  };
};

/**
 * ColdDrinkVisualization Component
 *
 * Renders a genuinely 3D, physically realistic transparent drinking glass using Three.js WebGL:
 * - High-refraction double-walled glass body with heavy weighted crystal base & rounded rim
 * - Procedural café studio environment map producing vivid highlights and reflections
 * - Crystalline 3D ice cubes with authentic refraction, kept strictly inside the glass walls
 * - Dynamic product-specific liquid appearance: dark translucent cold brew, marbled cream swirls,
 *   thick frappe/shake consistency, and vibrant jewel iced teas & juices
 * - Authentic outer condensation beads glistening on the exterior glass wall
 * - Fluid animations: gentle liquid ripples, bobbing ice cubes, interactive drag tilt, and 360° spin
 */
export const ColdDrinkVisualization = ({
  product,
  currentStep = 1,
  totalSteps = 4,
  stepKey = 'size',
  size = 'Regular',
  iceLevel = 'Regular Ice',
  selectedMilk = 'Regular',
  sweetness = 'Regular Sugar',
  pourTrigger = 0,
  productName = '',
  unitPrice = null,
  className = '',
  children
}) => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Mesh and scene object references
  const glassGroupRef = useRef(null);
  const iceCubesRef = useRef([]);
  const liquidMeshRef = useRef(null);
  const marbleMeshRef = useRef(null);
  const marbleTextureRef = useRef(null);
  const sauceMeshRef = useRef(null);
  const surfaceDiscRef = useRef(null);
  const whippedCrownRef = useRef(null);
  const pourStreamRef = useRef(null);

  const [webglSupported, setWebglSupported] = useState(true);
  const [isRotating, setIsRotating] = useState(false);

  // Derive active milk styling and product recipe
  const activeMilkKey = resolveMilkKey(selectedMilk);
  const currentMilk = MILK_VARIANTS[activeMilkKey] || MILK_VARIANTS.Regular;
  const recipe = useMemo(() => resolveColdDrinkRecipe(product), [product]);

  const isLarge = size === 'Large';

  // Target ice count strictly based on recipe
  const targetIceCount = useMemo(() => {
    if (!recipe.hasIce) return 0;
    if (iceLevel === 'No Ice') return 0;
    if (iceLevel === 'Light Ice') return 3;
    if (iceLevel === 'Extra Ice') return 8;
    return 6; // Regular Ice
  }, [recipe.hasIce, iceLevel]);

  // Touch / pointer drag for smooth 3D perspective rotation
  const dragStartRef = useRef(0);
  const isDraggingRef = useRef(false);
  const currentAngleRef = useRef(0);
  const targetAngleRef = useRef(0);

  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    dragStartRef.current = e.clientX || (e.touches && e.touches[0].clientX) || 0;
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const delta = clientX - dragStartRef.current;
    targetAngleRef.current = Math.max(-0.75, Math.min(0.75, delta * 0.007));
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    targetAngleRef.current = 0;
  };

  // Setup Three.js WebGL Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 360;
    let height = container.clientHeight || 500;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    // Position camera at comfortable café counter eye-level looking at center of glass
    camera.position.set(0, 0.5, 6.0);
    camera.lookAt(0, -0.05, 0);
    cameraRef.current = camera;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;

      // Environment reflections
      const envMap = createStudioCafeEnvironment(renderer);
      if (envMap) {
        scene.environment = envMap;
      }

      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (err) {
      console.warn('WebGL initialization failed, falling back:', err);
      setWebglSupported(false);
      return;
    }

    // 2. Cinematic Studio & Café Counter Lighting
    const ambientLight = new THREE.AmbientLight(0xfff6eb, 1.3);
    scene.add(ambientLight);

    // Warm key directional light from upper right
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(3.5, 4.8, 3.8);
    scene.add(keyLight);

    // Crisp cool rim light from behind left (defines crystalline glass edges)
    const rimLight = new THREE.DirectionalLight(0xc9e2ff, 2.0);
    rimLight.position.set(-3.8, 3.6, -3.2);
    scene.add(rimLight);

    // Under-table warm bounce light (illuminates thick solid glass base)
    const bounceLight = new THREE.PointLight(0xffedd4, 1.2, 10);
    bounceLight.position.set(0, -2.0, 2.2);
    scene.add(bounceLight);

    // Soft tabletop contact shadow plane
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const shadowCtx = shadowCanvas.getContext('2d');
    const shadowGrad = shadowCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
    shadowGrad.addColorStop(0.0, 'rgba(30, 20, 15, 0.45)');
    shadowGrad.addColorStop(0.4, 'rgba(40, 25, 20, 0.22)');
    shadowGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    shadowCtx.fillStyle = shadowGrad;
    shadowCtx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.62;
    scene.add(shadowMesh);

    // 3. 3D Glass Assembly Group
    const glassGroup = new THREE.Group();
    glassGroup.position.set(0, 0.35, 0);
    scene.add(glassGroup);
    glassGroupRef.current = glassGroup;

    // Premium physical glass material with authentic refraction and gloss
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.96,
      opacity: 1.0,
      transparent: true,
      roughness: 0.03,
      ior: 1.52,
      thickness: 1.4,
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Outer Tapered Cylindrical Glass Wall (Top R 1.15, Bottom R 0.88, Height 3.4)
    const glassWallGeom = new THREE.CylinderGeometry(1.15, 0.88, 3.4, 64, 1, true);
    const glassWall = new THREE.Mesh(glassWallGeom, glassMaterial);
    glassGroup.add(glassWall);

    // Solid Heavy Weighted Glass Base (Pedestal height 0.46, sitting at the bottom)
    const baseGeom = new THREE.CylinderGeometry(0.88, 0.85, 0.46, 64);
    const baseMesh = new THREE.Mesh(baseGeom, glassMaterial);
    baseMesh.position.y = -1.47;
    glassGroup.add(baseMesh);

    // Smooth Polished Glass Rim Lip (Torus at top opening)
    const rimGeom = new THREE.TorusGeometry(1.15, 0.038, 20, 64);
    const rimMesh = new THREE.Mesh(rimGeom, glassMaterial);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 1.7;
    glassGroup.add(rimMesh);

    // Condensation Micro-Droplets on Exterior Glass Wall
    const dropletGroup = new THREE.Group();
    const dropletMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.98,
      opacity: 0.92,
      roughness: 0.04,
      ior: 1.33,
      transparent: true,
      depthWrite: false
    });

    for (let i = 0; i < 34; i++) {
      const dropGeom = new THREE.SphereGeometry(0.024 + (i % 3) * 0.008, 10, 10);
      const drop = new THREE.Mesh(dropGeom, dropletMat);
      const yPos = -1.1 + (i / 34) * 2.5;
      const angle = (i * 1.39) % (Math.PI * 2);
      // Radius matches outer glass contour at yPos
      const r = (0.88 + ((yPos + 1.7) / 3.4) * 0.27) + 0.012;
      drop.position.set(Math.cos(angle) * r, yPos, Math.sin(angle) * r);
      // Elongate vertically to mimic gravity beads
      drop.scale.set(1.0, 1.35, 0.7);
      dropletGroup.add(drop);
    }
    glassGroup.add(dropletGroup);

    // 4. Crystalline 3D Ice Cubes
    const iceGroup = new THREE.Group();
    const iceMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.96,
      opacity: 0.94,
      roughness: 0.06,
      ior: 1.31,
      thickness: 0.9,
      specularIntensity: 1.0,
      transparent: true,
      depthWrite: false
    });

    // 8 distinct ice cube coordinates strictly constrained inside inner glass radius
    const iceCoordinates = [
      { x: 0.14, y: -0.78, z: 0.12, s: 0.42, rx: 0.35, ry: 0.4, rz: 0.2 },
      { x: -0.16, y: -0.45, z: -0.10, s: 0.40, rx: 0.8, ry: -0.5, rz: 0.4 },
      { x: 0.20, y: -0.14, z: -0.08, s: 0.44, rx: -0.3, ry: 0.6, rz: -0.2 },
      { x: -0.14, y: 0.18, z: 0.15, s: 0.42, rx: 0.5, ry: -0.2, rz: 0.7 },
      { x: 0.16, y: 0.50, z: 0.04, s: 0.44, rx: -0.6, ry: 0.4, rz: 0.3 },
      { x: -0.18, y: 0.82, z: -0.14, s: 0.42, rx: 0.3, ry: 0.8, rz: -0.5 },
      // Top glistening cubes emerging near surface
      { x: 0.08, y: 1.15, z: 0.12, s: 0.44, rx: -0.4, ry: -0.3, rz: 0.5 },
      { x: -0.06, y: 1.38, z: 0.02, s: 0.42, rx: 0.6, ry: 0.2, rz: -0.3 }
    ];

    const cubes = [];
    iceCoordinates.forEach((coord) => {
      const cubeGeom = new THREE.BoxGeometry(coord.s, coord.s, coord.s);
      const cube = new THREE.Mesh(cubeGeom, iceMaterial);
      cube.position.set(coord.x, coord.y, coord.z);
      cube.rotation.set(coord.rx, coord.ry, coord.rz);
      cube.userData = { initialY: coord.y, seed: Math.random() * 10 };
      iceGroup.add(cube);
      cubes.push(cube);
    });
    glassGroup.add(iceGroup);
    iceCubesRef.current = cubes;

    // 5. Main Liquid Column Inside Glass
    const liquidMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(recipe.primaryColor),
      transmission: recipe.transmission,
      roughness: recipe.roughness,
      opacity: recipe.opacity,
      transparent: true,
      depthWrite: false
    });

    const liquidGeom = new THREE.CylinderGeometry(1.08, 0.82, 2.7, 64);
    const liquidMesh = new THREE.Mesh(liquidGeom, liquidMat);
    liquidMesh.position.y = 0.12;
    glassGroup.add(liquidMesh);
    liquidMeshRef.current = liquidMesh;

    // Surface Disc Meniscus
    const discGeom = new THREE.CircleGeometry(1.08, 64);
    const discMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(recipe.primaryColor),
      roughness: 0.08,
      transmission: 0.2,
      transparent: true,
      opacity: 0.92
    });
    const surfaceDisc = new THREE.Mesh(discGeom, discMat);
    surfaceDisc.rotation.x = -Math.PI / 2;
    surfaceDisc.position.y = 1.47;
    glassGroup.add(surfaceDisc);
    surfaceDiscRef.current = surfaceDisc;

    // Animated Marble Swirl Mesh for Iced Coffees & Layered Cold Drinks
    const marbleTex = createMarbleSwirlTexture(recipe.primaryColor, currentMilk.colorHex || '#f6ece0');
    marbleTextureRef.current = marbleTex;

    const marbleMat = new THREE.MeshStandardMaterial({
      map: marbleTex,
      roughness: 0.35,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    });
    const marbleGeom = new THREE.CylinderGeometry(1.07, 0.81, 2.68, 64);
    const marbleMesh = new THREE.Mesh(marbleGeom, marbleMat);
    marbleMesh.position.y = 0.12;
    marbleMesh.visible = Boolean(recipe.hasMarbleSwirl);
    glassGroup.add(marbleMesh);
    marbleMeshRef.current = marbleMesh;

    // Sauce / Syrup Base Layer (Mocha Chocolate or Frappe Caramel)
    const sauceMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(recipe.sauceColor || '#1a0b04'),
      roughness: 0.28,
      opacity: 0.95,
      transparent: true,
      depthWrite: false
    });
    const sauceGeom = new THREE.CylinderGeometry(0.85, 0.82, 0.52, 64);
    const sauceMesh = new THREE.Mesh(sauceGeom, sauceMat);
    sauceMesh.position.y = -0.98;
    sauceMesh.visible = Boolean(recipe.hasSauce);
    glassGroup.add(sauceMesh);
    sauceMeshRef.current = sauceMesh;

    // Whipped Cream Peak for Milkshakes
    const crownGroup = new THREE.Group();
    const whippedMat = new THREE.MeshStandardMaterial({
      color: 0xfffcf5,
      roughness: 0.62,
      metalness: 0.04
    });
    const baseWhip = new THREE.TorusGeometry(0.88, 0.26, 16, 40);
    const baseWhipMesh = new THREE.Mesh(baseWhip, whippedMat);
    baseWhipMesh.rotation.x = Math.PI / 2;
    baseWhipMesh.position.y = 1.5;
    crownGroup.add(baseWhipMesh);

    const midWhip = new THREE.TorusGeometry(0.58, 0.22, 16, 32);
    const midWhipMesh = new THREE.Mesh(midWhip, whippedMat);
    midWhipMesh.rotation.x = Math.PI / 2;
    midWhipMesh.position.y = 1.76;
    crownGroup.add(midWhipMesh);

    const coneWhip = new THREE.ConeGeometry(0.42, 0.58, 28);
    const coneWhipMesh = new THREE.Mesh(coneWhip, whippedMat);
    coneWhipMesh.position.y = 2.05;
    crownGroup.add(coneWhipMesh);

    crownGroup.visible = Boolean(recipe.hasWhippedTop);
    glassGroup.add(crownGroup);
    whippedCrownRef.current = crownGroup;

    // Smooth Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Fluid interpolation for rotation tilt
      currentAngleRef.current = THREE.MathUtils.lerp(
        currentAngleRef.current,
        targetAngleRef.current,
        0.12
      );
      glassGroup.rotation.y = currentAngleRef.current;

      // Gentle floating micro-motion
      glassGroup.position.y = 0.35 + Math.sin(elapsedTime * 1.6) * 0.025;

      // Subtle ice cube fluid bobbing
      iceCubesRef.current.forEach((cube) => {
        if (cube.visible) {
          cube.position.y =
            cube.userData.initialY + Math.sin(elapsedTime * 2.2 + cube.userData.seed) * 0.03;
          cube.rotation.y += 0.0015;
        }
      });

      // Slowly drift marbled cream ripples for organic swirl illusion
      if (marbleTextureRef.current && marbleMeshRef.current && marbleMeshRef.current.visible) {
        marbleTextureRef.current.offset.y = (elapsedTime * 0.015) % 1.0;
        marbleTextureRef.current.offset.x = (elapsedTime * 0.008) % 1.0;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Responsive Resize Observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      if (marbleTextureRef.current) marbleTextureRef.current.dispose();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  // Synchronize dynamic customizations (Recipe, Milk, Ice Level, Size) with 3D Scene
  useEffect(() => {
    if (!glassGroupRef.current) return;

    // 1. Proportional Glass Scaling for Regular (350ml) vs Large (475ml)
    const targetScale = isLarge ? 1.08 : 1.0;
    glassGroupRef.current.scale.set(targetScale, targetScale, targetScale);

    // 2. Liquid Colors, Transmission & Opacity
    if (liquidMeshRef.current) {
      liquidMeshRef.current.material.color.set(recipe.primaryColor);
      liquidMeshRef.current.material.transmission = recipe.transmission;
      liquidMeshRef.current.material.roughness = recipe.roughness;
      liquidMeshRef.current.material.opacity = recipe.opacity;
    }

    if (surfaceDiscRef.current) {
      surfaceDiscRef.current.material.color.set(recipe.primaryColor);
    }

    // 3. Marbled Cream Swirl (for Iced Latte, Classic Cold Coffee, Shakerato)
    if (marbleMeshRef.current) {
      marbleMeshRef.current.visible = Boolean(recipe.hasMarbleSwirl);
      if (recipe.hasMarbleSwirl && marbleTextureRef.current) {
        // Re-generate texture with updated milk choice
        const updatedTex = createMarbleSwirlTexture(
          recipe.primaryColor,
          currentMilk.colorHex || '#f6ece0'
        );
        if (updatedTex) {
          marbleMeshRef.current.material.map = updatedTex;
          marbleMeshRef.current.material.needsUpdate = true;
          marbleTextureRef.current.dispose();
          marbleTextureRef.current = updatedTex;
        }
      }
    }

    // 4. Sauce / Chocolate / Caramel Layer
    if (sauceMeshRef.current) {
      sauceMeshRef.current.visible = Boolean(recipe.hasSauce);
      if (recipe.hasSauce && recipe.sauceColor) {
        sauceMeshRef.current.material.color.set(recipe.sauceColor);
      }
    }

    // 5. Whipped Crown for Milkshakes
    if (whippedCrownRef.current) {
      whippedCrownRef.current.visible = Boolean(recipe.hasWhippedTop);
    }

    // 6. Ice Cubes Visibility
    iceCubesRef.current.forEach((cube, idx) => {
      cube.visible = idx < targetIceCount;
    });
  }, [recipe, currentMilk, isLarge, targetIceCount]);

  // Replay animation: Smooth 360 degree showcase spin
  const handleReplay = (e) => {
    e.stopPropagation();
    if (isRotating) return;
    setIsRotating(true);
    targetAngleRef.current = Math.PI * 2;
    setTimeout(() => {
      if (glassGroupRef.current) {
        glassGroupRef.current.rotation.y = 0;
      }
      currentAngleRef.current = 0;
      targetAngleRef.current = 0;
      setIsRotating(false);
    }, 900);
  };

  return (
    <div
      className={`cold-drink-vis-stage ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="cold-drink-vis-canvas-container" />

      {/* Fallback Display if WebGL is unavailable */}
      {!webglSupported && (
        <div className="cold-drink-vis-fallback">
          <img
            src="/craft/cold_coffee_thumb.jpg"
            alt={recipe.label}
            className="w-48 h-auto object-contain rounded-2xl drop-shadow-2xl"
          />
        </div>
      )}

      {/* Top Left: Glass & Recipe Badge */}
      <div className="cold-drink-vis-pill">
        <span
          className="cold-drink-vis-dot"
          style={{
            backgroundColor: recipe.hasMilk ? currentMilk.colorHex : recipe.primaryColor
          }}
        />
        <span className="cold-drink-vis-pill-text">
          {recipe.hasIce
            ? `${isLarge ? 'Large Glass (475ml)' : 'Regular Glass (350ml)'} • ${iceLevel}`
            : isLarge
            ? 'Large Glass (475ml)'
            : 'Regular Glass (350ml)'}
        </span>
      </div>

      {/* Top Right: Price Pill & Replay Action */}
      <div className="cold-drink-vis-top-right">
        {unitPrice != null && (
          <div className="cold-drink-vis-price-pill">
            <span className="text-[10px] font-black uppercase tracking-wider text-navy truncate max-w-[120px]">
              {productName || recipe.label}
            </span>
            <span className="text-xs font-black text-navy font-sans">
              ₹{unitPrice}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={handleReplay}
          className="cold-drink-vis-replay-action"
          title="360° Inspect Glass"
          aria-label="360 degree inspect glass"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Lower Slot: Overlaid Floating AI Cashier Customization Card */}
      {children && (
        <div className="cold-drink-vis-floating-card-slot">
          {children}
        </div>
      )}
    </div>
  );
};
