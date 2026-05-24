// server.js — Node.js + Socket.IO server
// Physics-authoritative: clients send input intents; server simulates at 60 Hz;
// broadcasts authoritative state at 20 Hz.

'use strict';

const express        = require('express');
const { createServer } = require('http');
const { Server }     = require('socket.io');
const path           = require('path');

const Physics = require('./public/js/physics.js');
const World   = require('./public/js/world.js');

// ── Config ──────────────────────────────────────────────────────
const PORT      = process.env.PORT || 80;
const TICK_HZ   = 60;
const TICK_MS   = 1000 / TICK_HZ;
const BROADCAST_EVERY = 3;  // broadcast every 3rd physics tick → 20 Hz
const MAX_CHAT  = 200;
const MAX_NAME  = 20;

// ── DJB2 name hash → 32-bit seed ────────────────────────────────
function hashName(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

// ── Spawn position (on the ground) ──────────────────────────────
function randomSpawn() {
  const margin = World.BLOB_W * 2;
  const x = Math.floor(Math.random() * (World.WORLD_W - margin * 2)) + margin;
  const y = World.GROUND_Y - World.BLOB_H;
  return { x, y };
}

// ── startServer — creates and returns server instances without listening ──────
// Called by index (below) with the configured PORT, and by tests with port 0.
function startServer(port) {
  const app        = express();
  const httpServer = createServer(app);
  const io         = new Server(httpServer, {
    pingTimeout:  8000,
    pingInterval: 3000,
  });

  app.use(express.static(path.join(__dirname, 'public')));

  // ── Game state ─────────────────────────────────────────────────
  // { [socket.id]: { id, name, seed, x, y, vx, vy, prevY, facingLeft,
  //                  stoodOn, inputLeft, inputRight, inputJump, jumpConsumed } }
  const players = {};

  // ── Socket events ──────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[connect]    ${socket.id}`);

    // player:join ────────────────────────────────────────────────
    socket.on('player:join', ({ name }) => {
      if (typeof name !== 'string' || !name.trim()) {
        socket.emit('join:error', { message: 'Name cannot be empty.' });
        return;
      }
      const trimmedName = name.trim();
      if (trimmedName.length > MAX_NAME) {
        socket.emit('join:error', { message: `Name must be ${MAX_NAME} characters or fewer.` });
        return;
      }

      // Reject duplicate active names
      const nameTaken = Object.values(players).some(
        p => p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== socket.id
      );
      if (nameTaken) {
        socket.emit('join:error', { message: 'That name is already taken.' });
        return;
      }

      // Re-join: remove stale entry for same socket (reconnect path)
      if (players[socket.id]) delete players[socket.id];

      const seed      = hashName(trimmedName);
      const { x, y } = randomSpawn();

      players[socket.id] = {
        id:          socket.id,
        name:        trimmedName,
        seed,
        x, y,
        vx:          0,
        vy:          0,
        prevY:       y,
        facingLeft:  false,
        stoodOn:     'ground',
        inputLeft:   false,
        inputRight:  false,
        inputJump:   false,
        jumpConsumed: false,
      };

      const player = players[socket.id];
      console.log(`[join]       ${socket.id} "${trimmedName}" seed=${seed} spawn=(${x},${y})`);

      // Send full state + selfId + world config to joiner
      socket.emit('game:init', {
        selfId:  socket.id,
        players: sanitizePlayers(players),
        world:   World,
      });

      // Notify everyone else
      socket.broadcast.emit('player:joined', sanitizePlayer(player));
    });

    // player:input ───────────────────────────────────────────────
    // Client sends this on change (max ~30 Hz, volatile ok)
    socket.on('player:input', ({ left, right, jump }) => {
      const p = players[socket.id];
      if (!p) return;
      p.inputLeft  = !!left;
      p.inputRight = !!right;
      p.inputJump  = !!jump;
    });

    // player:chat ────────────────────────────────────────────────
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

    // disconnect ─────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (players[socket.id]) {
        console.log(`[disconnect] ${socket.id} "${players[socket.id].name}"`);
        delete players[socket.id];
        io.emit('player:left', { id: socket.id });
      } else {
        console.log(`[disconnect] ${socket.id} (never joined)`);
      }
    });
  });

  // ── Physics + broadcast tick ───────────────────────────────────
  // 60 Hz physics, broadcast every 3rd tick (20 Hz)
  let tickCount = 0;
  let lastTick  = Date.now();
  let tickTimer = null;

  function buildInputs() {
    const inputs = {};
    for (const id in players) {
      const p = players[id];
      inputs[id] = {
        inputLeft:  p.inputLeft,
        inputRight: p.inputRight,
        inputJump:  p.inputJump,
      };
    }
    return inputs;
  }

  function tick() {
    const now   = Date.now();
    const delta = now - lastTick;

    if (delta >= TICK_MS - 1) {
      lastTick = now;
      const dt = Math.min(delta / 1000, 0.05);  // cap at 50ms to avoid spiral

      if (Object.keys(players).length > 0) {
        const inputs     = buildInputs();
        const nextPlayers = Physics.step(World, players, inputs, dt);

        // Copy physics results back into players
        for (const id in nextPlayers) {
          if (players[id]) Object.assign(players[id], nextPlayers[id]);
        }

        tickCount++;
        if (tickCount % BROADCAST_EVERY === 0) {
          io.volatile.emit('game:state', sanitizePlayers(players));
        }
      }
    }

    const drift = TICK_MS - (Date.now() - lastTick);
    if (drift > 2) {
      tickTimer = setTimeout(() => setImmediate(tick), drift - 1);
    } else {
      tickTimer = setImmediate(tick);
    }
  }

  // Start the tick loop only when the server starts listening
  // (allows tests to call startServer before listen without spurious ticks)
  httpServer.once('listening', () => {
    lastTick = Date.now();
    tickTimer = setImmediate(tick);
  });

  // Stop tick loop on close
  httpServer.once('close', () => {
    if (tickTimer) {
      clearTimeout(tickTimer);
      clearImmediate(tickTimer);
    }
  });

  return { app, httpServer, io };
}

// ── Sanitize — strip server-only input fields before broadcasting ──────────
function sanitizePlayer(p) {
  const { inputLeft, inputRight, inputJump, jumpConsumed, prevY, ...rest } = p;
  return rest;
}

function sanitizePlayers(players) {
  const out = {};
  for (const id in players) out[id] = sanitizePlayer(players[id]);
  return out;
}

// ── Export for tests ───────────────────────────────────────────────────────
module.exports = { startServer };

// ── Entry point ────────────────────────────────────────────────────────────
// Only bind port when run directly (not required by tests)
if (require.main === module) {
  const { httpServer } = startServer(PORT);

  httpServer.listen(PORT, () => {
    console.log(`local-chat running on port ${PORT}`);
    console.log(`Serving static files from ${path.join(__dirname, 'public')}`);
  });

  httpServer.on('error', (err) => {
    if (err.code === 'EACCES') {
      console.error(`Error: cannot bind port ${PORT} — run via systemd or set PORT > 1024`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}
