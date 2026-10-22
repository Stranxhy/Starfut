/** @jsxRuntime automatic */
import { formatLong } from "@/lib/dates";
import type { ScorerRow } from "@/domain/scorers";
import { BrandHeader } from "../components/BrandHeader";
import { DataTable, type Column } from "../components/DataTable";
import { DocShell } from "../components/DocShell";
import { NoteBox, NoteText } from "../components/Section";
import { colors } from "../theme";
import type { ScorersDocData } from "../data";

export function GoleoDoc({ data }: { data: ScorersDocData }) {
  const { meta } = data;
  const columns: Column<ScorerRow>[] = [
    { key: "pos", header: "Lugar", width: 52, render: (r) => String(r.position) },
    { key: "player", header: "Jugador", flex: 1.25, render: (r) => r.playerName },
    { key: "team", header: "Equipo", flex: 1, render: (r) => r.teamLabel },
    { key: "goals", header: "Goles", width: 64, render: (r) => String(r.goals), textStyle: { fontSize: 9.5 } },
  ];
  const shared = data.rows.some((r) => r.shared);
  return (
    <DocShell meta={meta} title={`Tabla de goleo ${data.league.name}`}>
      <BrandHeader
        venue={meta.venue}
        block={{ name: data.league.name, title: "Goleo", sub: data.caption }}
        info={[
          meta.seasonName,
          data.updated ? `Actualizado: ${formatLong(data.updated)}` : "Sin goles registrados",
          data.includePlayoffs ? "Incluye eliminatorias" : "Fase regular",
        ]}
      />
      <DataTable
        columns={columns}
        rows={data.rows}
        fontSize={8.2}
        rowHeight={16}
        emptyText="Todavía no hay goles individuales registrados en esta liga."
        rowLook={(r) =>
          r.position === 1
            ? { fontSize: 11, minHeight: 24, bg: "rgba(176, 14, 20, 0.92)" }
            : undefined
        }
      />
      <NoteBox>
        <NoteText>
          Solo cuentan los goles individuales registrados en partidos disputados (no se incluyen amistosos ni penales de desempate).
          {shared ? " Las posiciones repetidas indican un empate que los criterios configurados no resuelven." : ""}
        </NoteText>
        <NoteText color={colors.muted}>
          Si un jugador anotó con más de un equipo, se muestran todos con su desglose.
        </NoteText>
      </NoteBox>
    </DocShell>
  );
}
