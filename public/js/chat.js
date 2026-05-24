// chat.js — chat panel (message log + input) and speech bubble overlay
// Initialized by game.js once the socket and local player ID are known.
// Bubble positioning accounts for camera offset and blob logical size.

/* global World, BlobGen */

const Chat = (function () {
  const BUBBLE_DURATION = 4000;   // ms

  let _socket      = null;
  let _localId     = null;
  let _renderState = null;

  let chatLog, chatInput, sendBtn, bubbleLayer;

  const activeBubbles = {};

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(socket, localId, renderState) {
    _socket      = socket;
    _localId     = localId;
    _renderState = renderState;

    chatLog     = document.getElementById('chat-log');
    chatInput   = document.getElementById('chat-input');
    sendBtn     = document.getElementById('send-btn');
    bubbleLayer = document.getElementById('bubble-layer');

    function sendMessage() {
      const text = chatInput.value.trim();
      if (!text) return;
      _socket.emit('player:chat', { text });
      chatInput.value = '';
    }

    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });
    sendBtn.addEventListener('click', sendMessage);

    _socket.on('chat:message', ({ id, name, text }) => {
      appendToLog(name, text);
      const p  = _renderState[id];
      const bx = p ? p.x : 0;
      const by = p ? p.y : 0;
      showBubble(id, text, bx, by);
    });
  }

  // ── Chat log ──────────────────────────────────────────────────────────────
  function appendToLog(name, text) {
    const p = document.createElement('p');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'msg-name';
    nameSpan.textContent = name;

    p.appendChild(nameSpan);
    p.appendChild(document.createTextNode(': ' + text));

    chatLog.appendChild(p);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // ── Speech bubbles ────────────────────────────────────────────────────────
  function showBubble(playerId, text, x, y) {
    removeBubble(playerId);

    const div = document.createElement('div');
    div.className  = 'speech-bubble';
    div.id         = 'bubble-' + playerId;
    div.textContent = text;

    positionBubble(div, x, y);
    bubbleLayer.appendChild(div);
    activeBubbles[playerId] = div;

    const timer = setTimeout(() => removeBubble(playerId), BUBBLE_DURATION);
    div._timer = timer;
  }

  function removeBubble(playerId) {
    const existing = activeBubbles[playerId];
    if (existing) {
      clearTimeout(existing._timer);
      existing.remove();
      delete activeBubbles[playerId];
    }
  }

  // ── Position bubble above player blob, accounting for camera ──────────────
  // cameraX and canvasW are pulled from globals set by game.js.
  function positionBubble(div, worldX, worldY) {
    const canvasEl = document.getElementById('game-canvas');
    if (!canvasEl) return;

    const canvasW  = canvasEl.width  || window.innerWidth;
    const canvasH  = canvasEl.height || window.innerHeight;
    const cameraX  = window._cameraX || 0;
    const scale    = canvasW / (World.VIEWPORT_W || 800);

    const blobW    = (BlobGen && BlobGen.LOGICAL_W) || 56;
    const blobH    = (BlobGen && BlobGen.LOGICAL_H) || 80;

    // Convert world coords to screen coords
    const screenX  = (worldX - cameraX + blobW / 2) * scale;
    const screenY  = (worldY - 14) * scale;  // 14px above blob top

    // Bubble-layer sits at the same position as the canvas-wrapper
    const layerRect  = bubbleLayer.getBoundingClientRect();
    const canvasRect = canvasEl.getBoundingClientRect();
    const offsetX    = canvasRect.left - layerRect.left;
    const offsetY    = canvasRect.top  - layerRect.top;

    div.style.left = (offsetX + screenX) + 'px';
    div.style.top  = (offsetY + screenY) + 'px';
  }

  // ── Called each rAF by game.js ────────────────────────────────────────────
  function updateBubbles(renderState, cameraX, canvasW) {
    for (const playerId in activeBubbles) {
      const div = activeBubbles[playerId];
      const p   = renderState[playerId];
      if (!p) { removeBubble(playerId); continue; }
      positionBubble(div, p.x, p.y);
    }
  }

  return { init, removeBubble, updateBubbles };
}());
