/** @jsxRuntime automatic */
import type { ReactNode } from "react";
import { Document, Page } from "../primitives";
import { colors, FONT_BODY, MARGIN, type Orientation } from "../theme";
import type { DocMeta } from "../types";
import { Background, DemoMarks } from "./Background";
import { Footer } from "./Footer";

/** Documento + página con fondo, marcas de demostración y pie comunes. */
export function DocShell({
  meta,
  title,
  orientation = "portrait",
  children,
}: {
  meta: DocMeta;
  title: string;
  orientation?: Orientation;
  children: ReactNode;
}) {
  return (
    <Document title={title} author="Starfutbol" creator="Starfutbol" producer="Starfutbol" language="es-MX">
      <Page
        size="LETTER"
        orientation={orientation}
        style={{
          paddingTop: MARGIN.top + (meta.isDemo ? 8 : 0),
          paddingBottom: MARGIN.bottom,
          paddingHorizontal: MARGIN.x,
          fontFamily: FONT_BODY,
          color: colors.text,
          backgroundColor: "#1A0204",
        }}
      >
        <Background orientation={orientation} />
        {meta.isDemo ? <DemoMarks orientation={orientation} /> : null}
        {children}
        <Footer meta={meta} orientation={orientation} />
      </Page>
    </Document>
  );
}
