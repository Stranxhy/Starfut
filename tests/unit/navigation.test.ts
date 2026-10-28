import { describe, expect, it } from "vitest";
import { matchViewHref, navigationContext } from "../../src/lib/navigation";

describe("organización de la navegación", () => {
  it("mantiene el contexto al editar un resultado o partido", () => {
    expect(navigationContext("/resultados/partido-1")?.item.href).toBe("/partidos");
    expect(navigationContext("/partidos/nuevo")?.group).toBe("Competencia");
  });
  it("ubica ligas en participantes y la configuración del cuadro en administración", () => {
    expect(navigationContext("/ligas/liga-1")?.group).toBe("Participantes");
    expect(navigationContext("/configuracion/eliminatorias")?.group).toBe("Administración");
    expect(navigationContext("/eliminatorias")?.group).toBe("Competencia");
    expect(navigationContext("/equipos-inexistente")).toBeNull();
  });
  it("conserva la liga al alternar vistas, incluso sin fecha", () => {
    expect(matchViewHref("/resultados", "2026-10-25", "liga-a")).toBe("/resultados?date=2026-10-25&liga=liga-a");
    expect(matchViewHref("/partidos", null, "liga-b")).toBe("/partidos?liga=liga-b");
  });
  it("conserva la fecha al cambiar entre partidos y resultados", () => {
    expect(matchViewHref("/resultados", "2026-10-25")).toBe("/resultados?date=2026-10-25");
    expect(matchViewHref("/partidos", "2026-10-25")).toBe("/partidos?fecha=2026-10-25");
    expect(matchViewHref("/resultados", null)).toBe("/resultados");
  });
});
