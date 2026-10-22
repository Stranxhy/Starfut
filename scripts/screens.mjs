// Capturas de pantalla del panel para revisión visual (usa Chrome/Edge instalado).
//   node --env-file=.env scripts/screens.mjs <carpetaSalida> [baseUrl] [ruta1 ruta2 ...]
// Inicia sesión con ADMIN_EMAIL / ADMIN_PASSWORD a través del formulario real.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] || "test-output/screens";
const base = process.argv[3] || "http://localhost:3000";
const routes = process.argv.slice(4);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-MX" });
const page = await ctx.newPage();
await page.goto(`${base}/login`);
await page.fill("#email", process.env.ADMIN_EMAIL);
await page.fill("#password", process.env.ADMIN_PASSWORD);
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }), page.click("button[type=submit]")]);
if (process.env.SEASON) {
  await ctx.addCookies([{ name: "sf_season", value: process.env.SEASON, url: base }]);
}
const list = routes.length ? routes : ["/"];
for (const r of list) {
  const [route, mode] = r.split("@");
  if (mode === "mobile") await page.setViewportSize({ width: 390, height: 844 });
  else await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + route, { waitUntil: "networkidle", timeout: 120_000 });
  const name = (route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "dashboard") + (mode ? `_${mode}` : "");
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  console.log("✓", route, mode ?? "");
}
await browser.close();
