// game.js — main game loop, state manager, Socket.IO client
// Owns renderState (client-side lerp copy), drives rAF loop.
// Canvas fills the viewport; renderer draws the world with a camera that follows the local player.

(function () {
  const WORLD_W     = 2400;
  const WORLD_H     = 1800;
  const LERP_FACTOR = 0.2;

  // ── Canvas setup ──────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const ctx    = canvas.getContext('2d');

  // Expose world dimensions for other modules (input.js, minimap.js, chat.js).
  window._worldW = WORLD_W;
  window._worldH = WORLD_H;
  // Back-compat for any module still reading _canvasW/_canvasH — treat them as world dims now.
  window._canvasW = WORLD_W;
  window._canvasH = WORLD_H;

  // ── Canvas sizing — fills the viewport in CSS pixels ──────
  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    // ImageSmoothing resets when the buffer is resized — reapply.
    ctx.imageSmoothingEnabled       = false;
    ctx.webkitImageSmoothingEnabled = false;
    window._viewW = canvas.width;
    window._viewH = canvas.height;
  }
  resizeCanvas();

  let _resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(resizeCanvas, 100);
  });

  // ── Camera (top-left of view in world coords) ─────────────
  const camera = { x: 0, y: 0 };
  window._camera = camera;

  function updateCamera(target) {
    const viewW = canvas.width;
    const viewH = canvas.height;

    if (target) {
      camera.x = target.x + SPRITE_W / 2 - viewW / 2;
      camera.y = target.y + SPRITE_H / 2 - viewH / 2;
    }

    // Clamp camera to world bounds. If the view is bigger than the world,
    // center the world inside the view (negative camera offset).
    if (viewW >= WORLD_W) {
      camera.x = (WORLD_W - viewW) / 2;
    } else {
      camera.x = Math.max(0, Math.min(WORLD_W - viewW, camera.x));
    }
    if (viewH >= WORLD_H) {
      camera.y = (WORLD_H - viewH) / 2;
    } else {
      camera.y = Math.max(0, Math.min(WORLD_H - viewH, camera.y));
    }
  }

  // ── State ─────────────────────────────────────────────────
  let localId     = null;
  let serverState = {};
  let renderState = {};

  // ── Socket ────────────────────────────────────────────────
  const socket = io();
  window._socket = socket;

  socket.on('game:init', (data) => {
    localId = data.selfId;

    serverState = {};
    for (const id in data.players) {
      serverState[id] = Object.assign({}, data.players[id]);
    }
    renderState = {};
    for (const id in serverState) {
      renderState[id] = Object.assign({ walkFrame: false, facingLeft: false }, serverState[id]);
    }

    if (renderState[localId]) {
      Input.setPosition(renderState[localId].x, renderState[localId].y);
      updateCamera(renderState[localId]);
    }

    Chat.init(socket, localId, renderState);
    Minimap.init();
  });

  socket.on('player:joined', (player) => {
    serverState[player.id] = player;
    renderState[player.id] = renderState[player.id] ||
      Object.assign({ walkFrame: false, facingLeft: false }, player);
  });

  socket.on('game:state', (players) => {
    for (const id in players) {
      if (!serverState[id]) {
        serverState[id] = players[id];
        renderState[id] = Object.assign({ walkFrame: false, facingLeft: false }, players[id]);
      } else {
        Object.assign(serverState[id], players[id]);
      }
    }
    for (const id in serverState) {
      if (!players[id]) {
        delete serverState[id];
        delete renderState[id];
      }
    }
  });

  socket.on('player:left', ({ id }) => {
    delete serverState[id];
    delete renderState[id];
    Chat.removeBubble(id);
  });

  socket.on('join:error', (data) => {
    if (window._entryHandleJoinError) window._entryHandleJoinError(data);
  });

  socket.on('connect', () => {
    if (window._reJoin) window._reJoin();
  });

  // ── rAF loop ──────────────────────────────────────────────
  let lastTime = null;

  // Characters are code-drawn — no asset loading gate needed.
  requestAnimationFrame(loop);

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function loop(ts) {
    requestAnimationFrame(loop);

    const dt = lastTime ? Math.min(ts - lastTime, 100) : 16;
    lastTime = ts;

    // Update local player from Input
    if (localId && renderState[localId]) {
      const { x, y, dx, dy, walkFrame, facingLeft } = Input.update(dt);
      renderState[localId].x         = x;
      renderState[localId].y         = y;
      renderState[localId].dx        = dx;
      renderState[localId].dy        = dy;
      renderState[localId].walkFrame = walkFrame;
      renderState[localId].facingLeft = facingLeft;
    }

    // Lerp other players
    for (const id in renderState) {
      if (id === localId) continue;
      const rs = renderState[id];
      const ss = serverState[id];
      if (!ss) continue;
      rs.x = lerp(rs.x, ss.x, LERP_FACTOR);
      rs.y = lerp(rs.y, ss.y, LERP_FACTOR);
      rs.dx = ss.dx;
      rs.dy = ss.dy;

      const moving = Math.abs(ss.dx) > 0.5 || Math.abs(ss.dy) > 0.5;
      if (moving) {
        rs._walkTimer = (rs._walkTimer || 0) + dt;
        if (rs._walkTimer > 400) rs._walkTimer = 0;
        rs.walkFrame = rs._walkTimer < 200;
      } else {
        rs.walkFrame = false;
        rs._walkTimer = 0;
      }
      if (ss.dx < -0.5) rs.facingLeft = true;
      else if (ss.dx > 0.5) rs.facingLeft = false;
    }

    // Update camera to follow local player
    if (localId && renderState[localId]) {
      updateCamera(renderState[localId]);
    } else {
      updateCamera(null);
    }

    Chat.updateBubbles(renderState);

    // Draw — renderer is camera-aware
    Renderer.drawFrame(ctx, canvas.width, canvas.height, WORLD_W, WORLD_H, camera, renderState, localId);
    Minimap.draw(renderState, localId);
  }
}());
