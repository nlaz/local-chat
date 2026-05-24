// chat.js — chat panel (message log + input) and speech bubble overlay
// Initialized by game.js once the socket and local player ID are known.

const Chat = (function () {
  const BUBBLE_DURATION = 4000;   // ms

  let _socket       = null;
  let _localId      = null;
  let _renderState  = null;

  // DOM refs — populated in init()
  let chatLog, chatInput, sendBtn, bubbleLayer;

  // Active bubble elements keyed by player socket ID
  const activeBubbles = {};

  // ── Init ──────────────────────────────────────────────────
  function init(socket, localId, renderState) {
    _socket      = socket;
    _localId     = localId;
    _renderState = renderState;

    chatLog     = document.getElementById('chat-log');
    chatInput   = document.getElementById('chat-input');
    sendBtn     = document.getElementById('send-btn');
    bubbleLayer = document.getElementById('bubble-layer');

    // ── Send message ──────────────────────────────────────
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

    // ── Receive messages ──────────────────────────────────
    _socket.on('chat:message', ({ id, name, text }) => {
      appendToLog(name, text);

      // Show bubble — position comes from renderState at draw time
      const p = _renderState[id];
      const bx = p ? p.x : 0;
      const by = p ? p.y : 0;
      showBubble(id, text, bx, by);
    });
  }

  // ── Chat log ──────────────────────────────────────────────
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

  // ── Speech bubbles ────────────────────────────────────────
  function showBubble(playerId, text, x, y) {
    // Remove existing bubble for this player if present
    removeBubble(playerId);

    const div = document.createElement('div');
    div.className = 'speech-bubble';
    div.id        = 'bubble-' + playerId;
    div.textContent = text;

    // Initial position (will be updated every rAF via updateBubbles)
    positionBubble(div, x, y);

    bubbleLayer.appendChild(div);
    activeBubbles[playerId] = div;

    // Auto-remove after BUBBLE_DURATION
    const timer = setTimeout(() => {
      removeBubble(playerId);
    }, BUBBLE_DURATION);

    // Store timer so we can cancel if replaced early
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

  // ── Position a bubble above the player sprite ─────────────
  // The bubble's CSS uses transform: translateX(-50%), so `left` is the
  // horizontal centre of the sprite.
  function positionBubble(div, x, y) {
    const canvasEl = document.getElementById('game-canvas');
    if (!canvasEl) return;

    // Scale factor: use global (set by game.js scaleCanvas) with BCR fallback
    const S = window._canvasScale || (canvasEl.getBoundingClientRect().width / 800);

    // Offset of scaled canvas edge within the bubble-layer (handles pillarbox/letterbox)
    const canvasRect  = canvasEl.getBoundingClientRect();
    const layerRect   = document.getElementById('bubble-layer').getBoundingClientRect();
    const offsetX     = canvasRect.left - layerRect.left;
    const offsetY     = canvasRect.top  - layerRect.top;

    // Convert logical canvas coords → CSS pixels within scaled canvas
    div.style.left = (offsetX + x * S + (SPRITE_W / 2) * S) + 'px';
    div.style.top  = (offsetY + y * S - 14 * S) + 'px';
  }

  // ── Called each rAF by game.js to track moving players ────
  function updateBubbles(renderState) {
    for (const playerId in activeBubbles) {
      const div = activeBubbles[playerId];
      const p   = renderState[playerId];
      if (!p) { removeBubble(playerId); continue; }
      positionBubble(div, p.x, p.y);
    }
  }

  return { init, removeBubble, updateBubbles };
}());
