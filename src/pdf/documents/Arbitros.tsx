/** @jsxRuntime automatic */
import { formatShort } from "@/lib/dates";
import { BrandHeader } from "../components/BrandHeader";
import { DataTable, type Column } from "../components/DataTable";
import { DocShell } from "../components/DocShell";
import { NoteBox, NoteText, Tag } from "../components/Section";
import { colors } from "../theme";
import type { RefereesDocData } from "../data";
import { plural } from "../format";

type Row = RefereesDocData["rows"][number] & { n: number };

export function ArbitrosDoc({ data }: { data: RefereesDocData }) {
  const { meta } = data;
  const columns: Column<Row>[] = [
    { key: "n", header: "#", width: 28, render: (r) => String(r.n) },
    { key: "name", header: "Árbitro", flex: 2, align: "left", render: (r) => r.name },
    {
      key: "status",
      header: "Estado",
      width: 78,
      render: (r) => (r.active ? <Tag size={6} color="#81C784">ACTIVO</Tag> : <Tag size={6} color="#BDBDBD">INACTIVO</Tag>),
    },
    { key: "played", header: "Partidos dirigidos", width: 96, render: (r) => String(r.played) },
    { key: "upcoming", header: "Próximas asignaciones", width: 110, render: (r) => String(r.upcoming) },
  ];
  const rows = data.rows.map((r, i) => ({ ...r, n: i + 1 }));
  return (
    <DocShell meta={meta} title="Árbitros">
      <BrandHeader
        venue={meta.venue}
        block={{ name: "Cuerpo arbitral", title: "Árbitros" }}
        info={[
          meta.seasonName,
          plural(data.rows.length, "árbitro", "árbitros"),
          plural(data.rows.reduce((a, r) => a + r.played, 0), "partido dirigido", "partidos dirigidos"),
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        fontSize={8}
        rowHeight={18}
        emptyText="No hay árbitros registrados."
        rowLook={(r) => (r.active ? undefined : { color: colors.muted })}
      />
      <NoteBox>
        <NoteText>
          Partidos dirigidos: partidos disputados de la temporada con el árbitro asignado. Próximas asignaciones: partidos programados a
          partir del {formatShort(data.today)}. Los datos de contacto no se incluyen en este reporte.
        </NoteText>
      </NoteBox>
    </DocShell>
  );
}
