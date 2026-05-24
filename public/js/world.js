// world.js — shared world constants for server and client
// Logical units (pixels in world space, independent of screen size).
// Exported as Node module AND hung on window for browser use.

(function (exports) {
  const WORLD_W     = 1600;
  const WORLD_H     = 900;
  const VIEWPORT_W  = 800;   // logical viewport slice width
  const VIEWPORT_H  = 900;   // no vertical scroll — viewport height = world height

  const GROUND_Y    = 820;   // top of ground surface
  const GRAVITY     = 1800;  // px/s²
  const JUMP_VY     = -1050; // px/s initial jump velocity (negative = upward)
  const MAX_FALL    = 1200;  // terminal velocity px/s
  const WALK_SPEED  = 220;   // px/s horizontal
  const FRICTION    = 0.0;   // instant stop (0 = no slide)

  // Blob display size in logical units
  const BLOB_W      = 56;
  const BLOB_H      = 80;

  // Platforms: { id, x, y, w } — y is the TOP of the platform surface
  const PLATFORMS = [
    { id: 'p1', x: 180,  y: 660, w: 200 },
    { id: 'p2', x: 520,  y: 530, w: 240 },
    { id: 'p3', x: 880,  y: 610, w: 180 },
    { id: 'p4', x: 1160, y: 470, w: 220 },
    { id: 'p5', x: 740,  y: 370, w: 160 },
  ];

  const world = {
    WORLD_W, WORLD_H,
    VIEWPORT_W, VIEWPORT_H,
    GROUND_Y,
    GRAVITY, JUMP_VY, MAX_FALL, WALK_SPEED, FRICTION,
    BLOB_W, BLOB_H,
    PLATFORMS,
  };

  // Dual export: Node require() and browser window
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = world;
  } else {
    exports.World = world;
  }
}(typeof window !== 'undefined' ? window : {}));
