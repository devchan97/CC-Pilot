# CCPilot

**[한국어](README.ko.md)**

A kanban-based agent team management WebUI for controlling multiple Claude Code CLI instances from the browser.

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776ab?logo=python&logoColor=white)](https://python.org)
[![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)](https://github.com/devchan97/CC-Pilot)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/devchan97/CC-Pilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Design your agent team from a PRD or description — CCPilot spawns Claude Code instances and tracks them on a kanban board in real time.

![CCPilot Screenshot](public/logo.png)

---

## Prerequisites

Before running CCPilot, make sure **all three** of the following are set up.

### 1. Python 3.11+

Download from [python.org](https://www.python.org/downloads/) and verify:

```bash
python --version   # must be 3.11 or later
```

> **Windows**: During installation, check **"Add Python to PATH"**.

### 2. Node.js + Claude Code CLI

Claude Code CLI is distributed as an npm package and requires Node.js.

**Step 1 — Install Node.js 18+**

Download the LTS release from [nodejs.org](https://nodejs.org/).

```bash
node --version   # 18.x or later
npm --version
```

**Step 2 — Install Claude Code globally**

```bash
npm install -g @anthropic-ai/claude-code
```

Verify:

```bash
claude --version
```

> **Windows path note**: Claude Code installs to `%APPDATA%\npm\`. If `claude` is not found after install, add `%APPDATA%\npm` to your `PATH` environment variable.

### 3. Claude Code Authentication

CCPilot drives Claude Code as a subprocess and reuses its existing login — no separate API key setup needed.

Run Claude Code once to log in:

```bash
claude
```

Follow the prompts to log in with your Anthropic account. Credentials are stored in `~/.claude/` and reused automatically by CCPilot.

Verify it works:

```bash
claude -p "hello"
```

---

## Quick Start

```bash
git clone https://github.com/devchan97/CC-Pilot
cd CC-Pilot
python main.py
```

The browser opens automatically at `http://localhost:8080`.

```bash
# Custom port
python main.py --port 9000

# Open in system browser instead of native app window
python main.py --browser
```

> **Native app window** requires `pywebview`. If not installed, CCPilot automatically falls back to the system browser — no action needed.

---

## Platform Notes

### Windows

- Python: install from [python.org](https://www.python.org/downloads/) — check **"Add Python to PATH"**
- Node.js: install from [nodejs.org](https://nodejs.org/)
- After `npm install -g @anthropic-ai/claude-code`, add `%APPDATA%\npm` to PATH if `claude` is not found
- Run `python main.py` from Command Prompt or PowerShell (not double-click)

### macOS

```bash
brew install python node
npm install -g @anthropic-ai/claude-code
```

### Linux (Ubuntu/Debian)

```bash
sudo apt install python3 python3-pip nodejs npm
npm install -g @anthropic-ai/claude-code
```

---

## Features

- **Agent team planning** — Paste a PRD or upload a doc, Claude designs the team structure and spawns agents automatically
- **Multi-session kanban** — Manage multiple Claude Code instances as Backlog / In Progress / Done cards
- **Real-time streaming** — WebSocket-based output with `thinking`, `tool_use`, and token/cost tracking
- **Session persistence** — Sessions survive restarts via `--resume`, restored automatically on next launch
- **Built-in file explorer** — Browse and select working directories from the sidebar without leaving the UI
- **Zero dependencies** — Pure Python standard library, no pip required at runtime

---

## How It Works

```
Browser (WebUI)
     │  WebSocket / HTTP
     ▼
main.py  ──►  ccpilot/routes.py   (HTTP router)
              ccpilot/websocket.py (WS protocol)
              ccpilot/session.py   (Claude CLI subprocess)
              ccpilot/planning.py  (agent team design)
              ccpilot/projects.py  (project management)
                    │
                    ▼
              claude --resume <session-id>  (Claude Code CLI)
```

Each kanban card maps to one Claude Code subprocess. The server streams JSON output and forwards it to the browser over WebSocket in real time.

---

## Project Structure

```
ccpilot/
├── main.py              # Entry point
├── ccpilot/             # Backend package (stdlib only)
│   ├── utils.py         # Static file serving, path resolution, Claude discovery
│   ├── session.py       # Session lifecycle + SessionManager
│   ├── projects.py      # Project CRUD + persistence
│   ├── planning.py      # LLM-based agent team planning
│   ├── websocket.py     # RFC 6455 WebSocket implementation
│   └── routes.py        # Async HTTP router (18 endpoints)
└── public/              # Frontend (no build step)
    ├── index.html
    ├── js/              # constants · ws · home · lifecycle · modal · explorer
    └── css/             # base · home · lifecycle
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serve index.html |
| `GET` | `/static/*` | Static assets |
| `WS` | `/ws/{sid}` | WebSocket stream |
| `GET` | `/api/sessions` | List saved sessions |
| `POST` | `/api/sessions/restore` | Restore sessions |
| `POST` | `/api/session` | Create session |
| `DELETE` | `/api/session/{sid}` | Delete session |
| `POST` | `/api/session/{sid}/phase` | Move kanban phase |
| `POST` | `/api/session/{sid}/rename` | Rename task |
| `GET` | `/api/projects` | List projects |
| `POST` | `/api/projects` | Create project |
| `DELETE` | `/api/projects/{pid}` | Delete project |
| `POST` | `/api/plan/text` | Plan from text |
| `POST` | `/api/plan/file` | Plan from file upload |
| `POST` | `/api/plan/spawn` | Spawn agent team |
| `GET` | `/api/explorer?dir=` | List directory |
| `POST` | `/api/explorer/open` | Open in OS file explorer |

---

## Build (Executable)

Packages CCPilot as a standalone `.exe` using PyInstaller + pywebview (native app window).

```bash
pip install pyinstaller pywebview
pyinstaller CCPilot.spec
# Output: dist/CCPilot.exe
```

Pre-built binaries for Windows are available on the [Releases](https://github.com/devchan97/CC-Pilot/releases) page.

> The `.exe` bundles CCPilot itself. **Claude Code CLI and its authentication are still required** on the target machine (see Prerequisites above).

---

## Contributing

```bash
git clone https://github.com/devchan97/CC-Pilot
cd CC-Pilot
python main.py  # no install step needed
```

All backend code is under `ccpilot/`. Frontend is plain HTML/CSS/JS in `public/` — no bundler or build step required.

---

## License

MIT
