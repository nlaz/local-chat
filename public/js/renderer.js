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
  const GROUND_COLOR    = '#2a9d3f';
  const GROUND_DARK     = '#1d7a30';   // grass clump dark shade
  const GROUND_LIGHT    = '#34b850';   // grass clump light shade
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

  // ── Decorations — Matisse garden, 21 shapes across the full 1600px world ──
  //   type: 'leaf' | 'rect' | 'snail' | 'flower'
  //   opacity: 0–1 (default 0.72)
  //   rot: radians (leaf/rect)
  const DECORATIONS = [
    // ── Far-left (0–350) ──────────────────────────────────────────────────
    { type: 'rect',   x: 55,   y: 230, w: 52,  h: 95,  r: 16, color: '#f4d35e', rot:  0.12, opacity: 0.65 },
    { type: 'leaf',   x: 80,   y: 640, w: 65,  h: 108, color: '#2a9d3f', rot: -0.30, opacity: 0.78 },
    { type: 'snail',  x: 280,  y: 775, r: 26,  color: '#e63946', opacity: 0.78 },
    { type: 'rect',   x: 195,  y: 455, w: 38,  h: 72,  r: 13, color: '#1d4e89', rot:  0.18, opacity: 0.62 },

    // ── Left-center (350–650) ─────────────────────────────────────────────
    { type: 'leaf',   x: 425,  y: 520, w: 48,  h: 118, color: '#e07b29', rot: -0.48, opacity: 0.72 },
    { type: 'flower', x: 490,  y: 800, r: 22,  color: '#e63946', center: '#f4d35e', petals: 5, opacity: 0.82 },
    { type: 'snail',  x: 570,  y: 796, r: 16,  color: '#1d4e89', opacity: 0.72 },
    { type: 'rect',   x: 590,  y: 135, w: 55,  h: 92,  r: 18, color: '#e63946', rot: -0.06, opacity: 0.58 },

    // ── Center (650–1000) ─────────────────────────────────────────────────
    { type: 'leaf',   x: 685,  y: 280, w: 42,  h: 80,  color: '#1d4e89', rot:  0.10, opacity: 0.70 },
    { type: 'leaf',   x: 735,  y: 680, w: 40,  h: 74,  color: '#f4d35e', rot:  0.28, opacity: 0.70 },
    { type: 'flower', x: 855,  y: 800, r: 19,  color: '#f4d35e', center: '#e07b29', petals: 6, opacity: 0.80 },
    { type: 'rect',   x: 910,  y: 350, w: 36,  h: 62,  r: 10, color: '#2a9d3f', rot: -0.22, opacity: 0.60 },

    // ── Right-center (1000–1300) ──────────────────────────────────────────
    { type: 'leaf',   x: 980,  y: 575, w: 58,  h: 108, color: '#e63946', rot:  0.38, opacity: 0.74 },
    { type: 'snail',  x: 1100, y: 786, r: 24,  color: '#f4d35e', opacity: 0.76 },
    { type: 'rect',   x: 1120, y: 215, w: 48,  h: 90,  r: 16, color: '#1d4e89', rot:  0.08, opacity: 0.60 },
    { type: 'leaf',   x: 1195, y: 435, w: 44,  h: 84,  color: '#2a9d3f', rot: -0.32, opacity: 0.72 },

    // ── Far-right (1300–1600) ─────────────────────────────────────────────
    { type: 'flower', x: 1295, y: 800, r: 20,  color: '#2a9d3f', center: '#1d4e89', petals: 5, opacity: 0.80 },
    { type: 'snail',  x: 1385, y: 764, r: 22,  color: '#f4d35e', opacity: 0.74 },
    { type: 'rect',   x: 1388, y: 275, w: 72,  h: 124, r: 18, color: '#e07b29', rot: -0.05, opacity: 0.64 },
    { type: 'leaf',   x: 1472, y: 575, w: 52,  h: 98,  color: '#2a9d3f', rot:  0.42, opacity: 0.74 },
    { type: 'leaf',   x: 1542, y: 365, w: 46,  h: 86,  color: '#e63946', rot: -0.18, opacity: 0.66 },
  ];

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

    // Grass clumps — small oval tufts along the ground line
    const clumpX = [75, 195, 340, 465, 615, 755, 900, 1040, 1185, 1320, 1455, 1565];
    clumpX.forEach(gx => {
      ctx.globalAlpha = 0.68;
      // Main clump (dark)
      ctx.fillStyle = GROUND_DARK;
      ctx.beginPath();
      ctx.ellipse(gx, World.GROUND_Y - 8, 22, 11, Math.sin(gx * 0.05) * 0.15, 0, Math.PI * 2);
      ctx.fill();
      // Secondary highlight clump (light)
      ctx.fillStyle = GROUND_LIGHT;
      ctx.beginPath();
      ctx.ellipse(gx + 16, World.GROUND_Y - 5, 14, 7, -Math.sin(gx * 0.05) * 0.1, 0, Math.PI * 2);
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
