// minimap.js — top-right overlay showing all player positions as dots
// OSRS-style: gold dot for local player, cream dots for others.
// Drawn every rAF tick by game.js.

const Minimap = (function () {
  const MAP_W      = 200;
  const MAP_H      = 150;
  const SCALE      = MAP_W / 800;   // 0.25 — matches 4:3 logical canvas
  const DOT_RADIUS = 4;

  let _ctx = null;

  // ── Init — called once after game:init ─────────────────────
  function init() {
    const el = document.getElementById('minimap-canvas');
    if (!el) return;
    _ctx = el.getContext('2d');
    _ctx.imageSmoothingEnabled = false;
  }

  // ── Draw — called every rAF tick ───────────────────────────
  // renderState: { [id]: { x, y, ... } }
  // localId:     socket id of the local player
  function draw(renderState, localId) {
    if (!_ctx) return;

    _ctx.clearRect(0, 0, MAP_W, MAP_H);

    for (const id in renderState) {
      const p = renderState[id];
      if (p == null || p.x == null) continue;

      // Centre dot on sprite midpoint
      const mx = (p.x + SPRITE_W  / 2) * SCALE;
      const my = (p.y + SPRITE_H / 2) * SCALE;

      _ctx.fillStyle = id === localId
        ? '#ffd700'                      // gold — local player (R8)
        : 'rgba(240, 230, 200, 0.85)';  // cream — other players (R8)

      _ctx.beginPath();
      _ctx.arc(mx, my, DOT_RADIUS, 0, Math.PI * 2);
      _ctx.fill();
    }
  }

  return { init, draw };
}());
