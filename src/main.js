const THREE = globalThis.__THREE__;
if (!THREE) throw new Error('Three.js 未加载');
import { GameRules, LayerGenerator, angleInArc, normalizeAngle, TAU } from './logic.mjs';

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
  layerGap: 1.88,
  platformRadius: 3.62,
  platformThickness: 0.50,
  pillarRadius: 0.92,
  catRadius: 0.31,
  catRadiusAtMax: 0.37,
  catZ: 2.78,
  gravity: -10.2,
  jumpVelocity: 5.25,
  landingPause: 0.08,
  dragTurnsPerScreen: 240 * Math.PI / 180,
  sliceCount: 18,
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
const camera = new THREE.PerspectiveCamera(38, initialW / initialH, 0.1, 140);
camera.position.set(0.65, 5.0, 21.0);

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
const key = new THREE.DirectionalLight(0xffffff, 3.2);
key.position.set(6, 10, 8);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
scene.add(key);
const fill = new THREE.DirectionalLight(0xffc5e3, 1.15);
fill.position.set(-7, 3, -5);
scene.add(fill);

const towerRoot = new THREE.Group();
scene.add(towerRoot);

const matCookie = new THREE.MeshPhysicalMaterial({
  color: 0x86f2a7,
  roughness: 0.16,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  transmission: 0.18,
  transparent: true,
  opacity: 0.97,
  thickness: 0.65,
  ior: 1.36,
  emissive: 0x184d2a,
  emissiveIntensity: 0.05,
});
const matCookieAlt = new THREE.MeshPhysicalMaterial({
  color: 0xb8f8c9,
  roughness: 0.18,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  transmission: 0.16,
  transparent: true,
  opacity: 0.97,
  thickness: 0.62,
  ior: 1.36,
  emissive: 0x225b33,
  emissiveIntensity: 0.04,
});
const matHazard = new THREE.MeshPhysicalMaterial({
  color: 0xd82d77,
  roughness: 0.07,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.035,
  transmission: 0.12,
  transparent: true,
  opacity: 0.98,
  thickness: 0.66,
  ior: 1.38,
  emissive: 0x65102e,
  emissiveIntensity: 0.16,
});
const matHazardTop = new THREE.MeshStandardMaterial({
  color: 0xff679b,
  roughness: 0.16,
  emissive: 0x8a0d42,
  emissiveIntensity: 0.24,
});
const matChip = new THREE.MeshPhysicalMaterial({
  color: 0xcffff0,
  roughness: 0.04,
  transmission: 0.12,
  transparent: true,
  opacity: 0.78,
  clearcoat: 1,
});
const matPillar = new THREE.MeshStandardMaterial({ color: 0xffefd4, roughness: 0.31 });
const matPillarStripe = new THREE.MeshStandardMaterial({ color: 0xff90bd, roughness: 0.22, emissive: 0x52122f, emissiveIntensity: 0.04 });
const matPillarCream = new THREE.MeshStandardMaterial({ color: 0xfffbf1, roughness: 0.25 });
const matPaw = new THREE.MeshStandardMaterial({ color: 0xff79ad, roughness: 0.18, emissive: 0x54112f, emissiveIntensity: 0.06 });

// The center pillar is a recycled visual segment that follows the camera vertically.
const pillarVisual = new THREE.Group();
towerRoot.add(pillarVisual);

const pillar = new THREE.Mesh(
  new THREE.CylinderGeometry(CONFIG.pillarRadius, CONFIG.pillarRadius, 70, 48),
  matPillar,
);
pillar.receiveShadow = true;
pillarVisual.add(pillar);

for (let y = -34.8, n = 0; y <= 34.8; y += 2.9, n++) {
  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(CONFIG.pillarRadius + 0.018, 0.072, 10, 48),
    n % 2 ? matPillarStripe : matPillarCream,
  );
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = y;
  pillarVisual.add(stripe);
}

const pawPadGeo = new THREE.SphereGeometry(0.115, 14, 10);
const pawToeGeo = new THREE.SphereGeometry(0.055, 12, 8);
function addPawOrnament(y, angle) {
  const g = new THREE.Group();
  g.position.y = y;
  g.rotation.y = angle;
  const pad = new THREE.Mesh(pawPadGeo, matPaw);
  pad.scale.set(1.25, 0.92, 0.34);
  pad.position.set(0, 0, CONFIG.pillarRadius + 0.045);
  g.add(pad);
  const toeOffsets = [[-0.12,0.12],[-0.04,0.18],[0.05,0.18],[0.13,0.11]];
  for (const [x, yy] of toeOffsets) {
    const toe = new THREE.Mesh(pawToeGeo, matPaw);
    toe.scale.set(1, 0.9, 0.32);
    toe.position.set(x, yy, CONFIG.pillarRadius + 0.05);
    g.add(toe);
  }
  pillarVisual.add(g);
}
for (let y = -31; y <= 31; y += 5.8) {
  addPawOrnament(y, 0);
  addPawOrnament(y + 2.9, Math.PI);
}

// Soft decorative jelly bubbles. They intentionally do not participate in gameplay.
const decoGroup = new THREE.Group();
scene.add(decoGroup);
const decoGeo = new THREE.SphereGeometry(0.12, 8, 6);
const decoMat = new THREE.MeshPhysicalMaterial({ color: 0xa5ffd0, roughness: 0.08, transmission: 0.25, transparent: true, opacity: 0.55, clearcoat: 1 });
for (let i = 0; i < 28; i++) {
  const m = new THREE.Mesh(decoGeo, decoMat);
  const a = (i / 28) * TAU;
  const r = 7 + (i % 4) * 0.8;
  m.position.set(Math.sin(a) * r, 5 - i * 1.7, Math.cos(a) * r);
  m.scale.setScalar(0.7 + (i % 3) * 0.28);
  decoGroup.add(m);
}

const textureLoader = new THREE.TextureLoader();
const jellyBurstTexture = textureLoader.load('./assets/jelly-burst.svg');
jellyBurstTexture.colorSpace = THREE.SRGBColorSpace;

const catSources = {
  idle: './assets/cat-idle.svg',
  fall: './assets/cat-fall.svg',
  eat: './assets/cat-eat.svg',
  squash: './assets/cat-squash.svg',
  fail: './assets/cat-fail.svg',
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

// Chunky annular jelly segment. Unlike a full pie slice, it leaves the pillar visible
// and reads like the thick gummy blocks from the target art direction.
const SLICE = TAU / CONFIG.sliceCount;
function createAnnularWedgeGeometry(innerR, outerR, height, angleWidth, steps = 3) {
  const pos = [];
  const idx = [];
  const halfH = height / 2;
  for (let j = 0; j <= steps; j++) {
    const a = -angleWidth / 2 + (angleWidth * j / steps);
    const s = Math.sin(a), c = Math.cos(a);
    pos.push(innerR*s, -halfH, innerR*c, outerR*s, -halfH, outerR*c,
             innerR*s,  halfH, innerR*c, outerR*s,  halfH, outerR*c);
  }
  for (let j = 0; j < steps; j++) {
    const a=j*4, b=(j+1)*4;
    idx.push(a+2,a+3,b+3, a+2,b+3,b+2); // top
    idx.push(a,b+1,a+1, a,b,b+1);       // bottom
    idx.push(a,a+2,b+2, a,b+2,b);       // inner
    idx.push(a+1,b+1,b+3, a+1,b+3,a+3);// outer
  }
  const last=steps*4;
  idx.push(0,1,3, 0,3,2);
  idx.push(last,last+2,last+3, last,last+3,last+1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const wedgeGeo = createAnnularWedgeGeometry(
  CONFIG.pillarRadius + 0.10,
  CONFIG.platformRadius,
  CONFIG.platformThickness,
  SLICE * 0.92,
  4,
);
const chipGeo = new THREE.SphereGeometry(0.075, 9, 7);
const hazardBumpGeo = new THREE.SphereGeometry(0.105, 14, 10);
const cookieChunkGeo = new THREE.BoxGeometry(0.22, 0.11, 0.17);
const crumbGeo = new THREE.SphereGeometry(0.055, 8, 7);

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
    const material = type === 'hazard' ? matHazard : (i % 2 ? matCookie : matCookieAlt);
    const seg = new THREE.Mesh(wedgeGeo, material);
    seg.rotation.y = angle;
    seg.castShadow = false;
    seg.receiveShadow = true;
    group.add(seg);
    segments.push(seg);

    if (type === 'hazard' && i % 2 === 0) {
      const spike = new THREE.Mesh(hazardBumpGeo, matHazardTop);
      const rr = 2.35;
      spike.position.set(Math.sin(angle) * rr, CONFIG.platformThickness / 2 + 0.10, Math.cos(angle) * rr);
      spike.scale.set(1.0, 0.72, 1.0);
      group.add(spike);
    }
  }

  // This should be impossible after snapping, but keep a runtime guard so a
  // fully closed cookie layer can never silently enter gameplay.
  if (renderedGapSlices < requiredGapSlices) {
    console.error('Invalid jelly layer: visible gap missing', { index, renderedGapSlices, requiredGapSlices, data });
    towerRoot.remove(group);
    return makeLayer(index);
  }

  // A few embedded bubbles give the thick pieces the glossy jelly look from the target mockup.
  for (let c = 0; c < 6; c++) {
    const angle = normalizeAngle(data.primaryAngle + 0.72 + c * 1.05);
    const type = arcType(data, angle);
    if (type === 'gap') continue;
    const rr = 1.65 + (c % 3) * 0.73;
    const bubble = new THREE.Mesh(chipGeo, type === 'hazard' ? matHazardTop : matChip);
    bubble.position.set(Math.sin(angle) * rr, CONFIG.platformThickness / 2 + 0.085, Math.cos(angle) * rr);
    bubble.scale.setScalar(0.72 + (c % 2) * 0.34);
    group.add(bubble);
  }

  const layer = {
    index,
    data,
    group,
    segments,
    eaten: false,
  };
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
  camera.position.y = cameraFocusY + 4.35;
  camera.position.x = 0.34;
  camera.position.z = 11.8;
  camera.lookAt(0, cameraFocusY - 0.30, 0);

  // Recycle the decorative pillar so the candy column never ends.
  pillarVisual.position.y = cameraFocusY - 1.3;
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
  updateCat(dt);
  updateEatAnimations(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resetGame();
loadingEl.classList.add('hidden');
requestAnimationFrame(frame);
