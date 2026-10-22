/** @jsxRuntime automatic */
import { Image, Text, View } from "../primitives";
import { colors, FONT_BODY, FONT_TITLE, images, PAGE, type Orientation } from "../theme";

/** Fondo a sangre completa, repetido en todas las páginas. */
export function Background({ orientation }: { orientation: Orientation }) {
  const size = PAGE[orientation];
  return (
    // react-pdf no admite "alt" en <Image>; el fondo es decorativo.
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      fixed
      src={orientation === "portrait" ? images.bgPortrait() : images.bgLandscape()}
      style={{ position: "absolute", top: 0, left: 0, width: size.width, height: size.height }}
    />
  );
}

/** Marca de agua y franja para temporadas de demostración (datos no oficiales). */
export function DemoMarks({ orientation }: { orientation: Orientation }) {
  const size = PAGE[orientation];
  return (
    <>
      <View
        fixed
        style={{
          position: "absolute",
          top: size.height / 2 - 40,
          left: 0,
          width: size.width,
          alignItems: "center",
          transform: `rotate(${orientation === "portrait" ? -50 : -32}deg)`,
          opacity: 0.07,
        }}
      >
        <Text style={{ fontFamily: FONT_TITLE, fontSize: orientation === "portrait" ? 54 : 60, color: colors.white }}>
          DEMOSTRACIÓN
        </Text>
      </View>
      <View
        fixed
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size.width,
          height: 13,
          backgroundColor: colors.demo,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 6.8, color: colors.demoText, letterSpacing: 1.2 }}>
          DATOS DE DEMOSTRACIÓN · NO OFICIALES
        </Text>
      </View>
    </>
  );
}
