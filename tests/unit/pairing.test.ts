import { describe, expect, it } from "vitest";
import { proposePairings } from "@/domain/pairing";

const t = (id: string, leagueId: string) => ({ id, name: id, leagueId });

describe("completar jornada: emparejamiento de equipos sin partido", () => {
  it("empareja primero dentro de la misma liga", () => {
    const r = proposePairings([t("A1", "A"), t("A2", "A"), t("B1", "B"), t("B2", "B")]);
    expect(r.pairs).toHaveLength(2);
    expect(r.pairs.every((p) => !p.crossLeague)).toBe(true);
    expect(r.unpaired).toHaveLength(0);
  });

  it("combina entre ligas a los sobrantes para que nadie se quede sin jugar", () => {
    // A1 (cancelación) y B1 (descanso por número impar)
    const r = proposePairings([t("A1", "A"), t("B1", "B")]);
    expect(r.pairs).toEqual([{ home: "A1", away: "B1", crossLeague: true, previousMeetings: 0 }]);
  });

  it("con número impar total queda un equipo sin rival y se reporta", () => {
    const r = proposePairings([t("A1", "A"), t("A2", "A"), t("B1", "B")]);
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0].crossLeague).toBe(false);
    expect(r.unpaired.map((x) => x.id)).toEqual(["B1"]);
  });

  it("prefiere al rival con menos enfrentamientos previos", () => {
    const met = (a: string, b: string) => ([a, b].sort().join() === "A1,A2" ? 2 : 0);
    const r = proposePairings([t("A1", "A"), t("A2", "A"), t("A3", "A"), t("A4", "A")], met);
    expect(r.pairs.some((p) => [p.home, p.away].sort().join() === "A1,A2")).toBe(false);
  });
});
