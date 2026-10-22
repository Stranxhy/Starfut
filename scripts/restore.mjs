// Restauración de un respaldo creado con `npm run db:backup`.
//
//   npm run db:restore -- backups/archivo.dump --base starfutbol_restaurada
//       Restaura en una base NUEVA (se crea si no existe). Opción segura para verificar.
//
//   npm run db:restore -- backups/archivo.dump --reemplazar-base-actual
//       Sobrescribe la base configurada en DATABASE_URL. Operación destructiva:
//       detén la aplicación y crea un respaldo previo antes de usarla.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";

try { process.loadEnvFile(".env"); } catch {}
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file || !fs.existsSync(file)) {
  console.error("Indica el archivo de respaldo: npm run db:restore -- backups/archivo.dump --base <nueva_base>");
  process.exit(1);
}
const url = new URL(process.env.DATABASE_URL);
const user = decodeURIComponent(url.username);
const currentDb = url.pathname.slice(1);
const baseIdx = args.indexOf("--base");
const replace = args.includes("--reemplazar-base-actual");
const target = baseIdx >= 0 ? args[baseIdx + 1] : replace ? currentDb : null;
if (!target) {
  console.error("Elige --base <nueva_base> (recomendado) o --reemplazar-base-actual.");
  process.exit(1);
}
if (target === currentDb && !replace) {
  console.error("Para sobrescribir la base actual usa explícitamente --reemplazar-base-actual.");
  process.exit(1);
}
if (!/^[a-z0-9_]+$/i.test(target)) {
  console.error("Nombre de base inválido.");
  process.exit(1);
}
const container = process.env.DB_CONTAINER || "starfutbol-db";
const hasLocal = spawnSync("pg_restore", ["--version"], { stdio: "ignore" }).status === 0;
const run = (cmd, cmdArgs, input) =>
  hasLocal
    ? execFileSync(cmd, cmdArgs, { input, stdio: ["pipe", "inherit", "inherit"] })
    : execFileSync("docker", ["exec", "-i", container, cmd, ...cmdArgs], { input, stdio: ["pipe", "inherit", "inherit"] });

const dump = fs.readFileSync(file);
if (target !== currentDb) {
  const exists = spawnSync(hasLocal ? "psql" : "docker", [...(hasLocal ? [] : ["exec", container, "psql"]), "-U", user, "-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${target}'`], { encoding: "utf8" }).stdout.trim();
  if (exists === "1") {
    console.error(`La base "${target}" ya existe. Elige otro nombre para no sobrescribir datos.`);
    process.exit(1);
  }
  run("createdb", ["-U", user, target]);
}
run("pg_restore", ["-U", user, "-d", target, "--no-owner", ...(target === currentDb ? ["--clean", "--if-exists"] : [])], dump);
console.log(`✔ Respaldo restaurado en la base "${target}".`);
if (target !== currentDb) console.log(`  Para usarla, cambia el nombre de la base en DATABASE_URL a "${target}" y reinicia la aplicación.`);
