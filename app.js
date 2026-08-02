(() => {
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const THEMES = [
  { id: "nebula", name: "Nebula", c: ["#8b7cf6", "#c471f5", "#6d7cf6"] },
  { id: "matrix", name: "Matrix", c: ["#34d399", "#22d3ee", "#4ade80"] },
  { id: "cyber", name: "Cyber", c: ["#22d3ee", "#38bdf8", "#818cf8"] },
  { id: "solar", name: "Solar", c: ["#fb923c", "#f43f5e", "#fbbf24"] },
  { id: "rose", name: "Rose", c: ["#fb7185", "#f472b6", "#c084fc"] },
  { id: "mono", name: "Mono", c: ["#cbd5e1", "#94a3b8", "#e2e8f0"] },
];

const store = {
  get(k, d) { try { const v = localStorage.getItem("rmcp." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("rmcp." + k, JSON.stringify(v)); } catch {} },
};

const root = document.documentElement;
function applyTheme(id) {
  root.dataset.theme = id;
  store.set("theme", id);
  $$(".pdot").forEach(d => d.classList.toggle("active", d.dataset.theme === id));
  $$(".theme-swatch").forEach(s => s.classList.toggle("active", s.dataset.theme === id));
}
function buildPalette() {
  const box = $("#paletteDots");
  const gallery = $("#themeGallery");
  THEMES.forEach(t => {
    const dot = el("button", "pdot");
    dot.dataset.theme = t.id;
    dot.title = t.name;
    dot.style.background = `linear-gradient(135deg,${t.c[0]},${t.c[1]})`;
    dot.onclick = () => applyTheme(t.id);
    box.appendChild(dot);

    const sw = el("div", "theme-swatch");
    sw.dataset.theme = t.id;
    sw.innerHTML = `<div class="theme-preview">${t.c.map(c => `<i style="background:${c}"></i>`).join("")}</div><div class="theme-name">${t.name}</div>`;
    sw.onclick = () => applyTheme(t.id);
    gallery.appendChild(sw);
  });
}

function bindToggle(id, key, cls, on, def) {
  const cb = $(id);
  const v = store.get(key, def);
  cb.checked = v;
  root.dataset[cls] = v ? on[0] : on[1];
  cb.onchange = () => { root.dataset[cls] = cb.checked ? on[0] : on[1]; store.set(key, cb.checked); };
}

const state = { data: null, mode: "connecting", selected: store.get("client", null), logs: [], logLive: true, history: { clients: [], relays: [] } };

const DEMO = {
  startedAt: Date.now() - 1000 * 60 * 47 - 1000 * 12,
  connected: true, clientCount: 1, role: "Primary", relayClients: 2,
  clients: [{
    clientId: "40da2e8b-aedd-419d-b4b6-a9fe70d697da",
    username: "B4Later", userId: 1284591037, placeId: 2753915549,
    jobId: "4a551f12-095a-482b-951d-7d8bc1c23de0", placeName: "[🐉] Blox Fruits", transport: "ws",
    scriptSync: { hasFinishedMapping: true, mappedSources: 812, processedSources: 812, skippedSources: 4, sourcesToMap: 816 },
    semanticIndex: { chunkCount: 4210, embeddedChunks: 3980 },
  }],
};
const DEMO_LOGS = [
  { time: Date.now() - 4000, level: "info", message: "WebSocket client connected: B4Later" },
  { time: Date.now() - 9000, level: "success", message: "Script mapping finished (812 sources)" },
  { time: Date.now() - 15000, level: "info", message: "Semantic index warm: 3980/4210 chunks" },
  { time: Date.now() - 21000, level: "warn", message: "Rate limit approaching on embedding provider" },
  { time: Date.now() - 30000, level: "info", message: "Tool dispatched: get-descendants-tree" },
  { time: Date.now() - 44000, level: "error", message: "Client 8f2a timed out after 15000ms" },
  { time: Date.now() - 61000, level: "info", message: "Relay peer joined (2 total)" },
];

async function api(path, opts) {
  const r = await fetch(path, opts);
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("json")) throw new Error("non-json");
  return r.json();
}

function setMode(m) {
  state.mode = m;
  const pill = $("#connPill"), txt = $("#connText");
  pill.classList.remove("online", "demo", "offline");
  if (m === "online") { pill.classList.add("online"); txt.textContent = `Online · ${state.data.clientCount} client${state.data.clientCount === 1 ? "" : "s"}`; }
  else if (m === "demo") { pill.classList.add("demo"); txt.textContent = "Demo data"; }
  else { pill.classList.add("offline"); txt.textContent = "Offline"; }
}

async function poll() {
  try {
    const d = await api("/api/status");
    state.data = d; setMode("online");
  } catch {
    if (!state.data || state.mode !== "demo") { state.data = DEMO; }
    setMode("demo");
  }
  const cs = state.data.clients || [];
  if (!state.selected || !cs.find(c => c.clientId === state.selected)) state.selected = cs[0] ? cs[0].clientId : null;
  pushHistory(state.data.clientCount || 0, state.data.relayClients || 0);
  render();
}

function pushHistory(cl, rl) {
  const h = state.history;
  h.clients.push(cl); h.relays.push(rl);
  if (h.clients.length > 24) h.clients.shift();
  if (h.relays.length > 24) h.relays.shift();
}

function client() { return (state.data && state.data.clients || []).find(c => c.clientId === state.selected) || null; }
function initials(n) { return (n || "?").slice(0, 2).toUpperCase(); }
function avatarUrl(uid) { return uid ? `/api/avatar?userId=${uid}` : null; }

function fmtUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor(s % 3600 / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${ss}`;
}

function sparkline(svg, arr, area) {
  if (!arr.length) { svg.innerHTML = ""; return; }
  const max = Math.max(1, ...arr), n = arr.length;
  const pts = arr.map((v, i) => [n === 1 ? 0 : i / (n - 1) * 100, 30 - v / max * 26 + 2]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const areaD = `${d} L100 32 L0 32 Z`;
  svg.innerHTML = (area ? `<path class="area" d="${areaD}"/>` : "") + `<path d="${d}"/>`;
}

let uptimeTimer = null;
function render() {
  const d = state.data, c = client();

  $("#statClients").textContent = d.clientCount || 0;
  $("#statRelays").textContent = d.relayClients || 0;
  sparkline($("#sparkClients"), state.history.clients, true);
  sparkline($("#sparkRelays"), state.history.relays, true);

  const chip = $("#chipName"), chipAv = $("#chipAvatar");
  if (c) {
    chip.textContent = c.username || "Client";
    setAvatar(chipAv, c);
    $("#heroName").textContent = c.username || "—";
    $("#heroPlace").textContent = c.placeName || "Unknown place";
    $("#heroTransport").textContent = (c.transport || "ws").toUpperCase();
    $("#heroUserId").textContent = c.userId ?? "—";
    $("#heroPlaceId").textContent = c.placeId ?? "—";
    $("#heroJobId").textContent = c.jobId || "—";
    $("#heroClientId").textContent = c.clientId || "—";
    setAvatar($("#heroAvatar"), c, true);

    const ss = c.scriptSync || {}, si = c.semanticIndex || {};
    const sp = ss.sourcesToMap ? Math.round((ss.processedSources || ss.mappedSources || 0) / ss.sourcesToMap * 100) : 0;
    const ip = si.chunkCount ? Math.round((si.embeddedChunks || 0) / si.chunkCount * 100) : 0;
    $("#statScripts").textContent = sp + "%";
    $("#statSemantic").textContent = ip + "%";
    $("#barScripts").style.width = sp + "%";
    $("#barSemantic").style.width = ip + "%";
  } else {
    chip.textContent = "No client"; chipAv.textContent = "";
    ["heroName", "heroUserId", "heroPlaceId", "heroJobId", "heroClientId"].forEach(k => $("#" + k).textContent = "—");
    $("#heroPlace").textContent = "Waiting for a client…";
    $("#heroTransport").textContent = "—"; $("#heroAvatar").textContent = "";
    $("#statScripts").textContent = "0%"; $("#statSemantic").textContent = "0%";
    $("#barScripts").style.width = "0%"; $("#barSemantic").style.width = "0%";
  }

  $("#srvStatus").textContent = d.connected ? "Connected" : "Idle";
  $("#srvClients").textContent = d.clientCount || 0;
  $("#srvRelays").textContent = d.relayClients || 0;
  $("#srvRole").textContent = d.role || "Primary";
  $("#srvClientCount").textContent = (d.clients || []).length;
  renderClientTable();

  const start = typeof d.startedAt === "number" ? d.startedAt : Date.parse(d.startedAt);
  if (uptimeTimer) clearInterval(uptimeTimer);
  const tick = () => {
    const ms = Date.now() - start;
    $("#uptimeClock").textContent = fmtUptime(ms);
    const frac = (ms / 1000 % 3600) / 3600;
    $("#uptimeRing").style.strokeDashoffset = String(327 - 327 * frac);
  };
  tick(); uptimeTimer = setInterval(tick, 1000);
}

function setAvatar(node, c, big) {
  const url = avatarUrl(c.userId);
  node.textContent = ""; node.innerHTML = "";
  if (url) {
    const img = new Image();
    img.onerror = () => { node.textContent = initials(c.username); };
    img.src = url; node.appendChild(img);
    node.dataset.fallback = initials(c.username);
  } else node.textContent = initials(c.username);
}

function renderClientTable() {
  const box = $("#srvClientTable");
  const cs = state.data.clients || [];
  box.innerHTML = "";
  if (!cs.length) { box.appendChild(el("div", "empty", "No clients connected")); return; }
  cs.forEach(c => {
    const row = el("div", "client-row");
    row.innerHTML = `<div class="cr-avatar">${initials(c.username)}</div>
      <div><div class="cr-name">${c.username || "Client"}</div><div class="cr-place">${c.placeName || "—"}</div></div>
      <div class="cr-tag">${(c.transport || "ws").toUpperCase()}</div>
      <div class="cr-tag">${String(c.clientId).slice(0, 8)}</div>`;
    row.onclick = () => { state.selected = c.clientId; store.set("client", c.clientId); render(); go("overview"); };
    box.appendChild(row);
  });
}

const TICKER_ICON = { info: "info", warn: "warn", error: "error", success: "success" };
function renderTicker() {
  const box = $("#tickerBody");
  box.innerHTML = "";
  const rows = (state.logs.length ? state.logs : DEMO_LOGS).slice(0, 6);
  rows.forEach(l => {
    const lvl = (l.level || "info").toLowerCase();
    const t = new Date(l.time || Date.now());
    const line = el("div", "ticker-line " + (TICKER_ICON[lvl] || "info"));
    line.innerHTML = `<time>${t.toLocaleTimeString([], { hour12: false })}</time><em>${lvl}</em><span>${escapeHtml(l.message || "")}</span>`;
    box.appendChild(line);
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])); }

async function pollLogs() {
  if (!state.logLive) return;
  try {
    const d = await api("/api/server-logs?limit=200");
    state.logs = (d.logs || []).slice().reverse();
    if (state.mode === "demo") state.logs = DEMO_LOGS;
  } catch { state.logs = DEMO_LOGS; }
  renderLogs(); renderTicker();
}
function renderLogs() {
  const box = $("#logsBody");
  box.innerHTML = "";
  const rows = state.logs.length ? state.logs : DEMO_LOGS;
  if (!rows.length) { box.appendChild(el("div", "empty", "No server logs yet")); return; }
  rows.forEach(l => {
    const lvl = (l.level || "info").toLowerCase();
    const t = new Date(l.time || Date.now());
    const row = el("div", "log-row");
    row.innerHTML = `<time>${t.toLocaleTimeString([], { hour12: false })}</time><span class="lvl ${TICKER_ICON[lvl] || "info"}">${lvl}</span><span class="msg">${escapeHtml(l.message || "")}</span>`;
    box.appendChild(row);
  });
}

const TOOLS = [
  { id: "get-game-info", name: "Game Info", icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>', desc: "Place and universe metadata for the active client.", fields: [{ k: "includeDescription", l: "Include description", t: "check", d: false }] },
  { id: "execute", name: "Execute", icon: '<polygon points="5 3 19 12 5 21 5 3"/>', desc: "Run Luau on the client. Fire-and-forget.", fields: [{ k: "code", l: "code", t: "area", ph: 'print("hello from Nebula")' }] },
  { id: "get-data-by-code", name: "Get Data by Code", icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>', desc: "Run Luau and return a compact value.", fields: [{ k: "code", l: "code", t: "area", ph: "return #game.Players:GetPlayers()" }, { k: "timeout", l: "timeout (ms)", t: "num", d: 15000 }] },
  { id: "script-grep", name: "Script Grep", icon: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>', desc: "Regex or literal search across decompiled sources.", fields: [{ k: "query", l: "query", t: "text", ph: "HasPermanent" }, { k: "literal", l: "literal", t: "check", d: false }, { k: "caseSensitive", l: "case sensitive", t: "check", d: true }, { k: "limit", l: "limit", t: "num", d: 10 }] },
  { id: "semantic-search", name: "Semantic Search", icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', desc: "Behavioural search over the semantic index.", fields: [{ k: "query", l: "query", t: "text", ph: "how does data saving work" }, { k: "limit", l: "limit", t: "num", d: 5 }] },
  { id: "search-instances", name: "Search Instances", icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>', desc: "Query the datamodel with a selector.", fields: [{ k: "selector", l: "selector", t: "text", ph: "ClassName=Part" }, { k: "root", l: "root", t: "text", d: "game" }, { k: "limit", l: "limit", t: "num", d: 20 }] },
  { id: "get-descendants-tree", name: "Descendants Tree", icon: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M15 6a9 9 0 0 0-9 9"/>', desc: "Walk the instance tree from a root.", fields: [{ k: "root", l: "root", t: "text", d: "game.Workspace" }, { k: "maxDepth", l: "max depth", t: "num", d: 2 }, { k: "maxChildren", l: "max children", t: "num", d: 20 }, { k: "summaryOnly", l: "summary only", t: "check", d: false }] },
  { id: "get-console-output", name: "Console Output", icon: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>', desc: "Recent client console lines.", fields: [{ k: "limit", l: "limit", t: "num", d: 10 }, { k: "filter", l: "filter", t: "text", ph: "optional substring" }] },
];
let activeTool = TOOLS[0].id;

function buildToolsRail() {
  const rail = $("#toolsRail");
  TOOLS.forEach(t => {
    const b = el("div", "tool-pick" + (t.id === activeTool ? " active" : ""));
    b.dataset.tool = t.id;
    b.innerHTML = `<svg viewBox="0 0 24 24">${t.icon}</svg><span>${t.name}</span>`;
    b.onclick = () => selectTool(t.id);
    rail.appendChild(b);
  });
}
function selectTool(id) {
  activeTool = id;
  $$(".tool-pick").forEach(p => p.classList.toggle("active", p.dataset.tool === id));
  const t = TOOLS.find(x => x.id === id);
  $("#toolName").textContent = t.name;
  $("#toolDesc").textContent = t.desc;
  const box = $("#toolParams"); box.innerHTML = "";
  t.fields.forEach(f => {
    const wrap = el("div", "field" + (f.t === "check" ? " field-check" : ""));
    if (f.t === "check") {
      wrap.innerHTML = `<span class="switch"><input type="checkbox" data-key="${f.k}" ${f.d ? "checked" : ""}><i></i></span><label>${f.l}</label>`;
    } else if (f.t === "area") {
      wrap.innerHTML = `<label>${f.l}</label><textarea data-key="${f.k}" placeholder="${f.ph || ""}">${f.d || ""}</textarea>`;
    } else {
      wrap.innerHTML = `<label>${f.l}</label><input data-key="${f.k}" type="${f.t === "num" ? "number" : "text"}" placeholder="${f.ph || ""}" value="${f.d ?? ""}">`;
    }
    box.appendChild(wrap);
  });
  $("#toolOutput").textContent = "Run a tool to see its output.";
  $("#toolStatus").textContent = ""; $("#toolStatus").className = ""; $("#toolTime").textContent = "";
}

function collectParams() {
  const p = {};
  $$("#toolParams [data-key]").forEach(n => {
    const k = n.dataset.key;
    if (n.type === "checkbox") p[k] = n.checked;
    else if (n.type === "number") { if (n.value !== "") p[k] = Number(n.value); }
    else if (n.value !== "") p[k] = n.value;
  });
  return p;
}

async function runTool() {
  const btn = $("#toolRun");
  const t0 = performance.now();
  const out = $("#toolOutput"), st = $("#toolStatus"), tm = $("#toolTime");
  btn.classList.add("busy"); out.textContent = "Running…"; st.textContent = ""; st.className = ""; tm.textContent = "";
  const body = Object.assign({ type: activeTool, clientId: state.selected }, collectParams());
  try {
    if (state.mode === "demo") {
      await new Promise(r => setTimeout(r, 380));
      out.textContent = demoResult(activeTool, body);
      st.textContent = "200 · demo"; st.className = "ok";
    } else {
      let d = await api("/api/tool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (d.jobId) d = await pollJob(d.jobId, out);
      if (d.error) { out.textContent = d.error; st.textContent = "error"; st.className = "err"; }
      else { out.textContent = d.result ?? JSON.stringify(d, null, 2); st.textContent = "200"; st.className = "ok"; }
    }
  } catch (e) {
    out.textContent = String(e && e.message || e); st.textContent = "failed"; st.className = "err";
  } finally {
    tm.textContent = Math.round(performance.now() - t0) + " ms";
    btn.classList.remove("busy");
  }
}

async function pollJob(id, out) {
  for (let i = 0; i < 300; i++) {
    const p = await api("/api/tool-progress?id=" + encodeURIComponent(id));
    if (p.status === "running" || p.state === "running") { out.textContent = p.message || "Working…"; await new Promise(r => setTimeout(r, 500)); continue; }
    if (p.error) return { error: p.error };
    return { result: p.result ?? p.message };
  }
  return { error: "Timed out waiting for job." };
}

function demoResult(id, body) {
  if (id === "get-game-info") return "PlaceId: 2753915549\nGameId: 994732206\nPlaceVersion: 1487\nName: [🐉] Blox Fruits";
  if (id === "script-grep") return `3 match(es) across 2 script(s)\n\n[ReplicatedStorage.Modules.Fruits] 2 match(es)\n\n> 41: function Fruit:HasPermanent(player)\n  42:     return self.owned[player.UserId] == true`;
  if (id === "get-console-output") return "[12:04:51] Loaded Blox Fruits client\n[12:04:52] Autofarm module ready\n[12:04:59] Remote fired: RequestGift";
  if (id === "get-descendants-tree") return "game.Workspace\n├─ Camera (Camera)\n├─ Terrain (Terrain)\n├─ _WorldOrigin (Folder) [12]\n└─ Characters (Folder) [8]";
  if (id === "execute") return "Code dispatched to client.";
  if (id === "get-data-by-code") return "8";
  if (id === "semantic-search") return "2 match(es) for \"" + (body.query || "") + "\"\n\n1. [DataService] lines 88-140 (function: SavePlayer; hybrid 0.8123)\nSummary: Serialises the player profile and writes to the datastore.";
  return "OK";
}

const VIEWS = ["overview", "server", "tools", "scripts", "logs", "settings"];
function go(view) {
  if (!VIEWS.includes(view)) return;
  $$(".view").forEach(v => v.classList.toggle("is-active", v.id === "view-" + view));
  $$(".dock-item").forEach(d => d.classList.toggle("is-active", d.dataset.view === view));
  if (view === "scripts") loadScripts();
  if (view === "settings") loadSemantic();
  if (view === "logs") renderLogs();
}

async function loadScripts() {
  const box = $("#scriptList"), cnt = $("#scriptCount");
  box.innerHTML = `<div class="empty">Loading…</div>`;
  let scripts = [];
  if (state.mode === "demo" || !state.selected) {
    scripts = [
      { path: "ReplicatedStorage.Modules.Fruits", lines: 512, bytes: 18422, debugId: "a1" },
      { path: "ReplicatedStorage.Remotes.Comm", lines: 88, bytes: 2104, debugId: "a2" },
      { path: "StarterPlayer.StarterPlayerScripts.Main", lines: 1340, bytes: 51233, debugId: "a3" },
      { path: "ServerScriptService.DataService", lines: 640, bytes: 22011, debugId: "a4" },
    ];
  } else {
    try { const d = await api("/api/scripts?clientId=" + encodeURIComponent(state.selected)); scripts = d.scripts || []; }
    catch { scripts = []; }
  }
  window.__scripts = scripts;
  paintScripts(scripts, "");
  cnt.textContent = scripts.length;
}
function paintScripts(scripts, q) {
  const box = $("#scriptList");
  const filtered = q ? scripts.filter(s => (s.path || "").toLowerCase().includes(q.toLowerCase())) : scripts;
  box.innerHTML = "";
  if (!filtered.length) { box.appendChild(el("div", "empty", "No scripts")); return; }
  filtered.slice(0, 400).forEach(s => {
    const row = el("div", "script-row");
    row.innerHTML = `<div class="sr-name">${escapeHtml(s.path || s.debugId)}</div><div class="sr-meta">${s.lines ?? "?"} ln</div><div class="sr-meta">${fmtBytes(s.bytes)}</div>`;
    row.onclick = () => toast("info", (s.path || s.debugId).split(".").pop());
    box.appendChild(row);
  });
}
function fmtBytes(b) { if (b == null) return "—"; if (b < 1024) return b + " B"; return (b / 1024).toFixed(1) + " KB"; }

async function loadSemantic() {
  try {
    const s = state.mode === "demo" ? { provider: "openai", openai: { model: "text-embedding-3-small" }, saveEmbeddings: true } : await api("/api/semantic-settings");
    const prov = s.provider || "—";
    $("#semProvider").textContent = prov;
    const cfg = s[prov] || {};
    $("#semModel").textContent = cfg.model || "—";
    $("#semCache").textContent = s.saveEmbeddings ? "Enabled" : "Disabled";
  } catch {
    $("#semProvider").textContent = "—"; $("#semModel").textContent = "—"; $("#semCache").textContent = "—";
  }
}

const CMD = [
  ...VIEWS.map(v => ({ label: v[0].toUpperCase() + v.slice(1), kind: "View", run: () => go(v), icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' })),
  ...THEMES.map(t => ({ label: "Theme · " + t.name, kind: "Theme", run: () => applyTheme(t.id), icon: '<circle cx="12" cy="12" r="9"/>' })),
  ...TOOLS.map(t => ({ label: "Run · " + t.name, kind: "Tool", run: () => { go("tools"); selectTool(t.id); }, icon: '<polygon points="5 3 19 12 5 21 5 3"/>' })),
];
let cmdSel = 0, cmdFiltered = CMD;
function openCmd() {
  $("#cmd").hidden = false; $("#cmdInput").value = ""; paintCmd(""); $("#cmdInput").focus();
}
function closeCmd() { $("#cmd").hidden = true; }
function paintCmd(q) {
  cmdFiltered = q ? CMD.filter(c => c.label.toLowerCase().includes(q.toLowerCase())) : CMD;
  cmdSel = 0;
  const box = $("#cmdResults"); box.innerHTML = "";
  cmdFiltered.slice(0, 40).forEach((c, i) => {
    const it = el("div", "cmd-item" + (i === 0 ? " sel" : ""));
    it.innerHTML = `<svg viewBox="0 0 24 24">${c.icon}</svg><span>${c.label}</span><small>${c.kind}</small>`;
    it.onmouseenter = () => { cmdSel = i; markCmd(); };
    it.onclick = () => { c.run(); closeCmd(); };
    box.appendChild(it);
  });
}
function markCmd() { $$("#cmdResults .cmd-item").forEach((n, i) => n.classList.toggle("sel", i === cmdSel)); }

function toast(kind, msg) {
  const t = el("div", "toast " + kind, `<i></i><span>${escapeHtml(msg)}</span>`);
  $("#toasts").appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 2600);
}

function openClientDrop() {
  const d = $("#clientDrop");
  d.hidden = !d.hidden;
  if (d.hidden) return;
  paintClientDrop("");
  $("#clientDropSearch").value = ""; $("#clientDropSearch").focus();
}
function paintClientDrop(q) {
  const box = $("#clientDropList"); box.innerHTML = "";
  const cs = (state.data.clients || []).filter(c => !q || (c.username || "").toLowerCase().includes(q.toLowerCase()));
  if (!cs.length) { box.appendChild(el("div", "empty", "No clients")); return; }
  cs.forEach(c => {
    const it = el("div", "drop-item" + (c.clientId === state.selected ? " active" : ""));
    it.innerHTML = `<div class="di-avatar">${initials(c.username)}</div><div><div class="di-name">${c.username || "Client"}</div><div class="di-sub">${(c.transport || "ws").toUpperCase()} · ${String(c.clientId).slice(0, 8)}</div></div>`;
    it.onclick = () => { state.selected = c.clientId; store.set("client", c.clientId); $("#clientDrop").hidden = true; render(); };
    box.appendChild(it);
  });
}

function wire() {
  $$(".dock-item").forEach(b => b.onclick = () => go(b.dataset.view));
  $("#toolRun").onclick = runTool;
  $("#clientChip").onclick = openClientDrop;
  $("#clientDropSearch").oninput = e => paintClientDrop(e.target.value);
  $("#scriptSearch").oninput = e => paintScripts(window.__scripts || [], e.target.value);
  $("#logLive").onclick = () => { state.logLive = !state.logLive; $("#logLive").classList.toggle("is-live", state.logLive); if (state.logLive) pollLogs(); };
  $("#logClear").onclick = async () => { try { if (state.mode !== "demo") await fetch("/api/server-logs", { method: "DELETE" }); } catch {} state.logs = []; renderLogs(); renderTicker(); toast("ok", "Logs cleared"); };
  $("#themeMode").onclick = () => { const hi = root.dataset.contrast === "high"; root.dataset.contrast = hi ? "normal" : "high"; store.set("contrast", !hi); };

  $("#cmdOpen").onclick = openCmd;
  $("#cmdInput").oninput = e => paintCmd(e.target.value);
  $("#cmdInput").onkeydown = e => {
    if (e.key === "ArrowDown") { cmdSel = clamp(cmdSel + 1, 0, cmdFiltered.length - 1); markCmd(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { cmdSel = clamp(cmdSel - 1, 0, cmdFiltered.length - 1); markCmd(); e.preventDefault(); }
    else if (e.key === "Enter") { const c = cmdFiltered[cmdSel]; if (c) { c.run(); closeCmd(); } }
  };
  $("#cmd").onclick = e => { if (e.target.id === "cmd") closeCmd(); };
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#cmd").hidden ? openCmd() : closeCmd(); }
    else if (e.key === "Escape") { closeCmd(); $("#clientDrop").hidden = true; }
  });
  document.addEventListener("click", e => {
    if (!$("#clientDrop").hidden && !e.target.closest("#clientDrop") && !e.target.closest("#clientChip")) $("#clientDrop").hidden = true;
  });
}

function init() {
  buildPalette();
  buildToolsRail();
  selectTool(activeTool);
  applyTheme(store.get("theme", "nebula"));
  if (store.get("contrast", false)) root.dataset.contrast = "high";
  bindToggle("#setAurora", "aurora", "aurora", ["on", "off"], true);
  bindToggle("#setGrain", "grain", "grain", ["on", "off"], true);
  bindToggle("#setMotion", "motion", "motion", ["off", "on"], false);
  bindToggle("#setCompact", "compact", "density", ["compact", "normal"], false);
  wire();
  poll(); setInterval(poll, 3000);
  pollLogs(); setInterval(pollLogs, 4000);
}

document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
