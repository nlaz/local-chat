// minimap.js — top-right overlay showing all player positions as dots
// Corporate palette: teal dot for local player, muted grey-blue for others.
// Drawn every rAF tick by game.js.

const Minimap = (function () {
  const MAP_W      = 200;
  const MAP_H      = 150;
  const DOT_RADIUS = 3;

  let _ctx = null;

  function scaleX() { return MAP_W / (window._worldW || 1200); }
  function scaleY() { return MAP_H / (window._worldH || 900); }

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

    const sx = scaleX();
    const sy = scaleY();

    // Camera viewport box on the minimap — shows what's currently on screen
    const cam = window._camera;
    if (cam && window._viewW && window._viewH) {
      _ctx.strokeStyle = 'rgba(74, 124, 142, 0.6)';
      _ctx.lineWidth = 1;
      _ctx.strokeRect(cam.x * sx, cam.y * sy, window._viewW * sx, window._viewH * sy);
    }

    for (const id in renderState) {
      const p = renderState[id];
      if (p == null || p.x == null) continue;

      // Centre dot on sprite midpoint
      const mx = (p.x + SPRITE_W  / 2) * sx;
      const my = (p.y + SPRITE_H / 2) * sy;

      _ctx.fillStyle = id === localId
        ? '#4a7c8e'                       // teal — local player
        : 'rgba(140, 160, 165, 0.85)';   // muted grey-blue — other players

      _ctx.beginPath();
      _ctx.arc(mx, my, DOT_RADIUS, 0, Math.PI * 2);
      _ctx.fill();
    }
  }

  return { init, draw };
}());
