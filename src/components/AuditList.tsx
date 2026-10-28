import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/core";
import { AuditTimeline } from "@/components/audit/AuditTimeline";

export async function AuditList({ entity, entityId, limit = 30 }: { entity: string | string[]; entityId: string; limit?: number }) {
  const logs = await prisma.auditLog.findMany({
    where: { entity: { in: Array.isArray(entity) ? entity : [entity] }, entityId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    include: { user: { select: { name: true } } },
  });
  if (!logs.length) return <EmptyState title="Sin cambios registrados" description="Aquí aparecerán las acciones registradas para esta ficha." />;
  return <AuditTimeline logs={logs} />;
}
