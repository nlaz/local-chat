// server.test.js — light integration test for the new Socket.IO protocol
// Boots the express+socket.io app on an ephemeral port, connects two clients,
// verifies join → input → game:state flow.

const { test } = require('node:test');
const assert   = require('node:assert/strict');

// We need to import the server as a startable function.
// The server module exports { app, io, httpServer, start } to allow test teardown.
const { startServer } = require('../server.js');
const { io: ioClient } = require('socket.io-client');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function connectClient(url) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, { transports: ['websocket'] });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
    setTimeout(() => reject(new Error('connect timeout')), 3000);
  });
}

function waitFor(socket, event, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

test('server integration: two clients join, move, receive game:state', async (t) => {
  const { httpServer, io } = startServer(0);  // port 0 = OS-assigned

  await new Promise(resolve => httpServer.listen(0, resolve));
  const { port } = httpServer.address();
  const url = `http://localhost:${port}`;

  const s1 = await connectClient(url);
  const s2 = await connectClient(url);

  // ── Join ──────────────────────────────────────────────────────────────────
  const init1Promise = waitFor(s1, 'game:init');
  s1.emit('player:join', { name: 'Alice' });
  const init1 = await init1Promise;

  assert.ok(init1.selfId, 'game:init should have selfId');
  assert.ok(init1.players, 'game:init should have players');
  assert.ok(init1.players[init1.selfId], 'self should be in players');
  assert.equal(init1.players[init1.selfId].name, 'Alice');
  assert.ok(typeof init1.players[init1.selfId].seed === 'number', 'seed should be a number');
  assert.ok(init1.world, 'game:init should include world config');

  const init2Promise = waitFor(s2, 'game:init');
  s2.emit('player:join', { name: 'Bob' });
  const init2 = await init2Promise;
  assert.equal(init2.players[init2.selfId].name, 'Bob');

  // ── Input + game:state ───────────────────────────────────────────────────
  // Wait for at least one game:state broadcast
  const statePromise = waitFor(s1, 'game:state', 3000);
  s1.emit('player:input', { left: false, right: true, jump: false });
  const state = await statePromise;

  assert.ok(typeof state === 'object', 'game:state should be an object');

  // After emitting right, Alice should have moved or be moving
  // (at least her record exists in state)
  const aliceState = state[init1.selfId];
  assert.ok(aliceState, 'Alice should be in game:state');

  // ── Validation: duplicate name rejected ──────────────────────────────────
  const s3 = await connectClient(url);
  const errPromise = waitFor(s3, 'join:error', 1000);
  s3.emit('player:join', { name: 'Alice' });  // duplicate
  const err = await errPromise;
  assert.ok(err.message, 'duplicate name should produce join:error');

  // ── Seed determinism ─────────────────────────────────────────────────────
  // Same name → same seed. Connect a fresh client after Alice leaves.
  s1.disconnect();
  await delay(200);  // give server time to remove Alice

  const s4 = await connectClient(url);
  const init4Promise = waitFor(s4, 'game:init');
  s4.emit('player:join', { name: 'Alice' });
  const init4 = await init4Promise;

  assert.equal(
    init4.players[init4.selfId].seed,
    init1.players[init1.selfId].seed,
    'same name should produce same seed'
  );

  // ── Cleanup ───────────────────────────────────────────────────────────────
  s2.disconnect();
  s3.disconnect();
  s4.disconnect();
  io.close();
  await new Promise(resolve => httpServer.close(resolve));
});

test('server: rejects empty name', async (t) => {
  const { httpServer, io } = startServer(0);
  await new Promise(resolve => httpServer.listen(0, resolve));
  const { port } = httpServer.address();

  const s = await connectClient(`http://localhost:${port}`);
  const errPromise = waitFor(s, 'join:error', 1000);
  s.emit('player:join', { name: '' });
  const err = await errPromise;
  assert.ok(err.message);

  s.disconnect();
  io.close();
  await new Promise(resolve => httpServer.close(resolve));
});

test('server: rejects name over 20 chars', async (t) => {
  const { httpServer, io } = startServer(0);
  await new Promise(resolve => httpServer.listen(0, resolve));
  const { port } = httpServer.address();

  const s = await connectClient(`http://localhost:${port}`);
  const errPromise = waitFor(s, 'join:error', 1000);
  s.emit('player:join', { name: 'A'.repeat(21) });
  const err = await errPromise;
  assert.ok(err.message);

  s.disconnect();
  io.close();
  await new Promise(resolve => httpServer.close(resolve));
});
