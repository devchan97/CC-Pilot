# Changelog

All notable changes to CCPilot are documented here.

---

## [v1.1.2] - 2026-03-22

### Added
- **Message queue** — Messages sent while an agent is busy are queued and automatically flushed after the current response finishes. A badge on each card shows the queue depth; the detail modal shows a scrollable queue panel with per-item delete.
- **`/model` inline picker** — Type `/model` in any session input to open an inline model selector (Opus 4.6 / Sonnet 4.6 / Haiku 4.5). Type `/model <name>` to switch directly. Model change is persisted via the new `POST /api/session/{sid}/model` endpoint.
- `POST /api/session/{sid}/model` backend endpoint — updates `sess.model_arg`, broadcasts a `status` event, and saves to the database.

### Changed
- **WS reconnect on Done → In Progress** — reconnection now triggers whenever the WebSocket is closed or closing, not only when `isDoneRestored` was set. Prevents stale cards after manual phase moves.
- **Detail modal input always active** — `setInputBusy` no longer disables the textarea/send button; users can type and queue messages at any time while an agent is working.
- `/clear` response in detail modal now clears the chat DOM before appending the sys log entry (prevents duplicate clear notices).
- `sys_notice`, `tool_use`, `thinking`, `error`, `usage_limit` messages no longer directly append to `detail-chat`; the unified `pushLog` + `renderLogEntry` path handles all rendering.

### Fixed
- `_flushQueue` is now called after both `done` and `error` events so queued messages are not dropped on agent error.

### Files changed
- `ccpilot/routes.py` — `POST /api/session/{sid}/model` route
- `public/css/kanban.css` — `.task-queue-badge`, `.detail-queue`, `.queue-item`, `.queue-idx`, `.model-picker-*` styles
- `public/index.html` — `#detail-queue` element added inside detail modal
- `public/js/i18n.js` — `ws.queued`, `ws.queue_label` keys (EN + KO)
- `public/js/kanban.js` — `task-queue-badge` element in card HTML; improved WS reconnect logic
- `public/js/modal.js` — `_renderQueue()` call on modal open; input always enabled
- `public/js/ws.js` — `_msgQueues`, `_enqueue`, `_flushQueue`, `_renderQueue`, `_dequeue`; `_MODEL_LIST`, `_applyModel`, `_showModelPicker`; `/model` command handling; `setInputBusy` no longer disables input

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
