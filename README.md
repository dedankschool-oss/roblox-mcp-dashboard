# Nebula — Roblox MCP Dashboard

A drop-in redesigned control panel for [`roblox-executor-mcp`](https://github.com/notpoiu/roblox-mcp). Same backend, same API, a completely different face: a floating glass **dock**, a **bento** mission-control overview, six switchable **color themes**, a **⌘K command palette**, and a **demo mode** so it looks alive even with no client connected.

Three files. No build step. No dependencies.

```
index.html   ·   styles.css   ·   app.js
```

---

## Features

### Layout
- **Floating dock rail** that expands on hover — replaces the static sidebar with an icon dock that grows to reveal labels.
- **Bento overview** — an asymmetric grid: a hero client card, a live uptime ring, four live stat tiles with sparklines, and a streaming log ticker.
- **Command bar** — global search button, live connection pill, palette dots, and a contrast toggle.
- **Fully responsive** — collapses to a single column on tablet and phone.

### Themes
Six palettes, switched instantly from the palette dots (command bar) or the **Settings → Theme** gallery. Choice is saved to `localStorage`.

| Theme  | Vibe                     |
|--------|--------------------------|
| Nebula | Violet / magenta (default) |
| Matrix | Emerald / cyan           |
| Cyber  | Cyan / indigo            |
| Solar  | Amber / rose             |
| Rose   | Rose / pink / purple     |
| Mono   | Neutral slate            |

Plus appearance toggles: **aurora background**, **film grain**, **reduce motion**, **compact density**, and a **high-contrast** mode.

### Command palette
`Ctrl / ⌘ + K` opens a fuzzy palette to jump between views, switch themes, or open a tool. Arrow keys + Enter, `Esc` to close.

### Live views
- **Overview** — hero card, animated uptime ring, live stats (clients, relay peers, script-sync %, semantic-index %), and a log ticker.
- **Server** — relay topology stats and a connected-clients table; click a client to select it.
- **Tools** — a runner for the server-side tools (`get-game-info`, `execute`, `get-data-by-code`, `script-grep`, `semantic-search`, `search-instances`, `get-descendants-tree`, `get-console-output`). Auto-built parameter forms, timing, and long-running job progress polling.
- **Scripts** — the decompiled script index with instant name filtering.
- **Logs** — the rolling server log with a live toggle and clear.
- **Settings** — appearance controls and a read-out of the active semantic-search provider.

### Demo mode
If `/api/status` isn't reachable (opened standalone, or the MCP isn't running), the dashboard falls back to realistic sample data and flags the connection pill as **Demo**. Every view stays populated, so the UI is presentable on its own.

---

## Setup

### Option A — drop-in replacement (recommended)

Point the MCP server at these files so the dashboard is served at `http://localhost:16384/`.

1. Clone this repo:
   ```bash
   git clone https://github.com/dedankschool-oss/roblox-mcp-dashboard.git
   ```
2. Copy the three files over the MCP's dashboard assets, renaming to match what the server serves:
   ```bash
   cp index.html  <mcp>/src/http/assets/dashboard/index.html
   cp styles.css  <mcp>/src/http/assets/dashboard/dashboard.css
   cp app.js      <mcp>/src/http/assets/dashboard/dashboard.js
   ```
   The MCP's `index.html` links `dashboard.css` and `dashboard.js`; this repo links `styles.css` and `app.js`. Either rename the files as above, or edit the two `<link>`/`<script>` references in `index.html` to keep the original names.
3. Rebuild and restart the MCP:
   ```bash
   npm run build
   ```
   `copy-assets` copies the dashboard into `dist/`; restart the server to pick it up.
4. Open `http://localhost:16384/`.

### Option B — standalone / demo

Serve the folder over any static host and open it. No MCP required — it runs in demo mode.

```bash
npx serve .
```

To hit a live MCP from a standalone host you must serve from the same origin as the API (`localhost:16384`), since the app calls same-origin `/api/*` paths; otherwise it stays in demo mode.

---

## API

The dashboard is a pure client of the MCP's existing HTTP API — it adds no endpoints of its own.

| Endpoint | Method | Used for |
|---|---|---|
| `/api/status` | GET | clients, uptime, relay peers, sync + index progress |
| `/api/server-logs?limit=` | GET | log stream |
| `/api/server-logs` | DELETE | clear logs |
| `/api/tool` | POST | dispatch a tool (`{ type, clientId, ...params }`) |
| `/api/tool-progress?id=` | GET | poll long-running jobs (semantic search) |
| `/api/scripts?clientId=` | GET | decompiled script index |
| `/api/semantic-settings` | GET | active embedding provider |
| `/api/avatar?userId=` | GET | client avatar thumbnail |

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl / ⌘ + K` | Open / close the command palette |
| `↑ ↓` | Move selection in the palette |
| `Enter` | Run the selected command |
| `Esc` | Close palette / dropdowns |

---

## Notes

- The redesign is client-only. It never touches the MCP bridge, the executor connector, or any tool logic — it only reads the same JSON the original dashboard reads.
- Theme and appearance preferences persist per browser via `localStorage`.
- Built for the `roblox-executor-mcp` API surface as of this writing; if the upstream API changes, the affected view degrades to empty rather than breaking the page.
