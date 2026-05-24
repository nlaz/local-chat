const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Physics = require('../public/js/physics.js');
const W       = require('../public/js/world.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkPlayer(overrides = {}) {
  // Default: standing on ground. Tests needing airborne state pass stoodOn: null explicitly.
  return Object.assign({
    id:          'p1',
    x:           400,
    y:           W.GROUND_Y - W.BLOB_H,  // standing on ground
    vx:          0,
    vy:          0,
    facingLeft:  false,
    stoodOn:     'ground',
    prevY:       W.GROUND_Y - W.BLOB_H,
    inputLeft:   false,
    inputRight:  false,
    inputJump:   false,
    jumpConsumed: false,
  }, overrides);
}

function mkWorld() {
  return W;
}

// Run a single physics step at dt=1/60 and return the resulting player map
function step1(players, inputs = {}, dt = 1/60) {
  return Physics.step(mkWorld(), players, inputs, dt);
}

// Convenience: single player, single step
function step1p(player, input = {}, dt = 1/60) {
  const result = step1({ p1: player }, { p1: input }, dt);
  return result.p1;
}

// Run N steps
function stepN(player, input, n, dt = 1/60) {
  let players = { p1: player };
  const inputs = { p1: input };
  for (let i = 0; i < n; i++) {
    players = Physics.step(mkWorld(), players, inputs, dt);
  }
  return players.p1;
}

// ── Happy path ────────────────────────────────────────────────────────────────

describe('horizontal movement', () => {
  test('pressing right moves player rightward', () => {
    const p = mkPlayer({ x: 400 });
    const after = step1p(p, { inputRight: true });
    assert.ok(after.x > 400, `expected x > 400, got ${after.x}`);
  });

  test('pressing left moves player leftward', () => {
    const p = mkPlayer({ x: 400 });
    const after = step1p(p, { inputLeft: true });
    assert.ok(after.x < 400, `expected x < 400, got ${after.x}`);
  });

  test('no input keeps player stationary horizontally', () => {
    const p = mkPlayer({ x: 400, vx: 0 });
    const after = step1p(p, {});
    assert.equal(after.x, 400);
  });

  test('facingLeft set when moving left', () => {
    const p = mkPlayer();
    const after = step1p(p, { inputLeft: true });
    assert.equal(after.facingLeft, true);
  });

  test('facingLeft cleared when moving right', () => {
    const p = mkPlayer({ facingLeft: true });
    const after = step1p(p, { inputRight: true });
    assert.equal(after.facingLeft, false);
  });
});

describe('jumping and gravity', () => {
  test('pressing jump while grounded produces negative vy', () => {
    const p = mkPlayer();
    const after = step1p(p, { inputJump: true });
    assert.ok(after.vy < 0, `expected vy < 0, got ${after.vy}`);
  });

  test('airborne player gains positive vy each tick (gravity)', () => {
    const p = mkPlayer({ y: 400, vy: 0, stoodOn: null });
    const after1 = step1p(p, {});
    assert.ok(after1.vy > 0, `expected gravity applied, vy=${after1.vy}`);
  });

  test('player lands on ground and vy resets to 0', () => {
    // Start well above ground, fall for enough steps
    const p = mkPlayer({ y: 300, vy: 0, stoodOn: null, prevY: 300 });
    const landed = stepN(p, {}, 120);
    assert.equal(landed.stoodOn, 'ground');
    assert.equal(landed.vy, 0);
    assert.equal(landed.y, W.GROUND_Y - W.BLOB_H);
  });

  test('vertical velocity capped at MAX_FALL', () => {
    const p = mkPlayer({ y: 100, vy: W.MAX_FALL - 1, stoodOn: null, prevY: 100 });
    const after = step1p(p, {});
    assert.ok(after.vy <= W.MAX_FALL, `vy=${after.vy} exceeds MAX_FALL=${W.MAX_FALL}`);
  });

  test('cannot jump while airborne', () => {
    const p = mkPlayer({ y: 400, vy: -100, stoodOn: null, prevY: 390 });
    const after = step1p(p, { inputJump: true });
    // vy should only change due to gravity, not get another jump impulse
    assert.ok(after.vy > -100, `expected gravity, not second jump: vy=${after.vy}`);
  });
});

describe('platform collision', () => {
  const plat = W.PLATFORMS[0];  // { id:'p1', x:180, y:660, w:200 }

  test('player above platform falls and lands on it', () => {
    // Start just above the platform, moving down
    const p = mkPlayer({
      x:       plat.x + 10,
      y:       plat.y - W.BLOB_H - 40,
      vy:      300,
      stoodOn: null,
      prevY:   plat.y - W.BLOB_H - 80,
    });
    const after = stepN(p, {}, 30);
    assert.equal(after.stoodOn, plat.id);
    assert.ok(Math.abs(after.y - (plat.y - W.BLOB_H)) < 2,
      `expected y near ${plat.y - W.BLOB_H}, got ${after.y}`);
  });

  test('player jumping up through platform from below passes through (one-way)', () => {
    // Start just below the platform, moving upward
    const belowY = plat.y;  // player bottom is at platform top = below
    const p = mkPlayer({
      x:       plat.x + 10,
      y:       belowY,
      vy:      W.JUMP_VY,
      stoodOn: null,
      prevY:   belowY + 20,  // was lower = below platform = rising through
    });
    const after = step1p(p, {});
    // Should not land; vy still negative (still rising)
    assert.ok(after.vy < 0, `should pass through, vy=${after.vy}`);
    assert.notEqual(after.stoodOn, plat.id, 'should not have landed on platform');
  });

  test('player horizontally outside platform range does not land on it', () => {
    const p = mkPlayer({
      x:       plat.x + plat.w + 100,  // clearly to the right
      y:       plat.y - W.BLOB_H - 40,
      vy:      300,
      stoodOn: null,
      prevY:   plat.y - W.BLOB_H - 80,
    });
    const after = stepN(p, {}, 30);
    assert.notEqual(after.stoodOn, plat.id);
  });
});

describe('world bounds', () => {
  test('player cannot move past left world edge', () => {
    const p = mkPlayer({ x: 2 });
    const after = stepN(p, { inputLeft: true }, 20);
    assert.ok(after.x >= 0, `x=${after.x} went negative`);
  });

  test('player cannot move past right world edge', () => {
    const p = mkPlayer({ x: W.WORLD_W - W.BLOB_W - 2 });
    const after = stepN(p, { inputRight: true }, 20);
    assert.ok(after.x <= W.WORLD_W - W.BLOB_W, `x=${after.x} exceeded right bound`);
  });

  test('player exactly at world bottom is treated as grounded', () => {
    const p = mkPlayer({ y: W.GROUND_Y - W.BLOB_H, vy: 100 });
    const after = step1p(p, {});
    assert.equal(after.stoodOn, 'ground');
    assert.equal(after.vy, 0);
  });
});

// ── Player-on-player stacking ─────────────────────────────────────────────────

describe('player-on-player stacking', () => {
  test('player B landing on player A\'s head lands on it', () => {
    const pA = mkPlayer({ id: 'pA', x: 400, y: W.GROUND_Y - W.BLOB_H });
    const pB = mkPlayer({
      id:      'pB',
      x:       pA.x + 5,
      y:       pA.y - W.BLOB_H - 60,   // above A's head
      vy:      300,
      stoodOn: null,
      prevY:   pA.y - W.BLOB_H - 100,  // was higher
    });

    let players = { pA, pB };
    for (let i = 0; i < 30; i++) {
      players = Physics.step(mkWorld(), players, {}, 1/60);
    }

    assert.equal(players.pB.stoodOn, 'pA', `pB.stoodOn=${players.pB.stoodOn}`);
    assert.ok(Math.abs(players.pB.y - (players.pA.y - W.BLOB_H)) < 2,
      `pB y=${players.pB.y} not on pA head at ${players.pA.y - W.BLOB_H}`);
    assert.equal(players.pB.vy, 0, 'pB should have vy=0 when landed');
  });

  test('player B on A inherits A\'s horizontal velocity', () => {
    const pA = mkPlayer({ id: 'pA', x: 400 });
    const pB = mkPlayer({
      id:      'pB',
      x:       pA.x,
      y:       pA.y - W.BLOB_H,
      stoodOn: 'pA',
      vy:      0,
    });

    let players = { pA, pB };
    const inputs = {
      pA: { inputRight: true },
      pB: {},
    };
    players = Physics.step(mkWorld(), players, inputs, 1/60);

    assert.ok(players.pB.vx > 0,
      `pB should move right with pA, vx=${players.pB.vx}`);
    assert.ok(players.pB.x > pB.x,
      `pB should have moved right: x=${players.pB.x}`);
  });

  test('player B on A, B presses same direction as A: B moves faster relative', () => {
    const pA = mkPlayer({ id: 'pA', x: 400 });
    const pB = mkPlayer({
      id:      'pB',
      x:       pA.x,
      y:       pA.y - W.BLOB_H,
      stoodOn: 'pA',
      vy:      0,
    });

    let players = { pA, pB };
    const inputs = {
      pA: { inputRight: true },
      pB: { inputRight: true },
    };
    players = Physics.step(mkWorld(), players, inputs, 1/60);

    // pB should be further right than pA (extra own input)
    assert.ok(players.pB.x > players.pA.x,
      `pB should slide ahead of pA: pB.x=${players.pB.x}, pA.x=${players.pA.x}`);
  });

  test('player B on A, A jumps: B inherits jump impulse', () => {
    const pA = mkPlayer({ id: 'pA', x: 400 });
    const pB = mkPlayer({
      id:      'pB',
      x:       pA.x,
      y:       pA.y - W.BLOB_H,
      stoodOn: 'pA',
      vy:      0,
    });

    let players = { pA, pB };
    const inputs = {
      pA: { inputJump: true },
      pB: {},
    };
    players = Physics.step(mkWorld(), players, inputs, 1/60);

    assert.ok(players.pB.vy < 0,
      `pB should go up when pA jumps, vy=${players.pB.vy}`);
  });

  test('three-player tower: C on B on A all move when A walks', () => {
    const pA = mkPlayer({ id: 'pA', x: 400 });
    const pB = mkPlayer({
      id:      'pB',
      x:       pA.x,
      y:       pA.y - W.BLOB_H,
      stoodOn: 'pA',
      vy:      0,
    });
    const pC = mkPlayer({
      id:      'pC',
      x:       pA.x,
      y:       pA.y - W.BLOB_H * 2,
      stoodOn: 'pB',
      vy:      0,
    });

    let players = { pA, pB, pC };
    const inputs = { pA: { inputRight: true }, pB: {}, pC: {} };
    players = Physics.step(mkWorld(), players, inputs, 1/60);

    assert.ok(players.pC.vx > 0,
      `pC should inherit pA's velocity transitively, vx=${players.pC.vx}`);
  });

  test('players overlapping horizontally but not stacked pass through each other', () => {
    const pA = mkPlayer({ id: 'pA', x: 400, y: W.GROUND_Y - W.BLOB_H });
    const pB = mkPlayer({
      id:      'pB',
      x:       400,         // same x
      y:       W.GROUND_Y - W.BLOB_H,  // same y (side-by-side on ground)
      stoodOn: 'ground',
      vy:      0,
    });

    let players = { pA, pB };
    const inputs = {
      pA: { inputRight: true },
      pB: {},
    };
    players = Physics.step(mkWorld(), players, inputs, 1/60);

    // pA moves right, pB stays; no horizontal blocking
    assert.ok(players.pA.x > 400, `pA should move right: ${players.pA.x}`);
    assert.equal(players.pB.x, 400, `pB should not be pushed: ${players.pB.x}`);
  });

  test('if carrier disconnects, rider becomes airborne', () => {
    const pA = mkPlayer({ id: 'pA', x: 400 });
    const pB = mkPlayer({
      id:      'pB',
      x:       pA.x,
      y:       pA.y - W.BLOB_H,
      stoodOn: 'pA',
      vy:      0,
    });

    // Step with only pB (pA is gone)
    let players = { pB };
    players = Physics.step(mkWorld(), players, {}, 1/60);

    assert.equal(players.pB.stoodOn, null,
      'stoodOn should be null when carrier is gone');
    assert.ok(players.pB.vy > 0,
      `pB should start falling: vy=${players.pB.vy}`);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  test('empty players map returns empty map', () => {
    const result = Physics.step(mkWorld(), {}, {}, 1/60);
    assert.deepEqual(result, {});
  });

  test('empty inputs map: players fall under gravity', () => {
    const p = mkPlayer({ y: 200, vy: 0, stoodOn: null, prevY: 200 });
    const after = step1p(p, {});
    assert.ok(after.vy > 0, `gravity should apply: vy=${after.vy}`);
  });

  test('determinism: 50 steps produce identical results on identical input', () => {
    const p1 = mkPlayer({ x: 300 });
    const p2 = mkPlayer({ x: 300 });
    const input = { inputRight: true, inputJump: true };

    const r1 = stepN(p1, input, 50);
    const r2 = stepN(p2, input, 50);

    assert.equal(r1.x, r2.x);
    assert.equal(r1.y, r2.y);
    assert.equal(r1.vy, r2.vy);
  });
});
