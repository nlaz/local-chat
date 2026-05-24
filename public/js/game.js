// game.js — main game loop, camera, Socket.IO client
// Owns renderState (client-side lerp copy), drives rAF loop.
// Canvas is sized to fill the window; camera follows local player.

/* global World, Renderer, Input, Chat, Minimap */

(function () {
  const LERP_FACTOR    = 0.18;
  const CAM_LERP       = 0.12;   // camera smoothing
  const SNAP_THRESHOLD = 80;     // world units — snap-correct if prediction drifts this far

  // ── Canvas setup (full-screen, resizes with window) ──────────────────────
  const canvas = document.getElementById('game-canvas');
  const ctx    = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    // Expose for bubble layer positioning
    window._canvasW = canvas.width;
    window._canvasH = canvas.height;
  }

  resizeCanvas();

  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(resizeCanvas, 16);
  });

  // ── State ─────────────────────────────────────────────────────────────────
  let localId     = null;
  let serverState = {};   // latest snapshot from server
  let renderState = {};   // interpolated copy used for drawing
  let cameraX     = 0;    // left edge of viewport in world coords

  // ── Socket ────────────────────────────────────────────────────────────────
  const socket    = io();
  window._socket  = socket;

  // ── Socket events ──────────────────────────────────────────────────────────
  socket.on('game:init', (data) => {
    localId = data.selfId;

    // Merge world config from server (same as World module but official)
    if (data.world) Object.assign(World, data.world);

    serverState = {};
    for (const id in data.players) {
      serverState[id] = Object.assign({}, data.players[id]);
    }
    renderState = {};
    for (const id in serverState) {
      renderState[id] = Object.assign({ walkTimer: 0 }, serverState[id]);
    }

    // Pre-render blobs for existing players
    for (const id in serverState) {
      Renderer.cacheBlob(id, serverState[id].seed);
    }

    // Seed local player position for Input
    if (serverState[localId]) {
      Input.setPosition(serverState[localId].x, serverState[localId].y);
      cameraX = clampCamera(serverState[localId].x);
    }

    Chat.init(socket, localId, renderState);
    Minimap.init();
  });

  socket.on('player:joined', (player) => {
    serverState[player.id] = player;
    renderState[player.id] = renderState[player.id] || Object.assign({ walkTimer: 0 }, player);
    Renderer.cacheBlob(player.id, player.seed);
  });

  socket.on('game:state', (players) => {
    for (const id in players) {
      if (!serverState[id]) {
        serverState[id] = players[id];
        renderState[id] = Object.assign({ walkTimer: 0 }, players[id]);
        Renderer.cacheBlob(id, players[id].seed);
      } else {
        // Snap-correct local player if prediction drifted too far
        if (id === localId) {
          const srv = players[id];
          const rnd = renderState[id];
          const dx  = srv.x - rnd.x;
          const dy  = srv.y - rnd.y;
          if (Math.sqrt(dx * dx + dy * dy) > SNAP_THRESHOLD) {
            renderState[id].x = srv.x;
            renderState[id].y = srv.y;
            Input.setPosition(srv.x, srv.y);
          }
        }
        Object.assign(serverState[id], players[id]);
      }
    }
    // Remove players no longer in state
    for (const id in serverState) {
      if (!players[id]) {
        delete serverState[id];
        delete renderState[id];
        Renderer.uncacheBlob(id);
        Chat.removeBubble(id);
      }
    }
  });

  socket.on('player:left', ({ id }) => {
    delete serverState[id];
    delete renderState[id];
    Renderer.uncacheBlob(id);
    Chat.removeBubble(id);
  });

  socket.on('join:error', (data) => {
    if (window._entryHandleJoinError) window._entryHandleJoinError(data);
  });

  socket.on('connect', () => {
    if (window._reJoin) window._reJoin();
  });

  // ── Camera ─────────────────────────────────────────────────────────────────
  function clampCamera(playerX) {
    const maxCam = World.WORLD_W - World.VIEWPORT_W;
    return Math.max(0, Math.min(maxCam, playerX - World.VIEWPORT_W / 2 + World.BLOB_W / 2));
  }

  // ── rAF loop ───────────────────────────────────────────────────────────────
  let lastTime = null;

  requestAnimationFrame(loop);

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function loop(ts) {
    requestAnimationFrame(loop);

    const dt = lastTime ? Math.min(ts - lastTime, 100) : 16;
    lastTime = ts;
    const dtS = dt / 1000;

    // ── Local player: run client-side prediction ─────────────────────────
    if (localId && renderState[localId]) {
      const { x, y, vx, vy, facingLeft } = Input.update(dtS);
      renderState[localId].x          = x;
      renderState[localId].y          = y;
      renderState[localId].vx         = vx;
      renderState[localId].vy         = vy;
      renderState[localId].facingLeft  = facingLeft;
    }

    // ── Lerp remote players ───────────────────────────────────────────────
    for (const id in renderState) {
      if (id === localId) continue;
      const rs = renderState[id];
      const ss = serverState[id];
      if (!ss) continue;

      rs.x = lerp(rs.x, ss.x, LERP_FACTOR);
      rs.y = lerp(rs.y, ss.y, LERP_FACTOR);
      rs.vx = ss.vx;
      rs.vy = ss.vy;
      rs.facingLeft = ss.facingLeft;
    }

    // ── Camera follow ─────────────────────────────────────────────────────
    if (localId && renderState[localId]) {
      const targetCamX = clampCamera(renderState[localId].x);
      cameraX = lerp(cameraX, targetCamX, CAM_LERP);
    }

    // ── Update bubble positions ───────────────────────────────────────────
    Chat.updateBubbles(renderState, cameraX, canvas.width);

    // ── Draw ──────────────────────────────────────────────────────────────
    Renderer.drawFrame(ctx, canvas.width, canvas.height, renderState, localId, cameraX);
    Minimap.draw(renderState, localId, cameraX);
  }

  // Expose camera and canvas info for chat.js bubble positioning
  Object.defineProperty(window, '_cameraX', { get: () => cameraX });

}());
