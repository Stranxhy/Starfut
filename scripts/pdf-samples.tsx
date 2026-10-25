// Genera muestras de TODOS los documentos PDF con la temporada de demostración
// y las rasteriza a PNG para revisión visual.
//
//   npm run pdf:samples          (tsx --conditions=react-server scripts/pdf-samples.tsx)
//
// Salida: test-output/pdf/*.pdf y test-output/pdf/png/*.png
// Usa el mismo registro y los mismos cargadores que el endpoint /api/pdf/[doc].
import { register } from "node:module";

// Con --conditions=react-server (necesario para "server-only"), Node resolvería
// "react" a su versión de servidor también dentro de @react-pdf, y el
// reconciliador del renderizador necesita la versión completa. Este gancho de
// resolución solo afecta a las importaciones hechas desde node_modules/@react-pdf.
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
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { getLeagueStandings } from "@/server/services/standings";
import { parseSource } from "@/domain/bracket";
import { DOC_DEFS, buildPdf, renderDoc, type PdfDocKey } from "@/pdf/registry";
import { loadBracket, type BracketDocData, type BracketSide } from "@/pdf/data";
import { PdfParamError } from "@/pdf/types";

const OUT = path.join(process.cwd(), "test-output", "pdf");

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "png"), { recursive: true });

  const season = await prisma.season.findFirst({
    where: { isDemo: true },
    include: { leagues: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  if (!season) throw new Error("No existe la temporada de demostración. Ejecuta: npm run db:demo");
  const premium = season.leagues.find((l) => l.name === "Premium") ?? season.leagues[0];
  const liga2 = season.leagues.find((l) => l.id !== premium.id) ?? premium;
  const topTeam = (await getLeagueStandings(premium.id)).rows[0];
  const someTeam = (await getLeagueStandings(liga2.id)).rows.at(-1);
  const cancelled = await prisma.match.findFirst({ where: { seasonId: season.id, status: "CANCELADO" }, include: { round: true } });
  const status = await prisma.sanction.findFirst({ where: { seasonId: season.id }, select: { status: true, team: { select: { leagueId: true } } } });

  const variants: [string, PdfDocKey, Record<string, string>][] = [
    ["tabla-general_premium", "tabla-general", { league: premium.id }],
    ["tabla-general_liga2", "tabla-general", { league: liga2.id }],
    ["tabla-general_premium_j7", "tabla-general", { league: premium.id, round: "7" }],
    ["goleo_premium", "goleo", { league: premium.id }],
    ["goleo_liga2_j5", "goleo", { league: liga2.id, round: "5" }],
    ["resultados_j13_todas", "resultados", { round: "13" }],
    ["resultados_j13_premium", "resultados", { round: "13", league: premium.id }],
    ["resultados_j14_pendientes", "resultados", { round: "14", league: liga2.id }],
    ["rol_j14_todas", "rol", { round: "14" }],
    ["rol_j14_premium", "rol", { round: "14", league: premium.id }],
    ["rol_j13_liga2", "rol", { round: "13", league: liga2.id }],
    ["sanciones_todas", "sanciones", {}],
    ["sanciones_filtradas", "sanciones", { league: status?.team.leagueId ?? premium.id, status: status?.status ?? "ACTIVA" }],
    ["eliminatorias_premium", "eliminatorias", { league: premium.id }],
    ["eliminatorias_liga2", "eliminatorias", { league: liga2.id }],
    ["equipos_todos", "equipos", {}],
    ["equipos_liga2", "equipos", { league: liga2.id }],
    ["calendario_completo", "calendario", {}],
    ["calendario_liga2", "calendario", { league: liga2.id }],
    ["historial_todas", "historial-resultados", {}],
    ["historial_equipo", "historial-resultados", { team: topTeam.teamId }],
    ["cancelaciones", "cancelaciones", {}],
    ["estadisticas_lider", "estadisticas-equipo", { team: topTeam.teamId }],
    ...(someTeam ? ([["estadisticas_ultimo_liga2", "estadisticas-equipo", { team: someTeam.teamId }]] as [string, PdfDocKey, Record<string, string>][]) : []),
  ];
  if (cancelled?.date) variants.push(["resultados_con_cancelado", "resultados", { date: cancelled.date.toISOString().slice(0, 10) }]);
  if (cancelled?.date) variants.push(["rol_con_cancelado", "rol", { date: cancelled.date.toISOString().slice(0, 10) }]);

  const files: string[] = [];
  for (const [name, key, params] of variants) {
    const t = Date.now();
    const { buffer, filename } = await buildPdf(key, season.id, new URLSearchParams(params));
    const file = path.join(OUT, `${name}.pdf`);
    fs.writeFileSync(file, buffer);
    files.push(file);
    console.log(`✔ ${name.padEnd(30)} ${filename.padEnd(48)} ${(buffer.length / 1024).toFixed(0).padStart(5)} KB  ${Date.now() - t} ms`);
  }

  // Cuadro de eliminatorias completo simulado en memoria (no toca la base de datos).
  const fake = await fakeBracket(premium.id, season.id);
  const built = await renderDoc(DOC_DEFS.eliminatorias.def, fake);
  const fakeFile = path.join(OUT, "eliminatorias_simulado_completo.pdf");
  fs.writeFileSync(fakeFile, built.buffer);
  files.push(fakeFile);
  console.log(`✔ ${"eliminatorias_simulado".padEnd(30)} ${built.filename}`);

  // Validación de parámetros (deben fallar con mensaje en español).
  const bad: [PdfDocKey, Record<string, string>][] = [
    ["tabla-general", {}],
    ["resultados", {}],
    ["rol", { round: "99" }],
    ["sanciones", { status: "XYZ" }],
    ["goleo", { league: "no-existe" }],
    ["resultados", { date: "2026-13-45" }],
  ];
  for (const [key, params] of bad) {
    try {
      await buildPdf(key, season.id, new URLSearchParams(params));
      console.log(`✘ ${key} ${JSON.stringify(params)} debió fallar`);
      process.exitCode = 1;
    } catch (e) {
      if (!(e instanceof PdfParamError)) throw e;
      console.log(`✔ 400 ${key} ${JSON.stringify(params)} → ${e.message}`);
    }
  }

  console.log("\nRasterizando a PNG…");
  execFileSync("python", [path.join("scripts", "pdf-to-png.py"), path.join(OUT, "png"), ...files, "--dpi", "100"], {
    stdio: "inherit",
  });
}

/** Construye un cuadro completo ficticio con los equipos reales de la liga. */
async function fakeBracket(leagueId: string, seasonId: string): Promise<BracketDocData> {
  const base = await loadBracket(seasonId, new URLSearchParams({ league: leagueId }));
  const seeds = (await getLeagueStandings(leagueId)).rows;
  const winners: Record<string, string[]> = {};
  const stages = base.stages.map((stage, si) => {
    winners[stage.code] = [];
    return {
      ...stage,
      ties: stage.ties.map((tie, ti) => {
        const sideFor = (s: BracketSide, raw: string): BracketSide => {
          const p = parseSource(raw);
          let name: string | undefined;
          if (p?.kind === "seed") name = seeds[p.position - 1]?.teamName;
          else if (p) name = winners[p.stage]?.[p.tie - 1];
          const seed = seeds.findIndex((r) => r.teamName === name) + 1;
          return { ...s, label: name ?? "Por definir", known: !!name, seed: seed || null };
        };
        const home = sideFor(tie.home, tie.home.sourceCode);
        const away = sideFor(tie.away, tie.away.sourceCode);
        const shootout = (si + ti) % 3 === 1;
        const hg = shootout ? 2 : 3 + ((si + ti) % 3);
        const ag = shootout ? 2 : (si + 2 * ti) % 3;
        const homeWins = shootout ? ti % 2 === 0 : hg > ag;
        home.goals = hg;
        away.goals = ag;
        if (shootout) {
          home.pens = homeWins ? 4 : 3;
          away.pens = homeWins ? 3 : 4;
        }
        home.winner = homeWins;
        away.winner = !homeWins;
        winners[stage.code][ti] = homeWins ? home.label : away.label;
        return {
          ...tie,
          home,
          away,
          info: `${["08/11/26", "15/11/26", "22/11/26", "29/11/26"][si] ?? "06/12/26"} · ${["9:00", "9:50", "10:40", "11:30"][ti % 4]} · Campo ${(ti % 5) + 1}`,
          status: "JUGADO",
        };
      }),
    };
  });
  const finalStage = stages.at(-1);
  return {
    ...base,
    stages,
    champion: finalStage ? (winners[finalStage.code][0] ?? null) : null,
    generated: true,
    frozenAt: "2026-11-01",
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
