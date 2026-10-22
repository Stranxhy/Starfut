export type SP = Record<string, string | string[] | undefined>;

export function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== "" ? s.trim() : undefined;
}

export function int(v: string | string[] | undefined, fallback: number): number {
  const n = Number.parseInt(str(v) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const PAGE_SIZE = 25;
