import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { registerFonts } from "./theme";

type Renderer = typeof import("@react-pdf/renderer");
let renderer: Promise<Renderer> | null = null;

/** Carga el renderizador (ESM) una sola vez y registra las tipografías. */
async function getRenderer(): Promise<Renderer> {
  renderer ??= import("@react-pdf/renderer").then((r) => {
    registerFonts(r.Font);
    return r;
  });
  return renderer;
}

/** Renderiza un elemento <Document> a un Buffer PDF. */
export async function renderPdf(element: ReactElement): Promise<Buffer> {
  const r = await getRenderer();
  return r.renderToBuffer(element as ReactElement<DocumentProps>);
}
