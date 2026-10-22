// Primitivas de @react-pdf/renderer.
//
// En @react-pdf 4.x los componentes <View>, <Text>, etc. son simplemente
// cadenas constantes (paquete @react-pdf/primitives) que el reconciliador
// interpreta. Se definen aquí para que los documentos NO importen el paquete
// del renderizador de forma estática: éste es ESM puro y algunas de sus
// dependencias solo exportan la condición "import", lo que falla al cargarse
// con require() (scripts ejecutados con tsx en modo CommonJS). El renderizador
// se carga con import() dinámico en ./render.ts.
import type * as R from "@react-pdf/renderer";

export const Document = "DOCUMENT" as unknown as typeof R.Document;
export const Page = "PAGE" as unknown as typeof R.Page;
export const View = "VIEW" as unknown as typeof R.View;
export const Text = "TEXT" as unknown as typeof R.Text;
export const Image = "IMAGE" as unknown as typeof R.Image;
