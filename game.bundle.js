/* cat-cookie-tower preview | source 10fddf31 | web 64d8f0fbc248 */

// src/eat-effects.js?v=64d8f0fbc248
function createEatEffects(THREE6, scene2, towerRoot2, CONFIG, materials, getMouthWorldPosition2, createCanvas, onEat = () => {
}) {
  const TAU3 = Math.PI * 2;
  const effects = [];
  const cookieChunkGeo = new THREE6.IcosahedronGeometry(0.15, 0);
  const crumbGeo = new THREE6.SphereGeometry(0.045, 8, 6);
  const matCookie = materials.crumb, matCookieAlt = materials.bubble, matChip = materials.ivory;
  const chunkBuckets = /* @__PURE__ */ new Map();
  const chunkTransform = new THREE6.Object3D();
  const ringGeo = new THREE6.TorusGeometry(0.34, 0.03, 8, 32);
  const jellyBurstTexture = createBurstTexture(THREE6, createCanvas);
  function chunkBucket(geometry, material) {
    const key2 = `${geometry.id}:${material.id}`;
    if (!chunkBuckets.has(key2)) {
      const mesh = new THREE6.InstancedMesh(geometry, material, 512);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene2.add(mesh);
      chunkBuckets.set(key2, { mesh, count: 0 });
    }
    return chunkBuckets.get(key2);
  }
  function spawnJellyBurst(position, scale = 1.55) {
    const mat = new THREE6.SpriteMaterial({
      map: jellyBurstTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      opacity: 0.88
    });
    const sprite = new THREE6.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(scale, scale, 1);
    sprite.renderOrder = 15;
    scene2.add(sprite);
    effects.push({ kind: "burst", mesh: sprite, duration: 0.34, t: 0, initialScale: scale });
  }
  function spawnEatFragments2(layer) {
    onEat();
    const chunkCount = 28;
    for (let i = 0; i < chunkCount; i++) {
      const angle = i / chunkCount * TAU3 + layer.index % 7 * 0.13;
      const radius = 1 + i % 4 * 0.45 + Math.random() * 0.18;
      const local = new THREE6.Vector3(
        Math.sin(angle) * radius,
        layer.group.position.y + (Math.random() - 0.5) * 0.1,
        Math.cos(angle) * radius
      );
      const world = towerRoot2.localToWorld(local);
      const bucket = chunkBucket(
        i % 4 === 0 ? crumbGeo : cookieChunkGeo,
        i % 5 === 0 ? matChip : i % 2 ? matCookieAlt : matCookie
      );
      const scale = i % 4 === 0 ? 0.8 + Math.random() * 0.8 : 0.75 + Math.random() * 0.65;
      effects.push({
        bucket,
        start: world,
        kind: "chunk",
        lift: 0.36 + Math.random() * 0.48,
        orbitPhase: Math.random() * TAU3,
        orbitAmp: 0.14 + Math.random() * 0.2,
        spin: new THREE6.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
        rotation: new THREE6.Euler(Math.random() * TAU3, Math.random() * TAU3, Math.random() * TAU3),
        duration: 0.34 + Math.random() * 0.15,
        t: 0,
        initialScale: scale
      });
    }
    const mouth = getMouthWorldPosition2();
    const impact = new THREE6.Vector3(0, layer.group.position.y + 0.1, CONFIG.catZ);
    spawnJellyBurst(impact, 1.6);
    const ring = new THREE6.Mesh(
      ringGeo,
      new THREE6.MeshBasicMaterial({ color: 12255183, transparent: true, opacity: 0.9, depthWrite: false })
    );
    ring.position.copy(mouth);
    ring.rotation.x = Math.PI / 2;
    scene2.add(ring);
    effects.push({ kind: "ring", mesh: ring, duration: 0.24, t: 0 });
  }
  function disposeEffect(fx) {
    if (fx.kind === "chunk") return;
    scene2.remove(fx.mesh);
    if (fx.kind === "burst" || fx.kind === "ring") fx.mesh.material.dispose();
  }
  function updateEatAnimations(dt) {
    for (const bucket of chunkBuckets.values()) bucket.count = 0;
    const mouth = effects.length ? getMouthWorldPosition2() : null;
    for (let i = effects.length - 1; i >= 0; i--) {
      const fx = effects[i];
      fx.t += dt;
      const u = THREE6.MathUtils.clamp(fx.t / fx.duration, 0, 1);
      if (fx.kind === "burst") {
        const s2 = fx.initialScale * (0.72 + u * 0.72);
        fx.mesh.scale.set(s2, s2, 1);
        fx.mesh.material.opacity = (1 - u) * 0.88;
        if (u >= 1) {
          scene2.remove(fx.mesh);
          fx.mesh.material?.dispose?.();
          effects.splice(i, 1);
        }
        continue;
      }
      if (fx.kind === "ring") {
        fx.mesh.position.copy(mouth);
        const s2 = 1 + u * 1.8;
        fx.mesh.scale.setScalar(s2);
        fx.mesh.material.opacity = (1 - u) * 0.85;
        fx.mesh.rotation.z += dt * 4.5;
        if (u >= 1) {
          scene2.remove(fx.mesh);
          fx.mesh.material?.dispose?.();
          effects.splice(i, 1);
        }
        continue;
      }
      if (u >= 1) {
        effects.splice(i, 1);
        continue;
      }
      const eased = 1 - Math.pow(1 - u, 3);
      chunkTransform.position.copy(fx.start).lerp(mouth, eased);
      chunkTransform.position.x += Math.cos(fx.orbitPhase + u * 11) * (1 - u) * fx.orbitAmp;
      chunkTransform.position.z += Math.sin(fx.orbitPhase + u * 11) * (1 - u) * fx.orbitAmp;
      chunkTransform.position.y += Math.sin(u * Math.PI) * fx.lift;
      fx.rotation.x += fx.spin.x * dt;
      fx.rotation.y += fx.spin.y * dt;
      fx.rotation.z += fx.spin.z * dt;
      chunkTransform.rotation.copy(fx.rotation);
      const s = fx.initialScale * Math.max(0.04, 1 - u * 0.95);
      chunkTransform.scale.setScalar(s);
      chunkTransform.updateMatrix();
      fx.bucket.mesh.setMatrixAt(fx.bucket.count++, chunkTransform.matrix);
    }
    for (const bucket of chunkBuckets.values()) {
      bucket.mesh.count = bucket.count;
      bucket.mesh.visible = bucket.count > 0;
      if (bucket.count) bucket.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  return {
    spawn: spawnEatFragments2,
    update: updateEatAnimations,
    clear() {
      effects.forEach(disposeEffect);
      effects.length = 0;
      for (const bucket of chunkBuckets.values()) {
        bucket.count = 0;
        bucket.mesh.count = 0;
        bucket.mesh.visible = false;
      }
    },
    get count() {
      return effects.length;
    },
    get chunkDrawCalls() {
      return [...chunkBuckets.values()].filter((bucket) => bucket.mesh.visible).length;
    }
  };
}
function createBurstTexture(THREE6, createCanvas) {
  const canvas = createCanvas();
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 84);
  g.addColorStop(0, "#effff3e6");
  g.addColorStop(0.5, "#6dffa08c");
  g.addColorStop(1, "#55e98900");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  for (const [x, y, w, h, r, degrees] of [
    [48, 76, 34, 31, 8, -24],
    [164, 65, 37, 32, 9, 26],
    [49, 151, 40, 34, 9, 22],
    [164, 156, 39, 34, 9, -24],
    [108, 39, 36, 34, 9, 12],
    [108, 184, 36, 34, 9, -10]
  ]) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(degrees * Math.PI / 180);
    ctx.fillStyle = "#6bfa98";
    ctx.strokeStyle = "#e9fff0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, r);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "#b9ffd0";
  for (const [x, y, r] of [[38, 126, 10], [218, 128, 11], [93, 92, 8], [157, 116, 7], [101, 166, 6], [151, 175, 8]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fffad0";
  for (const [x, y, r] of [[128, 118, 22], [208, 121, 13], [56, 126, 13]]) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 - Math.PI / 2, d = i % 2 ? r * 0.32 : r;
      if (!i) ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      else ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
  }
  const texture = new THREE6.CanvasTexture(canvas);
  texture.colorSpace = THREE6.SRGBColorSpace;
  return texture;
}

// src/jelly-motion.mjs?v=64d8f0fbc248
var JELLY_CONTACT_TIME = Math.PI / 20;
function jellyCompression(time, strength) {
  if (time < 0 || time >= 0.9) return 0;
  return strength * Math.exp(-5.5 * time) * Math.sin(20 * time);
}

// src/game-config.mjs?v=64d8f0fbc248
var GAME_CONFIG = Object.freeze({
  initialJumps: 5,
  maxJumps: 10,
  layerGap: 2.2,
  platformRadius: 2.55,
  platformThickness: 0.56,
  pillarRadius: 1.02,
  catRadius: 0.31,
  catRadiusAtMax: 0.37,
  catZ: 2.05,
  maxPixelRatio: 1.5,
  transmissionResolutionScale: 0.5,
  gravity: -10.2,
  jumpVelocity: 5.25,
  landingPause: JELLY_CONTACT_TIME,
  dragTurnsPerScreen: 240 * Math.PI / 180,
  aheadLayers: 8,
  keepBehind: 3,
  breakthroughCombo: 5,
  smashBounceVelocity: 4.15
});

// src/logic.mjs?v=64d8f0fbc248
var TAU = Math.PI * 2;
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
function platformSpans(data, maxSpan = Math.PI / 3) {
  if (data.blocks) return data.blocks.map((block) => ({ ...block }));
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
    const type = data.gaps.some((g) => angleInArc(mid, g.start, g.width)) ? "gap" : data.hazards.some((h) => angleInArc(mid, h.start, h.width)) ? "hazard" : "safe";
    const last2 = runs.at(-1);
    if (last2?.type === type) last2.width += width;
    else runs.push({ start, width, type });
  }
  if (runs.length > 1 && runs[0].type === runs.at(-1).type) {
    const first = runs.shift();
    runs.at(-1).width += first.width;
  }
  return runs.flatMap((run) => {
    const count = run.type === "gap" ? 1 : Math.ceil(run.width / maxSpan);
    return Array.from({ length: count }, (_, i) => ({
      start: normalizeAngle(run.start + run.width * i / count),
      width: run.width / count,
      type: run.type
    }));
  });
}
var GameRules = class {
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
    this.deathReason = "starved";
  }
  hitHazard() {
    if (!this.alive) return;
    this.alive = false;
    this.deathReason = "hazard";
  }
};
var SeededRandom = class {
  constructor(seed = Date.now() >>> 0) {
    this.state = seed >>> 0 || 305419896;
  }
  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }
  range(min, max) {
    return min + (max - min) * this.next();
  }
  int(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
};
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
  if (depth < 40) return 0.1;
  if (depth < 60) return 0.15;
  if (depth < 80) return 0.19;
  return 0.23;
}
var LayerGenerator = class {
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
    const blocks = platformSpans({ gaps, hazards: [] });
    const solid = blocks.filter((b) => b.type === "safe");
    const largest = Math.max(...solid.map((b) => b.width));
    const candidates = solid.filter((b) => Math.abs(b.width - largest) < 1e-8);
    const count = hazardRatio > 0 ? Math.min(
      candidates.length,
      solid.length - 1,
      Math.max(1, Math.round(hazardRatio * TAU / largest))
    ) : 0;
    for (let i = 0; i < count; i++) {
      const index = this.rng.int(0, candidates.length - 1);
      candidates.splice(index, 1)[0].type = "hazard";
    }
    const hazards = blocks.filter((b) => b.type === "hazard").map(({ start, width: width2 }) => ({ start, width: width2 }));
    return { depth, gaps, hazards, blocks, chain, primaryAngle, width };
  }
};

// src/classic-material.js?v=64d8f0fbc248
var THREE = globalThis.__THREE__;
function createClassicMaterial(danger = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(danger ? "#f52280" : "#74ef8a") },
      uBody: { value: new THREE.Color(danger ? "#a80043" : "#069b53") },
      uGlow: { value: new THREE.Color(danger ? "#ffc1df" : "#e0ffb2") }
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
    `
  });
}

// src/candy-jelly-material.js?v=64d8f0fbc248
var THREE2 = globalThis.__THREE__;
function createCandyJellyMaterial(config, danger = false) {
  const material = new THREE2.MeshPhysicalMaterial({
    color: danger ? "#f51775" : "#99fa98",
    metalness: 0,
    roughness: 0.012,
    transmission: 0.91,
    thickness: config.platformThickness * 0.55,
    ior: 1.22,
    attenuationColor: danger ? "#760025" : "#31cc4c",
    attenuationDistance: danger ? 0.17 : 0.52,
    clearcoat: 0.8,
    clearcoatRoughness: 0.035,
    envMapIntensity: 1.15
  });
  material.userData.platformStyle = "candy-jelly";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute vec3 candyCoord; varying vec3 vCandy;
${shader.vertexShader}`.replace("#include <begin_vertex>", "#include <begin_vertex>\nvCandy = candyCoord;");
    shader.fragmentShader = `varying vec3 vCandy;
${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      float centerDepth = (1.0 - pow(abs(vCandy.x), 3.0)) * (1.0 - pow(abs(vCandy.z), 3.0));
      diffuseColor.rgb *= mix(vec3(1.0), vec3(${danger ? ".62, .30, .68" : ".64, .94, .63"}), centerDepth * .62);
    `);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <transmission_fragment>",
      THREE2.ShaderChunk.transmission_fragment.replace(
        "material.thickness = thickness;",
        "material.thickness = thickness * (.38 + centerDepth * .92);"
      )
    );
  };
  material.customProgramCacheKey = () => `volume-jelly-v2-${danger}`;
  return material;
}
function createAirPocketMaterial(danger = false) {
  return new THREE2.ShaderMaterial({
    uniforms: {
      body: { value: new THREE2.Color(danger ? "#c50958" : "#65db6f") },
      lightColor: { value: new THREE2.Color(danger ? "#ff92bc" : "#e5ffc2") }
    },
    vertexShader: `
      varying vec3 bubbleNormal;
      varying vec3 bubbleEye;
      void main() {
        vec4 p = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * p;
        bubbleNormal = normalize(normalMatrix * n);
        bubbleEye = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 body, lightColor;
      varying vec3 bubbleNormal, bubbleEye;
      void main() {
        vec3 n = normalize(bubbleNormal);
        float facing = max(0.0, dot(n, normalize(bubbleEye)));
        float rim = pow(1.0 - facing, 2.2);
        float upperReflection = pow(max(0.0, dot(n, normalize(vec3(-.45,.65,.75)))), 42.0);
        float lowerReflection = pow(max(0.0, dot(n, normalize(vec3(.48,-.68,.5)))), 65.0);
        vec3 color = body * (.65 + .35 * n.y);
        color = mix(color, lightColor, rim * .8);
        color += vec3(1.0) * upperReflection * 2.5 + lightColor * lowerReflection * 1.2;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
}

// src/platform-materials.js?v=64d8f0fbc248
var THREE3 = globalThis.__THREE__;
var STORAGE_KEY = "cat-tower.platform-material.v1";
var DEFAULT_PLATFORM_PRESET = "jelly";
var PLATFORM_PRESETS = Object.freeze([
  {
    id: "jelly",
    label: "透明果冻",
    description: "鲜亮青提 · 软糖猫爪",
    bubbles: true,
    rim: false,
    surfaceBubbles: false,
    flatPaw: false,
    candyDetails: true,
    rebound: 0.16,
    create: (config) => ({ safe: createCandyJellyMaterial(config), danger: createCandyJellyMaterial(config, true) })
  },
  {
    id: "classic",
    label: "原版糖块",
    description: "保留原版，随时对照",
    bubbles: false,
    rim: true,
    surfaceBubbles: true,
    flatPaw: true,
    flatSkull: true,
    rebound: 0.035,
    create: () => ({ safe: createClassicMaterial(), danger: createClassicMaterial(true) })
  },
  {
    id: "pudding",
    label: "奶油布丁",
    description: "柔和奶绿 · 草莓粉",
    bubbles: false,
    rim: false,
    surfaceBubbles: false,
    flatPaw: true,
    flatSkull: true,
    rebound: 0.1,
    create: () => {
      const base = { roughness: 0.3, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.16, envMapIntensity: 0.7 };
      return {
        safe: new THREE3.MeshPhysicalMaterial({ ...base, color: "#c4ee92" }),
        danger: new THREE3.MeshPhysicalMaterial({ ...base, color: "#ea5380" })
      };
    }
  }
]);
function readPlatformPreset(fallback = DEFAULT_PLATFORM_PRESET) {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return PLATFORM_PRESETS.some((p) => p.id === id) ? id : fallback;
  } catch {
    return fallback;
  }
}
function savePlatformPreset(id) {
  if (!PLATFORM_PRESETS.some((p) => p.id === id)) throw new Error(`Unknown platform material: ${id}`);
  try {
    localStorage.setItem(STORAGE_KEY, id);
    return true;
  } catch {
    return false;
  }
}
function createPlatformMaterials(config) {
  const cache = /* @__PURE__ */ new Map();
  let selected = PLATFORM_PRESETS.find((p) => p.id === readPlatformPreset());
  function pair() {
    if (!cache.has(selected.id)) cache.set(selected.id, selected.create(config));
    return cache.get(selected.id);
  }
  function apply(root) {
    const materials = pair();
    root.traverse((object) => {
      const role = object.userData.platformRole;
      if (role) object.material = materials[role];
      const decoration = object.userData.platformDecoration;
      if (decoration) object.visible = !!selected[decoration];
    });
  }
  return {
    get id() {
      return selected.id;
    },
    get preset() {
      return selected;
    },
    get current() {
      return pair();
    },
    apply,
    select(id, root) {
      const next = PLATFORM_PRESETS.find((p) => p.id === id);
      if (!next) throw new Error(`Unknown platform material: ${id}`);
      selected = next;
      if (root) apply(root);
      return pair();
    },
    dispose() {
      for (const pair2 of cache.values()) {
        pair2.safe.dispose();
        pair2.danger.dispose();
      }
      cache.clear();
    }
  };
}

// src/visuals.js?v=64d8f0fbc248
var THREE4 = globalThis.__THREE__;
var TAU2 = Math.PI * 2;
function canvasTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  const texture = new THREE4.CanvasTexture(canvas);
  texture.colorSpace = THREE4.SRGBColorSpace;
  return texture;
}
function createArt(renderer2, scene2, config, loadTexture) {
  const studio = new THREE4.Scene();
  studio.background = new THREE4.Color(0.1, 0.22, 0.12);
  const panels = [];
  for (const [position, size, brightness] of [
    [[-4, 4, 3], [2.5, 5], 7],
    [[4, 2, 1], [0.7, 4], 5],
    [[0, 4, -7], [5, 3], 4],
    [[-1, 0, -5], [3, 3], 2]
  ]) {
    const panel = new THREE4.Mesh(
      new THREE4.PlaneGeometry(...size),
      new THREE4.MeshBasicMaterial({ color: new THREE4.Color(brightness, brightness, brightness * 0.94) })
    );
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
    panels.push(panel);
  }
  const pmrem = new THREE4.PMREMGenerator(renderer2);
  const environment = pmrem.fromScene(studio, 0.025, 0.1, 50);
  scene2.environment = environment.texture;
  for (const panel of panels) {
    panel.geometry.dispose();
    panel.material.dispose();
  }
  pmrem.dispose();
  const physical = (color, extra = {}) => new THREE4.MeshPhysicalMaterial({
    color,
    roughness: 0.19,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.1,
    ...extra
  });
  const platformMaterials = createPlatformMaterials(config);
  const materials = {
    ivory: physical(16772556),
    bubble: physical(11993017, { roughness: 0.08, envMapIntensity: 1.8 }),
    redBubble: physical(16736405, { roughness: 0.08, envMapIntensity: 1.8 }),
    rim: new THREE4.MeshBasicMaterial({ color: 14679996, transparent: true, opacity: 0.66 }),
    redRim: new THREE4.MeshBasicMaterial({ color: 16755149, transparent: true, opacity: 0.68 }),
    crumb: physical(7335062)
  };
  const inclusions = { safe: createAirPocketMaterial(false), danger: createAirPocketMaterial(true) };
  const pawTexture = canvasTexture(256, 256, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 55, 0, 210);
    gradient.addColorStop(0, "#e1ffd6");
    gradient.addColorStop(1, "#82e9a0");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#eaffdf";
    ctx.lineWidth = 5;
    for (const [x, y, rx, ry, rot] of [[128, 160, 52, 37, 0], [66, 109, 20, 26, -0.45], [104, 78, 20, 27, -0.15], [150, 78, 20, 27, 0.15], [189, 109, 20, 26, 0.45]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, TAU2);
      ctx.fill();
      ctx.stroke();
    }
  });
  const skullTexture = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#ffbed6";
    ctx.strokeStyle = "#ffe7ed";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(128, 106, 72, 57, 0, 0, TAU2);
    ctx.fill();
    ctx.stroke();
    for (const x of [92, 128, 164]) {
      ctx.beginPath();
      ctx.roundRect(x - 11, 139, 22, 43, 10);
      ctx.fill();
    }
    ctx.fillStyle = "#ad1755";
    for (const x of [99, 157]) {
      ctx.beginPath();
      ctx.ellipse(x, 109, 20, 23, 0, 0, TAU2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(128, 131);
    ctx.lineTo(117, 145);
    ctx.lineTo(139, 145);
    ctx.fill();
  });
  const markMaterial = (map) => new THREE4.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const pawMat = markMaterial(pawTexture);
  const skullMat = markMaterial(skullTexture);
  const sphere = new THREE4.SphereGeometry(1, 12, 8);
  const markGeo = new THREE4.PlaneGeometry(0.66, 0.66);
  const dummy = new THREE4.Object3D();
  const pawSphere = new THREE4.SphereGeometry(1, 24, 16);
  const pawReliefMaterial = physical("#82ec9a", {
    roughness: 0.1,
    transmission: 0.55,
    thickness: 0.13,
    ior: 1.36,
    envMapIntensity: 1,
    attenuationColor: "#49e076",
    attenuationDistance: 0.8
  });
  const padShape = new THREE4.Shape();
  padShape.moveTo(-0.22, -0.1);
  padShape.bezierCurveTo(-0.34, -0.04, -0.17, 0.16, -0.06, 0.19);
  padShape.bezierCurveTo(-0.02, 0.22, 0.04, 0.22, 0.08, 0.18);
  padShape.bezierCurveTo(0.17, 0.12, 0.32, -0.04, 0.23, -0.12);
  padShape.bezierCurveTo(0.18, -0.18, 0.09, -0.1, 0, -0.1);
  padShape.bezierCurveTo(-0.08, -0.1, -0.18, -0.18, -0.22, -0.1);
  const padGeometry = new THREE4.ExtrudeGeometry(padShape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 4,
    curveSegments: 16
  });
  padGeometry.rotateX(-Math.PI / 2);
  const pawParts = [
    [padGeometry, 0, 0.027, 0.105, 1, 1, 1],
    ...[
      [-0.23, 0.04, -0.1, 0.08, 0.057, 0.1],
      [-0.085, 0.05, -0.22, 0.087, 0.06, 0.105],
      [0.085, 0.05, -0.22, 0.087, 0.06, 0.105],
      [0.23, 0.04, -0.1, 0.08, 0.057, 0.1]
    ].map((shape) => [pawSphere, ...shape])
  ];
  const pawReliefGeometry = new THREE4.BufferGeometry();
  const pawAttributes = { position: [], normal: [], uv: [] };
  for (const [source, x, y, z, sx, sy, sz] of pawParts) {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    const piece = (source.index ? source.toNonIndexed() : source.clone()).applyMatrix4(dummy.matrix);
    for (const name of Object.keys(pawAttributes)) pawAttributes[name].push(piece.getAttribute(name).array);
    piece.dispose();
  }
  for (const [name, arrays] of Object.entries(pawAttributes)) {
    const merged = new Float32Array(arrays.reduce((count, array) => count + array.length, 0));
    let offset = 0;
    for (const array of arrays) {
      merged.set(array, offset);
      offset += array.length;
    }
    pawReliefGeometry.setAttribute(name, new THREE4.BufferAttribute(merged, name === "uv" ? 2 : 3));
  }
  padGeometry.dispose();
  pawSphere.dispose();
  pawReliefGeometry.computeBoundingSphere();
  const skullShape = new THREE4.Shape();
  skullShape.moveTo(-0.2, -0.08);
  skullShape.bezierCurveTo(-0.38, 0.04, -0.29, 0.27, 0, 0.27);
  skullShape.bezierCurveTo(0.29, 0.27, 0.38, 0.04, 0.2, -0.08);
  skullShape.lineTo(0.2, -0.2);
  skullShape.quadraticCurveTo(0.15, -0.26, 0.1, -0.2);
  skullShape.lineTo(0.08, -0.14);
  skullShape.lineTo(0.06, -0.23);
  skullShape.quadraticCurveTo(0, -0.28, -0.06, -0.23);
  skullShape.lineTo(-0.08, -0.14);
  skullShape.lineTo(-0.1, -0.2);
  skullShape.quadraticCurveTo(-0.15, -0.26, -0.2, -0.2);
  skullShape.closePath();
  for (const x of [-0.12, 0.12]) {
    const eye = new THREE4.Path();
    eye.absellipse(x, 0.08, 0.075, 0.065, 0, TAU2, true);
    skullShape.holes.push(eye);
  }
  const nose = new THREE4.Path();
  nose.moveTo(0, 5e-3);
  nose.lineTo(0.035, -0.055);
  nose.lineTo(-0.035, -0.055);
  nose.closePath();
  skullShape.holes.push(nose);
  const skullReliefGeometry = new THREE4.ExtrudeGeometry(skullShape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.013,
    bevelSegments: 4,
    curveSegments: 18
  });
  skullReliefGeometry.rotateX(-Math.PI / 2);
  const skullReliefMaterial = physical("#ff5488", { roughness: 0.15, envMapIntensity: 0.85 });
  const glintTexture = canvasTexture(128, 128, (ctx) => {
    const glow = ctx.createRadialGradient(64, 64, 2, 64, 64, 61);
    glow.addColorStop(0, "#ffffdf");
    glow.addColorStop(0.15, "#f4ffb6c0");
    glow.addColorStop(1, "#eaff7700");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#ffffef";
    ctx.beginPath();
    ctx.moveTo(64, 7);
    ctx.quadraticCurveTo(69, 57, 117, 64);
    ctx.quadraticCurveTo(69, 69, 64, 121);
    ctx.quadraticCurveTo(59, 69, 11, 64);
    ctx.quadraticCurveTo(59, 57, 64, 7);
    ctx.fill();
  });
  const glintMaterial = new THREE4.SpriteMaterial({ map: glintTexture, transparent: true, depthWrite: false, toneMapped: false });
  function jellyGeometry(start, width) {
    const inner = config.pillarRadius + 0.035;
    const outer = config.platformRadius;
    const middle = (inner + outer) / 2;
    const radialWidth = outer - inner;
    const visualThickness = config.platformThickness * 1.22;
    const centerOffset = (visualThickness - config.platformThickness) / 2;
    const arcLength = Math.max(0.025, (width - Math.min(0.035, width * 0.12)) * middle);
    const half = new THREE4.Vector3(radialWidth / 2, visualThickness / 2, arcLength / 2);
    const radius = Math.min(0.16, arcLength * 0.22);
    const geometry = new THREE4.BoxGeometry(radialWidth, visualThickness, arcLength, 8, 6, 20).toNonIndexed();
    const positions = geometry.attributes.position;
    const candyCoords = new Float32Array(positions.count * 3);
    const p = new THREE4.Vector3(), core = new THREE4.Vector3(), delta = new THREE4.Vector3();
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i);
      core.set(
        THREE4.MathUtils.clamp(p.x, -half.x + radius, half.x - radius),
        THREE4.MathUtils.clamp(p.y, -half.y + radius, half.y - radius),
        THREE4.MathUtils.clamp(p.z, -half.z + radius, half.z - radius)
      );
      delta.copy(p).sub(core).normalize().multiplyScalar(radius);
      p.copy(core).add(delta);
      candyCoords.set([p.x / half.x, p.y / half.y, p.z / half.z], i * 3);
      const r = middle + p.x;
      const angle = start + width / 2 - p.z / middle;
      const crown = 0.024 * ((p.x / half.x) ** 2 + (p.z / half.z) ** 2);
      const y = p.y - centerOffset - Math.sign(p.y) * crown * (Math.abs(p.y) / half.y) ** 3;
      positions.setXYZ(i, Math.sin(angle) * r, y, Math.cos(angle) * r);
    }
    geometry.computeVertexNormals();
    geometry.setAttribute("candyCoord", new THREE4.BufferAttribute(candyCoords, 3));
    const normalSums = /* @__PURE__ */ new Map();
    const keyOf = (i) => [positions.getX(i), positions.getY(i), positions.getZ(i)].map((n) => Math.round(n * 1e4)).join(",");
    for (let i = 0; i < positions.count; i++) {
      const key2 = keyOf(i);
      const sum = normalSums.get(key2) || new THREE4.Vector3();
      sum.add(new THREE4.Vector3().fromBufferAttribute(geometry.attributes.normal, i));
      normalSums.set(key2, sum);
    }
    for (let i = 0; i < positions.count; i++) {
      const n = normalSums.get(keyOf(i)).normalize();
      geometry.attributes.normal.setXYZ(i, n.x, n.y, n.z);
    }
    return geometry;
  }
  function createPlatform(data, index) {
    const group = new THREE4.Group();
    const rng2 = new SeededRandom(index * 7919 + 812);
    const segments = [];
    for (const span of platformSpans(data)) {
      if (span.type === "gap") continue;
      const danger = span.type === "hazard";
      const part = new THREE4.Group();
      part.userData.span = span;
      const mesh = new THREE4.Mesh(jellyGeometry(span.start, span.width), platformMaterials.current[danger ? "danger" : "safe"]);
      mesh.userData.ownedGeometry = true;
      mesh.userData.platformRole = danger ? "danger" : "safe";
      part.add(mesh);
      const count = Math.max(2, Math.floor(span.width * 20));
      const bubbles = new THREE4.InstancedMesh(sphere, danger ? materials.redBubble : materials.bubble, count);
      for (let i = 0; i < count; i++) {
        const angle = span.start + span.width * rng2.range(0.12, 0.88);
        const size = rng2.range(0.022, 0.067);
        const top = i % 3 === 0;
        const radius = top ? rng2.range(config.pillarRadius + 0.2, config.platformRadius - 0.15) : config.platformRadius - 0.01;
        dummy.position.set(Math.sin(angle) * radius, top ? config.platformThickness / 2 + 5e-3 : rng2.range(-0.16, 0.13), Math.cos(angle) * radius);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(size, top ? size * 0.3 : size, top ? size : size * 0.25);
        dummy.updateMatrix();
        bubbles.setMatrixAt(i, dummy.matrix);
      }
      bubbles.userData.instanced = true;
      bubbles.userData.platformDecoration = "surfaceBubbles";
      part.add(bubbles);
      const inclusionCount = Math.max(3, Math.floor(span.width * 24));
      const inside = new THREE4.InstancedMesh(sphere, inclusions[danger ? "danger" : "safe"], inclusionCount);
      for (let i = 0; i < inclusionCount; i++) {
        const a = span.start + span.width * rng2.range(0.2, 0.8);
        const size = i % 4 === 0 ? rng2.range(0.075, 0.14) : rng2.range(0.018, 0.052);
        const r = i % 3 === 1 ? config.platformRadius - size * 0.45 : rng2.range(config.pillarRadius + 0.25, config.platformRadius - 0.25);
        const y = i % 3 === 0 ? config.platformThickness / 2 - size * 0.5 : rng2.range(-0.2, 0.1);
        dummy.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(size);
        dummy.updateMatrix();
        inside.setMatrixAt(i, dummy.matrix);
      }
      inside.userData.instanced = true;
      inside.userData.platformDecoration = "bubbles";
      part.add(inside);
      const points = [];
      const inset = Math.min(0.05, span.width * 0.18);
      for (let j = 0; j <= 24; j++) {
        const a = span.start + inset + (span.width - inset * 2) * j / 24;
        points.push(new THREE4.Vector3(Math.sin(a) * (config.platformRadius - 0.043), config.platformThickness / 2 - 0.025, Math.cos(a) * (config.platformRadius - 0.043)));
      }
      const rim = new THREE4.Mesh(new THREE4.TubeGeometry(new THREE4.CatmullRomCurve3(points), 24, 0.019, 5, false), danger ? materials.redRim : materials.rim);
      rim.userData.ownedGeometry = true;
      rim.userData.platformDecoration = "rim";
      part.add(rim);
      if (span.width > 0.22) {
        const mark = new THREE4.Mesh(markGeo, danger ? skullMat : pawMat);
        const a = span.start + span.width / 2;
        const r = (config.pillarRadius + config.platformRadius) / 2;
        mark.rotation.set(-Math.PI / 2, 0, -a);
        mark.position.set(Math.sin(a) * r, config.platformThickness / 2 + 8e-3, Math.cos(a) * r);
        const scale = Math.min(1, span.width / 0.42);
        mark.scale.setScalar(scale);
        mark.userData.platformDecoration = danger ? "flatSkull" : "flatPaw";
        part.add(mark);
        if (danger) {
          const relief = new THREE4.Mesh(skullReliefGeometry, skullReliefMaterial);
          relief.position.copy(mark.position);
          relief.position.y += 0.02;
          relief.rotation.y = a;
          relief.scale.setScalar(Math.min(1.3, span.width / 0.55));
          relief.userData.platformDecoration = "candyDetails";
          part.add(relief);
        }
        if (!danger) {
          const relief = new THREE4.Mesh(pawReliefGeometry, pawReliefMaterial);
          relief.userData.platformDecoration = "candyDetails";
          relief.position.copy(mark.position);
          relief.rotation.y = a;
          relief.scale.setScalar(Math.min(1.2, span.width / 0.55));
          part.add(relief);
        }
        if (span.width > 0.5) {
          const star = new THREE4.Sprite(glintMaterial);
          const angle = span.start + span.width * 0.83;
          star.position.set(
            Math.sin(angle) * (config.platformRadius - 0.13),
            config.platformThickness / 2 + 0.055,
            Math.cos(angle) * (config.platformRadius - 0.13)
          );
          star.scale.setScalar(0.25);
          star.userData.platformDecoration = "candyDetails";
          part.add(star);
        }
      }
      group.add(part);
      segments.push(part);
    }
    platformMaterials.apply(group);
    return { group, segments };
  }
  const columnTexture = loadTexture("./assets/column-hd.png");
  const columnMat = new THREE4.MeshBasicMaterial({ map: columnTexture, toneMapped: false });
  columnMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
      #include <map_fragment>
      diffuseColor = vec4(mix(vec3(1.0, .77, .46), diffuseColor.rgb, diffuseColor.a), 1.0);
    `);
  };
  const columnGeo = new THREE4.CylinderGeometry(config.pillarRadius, config.pillarRadius, config.layerGap + 6e-3, 64);
  const cp = columnGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    columnGeo.attributes.uv.setXY(
      i,
      0.5 + 0.18 * cp.getX(i) / config.pillarRadius,
      1 - (680 + (config.layerGap / 2 - cp.getY(i)) / config.layerGap * 480) / 1672
    );
  }
  function createColumn(index) {
    const group = new THREE4.Group();
    group.position.y = -index * config.layerGap;
    const body = new THREE4.Mesh(columnGeo, columnMat);
    body.position.y = -config.layerGap / 2;
    group.add(body);
    if (index === 0) {
      const cap = new THREE4.Mesh(columnCapGeo, materials.ivory);
      cap.position.y = 0.012;
      group.add(cap);
      const rim = new THREE4.Mesh(columnRimGeo, materials.ivory);
      rim.position.y = 0.025;
      group.add(rim);
    }
    return group;
  }
  const columnCapGeo = new THREE4.CylinderGeometry(config.pillarRadius, config.pillarRadius, 0.04, 64);
  const columnRimGeo = new THREE4.TorusGeometry(config.pillarRadius - 0.03, 0.055, 10, 64);
  columnRimGeo.rotateX(Math.PI / 2);
  const contactRingGeo = new THREE4.TorusGeometry(0.34, 0.065, 10, 40);
  contactRingGeo.rotateX(Math.PI / 2);
  function createPoisonContact() {
    const group = new THREE4.Group();
    const ring = new THREE4.Mesh(contactRingGeo, materials.redBubble);
    ring.scale.set(1.25, 1, 0.8);
    group.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = i * TAU2 / 5;
      const bubble = new THREE4.Mesh(sphere, materials.redBubble);
      bubble.scale.setScalar(0.035 + i % 2 * 0.024);
      bubble.position.set(Math.cos(a) * 0.45, 0.025, Math.sin(a) * 0.28);
      group.add(bubble);
    }
    return group;
  }
  const sparkleTexture = canvasTexture(64, 64, (ctx) => {
    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    glow.addColorStop(0, "#ffffff");
    glow.addColorStop(0.2, "#fffbd1");
    glow.addColorStop(1, "rgba(255,247,176,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#fffef0";
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.quadraticCurveTo(35, 29, 59, 32);
    ctx.quadraticCurveTo(35, 35, 32, 60);
    ctx.quadraticCurveTo(29, 35, 5, 32);
    ctx.quadraticCurveTo(29, 29, 32, 4);
    ctx.fill();
  });
  const sparkles = new THREE4.Group();
  const rng = new SeededRandom(128);
  for (let i = 0; i < 22; i++) {
    const star = new THREE4.Sprite(new THREE4.SpriteMaterial({ map: sparkleTexture, transparent: true, depthWrite: false, toneMapped: false }));
    star.position.set(rng.range(-2.7, 2.7), rng.range(-7, 6), rng.range(1.5, 3));
    star.userData.phase = rng.range(0, TAU2);
    star.userData.size = rng.range(0.09, 0.23);
    sparkles.add(star);
  }
  scene2.add(sparkles);
  function animate(time, focusY) {
    sparkles.position.y = focusY;
    for (const star of sparkles.children) {
      const pulse2 = 0.45 + 0.55 * Math.sin(time * 1.7 + star.userData.phase) ** 4;
      star.scale.setScalar(star.userData.size * pulse2);
      star.material.opacity = pulse2 * 0.85;
    }
  }
  return {
    materials,
    platformMaterials,
    createPlatform,
    createColumn,
    createPoisonContact,
    animate,
    setSparklesVisible(visible) {
      sparkles.visible = visible;
    }
  };
}
function disposePlatform(group) {
  group.traverse((object) => {
    if (object.userData.ownedGeometry) object.geometry.dispose();
    if (object.userData.instanced) object.dispose();
  });
  group.removeFromParent();
}
function setVisibleTowerLayers(platforms, columns, focusY, reach) {
  for (const collection of [platforms, columns]) {
    for (const item of collection.values()) {
      const group = item.group || item;
      group.visible = Math.abs(group.position.y - focusY) <= reach;
    }
  }
}

// src/game-assets.mjs?v=64d8f0fbc248
var GAME_ASSETS = Object.freeze({
  world: "./assets/world-hd.png",
  column: "./assets/column-hd.png",
  idle: "./assets/cat-idle-game.png",
  fall: "./assets/cat-fall-game.png",
  eat: "./assets/cat-eat-game.png",
  fail: "./assets/cat-fail-game.png",
  hud: "./assets/ui-hud-game.png",
  depth: "./assets/ui-depth-game.png",
  bounce: "./assets/ui-bounce-game.png",
  score: "./assets/star-game.png",
  result: "./assets/ui-results-game.png",
  homeTitle: "./assets/home-title.png",
  homeStart: "./assets/home-start.png",
  homeSettings: "./assets/home-settings.png",
  homeJellySafe: "./assets/home-jelly-safe.png",
  homeJellyDanger: "./assets/home-jelly-danger.png"
});
var CAT_SOURCES = Object.freeze({
  idle: GAME_ASSETS.idle,
  fall: GAME_ASSETS.fall,
  eat: GAME_ASSETS.eat,
  squash: GAME_ASSETS.idle,
  fail: GAME_ASSETS.fail
});

// src/world-background.js?v=64d8f0fbc248
function createWorldBackground(scene2, loadTexture) {
  const texture = loadTexture(GAME_ASSETS.world);
  scene2.background = texture;
  let lastAspect = 0;
  return function resizeBackground2(aspect) {
    const image = texture.image;
    if (!image?.width || lastAspect === aspect) return;
    lastAspect = aspect;
    const ratio = image.width / image.height / aspect;
    texture.repeat.set(Math.min(1, 1 / ratio), Math.min(1, ratio));
    texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
    texture.updateMatrix();
  };
}

// src/material-switcher.js?v=64d8f0fbc248
function mountMaterialSwitcher(art2, root, parent) {
  const panel = document.createElement("details");
  panel.className = "material-switcher";
  const summary = document.createElement("summary");
  panel.appendChild(summary);
  const options = document.createElement("div");
  options.className = "material-menu";
  options.setAttribute("role", "group");
  options.setAttribute("aria-label", "平台材质");
  panel.appendChild(options);
  function refresh() {
    summary.textContent = `材质 · ${art2.platformMaterials.preset.label}`;
    for (const button of options.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.preset === art2.platformMaterials.id));
    }
  }
  const requested = new URLSearchParams(location.search).get("material");
  if (PLATFORM_PRESETS.some((p) => p.id === requested)) art2.platformMaterials.select(requested, root);
  for (const preset of PLATFORM_PRESETS) {
    const button = document.createElement("button");
    button.dataset.preset = preset.id;
    button.textContent = preset.label;
    button.addEventListener("click", () => {
      art2.platformMaterials.select(preset.id, root);
      const saved = savePlatformPreset(preset.id);
      const url = new URL(location.href);
      url.searchParams.set("material", preset.id);
      history.replaceState(null, "", url);
      refresh();
      summary.title = saved ? "已记住选择" : "本次选择已保存在页面地址中";
      panel.open = false;
    });
    options.appendChild(button);
  }
  const link = document.createElement("a");
  link.href = "./material-lab.html";
  link.textContent = "打开材质小样 ↗";
  options.appendChild(link);
  refresh();
  parent.appendChild(panel);
}

// src/game-sounds.mjs?v=64d8f0fbc248
var GAME_SOUNDS = Object.freeze(Object.fromEntries(
  ["jump", "land", "eat", "combo", "low", "hazard", "starved", "smash"].map((name) => [name, `./assets/sfx/${name}.wav`])
));
function createWebSounds() {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  let context = null, enabled = true;
  const sourceData = new Map(Object.entries(GAME_SOUNDS).map(([name, url]) => [
    name,
    fetch(url).then((response) => {
      if (!response.ok) throw new Error(`音效加载失败：${url}`);
      return response.arrayBuffer();
    }).catch(() => null)
  ]));
  const buffers = /* @__PURE__ */ new Map();
  function unlock() {
    if (!enabled || !AudioContext) return;
    if (!context) {
      context = new AudioContext();
      for (const [name, data] of sourceData) {
        data.then((bytes) => bytes && context.decodeAudioData(bytes)).then((buffer) => {
          if (buffer) buffers.set(name, buffer);
        }).catch(() => {
        });
      }
    }
    context.resume().catch(() => {
    });
  }
  return {
    unlock,
    setEnabled(value) {
      enabled = !!value;
      if (enabled) unlock();
    },
    play(name) {
      if (!enabled || !context || context.state !== "running") return;
      const buffer = buffers.get(name);
      if (!buffer) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = 0.6;
      source.buffer = buffer;
      source.connect(gain).connect(context.destination);
      source.start();
    }
  };
}

// src/main.js
var THREE5 = globalThis.__THREE__;
if (!THREE5) throw new Error("Three.js 未加载");
var gameEl = document.getElementById("game");
var frameEl = document.getElementById("phoneFrame");
var debugMode = new URLSearchParams(location.search).has("debug");
var loadingEl = document.getElementById("loading");
var homeScreen = document.getElementById("homeScreen");
var settingsPanel = document.getElementById("settingsPanel");
var settingsBtn = document.getElementById("settingsBtn");
var closeSettingsBtn = document.getElementById("closeSettingsBtn");
var settingsDoneBtn = document.getElementById("settingsDoneBtn");
var sounds = createWebSounds();
var hud = {
  depth: document.getElementById("depth"),
  jumps: document.getElementById("jumps"),
  score: document.getElementById("score"),
  jumpBox: document.getElementById("jumpBox"),
  combo: document.getElementById("combo"),
  toast: document.getElementById("toast"),
  gameOver: document.getElementById("gameOver"),
  deathEmoji: document.getElementById("deathEmoji"),
  deathTitle: document.getElementById("deathTitle"),
  deathText: document.getElementById("deathText"),
  finalDepth: document.getElementById("finalDepth"),
  finalCombo: document.getElementById("finalCombo"),
  finalScore: document.getElementById("finalScore"),
  restartBtn: document.getElementById("restartBtn")
};
var scene = new THREE5.Scene();
scene.background = null;
scene.fog = new THREE5.Fog(15334143, 28, 52);
var initialW = Math.max(gameEl.clientWidth, 320);
var initialH = Math.max(gameEl.clientHeight, 568);
var camera = new THREE5.OrthographicCamera(-3.25, 3.25, 5.78, -5.78, 0.1, 100);
var renderer = new THREE5.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, GAME_CONFIG.maxPixelRatio));
renderer.setSize(initialW, initialH, false);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE5.PCFSoftShadowMap;
renderer.outputColorSpace = THREE5.SRGBColorSpace;
renderer.toneMapping = THREE5.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor(16777215, 0);
gameEl.appendChild(renderer.domElement);
var hemi = new THREE5.HemisphereLight(16775661, 11980008, 0.85);
scene.add(hemi);
var key = new THREE5.DirectionalLight(16774886, 2.4);
key.position.set(-5, 9, 7);
key.castShadow = false;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
scene.add(key);
var fill = new THREE5.DirectionalLight(12839679, 0.8);
fill.position.set(6, 4, -3);
scene.add(fill);
var towerRoot = new THREE5.Group();
scene.add(towerRoot);
var textureLoader = new THREE5.TextureLoader();
var artLoads = [];
function loadArtTexture(url) {
  let tex;
  artLoads.push(new Promise((resolve, reject) => {
    tex = textureLoader.load(url, resolve, void 0, () => reject(new Error(`素材加载失败：${url}`)));
  }));
  tex.colorSpace = THREE5.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}
var art = createArt(renderer, scene, GAME_CONFIG, loadArtTexture);
var resizeBackground = createWorldBackground(scene, loadArtTexture);
mountMaterialSwitcher(art, towerRoot, frameEl);
renderer.transmissionResolutionScale = GAME_CONFIG.transmissionResolutionScale;
var pillarRoot = new THREE5.Group();
scene.add(pillarRoot);
var pillarModules = /* @__PURE__ */ new Map();
function ensurePillarModules() {
  const start = Math.max(0, rules.depth - GAME_CONFIG.keepBehind - 3);
  const end = rules.depth + GAME_CONFIG.aheadLayers + 1;
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
var catSources = CAT_SOURCES;
var catTextureCache = /* @__PURE__ */ new Map();
var catTextures = Object.fromEntries(Object.entries(catSources).map(([key2, url]) => {
  if (!catTextureCache.has(url)) catTextureCache.set(url, loadArtTexture(url));
  return [key2, catTextureCache.get(url)];
}));
function createCat() {
  const root = new THREE5.Group();
  root.position.set(0, 0, GAME_CONFIG.catZ);
  scene.add(root);
  const visual = new THREE5.Sprite(new THREE5.SpriteMaterial({
    map: catTextures.idle,
    transparent: true,
    alphaTest: 0.025,
    depthWrite: false,
    toneMapped: false
  }));
  visual.center.set(0.5, 0.065);
  root.add(visual);
  const mouthAnchor = new THREE5.Object3D();
  mouthAnchor.position.set(0, 0.48, 0.12);
  root.add(mouthAnchor);
  const shadow = new THREE5.Mesh(new THREE5.CircleGeometry(0.34, 32), new THREE5.MeshBasicMaterial({
    color: 2458705,
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  }));
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);
  return { root, visual, mouthAnchor, shadow, currentTexture: "idle", eatTimer: 0 };
}
function setCatTexture(name) {
  if (cat.currentTexture === name) return;
  cat.currentTexture = name;
  cat.visual.material.map = catTextures[name];
}
var cat = createCat();
var rules = new GameRules({ initialJumps: GAME_CONFIG.initialJumps, maxJumps: GAME_CONFIG.maxJumps });
var generator = new LayerGenerator((Date.now() ^ 659918) >>> 0);
var layers = /* @__PURE__ */ new Map();
var eatEffects = createEatEffects(
  THREE5,
  scene,
  towerRoot,
  GAME_CONFIG,
  art.materials,
  getMouthWorldPosition,
  () => document.createElement("canvas"),
  () => {
    cat.eatTimer = Math.max(cat.eatTimer, 0.26);
  }
);
function makeLayer(index) {
  const data = generator.create(Math.max(0, index), rules.jumps <= 2);
  const { group, segments } = art.createPlatform(data, index);
  group.position.y = -index * GAME_CONFIG.layerGap;
  towerRoot.add(group);
  const layer = { index, data, group, segments, eaten: false };
  layers.set(index, layer);
  return layer;
}
function ensureLayers() {
  const start = Math.max(0, rules.depth);
  const end = rules.depth + GAME_CONFIG.aheadLayers;
  for (let i = start; i <= end; i++) {
    if (!layers.has(i)) makeLayer(i);
  }
  for (const [i, layer] of layers) {
    if (i < rules.depth - GAME_CONFIG.keepBehind) {
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
  return normalizeAngle(-towerRoot.rotation.y);
}
function getCatRadius() {
  const t = THREE5.MathUtils.clamp(rules.jumps / GAME_CONFIG.maxJumps, 0, 1);
  return THREE5.MathUtils.lerp(GAME_CONFIG.catRadius * 0.83, GAME_CONFIG.catRadiusAtMax, t);
}
function targetCatScale() {
  const t = THREE5.MathUtils.clamp(rules.jumps / GAME_CONFIG.maxJumps, 0, 1);
  return THREE5.MathUtils.lerp(0.68, 0.98, t);
}
function layerTopY(layer) {
  const part = partUnderCat(layer);
  return layer.group.position.y + GAME_CONFIG.platformThickness / 2 * (part?.scale.y ?? 1) + (part?.position.y ?? 0);
}
function partUnderCat(layer) {
  const angle = localAngleUnderCat();
  return layer.segments.find((part) => angleInArc(angle, part.userData.span.start, part.userData.span.width));
}
function compressJelly(layer, speed) {
  const part = partUnderCat(layer);
  if (part) part.userData.spring = { time: 0, strength: THREE5.MathUtils.clamp(0.23 + Math.abs(speed) * 0.018, 0.28, 0.43) };
}
function updateJellyMotion(dt) {
  for (const layer of layers.values()) for (const part of layer.segments) {
    const spring = part.userData.spring;
    if (!spring) continue;
    spring.time += dt;
    const compression = jellyCompression(spring.time, spring.strength);
    part.scale.set(1 + compression * 0.1, 1 - compression, 1 + compression * 0.1);
    part.position.y = -compression * GAME_CONFIG.platformThickness * 0.72;
    if (spring.time >= 0.9) delete part.userData.spring;
  }
}
function platformStatus(layer) {
  const angle = localAngleUnderCat();
  if (layer.data.gaps.some((g) => angleInArc(angle, g.start, g.width))) return "gap";
  if (layer.data.hazards.some((h) => angleInArc(angle, h.start, h.width))) return "hazard";
  return "safe";
}
function showCombo(n) {
  if (n < 2) return;
  hud.combo.textContent = `连吃 ×${n}`;
  hud.combo.classList.remove("show");
  void hud.combo.offsetWidth;
  hud.combo.classList.add("show");
}
function spawnPlusOne() {
  const el = document.createElement("div");
  el.className = "plus-one";
  el.textContent = "+1 弹跳";
  frameEl.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
}
var pulse = 0;
var squash = 0;
var deadShown = false;
var gameOverTimer;
var poisonSink = null;
var state = "idle";
var vy = 0;
var landingTimer = 0;
var landedLayer = null;
var firstInput = false;
var smashReady = false;
var smashLayer = null;
var smashTimer = 0;
var smashBaseY = 0;
function updateHUD() {
  hud.depth.textContent = String(rules.depth);
  hud.jumps.textContent = `× ${rules.jumps}`;
  hud.score.textContent = String(rules.score);
  hud.jumpBox.classList.toggle("warning", rules.jumps <= 2 && rules.alive);
}
function consumeBounce() {
  if (!rules.bounce()) {
    state = "starved";
    sounds.play("starved");
    showGameOver("starved");
    return false;
  }
  sounds.play("jump");
  if (rules.jumps === 2) sounds.play("low");
  updateHUD();
  pulse = -0.08;
  vy = GAME_CONFIG.jumpVelocity;
  state = "bouncing";
  landedLayer = null;
  return true;
}
function landOn(layer) {
  sounds.play("land");
  cleanupLayersAbove(layer.index);
  compressJelly(layer, vy);
  landedLayer = layer;
  cat.root.position.y = layerTopY(layer) + getCatRadius();
  vy = 0;
  rules.land();
  state = "landed";
  landingTimer = GAME_CONFIG.landingPause;
  squash = 1;
  updateHUD();
}
function getMouthWorldPosition() {
  const p = new THREE5.Vector3();
  cat.mouthAnchor.getWorldPosition(p);
  return p;
}
function cleanupLayersAbove(landedIndex) {
  const stale = [...layers.values()].filter((l) => l.index < landedIndex && !l.eaten).sort((a, b) => a.index - b.index);
  for (const layer of stale) {
    layer.eaten = true;
    spawnEatFragments(layer);
    disposePlatform(layer.group);
    layers.delete(layer.index);
  }
}
function spawnEatFragments(layer) {
  eatEffects.spawn(layer);
}
function beginEat(layer) {
  if (layer.eaten) return;
  layer.eaten = true;
  rules.passLayer();
  sounds.play("eat");
  if (rules.combo === 3 || rules.combo === GAME_CONFIG.breakthroughCombo) sounds.play("combo");
  if (rules.combo === GAME_CONFIG.breakthroughCombo) smashReady = true;
  pulse = Math.min(0.22, pulse + 0.1);
  spawnPlusOne();
  showCombo(rules.combo);
  updateHUD();
  spawnEatFragments(layer);
  disposePlatform(layer.group);
  layers.delete(layer.index);
}
function startLandingSmash(layer) {
  if (layer.eaten || !smashReady) return;
  sounds.play("land");
  smashReady = false;
  smashLayer = layer;
  compressJelly(layer, vy);
  smashBaseY = layerTopY(layer) + getCatRadius();
  cat.root.position.y = smashBaseY;
  vy = 0;
  state = "smashCharge";
  smashTimer = 0.1;
  squash = 1.25;
  rules.land();
  updateHUD();
}
function resolveLandingSmash() {
  const layer = smashLayer;
  if (!layer || layer.eaten) {
    smashLayer = null;
    state = "bouncing";
    vy = GAME_CONFIG.smashBounceVelocity;
    return;
  }
  layer.eaten = true;
  sounds.play("smash");
  rules.passLayer();
  spawnPlusOne();
  spawnEatFragments(layer);
  disposePlatform(layer.group);
  layers.delete(layer.index);
  rules.land();
  pulse = Math.min(0.36, pulse + 0.22);
  squash = 0.75;
  hud.combo.textContent = "砸碎！";
  hud.combo.classList.remove("show");
  void hud.combo.offsetWidth;
  hud.combo.classList.add("show");
  updateHUD();
  smashLayer = null;
  smashTimer = 0;
  state = "bouncing";
  vy = GAME_CONFIG.smashBounceVelocity;
  cat.root.position.y = smashBaseY + 0.035;
}
function hitHazard(layer) {
  if (!rules.alive) return;
  sounds.play("hazard");
  rules.hitHazard();
  state = "hazardSinking";
  vy = 0;
  dragging = false;
  const contact = art.createPoisonContact();
  contact.position.set(cat.root.position.x, layerTopY(layer) + 0.018, GAME_CONFIG.catZ);
  scene.add(contact);
  poisonSink = { startY: cat.root.position.y, elapsed: 0, depth: 0.48, contact, layer: layer.index };
  cat.eatTimer = 0;
  pulse = 0;
  squash = 0;
  updateHUD();
}
function showGameOver(reason) {
  if (deadShown) return;
  deadShown = true;
  gameOverTimer = setTimeout(() => {
    hud.finalDepth.textContent = `${rules.depth} 层`;
    hud.finalCombo.textContent = `×${rules.bestCombo}`;
    hud.finalScore.textContent = String(rules.score);
    if (reason === "hazard") {
      hud.deathEmoji.textContent = "🙀";
      hud.deathTitle.textContent = "被毒果冻困住啦";
      hud.deathText.textContent = "黏住了小爪爪，跳不起来了…";
    } else {
      hud.deathEmoji.textContent = "😿";
      hud.deathTitle.textContent = "没力气啦！";
      hud.deathText.textContent = "少空跳，多追连续缺口，吃掉果冻就能补充弹跳次数。";
    }
    hud.gameOver.classList.remove("hidden");
  }, reason === "hazard" ? 500 : 560);
}
function resetGame() {
  clearTimeout(gameOverTimer);
  if (poisonSink) {
    poisonSink.contact.removeFromParent();
    poisonSink = null;
  }
  rules.reset();
  landedLayer = null;
  generator = new LayerGenerator((Date.now() ^ Math.random() * 4294967295 >>> 0) >>> 0);
  clearLayers();
  clearPillarModules();
  eatEffects.clear();
  frameEl.querySelectorAll(".plus-one").forEach((el) => el.remove());
  hud.combo.classList.remove("show");
  towerRoot.rotation.y = 0;
  cat.root.position.set(0, GAME_CONFIG.platformThickness / 2 + getCatRadius(), GAME_CONFIG.catZ);
  cat.root.rotation.set(0, 0, 0);
  cat.visual.scale.setScalar(targetCatScale());
  cat.eatTimer = 0;
  setCatTexture("idle");
  deadShown = false;
  smashReady = false;
  smashLayer = null;
  smashTimer = 0;
  smashBaseY = 0;
  pulse = 0;
  squash = 0;
  state = "ready";
  firstInput = false;
  hud.toast.classList.remove("hide");
  vy = 0;
  landingTimer = 0.34;
  ensureLayers();
  ensurePillarModules();
  towerRoot.rotation.y = -layers.get(0).data.primaryAngle + 0.95;
  cameraFocusY = cat.root.position.y - 2.15;
  hud.gameOver.classList.add("hidden");
  updateHUD();
  scheduleFrame(true);
}
hud.restartBtn.addEventListener("click", resetGame);
document.getElementById("soundToggle").addEventListener("change", (event) => {
  sounds.setEnabled(event.target.checked);
});
function closeSettings() {
  settingsPanel.classList.add("hidden");
  homeScreen.inert = false;
  settingsBtn.focus();
}
settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.remove("hidden");
  homeScreen.inert = true;
  closeSettingsBtn.focus();
});
closeSettingsBtn.addEventListener("click", closeSettings);
settingsDoneBtn.addEventListener("click", closeSettings);
settingsPanel.addEventListener("click", (event) => {
  if (event.target === settingsPanel) closeSettings();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsPanel.classList.contains("hidden")) closeSettings();
});
document.getElementById("homeMotionToggle").addEventListener("change", (event) => {
  homeScreen.classList.toggle("no-motion", !event.target.checked);
});
document.getElementById("startBtn").addEventListener("click", () => {
  sounds.unlock();
  homeScreen.hidden = true;
  frameEl.classList.remove("at-home");
  resetGame();
});
document.getElementById("homeBtn").addEventListener("click", () => {
  hud.gameOver.classList.add("hidden");
  homeScreen.hidden = false;
  frameEl.classList.add("at-home");
  if (frameHandle !== null) cancelAnimationFrame(frameHandle);
  frameHandle = null;
  document.getElementById("startBtn").focus();
});
function collisionStep(prevY, currentY) {
  if (!rules.alive || state === "landed" || vy >= 0) return;
  const radius = getCatRadius();
  const prevBottomY = prevY - radius;
  const currBottomY = currentY - radius;
  for (const layer of layers.values()) {
    if (layer.eaten) continue;
    const top = layerTopY(layer);
    if (!(prevBottomY >= top && currBottomY <= top)) continue;
    const status = platformStatus(layer);
    if (status === "gap") {
      beginEat(layer);
      continue;
    }
    if (smashReady) {
      startLandingSmash(layer);
      return;
    }
    if (status === "hazard") {
      cat.root.position.y = top + radius;
      hitHazard(layer);
      return;
    }
    cat.root.position.y = top + radius;
    landOn(layer);
    return;
  }
}
function updateCat(dt) {
  if (state === "landed") {
    if (landedLayer && !landedLayer.eaten) {
      const status = platformStatus(landedLayer);
      if (status === "gap") {
        beginEat(landedLayer);
        landedLayer = null;
        state = "bouncing";
        vy = -0.2;
      } else if (status === "hazard") {
        cat.root.position.y = layerTopY(landedLayer) + getCatRadius();
        hitHazard(landedLayer);
        landedLayer = null;
      } else cat.root.position.y = layerTopY(landedLayer) + getCatRadius();
    }
    if (state === "landed") {
      landingTimer -= dt;
      if (landingTimer <= 0) consumeBounce();
    }
  } else if (state === "starved" && landedLayer && !landedLayer.eaten) {
    cat.root.position.y = layerTopY(landedLayer) + getCatRadius();
  } else if (state === "smashCharge" && rules.alive) {
    smashTimer -= dt;
    cat.root.position.y = smashLayer ? layerTopY(smashLayer) + getCatRadius() : smashBaseY;
    if (smashTimer <= 0) resolveLandingSmash();
  } else if (state === "bouncing" && rules.alive) {
    const prevY = cat.root.position.y;
    vy += GAME_CONFIG.gravity * dt;
    cat.root.position.y += vy * dt;
    collisionStep(prevY, cat.root.position.y);
  } else if (state === "hazardSinking") {
    poisonSink.elapsed = Math.min(0.85, poisonSink.elapsed + dt);
    const t = poisonSink.elapsed / 0.85;
    const eased = t * t * (3 - 2 * t);
    cat.root.position.y = poisonSink.startY - poisonSink.depth * eased;
    poisonSink.contact.scale.setScalar(0.8 + 0.2 * eased);
    vy = 0;
    if (t >= 1) {
      state = "hazardStuck";
      showGameOver("hazard");
    }
  }
  const isFalling = state === "bouncing" && vy < -0.8;
  const base = targetCatScale();
  pulse *= Math.pow(0.035, dt);
  squash *= Math.pow(25e-4, dt);
  cat.eatTimer = Math.max(0, cat.eatTimer - dt);
  const sx = base * (1 + pulse + squash * 0.12) * (isFalling ? 0.96 : 1);
  const sy = base * (1 + pulse * 0.55 - squash * 0.18) * (isFalling ? 1.04 : 1);
  cat.visual.scale.x = THREE5.MathUtils.lerp(cat.visual.scale.x, 1.50 * sx, dt ? 1 - Math.exp(-14 * dt) : 1);
  cat.visual.scale.y = THREE5.MathUtils.lerp(cat.visual.scale.y, 1.50 * sy, dt ? 1 - Math.exp(-14 * dt) : 1);
  cat.visual.scale.z = 1;
  cat.visual.position.y = -getCatRadius() + 0.08;
  cat.visual.material.rotation = isFalling ? Math.sin(performance.now() * 8e-3) * 0.035 : 0;
  if (state === "ready") {
    cat.visual.position.y += Math.sin(performance.now() * 25e-4) * 0.055;
  }
  let ground = null;
  for (const layer of layers.values()) {
    if (!layer.eaten && layerTopY(layer) <= cat.root.position.y && (!ground || layer.index < ground.index)) ground = layer;
  }
  cat.shadow.visible = !!ground && platformStatus(ground) !== "gap";
  if (ground) {
    cat.shadow.position.y = layerTopY(ground) - cat.root.position.y + 0.014;
    cat.shadow.scale.setScalar(Math.max(0.4, 1 - (cat.root.position.y - layerTopY(ground)) * 0.22));
  }
  if (poisonSink) {
    setCatTexture("fall");
    cat.visual.material.rotation = -0.1;
    cat.shadow.visible = false;
  } else if (!rules.alive || state === "starved") {
    setCatTexture("fail");
  } else if (state === "smashCharge") {
    setCatTexture("squash");
  } else if (cat.eatTimer > 0) {
    setCatTexture("eat");
  } else if (isFalling) {
    setCatTexture("fall");
  } else {
    setCatTexture("idle");
  }
  const tilt = isFalling ? Math.sin(performance.now() * 0.01) * 0.035 : 0;
  cat.visual.rotation.z = THREE5.MathUtils.lerp(cat.visual.rotation.z, tilt, 1 - Math.exp(-9 * dt));
  cat.shadow.material.opacity = THREE5.MathUtils.lerp(
    cat.shadow.material.opacity,
    isFalling ? 0.08 : 0.16,
    1 - Math.exp(-8 * dt)
  );
}
var cameraFocusY = 0;
function updateCamera(dt) {
  const anchorY = poisonSink ? poisonSink.startY : cat.root.position.y;
  const targetY = anchorY - (rules.depth === 0 ? 2.15 : 1.45);
  const speed = targetY < cameraFocusY ? 9 : 1.6;
  cameraFocusY = THREE5.MathUtils.lerp(cameraFocusY, targetY, 1 - Math.exp(-speed * dt));
  cameraFocusY = Math.min(cameraFocusY, targetY + 0.75);
  camera.position.set(0, cameraFocusY + 8.2, 20);
  camera.lookAt(0, cameraFocusY, 0);
  setVisibleTowerLayers(
    layers,
    pillarModules,
    cameraFocusY,
    camera.top * 1.1 + GAME_CONFIG.layerGap + GAME_CONFIG.platformThickness
  );
  art.animate(performance.now() / 1e3, cameraFocusY);
  resizeBackground(gameEl.clientWidth / Math.max(1, gameEl.clientHeight));
}
var dragging = false;
var pointerX = 0;
function pointerDown(e) {
  if (!rules.alive) return;
  sounds.unlock();
  dragging = true;
  pointerX = e.clientX;
  renderer.domElement.setPointerCapture?.(e.pointerId);
  if (!firstInput) {
    firstInput = true;
    state = "landed";
    landingTimer = 0.12;
    hud.toast.classList.add("hide");
  }
}
function pointerMove(e) {
  if (!dragging || !rules.alive) return;
  const dx = e.clientX - pointerX;
  pointerX = e.clientX;
  const sensitivity = GAME_CONFIG.dragTurnsPerScreen / Math.max(gameEl.clientWidth, 320);
  towerRoot.rotation.y += dx * sensitivity;
}
function pointerUp(e) {
  dragging = false;
  renderer.domElement.releasePointerCapture?.(e.pointerId);
}
renderer.domElement.addEventListener("pointerdown", pointerDown);
renderer.domElement.addEventListener("pointermove", pointerMove);
renderer.domElement.addEventListener("pointerup", pointerUp);
renderer.domElement.addEventListener("pointercancel", pointerUp);
var frameHandle = null;
var frameLoopReady = false;
var renderedFrames = 0;
var last = performance.now();
var nativeActive = globalThis.CatAndroidLifecycle?.active ?? true;
function scheduleFrame(resetTime = false) {
  if (!frameLoopReady || document.hidden || !nativeActive || frameEl.classList.contains("at-home") || frameHandle !== null) return;
  if (resetTime) last = performance.now();
  frameHandle = requestAnimationFrame(frame);
}
function resize() {
  const w = Math.max(gameEl.clientWidth, 1);
  const h = Math.max(gameEl.clientHeight, 1);
  const viewWidth = Math.max(6.25, 10.5 * w / h);
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewWidth * h / w / 2;
  camera.bottom = -camera.top;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, GAME_CONFIG.maxPixelRatio));
  scheduleFrame(true);
}
addEventListener("resize", resize);
new ResizeObserver(resize).observe(frameEl);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (frameHandle !== null) cancelAnimationFrame(frameHandle);
    frameHandle = null;
  } else scheduleFrame(true);
});
globalThis.CatAndroidLifecycle = {
  active: nativeActive,
  setActive(active) {
    nativeActive = !!active;
    this.active = nativeActive;
    if (!nativeActive) {
      dragging = false;
      if (frameHandle !== null) cancelAnimationFrame(frameHandle);
      frameHandle = null;
    } else scheduleFrame(true);
  }
};
function frame(now) {
  frameHandle = null;
  const dt = Math.min((now - last) / 1e3, 1 / 30);
  last = now;
  ensureLayers();
  ensurePillarModules();
  updateJellyMotion(dt);
  updateCat(dt);
  eatEffects.update(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  renderedFrames++;
  if (!deadShown || eatEffects.count > 0) scheduleFrame();
}
resize();
resetGame();
updateCat(0);
updateCamera(0);
if (debugMode) {
  globalThis.__GAME_DEBUG__ = {
    rules,
    layers,
    towerRoot,
    cat,
    renderer,
    camera,
    resetGame,
    get state() {
      return state;
    },
    alignGap() {
      const next = [...layers.values()].filter((l) => !l.eaten).sort((a, b) => a.index - b.index)[0];
      if (next) towerRoot.rotation.y = -next.data.primaryAngle;
    },
    aimAt(type) {
      const next = [...layers.values()].filter((l) => !l.eaten).sort((a, b) => a.index - b.index)[0];
      const span = next && platformSpans(next.data).find((s) => s.type === type);
      if (span) towerRoot.rotation.y = -(span.start + span.width / 2);
      return !!span;
    },
    snapshot() {
      return {
        state,
        depth: rules.depth,
        jumps: rules.jumps,
        frames: renderedFrames,
        objects: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        effects: eatEffects.count,
        effectDrawCalls: eatEffects.chunkDrawCalls
      };
    }
  };
}
await Promise.all(artLoads);
loadingEl.classList.add("hidden");
frameLoopReady = true;
globalThis.dispatchEvent(new Event("cat-game-ready"));
