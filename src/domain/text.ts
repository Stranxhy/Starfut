/** Normaliza nombres para detectar duplicados: sin acentos, mayúsculas, espacios simples. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9Ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanName(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Convierte un texto en fragmento seguro para nombres de archivo. */
export function fileSlug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
