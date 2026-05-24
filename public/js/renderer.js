// renderer.js — canvas sprite drawing
// Draws the room background, player sprites, and name labels each rAF frame.

const Renderer = (function () {
  const FLOOR_LIGHT  = '#3a5c2a';   // lighter grass tile
  const FLOOR_DARK   = '#2d4a22';   // darker grass tile
  const TILE_SIZE    = 32;
  const WALL_COLOR   = '#5c3310';   // dark brown stone
  const WALL_WIDTH   = 16;
  const LABEL_FONT   = '11px "Courier New", monospace';
  const LABEL_COLOR  = '#ffd700';   // gold name labels (R11)
  const LABEL_SHADOW = 'rgba(0,0,0,0.8)';
  const NAME_OFFSET  = 8;   // px above sprite top

  let _sheet = null;

  function loadSheet(onLoad) {
    _sheet = new Image();
    _sheet.onload = onLoad;
    _sheet.src = '/assets/characters.png';
  }

  // ── Background ────────────────────────────────────────────
  function drawBackground(ctx, cw, ch) {
    // Grass checkerboard floor — clip to interior (inside walls) ──
    const ix = WALL_WIDTH;
    const iy = WALL_WIDTH;
    const iw = cw - WALL_WIDTH * 2;
    const ih = ch - WALL_WIDTH * 2;
    const cols = Math.ceil(iw / TILE_SIZE) + 1;
    const rows = Math.ceil(ih / TILE_SIZE) + 1;

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

    ctx.restore();

    // Wall border (dark brown stone — R12) ──────────────────
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(0, 0, cw, WALL_WIDTH);                      // top
    ctx.fillRect(0, ch - WALL_WIDTH, cw, WALL_WIDTH);        // bottom
    ctx.fillRect(0, 0, WALL_WIDTH, ch);                      // left
    ctx.fillRect(cw - WALL_WIDTH, 0, WALL_WIDTH, ch);        // right
  }

  // ── Single sprite ─────────────────────────────────────────
  function drawSprite(ctx, char, x, y, frameY, facingLeft) {
    const { sheetX, frameW, frameH } = char;
    const dw = frameW * SCALE;
    const dh = frameH * SCALE;
    const rx = Math.round(x);
    const ry = Math.round(y);

    if (facingLeft) {
      // Mirror: translate to right edge, flip, draw at origin offset
      ctx.save();
      ctx.translate(rx + dw, ry);
      ctx.scale(-1, 1);
      ctx.drawImage(_sheet, sheetX, frameY, frameW, frameH, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(_sheet, sheetX, frameY, frameW, frameH, rx, ry, dw, dh);
    }
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
  // renderState: { [id]: { name, avatar, x, y, dx, dy, walkFrame, facingLeft } }
  function drawFrame(ctx, cw, ch, renderState, _localPlayerId) {
    ctx.clearRect(0, 0, cw, ch);
    drawBackground(ctx, cw, ch);

    if (!_sheet) return;

    for (const id in renderState) {
      const p = renderState[id];
      const char = CHARACTERS[p.avatar] || CHARACTERS[0];

      // Pick sprite row: idle (sheetY) or walk step (walkY)
      const frameY = p.walkFrame ? char.walkY : char.sheetY;

      drawSprite(ctx, char, p.x, p.y, frameY, p.facingLeft);
      drawLabel(ctx, p.name, p.x, p.y);
    }
  }

  return { loadSheet, drawFrame };
}());
