import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSeasonContext } from "@/server/season";
import { buttonClass, Card, EmptyState, inputClass, PageHeader } from "@/components/ui/core";
import { formatShort, toISODate } from "@/lib/dates";
import { SANCTION_STATUS } from "@/lib/labels";

export const metadata = { title: "Reportes PDF" };

function Report({ title, description, doc, children }: { title: string; description: string; doc: string; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <form action={`/api/pdf/${doc}`} method="get" target="_blank" className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><FileText className="h-5 w-5" /></span>
          <h2 className="self-center font-bold text-zinc-900" title={description}>{title}</h2>
        </div>
        <div className="grid flex-1 content-start gap-2">{children}</div>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass("primary", "sm")}>Vista previa</button>
          <button name="download" value="1" className={buttonClass("secondary", "sm")}>Descargar</button>
        </div>
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

export default async function ReportesPage() {
  const ctx = await requireSeasonContext();
  if (!ctx) return <EmptyState title="Sin temporada" />;
  const [dates, rounds, teams, types] = await Promise.all([
    prisma.match.groupBy({ by: ["date"], where: { seasonId: ctx.id, date: { not: null } }, orderBy: { date: "desc" } }),
    prisma.round.findMany({ where: { seasonId: ctx.id, phase: "REGULAR" }, orderBy: { number: "asc" } }),
    prisma.team.findMany({ where: { seasonId: ctx.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.sanctionType.findMany({ orderBy: { name: "asc" } }),
  ]);
  const leagues = ctx.leagues.map((l) => ({ value: l.id, label: l.name }));
  const dateOpts = dates.map((d) => {
    const iso = toISODate(d.date)!;
    const r = rounds.find((x) => toISODate(x.date) === iso);
    return { value: iso, label: `${formatShort(iso)}${r ? ` · Jornada ${r.number}` : ""}` };
  });
  const roundOpts = rounds.map((r) => ({ value: String(r.number), label: `Jornada ${r.number} (${formatShort(r.date)})` }));
  const teamOpts = teams.map((t) => ({ value: t.id, label: t.name }));

  return (
    <>
      <PageHeader title="Reportes PDF" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Report title="Tabla general" description="Clasificación con zonas de color." doc="tabla-general">
          <Select name="league" label="Liga" options={leagues} required />
          <Select name="round" label="Hasta la jornada" options={roundOpts} placeholder="Última disponible" />
        </Report>
        <Report title="Tabla de goleo" description="Goleadores de mayor a menor." doc="goleo">
          <Select name="league" label="Liga" options={leagues} required />
          <Select name="round" label="Hasta la jornada" options={roundOpts} placeholder="Última disponible" />
        </Report>
        <Report title="Rol de juegos" description="Un PDF por liga: horario, campo, equipos y árbitro." doc="rol">
          {dateOpts.length ? <Select name="date" label="Fecha" options={dateOpts} required /> : <p className="text-xs text-zinc-500">Sin fechas programadas.</p>}
          <Select name="league" label="Liga" options={leagues} required />
        </Report>
        <Report title="Resultados" description="Marcadores de una fecha; pendientes y cancelados identificados." doc="resultados">
          {dateOpts.length ? <Select name="date" label="Fecha" options={dateOpts} required /> : <p className="text-xs text-zinc-500">Sin fechas programadas.</p>}
          <Select name="league" label="Liga" options={leagues} />
        </Report>
        <Report title="Sanciones" description="Reporte completo o filtrado." doc="sanciones">
          <Select name="league" label="Liga" options={leagues} />
          <Select name="team" label="Equipo" options={teamOpts} placeholder="Todos" />
          <Select name="status" label="Estado" options={Object.entries(SANCTION_STATUS).map(([value, v]) => ({ value, label: v.label }))} placeholder="Todos" />
          <Select name="type" label="Tipo" options={types.map((t) => ({ value: t.id, label: t.name }))} placeholder="Todos" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-zinc-700">Desde<input type="date" name="from" className={`${inputClass} mt-1`} /></label>
            <label className="text-xs font-semibold text-zinc-700">Hasta<input type="date" name="to" className={`${inputClass} mt-1`} /></label>
          </div>
        </Report>
        <Report title="Cuadro de eliminatorias" description="Cruces, resultados y campeón." doc="eliminatorias">
          <Select name="league" label="Liga" options={leagues} required />
        </Report>
        <Report title="Calendario completo" description="Todas las jornadas con horarios, canchas y árbitros." doc="calendario">
          <Select name="league" label="Liga" options={leagues} />
        </Report>
        <Report title="Historial de resultados" description="Partidos disputados agrupados por fecha." doc="historial-resultados">
          <Select name="league" label="Liga" options={leagues} />
          <Select name="team" label="Equipo" options={teamOpts} placeholder="Todos" />
        </Report>
        <Report title="Cancelaciones y reprogramaciones" description="Partidos cancelados, sustituciones y cambios de fecha." doc="cancelaciones">
          <Select name="league" label="Liga" options={leagues} />
        </Report>
        <Report title="Estadísticas por equipo" description="Posición, resultados, goleadores y próximos partidos." doc="estadisticas-equipo">
          <Select name="team" label="Equipo" options={teamOpts} required />
        </Report>
        <Report title="Listado de equipos" description="Equipos por liga (sin datos de contacto)." doc="equipos">
          <Select name="league" label="Liga" options={leagues} />
        </Report>
        <Report title="Listado de árbitros" description="Árbitros y partidos asignados (sin datos de contacto)." doc="arbitros" />
      </div>
    </>
  );
}
