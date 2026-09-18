import assert from 'node:assert/strict';
import { GameRules, LayerGenerator, angleInArc } from '../src/logic.mjs';

function cycleSingleLayer(rules) {
  rules.passLayer(); // +1
  rules.land();
  rules.bounce();    // -1
}

{
  const r = new GameRules({ initialJumps: 5, maxJumps: 10 });
  r.bounce(); // first takeoff costs one
  assert.equal(r.jumps, 4);
  r.passLayer(); // eat current cookie layer
  assert.equal(r.jumps, 5);
  r.land();
  r.bounce();
  assert.equal(r.jumps, 4, 'one complete next bounce consumes one again');
}

{
  const r = new GameRules({ initialJumps: 5, maxJumps: 10 });
  // Compare from a state immediately after takeoff: one-layer descent returns +1.
  r.bounce();
  const start = r.jumps;
  r.passLayer();
  r.land();
  assert.equal(r.jumps, start + 1);
  // If it immediately takes the next bounce, the full layer-to-layer cycle nets 0.
  r.bounce();
  assert.equal(r.jumps, start);
}

{
  const r = new GameRules({ initialJumps: 5, maxJumps: 10 });
  r.bounce();
  const afterTakeoff = r.jumps;
  r.passLayer(); r.passLayer(); r.passLayer();
  r.land();
  r.bounce();
  assert.equal(r.jumps, afterTakeoff + 2, '3-layer chain should net +2 across the next takeoff');
  assert.equal(r.bestCombo, 3);
}

{
  const r = new GameRules({ initialJumps: 1 });
  assert.equal(r.bounce(), true);
  assert.equal(r.jumps, 0);
  r.land();
  assert.equal(r.bounce(), false);
  assert.equal(r.deathReason, 'starved');
}

{
  const r = new GameRules();
  r.hitHazard();
  assert.equal(r.alive, false);
  assert.equal(r.deathReason, 'hazard');
}

{
  const g = new LayerGenerator(42);
  const layers = Array.from({length: 120}, (_, i) => g.create(i, false));
  assert.equal(layers.length, 120);
  assert.ok(layers.every(l => l.gaps.length >= 1));
  assert.ok(layers.slice(0, 8).every(l => l.hazards.length === 0), 'first 8 layers must be hazard-free');
}

{
  const r = new GameRules({ initialJumps: 10, maxJumps: 10 });
  r.passLayer();
  assert.equal(r.jumps, 10, 'jump count must not exceed max');
  assert.equal(r.fullBonus, 1, 'overflow layer should become full-belly bonus');
  assert.ok(r.score > 10, 'overflow should add score instead of wasting reward');
}

{
  const r = new GameRules({ initialJumps: 5, maxJumps: 10 });
  r.bounce(); r.passLayer(); r.hitHazard();
  r.reset();
  assert.equal(r.jumps, 5);
  assert.equal(r.score, 0);
  assert.equal(r.depth, 0);
  assert.equal(r.combo, 0);
  assert.equal(r.alive, true);
  assert.equal(r.deathReason, null);
}

{
  // Same seed: low-jump generation should widen the next gap by ~10 degrees.
  const normal = new LayerGenerator(2026).create(35, false);
  const rescue = new LayerGenerator(2026).create(35, true);
  assert.ok(rescue.width > normal.width, 'low jump state should widen the primary gap');
}

assert.equal(angleInArc(0.1, 0, 0.2), true);
assert.equal(angleInArc(6.25, 6.2, 0.2), true);
assert.equal(angleInArc(0.05, 6.2, 0.2), true, 'wrapped arc should work');

console.log('✓ game rules tests passed');
