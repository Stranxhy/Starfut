/** @jsxRuntime automatic */
import { Text, View } from "../primitives";
import { formatLong, formatShort } from "@/lib/dates";
import { BrandHeader } from "../components/BrandHeader";
import { DataTable, type Column } from "../components/DataTable";
import { DocShell } from "../components/DocShell";
import { MatchTag } from "../components/MatchTables";
import { NoteBox, NoteText } from "../components/Section";
import { colors, FONT_BODY } from "../theme";
import { fieldLabel, plural, timeLabel } from "../format";
import type { DayDocData, MatchLine } from "../data";

export function RolDoc({ data }: { data: DayDocData }) {
  const { meta, teamLeague } = data;
  const lines = data.groups.flatMap((g) => g.lines);
  // En el rol de una liga, un equipo de la otra liga (partido combinado) muestra su liga.
  const withLeague = (id: string, name: string) =>
    data.filteredLeague && teamLeague[id] && teamLeague[id] !== data.leagueName ? `${name} (${teamLeague[id]})` : name;
  const columns: Column<MatchLine>[] = [
    { key: "date", header: "Fecha", width: 46, render: (m) => formatShort(m.date) },
    { key: "time", header: "Horario", width: 47, render: (m) => timeLabel(m.time) },
    { key: "field", header: "Campo", width: 36, render: (m) => fieldLabel(m.field) },
    { key: "home", header: "Equipo", render: (m) => withLeague(m.homeId, m.home) },
    {
      key: "vs",
      header: "VS",
      width: 42,
      padX: 1,
      cellBg: () => colors.headerBgDeep,
      render: (m) => (
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 8, color: colors.white }}>VS</Text>
          <MatchTag m={m} />
        </View>
      ),
    },
    { key: "away", header: "Equipo", render: (m) => withLeague(m.awayId, m.away) },
    ...(data.showLeagueColumn
      ? [{ key: "league", header: "Liga", width: 52, render: (m: MatchLine) => teamLeague[m.homeId] ?? m.league ?? "—", textStyle: { fontSize: 6.8 } }]
      : []),
  ];
  return (
    <DocShell meta={meta} title={`Rol de juegos ${data.date}`}>
      <BrandHeader
        venue={meta.venue}
        block={{ name: data.leagueName, title: "Rol de juegos", sub: data.caption }}
        info={[formatLong(data.date), meta.seasonName, plural(lines.length, "partido programado", "partidos programados")]}
      />
      <DataTable columns={columns} rows={lines} fontSize={8} rowHeight={19} emptyText="No hay partidos programados para esta fecha." />
      {data.cancelled.length ? (
        <NoteBox title="Partidos cancelados">
          {data.cancelled.map((m) => (
            <NoteText key={m.id}>
              {timeLabel(m.time)} · Campo {fieldLabel(m.field)} · {m.home} vs {m.away}
              {m.cancelReason ? ` — ${m.cancelReason}` : ""}
            </NoteText>
          ))}
        </NoteBox>
      ) : null}
    </DocShell>
  );
}
