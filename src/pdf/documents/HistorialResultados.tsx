/** @jsxRuntime automatic */
import { View } from "../primitives";
import { formatLong } from "@/lib/dates";
import { BrandHeader } from "../components/BrandHeader";
import { DocShell } from "../components/DocShell";
import { ResultsTable } from "../components/MatchTables";
import { NoteBox, NoteText } from "../components/Section";
import type { HistoryDocData } from "../data";
import { plural } from "../format";

export function HistorialResultadosDoc({ data }: { data: HistoryDocData }) {
  const { meta } = data;
  return (
    <DocShell meta={meta} title="Historial de resultados">
      <BrandHeader
        venue={meta.venue}
        block={{ name: data.teamName ?? data.leagueName, title: "Resultados", sub: "Historial" }}
        info={[meta.seasonName, data.teamName ? `Liga ${data.leagueName}` : null, plural(data.total, "partido disputado", "partidos disputados")]}
      />
      {data.days.length === 0 ? (
        <NoteBox>
          <NoteText>Todavía no hay partidos con resultado registrado.</NoteText>
        </NoteBox>
      ) : null}
      {data.days.map((d, i) => (
        <View key={i} style={{ marginTop: i ? 6 : 0 }}>
          <View minPresenceAhead={80} />
          <ResultsTable
            lines={d.lines}
            fontSize={7.8}
            caption={d.date ? formatLong(d.date) : "Sin fecha"}
            captionRight={d.caption}
          />
        </View>
      ))}
      {data.days.length ? (
        <NoteBox>
          <NoteText>
            EG: empate ganado (victoria en el desempate por penales). Los penales se muestran entre paréntesis y no se suman al marcador.
          </NoteText>
        </NoteBox>
      ) : null}
    </DocShell>
  );
}
