import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { getLeagueStandings } from "@/server/services/standings";
import { Alert, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Table, TD, TH, withParams } from "@/components/ui/core";
import { formatLong } from "@/lib/dates";
import { STANDING_ABBR } from "@/lib/labels";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "Tabla general" };

/** Texto oscuro o claro según el color de fondo de la zona. */
function textOn(hex: string) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111" : "#fff";
}

export default async function TablaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx || ctx.leagues.length === 0) return <EmptyState title="Sin ligas configuradas" />;
  const sp = await searchParams;
  const leagueId = str(sp.liga) ?? ctx.leagues[0].id;
  const league = ctx.leagues.find((l) => l.id === leagueId) ?? ctx.leagues[0];
  const round = str(sp.jornada) ? Number(str(sp.jornada)) : undefined;
  const snapshot = await prisma.standingSnapshot.findUnique({ where: { leagueId_kind: { leagueId: league.id, kind: "CIERRE_FASE_REGULAR" } } });
  const view = str(sp.vista) ?? (snapshot ? "final" : "actual");
  const standings = await getLeagueStandings(league.id, { upToRound: round, useSnapshot: view === "final" && !round });
  const rounds = await prisma.round.findMany({ where: { seasonId: ctx.id, phase: "REGULAR" }, orderBy: { number: "asc" } });
  const showE = standings.rows.some((r) => r.e > 0);
  const nameById = new Map(standings.rows.map((r) => [r.teamId, r.teamName]));

  return (
    <>
      <PageHeader
        title="Tabla general"
        actions={<LinkButton href={withParams("/api/pdf/tabla-general", { league: league.id, round })} target="_blank">Generar PDF</LinkButton>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {ctx.leagues.map((l) => (
          <Link
            key={l.id}
            href={`/tabla?liga=${l.id}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${l.id === league.id ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-zinc-700 ring-zinc-300 hover:ring-brand-400"}`}
          >
            {l.name}
          </Link>
        ))}
        <form className="ml-auto flex items-center gap-2 text-xs">
          <input type="hidden" name="liga" value={league.id} />
          <input type="hidden" name="vista" value="actual" />
          <label htmlFor="jornada" className="font-semibold text-zinc-600">Hasta la jornada</label>
          <select id="jornada" name="jornada" defaultValue={round ?? ""} className="rounded-lg py-1.5 ring-1 ring-zinc-300">
            <option value="">Todas</option>
            {rounds.map((r) => <option key={r.id} value={r.number}>{r.number}</option>)}
          </select>
          <button className="rounded-lg bg-zinc-900 px-3 py-1.5 font-semibold text-white">Ver</button>
        </form>
      </div>
      {snapshot && (
        <Alert tone="info" className="mb-4">
          La fase regular de esta liga está cerrada. {view === "final" && !round ? "Se muestra la clasificación final congelada que originó las eliminatorias." : "Se muestra el cálculo a partir de los resultados."}{" "}
          <Link className="font-semibold underline" href={`/tabla?liga=${league.id}&vista=${view === "final" ? "actual" : "final"}`}>
            {view === "final" ? "Ver cálculo actual" : "Ver clasificación congelada"}
          </Link>
        </Alert>
      )}
      {standings.unresolvedGroups.length > 0 && (
        <Alert tone="warn" className="mb-4" title="Empates sin resolver">
          Los criterios configurados no separan a: {standings.unresolvedGroups.map((g) => g.map((id) => nameById.get(id)).join(", ")).join(" · ")}. Se muestran en orden alfabético; si afecta la clasificación, se pedirá la decisión oficial al cerrar la fase regular.
        </Alert>
      )}
      <Card>
        <CardHeader
          title={`${league.name}${round ? ` · hasta la jornada ${round}` : standings.throughRound ? ` · jornada ${standings.throughRound}` : ""}`}
          description={standings.lastResultDate ? `Actualizada con resultados al ${formatLong(standings.lastResultDate)}` : "Sin resultados oficiales"}
        />
        {standings.rows.length === 0 ? (
          <EmptyState title="Sin equipos" />
        ) : (
          <Table>
            <thead>
              <tr>
                <TH className="w-12 text-center">Pos</TH>
                <TH>Equipo</TH>
                {["JJ", "JG", "JP", "EG", "EP", ...(showE ? ["E"] : []), "GF", "GE", "DIF"].map((h) => (
                  <TH key={h} className="text-center" title={STANDING_ABBR[h]}>{h}</TH>
                ))}
                <TH className="text-center" title={STANDING_ABBR.PTS}>Puntos</TH>
              </tr>
            </thead>
            <tbody>
              {standings.rows.map((r) => (
                <tr key={r.teamId} style={r.zone ? { background: `${r.zone.color}33` } : undefined}>
                  <TD className="text-center">
                    <span className="inline-grid h-7 w-7 place-items-center rounded-md text-xs font-extrabold" style={r.zone ? { background: r.zone.color, color: textOn(r.zone.color) } : { background: "#e4e4e7" }} title={r.zone?.label}>
                      {r.position}
                    </span>
                  </TD>
                  <TD className="font-semibold">
                    <Link href={`/equipos/${r.teamId}`} className="hover:underline">{r.teamName}</Link>
                    {r.unresolvedTieGroup !== null && <Badge className="ml-2 bg-amber-100 text-amber-900 ring-amber-300">empate sin resolver</Badge>}
                  </TD>
                  {[r.jj, r.jg, r.jp, r.eg, r.ep, ...(showE ? [r.e] : []), r.gf, r.ge, r.dif].map((v, i) => (
                    <TD key={i} className="text-center tabular-nums">{v}</TD>
                  ))}
                  <TD className="text-center text-base font-extrabold tabular-nums">{r.pts}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600">
        {standings.zones.map((z) => (
          <span key={z.label} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: z.color }} aria-hidden />
            {z.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {Object.entries(STANDING_ABBR)
          .filter(([k]) => k !== "E" || showE)
          .map(([k, v]) => `${k}: ${v.split(" (")[0].toLowerCase()}`)
          .join(" · ")}
      </p>
    </>
  );
}
