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
3. Pick a character and type your name → **Enter →**
4. Walk around with **Arrow keys** or **WASD**
5. Chat in the panel on the right; your message appears as a speech bubble above your avatar for ~4 seconds

> **Mobile users:** Chat works but movement controls are keyboard-only — your avatar will appear at a fixed spot in the room.

---

## Architecture

```
local-chat/
├── .gitignore
├── package.json
├── server.js                  # Express + Socket.IO server, 20 Hz game loop
├── local-chat.service         # systemd unit
├── README.md
└── public/
    ├── index.html             # Single-page app shell
    ├── css/style.css          # All styles
    ├── js/
    │   ├── characters.js      # Sprite sheet config (6 characters)
    │   ├── entry.js           # Avatar selection + name entry
    │   ├── game.js            # Socket.IO client, rAF loop, lerp interpolation
    │   ├── renderer.js        # Canvas sprite + label drawing
    │   ├── input.js           # Keyboard input, movement, boundary clamp
    │   └── chat.js            # Chat panel + speech bubble overlay
    └── assets/
        └── characters.png     # Kenney Roguelike Characters (CC0)
```

**Real-time flow:** Socket.IO WebSocket → server game loop at 20 Hz broadcasts `game:state` to all clients → clients lerp-interpolate toward server positions each animation frame.

---

## Capacity

Designed for up to ~30 simultaneous visitors on a local network. Each `game:state` broadcast at 20 Hz is ~60 KB/s for 30 players — trivial on LAN.

---

## Credits

Character sprites: [Kenney Roguelike Characters](https://kenney.nl/assets/roguelike-characters) — CC0 / public domain
