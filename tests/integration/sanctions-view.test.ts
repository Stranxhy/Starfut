import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/domain/text";
import { resolveSanctionsView, sanctionsPdfHref, sanctionsWhere } from "@/domain/sanctions-view";
import { loadSanctions } from "@/pdf/data";
import { loadSanctionFormData } from "@/app/(panel)/sanciones/data";
import { createFixture, quickMatch, type Fixture } from "../support/fixtures";

let f: Fixture;
let sanctionId: string;
let typeId: string;
let unitId: string;
let matchId: string;

beforeAll(async () => {
  f = await createFixture({ teamsA: 2, teamsB: 1 });
  const [original, rival] = f.teamsA;
  const [type, unit, match] = await Promise.all([
    prisma.sanctionType.create({ data: { name: `Tipo archivado ${f.season.id}`, active: false } }),
    prisma.sanctionUnit.create({ data: { name: `Unidad archivada ${f.season.id}`, kind: "PARTIDOS", active: false } }),
    quickMatch(f, original.id, rival.id, "2026-08-02"),
  ]);
  typeId = type.id; unitId = unit.id; matchId = match.id;
  await prisma.match.update({ where: { id: matchId }, data: { status: "CANCELADO" } });
  await prisma.player.update({ where: { id: original.players[0].id }, data: { fullName: "José Pérez", nameKey: normalizeName("José Pérez"), teamId: f.teamsB[0].id } });
  await prisma.team.update({ where: { id: original.id }, data: { active: false } });
  const common = { seasonId: f.season.id, teamId: original.id, playerId: original.players[0].id, typeId, unitId, reason: "Motivo de prueba", duration: 2 };
  const first = await prisma.sanction.create({ data: { ...common, date: new Date("2026-08-02T00:00:00Z"), matchId, status: "ACTIVA" } });
  sanctionId = first.id;
  await prisma.sanctionServing.create({ data: { sanctionId, date: new Date("2026-08-09T00:00:00Z"), notes: "Primer cumplimiento" } });
  await prisma.sanction.create({ data: { ...common, date: new Date("2026-08-09T00:00:00Z"), status: "CUMPLIDA" } });
  await prisma.sanction.create({ data: { ...common, playerId: rival.players[0].id, teamId: rival.id, date: new Date("2026-08-02T00:00:00Z"), status: "ACTIVA" } });
});

async function compare(query: Record<string, string>) {
  const data = await loadSanctionFormData(f.season.id);
  const view = resolveSanctionsView(query, f.leagues.map((league) => league.id), data.teams, data.filterTypes.map((type) => type.value));
  const web = await prisma.sanction.findMany({ where: sanctionsWhere(f.season.id, view), select: { id: true } });
  const pdfQuery = new URL(sanctionsPdfHref(f.season.id, view)!, "http://test").searchParams;
  const pdf = await loadSanctions(f.season.id, pdfQuery);
  expect(pdf.rows.map((row) => row.id).sort()).toEqual(web.map((row) => row.id).sort());
  return pdf;
}

describe("consulta y exportación de sanciones", () => {
  it("exporta la búsqueda normalizada de nombre y un periodo inclusivo sin incluir otros jugadores", async () => {
    const pdf = await compare({ q: "  jose pérez ", desde: "2026-08-02", hasta: "2026-08-09" });
    expect(pdf.rows).toHaveLength(2);
    expect(pdf.filters).toContain("Nombre del jugador: jose pérez");
    expect((await compare({ q: "sin coincidencias" })).rows).toHaveLength(0);
  });
  it("conserva el equipo y la liga de la sanción después del cambio de equipo, incluidos catálogos archivados", async () => {
    const pdf = await compare({ q: "José", liga: f.leagues[0].id, equipo: f.teamsA[0].id, tipo: typeId, estado: "ACTIVA" });
    expect(pdf.rows).toHaveLength(1);
    expect(pdf.rows[0]).toMatchObject({ id: sanctionId, team: f.teamsA[0].name, league: f.leagues[0].name, served: 1, duration: 2, unitKind: "PARTIDOS" });
    expect((await compare({ q: "José", liga: f.leagues[1].id })).rows).toHaveLength(0);
  });
  it("conserva el tipo, la unidad y el partido cancelado al editar una sanción existente", async () => {
    const create = await loadSanctionFormData(f.season.id);
    expect(create.types.some((type) => type.value === typeId)).toBe(false);
    expect(create.units.some((unit) => unit.value === unitId)).toBe(false);
    expect(create.matches.some((match) => match.id === matchId)).toBe(false);
    expect(create.filterTypes.some((type) => type.value === typeId)).toBe(true);
    const edit = await loadSanctionFormData(f.season.id, { typeId, unitId, matchId });
    expect(edit.types.some((type) => type.value === typeId)).toBe(true);
    expect(edit.units.some((unit) => unit.value === unitId)).toBe(true);
    expect(edit.matches.find((match) => match.id === matchId)?.label).toContain("cancelado");
    expect(edit.teams.find((team) => team.id === f.teamsA[0].id)?.active).toBe(false);
  });
  it("rechaza fechas inexistentes e intervalos invertidos en el PDF", async () => {
    await expect(loadSanctions(f.season.id, new URLSearchParams({ from: "2026-02-31" }))).rejects.toThrow("fechas válidas");
    await expect(loadSanctions(f.season.id, new URLSearchParams({ from: "2026-08-09", to: "2026-08-02" }))).rejects.toThrow("posterior");
  });
});
