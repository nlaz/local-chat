// blob.js — procedural Matisse-style blob avatar generator
// Given a numeric seed, deterministically produces a pre-rendered off-screen
// canvas of a blob (head + body + arms + eyes + mouth) and a flipped copy.
//
// No Math.random() — all randomness comes through Prng(seed).
// Canvas dimensions: LOGICAL_W × LOGICAL_H (world units = hitbox size).
// Blobs are rendered at this exact size; renderer.js may scale up for display.

/* global Prng */

(function (exports) {
  // ── Matisse palette ──────────────────────────────────────────────────────
  const PALETTE = [
    '#e63946',  // red
    '#f4d35e',  // yellow
    '#1d4e89',  // deep blue
    '#2a9d3f',  // green
    '#e07b29',  // orange
  ];

  const OUTLINE_COLOR = '#0d1b2a';
  const EYE_COLOR     = '#0d1b2a';

  // Blob logical render size (world units — matches collision box)
  const LOGICAL_W = 56;
  const LOGICAL_H = 80;

  // ── Blob point generator ────────────────────────────────────────────────
  function blobPoints(prng, cx, cy, baseRX, baseRY, numPts, jitter) {
    const pts = [];
    for (let i = 0; i < numPts; i++) {
      const angle = (i / numPts) * Math.PI * 2;
      const rx = baseRX * (1 + (prng.random() - 0.5) * jitter);
      const ry = baseRY * (1 + (prng.random() - 0.5) * jitter);
      pts.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
    }
    return pts;
  }

  // Smooth closed bezier path through points
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

  // ── render(seed) → { canvas, canvasFlipped, color, headTop } ─────────────
  function render(seed) {
    const prng  = Prng(seed);
    const color = prng.pick(PALETTE);

    // ── Proportions — seeded variety ────────────────────────────────────────
    const headScale = 0.88 + prng.random() * 0.26;  // 0.88–1.14 (big-headed or petite)
    const bodyWide  = 0.90 + prng.random() * 0.20;  // 0.90–1.10 (wide vs slim body)

    // ── Head ────────────────────────────────────────────────────────────────
    const headCX = LOGICAL_W / 2;
    const headCY = LOGICAL_H * 0.27;
    const headRX = LOGICAL_W  * 0.30 * headScale;
    const headRY = LOGICAL_H  * 0.25 * headScale;

    // ── Body ────────────────────────────────────────────────────────────────
    const bodyCX = LOGICAL_W / 2;
    const bodyCY = LOGICAL_H * 0.67;
    const bodyRX = LOGICAL_W  * 0.34 * bodyWide;
    const bodyRY = LOGICAL_H  * 0.28;

    // ── Arms ─────────────────────────────────────────────────────────────────
    const armRX  = 7 + prng.range(0, 4);   // arm length semi-axis
    const armRY  = 4 + prng.range(0, 2);   // arm width semi-axis
    const armRot = 0.45 + prng.random() * 0.4;  // outward tilt

    const numBody = prng.range(6, 9);
    const numHead = prng.range(6, 8);
    const bodyPts = blobPoints(prng, bodyCX, bodyCY, bodyRX, bodyRY, numBody, 0.30);
    const headPts = blobPoints(prng, headCX, headCY, headRX, headRY, numHead, 0.22);

    // Eye + expression variety: 0=dots, 1=single arc, 2=dots+brows
    const eyeStyle = prng.range(0, 2);

    // ── Draw to off-screen canvas ────────────────────────────────────────────
    function drawBlob(ctx) {
      ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

      // ── Arms (behind body) ────────────────────────────────────────────────
      // Positioned where arms emerge from body sides; drawn first so body covers root
      const armY  = bodyCY - 4;
      const armXL = bodyCX - bodyRX * 0.82;
      const armXR = bodyCX + bodyRX * 0.82;

      ctx.fillStyle   = color;
      ctx.strokeStyle = OUTLINE_COLOR;

      ctx.save();
      ctx.translate(armXL, armY);
      ctx.rotate(-armRot);
      ctx.beginPath();
      ctx.ellipse(0, 0, armRX, armRY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(armXR, armY);
      ctx.rotate(armRot);
      ctx.beginPath();
      ctx.ellipse(0, 0, armRX, armRY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // ── Neck connector (fill only — bridges the head/body gap invisibly) ──
      const neckTopY = headCY + headRY * 0.62;
      const neckBotY = bodyCY - bodyRY * 0.55;
      const neckW    = Math.min(headRX, bodyRX) * 0.55;
      if (neckBotY > neckTopY) {
        ctx.fillStyle = color;
        ctx.fillRect(headCX - neckW, neckTopY - 1, neckW * 2, neckBotY - neckTopY + 2);
      }

      // ── Body ──────────────────────────────────────────────────────────────
      drawBlobPath(ctx, bodyPts);
      ctx.fillStyle   = color;
      ctx.fill();
      ctx.lineWidth   = 2.5;
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.stroke();

      // ── Head ──────────────────────────────────────────────────────────────
      drawBlobPath(ctx, headPts);
      ctx.fillStyle   = color;
      ctx.fill();
      ctx.lineWidth   = 2.5;
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.stroke();

      // ── Eyes ──────────────────────────────────────────────────────────────
      const eyeY   = headCY - headRY * 0.12;
      const eyeOff = headRX * 0.36;
      const eyeR   = LOGICAL_W * 0.057;   // noticeably bigger than before

      ctx.fillStyle   = EYE_COLOR;
      ctx.strokeStyle = EYE_COLOR;

      if (eyeStyle === 0) {
        // Two solid dot eyes
        ctx.beginPath(); ctx.arc(headCX - eyeOff, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(headCX + eyeOff, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();

      } else if (eyeStyle === 1) {
        // Single curved Matisse arc eye
        ctx.beginPath();
        ctx.lineWidth   = 2.5;
        ctx.strokeStyle = EYE_COLOR;
        ctx.arc(headCX, eyeY, headRX * 0.42, Math.PI + 0.25, -0.25, false);
        ctx.stroke();

      } else {
        // Dots + raised eyebrows (expressive look)
        ctx.beginPath(); ctx.arc(headCX - eyeOff, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(headCX + eyeOff, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth   = 2;
        ctx.strokeStyle = EYE_COLOR;
        // Left brow
        ctx.beginPath();
        ctx.moveTo(headCX - eyeOff - eyeR * 1.6, eyeY - eyeR * 2.8);
        ctx.quadraticCurveTo(headCX - eyeOff, eyeY - eyeR * 3.5, headCX - eyeOff + eyeR * 1.6, eyeY - eyeR * 2.8);
        ctx.stroke();
        // Right brow
        ctx.beginPath();
        ctx.moveTo(headCX + eyeOff - eyeR * 1.6, eyeY - eyeR * 2.8);
        ctx.quadraticCurveTo(headCX + eyeOff, eyeY - eyeR * 3.5, headCX + eyeOff + eyeR * 1.6, eyeY - eyeR * 2.8);
        ctx.stroke();
      }

      // ── Mouth — always a smile ─────────────────────────────────────────────
      ctx.beginPath();
      ctx.lineWidth   = 2;
      ctx.strokeStyle = EYE_COLOR;
      // Smile: arc in the lower half of the head
      ctx.arc(headCX, headCY + headRY * 0.28, headRX * 0.32, 0.25, Math.PI - 0.25, false);
      ctx.stroke();
    }

    // Normal-facing canvas
    const canvas = document.createElement('canvas');
    canvas.width  = LOGICAL_W;
    canvas.height = LOGICAL_H;
    drawBlob(canvas.getContext('2d'));

    // Flipped (facing-left) canvas
    const canvasFlipped = document.createElement('canvas');
    canvasFlipped.width  = LOGICAL_W;
    canvasFlipped.height = LOGICAL_H;
    const ctxF = canvasFlipped.getContext('2d');
    ctxF.translate(LOGICAL_W, 0);
    ctxF.scale(-1, 1);
    drawBlob(ctxF);

    const headTop = headCY - headRY * 1.3;
    return { canvas, canvasFlipped, color, headTop };
  }

  // ── Blob module ──────────────────────────────────────────────────────────
  const BlobGen = { render, LOGICAL_W, LOGICAL_H };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LOGICAL_W, LOGICAL_H };
  } else {
    exports.BlobGen = BlobGen;
  }
}(typeof window !== 'undefined' ? window : {}));
