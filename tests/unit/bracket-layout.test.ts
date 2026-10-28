import { describe, expect, it } from "vitest";
import { DEFAULT_BRACKET } from "../../src/domain/bracket";
import { layoutBracket } from "../../src/domain/bracket-layout";

describe("conexiones del cuadro visual", () => {
  it("respeta los cruces oficiales invertidos entre repechaje y cuartos", () => {
    const { edges } = layoutBracket(DEFAULT_BRACKET);
    expect(edges).toContainEqual(expect.objectContaining({ from: "REPECHAJE:4", to: "CUARTOS:1", side: "away", kind: "winner" }));
    expect(edges).toContainEqual(expect.objectContaining({ from: "CUARTOS:4", to: "SEMIFINAL:1", side: "away" }));
    expect(edges).toHaveLength(10);
  });
  it("distingue perdedores y omite referencias inexistentes o posteriores", () => {
    const { edges } = layoutBracket({ stages: [
      { code: "SEMIS", name: "Semifinal", ties: [{ home: "S1", away: "S2" }] },
      { code: "TERCERO", name: "Tercer lugar", ties: [{ home: "L:SEMIS:1", away: "W:SEMIS:2" }, { home: "W:FINAL:1", away: "S3" }] },
      { code: "FINAL", name: "Final", ties: [{ home: "W:SEMIS:1", away: "S4" }] },
    ] });
    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({ from: "SEMIS:1", to: "TERCERO:1", kind: "loser" });
    expect(edges[1]).toMatchObject({ to: "FINAL:1", kind: "winner" });
  });
});
