// Identidad visual común de todos los documentos PDF de Starfutbol.
// Tipografías (OFL): Audiowide para títulos y Montserrat para tablas.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const fontPath = (f: string) => path.join(ROOT, "src/pdf/fonts", f);

export const FONT_TITLE = "Audiowide";
export const FONT_BODY = "Montserrat";

type FontStore = typeof import("@react-pdf/renderer").Font;

let registered = false;
/** Registra las tipografías en el renderizador (se llama desde ./render.ts). */
export function registerFonts(Font: FontStore) {
  if (registered) return;
  registered = true;
  Font.register({ family: FONT_TITLE, src: fontPath("Audiowide-Regular.ttf") });
  Font.register({
    family: FONT_BODY,
    fonts: [
      { src: fontPath("Montserrat-Medium.ttf"), fontWeight: 500 },
      { src: fontPath("Montserrat-SemiBold.ttf"), fontWeight: 600 },
      { src: fontPath("Montserrat-Bold.ttf"), fontWeight: 700 },
      { src: fontPath("Montserrat-ExtraBold.ttf"), fontWeight: 800 },
      { src: fontPath("Montserrat-Black.ttf"), fontWeight: 900 },
    ],
  });
  // Sin guiones de corte automáticos: los nombres se ajustan completos.
  Font.registerHyphenationCallback((word) => [word]);
}

type ImageSrc = { data: Buffer; format: "png" | "jpg" };
const cache = new Map<string, ImageSrc>();
function asset(rel: string, format: "png" | "jpg"): ImageSrc {
  let v = cache.get(rel);
  if (!v) {
    v = { data: fs.readFileSync(path.join(ROOT, rel)), format };
    cache.set(rel, v);
  }
  return v;
}

export const images = {
  logoWhite: () => asset("public/brand/logo-blanco.png", "png"),
  bgPortrait: () => asset("src/pdf/assets/bg-portrait.jpg", "jpg"),
  bgLandscape: () => asset("src/pdf/assets/bg-landscape.jpg", "jpg"),
};

export const colors = {
  white: "#FFFFFF",
  text: "#FFFFFF",
  muted: "#F3C9C9",
  dark: "#14090A",
  headerBg: "#8E0A0E",
  headerBgDeep: "#6E0508",
  cellBg: "rgba(120, 6, 10, 0.80)",
  cellBgAlt: "rgba(98, 4, 8, 0.80)",
  cellBgSoft: "rgba(40, 2, 4, 0.55)",
  sectionBg: "rgba(10, 0, 2, 0.62)",
  accent: "#FFD54A",
  winner: "#FFD54A",
  winnerText: "#2A1600",
  demo: "#FFC107",
  demoText: "#2A1600",
  line: "rgba(255,255,255,0.35)",
};

export type Orientation = "portrait" | "landscape";

/** Tamaño carta en puntos. */
export const PAGE = {
  portrait: { width: 612, height: 792 },
  landscape: { width: 792, height: 612 },
};

/** Márgenes del contenido (el fondo es a sangre completa). */
export const MARGIN = { x: 26, top: 28, bottom: 46 };

/** Escala el tamaño de fuente de un título según su longitud para que quepa en una línea. */
export function fitTitle(text: string, base: number, maxChars: number, min = base * 0.45): number {
  const len = [...text].length;
  if (len <= maxChars) return base;
  return Math.max(min, Math.floor((base * maxChars) / len));
}

/** Texto oscuro o claro según la luminosidad del color de fondo. */
export function textOn(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return colors.white;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? colors.dark : colors.white;
}
