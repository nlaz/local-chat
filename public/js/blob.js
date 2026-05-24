// blob.js — procedural Matisse-style blob avatar generator
// Given a numeric seed, deterministically produces a pre-rendered off-screen
// canvas of a blob (head + body + optional eyes) and a horizontally-mirrored
// copy for facing-left.
//
// No Math.random() — all randomness comes through Prng(seed).
// Canvas dimensions are in logical world units (blob.LOGICAL_W × blob.LOGICAL_H).

/* global Prng */

(function (exports) {
  // ── Matisse palette ──────────────────────────────────────────────────────
  const PALETTE = [
    '#e63946',  // red
    '#f4d35e',  // yellow
    '#1d4e89',  // deep blue
    '#2a9d3f',  // green
    '#e07b29',  // orange (secondary accent)
  ];

  const OUTLINE_COLOR = '#0d1b2a';  // near-black ink
  const EYE_COLOR     = '#0d1b2a';

  // Blob logical render size (world units, independent of viewport scale)
  const LOGICAL_W = 56;
  const LOGICAL_H = 80;

  // ── Blob point generator ────────────────────────────────────────────────
  // Returns a closed bezier-friendly polygon of N radial points around (cx, cy)
  // with radii perturbed by the PRNG.
  function blobPoints(prng, cx, cy, baseRX, baseRY, numPts, jitter) {
    const pts = [];
    for (let i = 0; i < numPts; i++) {
      const angle = (i / numPts) * Math.PI * 2;
      const rx = baseRX * (1 + (prng.random() - 0.5) * jitter);
      const ry = baseRY * (1 + (prng.random() - 0.5) * jitter);
      pts.push({
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
      });
    }
    return pts;
  }

  // Draw a smooth closed blob path through the given points using cubic beziers
  function drawBlobPath(ctx, pts) {
    const n = pts.length;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];

      if (i === 0) {
        const midPrev = { x: (prev.x + curr.x) / 2, y: (prev.y + curr.y) / 2 };
        ctx.moveTo(midPrev.x, midPrev.y);
      }

      const midCurr = { x: (curr.x + next.x) / 2, y: (curr.y + next.y) / 2 };
      ctx.quadraticCurveTo(curr.x, curr.y, midCurr.x, midCurr.y);
    }
    ctx.closePath();
  }

  // ── render(seed) → { canvas, canvasFlipped, color, headHeight } ──────────
  function render(seed) {
    const prng  = Prng(seed);
    const color = prng.pick(PALETTE);

    // ── Body ────────────────────────────────────────────────────────────────
    const bodyCX = LOGICAL_W / 2;
    const bodyCY = LOGICAL_H * 0.68;
    const bodyRX = LOGICAL_W * 0.36;
    const bodyRY = LOGICAL_H * 0.28;

    // ── Head ────────────────────────────────────────────────────────────────
    const headCX = LOGICAL_W / 2;
    const headCY = LOGICAL_H * 0.28;
    const headRX = LOGICAL_W * 0.28;
    const headRY = LOGICAL_H * 0.24;

    // Number of control points
    const numBody = prng.range(6, 9);
    const numHead = prng.range(6, 8);

    const bodyPts = blobPoints(prng, bodyCX, bodyCY, bodyRX, bodyRY, numBody, 0.35);
    const headPts = blobPoints(prng, headCX, headCY, headRX, headRY, numHead, 0.28);

    // Eye treatment: 0 = two dots, 1 = single arc
    const eyeStyle = prng.range(0, 1);

    // ── Draw to off-screen canvas ────────────────────────────────────────────
    function drawBlob(ctx) {
      ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

      // Body
      drawBlobPath(ctx, bodyPts);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.stroke();

      // Head (slightly lighter/same color, Matisse monochromatic)
      drawBlobPath(ctx, headPts);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.stroke();

      // Eyes
      ctx.fillStyle = EYE_COLOR;
      if (eyeStyle === 0) {
        // Two dot eyes
        const eyeY = headCY - headRY * 0.1;
        const eyeOff = headRX * 0.38;
        const eyeR  = LOGICAL_W * 0.04;
        ctx.beginPath(); ctx.arc(headCX - eyeOff, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(headCX + eyeOff, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
      } else {
        // Single curved Matisse line
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = EYE_COLOR;
        ctx.arc(headCX, headCY - headRY * 0.05, headRX * 0.38, Math.PI + 0.2, -0.2, false);
        ctx.stroke();
      }
    }

    // Normal-facing canvas
    const canvas = document.createElement('canvas');
    canvas.width  = LOGICAL_W;
    canvas.height = LOGICAL_H;
    const ctx = canvas.getContext('2d');
    drawBlob(ctx);

    // Flipped (facing-left) canvas
    const canvasFlipped = document.createElement('canvas');
    canvasFlipped.width  = LOGICAL_W;
    canvasFlipped.height = LOGICAL_H;
    const ctxF = canvasFlipped.getContext('2d');
    ctxF.translate(LOGICAL_W, 0);
    ctxF.scale(-1, 1);
    drawBlob(ctxF);

    // headHeight: top of head to bottom of head (for bubble positioning)
    const headTop = headCY - headRY * 1.3;

    return { canvas, canvasFlipped, color, headTop };
  }

  // ── Blob module ──────────────────────────────────────────────────────────
  const BlobGen = {
    render,
    LOGICAL_W,
    LOGICAL_H,
  };

  if (typeof module !== 'undefined' && module.exports) {
    // Node env — canvas API not available; export constants only for ref
    module.exports = { LOGICAL_W, LOGICAL_H };
  } else {
    exports.BlobGen = BlobGen;
  }
}(typeof window !== 'undefined' ? window : {}));
