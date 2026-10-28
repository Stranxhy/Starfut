export type FilterParams = Record<string, string | number | undefined>;

/** Ajusta el directorio a la última página existente después de aplicar filtros. */
export function directoryPage(requestedPage: number, total: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  return { page, pageCount, skip: (page - 1) * pageSize };
}

/** Al quitar un filtro se conserva el resto de la búsqueda y se vuelve a la primera página. */
export function removeFilter(path: string, params: FilterParams, name: string, resetValue?: string) {
  const next = { ...params, [name]: resetValue, page: undefined };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return `${path}${query.size ? `?${query}` : ""}`;
}
