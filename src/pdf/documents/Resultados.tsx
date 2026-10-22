/** @jsxRuntime automatic */
import { View } from "../primitives";
import { formatLong } from "@/lib/dates";
import { BrandHeader } from "../components/BrandHeader";
import { DocShell } from "../components/DocShell";
import { ResultsTable } from "../components/MatchTables";
import { NoteBox, NoteText, SectionTitle } from "../components/Section";
import type { DayDocData } from "../data";
import { plural } from "../format";

export function ResultadosDoc({ data }: { data: DayDocData }) {
  const { meta } = data;
  const played = data.groups.flatMap((g) => g.lines).filter((m) => m.status === "JUGADO").length;
  return (
    <DocShell meta={meta} title={`Resultados ${data.date}`}>
      <BrandHeader
        venue={meta.venue}
        block={{ name: data.leagueName, title: "Resultados", sub: data.caption }}
        info={[formatLong(data.date), meta.seasonName, `${played} de ${data.total} partidos con resultado`]}
      />
      {data.groups.map((g, i) => (
        <View key={i}>
          {g.title ? <SectionTitle right={plural(g.lines.length, "partido", "partidos")}>{g.title.toUpperCase()}</SectionTitle> : null}
          <ResultsTable lines={g.lines} />
        </View>
      ))}
      <NoteBox>
        <NoteText>
          EG: empate ganado (victoria en el desempate por penales). Los penales se muestran entre paréntesis y no se suman al marcador.
          Los amistosos no alteran la clasificación oficial.
        </NoteText>
      </NoteBox>
    </DocShell>
  );
}
