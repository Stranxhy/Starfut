// Prepara una base de datos de pruebas aislada (nunca la de desarrollo).
// Solo aplica migraciones (operación no destructiva); cada prueba crea su propia
// temporada con nombre único, por lo que no es necesario vaciar la base.
import { execSync } from "node:child_process";

export default function setup() {
  try {
    process.loadEnvFile(".env");
  } catch {}
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Define TEST_DATABASE_URL en .env para las pruebas de integración.");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL no puede ser igual a DATABASE_URL.");
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "pipe",
  });
}
