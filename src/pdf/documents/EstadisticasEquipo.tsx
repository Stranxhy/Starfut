/** @jsxRuntime automatic */
import { View } from "../primitives";
import { formatShort } from "@/lib/dates";
import { MATCH_STATUS } from "@/lib/labels";
import { BrandHeader } from "../components/BrandHeader";
import { DataTable, type Column } from "../components/DataTable";
import { DocShell } from "../components/DocShell";
import { NoteBox, NoteText, SectionTitle, StatCards, Tag } from "../components/Section";
import { colors } from "../theme";
import { fieldLabel, plural, timeLabel } from "../format";
import type { TeamStatsDocData } from "../data";

type Res = TeamStatsDocData["results"][number];
type Up = TeamStatsDocData["upcoming"][number];
type Sc = TeamStatsDocData["scorers"][number];

const OUTCOME: Record<string, { label: string; color: string }> = {
  G: { label: "GANADO", color: "#81C784" },
  P: { label: "PERDIDO", color: "#FF8A80" },
  EG: { label: "EMPATE GANADO", color: "#AED581" },
  EP: { label: "EMPATE PERDIDO", color: "#FFB74D" },
  E: { label: "EMPATE", color: "#E0E0E0" },
};

const roundLabel = (m: Res | Up) =>
  m.round ? (m.roundPhase === "REGULAR" ? `J${m.round}` : (m.stageName ?? "Elim.")) : m.type === "AMISTOSO" ? "Amistoso" : "—";

/** Marcador desde el punto de vista del equipo: goles propios primero. */
function teamScore(m: Res): string {
  if (!m.result) return "—";
  const mine = m.venueSide === "L";
  const gf = mine ? m.result.home : m.result.away;
  const ge = mine ? m.result.away : m.result.home;
  const so =
    m.result.homeSO != null && m.result.awaySO != null
      ? ` (${mine ? m.result.homeSO : m.result.awaySO}-${mine ? m.result.awaySO : m.result.homeSO} pen.)`
      : "";
  return `${gf} - ${ge}${so}`;
}

export function EstadisticasEquipoDoc({ data }: { data: TeamStatsDocData }) {
  const { meta, standing: s } = data;
  const resultCols: Column<Res>[] = [
    { key: "date", header: "Fecha", width: 50, render: (m) => formatShort(m.date) },
    { key: "round", header: "Jornada", width: 50, render: roundLabel },
    { key: "side", header: "L/V", width: 30, render: (m) => m.venueSide },
    { key: "rival", header: "Rival", flex: 1.4, render: (m) => m.rival },
    { key: "score", header: "Marcador", width: 96, render: (m) => teamScore(m) },
    {
      key: "out",
      header: "Resultado",
      width: 86,
      render: (m) =>
        m.type === "AMISTOSO" ? (
          <Tag color="#4FC3F7">AMISTOSO</Tag>
        ) : (
          <Tag color={OUTCOME[m.outcome]?.color}>{OUTCOME[m.outcome]?.label ?? m.outcome}</Tag>
        ),
    },
  ];
  const upCols: Column<Up>[] = [
    { key: "date", header: "Fecha", width: 50, render: (m) => formatShort(m.date) },
    { key: "round", header: "Jornada", width: 50, render: roundLabel },
    { key: "time", header: "Horario", width: 46, render: (m) => timeLabel(m.time) },
    { key: "field", header: "Campo", width: 40, render: (m) => fieldLabel(m.field) },
    { key: "side", header: "L/V", width: 30, render: (m) => m.venueSide },
    { key: "rival", header: "Rival", flex: 1.4, render: (m) => m.rival },
    { key: "status", header: "Estado", width: 76, render: (m) => MATCH_STATUS[m.status]?.label ?? m.status },
  ];
  const scorerCols: Column<Sc>[] = [
    { key: "pos", header: "#", width: 30, render: (r) => String(r.position) },
    { key: "name", header: "Jugador", flex: 1, align: "left", render: (r) => r.name },
    { key: "goals", header: "Goles", width: 60, render: (r) => String(r.goals) },
  ];
  return (
    <DocShell meta={meta} title={`Estadísticas ${data.team.name}`}>
      <BrandHeader
        venue={meta.venue}
        block={{ kicker: `Liga ${data.team.league}`, name: data.team.name, title: "Estadísticas" }}
        info={[
          meta.seasonName,
          data.throughRound ? `Hasta la jornada ${data.throughRound}` : null,
          data.team.active ? null : "Equipo inactivo",
        ]}
      />
      {s ? (
        <StatCards
          items={[
            { label: `Lugar de ${data.teamsInLeague}`, value: `${s.position}.º` },
            { label: "Puntos", value: s.pts },
            { label: "Jugados", value: s.jj },
            { label: "Ganados", value: s.jg },
            { label: "Perdidos", value: s.jp },
            { label: "Emp. ganados", value: s.eg },
            { label: "Emp. perdidos", value: s.ep },
            ...(data.showDraws ? [{ label: "Empates", value: s.e }] : []),
            { label: "GF", value: s.gf },
            { label: "GE", value: s.ge },
            { label: "DIF", value: s.dif > 0 ? `+${s.dif}` : s.dif },
          ]}
        />
      ) : (
        <NoteBox>
          <NoteText>El equipo no figura en la tabla general (inactivo y sin partidos oficiales).</NoteText>
        </NoteBox>
      )}
      {s?.zone ? (
        <View style={{ marginTop: 4, alignItems: "center" }}>
          <Tag color={s.zone.color}>{s.zone.label.toUpperCase()}</Tag>
        </View>
      ) : null}

      <SectionTitle right={plural(data.results.length, "partido", "partidos")}>RESULTADOS</SectionTitle>
      <DataTable columns={resultCols} rows={data.results} fontSize={7.4} rowHeight={15} emptyText="Sin partidos disputados." />

      <View style={{ flexDirection: "row", marginTop: 2 }}>
        <View style={{ flex: 1.2, marginRight: 8 }}>
          <SectionTitle right={plural(data.scorers.reduce((a, r) => a + r.goals, 0), "gol", "goles")}>GOLEADORES</SectionTitle>
          <DataTable columns={scorerCols} rows={data.scorers} fontSize={7.2} rowHeight={14} emptyText="Sin goles registrados." />
        </View>
        <View style={{ flex: 1 }}>
          <SectionTitle right={`${data.sanctions.total}`}>SANCIONES</SectionTitle>
          <View style={{ backgroundColor: colors.cellBg, padding: 6 }}>
            {data.sanctions.byStatus.length ? (
              data.sanctions.byStatus.map((b) => (
                <NoteText key={b.label} color={colors.white}>
                  {b.label}: {b.count}
                </NoteText>
              ))
            ) : (
              <NoteText color={colors.white}>Sin sanciones registradas.</NoteText>
            )}
          </View>
        </View>
      </View>

      <SectionTitle right={plural(data.upcoming.length, "partido", "partidos")}>PRÓXIMOS PARTIDOS</SectionTitle>
      <DataTable columns={upCols} rows={data.upcoming} fontSize={7.4} rowHeight={15} emptyText="Sin partidos pendientes." />
      <NoteBox>
        <NoteText>
          Marcador desde el punto de vista del equipo (goles a favor primero). Los penales del desempate se muestran entre paréntesis y no
          se suman al marcador.
        </NoteText>
      </NoteBox>
    </DocShell>
  );
}
