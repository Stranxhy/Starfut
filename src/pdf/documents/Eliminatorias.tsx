/** @jsxRuntime automatic */
import { Text, View } from "../primitives";
import { formatLong } from "@/lib/dates";
import { BrandHeader } from "../components/BrandHeader";
import { DocShell } from "../components/DocShell";
import { NoteBox, NoteText } from "../components/Section";
import { colors, FONT_BODY, FONT_TITLE } from "../theme";
import type { BracketDocData, BracketSide, BracketTieView } from "../data";

function SideRow({ side, first }: { side: BracketSide; first: boolean }) {
  const win = side.winner;
  const fg = win ? colors.winnerText : side.known ? colors.white : colors.muted;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 17,
        backgroundColor: win ? colors.winner : side.known ? colors.cellBg : colors.cellBgSoft,
        borderTopWidth: first ? 0 : 0.6,
        borderTopColor: "rgba(255,255,255,0.18)",
      }}
    >
      <View
        style={{
          width: 17,
          alignSelf: "stretch",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: win ? "rgba(0,0,0,0.12)" : colors.headerBgDeep,
        }}
      >
        <Text style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 6.5, color: fg }}>{side.seed ?? ""}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 4, paddingVertical: 2 }}>
        <Text
          style={{
            fontFamily: FONT_BODY,
            fontWeight: side.known ? 800 : 600,
            fontSize: side.known ? 7.3 : 6.6,
            color: fg,
            textTransform: side.known ? "uppercase" : "none",
          }}
        >
          {side.label}
        </Text>
        {!side.known ? (
          <Text style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 5.6, color: colors.white }}>{side.source}</Text>
        ) : null}
      </View>
      <View style={{ width: 26, alignItems: "center" }}>
        <Text style={{ fontFamily: FONT_BODY, fontWeight: 900, fontSize: 9, color: fg }}>{side.goals ?? ""}</Text>
        {side.pens != null ? (
          <Text style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 5.2, color: fg }}>({side.pens})</Text>
        ) : null}
      </View>
    </View>
  );
}

function TieBox({ tie }: { tie: BracketTieView }) {
  return (
    <View wrap={false} style={{ marginVertical: 3 }}>
      <View style={{ borderWidth: 0.8, borderColor: "rgba(255,255,255,0.45)" }}>
        <SideRow side={tie.home} first />
        <SideRow side={tie.away} first={false} />
      </View>
      <Text style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 5.6, color: colors.muted, marginTop: 1.5, textAlign: "center" }}>
        {tie.info ?? (tie.status === "CANCELADO" ? "Cancelado" : "Fecha por definir")}
      </Text>
    </View>
  );
}

export function EliminatoriasDoc({ data }: { data: BracketDocData }) {
  const { meta } = data;
  const n = data.stages.length + 1;
  const gap = 8;
  const colW = (792 - 52 - gap * (n - 1)) / n;
  return (
    <DocShell meta={meta} orientation="landscape" title={`Eliminatorias ${data.leagueName}`}>
      <BrandHeader
        orientation="landscape"
        venue={meta.venue}
        block={{ name: data.leagueName, title: "Eliminatorias", sub: data.champion ? "Campeón definido" : "Fase final" }}
        info={[
          meta.seasonName,
          data.frozenAt ? `Clasificación congelada el ${formatLong(data.frozenAt, false)}` : "Fase regular en curso",
        ]}
      />
      <View wrap={false} style={{ flexDirection: "row", minHeight: 330 }}>
        {data.stages.map((s, i) => (
          <View key={s.code} style={{ width: colW, marginRight: gap }}>
            <View style={{ backgroundColor: colors.headerBg, paddingVertical: 4, alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontFamily: FONT_TITLE, fontSize: 9.5, letterSpacing: 0.5, color: colors.white }}>
                {s.name.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, justifyContent: "space-around" }}>
              {s.ties.map((t) => (
                <TieBox key={`${i}-${t.slot}`} tie={t} />
              ))}
            </View>
          </View>
        ))}
        <View style={{ width: colW }}>
          <View style={{ backgroundColor: colors.headerBg, paddingVertical: 4, alignItems: "center", marginBottom: 4 }}>
            <Text style={{ fontFamily: FONT_TITLE, fontSize: 9.5, letterSpacing: 0.5, color: colors.white }}>CAMPEÓN</Text>
          </View>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <View
              style={{
                borderWidth: 1.6,
                borderColor: data.champion ? colors.winner : "rgba(255,255,255,0.4)",
                backgroundColor: data.champion ? "rgba(255, 213, 74, 0.16)" : colors.cellBgSoft,
                paddingVertical: 14,
                paddingHorizontal: 6,
                alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: FONT_TITLE, fontSize: 8, color: colors.winner, letterSpacing: 1.2 }}>CAMPEÓN</Text>
              <Text
                style={{
                  fontFamily: FONT_TITLE,
                  fontSize: data.champion ? 13 : 10,
                  color: data.champion ? colors.white : colors.muted,
                  textAlign: "center",
                  marginTop: 6,
                }}
              >
                {data.champion ? data.champion.toUpperCase() : "Por definir"}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <NoteBox>
        <NoteText>
          El número junto a cada equipo es su lugar en la clasificación final de la fase regular. Marcador del tiempo regular; los penales
          del desempate se indican entre paréntesis. El ganador de cada cruce aparece resaltado.
        </NoteText>
        {!data.generated ? (
          <NoteText color={colors.accent}>
            La fase regular aún no se cierra: los cruces muestran el formato configurado y los participantes se definirán con la
            clasificación final.
          </NoteText>
        ) : null}
        {!data.officialConfirmed ? (
          <NoteText color={colors.accent}>Formato del cuadro pendiente de confirmar con la referencia oficial de la liga.</NoteText>
        ) : null}
      </NoteBox>
    </DocShell>
  );
}
