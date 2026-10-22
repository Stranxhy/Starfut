/** @jsxRuntime automatic */
import { Text, View } from "../primitives";
import { colors, FONT_BODY, MARGIN, PAGE, type Orientation } from "../theme";
import type { DocMeta } from "../types";

/** Pie de página fijo: sede/temporada, fecha de generación y numeración. */
export function Footer({ meta, orientation }: { meta: DocMeta; orientation: Orientation }) {
  const size = PAGE[orientation];
  const style = { fontFamily: FONT_BODY, fontWeight: 600 as const, fontSize: 6.5, color: colors.muted };
  return (
    <View
      fixed
      style={{
        position: "absolute",
        left: MARGIN.x,
        width: size.width - MARGIN.x * 2,
        top: size.height - 30,
        borderTopWidth: 0.6,
        borderTopColor: colors.line,
        paddingTop: 5,
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <Text style={{ ...style, flex: 2.2 }}>
        {meta.tournament.toUpperCase()} · {meta.venue.toUpperCase()} · {meta.seasonName}
      </Text>
      <Text style={{ ...style, flex: 1.3, textAlign: "center" }}>Generado: {meta.generatedLabel}</Text>
      <Text
        style={{ ...style, flex: 1, textAlign: "right", fontWeight: 800, color: colors.white }}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}
