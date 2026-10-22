// Respaldo completo de PostgreSQL en formato personalizado (pg_dump -Fc).
//   npm run db:backup                 → backups/starfutbol_AAAA-MM-DD_HH-MM.dump
// Usa pg_dump local si existe; si no, el del contenedor Docker "starfutbol-db".
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

try { process.loadEnvFile(".env"); } catch {}
const url = new URL(process.env.DATABASE_URL);
const db = url.pathname.slice(1);
const user = decodeURIComponent(url.username);
const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
fs.mkdirSync("backups", { recursive: true });
const file = path.join("backups", `starfutbol_${stamp}.dump`);

const hasLocal = spawnSync("pg_dump", ["--version"], { stdio: "ignore" }).status === 0;
let data;
if (hasLocal) {
  data = execFileSync("pg_dump", ["-Fc", "-d", process.env.DATABASE_URL.split("?")[0]], { maxBuffer: 1 << 30 });
} else {
  const container = process.env.DB_CONTAINER || "starfutbol-db";
  data = execFileSync("docker", ["exec", container, "pg_dump", "-Fc", "-U", user, db], { maxBuffer: 1 << 30 });
}
fs.writeFileSync(file, data);
console.log(`✔ Respaldo creado: ${file} (${(data.length / 1024).toFixed(1)} KB)`);
