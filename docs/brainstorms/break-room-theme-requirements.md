---
date: 2026-05-24
topic: break-room-theme
---

# Break Room — Corporate Office Visual Retheme

## Summary

Retheme the Local Chat app ("Break Room") from its current dark OSRS/fantasy aesthetic to a sterile, light corporate office environment. Inspired by Club Penguin's chunky pixel proportions and The Stanley Parable's fluorescent-white office setting — purely visual, no narrative elements. Includes a full CSS retheme, canvas room redesign, new code-drawn office worker characters, canvas furniture props, and an app rename.

---

## Problem Frame

The app currently renders as a dark, dungeon-crawl aesthetic: black backgrounds, brown stone walls, green checkerboard grass, gold UI text, and fantasy roguelike character sprites. This visual language is coherent internally but mismatched with the intended vibe — a virtual hangout that feels like a mundane corporate office, with the slightly unsettling sterility of a break room that exists only to be a break room.

---

## Requirements

**App rename**

- R1. The HTML `<title>` tag is updated to "Break Room".
- R2. The entry screen heading is updated to "Break Room".

**Entry screen & UI retheme**

- R3. Entry screen background: off-white (`#f0f0eb` or equivalent), replacing the current near-black.
- R4. Entry card: white background, light grey border (`#d0d0cc`), soft shadow — replacing the dark brown card.
- R5. Entry screen typography: charcoal (`#2a2a2a`) body text and dark grey headings, replacing gold/cream.
- R6. Name input and Enter button: white/light-grey field with dark border; button is muted corporate blue-grey, not brown.
- R7. Chat panel: white background, light grey border, dark text replacing the dark parchment panel.
- R8. Chat name labels in the log: corporate teal or muted blue, replacing gold.
- R9. Minimap canvas border: light grey, replacing the brown border; minimap background is off-white.
- R10. Game screen background (the letterbox area outside the canvas): light grey (`#e8e8e4`), replacing black.
- R11. Font remains monospace throughout — `'Courier New'` or a clean monospace — consistent with the dry corporate tone.

**Canvas room**

- R12. Floor tiles: light grey carpet checkerboard — two close grey tones (e.g., `#d4d4ce` / `#c8c8c2`) replacing green grass.
- R13. Wall border: crisp white or near-white (`#f8f8f8`) replacing dark brown stone; a thin inner baseboard accent line in light grey.
- R14. Fluorescent ceiling panel accents: two or three pale rectangles drawn near the top interior of the room, slightly brighter than the floor, suggesting overhead lighting.
- R15. Character name labels above sprites: charcoal or corporate blue replacing gold.

**Canvas furniture props (static, decorative)**

The room has three furniture zones. Props are purely decorative — no collision, no interaction.

```
┌─────────────────────────────────────┐
│  [ceiling panels]                   │
│                                     │
│  [plant]   [desk][desk][desk]       │
│                                     │
│  [water-             [desk][desk]   │
│   cooler]                           │
│                                     │
└─────────────────────────────────────┘
```

- R16. Desk cluster: 4–5 rectangular desk shapes (white/light grey top, darker edge) arranged in a loose cluster in the center-right of the room. Each desk has a small dark rectangle suggesting a monitor.
- R17. Watercooler: a tall narrow rounded-rectangle shape in pale blue and white, placed in the lower-left area of the room.
- R18. Potted plant: a dark green circle (leaves) on a terracotta-brown small pot rectangle, placed in the upper-left area near the watercooler.

**Characters — new code-drawn pixel art office workers**

- R19. The Kenney roguelike sprite sheet is replaced by characters drawn programmatically on the canvas using the 2D API.
- R20. Each of the six character types has a distinct blazer color: navy, slate grey, beige, rust, teal, burgundy.
- R21. All characters share the same body structure: round head (skin-tone circle), blazer/suit body (colored rectangle), small white shirt collar detail, tiny tie (one-pixel-wide strip).
- R22. Characters have two animation states matching the existing `walkFrame` system: idle (upright) and walk (slight vertical body shift of 1–2px).
- R23. Character roles are renamed to office titles: Intern, Analyst, Manager, Contractor, Director, Consultant — in that order, matching the six existing character slots.
- R24. The existing `CHARACTERS` array and `SPRITE_W` / `SPRITE_H` constants are preserved as the interface — only the rendering implementation changes.

---

## Success Criteria

- Opening the app gives an immediate impression of a sterile corporate office, not a fantasy dungeon — a new user would describe it as "an office" before any other setting.
- Characters read as office workers at a glance; the blazer color distinguishes one type from another without needing to read the label.
- All existing functionality (movement, chat, speech bubbles, minimap, multi-player sync) works unchanged — the retheme is purely visual.
- A planner picking up this doc can implement the full retheme without inventing any product behavior or color decisions not stated here.

---

## Scope Boundaries

- No interactive or collidable furniture — props are canvas decoration only.
- No narrative text, narrator voice, or humor copy — purely aesthetic retheme.
- No isometric or perspective projection — flat top-down view unchanged.
- No new sound effects or ambient audio.
- No changes to server-side code (`server.js`) or the socket protocol.
- Character portraits on the entry screen avatar-picker update to show the new code-drawn worker style, but the picker layout and selection behavior are unchanged.

---

## Key Decisions

- **Code-drawn characters over a new sprite sheet**: avoids introducing a new image asset dependency; characters can be adjusted in CSS/JS without an image editor; scales cleanly with the existing `SCALE` constant.
- **Monospace font retained**: `Courier New` reads as corporate documentation / terminal — consistent with the deadpan office atmosphere without adding text humor.
- **Purely decorative furniture**: collision adds complexity without meaningful value for a hangout space; players moving freely around props is more Club Penguin-faithful.

---

## Dependencies / Assumptions

- The existing `walkFrame` boolean in `renderState` is sufficient to drive the two-frame character animation — no protocol changes needed.
- Canvas dimensions (800×600) are unchanged; furniture positions should be specified as percentages or pixel offsets relative to that base size so the existing scale transform continues to work.
- The entry screen avatar preview currently renders from the sprite sheet (`characters.png`). The new code-drawn characters will need a small canvas or SVG preview on the picker cards — the implementation approach is deferred to planning.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R16–R18][Technical] Exact pixel coordinates for furniture props — these depend on the final interior dimensions after wall width is confirmed.
- [Affects R19–R22][Technical] Whether the avatar picker previews are best handled with small `<canvas>` elements per card or a shared offscreen canvas — depends on what's simplest given the existing `entry.js` structure.
