import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING, shootoutProblem, validateResult, type ResultInput, type ScoringRules } from "@/domain/scoring";
import { applyManualOrder, computeStandings, type StandingMatchInput } from "@/domain/standings";

const teams = ["A", "B", "C", "D"].map((id) => ({ id, name: `Equipo ${id}` }));

function m(id: string, home: string, away: string, r: ResultInput, rules: ScoringRules = DEFAULT_SCORING): StandingMatchInput {
  const v = validateResult(r, home, away, rules);
  if (!v.ok) throw new Error(v.errors.join(", "));
  return { id, homeTeamId: home, awayTeamId: away, result: v.value };
}

describe("validateResult", () => {
  it("victoria en tiempo regular determina ganador", () => {
    const v = validateResult({ resultType: "TIEMPO_REGULAR", homeGoals: 3, awayGoals: 1 }, "A", "B", DEFAULT_SCORING);
    expect(v.ok && v.value.winnerTeamId).toBe("A");
  });
  it("rechaza tiempo regular empatado", () => {
    const v = validateResult({ resultType: "TIEMPO_REGULAR", homeGoals: 2, awayGoals: 2 }, "A", "B", DEFAULT_SCORING);
    expect(v.ok).toBe(false);
  });
  it("desempate requiere marcador empatado y define ganador por penales", () => {
    const v = validateResult(
      { resultType: "DESEMPATE", homeGoals: 2, awayGoals: 2, homeShootout: 3, awayShootout: 4 },
      "A",
      "B",
      DEFAULT_SCORING,
    );
    expect(v.ok && v.value.winnerTeamId).toBe("B");
    const bad = validateResult({ resultType: "DESEMPATE", homeGoals: 2, awayGoals: 1, homeShootout: 3, awayShootout: 4 }, "A", "B", DEFAULT_SCORING);
    expect(bad.ok).toBe(false);
    const tiedShootout = validateResult({ resultType: "DESEMPATE", homeGoals: 1, awayGoals: 1, homeShootout: 3, awayShootout: 3 }, "A", "B", DEFAULT_SCORING);
    expect(tiedShootout.ok).toBe(false);
  });
  it("desempate sin marcador de penales acepta ganador explícito", () => {
    const v = validateResult({ resultType: "DESEMPATE", homeGoals: 0, awayGoals: 0, winnerTeamId: "A" }, "A", "B", DEFAULT_SCORING);
    expect(v.ok && v.value.winnerTeamId).toBe("A");
  });
  it("empate definitivo bloqueado si no está configurado", () => {
    const v = validateResult({ resultType: "EMPATE", homeGoals: 1, awayGoals: 1 }, "A", "B", DEFAULT_SCORING);
    expect(v.ok).toBe(false);
    const rules = { ...DEFAULT_SCORING, allowDraws: true, drawPoints: 1 };
    expect(validateResult({ resultType: "EMPATE", homeGoals: 1, awayGoals: 1 }, "A", "B", rules).ok).toBe(true);
  });
  it("penales: 3 tiros por equipo y muerte súbita", () => {
    // Posibles dentro de los 3 tiros
    for (const [h, a] of [[2, 0], [3, 1], [3, 2], [0, 2], [1, 3]]) expect(shootoutProblem(h, a, 3)).toBeNull();
    // Posibles en muerte súbita (diferencia de 1)
    for (const [h, a] of [[4, 3], [6, 5], [1, 0], [0, 1]]) expect(shootoutProblem(h, a, 3)).toBeNull();
    // Imposibles: ventaja de 2+ con el ganador por encima de 3
    for (const [h, a] of [[4, 2], [5, 3], [2, 4]]) expect(shootoutProblem(h, a, 3)).not.toBeNull();
    expect(shootoutProblem(4, 2, null)).toBeNull();
    const bad = validateResult({ resultType: "DESEMPATE", homeGoals: 1, awayGoals: 1, homeShootout: 4, awayShootout: 2 }, "A", "B", DEFAULT_SCORING);
    expect(bad.ok).toBe(false);
    const ok = validateResult({ resultType: "DESEMPATE", homeGoals: 1, awayGoals: 1, homeShootout: 5, awayShootout: 4 }, "A", "B", DEFAULT_SCORING);
    expect(ok.ok && ok.value.winnerTeamId).toBe("A");
  });

  it("decisión administrativa exige ganador", () => {
    expect(validateResult({ resultType: "ADMINISTRATIVO", homeGoals: 0, awayGoals: 0 }, "A", "B", DEFAULT_SCORING).ok).toBe(false);
  });
});

describe("computeStandings", () => {
  it("asigna 3-0 en tiempo regular y 2-1 en desempate; penales no suman goles", () => {
    const res = computeStandings(
      teams.slice(0, 2),
      [
        m("1", "A", "B", { resultType: "TIEMPO_REGULAR", homeGoals: 4, awayGoals: 2 }),
        m("2", "B", "A", { resultType: "DESEMPATE", homeGoals: 1, awayGoals: 1, homeShootout: 5, awayShootout: 4 }),
      ],
      DEFAULT_SCORING,
    );
    const a = res.rows.find((r) => r.teamId === "A")!;
    const b = res.rows.find((r) => r.teamId === "B")!;
    expect(a).toMatchObject({ jj: 2, jg: 1, jp: 0, eg: 0, ep: 1, gf: 5, ge: 3, dif: 2, pts: 4 });
    expect(b).toMatchObject({ jj: 2, jg: 0, jp: 1, eg: 1, ep: 0, gf: 3, ge: 5, dif: -2, pts: 2 });
    expect(res.rows[0].teamId).toBe("A");
  });

  it("recalcular con los mismos datos no duplica puntos", () => {
    const matches = [m("1", "A", "B", { resultType: "TIEMPO_REGULAR", homeGoals: 1, awayGoals: 0 })];
    const r1 = computeStandings(teams, matches, DEFAULT_SCORING);
    const r2 = computeStandings(teams, matches, DEFAULT_SCORING);
    expect(r1.rows).toEqual(r2.rows);
    expect(r1.rows.find((r) => r.teamId === "A")!.pts).toBe(3);
  });

  it("reproduce la fila de Cuauteboys de la referencia (9 JG, 1 JP, 2 EG, 1 EP = 32 pts)", () => {
    const matches: StandingMatchInput[] = [];
    let i = 0;
    const add = (r: ResultInput) => matches.push(m(String(i++), "X", "Y", r));
    for (let k = 0; k < 9; k++) add({ resultType: "TIEMPO_REGULAR", homeGoals: 2, awayGoals: 1 });
    add({ resultType: "TIEMPO_REGULAR", homeGoals: 0, awayGoals: 1 });
    add({ resultType: "DESEMPATE", homeGoals: 1, awayGoals: 1, winnerTeamId: "X" });
    add({ resultType: "DESEMPATE", homeGoals: 1, awayGoals: 1, winnerTeamId: "X" });
    add({ resultType: "DESEMPATE", homeGoals: 1, awayGoals: 1, winnerTeamId: "Y" });
    const res = computeStandings([{ id: "X", name: "X" }, { id: "Y", name: "Y" }], matches, DEFAULT_SCORING);
    expect(res.rows.find((r) => r.teamId === "X")).toMatchObject({ jj: 13, jg: 9, jp: 1, eg: 2, ep: 1, pts: 32 });
  });

  it("desempata por diferencia de goles y luego goles a favor", () => {
    const res = computeStandings(
      teams,
      [
        m("1", "A", "C", { resultType: "TIEMPO_REGULAR", homeGoals: 5, awayGoals: 0 }),
        m("2", "B", "D", { resultType: "TIEMPO_REGULAR", homeGoals: 2, awayGoals: 0 }),
      ],
      DEFAULT_SCORING,
    );
    expect(res.rows.map((r) => r.teamId)).toEqual(["A", "B", "D", "C"]);
  });

  it("enfrentamiento directo con tres equipos empatados", () => {
    // A, B y C empatan en puntos, diferencia y goles a favor; entre ellos A venció a B y B a C, C a A (círculo)
    // y D desempata: A le ganó a D. Se espera que el directo entre A,B,C no resuelva (círculo) → empate sin resolver.
    const rules = DEFAULT_SCORING;
    const res = computeStandings(
      teams.slice(0, 3),
      [
        m("1", "A", "B", { resultType: "TIEMPO_REGULAR", homeGoals: 1, awayGoals: 0 }),
        m("2", "B", "C", { resultType: "TIEMPO_REGULAR", homeGoals: 1, awayGoals: 0 }),
        m("3", "C", "A", { resultType: "TIEMPO_REGULAR", homeGoals: 1, awayGoals: 0 }),
      ],
      rules,
    );
    expect(res.unresolvedGroups).toHaveLength(1);
    expect(res.unresolvedGroups[0].sort()).toEqual(["A", "B", "C"]);
    expect(res.rows.every((r) => r.unresolvedTieGroup === 0)).toBe(true);
    const fixed = applyManualOrder(res, 0, ["C", "A", "B"]);
    expect(fixed.rows.map((r) => r.teamId)).toEqual(["C", "A", "B"]);
    expect(fixed.rows.every((r) => r.unresolvedTieGroup === null)).toBe(true);
  });

  it("enfrentamiento directo resuelve dos equipos empatados", () => {
    // A y B: mismos puntos, misma diferencia y goles a favor; B ganó el directo.
    const res = computeStandings(
      teams,
      [
        m("1", "B", "A", { resultType: "TIEMPO_REGULAR", homeGoals: 2, awayGoals: 1 }),
        m("2", "A", "C", { resultType: "TIEMPO_REGULAR", homeGoals: 2, awayGoals: 1 }),
        m("3", "D", "B", { resultType: "TIEMPO_REGULAR", homeGoals: 2, awayGoals: 1 }),
      ],
      DEFAULT_SCORING,
      ["PUNTOS", "DIFERENCIA_GOLES", "GOLES_FAVOR", "ENFRENTAMIENTO_DIRECTO"],
    );
    const order = res.rows.map((r) => r.teamId);
    expect(order.indexOf("B")).toBeLessThan(order.indexOf("A"));
    expect(res.unresolvedGroups.filter((g) => g.includes("A"))).toHaveLength(0);
  });
});
