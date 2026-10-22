import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { addSanctionTypeAction, addSanctionUnitAction, toggleCatalogAction } from "@/server/actions/config";
import { CatalogAddForm } from "@/components/forms/config-forms";
import { SimpleToggleForm } from "@/components/forms/entity-forms";
import { Badge, Card, CardHeader, Table, TD, TH } from "@/components/ui/core";
import { UNIT_KIND } from "@/lib/labels";

export const metadata = { title: "Catálogos de sanciones" };

export default async function CatalogosPage() {
  await requireUser();
  const [types, units] = await Promise.all([
    prisma.sanctionType.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { sanctions: true } } } }),
    prisma.sanctionUnit.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { sanctions: true } } } }),
  ]);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Tipos de sanción" description="Categorías disponibles al registrar una sanción." />
        <div className="border-b border-zinc-100 px-4 py-3 sm:px-5"><CatalogAddForm action={addSanctionTypeAction} /></div>
        <Table>
          <thead><tr><TH>Tipo</TH><TH className="text-center">Usos</TH><TH>Estado</TH><TH /></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <TD className="font-semibold">{t.name}</TD>
                <TD className="text-center">{t._count.sanctions}</TD>
                <TD>{t.active ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Activo</Badge> : <Badge>Inactivo</Badge>}</TD>
                <TD className="text-right"><SimpleToggleForm action={toggleCatalogAction} hidden={{ id: t.id, kind: "type" }} label={t.active ? "Desactivar" : "Activar"} variant={t.active ? "danger" : "secondary"} /></TD>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card>
        <CardHeader title="Unidades de duración" description="Las sanciones por partidos llevan control de cumplimiento; las demás conservan su duración exacta." />
        <div className="border-b border-zinc-100 px-4 py-3 sm:px-5"><CatalogAddForm action={addSanctionUnitAction} withKind /></div>
        <Table>
          <thead><tr><TH>Unidad</TH><TH>Tipo</TH><TH className="text-center">Usos</TH><TH>Estado</TH><TH /></tr></thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <TD className="font-semibold">{u.name}</TD>
                <TD>{UNIT_KIND[u.kind]}</TD>
                <TD className="text-center">{u._count.sanctions}</TD>
                <TD>{u.active ? <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-300">Activa</Badge> : <Badge>Inactiva</Badge>}</TD>
                <TD className="text-right"><SimpleToggleForm action={toggleCatalogAction} hidden={{ id: u.id, kind: "unit" }} label={u.active ? "Desactivar" : "Activar"} variant={u.active ? "danger" : "secondary"} /></TD>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
