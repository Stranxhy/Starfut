// Prueba de extremo a extremo con navegador real (Chrome/Edge instalado).
// Recorre el flujo completo de un administrador en una temporada NUEVA:
// crear temporada → importar equipos → generar y confirmar calendario →
// capturar resultados → tabla → cancelar y sustituir → PDF → historial → salir.
//
//   node --env-file=.env scripts/e2e.mjs http://localhost:3200 [carpetaCapturas]
// Ejecútalo contra una base de pruebas (ver docs/PRUEBAS.md), no contra datos reales.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] || "http://localhost:3200";
const shots = process.argv[3] || "test-output/e2e";
fs.mkdirSync(shots, { recursive: true });
const tag = Date.now().toString().slice(-6);
const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    results.push({ name, ok: false, error: String(e).split("\n")[0] });
    console.log(`✗ ${name}: ${String(e).split("\n")[0]}`);
    await page.screenshot({ path: path.join(shots, `ERROR_${name.replace(/\W+/g, "_")}.png`), fullPage: true }).catch(() => {});
  }
};
const shot = (n) => page.screenshot({ path: path.join(shots, `${n}.png`), fullPage: true });
const toast = (re) => page.locator("[data-sonner-toast]").filter({ hasText: re }).first().waitFor({ timeout: 30_000 });

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-MX" });
const page = await ctx.newPage();
page.setDefaultTimeout(30_000);

await step("Rechaza credenciales incorrectas", async () => {
  await page.goto(`${base}/login`);
  await page.fill("#email", process.env.ADMIN_EMAIL);
  await page.fill("#password", "incorrecta123");
  await page.click("button[type=submit]");
  await page.getByText("Correo o contraseña incorrectos").waitFor();
});

await step("Inicio de sesión", async () => {
  await page.fill("#password", process.env.ADMIN_PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
  await page.getByRole("heading", { name: "Inicio" }).waitFor();
});

await step("Crear temporada vigente", async () => {
  await page.goto(`${base}/configuracion/temporadas`);
  await page.getByRole("button", { name: "Nueva temporada" }).click();
  const dlg = page.locator("dialog[open]");
  await dlg.locator("input[name=name]").fill(`E2E ${tag}`);
  const start = new Date(Date.now() + 86_400_000 * 3).toISOString().slice(0, 10);
  await dlg.locator("input[name=startDate]").fill(start);
  await dlg.getByLabel("Marcar como temporada vigente").check();
  await dlg.getByRole("button", { name: "Crear" }).click();
  await toast(/creada/);
  // Selecciona la temporada en el selector superior
  const option = page.locator("header select option", { hasText: `E2E ${tag}` });
  const value = await option.getAttribute("value");
  await page.locator("header select").selectOption(value);
  await page.waitForTimeout(1500);
  await page.goto(`${base}/`);
  await page.locator("main").getByText(`E2E ${tag}`).first().waitFor();
});

await step("Importar equipos por CSV", async () => {
  await page.goto(`${base}/equipos`);
  await page.getByRole("button", { name: "Importar CSV" }).click();
  const dlg = page.locator("dialog[open]");
  const premium = Array.from({ length: 8 }, (_, i) => `Premium ${tag}-${i + 1},Premium`);
  const liga2 = Array.from({ length: 5 }, (_, i) => `Liga2 ${tag}-${i + 1},Liga 2`);
  await dlg.locator("textarea[name=csv]").fill(["nombre,liga", ...premium, ...liga2, `Premium ${tag}-1,Premium`].join("\n"));
  await dlg.getByRole("button", { name: "Importar" }).click();
  await toast(/13 equipo/);
  await page.goto(`${base}/equipos?estado=todos`);
  await page.getByText(`Premium ${tag}-8`).waitFor();
});

await step("Detecta equipo duplicado", async () => {
  await page.getByRole("button", { name: "Nuevo equipo" }).click();
  const dlg = page.locator("dialog[open]");
  await dlg.locator("input[name=name]").fill(`premium ${tag}-1`);
  await dlg.getByRole("button", { name: "Registrar equipo" }).click();
  await dlg.getByText(/Ya existe un equipo/).first().waitFor();
  await dlg.getByRole("button", { name: "Cancelar" }).click();
});

await step("Generar vista previa del calendario", async () => {
  await page.goto(`${base}/calendario`);
  await page.getByRole("button", { name: "Generar vista previa" }).click();
  await page.getByText("Vista previa del calendario (provisional)").waitFor();
  await page.getByText("Repeticiones matemáticamente inevitables").first().waitFor(); // Liga 2 con 5 equipos
  await shot("01_vista_previa");
});

await step("Confirmar calendario (con advertencias)", async () => {
  await page.getByRole("button", { name: "Confirmar calendario" }).click();
  await page.getByRole("button", { name: "Acepto las advertencias y confirmo" }).click();
  await toast(/Calendario confirmado/);
  await page.getByText("Jornada 14").first().waitFor();
  await shot("02_jornadas");
});

let firstDate;
await step("Capturar resultados (regular y desempate)", async () => {
  await page.goto(`${base}/resultados`);
  firstDate = await page.locator("select#date").inputValue();
  const items = page.locator("main li").filter({ has: page.locator("input[name=homeGoals]") });
  const a = items.nth(0);
  await a.locator("input[name=homeGoals]").fill("2");
  await a.locator("input[name=awayGoals]").fill("1");
  await a.getByRole("button", { name: "Guardar" }).click();
  await toast(/Resultado guardado/);
  const b = items.nth(1);
  await b.locator("input[name=homeGoals]").fill("1");
  await b.locator("input[name=awayGoals]").fill("1");
  await b.locator("input[name=homeShootout]").fill("4");
  await b.locator("input[name=awayShootout]").fill("3");
  await b.getByRole("button", { name: "Guardar" }).click();
  await toast(/Resultado guardado/);
  await shot("03_resultados");
});

await step("Tabla general refleja 3 y 2 puntos", async () => {
  await page.goto(`${base}/tabla`);
  const pts = await page.locator("tbody tr td:last-child").allInnerTexts();
  const nums = pts.map(Number);
  if (!nums.includes(3) || !nums.includes(2) || !nums.includes(1)) throw new Error(`Puntos inesperados: ${nums.join(",")}`);
  await shot("04_tabla");
});

await step("Corrección de resultado exige motivo", async () => {
  await page.goto(`${base}/resultados?date=${firstDate}`);
  const a = page.locator("main li").filter({ has: page.locator("input[name=homeGoals]") }).nth(0);
  await a.locator("input[name=homeGoals]").fill("0");
  await a.getByRole("button", { name: "Corregir" }).click();
  await a.getByText(/motivo/i).first().waitFor();
  await a.locator("input[name=reason]").fill("Error en el acta");
  await a.getByRole("button", { name: "Corregir" }).click();
  await toast(/Resultado guardado/);
});

await step("Cancelar partido y crear sustitución", async () => {
  await page.goto(`${base}/partidos?jornada=2`);
  await page.getByRole("link", { name: "Abrir" }).first().click();
  await page.getByRole("button", { name: "Cancelar partido" }).click();
  const dlg = page.locator("dialog[open]");
  await dlg.locator("textarea[name=reason]").fill("Equipo visitante sin jugadores suficientes");
  await dlg.getByRole("button", { name: "Cancelar partido" }).click();
  await toast(/cancelado/i);
  await page.getByRole("link", { name: "Crear partido en este espacio" }).click();
  await page.getByText("Aprovechar el espacio de un partido cancelado").waitFor();
  await page.getByLabel(/Amistoso/).check();
  // Usa las sugerencias de equipos libres en ese horario (sin ⚠ = no juegan ese día)
  const free = page.locator("button[title='No juega ese día']");
  await free.nth(0).click();
  await free.nth(1).click();
  await page.getByRole("button", { name: "Crear partido" }).click();
  const confirm = page.getByRole("button", { name: "Guardar a pesar de las advertencias" });
  await Promise.race([confirm.click({ timeout: 8000 }).catch(() => {}), page.waitForURL(/\/partidos\/c/, { timeout: 8000 }).catch(() => {})]);
  await page.waitForURL(/\/partidos\/c[a-z0-9]+$/);
  await page.getByText("Sustituye a").waitFor();
  await shot("05_sustitucion");
});

await step("PDF de tabla general disponible", async () => {
  const league = await page.goto(`${base}/tabla`).then(() => page.locator("a", { hasText: "Generar PDF" }).getAttribute("href"));
  const res = await page.request.get(base + league);
  if (res.status() !== 200 || !res.headers()["content-type"]?.includes("pdf")) throw new Error(`Respuesta ${res.status()} ${res.headers()["content-type"]}`);
  const body = await res.body();
  if (body.subarray(0, 4).toString() !== "%PDF") throw new Error("No es un PDF");
});

await step("Historial registra los cambios", async () => {
  await page.goto(`${base}/historial`);
  for (const t of ["Calendario confirmado", "Corrección de resultado", "Cancelación"]) await page.locator("main ol").getByText(t).first().waitFor();
  await shot("06_historial");
});

await step("Cerrar sesión protege el panel", async () => {
  await page.goto(`${base}/`);
  await page.getByRole("button", { name: /Salir/ }).click();
  await page.waitForURL(/\/login/);
  await page.goto(`${base}/equipos`);
  await page.waitForURL(/\/login/);
  const api = await page.request.get(`${base}/api/pdf/equipos`);
  if (api.status() !== 401) throw new Error(`API sin sesión devolvió ${api.status()}`);
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pasos correctos`);
fs.writeFileSync(path.join(shots, "resultado.json"), JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
