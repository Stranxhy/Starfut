import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { addSanctionTypeAction, addSanctionUnitAction, toggleCatalogAction } from "@/server/actions/config";
import { CatalogAddForm } from "@/components/forms/config-forms";
import { SimpleToggleForm } from "@/components/forms/entity-forms";
import { ConfigContext } from "@/components/config/ConfigContext";
import { Badge, Card, CardHeader } from "@/components/ui/core";
import { UNIT_KIND } from "@/lib/labels";

export const metadata = { title: "Catálogos de sanciones" };

export default async function CatalogosPage() {
  await requireUser();
  const [types, units] = await Promise.all([
    prisma.sanctionType.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { sanctions: true } } } }),
    prisma.sanctionUnit.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { sanctions: true } } } }),
  ]);
  return <>
    <ConfigContext context="Catálogos compartidos entre temporadas" title="Tipos y duración de sanciones" description="Define las opciones disponibles al registrar sanciones. Desactivar una opción conserva las sanciones que ya la utilizan." />
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader title="Tipos de sanción" description="Categorías para identificar el motivo de cada caso." />
        <div className="border-y border-slate-200 bg-slate-50 p-5"><CatalogAddForm action={addSanctionTypeAction} /></div>
        {types.length ? <ul className="divide-y divide-slate-200">{types.map((type) => <li key={type.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><p className="text-sm font-bold break-words text-[#102d50]">{type.name}</p><p className="mt-1 text-xs text-slate-600">{type._count.sanctions} sanciones en todas las temporadas</p><div className="mt-2"><Badge className={type.active ? "bg-emerald-50 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-600 ring-slate-300"}>{type.active ? "Activo" : "Inactivo"}</Badge></div></div><SimpleToggleForm action={toggleCatalogAction} hidden={{ id: type.id, kind: "type" }} label={type.active ? "Desactivar" : "Activar"} variant={type.active ? "danger" : "secondary"} /></li>)}</ul> : <p className="p-5 text-sm text-slate-600">Agrega el primer tipo de sanción.</p>}
      </Card>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader title="Unidades de duración" description="Partidos lleva una cuenta de cumplimientos. Días, minutos y otras unidades mantienen seguimiento manual." />
        <div className="border-y border-slate-200 bg-slate-50 p-5"><CatalogAddForm action={addSanctionUnitAction} withKind /></div>
        {units.length ? <ul className="divide-y divide-slate-200">{units.map((unit) => <li key={unit.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><p className="text-sm font-bold break-words text-[#102d50]">{unit.name}</p><p className="mt-1 text-xs text-slate-600">{UNIT_KIND[unit.kind]} · {unit._count.sanctions} sanciones</p><div className="mt-2"><Badge className={unit.active ? "bg-emerald-50 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-600 ring-slate-300"}>{unit.active ? "Activa" : "Inactiva"}</Badge></div></div><SimpleToggleForm action={toggleCatalogAction} hidden={{ id: unit.id, kind: "unit" }} label={unit.active ? "Desactivar" : "Activar"} variant={unit.active ? "danger" : "secondary"} /></li>)}</ul> : <p className="p-5 text-sm text-slate-600">Agrega una unidad para definir la duración de las sanciones.</p>}
      </Card>
    </div>
  </>;
}
