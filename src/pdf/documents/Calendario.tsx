/** @jsxRuntime automatic */
import { Fragment } from "react";
import { Text, View } from "../primitives";
import { formatLong } from "@/lib/dates";
import { MATCH_STATUS } from "@/lib/labels";
import { BrandHeader } from "../components/BrandHeader";
import { DataTable, type Column } from "../components/DataTable";
import { DocShell } from "../components/DocShell";
import { MatchTag } from "../components/MatchTables";
import { SectionTitle } from "../components/Section";
import { colors, FONT_BODY } from "../theme";
import { fieldLabel, plural, scoreLine, timeLabel } from "../format";
import type { CalendarDocData, MatchLine } from "../data";

export function CalendarioDoc({ data }: { data: CalendarDocData }) {
  const { meta } = data;
  const columns: Column<MatchLine>[] = [
    { key: "time", header: "Horario", width: 40, render: (m) => timeLabel(m.time) },
    { key: "field", header: "Campo", width: 34, render: (m) => fieldLabel(m.field) },
    { key: "home", header: "Local", render: (m) => m.home },
    {
      key: "vs",
      header: "VS",
      width: 38,
      padX: 1,
      cellBg: () => colors.headerBgDeep,
      render: (m) => (
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 7, color: colors.white }}>VS</Text>
          <MatchTag m={m} />
        </View>
      ),
    },
    { key: "away", header: "Visitante", render: (m) => m.away },
    {
      key: "status",
      header: "Estado",
      width: 66,
      render: (m) => (m.status === "JUGADO" && m.result ? scoreLine(m) : (MATCH_STATUS[m.status]?.label ?? m.status)),
      textStyle: { fontSize: 6.6 },
    },
    ...(data.showLeagueColumn
      ? [
          {
            key: "league",
            header: "Liga",
            width: 46,
            render: (m: MatchLine) => data.teamLeague[m.homeId] ?? "—",
            textStyle: { fontSize: 6.2 },
          },
        ]
      : []),
  ];
  return (
    <DocShell meta={meta} title={`Calendario ${data.leagueName}`}>
      <BrandHeader
        venue={meta.venue}
        block={{ name: data.leagueName, title: "Calendario", sub: "Temporada completa" }}
        info={[meta.seasonName, plural(data.total, "partido", "partidos")]}
      />
      {data.rounds.length === 0 ? <SectionTitle>SIN PARTIDOS PROGRAMADOS</SectionTitle> : null}
      {data.rounds.map((r, i) => (
        <Fragment key={i}>
          <SectionTitle ahead={90} right={plural(r.dates.reduce((a, d) => a + d.lines.length, 0), "partido", "partidos")}>
            {r.title.toUpperCase()}
          </SectionTitle>
          {r.dates.map((d, j) => (
            <Fragment key={j}>
              {j > 0 ? <View minPresenceAhead={60} /> : null}
              <DataTable
                columns={columns}
                rows={d.lines}
                fontSize={7.2}
                rowHeight={15}
                headerHeight={13}
                caption={d.date ? formatLong(d.date) : "Fecha por definir"}
                captionRight={r.title}
              />
            </Fragment>
          ))}
        </Fragment>
      ))}
    </DocShell>
  );
}
