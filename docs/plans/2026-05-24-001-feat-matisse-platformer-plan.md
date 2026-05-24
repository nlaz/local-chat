---
title: "feat: Matisse-style 2D platformer vibe-shift for local-chat"
date: 2026-05-24
type: feat
status: completed
depth: deep
origin: docs/brainstorms/matisse-platformer-requirements.md
---

# feat: Matisse-style 2D platformer vibe-shift for local-chat

## Summary

Replace the current top-down sprite-based hangout with a side-view 2D
platformer rendered in a Henri Matisse cutout style. The product (LAN-only
visitor hangout at `http://chat.local`, chat-centric, ~30 concurrent) is
unchanged. Everything visual and kinematic changes: blob avatars in primary
colors on an off-white painted world, gravity + jumping, real player-on-player
stacking, a ~2× viewport scrolling arena with camera follow, and a
restyled chat panel and minimap. The server becomes physics-authoritative.

(see origin: `docs/brainstorms/matisse-platformer-requirements.md`)

---

## Problem Frame

Today's `local-chat` is a working but visually generic top-down Kenney-sprite
space. The owner wants a distinctive aesthetic and a more playful social
toy. The same audience (event visitors on LAN) still comes to chat; the
movement layer should become a delight rather than a checkbox.

Two shifts drive everything else in this plan:

1. **Aesthetic shift** — Matisse cutout style. Off-white background,
   primary-color organic blobs, flat fills, no pixel art, no sprite sheet.
2. **Mechanical shift** — side-view platformer with gravity, jumping, and
   solid-headed player-on-player stacking. The carrier physics ("ride a
   blob as they walk") forces the server to become physics-authoritative;
   today's position-relay model can't keep clients in agreement about who
   is standing on whom.

---

## Goals

- The space reads as Matisse-inspired at first glance, not as "platformer
  with pastel colors."
- Two strangers can build a 2-blob tower within their first minute and the
  tower doesn't visibly desync or jitter on LAN.
- Visitors arrive, type their name, and are jumping their procedurally-
  generated blob within ~5 seconds — no avatar picker.
- Chat conversation density stays at least as high as today; the toy
  doesn't pull attention away from talking.

---

## Non-Goals

- Not a game (no scores, win conditions, powerups, levels).
- No multi-room / portals / level switching.
- No avatar customization UI.
- No mobile touch controls (mobile keeps today's chat-only, no-movement
  behavior).
- No new chat features (no DMs, history persistence, reactions, mentions).
- No audio.

---

## Requirements Trace

Carried forward from origin. Active U-IDs that advance each item are in
brackets.

- **World shape** — single connected arena, ~2× viewport wide, horizontal
  scroll, camera follow, no vertical scroll. [U3, U5]
- **Full-screen viewport adapts to any window size** — replaces today's
  fixed 800×600 CSS-scale. [U5]
- **Matisse visual style** — off-white background, primary palette, organic
  blob shapes, flat fills, no shadows, no pixel art. [U4, U5, U7]
- **Procedural blob avatars from name hash, deterministic across clients**
  — server assigns seed at join; clients render identical shape. [U3, U4]
- **No avatar picker** — name-only entry. [U7]
- **Platformer controls + physics** — left/right walk, jump (Arrow/WASD/Space),
  gravity, world-bounds clamp. [U2, U6]
- **Solid-headed player-on-player stacking** with carry-along — top-only
  solid, pass-through horizontally, rider inherits carrier velocity and
  jump impulse. [U2, U3]
- **Sidebar chat retained, restyled** — keep the existing bottom-left
  overlay panel layout; restyle in Matisse palette. [U7]
- **Speech bubbles restyled** — same ~4s lifetime; bubble positioning
  accounts for blob being stood on. [U7]
- **Minimap retained, restyled, scrolling-world aware** — shows full world
  width, dots in each blob's primary color, camera viewport rect overlay.
  [U8]
- **Mobile constraint unchanged** — chat works, no movement. [U6]
- **Capacity unchanged** — ~30 concurrent on LAN. [U3 verification]

---

## Scope Boundaries

### In scope

Everything in Requirements Trace above.

### Deferred to Follow-Up Work

Plan-local items the agent noticed while planning but that aren't required
for v1:
- Decomposing `server.js` further (route handler module, config module,
  etc.) beyond what the physics extraction requires. The file gets bigger
  in this plan; full cleanup is its own PR.
- A test runner for client-side modules (only the server physics core gets
  tests in this plan).
- A `.eslintrc` / formatter setup. None today, none added here.

### Outside this product's identity (from origin)

- Multi-room / portals / level switching.
- Avatar customization screen.
- Mobile touch controls.
- Persistent chat history, DMs, reactions, mentions.
- Powerups, scoring, any "game" layer.
- Music / sound.

---

## Key Technical Decisions

### KTD1. Server becomes physics-authoritative, clean break from position-relay

Today the client computes its own position and emits `player:move {x,y,dx,dy}`;
the server clamps and relays. With solid-head stacking and carrier physics,
two clients can disagree about who is standing on whom, and that disagreement
will visibly desync the tower.

**Decision:** Server simulates physics. Clients emit input intents
(`player:input { left: bool, right: bool, jump: bool }`) on change. Server
runs an internal physics step at 60 Hz, broadcasts authoritative state at
20 Hz (unchanged broadcast rate). Clients lerp toward state for remote
players; for the local player, run client-side prediction with snap-correct
on state arrival so input feels responsive.

**Why clean break, not transitional:** The new protocol replaces the old
event entirely. The old `player:move` handler is removed. Deploy window is
brief on LAN; the systemd restart in the README covers it. No backward
compatibility shims.

### KTD2. Pure-function physics core, dispatched by server tick

Extract physics into `server/physics.js` as pure functions taking
`(world, players, inputs, dt) → nextPlayers`. The server's tick loop calls
into it. Pure functions are unit-testable without a server harness; the
stacking interaction is the riskiest piece in the project and benefits from
isolated tests.

### KTD3. Logical world dimensions decoupled from viewport pixels

Define a logical world: **1600 wide × 900 tall** (16:9), with the camera
viewport showing a 800×450 logical slice by default (~2× world in width).
Canvas DOM size = current window inner size. Render transform =
`scale(window.innerWidth / VIEWPORT_W)` applied to context before drawing
world. Camera centers on local player's X, clamped to `[0, WORLD_W -
VIEWPORT_W]`. Y is not scrolled in v1 (world height = viewport height).

These numbers are starting points; tunable during implementation if the
arena feels cramped or sparse.

### KTD4. Procedural blob = name-seeded LCG → bezier paths → off-screen pre-render

- Server hashes player's trimmed name → 32-bit seed at join; broadcasts
  seed alongside player record. (Stable for a session; same name reused on
  a future visit gets the same blob.)
- Client uses a small seeded PRNG (LCG, hand-written, no dep) to drive a
  generator that produces: primary color choice from the Matisse palette,
  head silhouette (closed bezier path from N perturbed radial points),
  body silhouette (same generator with different params), eye treatment.
- Each blob is rendered ONCE to an off-screen canvas at known dimensions
  (e.g., 80×100 px logical) at join time. Each frame the renderer blits
  the off-screen canvas — no per-frame bezier tracing. Mirrors for
  facing-left are a pre-rendered second canvas.
- The generator is deterministic on `(seed, version)` — clients running
  the same code see identical blobs. Generator version is hardcoded in
  `blob.js`; bumping it is a one-line opt-in.

### KTD5. Platforms are top-only solid (one-way / drop-through)

Standard platformer convention: you can jump up through a platform from
below, and you land on it falling down. The ground is fully solid.
Player-on-player heads are top-only solid too (you pass through
horizontally and from below; you stand on the head from above).

### KTD6. Test scope is server physics only, via `node --test`

Add a `test/` directory and a `npm test` script using Node 20's built-in
`node --test` runner — no new dependencies. Tests cover the pure physics
module: gravity, jump impulse, ground collision, platform collision,
player-on-player landing, carry velocity inheritance, world bounds.

UI rendering, blob generator visuals, camera, and end-to-end behavior are
verified manually in browser. Documented in README under a new
"Development" subsection.

### KTD7. Carried-rider velocity model

When player B is standing on player A:
- B inherits A's horizontal velocity each tick (so B moves with A as A
  walks).
- B retains its own left/right input — if B presses right while A walks
  right, B can slide off the front of A's head.
- If A jumps, B inherits A's jump impulse exactly once at the moment of
  liftoff (B "comes along" by virtue of staying in contact for that tick;
  if B is mid-air relative to A on the next tick, B is no longer carried).
- Stacks chain: C on B on A inherits transitively because each rider's
  carrier reference is re-evaluated each tick.

---

## High-Level Technical Design

### Server tick architecture

```
┌─────────────────────────────────────────────────────────────┐
│  server.js — game loop                                      │
│                                                              │
│  Every 1/60s:                                                │
│    physics.step(world, players, inputs, dt)                  │
│      → updates players in place (server-authoritative)       │
│                                                              │
│  Every 1/20s (every 3rd physics step):                       │
│    io.volatile.emit('game:state', { players: { … } })        │
│      → includes id, name, seed, x, y, vx, vy, facingLeft,    │
│        carrying (id or null), stoodOn (id or null)           │
└─────────────────────────────────────────────────────────────┘
                       ▲
                       │ player:input { left, right, jump }
                       │ (volatile, on change, ~30 Hz max)
                       │
┌─────────────────────────────────────────────────────────────┐
│  Client — game.js                                            │
│    rAF loop:                                                 │
│      - Local player: run physics.stepOne() with own input    │
│        for prediction; snap-correct on server state arrival  │
│      - Remote players: lerp toward server x/y                │
│      - Camera follows local player x, clamped to world       │
│      - Renderer blits each player's pre-rendered blob canvas │
└─────────────────────────────────────────────────────────────┘
```

*Directional guidance — the implementer should treat shapes and names as
sketches, not as fixed identifiers.*

### Physics collision resolution order (per substep)

1. Apply input → desired horizontal velocity, jump impulse if grounded and
   jump pressed.
2. Apply gravity → vertical velocity.
3. Move X, resolve world-bounds clamp.
4. Move Y, resolve collisions in this order:
   - Ground line (solid).
   - Platforms (top-only, only when falling AND previous-Y was above
     platform top).
   - Player heads (top-only, same rule, but skip pairs that are mid-
     intentional pass-through e.g. carrier already established).
5. Recompute `stoodOn` reference for each player based on current contact.
6. Inherit carrier vx for any player whose `stoodOn` is non-null.

### World composition (initial layout, tunable)

```
WORLD: 1600 × 900 logical
Ground line: y = 800 (solid line from x=0 to x=1600)
Platforms (top-only):
  - (200, 650)  width 200   — low left
  - (550, 520)  width 240   — mid left
  - (900, 600)  width 180   — mid right
  - (1180, 460) width 220   — high right
  - (760, 360)  width 160   — apex
Decorative cutouts (non-colliding): scattered leaves, a snail-spiral,
  a few "blue nude" silhouettes anchored to back layer.
```

---

## Output Structure

New files added by this plan and their parents:

```
local-chat/
├── server.js                    (modified)
├── server/
│   └── physics.js               (NEW)
├── test/
│   └── physics.test.js          (NEW)
├── public/
│   ├── index.html               (modified)
│   ├── css/style.css            (modified, heavy)
│   ├── assets/                  (characters.png REMOVED)
│   └── js/
│       ├── blob.js              (NEW — seeded procedural blob generator)
│       ├── world.js             (NEW — shared world config: platforms, dims)
│       ├── prng.js              (NEW — small seeded LCG)
│       ├── characters.js        (REMOVED)
│       ├── entry.js             (modified — name-only entry)
│       ├── input.js             (modified — emits intents, not positions)
│       ├── game.js              (modified — prediction + camera)
│       ├── renderer.js          (modified, heavy — bezier blob renderer)
│       ├── chat.js              (modified — bubble positioning w/ camera)
│       └── minimap.js           (modified — scrolling world + Matisse style)
└── package.json                 (modified — npm test script)
```

The implementer may adjust file boundaries if a cleaner split emerges
during implementation. Per-unit Files lists below are authoritative.

---

## Implementation Units

### U1. Add `node --test` scaffolding and `npm test` script

**Goal:** Establish a server-side test runner so U2 can be written with
tests from the start.

**Requirements:** Supports KTD6.

**Dependencies:** none.

**Files:**
- `package.json` (modified — add `"test": "node --test test/"` script)
- `test/.gitkeep` or `test/smoke.test.js` (NEW — verifies the runner works)

**Approach:**
- Node 20 has `node --test` built in. No new dependencies.
- Add `"test": "node --test test/"` to `package.json` scripts.
- Land a single placeholder test that asserts `true === true` so CI/manual
  invocation has something to run before U2 fills it in.

**Execution note:** First commit of test infra; subsequent units land tests
with their feature code.

**Patterns to follow:** None in-repo (no prior tests). Use Node's built-in
`node:test` and `node:assert/strict` modules; documented examples in Node
docs.

**Test scenarios:** Placeholder only — one trivial assertion verifying the
runner is wired up.

**Verification:**
- `npm test` exits 0.
- README "Development" subsection added with one line: `npm test` runs
  server-side tests.

---

### U2. Pure-function physics core in `server/physics.js`

**Goal:** Implement the deterministic side-view platformer physics
(gravity, jump, world bounds, platforms, player-on-player stacking, carry
velocity) as pure functions, fully unit-tested.

**Requirements:** Supports KTD2, KTD5, KTD7.

**Dependencies:** U1.

**Files:**
- `server/physics.js` (NEW — pure functions, no Socket.IO or Express
  imports)
- `test/physics.test.js` (NEW — extensive coverage)
- `public/js/world.js` (NEW — shared world config: dimensions, ground Y,
  platforms array, physics constants). Server requires it via `require`
  if exposed via a small Node-compatible export pattern; otherwise duplicate
  the constants in `server/world.js` and keep the client copy in sync. (See
  open question OQ2 below.)

**Approach:**
- Export pure functions:
  - `step(world, players, inputsById, dt) → players` — runs one substep.
  - Internally: `applyInput`, `applyGravity`, `moveAndCollideX`,
    `moveAndCollideY`, `resolvePlayerStacks`, `inheritCarrierVelocity`.
- Player shape: `{ id, name, seed, x, y, vx, vy, facingLeft, stoodOn,
  inputLeft, inputRight, inputJump, jumpHeld }`.
- Carrier rules per KTD7.
- One-way collision rule: platform / head is solid only when player's
  previous Y bottom was above the platform top AND current vy ≥ 0.
- No randomness, no time-of-day, no globals — deterministic.

**Execution note:** Test-first. Write the failing scenario for each
collision interaction before the implementation. The stacking carrier
mechanic is the project's highest-risk piece; tests are the safety net.

**Technical design:** See "Physics collision resolution order" sketch in
High-Level Technical Design. The substep order is normative; the function
breakdown is directional.

**Patterns to follow:** None in-repo. Standard platformer physics
references (AABB swept collision, separate-axis resolution) are well
documented in 2D game programming literature.

**Test scenarios:**

*Happy path*
- A grounded player who presses right moves right by `vx * dt` per step.
- A grounded player who presses jump becomes airborne with negative vy.
- An airborne player falls (vy increases) due to gravity until they hit
  the ground.
- A player landing on a platform from above stops at the platform's top Y
  and `stoodOn === platform.id`.

*Edge cases*
- A player whose previous-Y bottom is BELOW a platform top passes through
  the platform when moving up (one-way platform).
- A player at the world's left edge (x = 0) pressing left has vx clamped
  to 0; same on right edge.
- A player exactly at the world bottom is treated as grounded.
- Two simultaneous platforms at the same Y: the lower one is preferred
  when falling.

*Error/failure paths*
- An empty `inputsById` map produces a step where all players fall under
  gravity and lose horizontal velocity to friction (or zero — design call
  during impl; either way deterministic).
- A `players` map with no entries returns an empty map without throwing.

*Player-on-player stacking (integration within physics module)*
- Player B falling onto player A's head (B's previous bottom above A's
  head top, B's vy ≥ 0): B's Y snaps to A's head top, B's vy = 0,
  `B.stoodOn === A.id`.
- Player B on player A, A presses right: B's vx for this tick inherits
  A's vx (B follows A horizontally).
- Player B on A, B presses right while A presses right: B moves at A.vx +
  own walk speed (slides forward off A).
- Player B on A, A jumps: B inherits A's negative vy for the tick of
  liftoff; on the next tick B is no longer in contact with A and becomes
  free-falling unless B also pressed jump.
- Three-player tower (C on B on A): C inherits B inherits A's velocity;
  if A jumps, C and B come along.
- Player B with no inputs standing on A: B does not fall off when A walks
  (carry persistent across ticks while contact is maintained).
- Players overlapping horizontally without one being above the other pass
  through each other (no horizontal collision).
- A player whose `stoodOn` target no longer exists (target disconnected)
  becomes airborne the next tick.

*Integration scenarios*
- 50 ticks of mixed inputs produce identical final state given identical
  initial state (determinism check).

**Verification:**
- `npm test` runs the new test file and all scenarios pass.
- No imports of Socket.IO or Express in `server/physics.js` — verifies
  the module is genuinely pure.

---

### U3. Wire physics into the server tick + protocol change + seed assignment

**Goal:** Replace `player:move` with `player:input`; run `physics.step` at
60 Hz; broadcast at 20 Hz; assign blob seed at join; remove sprite-era
fields.

**Requirements:** Supports KTD1, KTD3, KTD4. Advances world-shape,
stacking, and procedural-blob requirements.

**Dependencies:** U2.

**Files:**
- `server.js` (modified, heavy)
- `server/world.js` (NEW or shared with client — see U2 OQ2)

**Approach:**
- Remove `player:move` handler entirely. Remove sprite/avatar-index
  validation (avatar param dropped). Add `player:input { left, right,
  jump }` handler that mutates the player's input booleans.
- On `player:join`: hash name to 32-bit seed (simple fnv1a or
  djb2 — pure, no deps). Player record now:
  `{ id, name, seed, x, y, vx, vy, facingLeft, stoodOn, inputLeft,
    inputRight, inputJump }`. Spawn at a ground-line X within world
  bounds.
- Replace the 20 Hz broadcast loop with a 60 Hz physics tick that calls
  `physics.step(world, players, inputs, dt)` and a 20 Hz broadcast that
  emits `game:state { players }` (every 3rd tick).
- `game:init` payload includes `world` (dimensions, ground Y, platforms)
  so clients render the same arena without duplication.
- Validate that name re-use still rejects duplicates (today's behavior).
- Remove obsolete config constants (CANVAS_W/H, SPRITE_W/H, WALL_INSET,
  SPAWN_PAD) — replaced by world dims from `world.js`.

**Patterns to follow:**
- Today's 20 Hz timer hybrid setTimeout/setImmediate in `server.js` —
  keep that pattern for the 60 Hz tick.
- Today's `socket.emit('game:init', …)` → `socket.broadcast.emit(
  'player:joined', …)` join sequence.

**Test scenarios:**
- `physics.step` unit tests already cover the core logic. For this unit,
  add **one** light integration test in `test/server.test.js` that boots
  the express+socket.io app on an ephemeral port using `socket.io-client`
  (already in devDependencies), connects two clients, has each emit
  `player:join` then `player:input { right: true }`, waits for two
  `game:state` broadcasts, and asserts both players have non-zero `vx`
  and increased `x`.
- Name validation tests: empty name rejected; >20 chars rejected; duplicate
  active name rejected.
- Seed determinism: same name → same seed across two join cycles in the
  same process.

**Verification:**
- All U2 tests still pass.
- New server integration test passes.
- Manual: start the server, open two browser tabs, both blobs visible,
  walk + jump work, server logs show `[join]` with the seed value.

---

### U4. Procedural blob generator (`public/js/blob.js`) + seeded PRNG

**Goal:** Given `(seed, name)`, produce a pre-rendered off-screen canvas
of the blob (head + body + eyes) in a Matisse palette. Deterministic
across clients.

**Requirements:** Supports KTD4. Advances procedural-blob and visual
requirements.

**Dependencies:** none (parallel to U2/U3, depends on world.js if shared).

**Files:**
- `public/js/prng.js` (NEW — small seeded LCG, `Prng(seed) → { next(),
  range(min, max), pick(arr) }`)
- `public/js/blob.js` (NEW — `Blob.create(seed, name) → { canvas,
  canvasFlipped, color, headHeight }`)

**Approach:**
- LCG: standard 32-bit constants (e.g., `s = (s * 1664525 + 1013904223) >>>
  0`). Single file, ~10 lines.
- Palette: red `#e63946`, yellow `#f4d35e`, blue `#1d4e89`, green
  `#2a9d3f`, deep `#0d1b2a` accents. Pick primary by `prng.pick(palette)`.
- Head: closed bezier path drawn from 6–10 radial points each perturbed
  by `prng.range(-0.2, 0.2)` from a circle baseline. Rendered as a flat
  fill with a thick deliberate dark outline (1–2px equivalent at logical
  scale).
- Body: same generator with taller aspect, slightly different palette
  (head and body can share or differ — generator choice).
- Eyes: two options — two dots OR a single Matisse-style curved line.
  Picked by prng.
- Render once to a `document.createElement('canvas')` of fixed logical
  size (e.g., 80×120). Also render a horizontally-mirrored copy for
  facing-left. Return both.
- No dependence on the live game canvas size — the blob is logical-size;
  the renderer scales it via the camera transform.

**Patterns to follow:**
- Today's `entry.js` already uses an off-screen canvas pattern (lines
  29–40) — same idea applied here.

**Test scenarios:**
- *Manual (visual)* — open a browser, type three different names, screenshot
  each; reload, retype, confirm blobs render identically.
- *Manual* — load with the same name in two different browsers/devices,
  confirm both render the same blob.

**Test expectation: none in `test/` directory** — blob rendering is visual
and depends on the browser canvas API; not in scope for `node --test`. The
PRNG itself COULD be unit-tested but its determinism is self-evident from
the LCG formula and the visual test is the real signal.

**Verification:**
- Manual visual smoke per Test scenarios.
- `prng.js` and `blob.js` have zero `Math.random()` calls (grep clean) —
  proves determinism.

---

### U5. Matisse renderer rewrite + full-screen camera + window resize

**Goal:** Replace `renderer.js` to draw the off-white Matisse painting
with platforms, decorative cutouts, and players (via their pre-rendered
blob canvases). Implement the camera and the full-window canvas sizing.

**Requirements:** Supports KTD3, KTD5. Advances visual style, scrolling
world, and full-screen viewport requirements.

**Dependencies:** U3 (needs `world` from `game:init`), U4 (needs blob
canvases).

**Files:**
- `public/js/renderer.js` (rewritten, heavy)
- `public/js/game.js` (modified — canvas-resizes-with-window, camera
  state, transform setup, lerp logic still applies)
- `public/index.html` (modified — canvas no longer has fixed
  `width`/`height` attributes set to 800/600; sized at runtime)

**Approach:**
- On window resize (and on init): set canvas DOM `width` and `height` to
  `window.innerWidth` and `window.innerHeight` (device pixel ratio
  applied for crispness on HiDPI). Debounce to ~16ms.
- Each frame:
  - Compute camera X: `clamp(localPlayer.x - VIEWPORT_W/2, 0, WORLD_W -
    VIEWPORT_W)`. Smooth with low lerp factor for less jitter.
  - Compute screen-pixels-per-world-unit scale: `canvas.width /
    VIEWPORT_W`.
  - `ctx.setTransform(scale, 0, 0, scale, -cameraX * scale, 0)`.
  - Draw off-white background (whole world rect — clipped naturally by
    transform).
  - Draw decorative cutouts (back layer).
  - Draw platforms as organic blob shapes (flat fills, thick outlines).
  - Draw players: for each, `ctx.drawImage(blob.canvas, p.x, p.y, w, h)`
    using the facing-aware variant.
  - Reset transform; draw the name label above each player in screen
    coords (account for camera).
- Speech bubbles continue to be DOM elements; `chat.js` will be updated
  in U7 to account for camera.
- Remove all references to the sprite sheet, `_sheet`, `CHARACTERS`,
  `loadSheet`, walk-frame logic, sprite frame Y, etc.
- Walking animation: small Y-bob on the body (sin wave on time) when
  `|vx| > 0.5`. No frame swap.
- Jumping animation: optional slight squash on takeoff / stretch on
  apex. Deferrable to implementation polish.

**Patterns to follow:**
- Today's `renderer.js` `drawFrame(ctx, cw, ch, renderState, _localId)`
  signature — keep similar shape, just expanded args (e.g., add
  `cameraX`).
- Today's `game.js` rAF loop + lerp — preserved structure.

**Test scenarios:**
- *Manual* — single user, ground line visible, platforms visible, blob
  spawns and walks, camera follows past the half-world line.
- *Manual* — resize window from narrow to wide; world re-fits; no
  letterbox stretching the blob aspect.
- *Manual* — at the world's left edge, camera does not scroll past 0
  (blob walks into the corner naturally).
- *Manual* — at the world's right edge, camera clamps at `WORLD_W -
  VIEWPORT_W`.

**Test expectation: none in `test/` directory** — rendering is visual.

**Verification:**
- Manual visual smoke per scenarios.
- No imports of the deleted `characters.js`.
- Window resize during a session does not crash or freeze.

---

### U6. Client input → intents + local prediction + reconnect

**Goal:** Replace today's position-emit client with one that sends input
intents and runs local-player prediction. Preserve mobile non-movement
behavior.

**Requirements:** Supports KTD1. Advances platformer-controls and mobile
requirements.

**Dependencies:** U2 (the same physics module is `require`-able or
duplicate-able for client-side prediction), U3 (server expects
`player:input`).

**Files:**
- `public/js/input.js` (rewritten)
- `public/js/game.js` (modified — local prediction step, snap-correct on
  state arrival)

**Approach:**
- Track `keysHeld` set for `left`, `right`, `jump`. When the boolean
  state for any of these changes, emit `player:input { left, right, jump
  }` via `socket.volatile.emit`. Cap emit rate at ~30 Hz with a debounce
  (Cancel emits where state hasn't changed; emit immediately on change).
- Local prediction: each rAF tick, call the same `physics.stepOne` for
  the local player using the local input booleans, applied against the
  last-known authoritative state. On `game:state` arrival, if the
  predicted position differs from server by > tolerance (e.g., 20
  logical units), snap; otherwise lerp toward correction.
- Mobile path unchanged — the mobile notice still shows, no key
  listeners registered.
- Remove the `setInterval(() => emit player:move, 50)` block entirely.
- Make `physics.js` consumable in the browser: simplest is a small
  Node/browser dual-export pattern (an IIFE that hangs `window.Physics`
  in browsers and `module.exports` in Node), or duplicate the file with
  a build step. **Default: dual-export IIFE in a single file under
  `public/js/physics.js`, with `server.js` requiring it via `require(
  './public/js/physics.js')`.** This keeps the physics code single-source.

**Patterns to follow:**
- Today's mobile detection block (`input.js` lines 32–58).
- Today's blur listener that clears stuck keys.
- Today's `_socket.volatile.emit` pattern.

**Test scenarios:**
- *Already in U2* — physics determinism gives us confidence prediction
  matches server simulation.
- *Manual* — pressing right immediately moves the local blob (no
  ~50ms perceived input lag from waiting for server roundtrip).
- *Manual* — open two browser tabs; in tab A press right; tab B sees
  smooth blob motion (lerp).
- *Manual* — kill server, restart; client reconnects (existing
  reconnect path) and re-emits `player:join` then immediate
  `player:input` snapshot.
- *Manual* — focus chat input; arrow keys type-navigate inside chat
  input instead of moving (existing focus-guard preserved).
- *Manual on a phone* — chat works, no movement controls, mobile notice
  shows.

**Test expectation: none in `test/` directory** — client behavior is
manual/visual.

**Verification:**
- Manual smoke per scenarios.
- `grep player:move` in `public/js/` returns no hits.

---

### U7. Restyle chat panel, speech bubbles, entry screen + remove avatar picker

**Goal:** All persistent UI in Matisse palette. Entry screen becomes
name-only. Speech bubbles reposition with camera.

**Requirements:** Advances visual style, chat panel restyle, speech
bubble, no-avatar-picker requirements.

**Dependencies:** U3 (no avatar field in `player:join`), U5 (camera
exists).

**Files:**
- `public/css/style.css` (rewritten, heavy)
- `public/js/entry.js` (modified — remove avatar grid, name-only)
- `public/js/chat.js` (modified — bubble position math accounts for
  camera X and uses blob dimensions instead of `SPRITE_W`)
- `public/index.html` (modified — drop `#avatar-grid`, drop
  `characters.js` script tag, drop sprite-related markup)

**Approach:**
- Palette in CSS variables at the top of `style.css`:
  `--paper: #f5efe0; --red: #e63946; --yellow: #f4d35e; --blue:
  #1d4e89; --green: #2a9d3f; --ink: #0d1b2a;`. Reuse everywhere.
- Entry card: off-white with a single blob-shape SVG accent. Name input,
  Enter button. Remove avatar grid and selectedAvatar logic in
  `entry.js`. Send `player:join { name }` (no avatar).
- Chat panel: keep bottom-left fixed overlay layout (per call-out
  confirmed during synthesis). Restyle: off-white background, deep-ink
  text, blob-curved border-radius corners, primary-color sender names.
- Send button restyled as a primary-color blob shape.
- Speech bubble: redraw the CSS with an organic shape — `border-radius`
  on each corner set to varied percentages for a hand-cut feel; tail
  triangle replaced by an offset circle. Bubble background = paper;
  text = ink.
- Bubble positioning math in `chat.js` `positionBubble()`: change from
  `offsetX + x * S + (SPRITE_W / 2) * S` to use the camera transform.
  Formula: `bubbleScreenX = ((p.x + headHalfWidth) - cameraX) * scale +
  canvasOffsetX`. When player is being carried, bubble offset still
  references the player's own head Y, not the carrier — accept
  occlusion if rider's bubble overlaps carrier head per origin doc.
- Remove the avatar preview offscreen-canvas logic in `entry.js`.

**Patterns to follow:**
- Today's `chat.js` bubble-position scaling logic — same structure,
  updated math.
- Today's CSS overlay positioning (fixed + `inset`).

**Test scenarios:**
- *Manual* — entry screen shows only name + Enter; no avatar grid.
- *Manual* — type name → press Enter → land in game with auto-generated
  blob.
- *Manual* — chat panel readable; sender names colored; messages wrap.
- *Manual* — type a chat message; speech bubble appears above own blob;
  fades after ~4s.
- *Manual* — walk past camera midpoint; remote player's bubble follows
  their blob correctly (no offset drift).
- *Manual* — two players in different camera regions: both bubbles
  position correctly relative to each blob.

**Test expectation: none in `test/` directory** — purely visual/DOM.

**Verification:**
- Manual smoke per scenarios.
- `grep avatar` in `public/` returns no hits beyond comments in
  removed-file references (which themselves should be gone).
- `grep characters.png` in `public/` returns no hits.

---

### U8. Minimap rework for scrolling world + Matisse styling

**Goal:** Minimap shows the full world horizontally, dots in each blob's
primary color, camera viewport rect overlay, Matisse-styled container.

**Requirements:** Advances minimap-retained requirement.

**Dependencies:** U3 (`world` known), U4 (each player has a `color` from
the blob generator), U5 (camera state exposed).

**Files:**
- `public/js/minimap.js` (rewritten)
- `public/css/style.css` (modified — minimap container restyle)
- `public/index.html` (modified — minimap canvas size attributes
  adjusted to a wider aspect)

**Approach:**
- Resize minimap canvas to fit world's wide aspect: e.g., 240×135 logical.
- `SCALE = MAP_W / WORLD_W`.
- For each player: query their `color` from the blob generator output
  (cached at join via U4) and draw a dot at `(p.x * SCALE, p.y * SCALE)`.
- Draw a faint rectangle at `(cameraX * SCALE, 0, VIEWPORT_W * SCALE,
  MAP_H)` showing what the local player currently sees.
- Container: small off-white card with rounded organic corners and a
  thin ink border. Replace dark parchment palette.

**Patterns to follow:**
- Today's `minimap.js` structure (`init`, `draw`) and `drawFrame` call
  pattern from `game.js`.

**Test scenarios:**
- *Manual* — minimap shows all players as colored dots.
- *Manual* — walking moves the local blob's dot and the camera rect on
  the minimap.
- *Manual* — at world edges, camera rect clamps at the minimap edges.
- *Manual* — disconnected players' dots disappear within one tick.

**Test expectation: none in `test/` directory** — visual.

**Verification:**
- Manual smoke.
- Minimap visible at top-right at all window sizes ≥ 1024px wide.

---

## System-Wide Impact

- **Protocol break.** Old clients (cached browsers from before the
  deploy) will be unable to interact: they emit `player:move` which the
  server no longer handles. They will appear stationary to others. After
  `sudo systemctl restart local-chat`, visitors must reload their browser
  tab. The README's "After Code Changes" subsection should be updated to
  call this out for the deploy of this change specifically. Mitigation:
  add a `protocol` version number to `game:init` and have clients reload
  on mismatch — defer to follow-up (overkill for a LAN-only tool).
- **No persistent data, no migration.** Player state is in-memory; the
  schema change is immediate on restart.
- **Asset deletion.** `public/assets/characters.png` and
  `public/js/characters.js` are removed. Any stale browser cache will
  404 on `characters.png` but the new client doesn't load it.
- **README updates needed.** Visitor Guide step 3 changes ("Pick a
  character and type your name" → "Type your name"). Controls line
  should mention jump. Add a `npm test` line under a new Development
  section. Note the protocol break for the upgrade deploy.

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Stacking physics has unhandled edge cases (e.g., simultaneous landings) | Medium | High — desync is the headline failure | U2 test scenarios cover the known edges; manual two-player smoke before declaring done; physics is pure so adding tests post-bug is cheap |
| Client-side prediction visibly diverges from server | Medium | Medium | Same physics code on both sides via dual-export reduces this; snap-correct on state arrival absorbs residual drift |
| Bezier blob rendering is too expensive on the Pi-served laptops | Low | Medium | Pre-render at join (KTD4) reduces to drawImage; can profile and add reduced-detail mode if needed |
| 60 Hz server tick is more CPU than the Pi can spare | Low | Medium | Pi 4/5 is comfortable with this for ~30 players doing simple AABB math; if measured high, drop to 30 Hz server tick (4 sub-steps per 30 Hz tick is still stable) |
| Window resize during play breaks bubble positioning | Medium | Low | Recompute scale on resize; existing debounce pattern in `game.js` extended |
| Procedural blob occasionally generates a visually unpleasant shape | Medium | Low | Generator parameters tuned during U4 visual review; can re-roll if any specific name produces a bad blob by salting the hash function (a one-line code change is the "fix") |
| Mobile users can't see anything meaningful in a scrolling world (their blob never moves) | Medium | Low — same as today's behavior class | Spawn camera centered on the mobile user's static blob; honest about the limit per non-goal |

---

## Open Questions for Implementation

These are knowable at implementation time; do not block planning.

- **OQ1.** Friction model when no input held — full instant stop, or
  exponential decay? Affects feel.
- **OQ2.** Single physics file dual-export (Node `module.exports` + browser
  IIFE) vs duplicate files. Plan default is dual-export; if it's awkward
  in practice, switch to a small build copy step or a tiny shim.
- **OQ3.** Exact platform geometry: the HLD lists a starting layout;
  expect to tune during U5 by walking the level.
- **OQ4.** Blob generator visual parameters (radial point count,
  perturbation magnitude, body vs head aspect ratios) — tune during U4
  with a debug page that renders 20 blobs side-by-side.
- **OQ5.** Whether to add a one-line `protocol: 1` to `game:init` for
  future-proofing the next breaking change. Defer unless trivial.
- **OQ6.** Speech bubble offset when standing on someone — accept
  occlusion per origin, OR auto-nudge upward by stack height. The
  origin doc accepted occlusion; revisit if it actually looks bad in
  manual smoke.

---

## Verification Strategy

- `npm test` passes (U1 + U2 + U3 integration test).
- Two-browser manual smoke at minimum after each unit that ships a
  user-visible change:
  - Both blobs visible, named correctly.
  - Both walk + jump.
  - One blob can stand on the other; ride along; jump together.
  - Both can chat; bubbles appear; chat log accumulates.
  - Minimap shows both dots in correct colors.
  - Camera follows local player and clamps at edges.
  - Window resize keeps everything visible.
- One full-restart-of-service test simulating LAN deploy.

---

## Deferred Implementation Notes

Items that are real but better resolved during implementation than
pre-decided here:
- Exact method names within `physics.js`.
- Exact bezier control-point counts and perturbation magnitudes for
  blob shapes.
- Final platform layout (positions, widths).
- Whether to keep or drop the walk-bob animation depending on how it
  looks alongside the gravity + jump motion.
- Whether to render decorative cutouts as bezier paths in JS or as a
  static SVG/PNG painted to an off-screen canvas once. The latter is
  cheaper per frame and may be the right call once asset volume is known.
