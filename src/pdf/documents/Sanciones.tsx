/** @jsxRuntime automatic */
import { formatLong, formatShort } from "@/lib/dates";
import { SANCTION_STATUS } from "@/lib/labels";
import { BrandHeader } from "../components/BrandHeader";
import { DataTable, type Column } from "../components/DataTable";
import { DocShell } from "../components/DocShell";
import { NoteBox, NoteText, StatCards, Tag } from "../components/Section";
import type { SanctionLine, SanctionsDocData } from "../data";
import { plural } from "../format";

export const SANCTION_COLORS: Record<string, string> = {
  ACTIVA: "#FF6B6B",
  PENDIENTE: "#FFC107",
  CUMPLIDA: "#81C784",
  CANCELADA: "#BDBDBD",
  EN_REVISION: "#4FC3F7",
};

const plain = { textTransform: "none" as const, fontWeight: 600, fontSize: 7 };

export function SancionesDoc({ data }: { data: SanctionsDocData }) {
  const { meta } = data;
  const columns: Column<SanctionLine>[] = [
    { key: "player", header: "Jugador", flex: 1.25, align: "left", render: (s) => s.player },
    { key: "team", header: "Equipo", flex: 1, render: (s) => s.team, textStyle: { fontSize: 7 } },
    { key: "type", header: "Tipo", flex: 1, render: (s) => s.type, textStyle: plain },
    { key: "reason", header: "Motivo", flex: 1.7, align: "left", render: (s) => s.reason, textStyle: plain },
    { key: "dur", header: "Duración", width: 48, render: (s) => String(s.duration) },
    { key: "unit", header: "Unidad", width: 76, render: (s) => s.unit, textStyle: { ...plain, fontSize: 6.6 } },
    {
      key: "served",
      header: "Cumplidos",
      width: 52,
      render: (s) => (s.unitKind === "PARTIDOS" ? `${Math.min(s.served, s.duration)}/${s.duration}` : s.served ? String(s.served) : "—"),
    },
    {
      key: "status",
      header: "Estado",
      width: 64,
      render: (s) => <Tag size={5.8} color={SANCTION_COLORS[s.status]}>{(SANCTION_STATUS[s.status]?.label ?? s.status).toUpperCase()}</Tag>,
    },
    { key: "date", header: "Fecha", width: 50, render: (s) => formatShort(s.date) },
  ];
  const count = (st: string) => data.rows.filter((r) => r.status === st).length;
  return (
    <DocShell meta={meta} orientation="landscape" title="Sanciones">
      <BrandHeader
        orientation="landscape"
        venue={meta.venue}
        block={{ kicker: "Reporte", title: "Sanciones", sub: "Control disciplinario" }}
        info={[meta.seasonName, `Emitido: ${formatLong(meta.generatedDate)}`, plural(data.rows.length, "sanción", "sanciones")]}
      />
      <StatCards
        items={[
          { label: "Total", value: data.rows.length },
          ...Object.keys(SANCTION_STATUS).map((k) => ({ label: SANCTION_STATUS[k].label, value: count(k) })),
        ]}
      />
      <NoteBox title="Filtros aplicados">
        <NoteText>{data.filters.length ? data.filters.join("   ·   ") : "Ninguno: se incluyen todas las sanciones de la temporada."}</NoteText>
      </NoteBox>
      <DataTable
        columns={columns}
        rows={data.rows}
        fontSize={7.4}
        rowHeight={18}
        emptyText="No hay sanciones que coincidan con los filtros."
      />
      <NoteBox>
        <NoteText>
          Cumplidos: partidos de suspensión ya cumplidos sobre el total (solo para sanciones por partidos). El sistema no convierte unidades
          ni aplica reglas disciplinarias automáticamente.
        </NoteText>
      </NoteBox>
    </DocShell>
  );
}
