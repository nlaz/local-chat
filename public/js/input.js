// input.js — keyboard input, physics prediction for local player
// Emits player:input {left, right, jump} on change (max ~30 Hz via throttle).
// Runs Physics.step locally for responsive client-side prediction.
// game.js snap-corrects toward server state on large drift.

/* global World, Physics */

const Input = (function () {
  // ── State ─────────────────────────────────────────────────────────────────
  let posX        = 400;
  let posY        = World.GROUND_Y - World.BLOB_H;
  let vx          = 0;
  let vy          = 0;
  let stoodOn     = 'ground';
  let prevY       = posY;
  let facingLeft  = false;
  let jumpConsumed = false;

  // Current input booleans
  let iLeft  = false;
  let iRight = false;
  let iJump  = false;

  // Last emitted state (to avoid redundant emits)
  let lastLeft  = false;
  let lastRight = false;
  let lastJump  = false;

  // ── Mobile detection ──────────────────────────────────────────────────────
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isMobile) {
    const notice = document.getElementById('mobile-notice');
    if (notice) notice.classList.remove('hidden');
  } else {
    document.addEventListener('keydown', (e) => {
      if (document.activeElement === document.getElementById('chat-input')) return;
      const k = normalise(e.key);
      if (k === 'left')  { e.preventDefault(); iLeft  = true; }
      if (k === 'right') { e.preventDefault(); iRight = true; }
      if (k === 'jump')  { e.preventDefault(); iJump  = true; }
      emitIfChanged();
    });

    document.addEventListener('keyup', (e) => {
      const k = normalise(e.key);
      if (k === 'left')  iLeft  = false;
      if (k === 'right') iRight = false;
      if (k === 'jump')  { iJump = false; jumpConsumed = false; }
      emitIfChanged();
    });

    window.addEventListener('blur', () => {
      iLeft = iRight = iJump = false;
      emitIfChanged();
    });
  }

  function normalise(key) {
    switch (key) {
      case 'ArrowLeft':  case 'a': case 'A': return 'left';
      case 'ArrowRight': case 'd': case 'D': return 'right';
      case 'ArrowUp': case 'w': case 'W':
      case ' ': case 'Space':               return 'jump';
      default: return key;
    }
  }

  // ── Emit input to server when it changes ──────────────────────────────────
  function emitIfChanged() {
    if (iLeft === lastLeft && iRight === lastRight && iJump === lastJump) return;
    if (!window._socket || !window._localName) return;
    lastLeft  = iLeft;
    lastRight = iRight;
    lastJump  = iJump;
    window._socket.emit('player:input', {
      left:  iLeft,
      right: iRight,
      jump:  iJump,
    });
  }

  // ── update(dt) — called each rAF tick ────────────────────────────────────
  // Runs Physics.step for local player (prediction) and returns current state.
  function update(dt) {
    if (isMobile) {
      return { x: posX, y: posY, vx: 0, vy: 0, facingLeft };
    }

    // Build a minimal single-player world step
    const player = {
      id:          'local',
      x:           posX,
      y:           posY,
      vx,
      vy,
      prevY,
      facingLeft,
      stoodOn,
      inputLeft:   iLeft,
      inputRight:  iRight,
      inputJump:   iJump,
      jumpConsumed,
    };

    const result = Physics.step(World, { local: player }, { local: {
      inputLeft:  iLeft,
      inputRight: iRight,
      inputJump:  iJump,
    }}, dt);

    const next   = result.local;
    posX         = next.x;
    posY         = next.y;
    vx           = next.vx;
    vy           = next.vy;
    prevY        = player.y;
    facingLeft   = next.facingLeft;
    stoodOn      = next.stoodOn;
    jumpConsumed = next.jumpConsumed;

    return { x: posX, y: posY, vx, vy, facingLeft };
  }

  // ── setPosition — called by game.js when snap-correction occurs ───────────
  // Accepts server velocity and stoodOn so a snap doesn't destroy a jump in flight.
  function setPosition(x, y, newVy, newStoodOn) {
    posX    = x;
    posY    = y;
    prevY   = y;
    vx      = 0;
    vy      = (newVy      !== undefined) ? newVy      : 0;
    stoodOn = (newStoodOn !== undefined) ? newStoodOn : 'ground';
  }

  return { update, setPosition };
}());
