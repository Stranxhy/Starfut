/** @jsxRuntime automatic */
import { Text, View } from "../primitives";
import { formatShort } from "@/lib/dates";
import { MATCH_STATUS, MATCH_TYPE } from "@/lib/labels";
import { BrandHeader } from "../components/BrandHeader";
import { DataTable, type Column } from "../components/DataTable";
import { DocShell } from "../components/DocShell";
import { SectionTitle } from "../components/Section";
import { colors, FONT_BODY } from "../theme";
import { fieldLabel, plural, timeLabel } from "../format";
import type { CancellationsDocData, MatchLine } from "../data";

const plain = { textTransform: "none" as const, fontWeight: 600, fontSize: 7 };
const roundLabel = (m: MatchLine) =>
  m.round ? (m.roundPhase === "REGULAR" ? `J${m.round}` : (m.stageName ?? "Elim.")) : "—";

type C = CancellationsDocData["cancelled"][number];
type R = CancellationsDocData["rescheduled"][number];

export function CancelacionesDoc({ data }: { data: CancellationsDocData }) {
  const { meta } = data;
  const cancelCols: Column<C>[] = [
    { key: "date", header: "Fecha", width: 50, render: (m) => formatShort(m.date) },
    { key: "round", header: "Jornada", width: 48, render: roundLabel },
    { key: "time", header: "Horario", width: 44, render: (m) => timeLabel(m.time) },
    { key: "match", header: "Partido", flex: 1.3, render: (m) => `${m.home} vs ${m.away}` },
    {
      key: "reason",
      header: "Motivo",
      flex: 1.4,
      align: "left",
      render: (m) => m.cancelReason ?? "Sin motivo registrado",
      textStyle: plain,
    },
    {
      key: "rep",
      header: "Partido de reemplazo",
      flex: 1.4,
      align: "left",
      render: (m) =>
        m.replacements.length ? (
          <View>
            {m.replacements.map((r) => (
              <Text key={r.id} style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 6.8, color: colors.white }}>
                {r.home} vs {r.away} · {MATCH_TYPE[r.type]?.short ?? r.type} · {formatShort(r.date)} {timeLabel(r.time)} ·{" "}
                {MATCH_STATUS[r.status]?.label ?? r.status}
              </Text>
            ))}
          </View>
        ) : (
          "Sin reemplazo"
        ),
      textStyle: plain,
    },
  ];
  const reCols: Column<R>[] = [
    { key: "round", header: "Jornada", width: 48, render: roundLabel },
    { key: "match", header: "Partido", flex: 1.5, render: (m) => `${m.home} vs ${m.away}` },
    { key: "orig", header: "Fecha original", width: 72, render: (m) => (m.previousDate ? formatShort(m.previousDate) : "—") },
    { key: "new", header: "Nueva fecha", width: 64, render: (m) => formatShort(m.date) },
    { key: "time", header: "Horario", width: 46, render: (m) => timeLabel(m.time) },
    { key: "field", header: "Campo", width: 42, render: (m) => fieldLabel(m.field) },
    { key: "count", header: "Veces", width: 40, render: (m) => (m.rescheduleCount ? String(m.rescheduleCount) : "—") },
    { key: "status", header: "Estado", width: 74, render: (m) => MATCH_STATUS[m.status]?.label ?? m.status },
  ];
  return (
    <DocShell meta={meta} orientation="landscape" title="Cancelaciones y reprogramaciones">
      <BrandHeader
        orientation="landscape"
        venue={meta.venue}
        block={{ name: data.leagueName, title: "Cancelaciones", sub: "y reprogramaciones" }}
        info={[meta.seasonName, plural(data.cancelled.length, "cancelado", "cancelados"), plural(data.rescheduled.length, "reprogramado", "reprogramados")]}
      />
      <SectionTitle right={plural(data.cancelled.length, "partido", "partidos")}>PARTIDOS CANCELADOS</SectionTitle>
      <DataTable columns={cancelCols} rows={data.cancelled} fontSize={7.4} rowHeight={18} emptyText="No hay partidos cancelados." />
      <SectionTitle right={plural(data.rescheduled.length, "partido", "partidos")}>PARTIDOS REPROGRAMADOS</SectionTitle>
      <DataTable columns={reCols} rows={data.rescheduled} fontSize={7.4} rowHeight={17} emptyText="No hay partidos reprogramados." />
    </DocShell>
  );
}
