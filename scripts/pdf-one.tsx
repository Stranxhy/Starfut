// Genera un solo PDF con los mismos cargadores del endpoint (útil para revisar un caso concreto).
//   tsx --conditions=react-server scripts/pdf-one.tsx <doc> <seasonId> "<query>" <salida.pdf>
//   ej.: ... rol cmv... "date=2026-10-25&league=cmv..." test-output/rol.pdf
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
import path from "node:path";
import { pathToFileURL } from "node:url";
export async function resolve(specifier, context, next) {
  if ((specifier === "react" || specifier.startsWith("react/")) && context.parentURL && context.parentURL.includes("/node_modules/@react-pdf/")) {
    const file = path.join(process.cwd(), "node_modules", specifier === "react" ? "react/index.js" : specifier + ".js");
    return { url: pathToFileURL(file).href, format: "commonjs", shortCircuit: true };
  }
  return next(specifier, context);
}`),
);

import fs from "node:fs";
import { buildPdf, type PdfDocKey } from "@/pdf/registry";
import { prisma } from "@/lib/prisma";

async function main() {
  const [doc, seasonId, query, out] = process.argv.slice(2);
  const { buffer, filename } = await buildPdf(doc as PdfDocKey, seasonId, new URLSearchParams(query));
  fs.writeFileSync(out, buffer);
  console.log(`✔ ${filename} → ${out}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
