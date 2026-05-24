// input.js — keyboard input, movement, boundary clamping, walk animation
// Exports a single `Input` object consumed by game.js each rAF tick.

const Input = (function () {
  const SPEED      = 2;     // pixels per frame at 60fps
  const WALK_CYCLE = 400;   // ms for a full walk cycle
  const ROOM_INSET = 16;    // wall width — matches renderer wall thickness

  // ── State ─────────────────────────────────────────────────
  const keysHeld  = new Set();
  let   posX      = 400;
  let   posY      = 300;
  let   lastDx    = 0;
  let   lastDy    = 0;
  let   facingLeft = false;
  let   walkTimer  = 0;
  let   isMoving   = false;

  // Boundaries computed lazily from canvas size (set in game.js)
  function bounds() {
    const cw = window._canvasW || 800;
    const ch = window._canvasH || 600;
    return {
      minX: ROOM_INSET,
      minY: ROOM_INSET,
      maxX: cw - ROOM_INSET - SPRITE_W,
      maxY: ch - ROOM_INSET - SPRITE_H,
    };
  }

  // ── Mobile detection ──────────────────────────────────────
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isMobile) {
    // Show the mobile notice
    const notice = document.getElementById('mobile-notice');
    if (notice) notice.classList.remove('hidden');
  } else {
    // Register keyboard listeners only for desktop
    document.addEventListener('keydown', (e) => {
      // Focus guard: ignore movement keys while chat input is focused
      if (document.activeElement === document.getElementById('chat-input')) return;

      const key = e.key;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
           'w','a','s','d','W','A','S','D'].includes(key)) {
        e.preventDefault();
        keysHeld.add(normalise(key));
      }
    });

    document.addEventListener('keyup', (e) => {
      keysHeld.delete(normalise(e.key));
    });

    // Clear all keys if window loses focus (prevents stuck movement)
    window.addEventListener('blur', () => keysHeld.clear());
  }

  function normalise(key) {
    switch (key) {
      case 'ArrowUp':    case 'w': case 'W': return 'up';
      case 'ArrowDown':  case 's': case 'S': return 'down';
      case 'ArrowLeft':  case 'a': case 'A': return 'left';
      case 'ArrowRight': case 'd': case 'D': return 'right';
      default: return key;
    }
  }

  // ── Position emit throttle ────────────────────────────────
  let _lastEmitX = posX, _lastEmitY = posY;
  setInterval(() => {
    if (!window._socket || !window._localName) return;
    if (posX === _lastEmitX && posY === _lastEmitY && lastDx === 0 && lastDy === 0) return;
    _lastEmitX = posX;
    _lastEmitY = posY;
    window._socket.volatile.emit('player:move', {
      x: posX, y: posY, dx: lastDx, dy: lastDy,
    });
  }, 50);

  // ── Update — called each rAF tick ─────────────────────────
  function update(dt) {
    if (isMobile) {
      return { x: posX, y: posY, dx: 0, dy: 0, walkFrame: false, facingLeft };
    }

    let dx = 0, dy = 0;
    if (keysHeld.has('left'))  dx -= 1;
    if (keysHeld.has('right')) dx += 1;
    if (keysHeld.has('up'))    dy -= 1;
    if (keysHeld.has('down'))  dy += 1;

    isMoving = dx !== 0 || dy !== 0;

    if (isMoving) {
      const b = bounds();
      posX = Math.max(b.minX, Math.min(b.maxX, posX + dx * SPEED));
      posY = Math.max(b.minY, Math.min(b.maxY, posY + dy * SPEED));
      lastDx = dx;
      lastDy = dy;

      // Walk animation
      walkTimer = (walkTimer + dt) % WALK_CYCLE;

      // Direction for sprite facing
      if (dx < 0) facingLeft = true;
      else if (dx > 0) facingLeft = false;
    } else {
      lastDx = 0;
      lastDy = 0;
      walkTimer = 0;
    }

    const walkFrame = isMoving && walkTimer < WALK_CYCLE / 2;

    return { x: posX, y: posY, dx: lastDx, dy: lastDy, walkFrame, facingLeft };
  }

  // Called by game.js once spawn position is received from server
  function setPosition(x, y) {
    posX = x;
    posY = y;
    _lastEmitX = x;
    _lastEmitY = y;
  }

  return { update, setPosition };
}());
