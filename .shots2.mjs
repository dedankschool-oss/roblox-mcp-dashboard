import { chromium } from "playwright";
const OUT = "D:/Users/dedan/Downloads/roblox-executor-mcp-main/roblox-executor-mcp-main/docs/dashboard";
const b = await chromium.launch({ channel: "msedge" });
const p = await b.newPage({ viewport: { width: 1440, height: 850 }, deviceScaleFactor: 1 });
const park = () => p.mouse.move(760, 800);
const go = async (v) => { await p.click(`.dock-item[data-view="${v}"]`); await park(); await p.waitForTimeout(650); };
const shot = async (n) => { await park(); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${n}.png` }); };
await p.goto("http://localhost:8791/", { waitUntil: "networkidle" });
await p.waitForTimeout(900);
await shot("overview");
await go("server"); await p.waitForTimeout(700); await shot("server");
await go("scripts"); await p.waitForTimeout(700);
try { await p.locator("#scriptTree .tree-row", { hasText: "DataService" }).first().click({ timeout: 2000 }); await park(); await p.waitForTimeout(600); } catch {}
await shot("scripts");
await go("tools"); await p.waitForTimeout(200); try { await p.click("#toolRun"); await park(); await p.waitForTimeout(600); } catch {}
await shot("tools");
await go("logs"); await p.waitForTimeout(300); await shot("logs");
await go("settings"); await p.waitForTimeout(300); await shot("settings");
await b.close(); console.log("lean shots done");
