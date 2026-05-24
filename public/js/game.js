// game.js — main game loop, state manager, Socket.IO client
// Owns renderState (client-side lerp copy), drives rAF loop.

(function () {
  const CANVAS_W = 800;
  const CANVAS_H = 600;
  const LERP_FACTOR = 0.2;

  // ── Canvas setup ──────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const ctx    = canvas.getContext('2d');
  ctx.imageSmoothingEnabled        = false;
  ctx.webkitImageSmoothingEnabled  = false;

  // ── CSS scaling — keeps 800×600 logical coords, fills viewport ──
  function scaleCanvas() {
    const S = Math.min(window.innerWidth / 800, window.innerHeight / 600);
    canvas.style.transform = 'scale(' + S + ')';
    window._canvasScale = S;
  }

  // Apply immediately so canvas is scaled when #game-screen becomes visible
  scaleCanvas();

  // Debounced resize listener
  let _resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(scaleCanvas, 100);
  });

  // ── State ─────────────────────────────────────────────────
  let localId     = null;
  let serverState = {};   // latest snapshot from server
  let renderState = {};   // interpolated copy used for drawing

  // ── Socket ────────────────────────────────────────────────
  const socket = io();
  window._socket = socket;   // entry.js and chat.js read this

  // ── Socket events ─────────────────────────────────────────
  socket.on('game:init', (data) => {
    localId = data.selfId;

    // Seed both states from server snapshot
    serverState = {};
    for (const id in data.players) {
      serverState[id] = Object.assign({}, data.players[id]);
    }
    renderState = {};
    for (const id in serverState) {
      renderState[id] = Object.assign({ walkFrame: false, facingLeft: false }, serverState[id]);
    }

    // Bootstrap local player position from server-assigned spawn
    if (renderState[localId]) {
      Input.setPosition(renderState[localId].x, renderState[localId].y);
    }

    // Wire up chat after we know our ID
    Chat.init(socket, localId, renderState);

    // Initialise minimap canvas context
    Minimap.init();
  });

  socket.on('player:joined', (player) => {
    serverState[player.id] = player;
    renderState[player.id] = renderState[player.id] ||
      Object.assign({ walkFrame: false, facingLeft: false }, player);
  });

  socket.on('game:state', (players) => {
    // Merge server snapshot; preserve render-only fields
    for (const id in players) {
      if (!serverState[id]) {
        serverState[id] = players[id];
        renderState[id] = Object.assign({ walkFrame: false, facingLeft: false }, players[id]);
      } else {
        Object.assign(serverState[id], players[id]);
      }
    }
    // Remove players no longer in state
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

  // Re-join after reconnect (transport re-established by Socket.IO)
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

    // ── Update local player from Input ──────────────────────
    if (localId && renderState[localId]) {
      const { x, y, dx, dy, walkFrame, facingLeft } = Input.update(dt);
      renderState[localId].x         = x;
      renderState[localId].y         = y;
      renderState[localId].dx        = dx;
      renderState[localId].dy        = dy;
      renderState[localId].walkFrame = walkFrame;
      renderState[localId].facingLeft = facingLeft;
    }

    // ── Lerp other players ──────────────────────────────────
    for (const id in renderState) {
      if (id === localId) continue;
      const rs = renderState[id];
      const ss = serverState[id];
      if (!ss) continue;
      rs.x = lerp(rs.x, ss.x, LERP_FACTOR);
      rs.y = lerp(rs.y, ss.y, LERP_FACTOR);
      rs.dx = ss.dx;
      rs.dy = ss.dy;

      // Walk animation for remote players based on dx/dy
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

    // ── Update bubble positions ──────────────────────────────
    Chat.updateBubbles(renderState);

    // ── Draw ────────────────────────────────────────────────
    Renderer.drawFrame(ctx, CANVAS_W, CANVAS_H, renderState, localId);
    Minimap.draw(renderState, localId);
  }

  // Expose canvas dimensions for bubble positioning and minimap
  window._canvasW = CANVAS_W;
  window._canvasH = CANVAS_H;
}());
