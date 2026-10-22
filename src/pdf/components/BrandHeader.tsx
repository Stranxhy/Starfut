/** @jsxRuntime automatic */
import { Image, Text, View } from "../primitives";
import { colors, fitTitle, FONT_BODY, FONT_TITLE, images, type Orientation } from "../theme";

export interface TitleBlock {
  /** Línea superior pequeña (por defecto "TORNEO"). */
  kicker?: string;
  /** Nombre de la liga (o del equipo), en grande. */
  name?: string;
  /** Título del documento: TABLA, GOLEO, RESULTADOS… */
  title: string;
  /** Subtítulo: "JORNADA 13", fecha… */
  sub?: string;
}

/**
 * Encabezado de marca: logotipo blanco + sede a la izquierda y bloque de
 * título centrado a la derecha (composición de las imágenes de referencia).
 */
export function BrandHeader({
  venue,
  block,
  orientation = "portrait",
  info,
}: {
  venue: string;
  block: TitleBlock;
  orientation?: Orientation;
  /** Líneas informativas pequeñas bajo el encabezado (temporada, actualización…). */
  info?: (string | null | undefined)[];
}) {
  const land = orientation === "landscape";
  const logoW = land ? 150 : 172;
  const logoH = (logoW * 491) / 954;
  const name = (block.name ?? "").toUpperCase();
  const title = block.title.toUpperCase();
  const nameSize = fitTitle(name, land ? 36 : 40, land ? 18 : 11);
  const titleSize = fitTitle(title, land ? 30 : 34, land ? 22 : 12);
  const lines = (info ?? []).filter((x): x is string => !!x);
  return (
    <View style={{ marginBottom: land ? 8 : 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: land ? 200 : 205, alignItems: "center" }}>
          {/* react-pdf no admite "alt" en <Image>. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={images.logoWhite()} style={{ width: logoW, height: logoH }} />
          <Text
            style={{
              fontFamily: FONT_TITLE,
              fontSize: land ? 11 : 12.5,
              letterSpacing: 1.6,
              color: colors.white,
              marginTop: 7,
            }}
          >
            {venue.toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", paddingLeft: 6 }}>
          <Text style={{ fontFamily: FONT_TITLE, fontSize: land ? 16 : 19, letterSpacing: 1, lineHeight: 1.05 }}>
            {(block.kicker ?? "TORNEO").toUpperCase()}
          </Text>
          {name ? (
            <Text style={{ fontFamily: FONT_TITLE, fontSize: nameSize, lineHeight: 1.08, letterSpacing: 0.6, textAlign: "center" }}>
              {name}
            </Text>
          ) : null}
          <Text style={{ fontFamily: FONT_TITLE, fontSize: titleSize, lineHeight: 1.08, letterSpacing: 0.6, textAlign: "center" }}>
            {title}
          </Text>
          {block.sub ? (
            <Text style={{ fontFamily: FONT_TITLE, fontSize: land ? 15 : 18, letterSpacing: 1.6, lineHeight: 1.1, textAlign: "center" }}>
              {block.sub.toUpperCase()}
            </Text>
          ) : null}
        </View>
      </View>
      {lines.length ? (
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: land ? 5 : 8 }}>
          <Text style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 7.5, color: colors.muted, textAlign: "center" }}>
            {lines.join("   ·   ")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
