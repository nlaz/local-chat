---
date: 2026-05-24
topic: break-room-corporate-retheme
type: feat
status: active
origin: docs/brainstorms/break-room-theme-requirements.md
---

# feat: Corporate Office Visual Retheme ("Break Room")

## Summary

Full visual retheme of the Local Chat app from a dark OSRS/fantasy aesthetic to a sterile, light corporate office environment. Renames the app to "Break Room", replaces the CSS palette, redesigns the canvas room (grey carpet, white walls, fluorescent ceiling panels), adds decorative office furniture props, and replaces the Kenney roguelike sprite sheet with code-drawn office worker characters. Minimap dot colors are also updated to match the new palette. No server-side changes, no functional changes — purely visual.

---

## Problem Frame

The app renders as a dark dungeon-crawl: black backgrounds, brown stone walls, green checkerboard grass, gold UI text, and fantasy sprite art. The intended vibe is a sterile corporate break room — mundane, slightly unsettling in its normality. Every surface of the UI contradicts that. This plan replaces the entire visual layer. (see origin: `docs/brainstorms/break-room-theme-requirements.md`)

---

## Key Technical Decisions

- **Code-drawn characters, not a new sprite sheet.** Each `CHARACTERS[n]` entry gains a `draw(ctx, x, y, walkFrame, facingLeft)` method implemented in `characters.js`. `renderer.js` calls it directly instead of `ctx.drawImage`. This removes the `characters.png` asset dependency entirely. `SPRITE_W`, `SPRITE_H`, and `SCALE` remain at their current values (48px, 48px, 3×) because `chat.js` derives speech bubble centering from `SPRITE_W` — changing it would re-introduce the documented off-screen bubble regression (~1968px offset).

- **Avatar picker: per-card inline `<canvas>` elements.** The current `sheet.onload → offscreen → toDataURL() → <img>` pipeline is replaced with one small `<canvas>` per avatar card that calls the same `draw()` method directly. This removes the only non-renderer dependency on `characters.png`.

- **Furniture drawn in `drawBackground`, before characters.** All furniture props are drawn at the end of `drawBackground()` so characters appear on top. Positions are authored in the 800×600 logical coordinate space, snapped to the 32px tile grid where possible. Interior bounds: x=16..784, y=16..584 (WALL_WIDTH=16 each side).

- **`imageSmoothingEnabled = false` must not be overridden.** Set once on canvas init in `game.js`; all new drawing code must respect it.

- **Monospace font retained.** `'Courier New'` reads as corporate terminal output — consistent with the dry office atmosphere without adding humor copy. (see origin: `docs/brainstorms/break-room-theme-requirements.md` Key Decisions)

---

## System-Wide Impact

| Surface | Change |
|---|---|
| `public/index.html` | Title + heading rename only |
| `public/css/style.css` | Full palette swap; no layout changes |
| `public/js/characters.js` | Replace CHARACTERS entries; add `draw()` per character; keep `SPRITE_W`/`SPRITE_H`/`SCALE` |
| `public/js/renderer.js` | New room colors; furniture `drawFurniture()`; replace `loadSheet`/`drawSprite` with `draw()` calls |
| `public/js/entry.js` | Replace sprite-sheet-based picker preview with per-card canvas draw |
| `public/js/minimap.js` | Dot color update only |
| `server.js` | No changes |
| `public/assets/characters.png` | No longer referenced; safe to delete after U5 + U6 land |

---

## Implementation Units

### U1. HTML + CSS retheme

**Goal:** Rename the app to "Break Room" and replace the entire dark OSRS/fantasy palette with a light corporate palette across the UI layer.

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11

**Dependencies:** None.

**Files:**
- `public/index.html`
- `public/css/style.css`

**Approach:**

*`index.html`:*
- Update `<title>` from "Local Chat" to "Break Room"
- Update `<h1 class="entry-title">` from "Local Chat" to "Break Room"
- No other structural changes

*`public/css/style.css` — full palette replacement:*

| Selector / property | Current | Replace with |
|---|---|---|
| `html, body` background | `#000` | `#f0f0eb` |
| `html, body` color | `#e0e0e0` | `#2a2a2a` |
| `#entry-screen` background | `#0d0704` | `#f0f0eb` |
| `.entry-card` background | `#1a0d07` | `#ffffff` |
| `.entry-card` border | `2px solid #8b4513` | `2px solid #d0d0cc` |
| `.entry-card` | — | add `box-shadow: 0 2px 12px rgba(0,0,0,0.08)` |
| `.entry-title` color | `#ffd700` | `#2a2a2a` |
| `.entry-sub` color | `#f0e6c8` | `#5a5a5a` |
| `.avatar-card` background | `rgba(20,10,5,0.7)` | `rgba(245,245,242,0.9)` |
| `.avatar-card` border | `2px solid #5c3310` | `2px solid #d0d0cc` |
| `.avatar-card:hover` border | `#ffd700` | `#4a7c8e` (corporate teal) |
| `.avatar-card.selected` border | `#ffd700` | `#4a7c8e` |
| `.avatar-card.selected` bg | `rgba(139,69,19,0.3)` | `rgba(74,124,142,0.12)` |
| `.avatar-label` color | `#f0e6c8` | `#5a5a5a` |
| `#name-input` background | `rgba(20,10,5,0.7)` | `#ffffff` |
| `#name-input` border | `2px solid #8b4513` | `2px solid #c0c0bc` |
| `#name-input` color | `#f0e6c8` | `#2a2a2a` |
| `#name-input:focus` border | `#ffd700` | `#4a7c8e` |
| `#enter-btn` background | `#8b4513` | `#5a7a85` (muted blue-grey) |
| `#enter-btn` color | `#f0e6c8` | `#ffffff` |
| `#game-screen` background | `#000` | `#e8e8e4` |
| `.canvas-wrapper` background | `#000` | `#e8e8e4` |
| `.chat-overlay` background | `rgba(20,10,5,0.88)` | `rgba(255,255,255,0.95)` |
| `.chat-overlay` border | `2px solid #8b4513` | `2px solid #d0d0cc` |
| `.chat-log` color | `#f0e6c8` | `#2a2a2a` |
| `.msg-name` color | `#ffd700` | `#4a7c8e` |
| `#chat-input` background | `rgba(0,0,0,0.5)` | `#f5f5f2` |
| `#chat-input` border | `1px solid #8b4513` | `1px solid #c0c0bc` |
| `#chat-input` color | `#f0e6c8` | `#2a2a2a` |
| `#chat-input:focus` border | `#ffd700` | `#4a7c8e` |
| `#send-btn` background | `#8b4513` | `#5a7a85` |
| `#send-btn` color | `#f0e6c8` | `#ffffff` |
| `#minimap-canvas` border | `2px solid #8b4513` | `2px solid #c0c0bc` |
| `#minimap-canvas` background | `rgba(20,10,5,0.88)` | `rgba(248,248,246,0.95)` |
| `.chat-log::-webkit-scrollbar-thumb` | `#8b4513` | `#b0b0ac` |
| `.chat-log::-webkit-scrollbar-track` | `rgba(20,10,5,0.5)` | `rgba(240,240,235,0.8)` |
| `.entry-error` color | `#e8a87c` | `#c0392b` |

Font family is unchanged: `'Courier New', Courier, monospace` throughout.

**Patterns to follow:** All changes are direct property value replacements — no structural changes to selectors or layout. Match the existing indentation and comment style in `style.css`.

**Test scenarios:**
- Entry screen renders with off-white background and white card with light grey border (no dark browns visible)
- "Break Room" heading is dark charcoal, not gold
- Avatar card hover and selected state shows teal border, not gold
- Name input is white with light grey border; focused state shows teal border
- Enter button is muted blue-grey
- Chat overlay is white/near-white with dark text
- Chat name labels are corporate teal, not gold
- Minimap has light grey border and off-white background
- Game screen letterbox background is light grey, not black

**Verification:** Load the app in a browser. The entry screen should look like a clean corporate login form. The game screen background outside the canvas should be light grey.

---

### U2. Canvas room background retheme

**Goal:** Replace the grass/stone canvas room with grey carpet tiles, white walls with a baseboard accent, and fluorescent ceiling panel decorations.

**Requirements:** R12, R13, R14, R15

**Dependencies:** None.

**Files:**
- `public/js/renderer.js`

**Approach:**

Update all color constants at the top of the `Renderer` IIFE:

| Constant | Current | Replace with |
|---|---|---|
| `FLOOR_LIGHT` | `'#3a5c2a'` | `'#d4d4ce'` (lighter grey carpet) |
| `FLOOR_DARK` | `'#2d4a22'` | `'#c8c8c2'` (darker grey carpet) |
| `WALL_COLOR` | `'#5c3310'` | `'#f8f8f8'` (near-white wall) |
| `LABEL_COLOR` | `'#ffd700'` | `'#3a6a78'` (corporate teal) |
| `LABEL_SHADOW` | `'rgba(0,0,0,0.8)'` | `'rgba(0,0,0,0.25)'` (lighter shadow on light bg) |

Add two new constants:
- `BASEBOARD_COLOR = '#dcdcd6'` — thin inner accent line drawn just inside the wall border
- `CEILING_PANEL_COLOR = '#eaeae6'` — slightly brighter than carpet, suggesting overhead fluorescent light

Add a `drawCeilingPanels(ctx)` helper (called from `drawBackground` after floor tiles, before wall border):

Three horizontal panel strips drawn with `fillRect` near the top interior of the room. Positions authored in 800×600 logical space:
- Panel 1: x=80, y=26, w=160, h=10
- Panel 2: x=300, y=26, w=160, h=10
- Panel 3: x=520, y=26, w=160, h=10

Draw order within `drawBackground` (after this unit, before U3):
1. Carpet checkerboard (existing loop, recolored)
2. `drawCeilingPanels(ctx)` — drawn on carpet, before characters
3. Wall border (existing `fillRect` calls, recolored)
4. Baseboard: four inner `fillRect` calls, 2px thick, drawn just inside the wall at `WALL_WIDTH` boundary using `BASEBOARD_COLOR`

**Patterns to follow:** Existing `ctx.save()`/`ctx.restore()` clipping pattern in `drawBackground`. New helpers follow the same private function style as `drawBackground` and `drawLabel`.

**Test scenarios:**
- Canvas floor shows two close grey tones in a checkerboard pattern (no green visible)
- Wall borders are near-white (`#f8f8f8`), not brown
- A thin grey baseboard line is visible just inside each wall edge
- Three pale horizontal panel strips are visible near the top of the room interior
- Character name labels above sprites are teal, not gold
- Ceiling panels appear behind characters (players walk over them)

**Verification:** Run the app, join as a player. The room should read immediately as office carpet with white walls. Name labels above other players should be teal.

---

### U3. Canvas furniture props

**Goal:** Draw decorative desk cluster, watercooler, and potted plant on the canvas as static background elements.

**Requirements:** R16, R17, R18

**Dependencies:** U2 (room colors and interior bounds confirmed)

**Files:**
- `public/js/renderer.js`

**Approach:**

Add a `drawFurniture(ctx)` function called from `drawBackground` after ceiling panels and before the wall border. All coordinates are in 800×600 logical space. Furniture is clipped to the interior region (same `ctx.save()`/clip pattern as the floor tile loop).

**Desk cluster** (center-right, 5 desks):

Each desk: white/light grey top (`#f0f0ec`) with a slightly darker edge (`#d8d8d4`), and a small dark monitor rectangle (`#3a3a3a`, ~10×8px) on the back edge center.

Desk positions (x, y, w=64, h=40):
- Desk A: x=448, y=80
- Desk B: x=528, y=80
- Desk C: x=608, y=80
- Desk D: x=480, y=176
- Desk E: x=560, y=176

Per desk draw: fill top color → fill darker 2px bottom/right edge → fill monitor rect at `(x + w/2 - 5, y + 4)`.

**Watercooler** (lower-left):

Position: x=48, y=384
- Body: pale blue rectangle (`#b8d4e0`), w=24, h=48
- Water tank (upper portion): slightly lighter blue (`#cce4ef`), w=18, h=22, centered x+3, y
- White label strip: `#f8f8f8`, w=24, h=8 at y+26
- Base: dark grey (`#888`), w=24, h=6 at bottom

**Potted plant** (upper-left):

Position: x=48, y=112
- Pot: terracotta (`#c1634a`) fillRect w=28, h=20 at (x, y+20)
- Soil line: darker `#8a3e28`, 2px at pot top
- Leaves: three overlapping dark green circles (`#3a6b3a`), r≈14 at (x+14, y+14), r≈10 at (x+4, y+20), r≈10 at (x+24, y+20) — `ctx.arc` + `ctx.fill`

**Draw order within `drawBackground`:**
1. Carpet checkerboard
2. `drawCeilingPanels(ctx)`
3. `drawFurniture(ctx)` ← this unit
4. Wall border
5. Baseboard

**Patterns to follow:** Use `ctx.save()`/`ctx.restore()` around furniture drawing. Follow existing `fillRect` pattern for rectangular shapes; `ctx.beginPath()` + `ctx.arc()` + `ctx.fill()` for circles (same as `minimap.js` dot drawing).

**Test scenarios:**
- Three desks are visible in the upper-center-right area with a second row of two below them
- Each desk has a visible small dark monitor rectangle on its back edge
- Watercooler appears in the lower-left with its distinctive blue colour and white label band
- Potted plant appears upper-left with a terracotta pot and dark green leaf cluster
- All furniture is drawn under characters (players walk in front of props)
- Players can walk through furniture without any collision or movement interruption

**Verification:** Join the game. Walk a character over a desk — the player sprite should render on top. All three prop zones should be visible without overlapping the wall borders.

---

### U4. Character definitions — office workers

**Goal:** Replace the six roguelike character entries in `CHARACTERS` with office worker definitions and add a shared code-draw function. Preserve all global constants consumed by other modules.

**Requirements:** R19, R20, R21, R22, R23, R24

**Dependencies:** None.

**Files:**
- `public/js/characters.js`

**Approach:**

Remove: `TILE`, `STRIDE`, `sx()` helper, all `sheetX`/`sheetY`/`walkY`/`frameW`/`frameH` fields from each character entry.

Keep unchanged: `SCALE = 3`, `SPRITE_W = 48`, `SPRITE_H = 48` (global constants — downstream consumers must not be broken).

New `CHARACTERS` array shape:

```
// Directional guidance — not implementation specification
CHARACTERS[n] = {
  id:          Number,   // 0–5
  label:       String,   // office title
  blazerColor: String,   // hex color
}
```

Character roster (order must match existing 0–5 index — server validates 0 ≤ avatar ≤ 5):

| id | label | blazerColor |
|---|---|---|
| 0 | Intern | `#2a3f6f` (navy) |
| 1 | Analyst | `#6a6a72` (slate grey) |
| 2 | Manager | `#b5a882` (beige/khaki) |
| 3 | Contractor | `#8b4a3c` (rust) |
| 4 | Director | `#3a7a7a` (teal) |
| 5 | Consultant | `#6a3a5a` (burgundy) |

Add a shared `drawOfficeWorker(ctx, x, y, blazerColor, walkFrame, facingLeft)` function in `characters.js`. All drawing is done in the 48×48 logical bounding box. The function uses `ctx.save()`/`ctx.restore()` and handles the horizontal flip for `facingLeft` using the same `ctx.translate(x+48, y); ctx.scale(-1,1)` pattern as the current renderer.

Character anatomy (all coordinates relative to the 48×48 box, pixel art at 3× scale — each "pixel" is 3px):

```
// Directional guidance — not implementation specification

// Head: skin-tone circle, center (24, 14), radius 9
// Hair: 2px dark strip at top of head (y=5..8)
// Collar: white rectangle, (18,24)–(30,30) — shirt showing above blazer
// Tie: 1 dark-color strip, (22,26)–(26,40) — 4px wide
// Blazer body: blazerColor rectangle, (12,26)–(36,48) — main suit body
// Blazer lapels: two small white triangles cut into the blazer at (18,26) and (28,26)
// Legs: dark grey rectangle, (15,42)–(33,48)
// Shoes: near-black, (13,45)–(21,48) and (27,45)–(35,48)

// Walk frame: shift blazer + legs + shoes down by 2px (y += 2 for those elements)
// to give a subtle bounce; head stays fixed
```

Implementation note: "lapels" can be approximated as two small `fillRect` calls in a lighter blazer shade or white — exact rendering is open to the implementer as long as the character reads as a suited office worker at a glance.

`drawOfficeWorker` is added as a named function (not a method on each entry) and also stored as a reference per entry for use by `entry.js` and `renderer.js`:

```
// Directional guidance — not specification
CHARACTERS[n].draw = function(ctx, x, y, walkFrame, facingLeft) {
  drawOfficeWorker(ctx, x, y, this.blazerColor, walkFrame, facingLeft);
};
```

**Patterns to follow:** No IIFE wrapper — `characters.js` is intentionally a globals file. Follows existing `UPPER_SNAKE` naming for constants, camelCase for functions.

**Test scenarios:**
- All 6 `CHARACTERS` entries exist with `id`, `label`, `blazerColor`, and `draw` function
- `SPRITE_W`, `SPRITE_H`, `SCALE` values are still 48, 48, 3
- `TILE` and `STRIDE` globals are removed (no `undefined` references — verify nothing else imports them)
- `CHARACTERS[0].label` equals `"Intern"`, `CHARACTERS[5].label` equals `"Consultant"`
- Each character's `blazerColor` matches the roster above
- `CHARACTERS[n].draw(ctx, 0, 0, false, false)` executes without error on a test canvas context
- Walk frame (`walkFrame = true`) produces a visibly different Y position for the body compared to idle
- Left-facing draw (`facingLeft = true`) mirrors the character horizontally

**Verification:** Open browser console, create a test canvas, call `CHARACTERS[0].draw(ctx, 0, 0, false, false)`. A suited figure should appear. Repeat with `walkFrame=true` and confirm slight body shift.

---

### U5. Renderer character drawing update

**Goal:** Replace `loadSheet`/`_sheet`/`drawSprite` with calls to `CHARACTERS[n].draw()`. Remove all sprite sheet machinery from the renderer.

**Requirements:** R19, R22, R24

**Dependencies:** U4 (character `draw()` methods must exist first)

**Files:**
- `public/js/renderer.js`

**Approach:**

Remove from `renderer.js`:
- `let _sheet = null`
- `loadSheet(onLoad)` function and its `Image()` load machinery
- `drawSprite(ctx, char, x, y, frameY, facingLeft)` function

Update `drawFrame`:
- Remove the `if (!_sheet) return` guard (no longer needed)
- Replace the `drawSprite` call with `char.draw(ctx, p.x, p.y, p.walkFrame, p.facingLeft)` where `char = CHARACTERS[p.avatar] || CHARACTERS[0]`
- `drawLabel` call is unchanged

Update the public API — `return { loadSheet, drawFrame }` becomes `return { drawFrame }`.

Update callers of `loadSheet`:
- `game.js` currently calls `Renderer.loadSheet(onLoad)` as a step before starting the rAF loop. This gate no longer exists — `drawFrame` can be called immediately. In `game.js`, replace the `Renderer.loadSheet(cb)` call with a direct call to the callback (or inline the callback body).

**Patterns to follow:** Existing `Renderer` IIFE module structure. `return { drawFrame }` is a minimal public API.

**Test scenarios:**
- All 6 character types render as suited office workers in the game canvas
- Characters face left correctly when moving leftward (horizontal mirror)
- Walk animation cycles between idle and walk states during movement
- No "broken image" or blank sprite appears for any character type
- `Renderer.loadSheet` is not called anywhere after this change (grep check)
- Two players using different avatar indices render with different blazer colors

**Verification:** Join the game with two browser tabs using different avatars. Both render as office workers with distinct blazer colors. Move left — character flips. Move diagonally — walk frame animates.

---

### U6. Entry screen avatar picker update

**Goal:** Replace the sprite-sheet-based avatar picker preview with per-card canvas drawing using the new `CHARACTERS[n].draw()` method.

**Requirements:** R19, R23 (characters appear as office workers on the picker), R24 (CHARACTERS interface preserved)

**Dependencies:** U4

**Files:**
- `public/js/entry.js`

**Approach:**

Remove:
- `const sheet = new Image()` and its `addEventListener('load', ...)` block
- The `offscreen.toDataURL()` → `img.src` pipeline

In the avatar card builder, for each character, replace the `<img class="avatar-preview">` with a `<canvas class="avatar-preview" width="48" height="48">`. After appending the canvas to the DOM (or before), get its 2D context, set `imageSmoothingEnabled = false`, and call `char.draw(ctx, 0, 0, false, false)` to render the idle frame.

The card structure becomes:
```
div.avatar-card
  canvas.avatar-preview  (48×48, code-drawn character)
  span.avatar-label      (office title text)
```

The `.avatar-preview` CSS rule already sets `width: 48px; height: 48px; image-rendering: pixelated` — this is fully compatible with a `<canvas>` element.

The selection, highlight, and name-input-enable logic in `entry.js` is unchanged — it operates on `.avatar-card` click events, not on the preview element type.

`window._localAvatar` is set to the character index on join — unchanged.

**Patterns to follow:** Existing card builder loop in `entry.js`. Keep `document.createElement` pattern for card elements.

**Test scenarios:**
- Entry screen shows 6 avatar cards, each with a code-drawn office worker (no broken `<img>` elements)
- Each card shows a different blazer color matching the `CHARACTERS` roster
- Clicking a card selects it (teal border) and enables the Enter button — unchanged behavior
- Character label text matches the office titles (Intern, Analyst, Manager, Contractor, Director, Consultant)
- No reference to `characters.png` or the `Image()` load in the updated code

**Verification:** Open the entry screen. All 6 cards show office worker previews. Select one, enter a name, click Enter — join succeeds with the chosen avatar rendering correctly in the game canvas.

---

### U7. Minimap palette update

**Goal:** Update minimap dot colors from the gold/cream fantasy palette to a corporate teal/grey scheme.

**Requirements:** Corporate palette consistency (see origin: `docs/brainstorms/break-room-theme-requirements.md` Success Criteria — "sterile corporate office" impression)

**Dependencies:** None.

**Files:**
- `public/js/minimap.js`

**Approach:**

Two color changes:
- Local player dot: `'#ffd700'` (gold) → `'#4a7c8e'` (corporate teal, matching `.msg-name` and label colors)
- Other players' dots: `'rgba(240,230,200,0.85)'` (cream) → `'rgba(140,160,165,0.85)'` (corporate grey-blue)

Minimap background: the minimap canvas background is set via CSS (updated in U1 to off-white). If `minimap.js` clears with a fill color, update it to `'#f5f5f2'` or `ctx.clearRect`.

No structural changes — dot drawing logic (arc + fill) is unchanged.

**Patterns to follow:** Existing dot draw pattern in `minimap.js`.

**Test scenarios:**
- Local player dot on minimap is teal, not gold
- Other players' dots are muted grey-blue, not cream
- Minimap background is off-white/light grey, not dark

**Verification:** Open two browser tabs. Both players appear on the minimap — local player in teal, remote player in grey-blue.

---

## Scope Boundaries

- No interactive or collidable furniture — props are decorative canvas elements drawn in `drawBackground`
- No narrative text, narrator voice, or humor copy
- No isometric or perspective projection — flat top-down view unchanged
- No sound effects or ambient audio
- No changes to `server.js` or the Socket.IO event protocol
- `characters.png` is not explicitly deleted by this plan — it becomes unreferenced after U5 and U6 land and can be removed in a follow-up cleanup commit

### Deferred to Follow-Up Work

- Delete `public/assets/characters.png` once confirmed unreferenced (trivial cleanup after all units land)
- Create `docs/solutions/` with institutional learnings entries for: (a) the CHARACTERS-array-as-contract pattern, (b) the bubble scale regression pattern — valuable for future contributors
- Playwright tests: the `test-results/` directory contains captured failures but no spec files exist. If end-to-end tests are added later, bubble positioning should be covered given the prior regression history

---

## Dependencies / Assumptions

- `SPRITE_W` and `SPRITE_H` remain at 48px in `characters.js` — `chat.js` derives speech bubble horizontal centering from `SPRITE_W / 2`. Any change to character bounding box size requires a corresponding update to `positionBubble()` in `chat.js` (not in scope here).
- Server validates avatar index as `0 ≤ avatar ≤ 5` — character count stays at 6, so `server.js` needs no changes.
- Canvas dimensions remain 800×600 — all furniture coordinates are authored against this fixed logical size.
- `ctx.imageSmoothingEnabled = false` is set once in `game.js` init. New drawing code must not override this setting.
- No build step: edited files are served directly; a systemd service restart (`sudo systemctl restart local-chat`) is needed to pick up `server.js` changes, but since `server.js` is unchanged, a simple browser refresh is sufficient for client-side-only changes.

---

## Outstanding Questions

### Deferred to Implementation

- [Affects U3] Exact visual rendering of desk edges and monitors — use `fillRect` layering (darker bg rect then lighter top rect) or stroke outlines. Either approach works; implementer chooses what reads best at 3× scale.
- [Affects U4] Blazer lapel rendering detail — small white triangles or a lighter shade V-notch. The requirement is that the character reads as a suited worker; exact pixel art choices are left to the implementer.
- [Affects U4, U5] Whether `drawOfficeWorker` should live as a standalone named function in `characters.js` (exported via global scope) or be fully inlined in each `CHARACTERS[n].draw` closure. Either works; standalone is more maintainable.
