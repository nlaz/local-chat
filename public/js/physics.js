// physics.js — pure-function server-side physics (and client prediction)
// Dual export: Node require() and browser window.Physics.
//
// All units are logical world pixels. dt is in seconds.
// Players are mutated in a fresh copy each step — input map is read-only.
//
// Player record shape:
//   { id, x, y, vx, vy, prevY, stoodOn, facingLeft,
//     inputLeft, inputRight, inputJump, jumpConsumed }
//
// stoodOn: null | 'ground' | platform.id | other player.id

(function (exports) {
  // ── Helpers ─────────────────────────────────────────────────────────────────

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function copyPlayer(p) {
    return Object.assign({}, p);
  }

  function copyPlayers(players) {
    const out = {};
    for (const id in players) out[id] = copyPlayer(players[id]);
    return out;
  }

  // Is this stoodOn value a valid contact given the current player set?
  // Returns the resolved stoodOn string, or null if invalid.
  function resolveStoodOn(stoodOn, players, world) {
    if (stoodOn === null) return null;
    if (stoodOn === 'ground') return 'ground';
    if (world.PLATFORMS.find(pl => pl.id === stoodOn)) return stoodOn;
    if (players[stoodOn]) return stoodOn;
    return null;  // carrier gone
  }

  // ── step(world, players, inputsById, dt) ────────────────────────────────────
  function step(world, players, inputsById, dt) {
    const ps = copyPlayers(players);

    // ── Pre-pass: validate stoodOn references ────────────────────────────────
    // If a player's carrier has left the game, treat them as airborne now
    // so gravity is correctly applied this step.
    for (const id in ps) {
      ps[id].stoodOn = resolveStoodOn(ps[id].stoodOn, ps, world);
    }

    // Save prevY before moving (needed for one-way platform logic)
    for (const id in ps) {
      ps[id].prevY = ps[id].y;
    }

    // ── Jump inheritance pre-pass ─────────────────────────────────────────────
    // If a rider's carrier jumps this tick, the rider inherits the impulse
    // BEFORE the main physics loop so the impulse is applied alongside gravity.
    for (const id in ps) {
      const p = ps[id];
      if (!p.stoodOn || p.stoodOn === 'ground') continue;
      if (world.PLATFORMS.find(pl => pl.id === p.stoodOn)) continue;

      const carrier = ps[p.stoodOn];
      if (!carrier) continue;

      // Check if carrier will jump this tick
      const carrierInput = (inputsById && inputsById[p.stoodOn]) || {};
      const carrierGrounded = carrier.stoodOn !== null;
      if (carrierInput.inputJump && carrierGrounded && !carrier.jumpConsumed) {
        // Carrier is about to jump; give rider the same impulse
        p.vy = world.JUMP_VY;
        p.stoodOn = null;  // rider is now airborne
      }
    }

    // ── 1 + 2: Apply input and gravity ──────────────────────────────────────
    for (const id in ps) {
      const p  = ps[id];
      const ip = (inputsById && inputsById[id]) || {};

      const grounded = p.stoodOn !== null;

      // Horizontal
      let vx = 0;
      if (ip.inputLeft)  { vx -= world.WALK_SPEED; p.facingLeft = true; }
      if (ip.inputRight) { vx += world.WALK_SPEED; if (!ip.inputLeft) p.facingLeft = false; }
      p.vx = vx;

      // Jump — only if grounded (stoodOn != null) and jump not held from last frame
      if (ip.inputJump && grounded && !p.jumpConsumed) {
        p.vy = world.JUMP_VY;
        p.stoodOn = null;
        p.jumpConsumed = true;
      } else {
        if (!ip.inputJump) p.jumpConsumed = false;
      }

      // Gravity — apply when airborne (stoodOn null) or already moving upward
      if (p.stoodOn === null) {
        p.vy = clamp(p.vy + world.GRAVITY * dt, -Infinity, world.MAX_FALL);
      }
    }

    // ── 3: Move X ────────────────────────────────────────────────────────────
    for (const id in ps) {
      const p = ps[id];
      p.x = clamp(p.x + p.vx * dt, 0, world.WORLD_W - world.BLOB_W);
    }

    // ── 4: Move Y + collision resolution ─────────────────────────────────────
    for (const id in ps) {
      const p = ps[id];
      // Clear stoodOn before resolving — will be re-established by collision
      p.stoodOn = null;

      p.y += p.vy * dt;

      // Ground
      const groundTop = world.GROUND_Y - world.BLOB_H;
      if (p.y >= groundTop) {
        p.y       = groundTop;
        p.vy      = 0;
        p.stoodOn = 'ground';
      }
    }

    // Platform collision (top-only, one-way, only when falling from above)
    for (const id in ps) {
      const p = ps[id];
      if (p.stoodOn !== null) continue;

      for (const plat of world.PLATFORMS) {
        const footY     = p.y + world.BLOB_H;
        const prevFootY = p.prevY + world.BLOB_H;
        const platTop   = plat.y;

        const crossingFromAbove = prevFootY <= platTop && footY >= platTop;
        const overlapX = p.x + world.BLOB_W > plat.x && p.x < plat.x + plat.w;

        if (crossingFromAbove && overlapX && p.vy >= 0) {
          p.y       = platTop - world.BLOB_H;
          p.vy      = 0;
          p.stoodOn = plat.id;
          break;
        }
      }
    }

    // Player-on-player head collision (top-only, one-way)
    // Sort: higher-y (closer to ground) resolved first = carriers before riders
    const sortedIds = Object.keys(ps).sort((a, b) => ps[b].y - ps[a].y);
    for (const id of sortedIds) {
      const p = ps[id];
      if (p.stoodOn !== null) continue;

      for (const otherId of sortedIds) {
        if (otherId === id) continue;
        const carrier = ps[otherId];

        const carrierHeadY  = carrier.y;
        const footY         = p.y + world.BLOB_H;
        const prevFootY     = p.prevY + world.BLOB_H;

        const crossingFromAbove = prevFootY <= carrierHeadY && footY >= carrierHeadY;
        const riderCX  = p.x + world.BLOB_W / 2;
        const overlapX = riderCX > carrier.x && riderCX < carrier.x + world.BLOB_W;

        if (crossingFromAbove && overlapX && p.vy >= 0) {
          p.y       = carrier.y - world.BLOB_H;
          p.vy      = 0;
          p.stoodOn = otherId;
          break;
        }
      }
    }

    // ── 5: Maintain stacking contact + inherit carrier vx ────────────────────
    // For riders still on a player carrier after move-Y, re-snap y and add carrier vx
    for (const id in ps) {
      const p = ps[id];
      if (!p.stoodOn || p.stoodOn === 'ground') continue;
      if (world.PLATFORMS.find(pl => pl.id === p.stoodOn)) continue;

      const carrier = ps[p.stoodOn];
      if (!carrier) {
        p.stoodOn = null;
        continue;
      }

      // Re-snap to carrier head (carrier may have moved this tick)
      p.y = carrier.y - world.BLOB_H;

      // Inherit carrier vx (additive on top of own input already set in step 1)
      // Update both vx (so downstream callers and transitive riders see it) and x.
      p.vx += carrier.vx;
      p.x = clamp(p.x + carrier.vx * dt, 0, world.WORLD_W - world.BLOB_W);
    }

    return ps;
  }

  // ── Exports ──────────────────────────────────────────────────────────────────
  const Physics = { step };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Physics;
  } else {
    exports.Physics = Physics;
  }
}(typeof window !== 'undefined' ? window : {}));
