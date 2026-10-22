/** @jsxRuntime automatic */
import { View } from "../primitives";
import { formatLong } from "@/lib/dates";
import { STANDING_ABBR } from "@/lib/labels";
import type { StandingRow } from "@/domain/standings";
import type { Zone } from "@/domain/bracket";
import { BrandHeader } from "../components/BrandHeader";
import { DataTable, type Column } from "../components/DataTable";
import { DocShell } from "../components/DocShell";
import { NoteBox, NoteText, ZoneLegend } from "../components/Section";
import { colors, textOn } from "../theme";
import type { StandingsDocData } from "../data";

type Row = StandingRow & { zone: Zone | null };

export function TablaGeneralDoc({ data }: { data: StandingsDocData }) {
  const { standings, meta } = data;
  const n = (k: keyof Row, header: string, width = 29): Column<Row> => ({
    key: String(k),
    header,
    width,
    render: (r) => String(r[k] ?? 0),
  });
  const columns: Column<Row>[] = [
    { key: "pos", header: "", width: 24, render: (r) => `${r.position}${r.unresolvedTieGroup != null ? "*" : ""}` },
    { key: "team", header: "Equipo", align: "left", render: (r) => r.teamName },
    n("jj", "JJ"),
    n("jg", "JG"),
    n("jp", "JP"),
    n("eg", "EG"),
    n("ep", "EP"),
    ...(data.showDraws ? [n("e", "E")] : []),
    n("gf", "GF"),
    n("ge", "GE"),
    n("dif", "DIF", 32),
    { key: "pts", header: "Puntos", width: 50, render: (r) => String(r.pts), textStyle: { fontSize: 9 } },
  ];
  const abbr = ["JJ", "JG", "JP", "EG", "EP", ...(data.showDraws ? ["E"] : []), "GF", "GE", "DIF"]
    .map((k) => `${k}: ${STANDING_ABBR[k]}`)
    .join(" · ");
  const many = standings.rows.length > 22;
  return (
    <DocShell meta={meta} title={`Tabla general ${standings.league.name}`}>
      <BrandHeader
        venue={meta.venue}
        block={{ name: standings.league.name, title: "Tabla", sub: data.caption }}
        info={[
          meta.seasonName,
          data.updated ? `Actualizado: ${formatLong(data.updated)}` : "Sin resultados registrados",
          standings.frozen ? "Clasificación congelada al cierre de la fase regular" : null,
        ]}
      />
      <DataTable
        variant="rows"
        columns={columns}
        rows={standings.rows}
        rowHeight={many ? 15.2 : 17}
        fontSize={many ? 7.8 : 8.4}
        emptyText="No hay equipos en esta liga."
        rowLook={(r) =>
          r.zone ? { bg: r.zone.color, color: textOn(r.zone.color) } : { bg: colors.cellBg, color: colors.white }
        }
      />
      <NoteBox>
        <ZoneLegend zones={standings.zones} />
        <View style={{ marginTop: standings.zones.length ? 3 : 0 }}>
          <NoteText>
            {abbr}. Puntos: victoria {data.rules.winPoints} · empate ganado {data.rules.shootoutWinPoints} · empate perdido{" "}
            {data.rules.shootoutLossPoints} · derrota {data.rules.lossPoints}
            {data.rules.allowDraws && data.rules.drawPoints != null ? ` · empate ${data.rules.drawPoints}` : ""}.
          </NoteText>
          {data.unresolved ? (
            <NoteText color={colors.accent}>* Empate que los criterios configurados no resuelven; pendiente de decisión oficial.</NoteText>
          ) : null}
        </View>
      </NoteBox>
    </DocShell>
  );
}
