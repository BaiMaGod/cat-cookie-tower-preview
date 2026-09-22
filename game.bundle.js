/* production preview bundle; no sourcemap */
const TAU = Math.PI * 2;

function normalizeAngle(a) {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}

function angleInArc(angle, start, width) {
  const a = normalizeAngle(angle);
  const s = normalizeAngle(start);
  const d = normalizeAngle(a - s);
  return d <= width;
}

class GameRules {
  constructor({ initialJumps = 5, maxJumps = 10 } = {}) {
    this.initialJumps = initialJumps;
    this.maxJumps = maxJumps;
    this.reset();
  }

  reset() {
    this.jumps = this.initialJumps;
    this.score = 0;
    this.depth = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.alive = true;
    this.deathReason = null;
    this.fullBonus = 0;
  }

  bounce() {
    if (!this.alive) return false;
    if (this.jumps <= 0) {
      this.starve();
      return false;
    }
    this.jumps -= 1;
    return true;
  }

  passLayer() {
    if (!this.alive) return;
    this.depth += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);

    const mult = this.combo >= 5 ? 10 : this.combo === 4 ? 7 : this.combo === 3 ? 4 : this.combo === 2 ? 2 : 1;
    this.score += 10 * mult;

    if (this.jumps < this.maxJumps) {
      this.jumps += 1;
    } else {
      this.fullBonus += 1;
      this.score += 25 * this.combo;
    }
  }

  land() {
    if (!this.alive) return;
    this.combo = 0;
  }

  starve() {
    if (!this.alive) return;
    this.alive = false;
    this.deathReason = 'starved';
  }

  hitHazard() {
    if (!this.alive) return;
    this.alive = false;
    this.deathReason = 'hazard';
  }
}

class SeededRandom {
  constructor(seed = Date.now() >>> 0) {
    this.state = seed >>> 0 || 0x12345678;
  }
  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }
  range(min, max) { return min + (max - min) * this.next(); }
  int(min, maxInclusive) { return Math.floor(this.range(min, maxInclusive + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
}

function gapWidthForDepth(depth, rng) {
  let minDeg = 60, maxDeg = 75;
  if (depth >= 80) [minDeg, maxDeg] = [35, 45];
  else if (depth >= 40) [minDeg, maxDeg] = [40, 50];
  else if (depth >= 20) [minDeg, maxDeg] = [45, 60];
  else if (depth >= 10) [minDeg, maxDeg] = [50, 65];
  return rng.range(minDeg, maxDeg) * Math.PI / 180;
}

function hazardRatioForDepth(depth) {
  if (depth < 8) return 0;
  if (depth < 20) return 0.06;
  if (depth < 40) return 0.10;
  if (depth < 60) return 0.15;
  if (depth < 80) return 0.19;
  return 0.23;
}

class LayerGenerator {
  constructor(seed = 12345) {
    this.rng = new SeededRandom(seed);
    this.chainRemaining = 0;
    this.chainAngle = 0;
    this.prevGapAngle = 0;
  }

  _maybeStartChain(depth) {
    if (this.chainRemaining > 0) return;
    const r = this.rng.next();
    let len = 0;
    if (r < 0.02) len = 5;
    else if (r < 0.07) len = 4;
    else if (r < 0.19) len = 3;
    else if (r < 0.44) len = 2;
    if (depth < 8 && len > 2) len = 2;
    if (len) {
      this.chainRemaining = len;
      this.chainAngle = normalizeAngle(this.prevGapAngle + this.rng.range(-0.25, 0.25));
    }
  }

  create(depth, lowJumps = false) {
    this._maybeStartChain(depth);
    let width = gapWidthForDepth(depth, this.rng);
    if (lowJumps) width += 10 * Math.PI / 180;

    let primaryAngle;
    let chain = false;
    if (this.chainRemaining > 0) {
      chain = true;
      this.chainAngle = normalizeAngle(this.chainAngle + this.rng.range(-0.23, 0.23));
      primaryAngle = this.chainAngle;
      this.chainRemaining--;
    } else {
      primaryAngle = normalizeAngle(this.prevGapAngle + this.rng.range(-1.5, 1.5));
    }
    this.prevGapAngle = primaryAngle;

    const gaps = [{ start: normalizeAngle(primaryAngle - width / 2), width }];
    if (depth > 20 && this.rng.chance(0.25)) {
      const w2 = width * this.rng.range(0.65, 0.9);
      const center2 = normalizeAngle(primaryAngle + this.rng.range(1.6, 3.6));
      gaps.push({ start: normalizeAngle(center2 - w2 / 2), width: w2 });
    }

    let hazardRatio = hazardRatioForDepth(depth);
    if (lowJumps) hazardRatio *= 0.7;
    const hazards = [];
    if (hazardRatio > 0) {
      const target = hazardRatio * TAU;
      let built = 0;
      for (let i = 0; i < 8 && built < target; i++) {
        const w = Math.min(target - built, this.rng.range(0.18, 0.45));
        const start = this.rng.range(0, TAU);
        // Keep hazards away from gap centers by sampling the midpoint.
        const mid = normalizeAngle(start + w / 2);
        if (!gaps.some(g => angleInArc(mid, g.start - 0.10, g.width + 0.20))) {
          hazards.push({ start, width: w });
          built += w;
        }
      }
    }

    return { depth, gaps, hazards, chain, primaryAngle, width };
  }
}

const THREE = globalThis.__THREE__;
if (!THREE) throw new Error('Three.js 未加载');
const gameEl = document.getElementById('game');
const frameEl = document.getElementById('phoneFrame');
const catDom = document.getElementById('catSprite');
const loadingEl = document.getElementById('loading');
const hud = {
  depth: document.getElementById('depth'),
  jumps: document.getElementById('jumps'),
  score: document.getElementById('score'),
  jumpBox: document.getElementById('jumpBox'),
  combo: document.getElementById('combo'),
  toast: document.getElementById('toast'),
  gameOver: document.getElementById('gameOver'),
  deathEmoji: document.getElementById('deathEmoji'),
  deathTitle: document.getElementById('deathTitle'),
  deathText: document.getElementById('deathText'),
  finalDepth: document.getElementById('finalDepth'),
  finalCombo: document.getElementById('finalCombo'),
  finalScore: document.getElementById('finalScore'),
  restartBtn: document.getElementById('restartBtn'),
};

const CONFIG = Object.freeze({
  initialJumps: 5,
  maxJumps: 10,
  layerGap: 1.82,
  platformRadius: 2.95,
  platformThickness: 0.58,
  pillarRadius: 0.72,
  catRadius: 0.31,
  catRadiusAtMax: 0.37,
  catZ: 2.30,
  gravity: -10.2,
  jumpVelocity: 5.25,
  landingPause: 0.08,
  dragTurnsPerScreen: 240 * Math.PI / 180,
  sliceCount: 12,
  aheadLayers: 14,
  keepBehind: 5,
  cameraFollow: 6.1,
  breakthroughCombo: 5,
  minGapSlices: 2,
  smashBounceVelocity: 4.15,
});

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.Fog(0xdff7ff, 16, 36);

const initialW = Math.max(gameEl.clientWidth, 320);
const initialH = Math.max(gameEl.clientHeight, 568);
const camera = new THREE.PerspectiveCamera(35, initialW / initialH, 0.1, 140);
camera.position.set(0.22, 5.0, 9.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(initialW, initialH, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setClearColor(0xffffff, 0);
gameEl.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xf8ffff, 0x88b7c9, 2.9);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 3.5);
key.position.set(6, 10, 8);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
scene.add(key);
const fill = new THREE.DirectionalLight(0xffc5e3, 1.25);
fill.position.set(-7, 3, -5);
scene.add(fill);

const towerRoot = new THREE.Group();
scene.add(towerRoot);

const textureLoader = new THREE.TextureLoader();
function loadArtTexture(url) {
  const tex = textureLoader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

const safeJellyTexture = loadArtTexture('./assets/jelly-safe.webp');
const dangerJellyTexture = loadArtTexture('./assets/jelly-danger.webp');
const jellyBurstTexture = loadArtTexture('./assets/jelly-burst.svg');

const matCookie = new THREE.MeshPhysicalMaterial({
  color: 0x8bf4aa,
  roughness: 0.12,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  transmission: 0.26,
  transparent: true,
  opacity: 0.90,
  thickness: 0.85,
  ior: 1.34,
  emissive: 0x123d23,
  emissiveIntensity: 0.035,
});
const matCookieAlt = new THREE.MeshPhysicalMaterial({
  color: 0xb6f9c8,
  roughness: 0.14,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
  transmission: 0.22,
  transparent: true,
  opacity: 0.91,
  thickness: 0.82,
  ior: 1.34,
});
const matHazard = new THREE.MeshPhysicalMaterial({
  color: 0xd91f69,
  roughness: 0.10,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  transmission: 0.16,
  transparent: true,
  opacity: 0.94,
  thickness: 0.90,
  ior: 1.36,
  emissive: 0x5a0827,
  emissiveIntensity: 0.13,
});
const matChip = new THREE.MeshPhysicalMaterial({
  color: 0xd6ffe2,
  roughness: 0.08,
  transmission: 0.30,
  transparent: true,
  opacity: 0.72,
  clearcoat: 1,
});

// Cream-and-pink candy pillar, built as real 3D geometry so depth/occlusion
// matches the platforms. The dimensions are intentionally slimmer than the
// jelly ring so the center column stays readable without swallowing gameplay.
const matPillarCream = new THREE.MeshPhysicalMaterial({
  color: 0xffe6aa,
  roughness: 0.34,
  metalness: 0,
  clearcoat: 0.88,
  clearcoatRoughness: 0.10,
});
const matPillarCreamAlt = new THREE.MeshPhysicalMaterial({
  color: 0xffefc4,
  roughness: 0.31,
  metalness: 0,
  clearcoat: 0.92,
  clearcoatRoughness: 0.09,
});
const matCandyPink = new THREE.MeshPhysicalMaterial({
  color: 0xff78a7,
  roughness: 0.22,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
});
const matCandyWhite = new THREE.MeshPhysicalMaterial({
  color: 0xfff5ef,
  roughness: 0.20,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
});
const matPawPink = new THREE.MeshPhysicalMaterial({
  color: 0xff7fa8,
  roughness: 0.20,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
});
const matFaceLine = new THREE.MeshStandardMaterial({
  color: 0xc96f43,
  roughness: 0.72,
  metalness: 0,
});

const pillarBodyGeo = new THREE.CylinderGeometry(
  CONFIG.pillarRadius,
  CONFIG.pillarRadius,
  CONFIG.layerGap + 0.06,
  36,
);
const candyArcGeo = new THREE.TorusGeometry(
  CONFIG.pillarRadius + 0.14,
  0.13,
  12,
  12,
  (TAU / 8) * 0.90,
);
candyArcGeo.rotateX(Math.PI / 2);
const faceGeo = new THREE.SphereGeometry(0.34, 24, 18);
const earGeo = new THREE.ConeGeometry(0.105, 0.20, 4);
const eyeGeo = new THREE.TorusGeometry(0.040, 0.008, 6, 14, Math.PI);
const noseGeo = new THREE.SphereGeometry(0.021, 10, 8);
const pawPadGeo = new THREE.SphereGeometry(0.105, 16, 12);
const pawToeGeo = new THREE.SphereGeometry(0.045, 12, 10);
const sideDotGeo = new THREE.SphereGeometry(0.060, 12, 10);

function createCandyRing() {
  const group = new THREE.Group();
  const step = TAU / 8;
  for (let i = 0; i < 8; i++) {
    const arc = new THREE.Mesh(candyArcGeo, i % 2 ? matCandyWhite : matCandyPink);
    arc.rotation.y = -i * step;
    arc.castShadow = false;
    arc.receiveShadow = true;
    group.add(arc);
  }
  return group;
}

function createCatFaceBadge() {
  const group = new THREE.Group();

  const face = new THREE.Mesh(faceGeo, matPillarCreamAlt);
  face.scale.set(1.08, 0.82, 0.20);
  face.castShadow = false;
  group.add(face);

  const earL = new THREE.Mesh(earGeo, matPillarCreamAlt);
  earL.position.set(-0.18, 0.22, -0.005);
  earL.rotation.z = -0.30;
  earL.rotation.y = Math.PI / 4;
  earL.scale.z = 0.65;
  group.add(earL);

  const earR = earL.clone();
  earR.position.x = 0.18;
  earR.rotation.z = 0.30;
  earR.rotation.y = -Math.PI / 4;
  group.add(earR);

  const eyeL = new THREE.Mesh(eyeGeo, matFaceLine);
  eyeL.position.set(-0.115, 0.015, 0.074);
  eyeL.rotation.z = Math.PI;
  group.add(eyeL);

  const eyeR = eyeL.clone();
  eyeR.position.x = 0.115;
  group.add(eyeR);

  const nose = new THREE.Mesh(noseGeo, matFaceLine);
  nose.position.set(0, -0.035, 0.082);
  nose.scale.set(1.25, 0.82, 0.65);
  group.add(nose);

  const mouthL = new THREE.Mesh(eyeGeo, matFaceLine);
  mouthL.scale.setScalar(0.70);
  mouthL.position.set(-0.035, -0.080, 0.080);
  mouthL.rotation.z = 0.15;
  group.add(mouthL);

  const mouthR = mouthL.clone();
  mouthR.position.x = 0.035;
  mouthR.rotation.z = -0.15;
  group.add(mouthR);

  return group;
}

function createPawBadge(scale = 1) {
  const group = new THREE.Group();

  const pad = new THREE.Mesh(pawPadGeo, matPawPink);
  pad.scale.set(1.30, 1.05, 0.26);
  pad.position.y = -0.035;
  group.add(pad);

  const toes = [
    [-0.105, 0.090],
    [-0.035, 0.135],
    [0.035, 0.135],
    [0.105, 0.090],
  ];
  for (const [x, y] of toes) {
    const toe = new THREE.Mesh(pawToeGeo, matPawPink);
    toe.scale.set(1, 1, 0.30);
    toe.position.set(x, y, 0.015);
    group.add(toe);
  }

  group.scale.setScalar(scale);
  return group;
}

function createPillarModule(index) {
  const group = new THREE.Group();
  group.position.y = -index * CONFIG.layerGap;

  const body = new THREE.Mesh(
    pillarBodyGeo,
    index % 2 ? matPillarCreamAlt : matPillarCream,
  );
  body.position.y = -CONFIG.layerGap / 2;
  body.castShadow = false;
  body.receiveShadow = true;
  group.add(body);

  const ring = createCandyRing();
  ring.position.y = -0.035;
  group.add(ring);

  const face = createCatFaceBadge();
  face.position.set(0, -0.66, CONFIG.pillarRadius + 0.055);
  group.add(face);

  const paw = createPawBadge(0.82);
  paw.position.set(0, -1.28, CONFIG.pillarRadius + 0.070);
  group.add(paw);

  // Small glossy pink decorations on the sides, like the reference pillar.
  for (const side of [-1, 1]) {
    const dot = new THREE.Mesh(sideDotGeo, matPawPink);
    dot.scale.set(0.75, 1.35, 0.65);
    dot.position.set(side * 0.56, -0.92, 0.50);
    group.add(dot);
  }

  if (index === 0) {
    const topRim = new THREE.Mesh(
      new THREE.TorusGeometry(CONFIG.pillarRadius + 0.05, 0.17, 16, 40),
      matPillarCreamAlt,
    );
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = 0.30;
    group.add(topRim);

    const innerTop = new THREE.Mesh(
      new THREE.CylinderGeometry(CONFIG.pillarRadius * 0.70, CONFIG.pillarRadius * 0.70, 0.075, 36),
      new THREE.MeshStandardMaterial({ color: 0xd59a55, roughness: 0.72 }),
    );
    innerTop.position.y = 0.255;
    group.add(innerTop);
  }

  pillarRoot.add(group);
  pillarModules.set(index, group);
}

function ensurePillarModules() {
  const start = Math.max(0, rules.depth - CONFIG.keepBehind - 1);
  const end = rules.depth + CONFIG.aheadLayers + 2;

  for (let i = start; i <= end; i++) {
    if (!pillarModules.has(i)) createPillarModule(i);
  }

  for (const [i, group] of pillarModules) {
    if (i < start - 1 || i > end + 1) {
      pillarRoot.remove(group);
      pillarModules.delete(i);
    }
  }
}

function clearPillarModules() {
  for (const group of pillarModules.values()) pillarRoot.remove(group);
  pillarModules.clear();
}

const safeSpriteMat = new THREE.SpriteMaterial({
  map: safeJellyTexture,
  transparent: true,
  depthTest: true,
  depthWrite: false,
});
const dangerSpriteMat = new THREE.SpriteMaterial({
  map: dangerJellyTexture,
  transparent: true,
  depthTest: true,
  depthWrite: false,
});

// The pillar is a real Three.js object. It intentionally lives outside
// towerRoot so dragging rotates the jelly platforms around a stationary
// center column instead of rotating a fake screen-space background.
const pillarRoot = new THREE.Group();
scene.add(pillarRoot);
const pillarModules = new Map();

// Background decoration now comes from the actual jelly-paradise artwork.
const decoGroup = new THREE.Group();
scene.add(decoGroup);

const catSources = {
  idle: './assets/cat-idle.webp',
  fall: './assets/cat-fall.webp',
  eat: './assets/cat-fall.webp',
  squash: './assets/cat-squash.webp',
  fail: './assets/cat-fail.webp',
};

function createCat() {
  const root = new THREE.Group();
  root.position.set(0, 0, CONFIG.catZ);
  scene.add(root);

  const visual = new THREE.Group();
  root.add(visual);

  const mouthAnchor = new THREE.Object3D();
  mouthAnchor.position.set(0, 0.14, 0.10);
  root.add(mouthAnchor);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.40, 30),
    new THREE.MeshBasicMaterial({ color: 0x315c55, transparent: true, opacity: 0.13, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -0.38, 0);
  root.add(shadow);

  return {
    root,
    visual,
    mouthAnchor,
    shadow,
    currentTexture: 'idle',
    eatTimer: 0,
  };
}

function setCatTexture(name) {
  if (cat.currentTexture === name) return;
  cat.currentTexture = name;
  catDom.src = catSources[name];
}

const cat = createCat();

const rules = new GameRules({ initialJumps: CONFIG.initialJumps, maxJumps: CONFIG.maxJumps });
let generator = new LayerGenerator((Date.now() ^ 0xA11CE) >>> 0);
const layers = new Map();
const effects = [];

// Large rounded jelly blocks: twelve chunky pieces around the tower, matching
// the approved art direction instead of dozens of thin radial slivers.
const SLICE = TAU / CONFIG.sliceCount;
function roundedRectShape(width, depth, radius) {
  const w = width / 2;
  const d = depth / 2;
  const r = Math.min(radius, w, d);
  const s = new THREE.Shape();
  s.moveTo(-w + r, -d);
  s.lineTo(w - r, -d);
  s.quadraticCurveTo(w, -d, w, -d + r);
  s.lineTo(w, d - r);
  s.quadraticCurveTo(w, d, w - r, d);
  s.lineTo(-w + r, d);
  s.quadraticCurveTo(-w, d, -w, d - r);
  s.lineTo(-w, -d + r);
  s.quadraticCurveTo(-w, -d, -w + r, -d);
  s.closePath();
  return s;
}
function createJellyBlockGeometry(width, depth, height) {
  const geo = new THREE.ExtrudeGeometry(
    roundedRectShape(width, depth, 0.22),
    {
      depth: height,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.075,
      bevelThickness: 0.075,
      curveSegments: 7,
    },
  );
  geo.rotateX(Math.PI / 2);
  geo.translate(0, height / 2, 0);
  geo.computeVertexNormals();
  return geo;
}
const JELLY_RADIUS = 2.08;
const jellyBlockGeo = createJellyBlockGeometry(0.92, 1.55, CONFIG.platformThickness);
const cookieChunkGeo = new THREE.BoxGeometry(0.24, 0.14, 0.22);
const crumbGeo = new THREE.SphereGeometry(0.065, 8, 7);

function arcType(layerData, angle) {
  if (layerData.gaps.some((g) => angleInArc(angle, g.start, g.width))) return 'gap';
  if (layerData.hazards.some((h) => angleInArc(angle, h.start, h.width))) return 'hazard';
  return 'safe';
}

function enforceVisiblePrimaryGap(data) {
  const requestedSlices = Math.ceil(data.gaps[0].width / SLICE);
  const gapSlices = Math.max(CONFIG.minGapSlices, requestedSlices);
  const centerIndex = Math.floor(normalizeAngle(data.primaryAngle) / SLICE);
  const firstIndex = centerIndex - Math.floor((gapSlices - 1) / 2);
  const start = normalizeAngle(firstIndex * SLICE);
  const width = gapSlices * SLICE;

  data.gaps[0] = { start, width };
  data.primaryAngle = normalizeAngle(start + width / 2);
  data.width = width;
  return gapSlices;
}

function makeLayer(index) {
  const data = generator.create(index, rules.jumps <= 2);
  const requiredGapSlices = enforceVisiblePrimaryGap(data);
  const group = new THREE.Group();
  group.position.y = -index * CONFIG.layerGap;
  towerRoot.add(group);

  const segments = [];
  let renderedGapSlices = 0;
  for (let i = 0; i < CONFIG.sliceCount; i++) {
    const angle = i * SLICE + SLICE / 2;
    const type = arcType(data, angle);
    if (type === 'gap') {
      renderedGapSlices += 1;
      continue;
    }

    const cell = new THREE.Group();
    cell.position.set(Math.sin(angle) * JELLY_RADIUS, 0, Math.cos(angle) * JELLY_RADIUS);
    cell.rotation.y = angle;
    group.add(cell);

    const base = new THREE.Mesh(
      jellyBlockGeo,
      type === 'hazard' ? matHazard : (i % 2 ? matCookie : matCookieAlt),
    );
    base.castShadow = false;
    base.receiveShadow = true;
    cell.add(base);

    // Actual approved jelly artwork is layered on top of the physical block.
    // It carries the bubbles, glossy edge, paw imprint / poison skull.
    const art = new THREE.Sprite(type === 'hazard' ? dangerSpriteMat.clone() : safeSpriteMat.clone());
    art.position.set(0, CONFIG.platformThickness * 0.34, 0.04);
    art.scale.set(type === 'hazard' ? 1.28 : 1.24, type === 'hazard' ? 1.28 : 1.24, 1);
    art.material.rotation = -angle;
    art.renderOrder = 4;
    cell.add(art);

    segments.push(cell);
  }

  if (renderedGapSlices < requiredGapSlices) {
    console.error('Invalid jelly layer: visible gap missing', { index, renderedGapSlices, requiredGapSlices, data });
    towerRoot.remove(group);
    return makeLayer(index);
  }

  const layer = { index, data, group, segments, eaten: false };
  layers.set(index, layer);
  return layer;
}

function ensureLayers() {
  const start = Math.max(0, rules.depth);
  const end = rules.depth + CONFIG.aheadLayers;
  for (let i = start; i <= end; i++) {
    if (!layers.has(i)) makeLayer(i);
  }
  for (const [i, layer] of layers) {
    if (i < rules.depth - CONFIG.keepBehind) {
      towerRoot.remove(layer.group);
      layers.delete(i);
    }
  }
}

function clearLayers() {
  for (const layer of layers.values()) towerRoot.remove(layer.group);
  layers.clear();
}

function localAngleUnderCat() {
  // Our CylinderGeometry convention is angle 0 on +Z. Cat sits on world +Z.
  return normalizeAngle(-towerRoot.rotation.y);
}

function getCatRadius() {
  const t = THREE.MathUtils.clamp(rules.jumps / CONFIG.maxJumps, 0, 1);
  return THREE.MathUtils.lerp(CONFIG.catRadius * 0.83, CONFIG.catRadiusAtMax, t);
}

function targetCatScale() {
  const t = THREE.MathUtils.clamp(rules.jumps / CONFIG.maxJumps, 0, 1);
  return THREE.MathUtils.lerp(0.68, 0.98, t);
}

function layerTopY(layer) {
  return layer.group.position.y + CONFIG.platformThickness / 2;
}

function platformStatus(layer) {
  const angle = localAngleUnderCat();
  if (layer.data.gaps.some((g) => angleInArc(angle, g.start, g.width))) return 'gap';
  if (layer.data.hazards.some((h) => angleInArc(angle, h.start, h.width))) return 'hazard';
  return 'safe';
}

function showCombo(n) {
  if (n < 2) return;
  hud.combo.textContent = `连吃 ×${n}`;
  hud.combo.classList.remove('show');
  void hud.combo.offsetWidth;
  hud.combo.classList.add('show');
}

function spawnPlusOne() {
  const el = document.createElement('div');
  el.className = 'plus-one';
  el.textContent = '+1 弹跳';
  frameEl.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

let pulse = 0;
let squash = 0;
let deadShown = false;
let state = 'idle';
let vy = 0;
let landingTimer = 0;
let previousBottom = 0;
let firstInput = false;
let smashReady = false;
let smashLayer = null;
let smashTimer = 0;
let smashBaseY = 0;

function updateHUD() {
  hud.depth.textContent = String(rules.depth);
  hud.jumps.textContent = `× ${rules.jumps}`;
  hud.score.textContent = String(rules.score);
  hud.jumpBox.classList.toggle('warning', rules.jumps <= 2 && rules.alive);
}

function consumeBounce() {
  if (!rules.bounce()) {
    state = 'starved';
    showGameOver('starved');
    return false;
  }
  updateHUD();
  pulse = -0.08;
  vy = CONFIG.jumpVelocity;
  state = 'bouncing';
  return true;
}

function landOn(layer) {
  cleanupLayersAbove(layer.index);
  cat.root.position.y = layerTopY(layer) + getCatRadius();
  vy = 0;
  rules.land();
  state = 'landed';
  landingTimer = CONFIG.landingPause;
  squash = 1;
  updateHUD();
}

function getMouthWorldPosition() {
  const p = new THREE.Vector3();
  cat.mouthAnchor.getWorldPosition(p);
  return p;
}

function cleanupLayersAbove(landedIndex) {
  const stale = [...layers.values()]
    .filter((l) => l.index < landedIndex && !l.eaten)
    .sort((a, b) => a.index - b.index);

  for (const layer of stale) {
    layer.eaten = true;
    spawnEatFragments(layer);
    towerRoot.remove(layer.group);
    layers.delete(layer.index);
  }
}

function spawnJellyBurst(position, scale = 1.55) {
  const mat = new THREE.SpriteMaterial({
    map: jellyBurstTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 0.88,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.copy(position);
  sprite.scale.set(scale, scale, 1);
  sprite.renderOrder = 15;
  scene.add(sprite);
  effects.push({ kind: 'burst', mesh: sprite, duration: 0.34, t: 0, initialScale: scale });
}

function spawnEatFragments(layer) {
  cat.eatTimer = Math.max(cat.eatTimer, 0.26);
  const chunkCount = 28;
  for (let i = 0; i < chunkCount; i++) {
    const angle = (i / chunkCount) * TAU + (layer.index % 7) * 0.13;
    const radius = 1.0 + (i % 4) * 0.45 + Math.random() * 0.18;
    const local = new THREE.Vector3(
      Math.sin(angle) * radius,
      layer.group.position.y + (Math.random() - 0.5) * 0.10,
      Math.cos(angle) * radius,
    );
    const world = towerRoot.localToWorld(local.clone());
    const mesh = new THREE.Mesh(
      i % 4 === 0 ? crumbGeo : cookieChunkGeo,
      i % 5 === 0 ? matChip : (i % 2 ? matCookieAlt : matCookie),
    );
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const scale = i % 4 === 0 ? 0.8 + Math.random() * 0.8 : 0.75 + Math.random() * 0.65;
    mesh.scale.setScalar(scale);
    mesh.position.copy(world);
    mesh.rotation.set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU);
    scene.add(mesh);
    effects.push({
      mesh,
      start: world.clone(),
      kind: 'chunk',
      lift: 0.36 + Math.random() * 0.48,
      orbitPhase: Math.random() * TAU,
      orbitAmp: 0.14 + Math.random() * 0.20,
      spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
      duration: 0.34 + Math.random() * 0.15,
      t: 0,
      initialScale: mesh.scale.x,
    });
  }

  const mouth = getMouthWorldPosition();
  const impact = new THREE.Vector3(0, layer.group.position.y + 0.10, CONFIG.catZ);
  spawnJellyBurst(impact, 1.60);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.03, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xbaffcf, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  ring.position.copy(mouth);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  effects.push({ kind: 'ring', mesh: ring, duration: 0.24, t: 0 });
}

function beginEat(layer) {
  if (layer.eaten) return;
  layer.eaten = true;
  rules.passLayer();
  if (rules.combo === CONFIG.breakthroughCombo) smashReady = true;
  pulse = Math.min(0.22, pulse + 0.10);
  spawnPlusOne();
  showCombo(rules.combo);
  updateHUD();

  spawnEatFragments(layer);
  towerRoot.remove(layer.group);
  layers.delete(layer.index);
}

function startLandingSmash(layer) {
  if (layer.eaten || !smashReady) return;

  smashReady = false;
  smashLayer = layer;
  smashBaseY = layerTopY(layer) + getCatRadius();
  cat.root.position.y = smashBaseY;
  vy = 0;
  state = 'smashCharge';
  smashTimer = 0.10;
  squash = 1.25;

  // The 5-layer falling streak ends as soon as the reward landing starts.
  rules.land();
  updateHUD();
}

function resolveLandingSmash() {
  const layer = smashLayer;
  if (!layer || layer.eaten) {
    smashLayer = null;
    state = 'bouncing';
    vy = CONFIG.smashBounceVelocity;
    return;
  }

  // The cat has visibly landed. Now the cookie breaks at the SAME instant
  // the cat launches upward, making the smash readable instead of looking
  // like another pass-through.
  layer.eaten = true;
  rules.passLayer();
  spawnPlusOne();
  spawnEatFragments(layer);
  towerRoot.remove(layer.group);
  layers.delete(layer.index);
  rules.land();

  pulse = Math.min(0.36, pulse + 0.22);
  squash = 0.75;
  hud.combo.textContent = '砸碎！';
  hud.combo.classList.remove('show');
  void hud.combo.offsetWidth;
  hud.combo.classList.add('show');
  updateHUD();

  smashLayer = null;
  smashTimer = 0;
  state = 'bouncing';
  vy = CONFIG.smashBounceVelocity;
  cat.root.position.y = smashBaseY + 0.035;
}

function hitHazard() {
  if (!rules.alive) return;
  rules.hitHazard();
  state = 'hazardDead';
  vy = 3.6;
  showGameOver('hazard');
}

function showGameOver(reason) {
  if (deadShown) return;
  deadShown = true;
  setTimeout(() => {
    hud.finalDepth.textContent = `${rules.depth} 层`;
    hud.finalCombo.textContent = `×${rules.bestCombo}`;
    hud.finalScore.textContent = String(rules.score);
    if (reason === 'hazard') {
      hud.deathEmoji.textContent = '🙀';
      hud.deathTitle.textContent = '碰到毒果冻啦！';
      hud.deathText.textContent = '紫红色毒果冻是危险区，下一局别落上去。';
    } else {
      hud.deathEmoji.textContent = '😿';
      hud.deathTitle.textContent = '没力气啦！';
      hud.deathText.textContent = '少空跳，多追连续缺口，吃掉果冻就能补充弹跳次数。';
    }
    hud.gameOver.classList.remove('hidden');
  }, reason === 'hazard' ? 430 : 560);
}

function resetGame() {
  rules.reset();
  generator = new LayerGenerator((Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0);
  clearLayers();
  clearPillarModules();
  for (const fx of effects) scene.remove(fx.mesh);
  effects.length = 0;
  towerRoot.rotation.y = 0;
  cat.root.position.set(0, CONFIG.platformThickness / 2 + getCatRadius(), CONFIG.catZ);
  cat.root.rotation.set(0, 0, 0);
  cat.visual.scale.setScalar(targetCatScale());
  cat.eatTimer = 0;
  setCatTexture('idle');
  catDom.style.transform = 'translate(-50%,-50%) scale(1)';
  deadShown = false;
  smashReady = false;
  smashLayer = null;
  smashTimer = 0;
  smashBaseY = 0;
  pulse = 0;
  squash = 0;
  state = 'landed';
  vy = 0;
  // Show the configured initial count before the first real takeoff consumes one.
  landingTimer = 0.34;
  ensureLayers();
  ensurePillarModules();
  hud.gameOver.classList.add('hidden');
  updateHUD();
}

hud.restartBtn.addEventListener('click', resetGame);

function updateEatAnimations(dt) {
  const mouth = getMouthWorldPosition();
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i];
    fx.t += dt;
    const u = THREE.MathUtils.clamp(fx.t / fx.duration, 0, 1);
    if (fx.kind === 'burst') {
      const s = fx.initialScale * (0.72 + u * 0.72);
      fx.mesh.scale.set(s, s, 1);
      fx.mesh.material.opacity = (1 - u) * 0.88;
      if (u >= 1) {
        scene.remove(fx.mesh);
        fx.mesh.material?.dispose?.();
        effects.splice(i, 1);
      }
      continue;
    }
    if (fx.kind === 'ring') {
      fx.mesh.position.copy(mouth);
      const s = 1 + u * 1.8;
      fx.mesh.scale.setScalar(s);
      fx.mesh.material.opacity = (1 - u) * 0.85;
      fx.mesh.rotation.z += dt * 4.5;
      if (u >= 1) {
        scene.remove(fx.mesh);
        fx.mesh.geometry?.dispose?.();
        fx.mesh.material?.dispose?.();
        effects.splice(i, 1);
      }
      continue;
    }

    const eased = 1 - Math.pow(1 - u, 3);
    const p = fx.start.clone().lerp(mouth, eased);
    const tangent = new THREE.Vector3(
      Math.cos(fx.orbitPhase + u * 11),
      0,
      Math.sin(fx.orbitPhase + u * 11),
    ).multiplyScalar((1 - u) * fx.orbitAmp);
    p.add(tangent);
    p.y += Math.sin(u * Math.PI) * fx.lift;
    fx.mesh.position.copy(p);
    fx.mesh.rotation.x += fx.spin.x * dt;
    fx.mesh.rotation.y += fx.spin.y * dt;
    fx.mesh.rotation.z += fx.spin.z * dt;
    const s = fx.initialScale * Math.max(0.04, 1 - u * 0.95);
    fx.mesh.scale.setScalar(s);
    if (u >= 1) {
      scene.remove(fx.mesh);
      effects.splice(i, 1);
    }
  }
}

function collisionStep(prevY, currentY) {
  if (!rules.alive || state === 'landed' || vy >= 0) return;
  const radius = getCatRadius();
  const prevBottomY = prevY - radius;
  const currBottomY = currentY - radius;

  // Check layers from top to bottom; one fast frame can cross more than one layer.
  const candidates = [...layers.values()]
    .filter((l) => !l.eaten)
    .sort((a, b) => b.group.position.y - a.group.position.y);

  for (const layer of candidates) {
    const top = layerTopY(layer);
    if (!(prevBottomY >= top && currBottomY <= top)) continue;

    const status = platformStatus(layer);

    // Gaps are still gaps. A ready smash waits until the cat truly lands.
    if (status === 'gap') {
      beginEat(layer);
      // Keep falling. The loop may find a second platform in the same frame.
      continue;
    }

    // After a 5-layer chain, the next REAL platform contact triggers the reward.
    // It overrides both normal and hazard regions: land first, bounce visibly,
    // then shatter this whole layer.
    if (smashReady) {
      startLandingSmash(layer);
      return;
    }

    if (status === 'hazard') {
      cat.root.position.y = top + radius;
      hitHazard();
      return;
    }
    cat.root.position.y = top + radius;
    landOn(layer);
    return;
  }
}

function updateCat(dt) {
  if (state === 'landed') {
    landingTimer -= dt;
    if (landingTimer <= 0) consumeBounce();
  } else if (state === 'smashCharge' && rules.alive) {
    smashTimer -= dt;
    cat.root.position.y = smashBaseY;
    if (smashTimer <= 0) resolveLandingSmash();
  } else if (state === 'bouncing' && rules.alive) {
    const prevY = cat.root.position.y;
    vy += CONFIG.gravity * dt;
    cat.root.position.y += vy * dt;
    collisionStep(prevY, cat.root.position.y);
  } else if (state === 'hazardDead') {
    vy += CONFIG.gravity * 0.72 * dt;
    cat.root.position.y += vy * dt;
    cat.root.rotation.z += dt * 3.6;
  }

  const isFalling = state === 'bouncing' && vy < -0.8;
  const base = targetCatScale();
  pulse *= Math.pow(0.035, dt);
  squash *= Math.pow(0.0025, dt);
  cat.eatTimer = Math.max(0, cat.eatTimer - dt);

  const sx = base * (1 + pulse + squash * 0.12) * (isFalling ? 0.96 : 1);
  const sy = base * (1 + pulse * 0.55 - squash * 0.18) * (isFalling ? 1.04 : 1);
  const sz = base;
  cat.visual.scale.x = THREE.MathUtils.lerp(cat.visual.scale.x, sx, 1 - Math.exp(-14 * dt));
  cat.visual.scale.y = THREE.MathUtils.lerp(cat.visual.scale.y, sy, 1 - Math.exp(-14 * dt));
  cat.visual.scale.z = THREE.MathUtils.lerp(cat.visual.scale.z, sz, 1 - Math.exp(-14 * dt));

  const domScale = THREE.MathUtils.clamp(0.88 + pulse * 0.40 + squash * 0.08, 0.78, 1.12);
  const domY = state === 'smashCharge' ? 1.09 : (isFalling ? 1.02 : 1);
  const domX = state === 'smashCharge' ? 1.08 : 1;
  const domTilt = isFalling ? Math.sin(performance.now() * 0.010) * 3.2 : 0;
  catDom.style.transform = `translate(-50%,-50%) rotate(${domTilt}deg) scale(${domScale * domX}, ${domScale / domY})`;

  if (!rules.alive || state === 'hazardDead' || state === 'starved') {
    setCatTexture('fail');
  } else if (state === 'smashCharge') {
    setCatTexture('squash');
  } else if (cat.eatTimer > 0) {
    setCatTexture('eat');
  } else if (isFalling) {
    setCatTexture('fall');
  } else {
    setCatTexture('idle');
  }

  const tilt = isFalling ? Math.sin(performance.now() * 0.010) * 0.035 : 0;
  cat.visual.rotation.z = THREE.MathUtils.lerp(cat.visual.rotation.z, tilt, 1 - Math.exp(-9 * dt));
  cat.shadow.material.opacity = THREE.MathUtils.lerp(
    cat.shadow.material.opacity,
    isFalling ? 0.08 : 0.16,
    1 - Math.exp(-8 * dt),
  );
}

let cameraFocusY = 0;
function updateCamera(dt) {
  const targetY = cat.root.position.y - 0.10;
  cameraFocusY = THREE.MathUtils.lerp(cameraFocusY, targetY, 1 - Math.exp(-9.0 * dt));
  camera.position.y = cameraFocusY + 4.72;
  camera.position.x = 0.16;
  camera.position.z = 10.30;
  camera.lookAt(0, cameraFocusY - 0.18, 0.96);

  decoGroup.position.y = cameraFocusY * 0.40;
}

let dragging = false;
let pointerX = 0;
function pointerDown(e) {
  if (!rules.alive) return;
  dragging = true;
  pointerX = e.clientX;
  renderer.domElement.setPointerCapture?.(e.pointerId);
  if (!firstInput) {
    firstInput = true;
    hud.toast.classList.add('hide');
  }
}
function pointerMove(e) {
  if (!dragging || !rules.alive) return;
  const dx = e.clientX - pointerX;
  pointerX = e.clientX;
  const sensitivity = CONFIG.dragTurnsPerScreen / Math.max(gameEl.clientWidth, 320);
  towerRoot.rotation.y += dx * sensitivity;
}
function pointerUp(e) {
  dragging = false;
  renderer.domElement.releasePointerCapture?.(e.pointerId);
}
renderer.domElement.addEventListener('pointerdown', pointerDown);
renderer.domElement.addEventListener('pointermove', pointerMove);
renderer.domElement.addEventListener('pointerup', pointerUp);
renderer.domElement.addEventListener('pointercancel', pointerUp);

function resize() {
  const w = Math.max(gameEl.clientWidth, 320);
  const h = Math.max(gameEl.clientHeight, 568);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
}
addEventListener('resize', resize);
new ResizeObserver(resize).observe(frameEl);

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;
  ensureLayers();
  ensurePillarModules();
  updateCat(dt);
  updateEatAnimations(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resetGame();
loadingEl.classList.add('hidden');
requestAnimationFrame(frame);
