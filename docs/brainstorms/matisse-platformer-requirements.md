# Matisse Platformer Vibe-Shift — Requirements

**Date:** 2026-05-24
**Status:** Brainstorm complete, ready for `/ce-plan`
**Owner:** @beezoo

---

## Summary

Reskin and re-mechanic `local-chat` from a top-down sprite-based hangout into a
side-view 2D platformer rendered in a Henri Matisse–inspired cutout style.
Same product (LAN-only, ~30 concurrent visitors at `http://chat.local`,
chat-centric), new look-and-feel and movement model. Players are organic blob
shapes in primary colors on an off-white painted world; they walk, jump, and
can stack on each other's heads.

## Goals

- A first-glance "whoa" — the space feels like a Matisse cutout you can walk
  around in, not a game.
- Playful social moments emerge from the physics (stacking towers, bouncing,
  blocking doorways with your blob).
- The chat hangout purpose is preserved: people still come to talk; movement
  is the ambient toy around the conversation.
- Ship-able as a coherent v1 vibe-shift, not a half-converted hybrid.

## Non-goals

- Not a game. No scores, win conditions, powerups, levels-to-clear, or
  progression.
- Not a Matisse-styled version of the existing top-down view — the camera
  rotates to side-view and gravity is real.
- No avatar customization UI, no DMs, no chat history persistence, no
  reactions. Visual + movement shift only.
- No mobile touch controls. Mobile users keep today's read-only-movement,
  chat-works behavior.
- No multi-room / level switching.

## Users

Same audience as today: visitors on a local event WiFi opening
`http://chat.local` on a laptop. They want to hang out, see who else is
around, type messages. The redesign should land within seconds of arrival —
no tutorial, no controls overlay.

## World shape

- **Single connected arena**, side-view, ~2× viewport wide, horizontal scroll
  only. No vertical scroll, no multiple rooms.
- **Full-screen viewport**, adapts to any window size. Today's fixed 800×600
  CSS-transform-scaled canvas is replaced with a canvas that resizes with the
  window. Logical world units decouple from pixel size; rendering scales to
  fit.
- **Camera follows the local player** horizontally, with the world edges
  clamping the camera so you don't see past the painting.
- **Composition** (per Matisse): off-white background, a ground line, a
  handful of floating organic platforms at varied heights, a few decorative
  cutout shapes (leaves, snail-like spirals, seaweed-y forms) that are purely
  visual — they don't collide.

## Visual style

- **Background:** off-white / cream (think aged paper).
- **Palette:** primary colors — red, yellow, blue — plus a green and a deep
  black/navy as accents, à la Matisse's late cutouts (*The Snail*, *Blue
  Nudes*).
- **Shapes:** organic, blob-y, hand-cut feeling. Drawn as canvas bezier paths,
  not sprites. Flat fills, no gradients, no shadows, no outlines (or one
  thick deliberate outline, design-time call).
- **Characters:** every blob has a head-blob and a body-blob (two stacked
  organic shapes). Simple dot eyes (or no eyes — design-time call).
- **No pixel art.** The Kenney sprite sheet (`public/assets/characters.png`)
  and `public/js/characters.js` are removed.

## Avatars — procedural blobs

- Each player's blob is **deterministically generated from their name** (the
  server hashes the name to a seed at join, broadcasts the seed; all clients
  render the same shape for the same name).
- Generator picks: a primary color from the palette, a head silhouette (set
  of bezier control points), a body silhouette, an eye treatment.
- No avatar picker screen. Entry flow becomes just: type name → Enter →
  spawn.
- Two visitors with the same name → server already rejects this today (keep
  that), so collision isn't a concern.

## Movement & physics

- **Side-view platformer controls:**
  - Left/Right (Arrow keys, A/D): walk
  - Up / W / Space: jump
  - No double jump, no run button, no crouch. Keep it readable.
- **Gravity, jump arc, terminal velocity** — tuned for floaty, playful,
  Matisse-cutout-falling-through-air vibes, not Mario precision.
- **Platforms** are solid from above only? Or solid all sides? — *design call
  during plan, default to solid-all-sides for simplicity.*
- **World bounds:** can't walk past the left/right edges of the painting.
- **Spawn:** server picks a free spot on the ground line at join.

## Player-on-player stacking (headline mechanic)

- **Heads are solid platforms.** You can land on another blob, stand on
  them, and they carry you as they walk. Three+ player towers are possible
  and encouraged.
- The carrier feels the rider's weight only visually (slight squish) — no
  speed penalty in v1; keep physics legible.
- If the carrier jumps, the rider goes with them.
- Players can pass through each other horizontally (no sideways pushing) so
  no one can grief by trapping someone in a corner. Only the *top* of a blob
  is solid.
- Speech bubbles continue to appear above the head even when someone is
  standing on you — bubble positioning has to account for the head being
  occupied.

## Chat

- **Sidebar chat panel kept**, restyled in the Matisse palette: off-white
  background, blob-shaped accents, hand-cut feeling dividers. Same width
  ballpark as today.
- **Speech bubbles** above each blob, ~4s lifetime — same behavior as today,
  restyled (blob-shaped bubble in primary color, dark text).
- No new chat features.

## Minimap

- **Kept and re-styled.** Now functionally meaningful because the world is
  ~2× viewport wide and people can be off-screen.
- Shows the full world width, blob positions as colored dots in their
  primary color, the camera's current view as a faint rectangle.
- Lives in a corner of the viewport, Matisse-styled (small off-white card
  with blob-y border).

## Mobile

- Unchanged from today: chat works, no movement controls, blob parks at
  spawn position. Camera doesn't follow (or follows but never moves, since
  the player doesn't move).
- We do *not* add touch buttons in v1.

## Real-time / networking

- Existing 20 Hz Socket.IO broadcast loop is the starting point but **the
  server becomes physics-authoritative.** Today the client computes its own
  movement and the server relays positions; that breaks down with
  player-on-player stacking, where two clients can disagree about who is
  standing on whom.
- Server-side simulation: gravity, jump impulses from client input, platform
  AABB collision, player-as-platform resolution, world bounds.
- Clients send input intents (left/right/jump pressed), not positions.
- Client lerp toward authoritative state continues, same spirit as today.
- This is the single biggest engineering swing in the project — bigger than
  the visual reskin.

## Capacity & performance

- Same target as today: up to ~30 concurrent visitors on LAN, Pi-hosted.
- 30 blobs × 20 Hz position broadcast is still trivial bandwidth on LAN.
- Watch: canvas bezier rendering cost at full-screen on weaker laptops.
  Mitigation if needed: pre-render each blob shape to an off-screen canvas
  once at join time, blit it each frame instead of re-tracing paths.

## Success criteria

- New visitor opens `http://chat.local`, picks no avatar, types name, and
  within ~5 seconds is jumping a blob around a Matisse painting.
- Two visitors can build a 2-blob tower without it visibly desyncing or
  jittering.
- The painting reads as "Matisse-inspired" to someone who knows Matisse —
  not as "platformer with pastel colors."
- Chat conversation density is the same or higher than today. (The platform
  toy shouldn't pull attention *away* from chatting.)

## Open questions for `/ce-plan`

- Server-authoritative physics architecture: same Node loop, or split
  physics into its own tick? Conflict resolution when client input lag
  causes the rider to fall off?
- Exact world dimensions (logical units) and number/layout of platforms.
- Platform solidity: top-only (drop-through) vs all-sides.
- Blob generator details — bezier control-point distributions, color
  weighting, eye-treatment options.
- Whether to pre-render blob shapes to off-screen canvases for perf.
- Speech-bubble positioning when a blob is being stood on.
- Minimap exact placement (corner choice) and styling specifics.

## Files this will touch

Approximately (final list during planning):

- `server.js` — physics simulation, input-intent handling, seed assignment
- `public/index.html` — viewport sizing, layout
- `public/css/style.css` — full restyle
- `public/js/game.js` — canvas resize, camera, input intents not positions
- `public/js/renderer.js` — replace sprite drawing with bezier blob painting
- `public/js/input.js` — jump, gravity-relative movement
- `public/js/chat.js` — restyled bubbles, sidebar restyle
- `public/js/minimap.js` — adapt to scrolling world
- `public/js/entry.js` — drop avatar picker, name-only entry
- **Removed:** `public/assets/characters.png`, `public/js/characters.js`
- **New:** a blob-generator module (e.g. `public/js/blob.js`)

## Out of scope (explicitly deferred)

- Multi-room worlds, doors, portals
- Avatar customization screen
- Mobile touch controls
- Persistent chat history
- DMs, reactions, mentions
- Powerups, scoring, any "game" layer
- Music / sound
- Sit-down zones, named landmarks, NPC objects you can interact with
