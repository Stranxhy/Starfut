/** @jsxRuntime automatic */
import { View } from "../primitives";
import { BrandHeader } from "../components/BrandHeader";
import { DataTable, type Column } from "../components/DataTable";
import { DocShell } from "../components/DocShell";
import { Tag } from "../components/Section";
import { colors } from "../theme";
import type { TeamsDocData } from "../data";
import { plural } from "../format";

type Row = TeamsDocData["rows"][number];

export function EquiposDoc({ data }: { data: TeamsDocData }) {
  const { meta } = data;
  const columns: Column<Row & { n: number }>[] = [
    { key: "n", header: "#", width: 28, render: (r) => String(r.n) },
    { key: "name", header: "Equipo", flex: 2, align: "left", render: (r) => r.name },
    { key: "players", header: "Jugadores activos", width: 96, render: (r) => String(r.players) },
    {
      key: "status",
      header: "Estado",
      width: 74,
      render: (r) =>
        r.active ? <Tag size={6} color="#81C784">ACTIVO</Tag> : <Tag size={6} color="#BDBDBD">INACTIVO</Tag>,
    },
  ];
  const leagues = [...new Set(data.rows.map((r) => r.league))];
  return (
    <DocShell meta={meta} title="Equipos">
      <BrandHeader
        venue={meta.venue}
        block={{ name: data.leagueName, title: "Equipos" }}
        info={[
          meta.seasonName,
          plural(data.rows.length, "equipo", "equipos"),
          plural(data.rows.filter((r) => r.active).length, "activo", "activos"),
        ]}
      />
      {data.rows.length === 0 ? (
        <DataTable columns={columns} rows={[]} emptyText="No hay equipos registrados." />
      ) : null}
      {leagues.map((l) => {
        const rows = data.rows.filter((r) => r.league === l).map((r, i) => ({ ...r, n: i + 1 }));
        return (
          <View key={l} style={{ marginBottom: 8 }}>
            <View minPresenceAhead={80} />
            <DataTable
              caption={/^liga\b/i.test(l) ? l : `Liga ${l}`}
              captionRight={plural(rows.length, "equipo", "equipos")}
              columns={columns}
              rows={rows}
              fontSize={8}
              rowHeight={17}
              rowLook={(r) => (r.active ? undefined : { color: colors.muted })}
            />
          </View>
        );
      })}
    </DocShell>
  );
}
