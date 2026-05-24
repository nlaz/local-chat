// minimap.js — scrolling-world-aware minimap
// Shows full world width as a narrow strip. Each player is a colored dot
// in their blob's primary color. A faint rect shows the current camera view.

/* global World */

const Minimap = (function () {
  // Physical canvas size (matches index.html attributes)
  const MAP_W = 240;
  const MAP_H = 135;

  // Scale: logical world units → minimap pixels
  const SCALE_X = MAP_W / (World.WORLD_W || 1600);
  const SCALE_Y = MAP_H / (World.WORLD_H || 900);

  const DOT_RADIUS = 4;

  const PAPER     = '#f5efe0';
  const INK       = '#0d1b2a';
  const CAM_COLOR = 'rgba(13, 27, 42, 0.15)';
  const GROUND_COLOR = '#5a8c66';   // matches renderer muted sage ground

  let _ctx    = null;
  let _scaleX = SCALE_X;
  let _scaleY = SCALE_Y;

  // ── Init — called once after game:init ─────────────────────────────────────
  function init() {
    const el = document.getElementById('minimap-canvas');
    if (!el) return;
    _ctx = el.getContext('2d');
    // Recalculate scale after World may have been updated by server
    _scaleX = MAP_W / (World.WORLD_W || 1600);
    _scaleY = MAP_H / (World.WORLD_H || 900);
  }

  // ── Draw — called every rAF tick ─────────────────────────────────────────
  // renderState: { [id]: { x, y, color (from blob cache via game.js lookup) } }
  // localId:  socket id of local player
  // cameraX:  current camera left edge in world coords
  function draw(renderState, localId, cameraX) {
    if (!_ctx) return;

    // Background
    _ctx.fillStyle = PAPER;
    _ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Ground strip (bottom of minimap)
    const groundMapY = (World.GROUND_Y || 820) * _scaleY;
    _ctx.fillStyle = GROUND_COLOR;
    _ctx.fillRect(0, groundMapY, MAP_W, MAP_H - groundMapY);

    // Camera viewport rect — only draw when player can't see the full world
    if (cameraX !== undefined) {
      const scale    = (window.innerHeight || 900) / (World.WORLD_H || 900);
      const visibleW = (window.innerWidth  || 800) / scale;
      if (visibleW < (World.WORLD_W || 1600)) {
        const vwMap   = visibleW * _scaleX;
        const camMapX = cameraX * _scaleX;
        _ctx.fillStyle = CAM_COLOR;
        _ctx.fillRect(camMapX, 0, vwMap, MAP_H);
        _ctx.strokeStyle = INK;
        _ctx.lineWidth   = 1;
        _ctx.strokeRect(camMapX, 0, vwMap, MAP_H);
      }
    }

    // Platform lines
    const platColors = ['#e63946', '#1d4e89', '#f4d35e', '#e07b29', '#2a9d3f'];
    (World.PLATFORMS || []).forEach((plat, i) => {
      const px = plat.x * _scaleX;
      const py = plat.y * _scaleY;
      const pw = plat.w * _scaleX;
      _ctx.fillStyle = platColors[i % platColors.length];
      _ctx.fillRect(px, py, pw, 2.5);
      _ctx.strokeStyle = INK;
      _ctx.lineWidth = 0.5;
      _ctx.strokeRect(px, py, pw, 2.5);
    });

    // Player dots
    for (const id in renderState) {
      const p = renderState[id];
      if (p == null || p.x == null) continue;

      // Centre dot on blob midpoint
      const mx = (p.x + (World.BLOB_W || 56) / 2) * _scaleX;
      const my = (p.y + (World.BLOB_H || 80) / 2) * _scaleY;

      // Use blob's primary color if available, fall back to ink/red
      const dotColor = p.color || (id === localId ? '#e63946' : '#1d4e89');

      _ctx.beginPath();
      _ctx.arc(mx, my, DOT_RADIUS, 0, Math.PI * 2);
      _ctx.fillStyle = dotColor;
      _ctx.fill();
      _ctx.strokeStyle = INK;
      _ctx.lineWidth   = 1.5;
      _ctx.stroke();
    }
  }

  return { init, draw };
}());
