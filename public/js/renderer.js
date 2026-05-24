// renderer.js — canvas drawing in world space with camera offset.
// drawFrame translates the context by -camera before drawing the world, so
// background, furniture, characters, and labels are all authored in world coords.

const Renderer = (function () {
  const FLOOR_LIGHT     = '#d4d4ce';
  const FLOOR_DARK      = '#c8c8c2';
  const TILE_SIZE       = 32;
  const WALL_COLOR      = '#f8f8f8';
  const WALL_WIDTH      = 16;
  const BASEBOARD_COLOR = '#dcdcd6';
  const CEILING_PANEL   = '#eaeae6';
  const LABEL_FONT      = '11px "Courier New", monospace';
  const LABEL_COLOR     = '#3a6a78';
  const LABEL_SHADOW    = 'rgba(0,0,0,0.25)';
  const NAME_OFFSET     = 8;
  const VIEW_BG         = '#e8e8e4';   // outside-world fill (only seen if world < view)

  // ── Background ────────────────────────────────────────────
  function drawBackground(ctx, ww, wh) {
    const ix = WALL_WIDTH;
    const iy = WALL_WIDTH;
    const iw = ww - WALL_WIDTH * 2;
    const ih = wh - WALL_WIDTH * 2;
    const cols = Math.ceil(iw / TILE_SIZE) + 1;
    const rows = Math.ceil(ih / TILE_SIZE) + 1;

    // Carpet checkerboard
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        ctx.fillStyle = (col + row) % 2 === 0 ? FLOOR_LIGHT : FLOOR_DARK;
        ctx.fillRect(ix + col * TILE_SIZE, iy + row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    drawCeilingPanels(ctx, ww, wh);
    drawFurniture(ctx, ww, wh);

    ctx.restore();

    // Wall border
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(0, 0, ww, WALL_WIDTH);
    ctx.fillRect(0, wh - WALL_WIDTH, ww, WALL_WIDTH);
    ctx.fillRect(0, 0, WALL_WIDTH, wh);
    ctx.fillRect(ww - WALL_WIDTH, 0, WALL_WIDTH, wh);

    // Baseboard accent
    ctx.fillStyle = BASEBOARD_COLOR;
    ctx.fillRect(WALL_WIDTH, WALL_WIDTH, ww - WALL_WIDTH * 2, 2);
    ctx.fillRect(WALL_WIDTH, wh - WALL_WIDTH - 2, ww - WALL_WIDTH * 2, 2);
    ctx.fillRect(WALL_WIDTH, WALL_WIDTH, 2, wh - WALL_WIDTH * 2);
    ctx.fillRect(ww - WALL_WIDTH - 2, WALL_WIDTH, 2, wh - WALL_WIDTH * 2);
  }

  // ── Ceiling fluorescent panels ────────────────────────────
  // Grid of panel strips across the world ceiling, suggesting overhead lighting.
  function drawCeilingPanels(ctx, ww, wh) {
    ctx.fillStyle = CEILING_PANEL;
    const stride = 220;
    const panelW = 160;
    const panelH = 10;
    const startX = 80;
    const rows = [26, 246, 466, 686, 906, 1126, 1346, 1566];
    for (let r = 0; r < rows.length; r++) {
      const y = rows[r];
      if (y > wh - WALL_WIDTH - panelH) break;
      for (let x = startX; x + panelW < ww - WALL_WIDTH; x += stride) {
        ctx.fillRect(x, y, panelW, panelH);
      }
    }
  }

  // ── Furniture props (decorative) ──────────────────────────
  // Multiple desk clusters, watercoolers, and plants spread across the world.
  function drawFurniture(ctx, ww, wh) {
    // Desk clusters — five-desk pods repeated across the floor
    const clusters = [
      { x:  400, y:  120 },
      { x:  400, y:  720 },
      { x:  400, y: 1320 },
      { x: 1280, y:  120 },
      { x: 1280, y:  720 },
      { x: 1280, y: 1320 },
      { x: 1880, y:  120 },
      { x: 1880, y:  720 },
      { x: 1880, y: 1320 },
    ];
    for (let i = 0; i < clusters.length; i++) drawDeskCluster(ctx, clusters[i].x, clusters[i].y);

    // Watercoolers
    const coolers = [
      { x:  80, y:  260 },
      { x:  80, y: 1180 },
      { x: 2280, y: 580 },
      { x: 2280, y: 1480 },
    ];
    for (let i = 0; i < coolers.length; i++) drawWatercooler(ctx, coolers[i].x, coolers[i].y);

    // Potted plants
    const plants = [
      { x:  80, y:   80 },
      { x:  80, y:  900 },
      { x:  80, y: 1700 - 40 },
      { x: 2280, y:   80 },
      { x: 2280, y: 1700 - 40 },
      { x: 1180, y: 1700 - 40 },
    ];
    for (let i = 0; i < plants.length; i++) drawPottedPlant(ctx, plants[i].x, plants[i].y);
  }

  function drawDeskCluster(ctx, ox, oy) {
    const DESK_W = 64;
    const DESK_H = 40;
    const positions = [
      { dx:   0, dy:  0 },
      { dx:  80, dy:  0 },
      { dx: 160, dy:  0 },
      { dx:  32, dy: 96 },
      { dx: 112, dy: 96 },
    ];
    for (let i = 0; i < positions.length; i++) {
      const x = ox + positions[i].dx;
      const y = oy + positions[i].dy;
      ctx.fillStyle = '#f0f0ec';
      ctx.fillRect(x, y, DESK_W, DESK_H);
      ctx.fillStyle = '#d8d8d4';
      ctx.fillRect(x, y + DESK_H - 4, DESK_W, 4);
      ctx.fillRect(x + DESK_W - 3, y, 3, DESK_H);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(x + DESK_W / 2 - 5, y + 4, 10, 8);
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x + DESK_W / 2 - 1, y + 12, 2, 3);
    }
  }

  function drawWatercooler(ctx, x, y) {
    ctx.fillStyle = '#b8d4e0';
    ctx.fillRect(x, y, 24, 48);
    ctx.fillStyle = '#cce4ef';
    ctx.fillRect(x + 3, y + 2, 18, 22);
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(x, y + 26, 24, 8);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + 10, y + 36, 4, 4);
    ctx.fillStyle = '#888888';
    ctx.fillRect(x, y + 42, 24, 6);
  }

  function drawPottedPlant(ctx, x, y) {
    ctx.fillStyle = '#c1634a';
    ctx.fillRect(x, y + 20, 28, 20);
    ctx.fillStyle = '#8a3e28';
    ctx.fillRect(x, y + 20, 28, 2);
    ctx.fillStyle = '#3a6b3a';
    ctx.beginPath(); ctx.arc(x + 14, y + 14, 14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x +  4, y + 20, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 24, y + 20, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4d8a4d';
    ctx.beginPath(); ctx.arc(x + 12, y + 11, 5, 0, Math.PI * 2); ctx.fill();
  }

  // ── Name label (world coords) ─────────────────────────────
  function drawLabel(ctx, name, x, y) {
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    const rx = Math.round(x + (SPRITE_W / 2));
    const ry = Math.round(y) - NAME_OFFSET;

    ctx.fillStyle = LABEL_SHADOW;
    ctx.fillText(name, rx + 1, ry + 1);

    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText(name, rx, ry);
  }

  // ── Main draw call ────────────────────────────────────────
  function drawFrame(ctx, viewW, viewH, worldW, worldH, camera, renderState, _localPlayerId) {
    // Clear viewport in screen space, then translate to world space.
    ctx.fillStyle = VIEW_BG;
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

    drawBackground(ctx, worldW, worldH);

    for (const id in renderState) {
      const p = renderState[id];
      const char = CHARACTERS[p.avatar] || CHARACTERS[0];
      char.draw(ctx, p.x, p.y, p.walkFrame, p.facingLeft);
      drawLabel(ctx, p.name, p.x, p.y);
    }

    ctx.restore();
  }

  return { drawFrame };
}());
