// Character definitions for Break Room — code-drawn office workers.
//
// Each character is drawn programmatically into a 48×48 logical box (SPRITE_W × SPRITE_H).
// SCALE, SPRITE_W, and SPRITE_H are kept stable as the public API consumed by renderer.js,
// entry.js, chat.js (bubble centering), input.js (boundary clamp), minimap.js, and server.js.

const SCALE    = 3;    // "pixel" size: each character pixel is 3 canvas px
const SPRITE_W = 48;
const SPRITE_H = 48;

// ── Worker drawing ────────────────────────────────────────────
// Draws a suited office worker into a 48×48 logical box anchored at (x, y).
// walkFrame: when true, body/legs bounce down 2px for a subtle walk animation.
// facingLeft: when true, the worker is horizontally mirrored.
function drawOfficeWorker(ctx, x, y, blazerColor, walkFrame, facingLeft) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const bounce = walkFrame ? 2 : 0;

  ctx.save();
  if (facingLeft) {
    ctx.translate(rx + SPRITE_W, ry);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(rx, ry);
  }

  // Head — skin tone
  ctx.fillStyle = '#e8c8a8';
  ctx.beginPath();
  ctx.arc(24, 14, 9, 0, Math.PI * 2);
  ctx.fill();

  // Hair — dark strip across the top of the head
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.arc(24, 11, 9, Math.PI, 0);   // upper semicircle
  ctx.fill();
  ctx.fillRect(15, 8, 18, 4);

  // Eyes — two tiny dots
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(20, 14, 2, 2);
  ctx.fillRect(26, 14, 2, 2);

  // Neck shadow
  ctx.fillStyle = '#c9a888';
  ctx.fillRect(21, 22, 6, 3);

  // ── Body parts (shift down by `bounce` when walking) ──
  // Legs — dark grey
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(15, 42 + bounce, 18, 6 - bounce);
  // Shoes — black
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(13, 45 + bounce, 8, 3 - bounce);
  ctx.fillRect(27, 45 + bounce, 8, 3 - bounce);

  // Blazer body
  ctx.fillStyle = blazerColor;
  ctx.fillRect(12, 26 + bounce, 24, 16);

  // White shirt collar (V-notch above blazer)
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(20, 24 + bounce, 8, 4);
  ctx.fillRect(22, 28 + bounce, 4, 2);

  // Lapels — small lighter triangles on the blazer
  ctx.fillStyle = mixWithBlack(blazerColor, 0.25);
  ctx.fillRect(17, 26 + bounce, 3, 6);
  ctx.fillRect(28, 26 + bounce, 3, 6);

  // Tie — 4px wide vertical strip from collar down
  ctx.fillStyle = pickTieColor(blazerColor);
  ctx.fillRect(22, 30 + bounce, 4, 10);

  // Arms — same color as blazer, on either side
  ctx.fillStyle = blazerColor;
  ctx.fillRect(9,  28 + bounce, 4, 12);
  ctx.fillRect(35, 28 + bounce, 4, 12);
  // Hands
  ctx.fillStyle = '#e8c8a8';
  ctx.fillRect(9,  40 + bounce, 4, 3);
  ctx.fillRect(35, 40 + bounce, 4, 3);

  ctx.restore();
}

// Darken a hex color by `amount` (0..1).
function mixWithBlack(hex, amount) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const f = 1 - amount;
  const nr = Math.round(r * f);
  const ng = Math.round(g * f);
  const nb = Math.round(b * f);
  return 'rgb(' + nr + ',' + ng + ',' + nb + ')';
}

// Pick a contrasting tie color for each blazer.
function pickTieColor(blazerColor) {
  // Map known blazer colors to ties; fall back to a darker tone.
  const map = {
    '#2a3f6f': '#9b1c1c',   // navy → red tie
    '#6a6a72': '#1f3a5f',   // slate → blue tie
    '#b5a882': '#3a2a1a',   // beige → brown tie
    '#8b4a3c': '#1f2a44',   // rust → navy tie
    '#3a7a7a': '#f4d35e',   // teal → mustard tie
    '#6a3a5a': '#d0d0d0',   // burgundy → silver tie
  };
  return map[blazerColor] || mixWithBlack(blazerColor, 0.5);
}

// ── Character roster ─────────────────────────────────────────
// Order is fixed: server validates avatar index 0..5.
const CHARACTERS = [
  { id: 0, label: 'Intern',     blazerColor: '#2a3f6f' },
  { id: 1, label: 'Analyst',    blazerColor: '#6a6a72' },
  { id: 2, label: 'Manager',    blazerColor: '#b5a882' },
  { id: 3, label: 'Contractor', blazerColor: '#8b4a3c' },
  { id: 4, label: 'Director',   blazerColor: '#3a7a7a' },
  { id: 5, label: 'Consultant', blazerColor: '#6a3a5a' },
];

// Attach a draw method to each character so renderer.js and entry.js call a uniform API.
for (let i = 0; i < CHARACTERS.length; i++) {
  CHARACTERS[i].draw = (function (blazer) {
    return function (ctx, x, y, walkFrame, facingLeft) {
      drawOfficeWorker(ctx, x, y, blazer, walkFrame, facingLeft);
    };
  }(CHARACTERS[i].blazerColor));
}
