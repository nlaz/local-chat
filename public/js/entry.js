// entry.js — avatar selection screen + name validation
// Emits player:join {name, avatar} on confirm; spawn position is server-assigned.

(function () {
  // ── State ────────────────────────────────────────────────
  let selectedAvatar = null;   // CHARACTERS index
  let hasJoined      = false;  // set to true after first successful join

  // ── DOM refs ─────────────────────────────────────────────
  const entryScreen = document.getElementById('entry-screen');
  const gameScreen  = document.getElementById('game-screen');
  const avatarGrid  = document.getElementById('avatar-grid');
  const nameInput   = document.getElementById('name-input');
  const enterBtn    = document.getElementById('enter-btn');
  const entryError  = document.getElementById('entry-error');

  // ── Build avatar grid ─────────────────────────────────────
  // Each card renders the character's idle sprite via an offscreen canvas
  // so no external image element is needed for the preview.
  const sheet = new Image();
  sheet.src = '/assets/characters.png';

  sheet.addEventListener('load', () => {
    CHARACTERS.forEach((char, idx) => {
      const card = document.createElement('div');
      card.className = 'avatar-card';
      card.dataset.idx = idx;

      // Offscreen canvas → preview image
      const offscreen = document.createElement('canvas');
      offscreen.width  = char.frameW * SCALE;
      offscreen.height = char.frameH * SCALE;
      const octx = offscreen.getContext('2d');
      octx.imageSmoothingEnabled = false;
      octx.webkitImageSmoothingEnabled = false;
      octx.drawImage(
        sheet,
        char.sheetX, char.sheetY, char.frameW, char.frameH,
        0, 0, char.frameW * SCALE, char.frameH * SCALE
      );

      const img = document.createElement('img');
      img.className = 'avatar-preview';
      img.src = offscreen.toDataURL();
      img.alt = char.label;

      const label = document.createElement('span');
      label.className = 'avatar-label';
      label.textContent = char.label;

      card.appendChild(img);
      card.appendChild(label);
      card.addEventListener('click', () => selectAvatar(idx, card));

      avatarGrid.appendChild(card);
    });
  });

  function selectAvatar(idx, cardEl) {
    selectedAvatar = idx;
    document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    updateEnterBtn();
  }

  // ── Validation ────────────────────────────────────────────
  function trimmedName() {
    return nameInput.value.trim();
  }

  function updateEnterBtn() {
    const valid = selectedAvatar !== null && trimmedName().length > 0;
    enterBtn.disabled = !valid;
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
    if (selectedAvatar === null) { showError('Please select a character.'); return; }
    if (!name) { showError('Please enter a display name.'); return; }
    if (name.length > 20) { showError('Name must be 20 characters or fewer.'); return; }

    // Transition to game screen — server will assign spawn position
    entryScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    clearError();

    // Store for reconnect (game.js reads these)
    window._localName   = name;
    window._localAvatar = selectedAvatar;
    hasJoined = true;

    // Emit join (spawn position comes back in game:init)
    window._socket.emit('player:join', { name, avatar: selectedAvatar });
  }

  // ── Join error from server ────────────────────────────────
  // Handles server-side validation rejection (e.g., name too long, empty).
  function handleJoinError(data) {
    // Return to entry screen if we somehow slipped through
    gameScreen.classList.add('hidden');
    entryScreen.classList.remove('hidden');
    showError(data.message || 'Could not join — please try again.');
    enterBtn.disabled = false;
  }

  // Expose to game.js so it can wire up socket events
  window._entryHandleJoinError = handleJoinError;

  // ── Reconnect helper ──────────────────────────────────────
  // Called by game.js on Socket.IO 'connect' event after the first join.
  // Re-emits player:join so the server restores the player's session.
  window._reJoin = function () {
    if (hasJoined && window._localName != null && window._localAvatar != null) {
      window._socket.emit('player:join', {
        name:   window._localName,
        avatar: window._localAvatar,
      });
    }
  };
}());
