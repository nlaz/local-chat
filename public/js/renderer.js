// renderer.js — Matisse-style canvas renderer
// Draws the off-white painted world: background, decorative cutouts, platforms,
// and player blobs. Uses a camera transform for horizontal scrolling.
//
// All coordinates are in logical world units. ctx.setTransform maps them to
// physical canvas pixels.

/* global World, BlobGen */

const Renderer = (function () {
  // ── Palette ──────────────────────────────────────────────────────────────
  const PAPER        = '#f5efe0';   // off-white background
  const INK          = '#0d1b2a';   // outlines + text
  const GROUND_COLOR = '#2a9d3f';   // green ground strip
  const PLATFORM_COLORS = ['#e63946', '#1d4e89', '#f4d35e', '#e07b29', '#2a9d3f'];

  // ── Label style ──────────────────────────────────────────────────────────
  const LABEL_FONT  = 'bold 13px Georgia, serif';
  const LABEL_COLOR = INK;

  // Per-session blob cache: { [id]: { canvas, canvasFlipped, color, headTop } }
  const blobCache = {};

  // ── Public API ────────────────────────────────────────────────────────────

  // Call once when a new player joins (or on reconnect)
  function cacheBlob(id, seed) {
    if (!blobCache[id]) {
      blobCache[id] = BlobGen.render(seed);
    }
    return blobCache[id];
  }

  function uncacheBlob(id) {
    delete blobCache[id];
  }

  // ── Decorative cutout shapes ──────────────────────────────────────────────
  // Pre-defined Matisse-style back-layer decorations (non-colliding).
  // Each is drawn once on the world's coordinate system.
  const DECORATIONS = [
    // Leaf shapes
    { type: 'leaf', x: 80,   y: 650, w: 60,  h: 100, color: '#2a9d3f',  rot: -0.3 },
    { type: 'leaf', x: 1480, y: 600, w: 50,  h: 90,  color: '#2a9d3f',  rot: 0.4  },
    { type: 'leaf', x: 700,  y: 300, w: 40,  h: 70,  color: '#1d4e89',  rot: 0.1  },
    // Snail spiral (simplified as a filled arc ring)
    { type: 'snail', x: 320,  y: 740, r: 28, color: '#e63946' },
    { type: 'snail', x: 1250, y: 720, r: 22, color: '#f4d35e' },
    // Rounded rectangle cutout
    { type: 'rect', x: 1380, y: 280, w: 70, h: 120, r: 18, color: '#e07b29' },
    { type: 'rect', x: 60,   y: 300, w: 50, h: 90,  r: 14, color: '#f4d35e' },
  ];

  function drawDecorations(ctx) {
    DECORATIONS.forEach(d => {
      ctx.save();
      if (d.type === 'leaf') {
        ctx.translate(d.x + d.w / 2, d.y + d.h / 2);
        ctx.rotate(d.rot || 0);
        ctx.beginPath();
        ctx.ellipse(0, 0, d.w / 2, d.h / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.globalAlpha = 0.75;
        ctx.fill();
      } else if (d.type === 'snail') {
        // Simple spiral approximation: two concentric arcs
        ctx.translate(d.x, d.y);
        for (let ring = 0; ring < 3; ring++) {
          const r = d.r - ring * 7;
          if (r <= 0) break;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 1.8);
          ctx.lineWidth = 5;
          ctx.strokeStyle = d.color;
          ctx.globalAlpha = 0.7;
          ctx.stroke();
        }
      } else if (d.type === 'rect') {
        ctx.beginPath();
        ctx.roundRect(d.x, d.y, d.w, d.h, d.r);
        ctx.fillStyle = d.color;
        ctx.globalAlpha = 0.6;
        ctx.fill();
      }
      ctx.restore();
    });
  }

  // ── Background (world background + ground strip) ──────────────────────────
  function drawBackground(ctx) {
    // Paper background
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, World.WORLD_W, World.WORLD_H);

    // Decorative cutouts (back layer)
    drawDecorations(ctx);

    // Ground strip
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, World.GROUND_Y, World.WORLD_W, World.WORLD_H - World.GROUND_Y);

    // Ground top edge (ink line)
    ctx.strokeStyle = INK;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(0, World.GROUND_Y);
    ctx.lineTo(World.WORLD_W, World.GROUND_Y);
    ctx.stroke();
  }

  // ── Platform shapes ────────────────────────────────────────────────────────
  function drawPlatforms(ctx) {
    World.PLATFORMS.forEach((plat, i) => {
      const color = PLATFORM_COLORS[i % PLATFORM_COLORS.length];
      const h     = 16;   // platform visual thickness
      const r     = h / 2;

      // Organic blob-ish platform: rounded rect with slight height variation
      ctx.beginPath();
      ctx.roundRect(plat.x, plat.y, plat.w, h, r);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth   = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
    });
  }

  // ── Main draw call ─────────────────────────────────────────────────────────
  // renderState: { [id]: { name, seed, x, y, vx, vy, facingLeft } }
  // localId: socket id of local player
  // cameraX: left edge of viewport in world coords (0..WORLD_W - VIEWPORT_W)
  // canvasW, canvasH: physical canvas pixel size
  function drawFrame(ctx, canvasW, canvasH, renderState, localId, cameraX) {
    ctx.clearRect(0, 0, canvasW, canvasH);

    // ── Set camera transform ──────────────────────────────────────────────
    // Scale by height so the full world height always fits the screen.
    // Visible world width = canvasW / scale (dynamic; may exceed WORLD_W on
    // wide screens, in which case cameraX is always 0 and no scroll occurs).
    const scale = canvasH / World.WORLD_H;
    ctx.setTransform(scale, 0, 0, scale, -cameraX * scale, 0);

    // ── World drawing ─────────────────────────────────────────────────────
    drawBackground(ctx);
    drawPlatforms(ctx);

    // ── Players ───────────────────────────────────────────────────────────
    for (const id in renderState) {
      const p    = renderState[id];
      const blob = blobCache[id];
      if (!blob) continue;

      const bw = BlobGen.LOGICAL_W;
      const bh = BlobGen.LOGICAL_H;
      const bCanvas = p.facingLeft ? blob.canvasFlipped : blob.canvas;

      ctx.drawImage(bCanvas, Math.round(p.x), Math.round(p.y), bw, bh);
    }

    // ── Name labels (drawn after blobs, on top) ───────────────────────────
    ctx.font      = LABEL_FONT;
    ctx.textAlign = 'center';
    for (const id in renderState) {
      const p    = renderState[id];
      const blob = blobCache[id];
      if (!blob) continue;

      const bw    = BlobGen.LOGICAL_W;
      const labelX = Math.round(p.x + bw / 2);
      const labelY = Math.round(p.y) - 6;

      // Shadow
      ctx.fillStyle = 'rgba(245,239,224,0.7)';
      ctx.fillText(p.name, labelX + 1, labelY + 1);
      // Text
      ctx.fillStyle = LABEL_COLOR;
      ctx.fillText(p.name, labelX, labelY);
    }

    // ── Reset transform ───────────────────────────────────────────────────
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { drawFrame, cacheBlob, uncacheBlob };
}());
