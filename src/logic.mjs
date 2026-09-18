export const TAU = Math.PI * 2;

export function normalizeAngle(a) {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}

export function angleInArc(angle, start, width) {
  const a = normalizeAngle(angle);
  const s = normalizeAngle(start);
  const d = normalizeAngle(a - s);
  return d <= width;
}

export class GameRules {
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

export class SeededRandom {
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

export class LayerGenerator {
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
