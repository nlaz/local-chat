// Character sprite configuration for local-chat
// Kenney Roguelike Characters (CC0) — roguelikeChar_transparent.png
//
// Sheet layout: 54 cols × 12 rows, 16×16 sprites, 1px margin (stride = 17px)
//   Row 0 = idle frame (all characters)
//   Row 1 = walk-step frame (all characters)
//
// Column groups observed in the sheet:
//   [0,1], [3], [6-17], [19-26], [28-31], [33-40], [42-53]
// One character picked from each of the six main groups for visual variety.
//
// Render size: each sprite scaled 3× on canvas = 48×48px displayed

const TILE  = 16;   // sprite size in the sheet
const STRIDE = 17;  // tile + 1px margin
const SCALE  = 3;   // display scale factor

function sx(col) { return col * STRIDE; }
const IDLE_ROW = 0;
const WALK_ROW = 1;

const CHARACTERS = [
  {
    id: 0,
    label: 'Warrior',
    sheetX: sx(0),
    sheetY: IDLE_ROW * STRIDE,
    walkY:  WALK_ROW * STRIDE,
    frameW: TILE,
    frameH: TILE,
  },
  {
    id: 1,
    label: 'Skeleton',
    sheetX: sx(3),
    sheetY: IDLE_ROW * STRIDE,
    walkY:  WALK_ROW * STRIDE,
    frameW: TILE,
    frameH: TILE,
  },
  {
    id: 2,
    label: 'Mage',
    sheetX: sx(9),
    sheetY: IDLE_ROW * STRIDE,
    walkY:  WALK_ROW * STRIDE,
    frameW: TILE,
    frameH: TILE,
  },
  {
    id: 3,
    label: 'Rogue',
    sheetX: sx(22),
    sheetY: IDLE_ROW * STRIDE,
    walkY:  WALK_ROW * STRIDE,
    frameW: TILE,
    frameH: TILE,
  },
  {
    id: 4,
    label: 'Knight',
    sheetX: sx(36),
    sheetY: IDLE_ROW * STRIDE,
    walkY:  WALK_ROW * STRIDE,
    frameW: TILE,
    frameH: TILE,
  },
  {
    id: 5,
    label: 'Ranger',
    sheetX: sx(47),
    sheetY: IDLE_ROW * STRIDE,
    walkY:  WALK_ROW * STRIDE,
    frameW: TILE,
    frameH: TILE,
  },
];

// Rendered pixel size of each character on the canvas
const SPRITE_W = TILE * SCALE;   // 48px
const SPRITE_H = TILE * SCALE;   // 48px
