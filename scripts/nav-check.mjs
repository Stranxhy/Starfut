// Verifica que la navegación dentro de la aplicación responda (clics reales en el navegador).
// Detecta bloqueos como el de pestañas por liga (/tabla?liga=…) y mide el tiempo de cada cambio.
//   node --env-file=.env scripts/nav-check.mjs [baseUrl]
// Variable opcional SEASON=<id> para elegir la temporada.
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://localhost:3000";
const LIMIT = 5000; // ms
const b = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${base}/login`);
await page.fill("#email", process.env.ADMIN_EMAIL);
await page.fill("#password", process.env.ADMIN_PASSWORD);
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
if (process.env.SEASON) await ctx.addCookies([{ name: "sf_season", value: process.env.SEASON, url: base }]);

let failed = 0;
async function check(label, start, click) {
  await page.goto(base + start);
  await page.waitForLoadState("networkidle");
  const before = page.url();
  const t = Date.now();
  await click();
  const ok = await page
    .waitForFunction((u) => location.href !== u, before, { timeout: LIMIT })
    .then(() => page.waitForLoadState("networkidle").then(() => true))
    .catch(() => false);
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${label.padEnd(48)} ${ok ? `${Date.now() - t} ms` : `sin respuesta en ${LIMIT / 1000} s`}`);
}
const main = page.locator("main");
const tab = (name) => () => main.getByRole("link", { name, exact: true }).first().click();
const side = (name) => () => page.locator("aside").getByRole("link", { name, exact: true }).click();
const second = async () => {
  const names = await main.locator("a.rounded-full").allInnerTexts();
  await main.locator("a.rounded-full").nth(1).click();
  return names;
};

await check("Tabla general → pestaña de otra liga", "/tabla", second);
await check("Goleo → pestaña de otra liga", "/goleo", second);
await check("Eliminatorias → pestaña de otra liga", "/eliminatorias", second);
await check("Configuración → Catálogos de sanciones", "/configuracion", tab("Catálogos de sanciones"));
await check("Configuración → Puntuación y desempates", "/configuracion", tab("Puntuación y desempates"));
await check("Ligas → Ver liga", "/ligas", tab("Ver"));
await check("Equipos → página 2", "/equipos?estado=todos", tab("Siguiente →"));
await check("Menú → Resultados", "/", side("Resultados"));
await check("Menú → PDF para WhatsApp", "/", side("PDF para WhatsApp"));
await check("Menú → Sanciones", "/tabla", side("Sanciones"));
await b.close();
console.log(failed ? `\n${failed} navegación(es) bloqueada(s)` : "\nTodas las navegaciones respondieron");
process.exit(failed ? 1 : 0);
