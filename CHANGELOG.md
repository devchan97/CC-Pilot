# Changelog

All notable changes to CCPilot are documented here.

---

## [v1.1.1] - 2026-03-21

### Added
- **Home analysis loading modal** — Full-screen blur overlay with spinner shown while Claude analyzes the project. Includes a **Cancel** button that aborts the in-flight request via `AbortController`.
- **Spawn button gating** — "Approve & Spawn" button is disabled until **all prerequisite checkboxes** are checked. A safety guard inside `confirmSpawn()` prevents bypassing via keyboard.
- **Agent add / remove in Spawn modal** — `+ Add Agent` dashed button at the bottom of the agent list. Each agent card has a `✕` remove button. Input values are synced before re-rendering so no data is lost on add/remove.

### Changed
- `confirmSpawn()` now calls `_syncAgentInputs()` before building the payload, removing DOM dependency from the agents mapping loop.
- Prerequisite checkboxes now carry `onchange="_updateSpawnConfirmBtn()"` to reactively update button state.

### Files changed
- `public/css/kanban.css` — styles for loading overlay, add-agent button, remove button, disabled spawn button
- `public/index.html` — home analyzing overlay element, spawn-confirm-btn id, add-agent button
- `public/js/home.js` — `_showHomeAnalyzing()`, `AbortController` integration, cancel handler
- `public/js/i18n.js` — new keys: `spawn.analyzing_title/cancel`, `spawn.add_agent`, `spawn.remove_agent`, `spawn.prereq_uncheck`, `spawn.new_agent_*` (EN + KO)
- `public/js/modal.js` — `_agentCardHtml()`, `_syncAgentInputs()`, `spawnAddAgent()`, `spawnRemoveAgent()`, `_reRenderAgentList()`, `_updateSpawnConfirmBtn()`

---

## [v1.1.0] - 2026-03-xx

### Added
- Kanban board rename (lifecycle → kanban)
- i18n support (EN / KO toggle, localStorage persistence)
- Home screen mode selector: Plan / Refactor / Enhance
- `planning.py`, `refactoring.py`, `enhancement.py` lang parameter support
- File upload format validation (`CLAUDE_SUPPORTED_EXTS`)
- Spawn modal design file attachment (images + text docs)
- Custom scrollbars (4 px) across all scroll areas
- `--fullscreen` CLI flag
- `private_mode=False` for localStorage persistence across restarts
- Windows process tree kill (`taskkill /F /T /PID`) in `session.py`
- GET `/api/favicon.ico` route

---

## [v1.0.0] - 2026-03-xx

- Initial public release
