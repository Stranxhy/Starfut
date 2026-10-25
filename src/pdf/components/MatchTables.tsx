/** @jsxRuntime automatic */
import { Text, View } from "../primitives";
import { colors, FONT_BODY } from "../theme";
import type { MatchLine } from "../data";
import { matchTag, sideGoals } from "../format";
import { DataTable, type Column } from "./DataTable";
import { Tag } from "./Section";

const TAG_COLORS: Record<string, string> = {
  CANCELADO: "#BDBDBD",
  AMISTOSO: "#4FC3F7",
  "SUSTITUC.": "#AED581",
  INTERLIGA: "#CE93D8",
  "REPROG.": "#FFB74D",
  PENDIENTE: colors.accent,
};

export function MatchTag({ m }: { m: MatchLine }) {
  const tag = matchTag(m);
  if (!tag) return null;
  return <Tag color={TAG_COLORS[tag] ?? colors.accent}>{tag}</Tag>;
}

/** Celda de goles: número grande y aclaración pequeña (penales, administrativo). */
export function GoalsCell({ m, side, size = 9.5 }: { m: MatchLine; side: "home" | "away"; size?: number }) {
  const g = sideGoals(m, side);
  const cancelled = m.status === "CANCELADO";
  return (
    <View style={{ alignItems: "center" }}>
      <Text
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: cancelled ? 6.2 : size,
          color: cancelled ? colors.muted : colors.white,
          letterSpacing: cancelled ? 0.3 : 0,
        }}
      >
        {g.main}
      </Text>
      {g.small ? (
        <Text style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 5.6, color: colors.muted }}>{g.small}</Text>
      ) : null}
    </View>
  );
}

function VsCell({ m }: { m: MatchLine }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 8.2, color: colors.white }}>VS</Text>
      <MatchTag m={m} />
    </View>
  );
}

/** GOLES | EQUIPO | VS | EQUIPO | GOLES (composición de la referencia de resultados). */
export function ResultsTable({
  lines,
  fontSize = 8.4,
  showTime = false,
  caption,
  captionRight,
  teamLabel = (_m, name) => name,
}: {
  lines: MatchLine[];
  fontSize?: number;
  showTime?: boolean;
  caption?: string;
  captionRight?: string;
  /** Permite anotar el nombre (p. ej. la liga del rival en un partido combinado). */
  teamLabel?: (teamId: string, name: string) => string;
}) {
  const columns: Column<MatchLine>[] = [
    ...(showTime
      ? [{ key: "time", header: "Hora", width: 34, render: (m: MatchLine) => (m.time ? m.time.replace(/^0/, "") : "—") }]
      : []),
    { key: "hg", header: "Goles", width: 62, render: (m) => <GoalsCell m={m} side="home" /> },
    { key: "home", header: "Equipo", render: (m) => teamLabel(m.homeId, m.home) },
    { key: "vs", header: "VS", width: 44, padX: 1, render: (m) => <VsCell m={m} />, cellBg: () => colors.headerBgDeep },
    { key: "away", header: "Equipo", render: (m) => teamLabel(m.awayId, m.away) },
    { key: "ag", header: "Goles", width: 62, render: (m) => <GoalsCell m={m} side="away" /> },
  ];
  return (
    <DataTable
      columns={columns}
      rows={lines}
      fontSize={fontSize}
      rowHeight={20}
      emptyText="No hay partidos registrados para esta fecha."
      caption={caption}
      captionRight={captionRight}
    />
  );
}
