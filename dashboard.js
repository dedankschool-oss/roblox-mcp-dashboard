(() => {
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

const REPO = "https://github.com/dedankschool-oss/roblox-mcp-dashboard";
const LOADER = 'loadstring(game:HttpGet("http://localhost:16384/script.luau"))()';

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
  root.dataset.theme = id; store.set("theme", id);
  $$(".pdot").forEach(d => d.classList.toggle("active", d.dataset.theme === id));
  $$(".theme-swatch").forEach(s => s.classList.toggle("active", s.dataset.theme === id));
}
function buildPalette() {
  const box = $("#paletteDots"), gallery = $("#themeGallery");
  THEMES.forEach(t => {
    const dot = el("button", "pdot");
    dot.dataset.theme = t.id; dot.title = t.name;
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
  const cb = $(id), v = store.get(key, def);
  cb.checked = v; root.dataset[cls] = v ? on[0] : on[1];
  cb.onchange = () => { root.dataset[cls] = cb.checked ? on[0] : on[1]; store.set(key, cb.checked); };
}

const state = { data: null, mode: "connecting", selected: store.get("client", null), logs: [], logLive: true, history: { clients: [], relays: [] }, latency: null, toolHistory: [], lastOutput: "", logScope: "activity", logLevel: "all", logQuery: "" };

const DEMO = {
  startedAt: Date.now() - 1000 * 60 * 47 - 1000 * 12,
  connected: true, clientCount: 1, role: "Primary", relayClients: 2,
  clients: [{
    clientId: "9a4df93f-aedd-419d-b4b6-a9fe70d697da",
    username: "B4Later", userId: 2671145764, placeId: 2753915549,
    jobId: "66fdf5a8-095a-482b-951d-7d8bc1c23de0", placeName: "[🐉] Blox Fruits", transport: "ws",
    scriptSync: { hasFinishedMapping: true, mappedSources: 812, processedSources: 812, skippedSources: 4, sourcesToMap: 816 },
    semanticIndex: { chunkCount: 4210, embeddedChunks: 3980 },
  }],
};
const DEMO_LOGS = [
  { time: Date.now() - 2000, level: "info", message: "Tool dispatched: get-descendants-tree" },
  { time: Date.now() - 4000, level: "success", message: "Script mapping finished (812 sources)" },
  { time: Date.now() - 9000, level: "info", message: "WebSocket client connected: B4Later" },
  { time: Date.now() - 15000, level: "info", message: "Semantic index warm: 3980/4210 chunks" },
  { time: Date.now() - 21000, level: "warn", message: "Rate limit approaching on embedding provider" },
  { time: Date.now() - 44000, level: "error", message: "Client 8f2a timed out after 15000ms" },
  { time: Date.now() - 60000, level: "info", message: "[Router] Loaded 29 HTTP route(s), 1 WS route(s) + WS fallback." },
  { time: Date.now() - 61000, level: "info", message: "[Primary] MCP Bridge listening on port 16384 (WebSocket + HTTP)" },
  { time: Date.now() - 62000, level: "info", message: "MCP Server started and connected via stdio." },
];
const DEMO_SCRIPTS = [
  { path: "ReplicatedStorage.Modules.Fruits", lines: 512, bytes: 18422, debugId: "a1", hasEmbeddings: true },
  { path: "ReplicatedStorage.Modules.Combat", lines: 322, bytes: 12002, debugId: "a5", hasEmbeddings: true },
  { path: "ReplicatedStorage.Remotes.Comm", lines: 88, bytes: 2104, debugId: "a2", hasEmbeddings: false },
  { path: "StarterPlayer.StarterPlayerScripts.Main", lines: 1340, bytes: 51233, debugId: "a3", hasEmbeddings: true },
  { path: "StarterPlayer.StarterPlayerScripts.UI.Hud", lines: 210, bytes: 7801, debugId: "a6", hasEmbeddings: false },
  { path: "ServerScriptService.DataService", lines: 640, bytes: 22011, debugId: "a4", hasEmbeddings: true },
  { path: "Workspace.Handler", lines: 44, bytes: 900, debugId: "a7", hasEmbeddings: false },
];
const DEMO_SRC = 'local DataService = {}\nlocal Players = game:GetService("Players")\n\n-- persists the player profile to the datastore\nfunction DataService:SavePlayer(player)\n\tlocal key = "profile_" .. player.UserId\n\tlocal ok, err = pcall(function()\n\t\treturn self.store:SetAsync(key, self.cache[player.UserId])\n\tend)\n\tif not ok then\n\t\twarn("save failed", err)\n\tend\n\treturn ok\nend\n\nreturn DataService';

async function api(path, opts) {
  const r = await fetch(path, opts);
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("json")) throw new Error("non-json");
  return r.json();
}

function dedupe(list) {
  const seen = new Map();
  (list || []).forEach(c => { seen.set((c.userId || "") + ":" + (c.jobId || "") || c.clientId, c); });
  return [...seen.values()];
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
  const t0 = performance.now();
  try {
    const d = await api("/api/status");
    d.clients = dedupe(d.clients);
    d.clientCount = d.clients.length;
    state.data = d; state.latency = Math.round(performance.now() - t0); setMode("online");
  } catch {
    if (!state.data || state.mode !== "demo") state.data = DEMO;
    state.latency = null; setMode("demo");
  }
  const cs = state.data.clients || [];
  if (!state.selected || !cs.find(c => c.clientId === state.selected)) state.selected = cs[0] ? cs[0].clientId : null;
  const h = state.history;
  h.clients.push(state.data.clientCount || 0); h.relays.push(state.data.relayClients || 0);
  if (h.clients.length > 24) h.clients.shift();
  if (h.relays.length > 24) h.relays.shift();
  updateLatency(); render();
}

function updateLatency() {
  const chip = $("#latencyChip"), val = $("#latencyVal");
  chip.classList.remove("warn", "bad");
  if (state.latency == null) { val.textContent = "demo"; }
  else { val.textContent = state.latency + " ms"; if (state.latency > 250) chip.classList.add("bad"); else if (state.latency > 90) chip.classList.add("warn"); }
  $("#srvLatency").textContent = state.latency == null ? "—" : state.latency + " ms";
}

function client() { return (state.data && state.data.clients || []).find(c => c.clientId === state.selected) || null; }
function initials(n) { return (n || "?").slice(0, 2).toUpperCase(); }
function avatarInner(c) {
  const init = initials(c && c.username);
  if (c && c.userId) return `<img src="/api/avatar?userId=${c.userId}" alt="" onerror="this.replaceWith(document.createTextNode('${init}'))">`;
  return init;
}
function setAvatar(node, c) { node.innerHTML = avatarInner(c); }

function fmtUptime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor(s % 3600 / 60)).padStart(2, "0");
  return `${h}:${m}:${String(s % 60).padStart(2, "0")}`;
}
function sparkline(svg, arr) {
  if (!arr.length) { svg.innerHTML = ""; return; }
  const max = Math.max(1, ...arr), n = arr.length;
  const pts = arr.map((v, i) => [n === 1 ? 0 : i / (n - 1) * 100, 30 - v / max * 26 + 2]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  svg.innerHTML = `<path class="area" d="${d} L100 32 L0 32 Z"/><path d="${d}"/>`;
}

let uptimeTimer = null, startedAt = 0;
function render() {
  const d = state.data, c = client();
  $("#statClients").textContent = d.clientCount || 0;
  $("#statRelays").textContent = d.relayClients || 0;
  sparkline($("#sparkClients"), state.history.clients);
  sparkline($("#sparkRelays"), state.history.relays);

  $("#heroConnected").hidden = !c; $("#heroEmpty").hidden = !!c;
  if (c) {
    $("#chipName").textContent = c.username || "Client"; setAvatar($("#chipAvatar"), c);
    $("#heroName").textContent = c.username || "—";
    $("#heroPlace").textContent = c.placeName || "Unknown place";
    $("#heroTransport").textContent = (c.transport || "ws").toUpperCase();
    $("#heroUserId").textContent = c.userId ?? "—";
    $("#heroPlaceId").textContent = c.placeId ?? "—";
    $("#heroJobId").textContent = c.jobId || "—";
    $("#heroClientId").textContent = c.clientId || "—";
    setAvatar($("#heroAvatar"), c);
    const ss = c.scriptSync || {}, si = c.semanticIndex || {};
    const sp = ss.sourcesToMap ? Math.round((ss.processedSources || ss.mappedSources || 0) / ss.sourcesToMap * 100) : 0;
    const ip = si.chunkCount ? Math.round((si.embeddedChunks || 0) / si.chunkCount * 100) : 0;
    $("#statScripts").textContent = sp + "%"; $("#statSemantic").textContent = ip + "%";
    $("#barScripts").style.width = sp + "%"; $("#barSemantic").style.width = ip + "%";
  } else {
    $("#chipName").textContent = "No client"; $("#chipAvatar").textContent = "";
    $("#statScripts").textContent = "0%"; $("#statSemantic").textContent = "0%";
    $("#barScripts").style.width = "0%"; $("#barSemantic").style.width = "0%";
  }

  $("#srvStatus").textContent = d.connected ? "Connected" : "Idle";
  $("#srvClients").textContent = d.clientCount || 0;
  $("#srvRelays").textContent = d.relayClients || 0;
  $("#srvClientCount").textContent = (d.clients || []).length;
  renderClientTable();
  if ($("#view-server").classList.contains("is-active")) renderTopo();

  const s = typeof d.startedAt === "number" ? d.startedAt : Date.parse(d.startedAt);
  if (s !== startedAt) {
    startedAt = s;
    $("#uptimeSince").textContent = "since " + new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (uptimeTimer) clearInterval(uptimeTimer);
  const tick = () => {
    const ms = Date.now() - startedAt;
    $("#uptimeClock").textContent = fmtUptime(ms);
    $("#uptimeRing").style.strokeDashoffset = String(327 - 327 * ((ms / 1000 % 3600) / 3600));
  };
  tick(); uptimeTimer = setInterval(tick, 1000);
}

function renderClientTable() {
  const box = $("#srvClientTable"), cs = state.data.clients || [];
  box.innerHTML = "";
  if (!cs.length) { box.appendChild(el("div", "empty", "No clients connected")); return; }
  cs.forEach(c => {
    const row = el("div", "client-row");
    row.innerHTML = `<div class="cr-avatar">${avatarInner(c)}</div>
      <div><div class="cr-name">${esc(c.username || "Client")}</div><div class="cr-place">${esc(c.placeName || "—")}</div></div>
      <div class="cr-tag">${(c.transport || "ws").toUpperCase()}</div>
      <div class="cr-tag">${String(c.clientId).slice(0, 8)}</div>`;
    row.onclick = () => { state.selected = c.clientId; store.set("client", c.clientId); render(); go("overview"); };
    box.appendChild(row);
  });
}

function renderTopo() {
  const box = $("#serverTopo");
  const w = box.clientWidth, h = box.clientHeight || 300;
  if (!w) return;
  const cs = state.data.clients || [], relays = state.data.relayClients || 0;
  const motion = root.dataset.motion !== "off";
  const coreX = w * 0.24, coreY = h / 2, clientX = w * 0.72;
  const n = cs.length, padY = 58, span = Math.max(0, h - padY * 2);
  const edges = [], packets = [], nodes = [];
  cs.forEach((c, i) => {
    const y = n === 1 ? coreY : padY + span * (i / (n - 1));
    const cp = coreX + (clientX - coreX) * 0.5;
    const d = `M${coreX.toFixed(1)} ${coreY.toFixed(1)} C${cp.toFixed(1)} ${coreY.toFixed(1)} ${cp.toFixed(1)} ${y.toFixed(1)} ${clientX.toFixed(1)} ${y.toFixed(1)}`;
    edges.push(`<path class="ng-edge" d="${d}"/>`);
    if (motion) packets.push(`<circle class="ng-packet" r="3.2"><animateMotion dur="${(1.5 + i * .25).toFixed(2)}s" repeatCount="indefinite" path="${d}"/></circle>`);
    nodes.push(`<div class="ng-node" style="left:${clientX}px;top:${y}px"><div class="ng-client${c.clientId === state.selected ? " active" : ""}" data-cid="${c.clientId}"><div class="ng-ava">${avatarInner(c)}</div><div class="ng-info"><b>${esc(c.username || "Client")}</b><span>${esc(c.placeName || "—")}</span></div><div class="ng-badge">${(c.transport || "ws").toUpperCase()}</div></div></div>`);
  });
  const relayNodes = [];
  for (let i = 0; i < relays; i++) {
    const ry = relays === 1 ? coreY : padY + span * (i / Math.max(1, relays - 1));
    const rx = w * 0.06, mid = (rx + coreX) / 2;
    edges.push(`<path class="ng-edge relay" d="M${rx.toFixed(1)} ${ry.toFixed(1)} C${mid.toFixed(1)} ${ry.toFixed(1)} ${mid.toFixed(1)} ${coreY.toFixed(1)} ${coreX.toFixed(1)} ${coreY.toFixed(1)}"/>`);
    relayNodes.push(`<div class="ng-node" style="left:${rx}px;top:${ry}px"><div class="ng-relay"><i></i>R${i + 1}</div></div>`);
  }
  const empty = n ? "" : `<div class="ng-empty">No clients connected — hit Connect to attach one.</div>`;
  box.innerHTML = `<svg class="ng-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="ngGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--a1)"/><stop offset="1" style="stop-color:var(--a2)"/></linearGradient></defs>${edges.join("")}${packets.join("")}</svg>
    <div class="ng-node" style="left:${coreX}px;top:${coreY}px"><div class="ng-core"><div class="ng-core-badge"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><circle cx="6.5" cy="7" r="1"/><circle cx="6.5" cy="17" r="1"/></svg></div><div class="ng-core-cap"><b>MCP Core</b><span>${esc(state.data.role || "primary")} · :16384</span></div></div></div>
    ${relayNodes.join("")}${nodes.join("")}${empty}`;
  box.classList.add("netgraph");
  $$("#serverTopo .ng-client[data-cid]").forEach(nd => nd.onclick = () => { state.selected = nd.dataset.cid; store.set("client", nd.dataset.cid); render(); go("overview"); });
}

const LVL = { info: "info", warn: "warn", error: "error", success: "success" };
const SYSTEM_RE = /\[Router\]|route\(s\)|listening|via stdio|MCP Server started|WS fallback|Loaded \d|Relay client|awaiting registration/i;
function isSystem(l) { return SYSTEM_RE.test(l.message || ""); }
function groupedLogs(rows) {
  const out = [];
  rows.forEach(l => {
    const prev = out[out.length - 1];
    if (prev && prev.message === l.message && prev.level === l.level) { prev.count = (prev.count || 1) + 1; prev.time = l.time; }
    else out.push(Object.assign({}, l));
  });
  return out;
}
function filteredLogs() {
  let rows = state.logs.length ? state.logs : DEMO_LOGS;
  if (state.logScope !== "all") rows = rows.filter(l => state.logScope === "system" ? isSystem(l) : !isSystem(l));
  if (state.logLevel !== "all") rows = rows.filter(l => (l.level || "info").toLowerCase() === state.logLevel);
  if (state.logQuery) rows = rows.filter(l => (l.message || "").toLowerCase().includes(state.logQuery));
  return groupedLogs(rows);
}
function renderTicker() {
  const box = $("#tickerBody"); box.innerHTML = "";
  const rows = groupedLogs((state.logs.length ? state.logs : DEMO_LOGS).filter(l => !isSystem(l))).slice(0, 6);
  rows.forEach(l => {
    const lvl = (l.level || "info").toLowerCase();
    box.appendChild(el("div", "ticker-line " + (LVL[lvl] || "info"), `<time>${new Date(l.time || Date.now()).toLocaleTimeString([], { hour12: false })}</time><em>${lvl}</em><span>${esc(l.message || "")}</span>`));
  });
}
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
  const box = $("#logsBody"); box.innerHTML = "";
  const rows = filteredLogs();
  if (!rows.length) { box.appendChild(el("div", "empty", "No matching logs")); return; }
  rows.forEach(l => {
    const lvl = (l.level || "info").toLowerCase();
    const xn = l.count > 1 ? `<span class="xn">×${l.count}</span>` : "";
    box.appendChild(el("div", "log-row", `<time>${new Date(l.time || Date.now()).toLocaleTimeString([], { hour12: false })}</time><span class="lvl ${LVL[lvl] || "info"}">${lvl}</span><span class="msg">${esc(l.message || "")}${xn}</span>`));
  });
}

const TOOLS = [
  { id: "get-game-info", name: "Game Info", icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>', desc: "Place and universe metadata for the active client.", fields: [{ k: "includeDescription", l: "Include description", t: "check", d: false }] },
  { id: "execute", name: "Execute", icon: '<polygon points="5 3 19 12 5 21 5 3"/>', desc: "Run Luau on the client. Fire-and-forget.", fields: [{ k: "code", l: "code", t: "area", ph: 'print("hello from Vyre")' }] },
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
  $("#toolName").textContent = t.name; $("#toolDesc").textContent = t.desc;
  const box = $("#toolParams"); box.innerHTML = "";
  t.fields.forEach(f => {
    const wrap = el("div", "field" + (f.t === "check" ? " field-check" : ""));
    if (f.t === "check") wrap.innerHTML = `<span class="switch"><input type="checkbox" data-key="${f.k}" ${f.d ? "checked" : ""}><i></i></span><label>${f.l}</label>`;
    else if (f.t === "area") wrap.innerHTML = `<label>${f.l}</label><textarea data-key="${f.k}" placeholder="${f.ph || ""}">${f.d || ""}</textarea>`;
    else wrap.innerHTML = `<label>${f.l}</label><input data-key="${f.k}" type="${f.t === "num" ? "number" : "text"}" placeholder="${f.ph || ""}" value="${f.d ?? ""}">`;
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
  const btn = $("#toolRun"), t0 = performance.now();
  const out = $("#toolOutput"), st = $("#toolStatus"), tm = $("#toolTime");
  btn.classList.add("busy"); out.textContent = "Running…"; st.textContent = ""; st.className = ""; tm.textContent = "";
  const body = Object.assign({ type: activeTool, clientId: state.selected }, collectParams());
  let ok = true;
  try {
    if (state.mode === "demo") { await new Promise(r => setTimeout(r, 360)); out.textContent = demoResult(activeTool, body); st.textContent = "200 · demo"; st.className = "ok"; }
    else {
      let d = await api("/api/tool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (d.jobId) d = await pollJob(d.jobId, out);
      if (d.error) { out.textContent = d.error; st.textContent = "error"; st.className = "err"; ok = false; }
      else { out.textContent = d.result ?? JSON.stringify(d, null, 2); st.textContent = "200"; st.className = "ok"; }
    }
  } catch (e) { out.textContent = String(e && e.message || e); st.textContent = "failed"; st.className = "err"; ok = false; }
  finally {
    tm.textContent = Math.round(performance.now() - t0) + " ms"; btn.classList.remove("busy");
    state.lastOutput = out.textContent;
    state.toolHistory.unshift({ id: activeTool, ok }); state.toolHistory = state.toolHistory.slice(0, 8); renderHistory();
  }
}
function renderHistory() {
  const box = $("#toolHistory"); box.innerHTML = "";
  state.toolHistory.forEach(h => {
    const t = TOOLS.find(x => x.id === h.id); if (!t) return;
    const chip = el("div", "hist-chip" + (h.ok ? "" : " err"), `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">${t.icon}</svg>${t.name}`);
    chip.onclick = () => selectTool(h.id);
    box.appendChild(chip);
  });
}
async function pollJob(id, out) {
  for (let i = 0; i < 600; i++) {
    const p = await api("/api/tool-progress?id=" + encodeURIComponent(id));
    if (p.status === "running" || p.state === "running") { out.textContent = p.message || "Working…"; await new Promise(r => setTimeout(r, 500)); continue; }
    if (p.error) return { error: p.error };
    return { result: p.result ?? p.message };
  }
  return { error: "Timed out waiting for job." };
}
function demoResult(id, body) {
  if (id === "get-game-info") return "PlaceId: 2753915549\nGameId: 994732206\nPlaceVersion: 1487\nName: [🐉] Blox Fruits";
  if (id === "script-grep") return "3 match(es) across 2 script(s)\n\n[ReplicatedStorage.Modules.Fruits] 2 match(es)\n\n> 41: function Fruit:HasPermanent(player)\n  42:     return self.owned[player.UserId] == true";
  if (id === "get-console-output") return "[12:04:51] Loaded Blox Fruits client\n[12:04:52] Autofarm module ready\n[12:04:59] Remote fired: RequestGift";
  if (id === "get-descendants-tree") return "game.Workspace\n├─ Camera (Camera)\n├─ Terrain (Terrain)\n├─ _WorldOrigin (Folder) [12]\n└─ Characters (Folder) [8]";
  if (id === "execute") return "Code dispatched to client.";
  if (id === "get-data-by-code") return "8";
  if (id === "semantic-search") return '2 match(es) for "' + (body.query || "") + '"\n\n1. [DataService] lines 88-140 (function: SavePlayer; hybrid 0.8123)\nSummary: Serialises the player profile and writes to the datastore.';
  return "OK";
}

let scriptsCache = [], selectedScript = null;
function classIcon(kind) {
  const P = {
    service: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 3v18"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    script: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
  };
  return `<span class="tw-ico ico-${kind}">${P[kind] || P.script}</span>`;
}
function buildTree(scripts) {
  const rootNode = { name: "", kids: new Map(), script: null };
  scripts.forEach(s => {
    const segs = String(s.path || s.debugId || "?").split(".");
    let node = rootNode;
    segs.forEach((seg, i) => {
      if (!node.kids.has(seg)) node.kids.set(seg, { name: seg, kids: new Map(), script: null, depth: i });
      node = node.kids.get(seg);
      if (i === segs.length - 1) node.script = s;
    });
  });
  return rootNode;
}
function leafCount(node) { let n = node.script ? 1 : 0; node.kids.forEach(k => n += leafCount(k)); return n; }
function renderTree(scripts, query) {
  const box = $("#scriptTree"); box.innerHTML = "";
  if (!scripts.length) { box.appendChild(el("div", "empty", "No scripts indexed yet")); return; }
  const treeRoot = buildTree(scripts);
  const frag = document.createDocumentFragment();
  treeRoot.kids.forEach(k => frag.appendChild(renderNode(k, 0, !!query)));
  box.appendChild(frag);
}
function renderNode(node, depth, expandAll) {
  const wrap = el("div", "tree-node");
  const isLeaf = node.kids.size === 0 && node.script;
  const kind = isLeaf ? "script" : depth === 0 ? "service" : "folder";
  const row = el("div", "tree-row");
  const caret = isLeaf ? "" : `<span class="tw-caret"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></span>`;
  const count = isLeaf ? (node.script ? `<span class="tw-count">${node.script.lines ?? ""}${node.script.lines ? " ln" : ""}</span>` : "") : `<span class="tw-count">${leafCount(node)}</span>`;
  row.innerHTML = `${isLeaf ? '<span class="tw-caret"></span>' : caret}${classIcon(kind)}<span class="tw-name">${esc(node.name)}</span>${count}`;
  wrap.appendChild(row);
  if (!isLeaf) {
    const kids = el("div", "tree-children");
    node.kids.forEach(k => kids.appendChild(renderNode(k, depth + 1, expandAll)));
    wrap.appendChild(kids);
    if (!expandAll && depth >= 1) wrap.classList.add("collapsed");
    row.onclick = () => wrap.classList.toggle("collapsed");
  } else {
    row.onclick = () => { $$(".tree-row.active").forEach(n => n.classList.remove("active")); row.classList.add("active"); openScript(node.script); };
  }
  return wrap;
}
async function loadScripts() {
  const box = $("#scriptTree");
  box.innerHTML = `<div class="empty">Loading…</div>`;
  let scripts = [];
  if (state.mode === "demo" || !state.selected) scripts = DEMO_SCRIPTS;
  else { try { const d = await api("/api/scripts?clientId=" + encodeURIComponent(state.selected)); scripts = d.scripts || []; } catch { scripts = []; } }
  scriptsCache = scripts;
  renderTree(scripts, "");
  $("#scriptCount").textContent = scripts.length;
  updateSync();
}
function updateSync() {
  const c = client(), ss = (c && c.scriptSync) || {}, si = (c && c.semanticIndex) || {};
  const done = ss.processedSources || ss.mappedSources || 0, total = ss.sourcesToMap || 0;
  const sp = total ? Math.round(done / total * 100) : 0;
  $("#syncBar").style.width = sp + "%"; $("#syncCount").textContent = `${done} / ${total}`; $("#syncPerc").textContent = sp + "%";
  $("#syncStatus").textContent = ss.hasFinishedMapping ? "Mapped" : total ? "Mapping…" : "Waiting";
  const emb = si.embeddedChunks || 0, chunks = si.chunkCount || 0, ip = chunks ? Math.round(emb / chunks * 100) : 0;
  $("#indexBar").style.width = ip + "%"; $("#indexCount").textContent = `${emb} / ${chunks}`; $("#indexPerc").textContent = ip + "%";
}
async function openScript(s) {
  selectedScript = s;
  $("#viewerTitle").textContent = s.path || s.debugId;
  $("#viewerMeta").textContent = `${s.lines ?? "?"} ln · ${fmtBytes(s.bytes)}${s.hasEmbeddings ? " · indexed" : ""}`;
  const body = $("#viewerBody"); body.innerHTML = `<div class="viewer-empty">Loading source…</div>`;
  let src = "";
  if (state.mode === "demo" || !state.selected) src = DEMO_SRC;
  else {
    try {
      const q = s.debugId ? "debugId=" + encodeURIComponent(s.debugId) : "path=" + encodeURIComponent(s.path);
      const d = await api(`/api/scripts/source?clientId=${encodeURIComponent(state.selected)}&${q}`);
      src = d.source ?? d.result ?? d.code ?? (typeof d === "string" ? d : JSON.stringify(d, null, 2));
    } catch (e) { src = "-- failed to load source: " + (e.message || e); }
  }
  paintSource(src);
}
function paintSource(src) {
  const lines = String(src).split("\n");
  const gutter = lines.map((_, i) => i + 1).join("\n");
  $("#viewerBody").innerHTML = `<div class="code-view"><div class="code-gutter">${gutter}</div><div class="code-src">${highlightLua(src)}</div></div>`;
}
function highlightLua(src) {
  const re = /(--\[\[[\s\S]*?\]\]|--[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(local|function|end|if|then|else|elseif|for|in|do|while|repeat|until|return|and|or|not|nil|true|false|break|self|continue)\b|\b(\d+\.?\d*)\b/g;
  let out = "", last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    const cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : "n";
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = re.lastIndex;
  }
  out += esc(src.slice(last));
  return out;
}
function fmtBytes(b) { if (b == null) return "—"; return b < 1024 ? b + " B" : (b / 1024).toFixed(1) + " KB"; }

async function startIndex() {
  const btn = $("#indexBtn"), st = $("#indexStatus");
  if (state.mode === "demo") { st.textContent = "Indexed (demo)"; toast("ok", "Index complete (demo)"); return; }
  if (!state.selected) { toast("err", "No client selected"); return; }
  btn.classList.add("busy"); st.textContent = "Indexing…";
  try {
    let d = await api("/api/tool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "semantic-search", clientId: state.selected, query: "index", indexOnly: true }) });
    if (d.jobId) {
      for (let i = 0; i < 1200; i++) {
        const p = await api("/api/tool-progress?id=" + d.jobId);
        if (p.status === "running" || p.state === "running") { st.textContent = p.message || "Indexing…"; await new Promise(r => setTimeout(r, 600)); continue; }
        st.textContent = p.error ? "Failed" : "Indexed"; toast(p.error ? "err" : "ok", p.error || "Semantic index ready"); break;
      }
    } else { st.textContent = d.error ? "Failed" : "Done"; }
  } catch (e) { st.textContent = "Failed"; toast("err", String(e.message || e)); }
  finally { btn.classList.remove("busy"); }
}

async function loadSemantic() {
  try {
    const s = state.mode === "demo"
      ? { provider: "openai", openaiApiKeySet: false, openaiApiKeyMasked: "", openaiBaseUrl: "https://api.openai.com/v1", openaiModel: "text-embedding-3-small", ollamaBaseUrl: "http://localhost:11434", ollamaModel: "embeddinggemma", saveEmbeddingsToDisk: false }
      : await api("/api/semantic-settings");
    setProv(s.provider || "openai");
    $("#oaKey").placeholder = s.openaiApiKeySet ? (s.openaiApiKeyMasked || "•••• saved") : "sk-…"; $("#oaKey").value = "";
    $("#oaUrl").value = s.openaiBaseUrl || ""; $("#oaModel").value = s.openaiModel || "";
    $("#olUrl").value = s.ollamaBaseUrl || ""; $("#olModel").value = s.ollamaModel || "";
    $("#saveEmb").checked = !!s.saveEmbeddingsToDisk;
  } catch { $("#testResult").textContent = ""; }
}
function setProv(p) {
  $$("#provSeg .seg-btn").forEach(b => b.classList.toggle("active", b.dataset.prov === p));
  $("#provOpenai").hidden = p !== "openai"; $("#provOllama").hidden = p !== "ollama";
}
function currentProv() { return $("#provSeg .seg-btn.active").dataset.prov; }
function provBody() {
  const b = { provider: currentProv(), openaiBaseUrl: $("#oaUrl").value, openaiModel: $("#oaModel").value, ollamaBaseUrl: $("#olUrl").value, ollamaModel: $("#olModel").value, saveEmbeddingsToDisk: $("#saveEmb").checked };
  if ($("#oaKey").value.trim()) b.openaiApiKey = $("#oaKey").value.trim();
  return b;
}
async function saveProv() {
  if (state.mode === "demo") { toast("ok", "Saved (demo)"); return; }
  try { await api("/api/semantic-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(provBody()) }); toast("ok", "Settings saved"); loadSemantic(); }
  catch (e) { toast("err", String(e.message || e)); }
}
async function testProv() {
  const box = $("#testResult"); box.className = "test-result"; box.textContent = "Testing…";
  if (state.mode === "demo") { box.classList.add("ok"); box.textContent = "OK · provider reachable (demo)"; return; }
  try {
    const d = await api("/api/semantic-settings/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(provBody()) });
    if (d.ok) { box.classList.add("ok"); box.textContent = "OK · " + (d.model ? "model " + d.model : "provider reachable"); }
    else { box.classList.add("err"); box.textContent = d.error || "Test failed"; }
  } catch (e) { box.classList.add("err"); box.textContent = String(e.message || e); }
}
async function delCache() {
  if (state.mode === "demo") { toast("ok", "Cache cleared (demo)"); return; }
  try { await fetch("/api/semantic-settings", { method: "DELETE" }); toast("ok", "Embedding cache cleared"); }
  catch (e) { toast("err", String(e.message || e)); }
}
function detectGpu() {
  try {
    const cv = document.createElement("canvas");
    const gl = cv.getContext("webgl") || cv.getContext("experimental-webgl");
    if (!gl) return "unknown";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return (ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || "unknown";
  } catch { return "unknown"; }
}
function suggestModel() {
  const gpu = detectGpu(), g = String(gpu).toLowerCase();
  const dedicated = /(rtx|gtx|radeon rx|\bamd\b|nvidia|geforce|\barc\b|quadro|tesla|\ba\d{3,4}\b)/.test(g);
  const weak = /(gtx\s?(9|10[0-5])|mx\d|uhd|hd graphics)/.test(g);
  let model, why;
  if (dedicated && !weak) { model = "mxbai-embed-large"; why = "dedicated GPU with plenty of VRAM headroom — go for the highest-quality embeddings."; }
  else if (dedicated) { model = "nomic-embed-text"; why = "capable GPU — a fast, high-quality embedding model."; }
  else if (/intel|iris|apple|mali|adreno/.test(g)) { model = "nomic-embed-text"; why = "integrated graphics — this light, fast model is the safe pick."; }
  else { model = "nomic-embed-text"; why = "GPU unreadable from the browser — this light model runs well almost anywhere."; }
  $("#olModel").value = model;
  $("#suggestOut").innerHTML = `<b>${esc(gpu)}</b> → <b>${model}</b>. ${why} Pull: <b>ollama pull ${model}</b>`;
}
function hlLabel(label, q) {
  if (!q) return esc(label);
  const i = label.toLowerCase().indexOf(q);
  if (i < 0) return esc(label);
  return esc(label.slice(0, i)) + "<mark>" + esc(label.slice(i, i + q.length)) + "</mark>" + esc(label.slice(i + q.length));
}

const VIEWS = ["overview", "server", "tools", "scripts", "logs", "settings"];
function go(view) {
  if (!VIEWS.includes(view)) return;
  $$(".view").forEach(v => v.classList.toggle("is-active", v.id === "view-" + view));
  $$(".dock-item").forEach(d => d.classList.toggle("is-active", d.dataset.view === view));
  if (view === "scripts") loadScripts();
  if (view === "settings") loadSemantic();
  if (view === "logs") renderLogs();
  if (view === "server") ensureTopo();
}
function ensureTopo(tries) {
  tries = tries == null ? 10 : tries;
  const box = $("#serverTopo");
  if (box && box.clientWidth > 0) { renderTopo(); return; }
  if (tries > 0) requestAnimationFrame(() => ensureTopo(tries - 1));
}

function openConnect() { $("#connectModal").hidden = false; }
function closeConnect() { $("#connectModal").hidden = true; }
async function copyText(t, okMsg) { try { await navigator.clipboard.writeText(t); toast("ok", okMsg || "Copied"); } catch { toast("err", "Copy blocked"); } }
async function copyLoader() {
  const btn = $("#loaderCopy");
  await copyText(LOADER, "Loader copied");
  btn.classList.add("done"); btn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Copied`;
  setTimeout(() => { btn.classList.remove("done"); btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>Copy`; }, 1800);
}
function downloadSnapshot() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const a = el("a"); a.href = URL.createObjectURL(blob); a.download = "vyre-status-" + Date.now() + ".json"; a.click();
  toast("ok", "Snapshot downloaded");
}
function download(name, text) {
  const a = el("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = name; a.click();
}

const CMD = [
  { group: "Navigate", label: "Overview", kind: "View", icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>', run: () => go("overview") },
  { group: "Navigate", label: "Server", kind: "View", icon: '<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/>', run: () => go("server") },
  { group: "Navigate", label: "Tools", kind: "View", icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>', run: () => go("tools") },
  { group: "Navigate", label: "Scripts", kind: "View", icon: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>', run: () => go("scripts") },
  { group: "Navigate", label: "Logs", kind: "View", icon: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>', run: () => go("logs") },
  { group: "Navigate", label: "Settings", kind: "View", icon: '<circle cx="12" cy="12" r="3"/>', run: () => go("settings") },
  { group: "Actions", label: "Connect executor", kind: "Action", icon: '<path d="M9 2v6M15 2v6M8 8h8v3a4 4 0 0 1-8 0z"/><path d="M12 15v7"/>', run: openConnect },
  { group: "Actions", label: "Copy loader script", kind: "Action", icon: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', run: copyLoader },
  { group: "Actions", label: "Index game (semantic)", kind: "Action", icon: '<path d="M4 6h16M4 12h16M4 18h10"/>', run: () => { go("scripts"); startIndex(); } },
  { group: "Actions", label: "Download status snapshot", kind: "Action", icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>', run: downloadSnapshot },
  { group: "Actions", label: "Clear server logs", kind: "Action", icon: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', run: () => $("#logClear").click() },
  { group: "Actions", label: "Open GitHub repo", kind: "Action", icon: '<path d="M12 2a10 10 0 0 0-3 19.5c.5 0 .7-.2.7-.5v-2c-2.8.6-3.4-1.3-3.4-1.3-.4-1-1-1.3-1-1.3-.9-.6 0-.6 0-.6 1 0 1.5 1 1.5 1 .9 1.5 2.3 1 2.9.8 0-.6.3-1 .6-1.3-2.2-.2-4.5-1.1-4.5-5 0-1 .4-1.9 1-2.5 0-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9 9 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.1 2.3 0 2.6.7.6 1 1.5 1 2.5 0 3.9-2.3 4.8-4.5 5 .3.3.6.9.6 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/>', run: () => window.open(REPO, "_blank") },
  { group: "Actions", label: "Keyboard shortcuts", kind: "Action", icon: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3 2.5c-.7.3-1 .8-1 1.5"/>', run: openHelp },
  ...THEMES.map(t => ({ group: "Appearance", label: "Theme · " + t.name, kind: "Theme", swatch: t.c, run: () => applyTheme(t.id) })),
  ...TOOLS.map(t => ({ group: "Tools", label: "Run · " + t.name, kind: "Tool", icon: '<polygon points="5 3 19 12 5 21 5 3"/>', run: () => { go("tools"); selectTool(t.id); } })),
];
let cmdItems = [], cmdSel = 0;
function openCmd() { $("#cmd").hidden = false; $("#cmdInput").value = ""; paintCmd(""); $("#cmdInput").focus(); }
function closeCmd() { $("#cmd").hidden = true; }
function badge(c) { return c.swatch ? `<div class="ci-badge" style="background:linear-gradient(135deg,${c.swatch[0]},${c.swatch[1]})"></div>` : `<div class="ci-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${c.icon || ""}</svg></div>`; }
function clientCmds() {
  return (state.data && state.data.clients || []).map(c => ({ group: "Clients", label: c.username || "Client", kind: "Client", client: c, run: () => { state.selected = c.clientId; store.set("client", c.clientId); render(); go("overview"); } }));
}
function paintCmd(q) {
  const all = CMD.concat(clientCmds());
  const ql = q.trim().toLowerCase();
  const match = ql ? all.filter(c => c.label.toLowerCase().includes(ql) || (c.kind || "").toLowerCase().includes(ql)) : all;
  const box = $("#cmdResults"); box.innerHTML = ""; cmdItems = []; cmdSel = 0;
  if (!match.length) { box.appendChild(el("div", "cmd-empty", "No matches")); return; }
  [...new Set(match.map(c => c.group))].forEach(g => {
    box.appendChild(el("div", "cmd-group-label", g));
    match.filter(c => c.group === g).forEach(c => {
      const it = el("div", "cmd-item");
      it.innerHTML = `${c.client ? `<div class="ci-badge">${avatarInner(c.client)}</div>` : badge(c)}<span>${hlLabel(c.label, ql)}</span><kbd>${c.kind}</kbd>`;
      const idx = cmdItems.length;
      it.onmouseenter = () => { cmdSel = idx; markCmd(); };
      it.onclick = () => { c.run(); closeCmd(); };
      box.appendChild(it); cmdItems.push(it);
    });
  });
  markCmd();
}
function markCmd() { cmdItems.forEach((n, i) => n.classList.toggle("sel", i === cmdSel)); if (cmdItems[cmdSel]) cmdItems[cmdSel].scrollIntoView({ block: "nearest" }); }

function openHelp() { $("#helpModal").hidden = false; }
function closeHelp() { $("#helpModal").hidden = true; }

function toast(kind, msg) {
  const t = el("div", "toast " + kind, `<i></i><span>${esc(msg)}</span>`);
  $("#toasts").appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 2600);
}

function openClientDrop() {
  const d = $("#clientDrop");
  d.hidden = !d.hidden;
  if (d.hidden) return;
  paintClientDrop(""); $("#clientDropSearch").value = ""; $("#clientDropSearch").focus();
}
function paintClientDrop(q) {
  const box = $("#clientDropList"); box.innerHTML = "";
  const cs = (state.data.clients || []).filter(c => !q || (c.username || "").toLowerCase().includes(q.toLowerCase()));
  if (!cs.length) { box.appendChild(el("div", "empty", "No clients")); return; }
  cs.forEach(c => {
    const it = el("div", "drop-item" + (c.clientId === state.selected ? " active" : ""), `<div class="di-avatar">${avatarInner(c)}</div><div><div class="di-name">${esc(c.username || "Client")}</div><div class="di-sub">${(c.transport || "ws").toUpperCase()} · ${String(c.clientId).slice(0, 8)}</div></div>`);
    it.onclick = () => { state.selected = c.clientId; store.set("client", c.clientId); $("#clientDrop").hidden = true; render(); };
    box.appendChild(it);
  });
}

function wire() {
  $$(".dock-item[data-view]").forEach(b => b.onclick = () => go(b.dataset.view));
  $("#clientChip").onclick = openClientDrop;
  $("#clientDropSearch").oninput = e => paintClientDrop(e.target.value);

  $$(".qb-btn").forEach(b => b.onclick = () => {
    const q = b.dataset.q;
    if (q === "connect") openConnect();
    else if (q === "index") { go("scripts"); startIndex(); }
    else if (q === "console") { go("tools"); selectTool("get-console-output"); runTool(); }
    else if (q === "snapshot") downloadSnapshot();
    else if (q === "theme") applyTheme(THEMES[Math.floor(Math.random() * THEMES.length)].id);
  });
  $$(".stat.clickable").forEach(s => s.onclick = () => go(s.dataset.jump));
  $$(".meta-cell.copy").forEach(m => m.onclick = () => copyText(m.querySelector("b").textContent, "Copied"));

  $("#toolRun").onclick = runTool;
  $("#toolCopy").onclick = () => copyText(state.lastOutput, "Response copied");
  $("#toolDownload").onclick = () => download("vyre-" + activeTool + ".txt", state.lastOutput || "");

  $("#treeCollapse").onclick = () => $$("#scriptTree > .tree-node").forEach(n => n.classList.add("collapsed"));
  $("#scriptSearch").oninput = e => { const q = e.target.value.trim().toLowerCase(); renderTree(q ? scriptsCache.filter(s => (s.path || "").toLowerCase().includes(q)) : scriptsCache, q); };
  $("#viewerCopy").onclick = () => { if (selectedScript) copyText($("#viewerBody").innerText, "Source copied"); };
  $("#indexBtn").onclick = startIndex;

  $("#logLive").onclick = () => { state.logLive = !state.logLive; $("#logLive").classList.toggle("is-live", state.logLive); if (state.logLive) pollLogs(); };
  $("#logCopy").onclick = () => copyText(filteredLogs().map(l => `[${new Date(l.time).toLocaleTimeString([], { hour12: false })}] ${l.level} ${l.message}`).join("\n"), "Logs copied");
  $("#logClear").onclick = async () => { try { if (state.mode !== "demo") await fetch("/api/server-logs", { method: "DELETE" }); } catch {} state.logs = []; renderLogs(); renderTicker(); toast("ok", "Logs cleared"); };
  $$("#logScope .seg-btn").forEach(b => b.onclick = () => { state.logScope = b.dataset.scope; $$("#logScope .seg-btn").forEach(x => x.classList.toggle("active", x === b)); renderLogs(); });
  $$("#logChips .chip").forEach(b => b.onclick = () => { state.logLevel = b.dataset.lvl; $$("#logChips .chip").forEach(x => x.classList.toggle("active", x === b)); renderLogs(); });
  $("#logSearch").oninput = e => { state.logQuery = e.target.value.trim().toLowerCase(); renderLogs(); };

  $("#themeMode").onclick = () => { const hi = root.dataset.contrast === "high"; root.dataset.contrast = hi ? "normal" : "high"; store.set("contrast", !hi); const cb = $("#setContrast"); if (cb) cb.checked = !hi; };
  $("#helpBtn").onclick = openHelp; $("#helpClose").onclick = closeHelp;
  $("#helpModal").onclick = e => { if (e.target.id === "helpModal") closeHelp(); };

  $("#connectBtn").onclick = openConnect; $("#heroConnectBtn").onclick = openConnect;
  $("#connectClose").onclick = closeConnect; $("#loaderCopy").onclick = copyLoader;
  $("#connectModal").onclick = e => { if (e.target.id === "connectModal") closeConnect(); };

  $$("#provSeg .seg-btn").forEach(b => b.onclick = () => setProv(b.dataset.prov));
  $("#saveProv").onclick = saveProv; $("#testProv").onclick = testProv; $("#delCache").onclick = delCache;
  $("#suggestBtn").onclick = suggestModel;

  $("#cmdOpen").onclick = openCmd;
  $("#cmdInput").oninput = e => paintCmd(e.target.value);
  $("#cmdInput").onkeydown = e => {
    if (e.key === "ArrowDown") { cmdSel = clamp(cmdSel + 1, 0, cmdItems.length - 1); markCmd(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { cmdSel = clamp(cmdSel - 1, 0, cmdItems.length - 1); markCmd(); e.preventDefault(); }
    else if (e.key === "Enter") { const it = cmdItems[cmdSel]; if (it) it.click(); }
  };
  $("#cmd").onclick = e => { if (e.target.id === "cmd") closeCmd(); };

  document.addEventListener("keydown", e => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#cmd").hidden ? openCmd() : closeCmd(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && $("#view-tools").classList.contains("is-active")) { e.preventDefault(); runTool(); }
    else if (e.key === "Escape") { closeCmd(); closeConnect(); closeHelp(); $("#clientDrop").hidden = true; }
    else if (!typing && e.key === "?") { openHelp(); }
    else if (!typing && /^[1-6]$/.test(e.key)) { go(VIEWS[+e.key - 1]); }
  });
  document.addEventListener("click", e => {
    if (!$("#clientDrop").hidden && !e.target.closest("#clientDrop") && !e.target.closest("#clientChip")) $("#clientDrop").hidden = true;
  });
  window.addEventListener("resize", () => { if ($("#view-server").classList.contains("is-active")) renderTopo(); });
}

function init() {
  buildPalette(); buildToolsRail(); selectTool(activeTool);
  applyTheme(store.get("theme", "nebula"));
  if (store.get("contrast", false)) root.dataset.contrast = "high";
  bindToggle("#setAurora", "aurora", "aurora", ["on", "off"], true);
  bindToggle("#setGrain", "grain", "grain", ["on", "off"], true);
  bindToggle("#setMotion", "motion", "motion", ["off", "on"], false);
  bindToggle("#setCompact", "compact", "density", ["compact", "normal"], false);
  const sc = $("#setContrast"); if (sc) { sc.checked = root.dataset.contrast === "high"; sc.onchange = () => { root.dataset.contrast = sc.checked ? "high" : "normal"; store.set("contrast", sc.checked); }; }
  wire();
  poll(); setInterval(poll, 3000);
  pollLogs(); setInterval(pollLogs, 4000);
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
