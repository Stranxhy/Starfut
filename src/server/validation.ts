import { z } from "zod";

/** Convierte FormData a objeto (los valores vacíos se tratan como ausentes). */
export function formObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const zs = {
  id: z.string().min(1, "Requerido"),
  text: (max = 120, label = "Este campo") =>
    z.string({ required_error: `${label} es obligatorio` }).trim().min(1, `${label} es obligatorio`).max(max, `Máximo ${max} caracteres`),
  optText: (max = 500) => z.preprocess(emptyToUndef, z.string().trim().max(max, `Máximo ${max} caracteres`).optional()),
  optId: z.preprocess(emptyToUndef, z.string().optional()),
  int: (min = 0, max = 1000, label = "El valor") =>
    z.coerce
      .number({ invalid_type_error: `${label} debe ser un número` })
      .int(`${label} debe ser entero`)
      .min(min, `${label} debe ser al menos ${min}`)
      .max(max, `${label} no puede exceder ${max}`),
  optInt: (min = 0, max = 1000) =>
    z.preprocess(emptyToUndef, z.coerce.number({ invalid_type_error: "Debe ser un número" }).int("Debe ser entero").min(min).max(max).optional()),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  optDate: z.preprocess(emptyToUndef, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional()),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)"),
  bool: z.preprocess((v) => v === "1" || v === "on" || v === "true" || v === true, z.boolean()),
  email: z.preprocess(emptyToUndef, z.string().trim().toLowerCase().email("Correo inválido").optional()),
  phone: z.preprocess(emptyToUndef, z.string().trim().max(30).regex(/^[0-9+()\-\s]{6,30}$/, "Teléfono inválido").optional()),
};

export function parseForm<T extends z.ZodTypeAny>(schema: T, fd: FormData): z.infer<T> {
  return schema.parse(formObject(fd));
}

export function isConfirm(fd: FormData) {
  return fd.get("confirm") === "1";
}

/** Analizador CSV mínimo (separador coma o punto y coma, comillas dobles). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}
