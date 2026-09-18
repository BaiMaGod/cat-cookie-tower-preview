const THREE = globalThis.__THREE__;
if (!THREE) throw new Error('Three.js 未加载');
import { GameRules, LayerGenerator, angleInArc, normalizeAngle, TAU } from './logic.mjs';

const gameEl = document.getElementById('game');
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
  layerGap: 1.72,
  platformRadius: 3.25,
  platformThickness: 0.22,
  pillarRadius: 0.78,
  catRadius: 0.46,
  catRadiusAtMax: 0.56,
  catZ: 2.45,
  gravity: -10.2,
  jumpVelocity: 5.25,
  landingPause: 0.08,
  dragTurnsPerScreen: 240 * Math.PI / 180,
  sliceCount: 48,
  aheadLayers: 18,
  keepBehind: 5,
  cameraFollow: 6.1,
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf8e5bd);
scene.fog = new THREE.Fog(0xf8e5bd, 14, 34);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 120);
camera.position.set(6.2, 5.2, 7.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.03;
gameEl.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xfff7df, 0xb89b79, 2.7);
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
const fill = new THREE.DirectionalLight(0xffb88f, 1.05);
fill.position.set(-7, 3, -5);
scene.add(fill);

const towerRoot = new THREE.Group();
scene.add(towerRoot);

const matCookie = new THREE.MeshStandardMaterial({ color: 0xd99a4b, roughness: 0.9, metalness: 0.0 });
const matCookieAlt = new THREE.MeshStandardMaterial({ color: 0xe8ae5e, roughness: 0.92 });
const matCookieEdge = new THREE.MeshStandardMaterial({ color: 0xc67d35, roughness: 1.0 });
const matHazard = new THREE.MeshStandardMaterial({ color: 0x593125, roughness: 0.92, emissive: 0x4d1309, emissiveIntensity: 0.32 });
const matHazardTop = new THREE.MeshStandardMaterial({ color: 0x7b3323, roughness: 0.84, emissive: 0x721d0b, emissiveIntensity: 0.42 });
const matChip = new THREE.MeshStandardMaterial({ color: 0x6c3b24, roughness: 0.98 });
const matPillar = new THREE.MeshStandardMaterial({ color: 0xffdca1, roughness: 0.72 });
const matPillarStripe = new THREE.MeshStandardMaterial({ color: 0xf6b96f, roughness: 0.78 });

const pillar = new THREE.Mesh(
  new THREE.CylinderGeometry(CONFIG.pillarRadius, CONFIG.pillarRadius, 90, 28),
  matPillar,
);
pillar.position.y = -38;
pillar.receiveShadow = true;
towerRoot.add(pillar);

for (let y = 5; y > -80; y -= 2.9) {
  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(CONFIG.pillarRadius + 0.012, 0.035, 6, 32),
    matPillarStripe,
  );
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = y;
  towerRoot.add(stripe);
}

// Soft decorative background cookies. They intentionally do not participate in gameplay.
const decoGroup = new THREE.Group();
scene.add(decoGroup);
const decoGeo = new THREE.SphereGeometry(0.12, 8, 6);
const decoMat = new THREE.MeshStandardMaterial({ color: 0xf4bd72, roughness: 0.9 });
for (let i = 0; i < 28; i++) {
  const m = new THREE.Mesh(decoGeo, decoMat);
  const a = (i / 28) * TAU;
  const r = 7 + (i % 4) * 0.8;
  m.position.set(Math.sin(a) * r, 5 - i * 1.7, Math.cos(a) * r);
  m.scale.setScalar(0.7 + (i % 3) * 0.28);
  decoGroup.add(m);
}

function createCat() {
  const root = new THREE.Group();
  root.position.set(0, 0, CONFIG.catZ);
  scene.add(root);

  const visual = new THREE.Group();
  root.add(visual);

  const fur = new THREE.MeshStandardMaterial({ color: 0xf8b65f, roughness: 0.78 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xffe7b6, roughness: 0.86 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x49362d, roughness: 0.92 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xef8f8f, roughness: 0.82 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x5b2729, roughness: 0.95 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 26, 18), fur);
  body.scale.set(1.12, 1.02, 1.0);
  body.castShadow = true;
  visual.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 14), cream);
  belly.position.set(0, -0.04, 0.36);
  belly.scale.set(0.95, 1.08, 0.28);
  visual.add(belly);

  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.04);
  visual.add(head);

  const headBall = new THREE.Mesh(new THREE.SphereGeometry(0.37, 24, 16), fur);
  headBall.scale.set(1.12, 0.95, 0.94);
  headBall.castShadow = true;
  head.add(headBall);

  const earGeo = new THREE.ConeGeometry(0.16, 0.34, 3);
  const leftEar = new THREE.Mesh(earGeo, fur);
  const rightEar = new THREE.Mesh(earGeo, fur);
  leftEar.position.set(-0.22, 0.28, 0.01);
  rightEar.position.set(0.22, 0.28, 0.01);
  leftEar.rotation.z = 0.16;
  rightEar.rotation.z = -0.16;
  head.add(leftEar, rightEar);

  const innerEarGeo = new THREE.ConeGeometry(0.09, 0.18, 3);
  const leftInnerEar = new THREE.Mesh(innerEarGeo, pink);
  const rightInnerEar = new THREE.Mesh(innerEarGeo, pink);
  leftInnerEar.position.set(-0.22, 0.24, 0.055);
  rightInnerEar.position.set(0.22, 0.24, 0.055);
  leftInnerEar.rotation.z = 0.16;
  rightInnerEar.rotation.z = -0.16;
  head.add(leftInnerEar, rightInnerEar);

  const eyeGeo = new THREE.SphereGeometry(0.035, 10, 8);
  const leftEye = new THREE.Mesh(eyeGeo, dark);
  const rightEye = new THREE.Mesh(eyeGeo, dark);
  leftEye.position.set(-0.13, 0.04, 0.325);
  rightEye.position.set(0.13, 0.04, 0.325);
  leftEye.scale.set(1, 1.3, 0.45);
  rightEye.scale.set(1, 1.3, 0.45);
  head.add(leftEye, rightEye);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), pink);
  nose.position.set(0, -0.035, 0.355);
  nose.scale.set(1.15, 0.72, 0.5);
  head.add(nose);

  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), mouthMat);
  mouth.position.set(0, -0.13, 0.35);
  mouth.scale.set(0.72, 0.25, 0.28);
  head.add(mouth);

  const blushGeo = new THREE.SphereGeometry(0.06, 12, 8);
  const blushMat = new THREE.MeshStandardMaterial({ color: 0xffb0a8, roughness: 0.9, transparent: true, opacity: 0.72 });
  const leftBlush = new THREE.Mesh(blushGeo, blushMat);
  const rightBlush = new THREE.Mesh(blushGeo, blushMat);
  leftBlush.position.set(-0.2, -0.06, 0.30);
  rightBlush.position.set(0.2, -0.06, 0.30);
  leftBlush.scale.set(1.2, 0.6, 0.25);
  rightBlush.scale.set(1.2, 0.6, 0.25);
  head.add(leftBlush, rightBlush);

  const whiskerMat = new THREE.MeshStandardMaterial({ color: 0x5f4d44, roughness: 0.95 });
  const whiskerGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.26, 6);
  for (const side of [-1, 1]) {
    for (const oy of [-0.02, -0.08, -0.14]) {
      const w = new THREE.Mesh(whiskerGeo, whiskerMat);
      w.rotation.z = side * Math.PI / 2 + side * (0.10 + oy * 0.8);
      w.rotation.x = Math.PI / 2;
      w.position.set(0.13 * side, oy, 0.29);
      head.add(w);
    }
  }

  const suctionAura = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.022, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xfff0c5, transparent: true, opacity: 0.0, depthWrite: false }),
  );
  suctionAura.position.set(0, -0.13, 0.44);
  suctionAura.rotation.x = Math.PI / 2;
  head.add(suctionAura);

  const pawGeo = new THREE.SphereGeometry(0.13, 14, 10);
  for (const x of [-0.34, 0.34]) {
    const paw = new THREE.Mesh(pawGeo, cream);
    paw.position.set(x, -0.19, 0.28);
    paw.scale.set(0.75, 0.78, 0.72);
    visual.add(paw);
  }

  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 8, 26, Math.PI * 1.3), fur);
  tail.position.set(0.39, -0.09, -0.15);
  tail.rotation.set(0.22, 0.55, -0.55);
  visual.add(tail);

  // Ground shadow that tracks the cat. It makes the squash/landing much easier to read.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 28),
    new THREE.MeshBasicMaterial({ color: 0x80552f, transparent: true, opacity: 0.14, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -0.52, 0);
  root.add(shadow);

  return { root, visual, head, mouth, leftEye, rightEye, shadow, suctionAura, leftBlush, rightBlush, leftEar, rightEar, tail };
}

const cat = createCat();

const rules = new GameRules({ initialJumps: CONFIG.initialJumps, maxJumps: CONFIG.maxJumps });
let generator = new LayerGenerator((Date.now() ^ 0xA11CE) >>> 0);
const layers = new Map();
const effects = [];

// Shared wedge geometry. Each slice is a narrow cylinder sector; groups of sectors form a cookie disk.
const SLICE = TAU / CONFIG.sliceCount;
const wedgeGeo = new THREE.CylinderGeometry(
  CONFIG.platformRadius,
  CONFIG.platformRadius,
  CONFIG.platformThickness,
  3,
  1,
  false,
  -SLICE * 0.465,
  SLICE * 0.93,
);
const chipGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.035, 9);
const hazardBumpGeo = new THREE.ConeGeometry(0.10, 0.18, 5);
const cookieChunkGeo = new THREE.BoxGeometry(0.22, 0.09, 0.16);
const crumbGeo = new THREE.SphereGeometry(0.055, 7, 6);

function arcType(layerData, angle) {
  if (layerData.gaps.some((g) => angleInArc(angle, g.start, g.width))) return 'gap';
  if (layerData.hazards.some((h) => angleInArc(angle, h.start, h.width))) return 'hazard';
  return 'safe';
}

function makeLayer(index) {
  const data = generator.create(index, rules.jumps <= 2);
  const group = new THREE.Group();
  group.position.y = -index * CONFIG.layerGap;
  towerRoot.add(group);

  const segments = [];
  for (let i = 0; i < CONFIG.sliceCount; i++) {
    const angle = i * SLICE + SLICE / 2;
    const type = arcType(data, angle);
    if (type === 'gap') continue;
    const material = type === 'hazard' ? matHazard : (i % 2 ? matCookie : matCookieAlt);
    const seg = new THREE.Mesh(wedgeGeo, material);
    seg.rotation.y = angle;
    seg.castShadow = index < 10;
    seg.receiveShadow = true;
    group.add(seg);
    segments.push(seg);

    if (type === 'hazard' && i % 2 === 0) {
      const spike = new THREE.Mesh(hazardBumpGeo, matHazardTop);
      const rr = 2.35;
      spike.position.set(Math.sin(angle) * rr, CONFIG.platformThickness / 2 + 0.08, Math.cos(angle) * rr);
      spike.rotation.y = angle;
      group.add(spike);
    }
  }

  // Sparse chocolate chips make the whole disk read as one edible cookie rather than a plain platform.
  for (let c = 0; c < 7; c++) {
    const angle = normalizeAngle(data.primaryAngle + 1.0 + c * 0.77);
    if (arcType(data, angle) !== 'safe') continue;
    const rr = 1.35 + (c % 3) * 0.62;
    const chip = new THREE.Mesh(chipGeo, matChip);
    chip.position.set(Math.sin(angle) * rr, CONFIG.platformThickness / 2 + 0.03, Math.cos(angle) * rr);
    chip.rotation.x = Math.PI / 2;
    chip.rotation.z = angle;
    group.add(chip);
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
  const start = Math.max(0, rules.depth - 1);
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
  return THREE.MathUtils.lerp(0.78, 1.18, t);
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
  el.textContent = '+1 🐾';
  document.body.appendChild(el);
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
  cat.mouth.getWorldPosition(p);
  return p;
}

function spawnEatFragments(layer) {
  const chunkCount = 24;
  for (let i = 0; i < chunkCount; i++) {
    const angle = (i / chunkCount) * TAU + (layer.index % 7) * 0.13;
    const radius = 1.1 + (i % 4) * 0.43 + Math.random() * 0.16;
    const local = new THREE.Vector3(
      Math.sin(angle) * radius,
      layer.group.position.y + (Math.random() - 0.5) * 0.08,
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
      lift: 0.34 + Math.random() * 0.42,
      orbitPhase: Math.random() * TAU,
      orbitAmp: 0.14 + Math.random() * 0.18,
      spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
      duration: 0.32 + Math.random() * 0.14,
      t: 0,
      initialScale: mesh.scale.x,
    });
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.03, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffefbf, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  const mouth = getMouthWorldPosition();
  ring.position.copy(mouth);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  effects.push({ kind: 'ring', mesh: ring, duration: 0.24, t: 0 });
}

function beginEat(layer) {
  if (layer.eaten) return;
  layer.eaten = true;
  rules.passLayer();
  pulse = Math.min(0.22, pulse + 0.10);
  spawnPlusOne();
  showCombo(rules.combo);
  updateHUD();

  spawnEatFragments(layer);
  towerRoot.remove(layer.group);
  layers.delete(layer.index);
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
      hud.deathTitle.textContent = '烫到爪爪啦！';
      hud.deathText.textContent = '烧焦的饼干是危险区，下一局别落上去。';
    } else {
      hud.deathEmoji.textContent = '😿';
      hud.deathTitle.textContent = '没力气啦！';
      hud.deathText.textContent = '少空跳，多追连续缺口，就能把猫咪重新喂胖。';
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
  cat.head.rotation.set(0, 0, 0);
  deadShown = false;
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
    if (status === 'gap') {
      beginEat(layer);
      // Keep falling. The loop may find a second platform in the same frame.
      continue;
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
  } else if (state === 'bouncing' && rules.alive) {
    const prevY = cat.root.position.y;
    vy += CONFIG.gravity * dt;
    cat.root.position.y += vy * dt;
    collisionStep(prevY, cat.root.position.y);
  } else if (state === 'hazardDead') {
    vy += CONFIG.gravity * 0.72 * dt;
    cat.root.position.y += vy * dt;
    cat.root.rotation.z += dt * 4.2;
    cat.root.rotation.x += dt * 2.4;
  }

  const isFalling = state === 'bouncing' && vy < -0.8;
  const base = targetCatScale();
  pulse *= Math.pow(0.035, dt);
  squash *= Math.pow(0.0025, dt);
  const sx = base * (1 + pulse + squash * 0.11) * (isFalling ? 0.95 : 1);
  const sy = base * (1 + pulse * 0.65 - squash * 0.16) * (isFalling ? 1.08 : 1);
  const sz = base * (1 + pulse + squash * 0.08) * (isFalling ? 0.95 : 1);
  cat.visual.scale.x = THREE.MathUtils.lerp(cat.visual.scale.x, sx, 1 - Math.exp(-14 * dt));
  cat.visual.scale.y = THREE.MathUtils.lerp(cat.visual.scale.y, sy, 1 - Math.exp(-14 * dt));
  cat.visual.scale.z = THREE.MathUtils.lerp(cat.visual.scale.z, sz, 1 - Math.exp(-14 * dt));

  // Signature falling pose: head tilts back and the mouth opens upward while the cookie is being inhaled.
  const mouthOpen = isFalling ? 1 : 0;
  cat.head.rotation.x = THREE.MathUtils.lerp(cat.head.rotation.x, isFalling ? -0.48 : 0, 1 - Math.exp(-12 * dt));
  cat.visual.rotation.z = THREE.MathUtils.lerp(cat.visual.rotation.z, isFalling ? Math.sin(performance.now() * 0.01) * 0.06 : 0, 1 - Math.exp(-8 * dt));
  cat.tail.rotation.z = THREE.MathUtils.lerp(cat.tail.rotation.z, isFalling ? -0.85 : -0.55, 1 - Math.exp(-8 * dt));
  const mx = THREE.MathUtils.lerp(0.72, 1.72, mouthOpen);
  const my = THREE.MathUtils.lerp(0.25, 1.95, mouthOpen);
  cat.mouth.scale.x = THREE.MathUtils.lerp(cat.mouth.scale.x, mx, 1 - Math.exp(-16 * dt));
  cat.mouth.scale.y = THREE.MathUtils.lerp(cat.mouth.scale.y, my, 1 - Math.exp(-16 * dt));
  cat.mouth.scale.z = THREE.MathUtils.lerp(cat.mouth.scale.z, 0.32 + mouthOpen * 0.36, 1 - Math.exp(-16 * dt));
  const auraOpacity = isFalling ? 0.55 + Math.min(0.35, Math.max(0, pulse) * 2.2) : 0.0;
  cat.suctionAura.material.opacity = THREE.MathUtils.lerp(cat.suctionAura.material.opacity, auraOpacity, 1 - Math.exp(-12 * dt));
  const auraScale = isFalling ? 1.0 + Math.min(0.9, Math.max(0, pulse) * 5.5) : 0.7;
  cat.suctionAura.scale.setScalar(THREE.MathUtils.lerp(cat.suctionAura.scale.x, auraScale, 1 - Math.exp(-10 * dt)));
  cat.suctionAura.rotation.z += dt * (2.5 + Math.max(0, pulse) * 12);

  // Low-jump facial feedback without changing physics.
  const worried = rules.jumps <= 2 && rules.alive;
  cat.leftEye.scale.y = THREE.MathUtils.lerp(cat.leftEye.scale.y, worried ? 0.55 : 1.3, 1 - Math.exp(-7 * dt));
  cat.rightEye.scale.y = cat.leftEye.scale.y;
  const blushOpacity = worried ? 0.55 : 0.72;
  cat.leftBlush.material.opacity = THREE.MathUtils.lerp(cat.leftBlush.material.opacity, blushOpacity, 1 - Math.exp(-6 * dt));
  cat.rightBlush.material.opacity = cat.leftBlush.material.opacity;
  const earRotL = worried ? 0.04 : 0.16;
  const earRotR = worried ? -0.04 : -0.16;
  cat.leftEar.rotation.z = THREE.MathUtils.lerp(cat.leftEar.rotation.z, earRotL, 1 - Math.exp(-6 * dt));
  cat.rightEar.rotation.z = THREE.MathUtils.lerp(cat.rightEar.rotation.z, earRotR, 1 - Math.exp(-6 * dt));
}

let cameraFocusY = 0;
function updateCamera(dt) {
  const depthY = -rules.depth * CONFIG.layerGap;
  cameraFocusY = THREE.MathUtils.lerp(cameraFocusY, depthY - 0.72, 1 - Math.exp(-CONFIG.cameraFollow * dt));
  camera.position.y = cameraFocusY + 5.3;
  const mobile = innerWidth < 720;
  camera.position.x = mobile ? 5.3 : 5.9;
  camera.position.z = mobile ? 6.6 : 7.1;
  camera.lookAt(0, cameraFocusY - 0.7, 0.38);

  // Decorative crumbs drift with progress so the background never looks static.
  decoGroup.position.y = cameraFocusY * 0.72;
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
  const sensitivity = CONFIG.dragTurnsPerScreen / Math.max(innerWidth, 320);
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
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
}
addEventListener('resize', resize);

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
