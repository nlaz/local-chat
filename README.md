# local-chat

A browser-based virtual hangout space for local-network events. Works at `http://chat.local` — no internet, no accounts, no installs needed for visitors.

---

## Prerequisites

- Raspberry Pi connected to your event WiFi
- Avahi daemon running (usually pre-installed on Raspberry Pi OS — `systemctl status avahi-daemon`)
- The Pi's hostname set to `chat` (check with `hostname`; set with `sudo raspi-config` → System Options → Hostname)
- Node.js 20 installed via nvm (see Installation)

---

## Installation

### 1. Install Node.js (first time only)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20
```

### 2. Install dependencies

```bash
cd /home/beezoo/local-chat
npm install
```

### 3. Install the systemd service

```bash
sudo cp local-chat.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable local-chat
sudo systemctl start local-chat
```

### 4. Verify it's running

```bash
systemctl status local-chat
curl http://localhost
```

---

## Accessing the Space

- **macOS / Linux / iOS / Android:** Open `http://chat.local` in any modern browser.
- **Windows:** Windows may need [Bonjour Print Services](https://support.apple.com/kb/DL999) for `.local` mDNS resolution. Alternatively, find the Pi's LAN IP (`hostname -I`) and use `http://192.168.x.x` directly.

---

## Service Management

```bash
# Start / stop / restart
sudo systemctl start local-chat
sudo systemctl stop local-chat
sudo systemctl restart local-chat

# View live logs
journalctl -u local-chat -f

# Check status
systemctl status local-chat
```

---

## After Code Changes

```bash
cd /home/beezoo/local-chat
# edit files ...
sudo systemctl restart local-chat
# Visitors' browsers will reconnect within a few seconds automatically
```

---

## Visitor Guide (quick summary)

1. Connect to the event WiFi
2. Open `http://chat.local` in a browser
3. Type your name → **Enter →** (your blob is generated from your name automatically)
4. Walk with **Arrow keys** or **WASD** · Jump with **↑ / W / Space**
5. Land on someone's head to stack; they'll carry you as they walk
6. Chat in the panel on the bottom-left; your message appears as a bubble above your blob for ~4 seconds

> **Mobile users:** Chat works, but movement and jumping require a keyboard — your blob will stay at spawn.

---

## Architecture

```
local-chat/
├── .gitignore
├── package.json
├── server.js                  # Express + Socket.IO, 60 Hz physics tick, 20 Hz broadcast
├── local-chat.service         # systemd unit
├── README.md
├── test/
│   ├── smoke.test.js          # node --test runner check
│   ├── physics.test.js        # 27 physics unit tests
│   └── server.test.js         # 3 integration tests
└── public/
    ├── index.html             # Single-page app shell
    ├── css/style.css          # Matisse palette — CSS variables, serif + ink
    └── js/
        ├── world.js           # Shared world constants (WORLD_W, platforms, physics)
        ├── physics.js         # Pure-function physics (dual-export Node + browser)
        ├── prng.js            # Seeded LCG for deterministic blob generation
        ├── blob.js            # Procedural Matisse blob avatar renderer
        ├── entry.js           # Name-only entry screen
        ├── game.js            # Socket.IO client, rAF loop, camera, prediction
        ├── renderer.js        # Matisse canvas renderer (blobs, platforms, cutouts)
        ├── input.js           # Keyboard → player:input intents
        ├── chat.js            # Chat panel + camera-aware speech bubbles
        └── minimap.js         # Scrolling-world minimap with camera rect
```

**Real-time flow:** Client emits `player:input` intents → server runs `physics.step` at 60 Hz → broadcasts `game:state` at 20 Hz → clients lerp remote players and run local prediction.

---

## Development

Server-side tests use Node 20's built-in test runner (no dependencies):

```bash
npm test
```

UI and visual behavior is verified manually in-browser.

---

## Capacity

Designed for up to ~30 simultaneous visitors on a local network. Each `game:state` broadcast at 20 Hz is ~60 KB/s for 30 players — trivial on LAN.

---

## Credits

Character sprites: [Kenney Roguelike Characters](https://kenney.nl/assets/roguelike-characters) — CC0 / public domain
