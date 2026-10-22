/** @jsxRuntime automatic */
import type { ReactNode } from "react";
import { Text, View } from "../primitives";
import { colors, FONT_BODY, FONT_TITLE, textOn } from "../theme";

/**
 * Subencabezado de grupo (jornada, fecha, sección). `minPresenceAhead` evita
 * que quede huérfano al final de una página.
 */
export function SectionTitle({
  children,
  level = 1,
  right,
  ahead = 60,
}: {
  children: ReactNode;
  level?: 1 | 2;
  right?: string;
  ahead?: number;
}) {
  const big = level === 1;
  return (
    <View
      wrap={false}
      minPresenceAhead={ahead}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: big ? 8 : 5,
        marginBottom: 3,
        paddingVertical: big ? 3.5 : 2.5,
        paddingHorizontal: 6,
        backgroundColor: big ? colors.headerBgDeep : colors.sectionBg,
        borderLeftWidth: 3,
        borderLeftColor: big ? colors.accent : colors.white,
      }}
    >
      <Text
        style={
          big
            ? { fontFamily: FONT_TITLE, fontSize: 11.5, letterSpacing: 0.8, color: colors.white }
            : { fontFamily: FONT_BODY, fontWeight: 800, fontSize: 8, color: colors.white, textTransform: "uppercase" }
        }
      >
        {children}
      </Text>
      {right ? (
        <Text style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 7, color: colors.muted, textTransform: "uppercase" }}>
          {right}
        </Text>
      ) : null}
    </View>
  );
}

/** Recuadro de notas pequeñas (leyendas, filtros aplicados, aclaraciones). */
export function NoteBox({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View wrap={false} style={{ marginTop: 8, padding: 6, backgroundColor: colors.sectionBg }}>
      {title ? (
        <Text style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 7.2, marginBottom: 3, textTransform: "uppercase" }}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

export function NoteText({ children, color = colors.muted }: { children: ReactNode; color?: string }) {
  return <Text style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 6.8, color, lineHeight: 1.35 }}>{children}</Text>;
}

/** Leyenda de zonas de color. */
export function ZoneLegend({ zones }: { zones: { color: string; label: string; positions: number[] }[] }) {
  if (!zones.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {zones.map((z, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", marginRight: 10, marginBottom: 3 }}>
          <View style={{ width: 16, height: 8, backgroundColor: z.color, marginRight: 3, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 5, color: textOn(z.color) }}>
              {z.positions.length <= 2 ? z.positions.join("-") : ""}
            </Text>
          </View>
          <Text style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 6.6, color: colors.white }}>{z.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Etiqueta diminuta (AMISTOSO, PENDIENTE…). */
export function Tag({
  children,
  color = colors.accent,
  textColor = colors.winnerText,
  size = 4.8,
}: {
  children: ReactNode;
  color?: string;
  textColor?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        backgroundColor: color,
        paddingHorizontal: size * 0.55,
        paddingVertical: size * 0.15,
        marginTop: 1.2,
        borderRadius: 1.5,
      }}
    >
      <Text style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: size, color: textColor, letterSpacing: 0.3 }}>{children}</Text>
    </View>
  );
}

/** Tarjetas de cifras (estadísticas de equipo). */
export function StatCards({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <View style={{ flexDirection: "row", marginTop: 4 }} wrap={false}>
      {items.map((it, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            marginHorizontal: 1.5,
            paddingVertical: 5,
            alignItems: "center",
            backgroundColor: i === 0 ? colors.headerBg : colors.cellBg,
          }}
        >
          <Text style={{ fontFamily: FONT_BODY, fontWeight: 900, fontSize: 14, color: colors.white }}>{String(it.value)}</Text>
          <Text style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 5.8, color: colors.muted, textTransform: "uppercase", marginTop: 1 }}>
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
