// renderer.js — Matisse-style canvas renderer
// Draws the off-white painted world: background, decorative cutouts, platforms,
// and player blobs. Uses a camera transform for horizontal scrolling.
//
// All coordinates are in logical world units. ctx.setTransform maps them to
// physical canvas pixels.

/* global World, BlobGen */

const Renderer = (function () {
  // ── Palette ──────────────────────────────────────────────────────────────
  const PAPER           = '#f5efe0';
  const INK             = '#0d1b2a';
  const GROUND_COLOR    = '#5a8c66';   // muted sage green
  const GROUND_DARK     = '#3e6649';   // muted grass clump dark shade
  const GROUND_LIGHT    = '#6fa87a';   // muted grass clump light shade
  const PLATFORM_COLORS = ['#e63946', '#1d4e89', '#f4d35e', '#e07b29', '#2a9d3f'];

  // ── Label style ──────────────────────────────────────────────────────────
  const LABEL_FONT = 'bold 12px Georgia, serif';
  const PILL_PAD_H = 7;
  const PILL_PAD_V = 3;
  const PILL_H     = 18;

  // Blobs are drawn 35% larger than their collision box for visual presence.
  // Feet align with collision bottom; head extends above collision top.
  const BLOB_DRAW_SCALE = 1.35;

  // Per-session blob cache: { [id]: { canvas, canvasFlipped, color, headTop } }
  const blobCache = {};

  function cacheBlob(id, seed) {
    if (!blobCache[id]) blobCache[id] = BlobGen.render(seed);
    return blobCache[id];
  }

  function uncacheBlob(id) {
    delete blobCache[id];
  }

  const DECORATIONS = [];

  function drawDecorations(ctx) {
    DECORATIONS.forEach(d => {
      ctx.save();
      ctx.globalAlpha = d.opacity !== undefined ? d.opacity : 0.72;

      if (d.type === 'leaf') {
        ctx.translate(d.x + d.w / 2, d.y + d.h / 2);
        ctx.rotate(d.rot || 0);
        ctx.beginPath();
        ctx.ellipse(0, 0, d.w / 2, d.h / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();

      } else if (d.type === 'flower') {
        ctx.translate(d.x, d.y);
        const petals = d.petals || 5;
        for (let i = 0; i < petals; i++) {
          const angle = (i / petals) * Math.PI * 2;
          ctx.save();
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.ellipse(d.r * 0.66, 0, d.r * 0.38, d.r * 0.26, 0, 0, Math.PI * 2);
          ctx.fillStyle = d.color;
          ctx.fill();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(0, 0, d.r * 0.33, 0, Math.PI * 2);
        ctx.fillStyle = d.center || INK;
        ctx.fill();

      } else if (d.type === 'snail') {
        ctx.translate(d.x, d.y);
        for (let ring = 0; ring < 3; ring++) {
          const r = d.r - ring * (d.r / 3.2);
          if (r <= 2) break;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 1.75);
          ctx.lineWidth   = Math.max(2, 4.5 - ring * 1.2);
          ctx.strokeStyle = d.color;
          ctx.stroke();
        }

      } else if (d.type === 'rect') {
        ctx.translate(d.x + d.w / 2, d.y + d.h / 2);
        ctx.rotate(d.rot || 0);
        ctx.beginPath();
        ctx.roundRect(-d.w / 2, -d.h / 2, d.w, d.h, d.r || 10);
        ctx.fillStyle = d.color;
        ctx.fill();
      }

      ctx.restore();
    });
  }

  // ── Ground with grass clumps ──────────────────────────────────────────────
  function drawGround(ctx) {
    // Solid ground fill
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, World.GROUND_Y, World.WORLD_W, World.WORLD_H - World.GROUND_Y);

    // Ground top ink line
    ctx.strokeStyle = INK;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(0, World.GROUND_Y);
    ctx.lineTo(World.WORLD_W, World.GROUND_Y);
    ctx.stroke();

    // Grass clumps — small oval tufts along the ground line (muted, subtle)
    const clumpX = [110, 290, 490, 690, 890, 1090, 1290, 1490];
    clumpX.forEach(gx => {
      ctx.globalAlpha = 0.40;
      ctx.fillStyle = GROUND_DARK;
      ctx.beginPath();
      ctx.ellipse(gx, World.GROUND_Y - 7, 20, 10, Math.sin(gx * 0.05) * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = GROUND_LIGHT;
      ctx.beginPath();
      ctx.ellipse(gx + 14, World.GROUND_Y - 4, 13, 6, -Math.sin(gx * 0.05) * 0.08, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // ── Background ────────────────────────────────────────────────────────────
  function drawBackground(ctx) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, World.WORLD_W, World.WORLD_H);
    drawDecorations(ctx);
    drawGround(ctx);
  }

  // ── Platforms — thicker, with shadow and top-surface highlight ────────────
  function drawPlatforms(ctx) {
    World.PLATFORMS.forEach((plat, i) => {
      const color = PLATFORM_COLORS[i % PLATFORM_COLORS.length];
      const h = 22;      // thicker (was 16)
      const r = h / 2;

      // Drop shadow
      ctx.beginPath();
      ctx.roundRect(plat.x + 4, plat.y + 4, plat.w, h, r);
      ctx.fillStyle = 'rgba(13, 27, 42, 0.18)';
      ctx.fill();

      // Main body
      ctx.beginPath();
      ctx.roundRect(plat.x, plat.y, plat.w, h, r);
      ctx.fillStyle   = color;
      ctx.fill();
      ctx.lineWidth   = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();

      // Top surface highlight (shows the landing strip)
      ctx.beginPath();
      ctx.moveTo(plat.x + r + 3, plat.y + 4);
      ctx.lineTo(plat.x + plat.w - r - 3, plat.y + 4);
      ctx.lineWidth   = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.38)';
      ctx.stroke();
    });
  }

  // ── Main draw call ─────────────────────────────────────────────────────────
  function drawFrame(ctx, canvasW, canvasH, renderState, localId, cameraX) {
    ctx.clearRect(0, 0, canvasW, canvasH);

    const scale = canvasH / World.WORLD_H;
    ctx.setTransform(scale, 0, 0, scale, -cameraX * scale, 0);

    drawBackground(ctx);
    drawPlatforms(ctx);

    // ── Players — drawn 35% larger than hitbox, feet-aligned ─────────────
    const bw = BlobGen.LOGICAL_W;
    const bh = BlobGen.LOGICAL_H;
    const drawW = bw * BLOB_DRAW_SCALE;
    const drawH = bh * BLOB_DRAW_SCALE;

    // High-quality downsampling from the 3× source canvases → crisp outlines
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (const id in renderState) {
      const p    = renderState[id];
      const blob = blobCache[id];
      if (!blob) continue;

      const bCanvas = p.facingLeft ? blob.canvasFlipped : blob.canvas;
      // Center visually on hitbox; align visual feet with collision feet
      const drawX = Math.round(p.x + (bw - drawW) / 2);
      const drawY = Math.round(p.y + bh - drawH);

      ctx.drawImage(bCanvas, drawX, drawY, drawW, drawH);
    }

    // ── Name pill badges ───────────────────────────────────────────────────
    ctx.font      = LABEL_FONT;
    ctx.textAlign = 'center';
    for (const id in renderState) {
      const p    = renderState[id];
      const blob = blobCache[id];
      if (!blob) continue;

      const centerX  = Math.round(p.x + bw / 2);
      const visualTop = Math.round(p.y + bh - drawH);  // top of drawn blob
      const textW    = ctx.measureText(p.name).width;
      const pillW    = Math.ceil(textW + PILL_PAD_H * 2);
      const pillX    = centerX - pillW / 2;
      const pillY    = visualTop - PILL_H - 5;

      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, PILL_H, PILL_H / 2);
      ctx.fillStyle   = blob.color || PAPER;
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth   = 1.8;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle   = INK;
      ctx.fillText(p.name, centerX, pillY + PILL_H - PILL_PAD_V - 1);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { drawFrame, cacheBlob, uncacheBlob };
}());
