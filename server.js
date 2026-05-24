// local-chat server — Node.js + Socket.IO
// Runs the game state loop and relays real-time events between visitors.

const express  = require('express');
const { createServer } = require('http');
const { Server }       = require('socket.io');
const path     = require('path');

// ── Config ──────────────────────────────────────────────────
const PORT        = process.env.PORT || 80;
const WORLD_W     = 2400;  // logical world width
const WORLD_H     = 1800;  // logical world height
const WALL_INSET  = 16;
const SPRITE_W    = 48;    // 16px × 3 scale
const SPRITE_H    = 48;
const SPAWN_PAD   = 200;   // px inset from walls for spawn zone (centered cluster)
const TICK_HZ     = 20;
const TICK_MS     = 1000 / TICK_HZ;
const MAX_CHAT    = 200;
const MAX_NAME    = 20;

// Spawn zone — central area of the world so newcomers see other players
const SPAWN_MIN_X = Math.round(WORLD_W / 2 - SPAWN_PAD);
const SPAWN_MAX_X = Math.round(WORLD_W / 2 + SPAWN_PAD);
const SPAWN_MIN_Y = Math.round(WORLD_H / 2 - SPAWN_PAD);
const SPAWN_MAX_Y = Math.round(WORLD_H / 2 + SPAWN_PAD);

// ── Express + Socket.IO setup ────────────────────────────────
const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, {
  pingTimeout:  8000,
  pingInterval: 3000,
});

app.use(express.static(path.join(__dirname, 'public')));

// ── Game state ───────────────────────────────────────────────
// { [socket.id]: { id, name, avatar, x, y, dx, dy } }
const players = {};

function randomSpawn() {
  const x = Math.floor(Math.random() * (SPAWN_MAX_X - SPAWN_MIN_X + 1)) + SPAWN_MIN_X;
  const y = Math.floor(Math.random() * (SPAWN_MAX_Y - SPAWN_MIN_Y + 1)) + SPAWN_MIN_Y;
  return { x, y };
}

// ── Socket events ────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[connect]    ${socket.id}`);

  // player:join ──────────────────────────────────────────────
  socket.on('player:join', ({ name, avatar }) => {
    // Server-side validation
    if (typeof name !== 'string' || !name.trim()) {
      socket.emit('join:error', { message: 'Name cannot be empty.' });
      return;
    }
    if (name.trim().length > MAX_NAME) {
      socket.emit('join:error', { message: `Name must be ${MAX_NAME} characters or fewer.` });
      return;
    }
    if (typeof avatar !== 'number' || avatar < 0 || avatar > 5) {
      socket.emit('join:error', { message: 'Invalid avatar selection.' });
      return;
    }

    const trimmedName = name.trim();
    const { x, y } = randomSpawn();

    // Re-join: remove stale entry for same socket (reconnect path)
    if (players[socket.id]) delete players[socket.id];

    players[socket.id] = {
      id:     socket.id,
      name:   trimmedName,
      avatar: avatar,
      x, y,
      dx: 0,
      dy: 0,
    };

    const player = players[socket.id];
    console.log(`[join]       ${socket.id} "${trimmedName}" avatar=${avatar} spawn=(${x},${y})`);

    // Send full state + selfId + spawn coords to the joiner
    socket.emit('game:init', {
      selfId:  socket.id,
      players: { ...players },
    });

    // Notify everyone else
    socket.broadcast.emit('player:joined', player);
  });

  // player:move ──────────────────────────────────────────────
  // Volatile from client; just update server state.
  // game:state broadcast at 20 Hz carries the updated position to all clients.
  socket.on('player:move', ({ x, y, dx, dy }) => {
    const p = players[socket.id];
    if (!p) return;   // not joined yet

    // Clamp to world bounds (server-authoritative safety)
    p.x  = Math.max(WALL_INSET, Math.min(WORLD_W - WALL_INSET - SPRITE_W, Number(x) || p.x));
    p.y  = Math.max(WALL_INSET, Math.min(WORLD_H - WALL_INSET - SPRITE_H, Number(y) || p.y));
    p.dx = Number(dx) || 0;
    p.dy = Number(dy) || 0;
  });

  // player:chat ──────────────────────────────────────────────
  socket.on('player:chat', ({ text }) => {
    const p = players[socket.id];
    if (!p) return;

    const clean = String(text || '').trim().slice(0, MAX_CHAT);
    if (!clean) return;

    io.emit('chat:message', {
      id:   socket.id,
      name: p.name,
      text: clean,
      ts:   Date.now(),
    });
  });

  // disconnect ───────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (players[socket.id]) {
      console.log(`[disconnect] ${socket.id} "${players[socket.id].name}"`);
      delete players[socket.id];
      // Only broadcast player:left for sockets that had actually joined
      io.emit('player:left', { id: socket.id });
    } else {
      console.log(`[disconnect] ${socket.id} (never joined)`);
    }
  });
});

// ── 20 Hz game tick ──────────────────────────────────────────
// Hybrid setTimeout / setImmediate for accurate timing.
let lastTick = Date.now();

function tick() {
  const now   = Date.now();
  const delta = now - lastTick;

  if (delta >= TICK_MS - 1) {
    lastTick = now;
    if (Object.keys(players).length > 0) {
      io.volatile.emit('game:state', { ...players });
    }
  }

  const drift = TICK_MS - (Date.now() - lastTick);
  if (drift > 2) {
    setTimeout(() => setImmediate(tick), drift - 1);
  } else {
    setImmediate(tick);
  }
}
setImmediate(tick);

// ── Start ────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`local-chat running on port ${PORT}`);
  console.log(`Serving static files from ${path.join(__dirname, 'public')}`);
});

httpServer.on('error', (err) => {
  if (err.code === 'EACCES') {
    console.error(`Error: cannot bind port ${PORT} — run via systemd (AmbientCapabilities=CAP_NET_BIND_SERVICE) or set PORT to a value > 1024`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
