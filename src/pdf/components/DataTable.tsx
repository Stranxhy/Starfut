/** @jsxRuntime automatic */
import type { ReactNode } from "react";
import { Text, View } from "../primitives";
import type { Style } from "@react-pdf/types";
import { colors, FONT_BODY } from "../theme";

export interface Column<T> {
  key: string;
  header: string;
  /** Ancho fijo en puntos; si se omite, la columna es flexible. */
  width?: number;
  flex?: number;
  align?: "left" | "center" | "right";
  /** Texto o nodo de la celda. Los textos se pintan con el estilo de la fila. */
  render: (row: T, index: number) => ReactNode;
  /** Estilo adicional de texto para esta columna. */
  textStyle?: Style;
  /** Relleno horizontal de la celda (por defecto 4 pt). */
  padX?: number;
  /** Fondo propio de la celda (p. ej. columna VS). */
  cellBg?: (row: T, index: number) => string | undefined;
}

export interface RowLook {
  bg?: string;
  color?: string;
  fontSize?: number;
  minHeight?: number;
  fontWeight?: number;
}

/**
 * Tabla con encabezado fijo que se repite en cada página y filas que nunca se
 * cortan entre páginas.
 *  - variant "rows": bandas horizontales separadas (tabla general).
 *  - variant "columns": columnas como franjas separadas (resultados, rol).
 */
export function DataTable<T>({
  columns,
  rows,
  variant = "columns",
  fontSize = 8,
  rowHeight = 17,
  headerHeight = 18,
  rowLook,
  emptyText = "Sin registros.",
  repeatHeader = true,
  caption,
  captionRight,
}: {
  columns: Column<T>[];
  rows: T[];
  variant?: "rows" | "columns";
  fontSize?: number;
  rowHeight?: number;
  headerHeight?: number;
  rowLook?: (row: T, index: number) => RowLook | undefined;
  emptyText?: string;
  repeatHeader?: boolean;
  /** Rótulo del grupo (fecha, jornada) que se repite junto al encabezado en cada página. */
  caption?: string;
  captionRight?: string;
}) {
  const gapX = variant === "columns" ? 2.5 : 0;
  const gapY = variant === "rows" ? 1.4 : 0;
  const box = (c: Column<T>): Style => ({
    width: c.width,
    flexGrow: c.width ? 0 : (c.flex ?? 1),
    flexShrink: c.width ? 0 : 1,
    flexBasis: c.width ? c.width : 0,
    marginLeft: gapX / 2,
    marginRight: gapX / 2,
    paddingHorizontal: c.padX ?? 4,
    justifyContent: "center",
    alignItems: c.align === "left" ? "flex-start" : c.align === "right" ? "flex-end" : "center",
  });
  const textAlign = (c: Column<T>) => c.align ?? "center";

  return (
    <View style={{ width: "100%" }}>
      <View fixed={repeatHeader}>
      {caption ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 2,
            paddingVertical: 2.5,
            paddingHorizontal: 6,
            backgroundColor: colors.sectionBg,
            borderLeftWidth: 3,
            borderLeftColor: colors.white,
          }}
        >
          <Text style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 8, color: colors.white, textTransform: "uppercase" }}>
            {caption}
          </Text>
          {captionRight ? (
            <Text style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 7, color: colors.muted, textTransform: "uppercase" }}>
              {captionRight}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", marginBottom: variant === "rows" ? 1.4 : 1.6 }}>
        {columns.map((c) => (
          <View
            key={c.key}
            style={{
              ...box(c),
              minHeight: headerHeight,
              paddingVertical: 2,
              backgroundColor: colors.headerBg,
            }}
          >
            <Text
              style={{
                fontFamily: FONT_BODY,
                fontWeight: 800,
                fontSize: fontSize * 0.95,
                color: colors.white,
                textTransform: "uppercase",
                textAlign: textAlign(c),
                letterSpacing: 0.2,
              }}
            >
              {c.header}
            </Text>
          </View>
        ))}
      </View>
      </View>
      {rows.length === 0 ? (
        <View style={{ backgroundColor: colors.cellBg, padding: 10, alignItems: "center" }}>
          <Text style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: fontSize, color: colors.muted }}>{emptyText}</Text>
        </View>
      ) : null}
      {rows.map((row, i) => {
        const look = rowLook?.(row, i) ?? {};
        const bg = look.bg ?? (i % 2 === 0 ? colors.cellBg : colors.cellBgAlt);
        return (
          <View key={i} wrap={false} style={{ flexDirection: "row", marginBottom: gapY, minHeight: look.minHeight ?? rowHeight }}>
            {columns.map((c) => {
              const content = c.render(row, i);
              return (
                <View key={c.key} style={{ ...box(c), backgroundColor: c.cellBg?.(row, i) ?? bg, paddingVertical: 2 }}>
                  {typeof content === "string" || typeof content === "number" ? (
                    <Text
                      style={{
                        fontFamily: FONT_BODY,
                        fontWeight: look.fontWeight ?? 800,
                        fontSize: look.fontSize ?? fontSize,
                        color: look.color ?? colors.white,
                        textTransform: "uppercase",
                        textAlign: textAlign(c),
                        ...(c.textStyle ?? {}),
                      }}
                    >
                      {content}
                    </Text>
                  ) : (
                    content
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
