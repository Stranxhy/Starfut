export type FilterParams = Record<string, string | number | undefined>;

/** Al quitar un filtro se conserva el resto de la búsqueda y se vuelve a la primera página. */
export function removeFilter(path: string, params: FilterParams, name: string, resetValue?: string) {
  const next = { ...params, [name]: resetValue, page: undefined };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return `${path}${query.size ? `?${query}` : ""}`;
}
