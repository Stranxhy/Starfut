import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { matchDays } from "@/server/services/matchdays";
import { WhatsAppPdfs } from "@/components/WhatsAppPdfs";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { buttonClass, Card, Collapsible, EmptyState, inputClass, PageHeader } from "@/components/ui/core";
import { formatShort, todayISO } from "@/lib/dates";
import { SANCTION_STATUS } from "@/lib/labels";
import { str, type SP } from "@/lib/params";

export const metadata = { title: "PDF para WhatsApp" };

function Report({ title, doc, children }: { title: string; doc: string; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <form action={`/api/pdf/${doc}`} method="get" target="_blank" className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><FileText className="h-5 w-5" /></span>
          <h3 className="font-bold text-zinc-900">{title}</h3>
        </div>
        <div className="grid flex-1 content-start gap-2">{children}</div>
        <button className={buttonClass("secondary", "sm")}>Abrir PDF</button>
      </form>
    </Card>
  );
}

function Select({ name, label, options, required, placeholder }: { name: string; label: string; options: { value: string; label: string }[]; required?: boolean; placeholder?: string }) {
  return (
    <label className="text-xs font-semibold text-zinc-700">
      {label}
      <select name={name} required={required} className={`${inputClass} mt-1`} defaultValue={required ? options[0]?.value : ""}>
        {!required && <option value="">{placeholder ?? "Todas"}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export default async function ReportesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const sp = await searchParams;
  const [days, teams, types, perLeague] = await Promise.all([
    matchDays(ctx.id),
    prisma.team.findMany({ where: { seasonId: ctx.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.sanctionType.findMany({ orderBy: { name: "asc" } }),
    prisma.team.groupBy({ by: ["leagueId"], where: { seasonId: ctx.id, active: true }, _count: true }),
  ]);
  const pick = (v: string | undefined, fallback: string | null) => (v && days.all.includes(v) ? v : fallback);
  const rolDate = pick(str(sp.rol), days.rolDate);
  const resultsDate = pick(str(sp.resultados), days.resultsDate);
  const today = todayISO();
  // Solo ligas activas con equipos: evita tarjetas vacías.
  const withTeams = new Set(perLeague.map((g) => g.leagueId));
  const leagues = ctx.leagues.filter((l) => l.active && withTeams.has(l.id)).map((l) => ({ id: l.id, name: l.name }));
  const leagueOpts = ctx.leagues.map((l) => ({ value: l.id, label: l.name }));
  const teamOpts = teams.map((t) => ({ value: t.id, label: t.name }));

  return (
    <>
      <PageHeader title="PDF para WhatsApp" description="Un PDF por liga. Toca un documento para abrirlo, o la flecha para descargarlo." />

      {days.all.length > 0 && (
        <form className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="font-semibold text-zinc-600">Rol del</span>
            <AutoSubmitSelect name="rol" defaultValue={rolDate ?? ""} className="rounded-lg py-1.5 ring-1 ring-zinc-300">
              {days.all.map((d) => <option key={d} value={d}>{formatShort(d)}</option>)}
            </AutoSubmitSelect>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold text-zinc-600">Resultados del</span>
            <AutoSubmitSelect name="resultados" defaultValue={resultsDate ?? ""} className="rounded-lg py-1.5 ring-1 ring-zinc-300">
              {days.all.filter((d) => d <= today || d === resultsDate).map((d) => <option key={d} value={d}>{formatShort(d)}</option>)}
            </AutoSubmitSelect>
          </label>
        </form>
      )}

      {leagues.length ? (
        <WhatsAppPdfs leagues={leagues} rolDate={rolDate} resultsDate={resultsDate} />
      ) : (
        <Card>
          <EmptyState title="Aún no hay equipos registrados" description="Registra los equipos de cada liga para generar sus PDF." />
        </Card>
      )}

      <Collapsible title="Otros documentos" className="mt-6">
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          <Report title="Sanciones" doc="sanciones">
            <Select name="league" label="Liga" options={leagueOpts} />
            <Select name="status" label="Estado" options={Object.entries(SANCTION_STATUS).map(([value, v]) => ({ value, label: v.label }))} placeholder="Todos" />
            <Select name="type" label="Tipo" options={types.map((t) => ({ value: t.id, label: t.name }))} placeholder="Todos" />
          </Report>
          <Report title="Cuadro de eliminatorias" doc="eliminatorias">
            <Select name="league" label="Liga" options={leagueOpts} required />
          </Report>
          <Report title="Calendario completo" doc="calendario">
            <Select name="league" label="Liga" options={leagueOpts} required />
          </Report>
          <Report title="Historial de resultados" doc="historial-resultados">
            <Select name="league" label="Liga" options={leagueOpts} required />
            <Select name="team" label="Equipo" options={teamOpts} placeholder="Todos" />
          </Report>
          <Report title="Cancelaciones y reprogramaciones" doc="cancelaciones">
            <Select name="league" label="Liga" options={leagueOpts} required />
          </Report>
          <Report title="Estadísticas de un equipo" doc="estadisticas-equipo">
            <Select name="team" label="Equipo" options={teamOpts} required />
          </Report>
          <Report title="Listado de equipos" doc="equipos">
            <Select name="league" label="Liga" options={leagueOpts} required />
          </Report>
        </div>
      </Collapsible>
    </>
  );
}
