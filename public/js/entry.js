// entry.js — name entry screen (no avatar picker)
// Emits player:join {name} on confirm; blob is procedurally generated from name.

(function () {
  let hasJoined = false;

  const entryScreen  = document.getElementById('entry-screen');
  const gameScreen   = document.getElementById('game-screen');
  const nameInput    = document.getElementById('name-input');
  const enterBtn     = document.getElementById('enter-btn');
  const entryError   = document.getElementById('entry-error');
  const chatOverlay  = document.querySelector('.chat-overlay');
  const minimapCanvas = document.getElementById('minimap-canvas');

  // ── Validation ─────────────────────────────────────────────────────────────
  function trimmedName() {
    return nameInput.value.trim();
  }

  function updateEnterBtn() {
    enterBtn.disabled = trimmedName().length === 0;
  }

  nameInput.addEventListener('input', () => {
    updateEnterBtn();
    clearError();
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !enterBtn.disabled) confirmEntry();
  });

  enterBtn.addEventListener('click', confirmEntry);

  function clearError() {
    entryError.textContent = '';
  }

  function showError(msg) {
    entryError.textContent = msg;
  }

  function confirmEntry() {
    const name = trimmedName();
    if (!name) { showError('Please enter a display name.'); return; }
    if (name.length > 20) { showError('Name must be 20 characters or fewer.'); return; }

    entryScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    if (chatOverlay)   chatOverlay.classList.remove('hidden');
    if (minimapCanvas) minimapCanvas.classList.remove('hidden');
    clearError();

    window._localName = name;
    hasJoined = true;

    window._socket.emit('player:join', { name });
  }

  // ── Join error from server ─────────────────────────────────────────────────
  function handleJoinError(data) {
    gameScreen.classList.add('hidden');
    if (chatOverlay)   chatOverlay.classList.add('hidden');
    if (minimapCanvas) minimapCanvas.classList.add('hidden');
    entryScreen.classList.remove('hidden');
    showError(data.message || 'Could not join — please try again.');
    enterBtn.disabled = false;
  }

  window._entryHandleJoinError = handleJoinError;

  // ── Reconnect helper ───────────────────────────────────────────────────────
  window._reJoin = function () {
    if (hasJoined && window._localName) {
      window._socket.emit('player:join', { name: window._localName });
    }
  };
}());
