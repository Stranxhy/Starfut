// Prueba de humo: genera una sesión válida para el primer administrador y
// solicita cada página del panel, verificando que responda 200 sin errores.
//   node --env-file=.env scripts/smoke.mjs [baseUrl]
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const base = process.argv[2] || "http://localhost:3000";
const prisma = new PrismaClient();
const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
const token = await new SignJWT({ role: admin.role, name: admin.name })
  .setProtectedHeader({ alg: "HS256" }).setSubject(admin.id).setIssuedAt().setExpirationTime("1h").sign(secret);

const extra = process.argv.slice(3);
const paths = extra.length ? extra : [
  "/", "/ligas", "/equipos", "/jugadores", "/calendario", "/partidos", "/resultados", "/tabla", "/goleo",
  "/sanciones", "/eliminatorias", "/reportes", "/historial", "/usuarios", "/configuracion",
  "/configuracion/horarios-canchas", "/configuracion/reglas", "/configuracion/eliminatorias", "/configuracion/temporadas",
  "/configuracion/catalogos",
];
let failed = 0;
for (const p of paths) {
  const t = Date.now();
  const res = await fetch(base + p, { headers: { cookie: `sf_session=${token}${process.env.SEASON ? `; sf_season=${process.env.SEASON}` : ""}` }, redirect: "manual" });
  const body = await res.text();
  const bad = p.startsWith("/api/pdf")
    ? res.status !== 200 || !body.startsWith("%PDF")
    : res.status !== 200 || /Application error|Unhandled Runtime Error|__next_error__/.test(body);
  if (bad) failed++;
  console.log(`${bad ? "✗" : "✓"} ${res.status} ${p} (${Date.now() - t} ms)`);
}
const unauth = await fetch(base + "/equipos", { redirect: "manual" });
console.log(`${unauth.status === 307 ? "✓" : "✗"} sin sesión → ${unauth.status} ${unauth.headers.get("location") ?? ""}`);
if (unauth.status !== 307) failed++;
await prisma.$disconnect();
process.exit(failed ? 1 : 0);
