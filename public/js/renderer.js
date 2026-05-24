// renderer.js — canvas sprite drawing
// Draws the room background, furniture props, player sprites, and name labels each rAF frame.

const Renderer = (function () {
  const FLOOR_LIGHT       = '#d4d4ce';   // lighter grey carpet tile
  const FLOOR_DARK        = '#c8c8c2';   // darker grey carpet tile
  const TILE_SIZE         = 32;
  const WALL_COLOR        = '#f8f8f8';   // near-white wall
  const WALL_WIDTH        = 16;
  const BASEBOARD_COLOR   = '#dcdcd6';   // thin accent line inside walls
  const CEILING_PANEL     = '#eaeae6';   // pale overhead fluorescent panel
  const LABEL_FONT        = '11px "Courier New", monospace';
  const LABEL_COLOR       = '#3a6a78';   // corporate teal name labels
  const LABEL_SHADOW      = 'rgba(0,0,0,0.25)';
  const NAME_OFFSET       = 8;   // px above sprite top

  // ── Background ────────────────────────────────────────────
  function drawBackground(ctx, cw, ch) {
    const ix = WALL_WIDTH;
    const iy = WALL_WIDTH;
    const iw = cw - WALL_WIDTH * 2;
    const ih = ch - WALL_WIDTH * 2;
    const cols = Math.ceil(iw / TILE_SIZE) + 1;
    const rows = Math.ceil(ih / TILE_SIZE) + 1;

    // Carpet checkerboard — clipped to interior
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

    drawCeilingPanels(ctx);
    drawFurniture(ctx);

    ctx.restore();

    // Wall border (near-white) ──────────────────
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(0, 0, cw, WALL_WIDTH);
    ctx.fillRect(0, ch - WALL_WIDTH, cw, WALL_WIDTH);
    ctx.fillRect(0, 0, WALL_WIDTH, ch);
    ctx.fillRect(cw - WALL_WIDTH, 0, WALL_WIDTH, ch);

    // Baseboard — 2px accent inside the wall border
    ctx.fillStyle = BASEBOARD_COLOR;
    ctx.fillRect(WALL_WIDTH, WALL_WIDTH, cw - WALL_WIDTH * 2, 2);                              // top
    ctx.fillRect(WALL_WIDTH, ch - WALL_WIDTH - 2, cw - WALL_WIDTH * 2, 2);                     // bottom
    ctx.fillRect(WALL_WIDTH, WALL_WIDTH, 2, ch - WALL_WIDTH * 2);                              // left
    ctx.fillRect(cw - WALL_WIDTH - 2, WALL_WIDTH, 2, ch - WALL_WIDTH * 2);                     // right
  }

  // ── Ceiling fluorescent panels (overhead lighting hint) ───
  function drawCeilingPanels(ctx) {
    ctx.fillStyle = CEILING_PANEL;
    ctx.fillRect(80,  26, 160, 10);
    ctx.fillRect(300, 26, 160, 10);
    ctx.fillRect(520, 26, 160, 10);
  }

  // ── Furniture props (decorative, no collision) ────────────
  function drawFurniture(ctx) {
    // Desk cluster — center-right
    const desks = [
      { x: 448, y:  80 },
      { x: 528, y:  80 },
      { x: 608, y:  80 },
      { x: 480, y: 176 },
      { x: 560, y: 176 },
    ];
    const DESK_W = 64;
    const DESK_H = 40;
    for (let i = 0; i < desks.length; i++) {
      const d = desks[i];
      // Desk top
      ctx.fillStyle = '#f0f0ec';
      ctx.fillRect(d.x, d.y, DESK_W, DESK_H);
      // Darker bottom edge (gives the desk a sense of depth)
      ctx.fillStyle = '#d8d8d4';
      ctx.fillRect(d.x, d.y + DESK_H - 4, DESK_W, 4);
      ctx.fillRect(d.x + DESK_W - 3, d.y, 3, DESK_H);
      // Monitor — small dark rectangle centered on the back of the desk
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(d.x + DESK_W / 2 - 5, d.y + 4, 10, 8);
      // Monitor stand
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(d.x + DESK_W / 2 - 1, d.y + 12, 2, 3);
    }

    // Watercooler — lower-left
    const wcX = 48, wcY = 384;
    // Body
    ctx.fillStyle = '#b8d4e0';
    ctx.fillRect(wcX, wcY, 24, 48);
    // Water tank (upper portion, lighter blue)
    ctx.fillStyle = '#cce4ef';
    ctx.fillRect(wcX + 3, wcY + 2, 18, 22);
    // White label band
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(wcX, wcY + 26, 24, 8);
    // Small spigot
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(wcX + 10, wcY + 36, 4, 4);
    // Base
    ctx.fillStyle = '#888888';
    ctx.fillRect(wcX, wcY + 42, 24, 6);

    // Potted plant — upper-left
    const ptX = 48, ptY = 112;
    // Pot
    ctx.fillStyle = '#c1634a';
    ctx.fillRect(ptX, ptY + 20, 28, 20);
    // Soil line
    ctx.fillStyle = '#8a3e28';
    ctx.fillRect(ptX, ptY + 20, 28, 2);
    // Leaves — three overlapping dark green circles
    ctx.fillStyle = '#3a6b3a';
    ctx.beginPath();
    ctx.arc(ptX + 14, ptY + 14, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ptX + 4,  ptY + 20, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ptX + 24, ptY + 20, 10, 0, Math.PI * 2);
    ctx.fill();
    // Highlight on the largest leaf cluster
    ctx.fillStyle = '#4d8a4d';
    ctx.beginPath();
    ctx.arc(ptX + 12, ptY + 11, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Name label ────────────────────────────────────────────
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
  function drawFrame(ctx, cw, ch, renderState, _localPlayerId) {
    ctx.clearRect(0, 0, cw, ch);
    drawBackground(ctx, cw, ch);

    for (const id in renderState) {
      const p = renderState[id];
      const char = CHARACTERS[p.avatar] || CHARACTERS[0];
      char.draw(ctx, p.x, p.y, p.walkFrame, p.facingLeft);
      drawLabel(ctx, p.name, p.x, p.y);
    }
  }

  return { drawFrame };
}());
