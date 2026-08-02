(() => {
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const escapeHtml = s => String(s).replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

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
  root.dataset.theme = id;
  store.set("theme", id);
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
  try { state.data = await api("/api/status"); setMode("online"); }
  catch { if (!state.data || state.mode !== "demo") state.data = DEMO; setMode("demo"); }
  const cs = state.data.clients || [];
  if (!state.selected || !cs.find(c => c.clientId === state.selected)) state.selected = cs[0] ? cs[0].clientId : null;
  const h = state.history;
  h.clients.push(state.data.clientCount || 0); h.relays.push(state.data.relayClients || 0);
  if (h.clients.length > 24) h.clients.shift();
  if (h.relays.length > 24) h.relays.shift();
  render();
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

let uptimeTimer = null;
function render() {
  const d = state.data, c = client();
  $("#statClients").textContent = d.clientCount || 0;
  $("#statRelays").textContent = d.relayClients || 0;
  sparkline($("#sparkClients"), state.history.clients);
  sparkline($("#sparkRelays"), state.history.relays);

  $("#heroConnected").hidden = !c;
  $("#heroEmpty").hidden = !!c;
  if (c) {
    $("#chipName").textContent = c.username || "Client";
    setAvatar($("#chipAvatar"), c);
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
  $("#srvRole").textContent = d.role || "Primary";
  $("#srvClientCount").textContent = (d.clients || []).length;
  renderClientTable();
  if ($("#view-server").classList.contains("is-active")) renderTopo();

  const start = typeof d.startedAt === "number" ? d.startedAt : Date.parse(d.startedAt);
  if (uptimeTimer) clearInterval(uptimeTimer);
  const tick = () => {
    const ms = Date.now() - start;
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
      <div><div class="cr-name">${escapeHtml(c.username || "Client")}</div><div class="cr-place">${escapeHtml(c.placeName || "—")}</div></div>
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
  const cx = w / 2, cy = h / 2, rC = Math.min(w, h) * 0.34, rR = Math.min(w, h) * 0.46;
  const nodes = [], links = [];
  cs.forEach((c, i) => {
    const a = -Math.PI / 2 + i / Math.max(1, cs.length) * Math.PI * 2;
    const x = cx + Math.cos(a) * rC, y = cy + Math.sin(a) * rC;
    links.push(`<path class="topo-link" d="M${cx} ${cy} L${x} ${y}"/>`);
    nodes.push(`<div class="topo-node" style="left:${x}px;top:${y}px"><div class="topo-dot" data-cid="${c.clientId}">${avatarInner(c)}</div><div class="topo-label">${escapeHtml(c.username || "Client")}<small>${(c.transport || "ws")}</small></div></div>`);
  });
  for (let i = 0; i < relays; i++) {
    const a = -Math.PI / 2 + (i + .5) / Math.max(1, relays) * Math.PI * 2;
    const x = cx + Math.cos(a) * rR, y = cy + Math.sin(a) * rR;
    links.push(`<path class="topo-link relay" d="M${cx} ${cy} L${x} ${y}"/>`);
    nodes.push(`<div class="topo-node" style="left:${x}px;top:${y}px"><div class="topo-dot relay">R${i + 1}</div><div class="topo-label">relay</div></div>`);
  }
  box.innerHTML = `<svg class="topo-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${links.join("")}</svg>
    <div class="topo-node" style="left:${cx}px;top:${cy}px"><div class="topo-core"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><circle cx="6.5" cy="7" r="1"/><circle cx="6.5" cy="17" r="1"/></svg></div><div class="topo-label">MCP Core<small>${escapeHtml(state.data.role || "primary")}</small></div></div>
    ${nodes.join("")}`;
  $$("#serverTopo .topo-dot[data-cid]").forEach(n => n.onclick = () => { state.selected = n.dataset.cid; store.set("client", n.dataset.cid); render(); go("overview"); });
}

const LVL = { info: "info", warn: "warn", error: "error", success: "success" };
function renderTicker() {
  const box = $("#tickerBody"); box.innerHTML = "";
  (state.logs.length ? state.logs : DEMO_LOGS).slice(0, 6).forEach(l => {
    const lvl = (l.level || "info").toLowerCase();
    const t = new Date(l.time || Date.now());
    box.appendChild(el("div", "ticker-line " + (LVL[lvl] || "info"), `<time>${t.toLocaleTimeString([], { hour12: false })}</time><em>${lvl}</em><span>${escapeHtml(l.message || "")}</span>`));
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
  const rows = state.logs.length ? state.logs : DEMO_LOGS;
  if (!rows.length) { box.appendChild(el("div", "empty", "No server logs yet")); return; }
  rows.forEach(l => {
    const lvl = (l.level || "info").toLowerCase();
    const t = new Date(l.time || Date.now());
    box.appendChild(el("div", "log-row", `<time>${t.toLocaleTimeString([], { hour12: false })}</time><span class="lvl ${LVL[lvl] || "info"}">${lvl}</span><span class="msg">${escapeHtml(l.message || "")}</span>`));
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
  try {
    if (state.mode === "demo") {
      await new Promise(r => setTimeout(r, 360));
      out.textContent = demoResult(activeTool, body); st.textContent = "200 · demo"; st.className = "ok";
    } else {
      let d = await api("/api/tool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (d.jobId) d = await pollJob(d.jobId, out);
      if (d.error) { out.textContent = d.error; st.textContent = "error"; st.className = "err"; }
      else { out.textContent = d.result ?? JSON.stringify(d, null, 2); st.textContent = "200"; st.className = "ok"; }
    }
  } catch (e) { out.textContent = String(e && e.message || e); st.textContent = "failed"; st.className = "err"; }
  finally { tm.textContent = Math.round(performance.now() - t0) + " ms"; btn.classList.remove("busy"); }
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
  if (id === "script-grep") return "3 match(es) across 2 script(s)\n\n[ReplicatedStorage.Modules.Fruits] 2 match(es)\n\n> 41: function Fruit:HasPermanent(player)\n  42:     return self.owned[player.UserId] == true";
  if (id === "get-console-output") return "[12:04:51] Loaded Blox Fruits client\n[12:04:52] Autofarm module ready\n[12:04:59] Remote fired: RequestGift";
  if (id === "get-descendants-tree") return "game.Workspace\n├─ Camera (Camera)\n├─ Terrain (Terrain)\n├─ _WorldOrigin (Folder) [12]\n└─ Characters (Folder) [8]";
  if (id === "execute") return "Code dispatched to client.";
  if (id === "get-data-by-code") return "8";
  if (id === "semantic-search") return '2 match(es) for "' + (body.query || "") + '"\n\n1. [DataService] lines 88-140 (function: SavePlayer; hybrid 0.8123)\nSummary: Serialises the player profile and writes to the datastore.';
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
  if (view === "server") requestAnimationFrame(renderTopo);
}

async function loadScripts() {
  const box = $("#scriptList"), cnt = $("#scriptCount");
  box.innerHTML = `<div class="empty">Loading…</div>`;
  let scripts = [];
  if (state.mode === "demo" || !state.selected) {
    scripts = [
      { path: "ReplicatedStorage.Modules.Fruits", lines: 512, bytes: 18422 },
      { path: "ReplicatedStorage.Remotes.Comm", lines: 88, bytes: 2104 },
      { path: "StarterPlayer.StarterPlayerScripts.Main", lines: 1340, bytes: 51233 },
      { path: "ServerScriptService.DataService", lines: 640, bytes: 22011 },
    ];
  } else {
    try { const d = await api("/api/scripts?clientId=" + encodeURIComponent(state.selected)); scripts = d.scripts || []; } catch { scripts = []; }
  }
  window.__scripts = scripts;
  paintScripts(scripts, ""); cnt.textContent = scripts.length;
}
function paintScripts(scripts, q) {
  const box = $("#scriptList");
  const filtered = q ? scripts.filter(s => (s.path || "").toLowerCase().includes(q.toLowerCase())) : scripts;
  box.innerHTML = "";
  if (!filtered.length) { box.appendChild(el("div", "empty", "No scripts")); return; }
  filtered.slice(0, 400).forEach(s => {
    const row = el("div", "script-row", `<div class="sr-name">${escapeHtml(s.path || s.debugId)}</div><div class="sr-meta">${s.lines ?? "?"} ln</div><div class="sr-meta">${fmtBytes(s.bytes)}</div>`);
    row.onclick = () => toast("info", (s.path || s.debugId || "").split(".").pop());
    box.appendChild(row);
  });
}
function fmtBytes(b) { if (b == null) return "—"; return b < 1024 ? b + " B" : (b / 1024).toFixed(1) + " KB"; }

async function loadSemantic() {
  try {
    const s = state.mode === "demo" ? { provider: "openai", openai: { model: "text-embedding-3-small" }, saveEmbeddings: true } : await api("/api/semantic-settings");
    const prov = s.provider || "—", cfg = s[prov] || {};
    $("#semProvider").textContent = prov;
    $("#semModel").textContent = cfg.model || "—";
    $("#semCache").textContent = s.saveEmbeddings ? "Enabled" : "Disabled";
  } catch { $("#semProvider").textContent = "—"; $("#semModel").textContent = "—"; $("#semCache").textContent = "—"; }
}

function openConnect() { $("#connectModal").hidden = false; }
function closeConnect() { $("#connectModal").hidden = true; }
async function copyLoader() {
  const btn = $("#loaderCopy");
  try { await navigator.clipboard.writeText(LOADER); } catch {}
  btn.classList.add("done"); btn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Copied`;
  toast("ok", "Loader copied to clipboard");
  setTimeout(() => { btn.classList.remove("done"); btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>Copy`; }, 1800);
}

const CMD = [
  { group: "Navigate", label: "Overview", kind: "View", icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>', run: () => go("overview") },
  { group: "Navigate", label: "Server", kind: "View", icon: '<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/>', run: () => go("server") },
  { group: "Navigate", label: "Tools", kind: "View", icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>', run: () => go("tools") },
  { group: "Navigate", label: "Scripts", kind: "View", icon: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>', run: () => go("scripts") },
  { group: "Navigate", label: "Logs", kind: "View", icon: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>', run: () => go("logs") },
  { group: "Navigate", label: "Settings", kind: "View", icon: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 2h-4l-.3 3a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3h4l.3-3a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1z"/>', run: () => go("settings") },
  { group: "Actions", label: "Connect executor", kind: "Action", key: "conn", icon: '<path d="M9 2v6M15 2v6M8 8h8v3a4 4 0 0 1-8 0z"/><path d="M12 15v7"/>', run: openConnect },
  { group: "Actions", label: "Copy loader script", kind: "Action", icon: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', run: copyLoader },
  { group: "Actions", label: "Clear server logs", kind: "Action", icon: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', run: () => $("#logClear").click() },
  { group: "Actions", label: "Toggle aurora background", kind: "Action", icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>', run: () => { $("#setAurora").click(); } },
  { group: "Actions", label: "Toggle high contrast", kind: "Action", icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/>', run: () => $("#themeMode").click() },
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
  const groups = [...new Set(match.map(c => c.group))];
  groups.forEach(g => {
    box.appendChild(el("div", "cmd-group-label", g));
    match.filter(c => c.group === g).forEach(c => {
      const it = el("div", "cmd-item");
      const lead = c.client ? `<div class="ci-badge">${avatarInner(c.client)}</div>` : badge(c);
      it.innerHTML = `${lead}<span>${escapeHtml(c.label)}</span><kbd>${c.kind}</kbd>`;
      const idx = cmdItems.length;
      it.onmouseenter = () => { cmdSel = idx; markCmd(); };
      it.onclick = () => { c.run(); closeCmd(); };
      box.appendChild(it); cmdItems.push(it);
    });
  });
  markCmd();
}
function markCmd() { cmdItems.forEach((n, i) => n.classList.toggle("sel", i === cmdSel)); if (cmdItems[cmdSel]) cmdItems[cmdSel].scrollIntoView({ block: "nearest" }); }

function toast(kind, msg) {
  const t = el("div", "toast " + kind, `<i></i><span>${escapeHtml(msg)}</span>`);
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
    const it = el("div", "drop-item" + (c.clientId === state.selected ? " active" : ""), `<div class="di-avatar">${avatarInner(c)}</div><div><div class="di-name">${escapeHtml(c.username || "Client")}</div><div class="di-sub">${(c.transport || "ws").toUpperCase()} · ${String(c.clientId).slice(0, 8)}</div></div>`);
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

  $("#connectBtn").onclick = openConnect;
  $("#heroConnectBtn").onclick = openConnect;
  $("#connectClose").onclick = closeConnect;
  $("#loaderCopy").onclick = copyLoader;
  $("#connectModal").onclick = e => { if (e.target.id === "connectModal") closeConnect(); };

  $("#cmdOpen").onclick = openCmd;
  $("#cmdInput").oninput = e => paintCmd(e.target.value);
  $("#cmdInput").onkeydown = e => {
    if (e.key === "ArrowDown") { cmdSel = clamp(cmdSel + 1, 0, cmdItems.length - 1); markCmd(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { cmdSel = clamp(cmdSel - 1, 0, cmdItems.length - 1); markCmd(); e.preventDefault(); }
    else if (e.key === "Enter") { const it = cmdItems[cmdSel]; if (it) it.click(); }
  };
  $("#cmd").onclick = e => { if (e.target.id === "cmd") closeCmd(); };
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#cmd").hidden ? openCmd() : closeCmd(); }
    else if (e.key === "Escape") { closeCmd(); closeConnect(); $("#clientDrop").hidden = true; }
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
  wire();
  poll(); setInterval(poll, 3000);
  pollLogs(); setInterval(pollLogs, 4000);
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
