// Se ejecuta antes de `npm run build`. Limpia la carpeta de compilación .next.
// En Windows dentro de OneDrive, la recrea con el atributo "mantener siempre en
// este dispositivo" para que OneDrive no convierta sus archivos en marcadores de
// posición durante la compilación (provoca errores EINVAL readlink).
import fs from "node:fs";
import { spawnSync } from "node:child_process";

fs.rmSync(".next", { recursive: true, force: true });
fs.mkdirSync(".next");
if (process.platform === "win32") spawnSync("attrib", ["+P", "-U", ".next"], { stdio: "ignore" });
