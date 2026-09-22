/* Built from BaiMaGod/cat-cookie-tower@f304081d56c776bf6a7cd2a697446e48e9596b4b. No sourcemap. */
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

// Split at every gameplay boundary before adding cosmetic seams. Visible poison
// and openings therefore have exactly the same angular extent as collisions.
function platformSpans(data, maxSpan = Math.PI / 3) {
  const boundaries = [0, TAU];
  for (const arc of [...data.gaps, ...data.hazards]) {
    boundaries.push(normalizeAngle(arc.start), normalizeAngle(arc.start + arc.width));
  }
  const sorted = [...new Set(boundaries)].sort((a, b) => a - b);
  const runs = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i], width = sorted[i + 1] - start;
    if (width < 1e-8) continue;
    const mid = start + width / 2;
    const type = data.gaps.some(g => angleInArc(mid, g.start, g.width)) ? 'gap'
      : data.hazards.some(h => angleInArc(mid, h.start, h.width)) ? 'hazard' : 'safe';
    const last = runs.at(-1);
    if (last?.type === type) last.width += width;
    else runs.push({ start, width, type });
  }
  return runs.flatMap(run => {
    const count = run.type === 'gap' ? 1 : Math.ceil(run.width / maxSpan);
    return Array.from({ length: count }, (_, i) => ({
      start: run.start + run.width * i / count, width: run.width / count, type: run.type,
    }));
  });
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
const TAU = Math.PI * 2;

// Stylized jelly: opaque depth gives stable overlapping rings on mobile, while
// rim lighting, embedded bubbles and reflection bands suggest a translucent sweet.
function jellyMaterial(danger = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(danger ? '#f52280' : '#74ef8a') },
      uBody: { value: new THREE.Color(danger ? '#a80043' : '#069b53') },
      uGlow: { value: new THREE.Color(danger ? '#ffc1df' : '#e0ffb2') },
    },
    vertexShader: `
      varying vec3 vLocal;
      varying vec3 vLocalNormal;
      varying vec3 vNormalView;
      varying vec3 vEye;
      void main() {
        vLocal = position;
        vLocalNormal = normal;
        vNormalView = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vEye = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uBody;
      uniform vec3 uGlow;
      varying vec3 vLocal;
      varying vec3 vLocalNormal;
      varying vec3 vNormalView;
      varying vec3 vEye;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main() {
        vec3 n = normalize(vNormalView);
        vec3 eye = normalize(vEye);
        float facing = clamp(dot(n, eye), 0.0, 1.0);
        float rim = pow(1.0 - facing, 2.7);
        float height = smoothstep(-.30, .30, vLocal.y);
        vec3 color = mix(uBody, uTop, height * .78);
        vec3 light = normalize(vec3(-.55, .8, .8));
        float diffuse = max(0.0, dot(n, light));
        color *= .77 + diffuse * .34;
        color = mix(color, uGlow, rim * .48);
        // Curved edges catch narrow white softbox highlights.
        vec3 reflected = reflect(-eye, n);
        float strip = pow(max(0.0, 1.0 - abs(reflected.x + .42) * 4.0), 12.0);
        float strip2 = pow(max(0.0, 1.0 - abs(reflected.x - .72) * 7.0), 14.0);
        float spec = pow(max(0.0, dot(n, normalize(light + eye))), 85.0);
        color += vec3(1.0, 1.0, .89) * (spec * .95 + (strip * .9 + strip2 * .6) * (.35 + rim));
        // A stable surface pattern, attached to the geometry as the tower turns.
        bool onTop = vLocal.y > .245;
        float radial = abs(dot(normalize(vLocalNormal.xz), normalize(vLocal.xz)));
        vec2 sideUV = radial > .7 ? vec2(atan(vLocal.x, vLocal.z) * 2.55, vLocal.y) : vec2(length(vLocal.xz), vLocal.y);
        vec2 uv = onTop ? vLocal.xz * 4.3 : sideUV * 4.3;
        vec2 cell = floor(uv);
        float seed = hash(cell);
        vec2 center = vec2(.2 + .6 * seed, .2 + .6 * hash(cell + 41.0));
        vec2 delta = fract(uv) - center;
        float radius = .045 + .24 * seed * seed;
        float d = length(delta);
        float edge = 1.0 - smoothstep(.012, .037, abs(d - radius));
        float inside = 1.0 - smoothstep(radius - .025, radius, d);
        float shine = 1.0 - smoothstep(.008, .043, length(delta - vec2(-radius * .37, radius * .44)));
        float visible = step(.43, seed);
        color = mix(color, color * .70, inside * visible * .19);
        color += uGlow * visible * (edge * .22 + shine * .60);
        if (onTop) {
          float diagonal = dot(vLocal.xz, vec2(.8, .6));
          float lacquer = exp(-pow((diagonal - .65) / .14, 2.0)) * .20
                        + exp(-pow((diagonal + .30) / .04, 2.0)) * .15;
          color += vec3(.85, 1.0, .8) * lacquer;
        }
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createArt(renderer, scene, config, loadTexture) {
  // A small studio environment supplies broad, readable candy reflections.
  const studio = canvasTexture(1024, 512, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#fff5dc');
    sky.addColorStop(0.48, '#a5c5dd');
    sky.addColorStop(0.65, '#68788e');
    sky.addColorStop(1, '#eac6c4');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    for (const [x, y, sx, sy] of [[160, 140, 100, 120], [640, 100, 170, 40], [910, 260, 50, 160]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sx, sy);
      const glow = ctx.createRadialGradient(0, 0, 0.2, 0, 0, 1);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.65, '#fffdfa');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
  });
  studio.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(studio);
  scene.environment = environment.texture;
  studio.dispose();
  pmrem.dispose();

  const physical = (color, extra = {}) => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.19, metalness: 0, clearcoat: 1,
    clearcoatRoughness: 0.08, envMapIntensity: 1.1, ...extra,
  });
  const materials = {
    safe: jellyMaterial(),
    danger: jellyMaterial(true),
    ivory: physical(0xffedcc),
    bubble: physical(0xb6ffb9, { roughness: 0.08, envMapIntensity: 1.8 }),
    redBubble: physical(0xff6095, { roughness: 0.08, envMapIntensity: 1.8 }),
    rim: new THREE.MeshBasicMaterial({ color: 0xdfffbc, transparent: true, opacity: 0.66 }),
    redRim: new THREE.MeshBasicMaterial({ color: 0xffa9cd, transparent: true, opacity: 0.68 }),
    crumb: physical(0x6fec96),
  };
  const pawTexture = canvasTexture(256, 256, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 55, 0, 210);
    gradient.addColorStop(0, '#e1ffd6'); gradient.addColorStop(1, '#82e9a0');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#eaffdf'; ctx.lineWidth = 5;
    for (const [x, y, rx, ry, rot] of [[128, 160, 52, 37, 0], [66, 109, 20, 26, -.45], [104, 78, 20, 27, -.15], [150, 78, 20, 27, .15], [189, 109, 20, 26, .45]]) {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); ctx.stroke();
    }
  });
  const skullTexture = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#ffbed6'; ctx.strokeStyle = '#ffe7ed'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(128, 106, 72, 57, 0, 0, TAU); ctx.fill(); ctx.stroke();
    for (const x of [92, 128, 164]) {
      ctx.beginPath(); ctx.roundRect(x - 11, 139, 22, 43, 10); ctx.fill();
    }
    ctx.fillStyle = '#ad1755';
    for (const x of [99, 157]) { ctx.beginPath(); ctx.ellipse(x, 109, 20, 23, 0, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(128, 131); ctx.lineTo(117, 145); ctx.lineTo(139, 145); ctx.fill();
  });
  const markMaterial = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const pawMat = markMaterial(pawTexture);
  const skullMat = markMaterial(skullTexture);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const markGeo = new THREE.PlaneGeometry(0.66, 0.66);
  const dummy = new THREE.Object3D();

  function jellyGeometry(start, width) {
    const inset = Math.min(0.022, width * 0.08);
    const a = start + inset;
    const b = start + width - inset;
    const outer = config.platformRadius - 0.055;
    const inner = config.pillarRadius + 0.055;
    const shape = new THREE.Shape();
    // Shape XY becomes world XZ. Angle zero is +Z, as in the collision rules.
    shape.moveTo(Math.sin(a) * outer, Math.cos(a) * outer);
    shape.absarc(0, 0, outer, Math.PI / 2 - a, Math.PI / 2 - b, true);
    shape.lineTo(Math.sin(b) * inner, Math.cos(b) * inner);
    shape.absarc(0, 0, inner, Math.PI / 2 - b, Math.PI / 2 - a, false);
    shape.closePath();
    const bevel = Math.min(0.10, width * inner * 0.16);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: config.platformThickness - bevel * 2, bevelEnabled: true,
      bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3,
      steps: 1, curveSegments: 22,
    });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, config.platformThickness / 2 - bevel, 0);
    const positions = geometry.attributes.position;
    // ExtrudeGeometry duplicates vertices at seams. Average coincident normals
    // so curved walls and bevels reflect light continuously.
    const normalSums = new Map();
    const keyOf = i => [positions.getX(i), positions.getY(i), positions.getZ(i)].map(n => Math.round(n * 10000)).join(',');
    for (let i = 0; i < positions.count; i++) {
      const key = keyOf(i);
      const sum = normalSums.get(key) || new THREE.Vector3();
      sum.add(new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, i));
      normalSums.set(key, sum);
    }
    for (let i = 0; i < positions.count; i++) {
      const n = normalSums.get(keyOf(i)).clone().normalize();
      geometry.attributes.normal.setXYZ(i, n.x, n.y, n.z);
    }
    return geometry;
  }

  function createPlatform(data, index) {
    const group = new THREE.Group();
    const rng = new SeededRandom(index * 7919 + 812);
    const segments = [];
    for (const span of platformSpans(data)) {
      if (span.type === 'gap') continue;
      const danger = span.type === 'hazard';
      const part = new THREE.Group();
      const mesh = new THREE.Mesh(jellyGeometry(span.start, span.width), danger ? materials.danger : materials.safe);
      mesh.userData.ownedGeometry = true;
      part.add(mesh);

      // Tiny embossed bubbles stay on the surface instead of floating in screen space.
      const count = Math.max(2, Math.floor(span.width * 20));
      const bubbles = new THREE.InstancedMesh(sphere, danger ? materials.redBubble : materials.bubble, count);
      for (let i = 0; i < count; i++) {
        const angle = span.start + span.width * rng.range(.12, .88);
        const size = rng.range(.022, .067);
        const top = i % 3 === 0;
        const radius = top ? rng.range(config.pillarRadius + .2, config.platformRadius - .15) : config.platformRadius - .01;
        dummy.position.set(Math.sin(angle) * radius, top ? config.platformThickness / 2 + .005 : rng.range(-.16, .13), Math.cos(angle) * radius);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(size, top ? size * .3 : size, top ? size : size * .25);
        dummy.updateMatrix(); bubbles.setMatrixAt(i, dummy.matrix);
      }
      bubbles.userData.instanced = true;
      part.add(bubbles);

      const points = [];
      const inset = Math.min(.05, span.width * .18);
      for (let j = 0; j <= 24; j++) {
        const a = span.start + inset + (span.width - inset * 2) * j / 24;
        points.push(new THREE.Vector3(Math.sin(a) * (config.platformRadius - .043), config.platformThickness / 2 - .025, Math.cos(a) * (config.platformRadius - .043)));
      }
      const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, .019, 5, false), danger ? materials.redRim : materials.rim);
      rim.userData.ownedGeometry = true;
      part.add(rim);

      if (span.width > .22) {
        const mark = new THREE.Mesh(markGeo, danger ? skullMat : pawMat);
        const a = span.start + span.width / 2;
        const r = (config.pillarRadius + config.platformRadius) / 2;
        mark.rotation.set(-Math.PI / 2, 0, -a);
        mark.position.set(Math.sin(a) * r, config.platformThickness / 2 + .008, Math.cos(a) * r);
        const scale = Math.min(1, span.width / .42);
        mark.scale.setScalar(scale);
        part.add(mark);
      }
      group.add(part); segments.push(part);
    }
    return { group, segments };
  }

  // Project the supplied, prelit candy artwork onto a real cylinder. The fixed
  // camera preserves its illustrated highlights; the mesh preserves occlusion.
  const columnTexture = loadTexture('./assets/column-hd.png');
  const columnMat = new THREE.MeshBasicMaterial({ map: columnTexture, toneMapped: false });
  columnMat.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      diffuseColor = vec4(mix(vec3(1.0, .77, .46), diffuseColor.rgb, diffuseColor.a), 1.0);
    `);
  };
  const columnGeo = new THREE.CylinderGeometry(config.pillarRadius, config.pillarRadius, config.layerGap + .006, 64);
  const cp = columnGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    columnGeo.attributes.uv.setXY(i,
      .5 + .18 * cp.getX(i) / config.pillarRadius,
      1 - (680 + (config.layerGap / 2 - cp.getY(i)) / config.layerGap * 480) / 1672);
  }
  function createColumn(index) {
    const group = new THREE.Group();
    group.position.y = -index * config.layerGap;
    const body = new THREE.Mesh(columnGeo, columnMat);
    body.position.y = -config.layerGap / 2;
    group.add(body);
    return group;
  }

  const sparkleTexture = canvasTexture(64, 64, (ctx) => {
    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    glow.addColorStop(0, '#ffffff'); glow.addColorStop(.2, '#fffbd1'); glow.addColorStop(1, 'rgba(255,247,176,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#fffef0'; ctx.beginPath();
    ctx.moveTo(32, 4); ctx.quadraticCurveTo(35, 29, 59, 32);
    ctx.quadraticCurveTo(35, 35, 32, 60); ctx.quadraticCurveTo(29, 35, 5, 32);
    ctx.quadraticCurveTo(29, 29, 32, 4); ctx.fill();
  });
  const sparkles = new THREE.Group();
  const rng = new SeededRandom(128);
  for (let i = 0; i < 22; i++) {
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTexture, transparent: true, depthWrite: false, toneMapped: false }));
    star.position.set(rng.range(-2.7, 2.7), rng.range(-7, 6), rng.range(1.5, 3));
    star.userData.phase = rng.range(0, TAU);
    star.userData.size = rng.range(.09, .23);
    sparkles.add(star);
  }
  scene.add(sparkles);
  function animate(time, focusY) {
    sparkles.position.y = focusY;
    for (const star of sparkles.children) {
      const pulse = .45 + .55 * Math.sin(time * 1.7 + star.userData.phase) ** 4;
      star.scale.setScalar(star.userData.size * pulse);
      star.material.opacity = pulse * .85;
    }
  }
  return { materials, createPlatform, createColumn, animate };
}

// Platform geometry is unique; shared materials, marks and spheres survive recycling.
function disposePlatform(group) {
  group.traverse(object => {
    if (object.userData.ownedGeometry) object.geometry.dispose();
    if (object.userData.instanced) object.dispose();
  });
  group.removeFromParent();
}

const THREE = globalThis.__THREE__;
if (!THREE) throw new Error('Three.js 未加载');
const gameEl = document.getElementById('game');
const frameEl = document.getElementById('phoneFrame');
const debugMode = new URLSearchParams(location.search).has('debug');
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
  layerGap: 2.20,
  platformRadius: 2.55,
  platformThickness: 0.56,
  pillarRadius: 1.02,
  catRadius: 0.31,
  catRadiusAtMax: 0.37,
  catZ: 2.05,
  gravity: -10.2,
  jumpVelocity: 5.25,
  landingPause: 0.08,
  dragTurnsPerScreen: 240 * Math.PI / 180,
  aheadLayers: 8,
  keepBehind: 3,
  breakthroughCombo: 5,
  smashBounceVelocity: 4.15,
});

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.Fog(0xe9faff, 28, 52);

const initialW = Math.max(gameEl.clientWidth, 320);
const initialH = Math.max(gameEl.clientHeight, 568);
const camera = new THREE.OrthographicCamera(-3.25, 3.25, 5.78, -5.78, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(initialW, initialH, false);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor(0xffffff, 0);
gameEl.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xfff9ed, 0xb6cce8, .85);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff6e6, 2.4);
key.position.set(-5, 9, 7);
key.castShadow = false;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
scene.add(key);
const fill = new THREE.DirectionalLight(0xc3eaff, .8);
fill.position.set(6, 4, -3);
scene.add(fill);

const towerRoot = new THREE.Group();
scene.add(towerRoot);

const textureLoader = new THREE.TextureLoader();
const artLoads = [];
function loadArtTexture(url) {
  let tex;
  artLoads.push(new Promise((resolve, reject) => {
    tex = textureLoader.load(url, resolve, undefined, () => reject(new Error(`素材加载失败：${url}`)));
  }));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

const jellyBurstTexture = loadArtTexture('./assets/jelly-burst.svg');
const art = createArt(renderer, scene, CONFIG, loadArtTexture);
const matCookie = art.materials.crumb;
const matCookieAlt = art.materials.bubble;
const matChip = art.materials.ivory;
const pillarRoot = new THREE.Group();
scene.add(pillarRoot);
const pillarModules = new Map();

function ensurePillarModules() {
  const start = Math.max(-4, rules.depth - CONFIG.keepBehind - 3);
  const end = rules.depth + CONFIG.aheadLayers + 1;
  for (let i = start; i <= end; i++) {
    if (!pillarModules.has(i)) {
      const module = art.createColumn(i);
      pillarRoot.add(module);
      pillarModules.set(i, module);
    }
  }
  for (const [i, group] of pillarModules) {
    if (i < start || i > end) {
      pillarRoot.remove(group);
      pillarModules.delete(i);
    }
  }
}
function clearPillarModules() {
  pillarRoot.clear();
  pillarModules.clear();
}

const catSources = {
  idle: './assets/cat-idle-hd.png',
  fall: './assets/cat-fall-hd.png',
  eat: './assets/cat-eat-hd.png',
  squash: './assets/cat-idle-hd.png',
  fail: './assets/cat-fail-hd.png',
};
const catTextures = Object.fromEntries(Object.entries(catSources).map(([key, url]) => [key, loadArtTexture(url)]));
function createCat() {
  const root = new THREE.Group();
  root.position.set(0, 0, CONFIG.catZ);
  scene.add(root);
  const visual = new THREE.Sprite(new THREE.SpriteMaterial({
    map: catTextures.idle, transparent: true, alphaTest: .025,
    depthWrite: false, toneMapped: false,
  }));
  visual.center.set(.5, .065);
  root.add(visual);
  const mouthAnchor = new THREE.Object3D();
  mouthAnchor.position.set(0, .48, .12);
  root.add(mouthAnchor);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.34, 32), new THREE.MeshBasicMaterial({
    color: 0x258451, transparent: true, opacity: .16, depthWrite: false,
  }));
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);
  return { root, visual, mouthAnchor, shadow, currentTexture: 'idle', eatTimer: 0 };
}
function setCatTexture(name) {
  if (cat.currentTexture === name) return;
  cat.currentTexture = name;
  cat.visual.material.map = catTextures[name];
}
const cat = createCat();

const rules = new GameRules({ initialJumps: CONFIG.initialJumps, maxJumps: CONFIG.maxJumps });
let generator = new LayerGenerator((Date.now() ^ 0xA11CE) >>> 0);
const layers = new Map();
const effects = [];

const cookieChunkGeo = new THREE.IcosahedronGeometry(.15, 0);
const crumbGeo = new THREE.SphereGeometry(.045, 8, 6);

function makeLayer(index) {
  const data = generator.create(Math.max(0, index), rules.jumps <= 2);
  const { group, segments } = art.createPlatform(data, index);
  group.position.y = -index * CONFIG.layerGap;
  towerRoot.add(group);
  const layer = { index, data, group, segments, eaten: index < 0 };
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
      disposePlatform(layer.group);
      layers.delete(i);
    }
  }
}

function clearLayers() {
  for (const layer of layers.values()) disposePlatform(layer.group);
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
let gameOverTimer;
let state = 'idle';
let vy = 0;
let landingTimer = 0;
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
    disposePlatform(layer.group);
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
  disposePlatform(layer.group);
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
  disposePlatform(layer.group);
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
  gameOverTimer = setTimeout(() => {
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
  clearTimeout(gameOverTimer);
  rules.reset();
  generator = new LayerGenerator((Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0);
  clearLayers();
  clearPillarModules();
  for (const fx of effects) disposeEffect(fx);
  effects.length = 0;
  frameEl.querySelectorAll('.plus-one').forEach(el => el.remove());
  hud.combo.classList.remove('show');
  towerRoot.rotation.y = 0;
  cat.root.position.set(0, CONFIG.platformThickness / 2 + getCatRadius(), CONFIG.catZ);
  cat.root.rotation.set(0, 0, 0);
  cat.visual.scale.setScalar(targetCatScale());
  cat.eatTimer = 0;
  setCatTexture('idle');

  deadShown = false;
  smashReady = false;
  smashLayer = null;
  smashTimer = 0;
  smashBaseY = 0;
  pulse = 0;
  squash = 0;
  state = 'ready';
  firstInput = false;
  hud.toast.classList.remove('hide');
  vy = 0;
  // Show the configured initial count before the first real takeoff consumes one.
  landingTimer = 0.34;
  makeLayer(-2);
  makeLayer(-1);
  ensureLayers();
  ensurePillarModules();
  towerRoot.rotation.y = -layers.get(0).data.primaryAngle + .95;
  cameraFocusY = cat.root.position.y - 1.45;
  hud.gameOver.classList.add('hidden');
  updateHUD();
}

hud.restartBtn.addEventListener('click', resetGame);

function disposeEffect(fx) {
  scene.remove(fx.mesh);
  if (fx.kind === 'burst' || fx.kind === 'ring') fx.mesh.material.dispose();
  if (fx.kind === 'ring') fx.mesh.geometry.dispose();
}

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
  cat.visual.scale.x = THREE.MathUtils.lerp(cat.visual.scale.x, 1.85 * sx, dt ? 1 - Math.exp(-14 * dt) : 1);
  cat.visual.scale.y = THREE.MathUtils.lerp(cat.visual.scale.y, 1.85 * sy, dt ? 1 - Math.exp(-14 * dt) : 1);
  cat.visual.scale.z = 1;
  cat.visual.position.y = -getCatRadius() + .08;
  cat.visual.material.rotation = isFalling ? Math.sin(performance.now() * .008) * .035 : 0;
  if (state === 'ready') {
    cat.visual.position.y += Math.sin(performance.now() * .0025) * .055;
  }
  // The ground shadow stays on the next platform while the cat rises above it.
  const ground = [...layers.values()].filter(l => !l.eaten && layerTopY(l) <= cat.root.position.y).sort((a,b) => a.index-b.index)[0];
  cat.shadow.visible = !!ground && platformStatus(ground) !== 'gap';
  if (ground) {
    cat.shadow.position.y = layerTopY(ground) - cat.root.position.y + .014;
    cat.shadow.scale.setScalar(Math.max(.4, 1 - (cat.root.position.y - layerTopY(ground)) * .22));
  }

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
  // Follow descent without chasing each small bounce.
  const targetY = cat.root.position.y - 1.45;
  const speed = targetY < cameraFocusY ? 9 : 1.6;
  cameraFocusY = THREE.MathUtils.lerp(cameraFocusY, targetY, 1 - Math.exp(-speed * dt));
  cameraFocusY = Math.min(cameraFocusY, targetY + .75);
  camera.position.set(0, cameraFocusY + 8.2, 20);
  camera.lookAt(0, cameraFocusY, 0);
  art.animate(performance.now() / 1000, cameraFocusY);
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
    state = 'landed';
    landingTimer = .12;
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
  const w = Math.max(gameEl.clientWidth, 1);
  const h = Math.max(gameEl.clientHeight, 1);
  const viewWidth = Math.max(6.25, 10.5 * w / h);
  camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
  camera.top = viewWidth * h / w / 2; camera.bottom = -camera.top;
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

resize();
resetGame();
updateCat(0);
updateCamera(0);
if (debugMode) {
  globalThis.__GAME_DEBUG__ = {
    rules, layers, towerRoot, cat, renderer, camera, resetGame,
    get state() { return state; },
    alignGap() {
      const next = [...layers.values()].filter(l => !l.eaten).sort((a,b) => a.index-b.index)[0];
      if (next) towerRoot.rotation.y = -next.data.primaryAngle;
    },
    aimAt(type) {
      const next = [...layers.values()].filter(l => !l.eaten).sort((a,b) => a.index-b.index)[0];
      const span = next && platformSpans(next.data).find(s => s.type === type);
      if (span) towerRoot.rotation.y = -(span.start + span.width / 2);
      return !!span;
    },
    snapshot() { return { state, depth: rules.depth, jumps: rules.jumps, objects: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries }; },
  };
}
await Promise.all(artLoads);
loadingEl.classList.add('hidden');
requestAnimationFrame(frame);
