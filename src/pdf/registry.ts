import "server-only";
// Registro de documentos PDF: clave → cargador de datos, componente, nombre de archivo y orientación.
// Lo usan el endpoint /api/pdf/[doc] y el script de muestras (npm run pdf:samples).
import { createElement, type ReactElement } from "react";
import { fileSlug } from "@/domain/text";
import * as data from "./data";
import { renderPdf } from "./render";
import type { Orientation } from "./theme";
import { TablaGeneralDoc } from "./documents/TablaGeneral";
import { GoleoDoc } from "./documents/Goleo";
import { ResultadosDoc } from "./documents/Resultados";
import { RolDoc } from "./documents/Rol";
import { SancionesDoc } from "./documents/Sanciones";
import { EliminatoriasDoc } from "./documents/Eliminatorias";
import { EquiposDoc } from "./documents/Equipos";
import { CalendarioDoc } from "./documents/Calendario";
import { HistorialResultadosDoc } from "./documents/HistorialResultados";
import { CancelacionesDoc } from "./documents/Cancelaciones";
import { EstadisticasEquipoDoc } from "./documents/EstadisticasEquipo";

export interface DocDef<D> {
  /** Nombre legible del documento. */
  label: string;
  orientation: Orientation;
  /** Parámetros de consulta admitidos (documentación). */
  params: string;
  load: (seasonId: string, params: URLSearchParams) => Promise<D>;
  Component: (props: { data: D }) => ReactElement;
  filename: (data: D) => string;
}

export interface BuiltPdf {
  buffer: Buffer;
  filename: string;
}

interface Entry {
  label: string;
  orientation: Orientation;
  params: string;
  build: (seasonId: string, params: URLSearchParams) => Promise<BuiltPdf>;
}

/** Renderiza un documento con datos ya cargados (también lo usa el script de muestras). */
export async function renderDoc<D>(def: DocDef<D>, d: D): Promise<BuiltPdf> {
  const buffer = await renderPdf(createElement(def.Component, { data: d }));
  return { buffer, filename: def.filename(d) };
}

function entry<D>(def: DocDef<D>): Entry & { def: DocDef<D> } {
  return {
    label: def.label,
    orientation: def.orientation,
    params: def.params,
    def,
    build: async (seasonId, params) => renderDoc(def, await def.load(seasonId, params)),
  };
}

const pdf = (...parts: string[]) => `${["Starfutbol", ...parts.map((p) => fileSlug(p) || "Sin_nombre")].join("_")}.pdf`;

export const DOC_DEFS = {
  "tabla-general": entry({
    label: "Tabla general",
    orientation: "portrait",
    params: "league=<id>[&round=N][&view=actual|final]",
    load: data.loadStandings,
    Component: TablaGeneralDoc,
    filename: (d) => pdf("Tabla", "General", d.standings.league.name),
  }),
  goleo: entry({
    label: "Tabla de goleo",
    orientation: "portrait",
    params: "league=<id>[&round=N][&playoffs=1]",
    load: data.loadScorers,
    Component: GoleoDoc,
    filename: (d) => pdf("Tabla", "Goleo", d.league.name),
  }),
  resultados: entry({
    label: "Resultados",
    orientation: "portrait",
    params: "(date=AAAA-MM-DD | round=N)[&league=<id>]",
    load: data.loadResults,
    Component: ResultadosDoc,
    filename: (d) => `Starfutbol_Resultados_${d.filteredLeague ? `${fileSlug(d.leagueName)}_` : ""}${d.date}.pdf`,
  }),
  rol: entry({
    label: "Rol de juegos",
    orientation: "portrait",
    params: "(date=AAAA-MM-DD | round=N)[&league=<id>]",
    load: data.loadRol,
    Component: RolDoc,
    filename: (d) => `Starfutbol_Rol_${d.filteredLeague ? `${fileSlug(d.leagueName)}_` : ""}${d.date}.pdf`,
  }),
  sanciones: entry({
    label: "Sanciones",
    orientation: "landscape",
    params: "[league][&team][&player][&status][&type][&from][&to]",
    load: data.loadSanctions,
    Component: SancionesDoc,
    filename: () => "Starfutbol_Sanciones.pdf",
  }),
  eliminatorias: entry({
    label: "Eliminatorias",
    orientation: "landscape",
    params: "league=<id>",
    load: data.loadBracket,
    Component: EliminatoriasDoc,
    filename: (d) => pdf("Eliminatorias", d.leagueName),
  }),
  equipos: entry({
    label: "Equipos",
    orientation: "portrait",
    params: "[league=<id>]",
    load: data.loadTeams,
    Component: EquiposDoc,
    filename: () => "Starfutbol_Equipos.pdf",
  }),
  calendario: entry({
    label: "Calendario",
    orientation: "portrait",
    params: "[league=<id>]",
    load: data.loadCalendar,
    Component: CalendarioDoc,
    filename: (d) => pdf("Calendario", d.filteredLeague ? d.leagueName : "Completo"),
  }),
  "historial-resultados": entry({
    label: "Historial de resultados",
    orientation: "portrait",
    params: "[league=<id>][&team=<id>]",
    load: data.loadHistory,
    Component: HistorialResultadosDoc,
    filename: () => "Starfutbol_Historial_Resultados.pdf",
  }),
  cancelaciones: entry({
    label: "Cancelaciones y reprogramaciones",
    orientation: "landscape",
    params: "[league=<id>]",
    load: data.loadCancellations,
    Component: CancelacionesDoc,
    filename: () => "Starfutbol_Cancelaciones_Reprogramaciones.pdf",
  }),
  "estadisticas-equipo": entry({
    label: "Estadísticas de equipo",
    orientation: "portrait",
    params: "team=<id>",
    load: data.loadTeamStats,
    Component: EstadisticasEquipoDoc,
    filename: (d) => pdf("Estadisticas", d.team.name),
  }),
};

export type PdfDocKey = keyof typeof DOC_DEFS;

export const PDF_DOC_KEYS = Object.keys(DOC_DEFS) as PdfDocKey[];

export function isPdfDocKey(key: string): key is PdfDocKey {
  return Object.prototype.hasOwnProperty.call(DOC_DEFS, key);
}

/** Carga los datos y genera el PDF de un documento. */
export function buildPdf(key: PdfDocKey, seasonId: string, params: URLSearchParams): Promise<BuiltPdf> {
  return DOC_DEFS[key].build(seasonId, params);
}
