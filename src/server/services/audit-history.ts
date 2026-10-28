import "server-only";
import { prisma } from "@/lib/prisma";
import { auditWhere, type AuditView } from "@/domain/audit-view";
import { directoryPage } from "@/domain/filters";

const SIZE = 40;

/** Consulta global de solo lectura; incluye eventos de todas las temporadas. */
export async function loadAuditHistory(view: AuditView) {
  const where = auditWhere(view);
  const total = await prisma.auditLog.count({ where });
  const { page, pageCount, skip } = directoryPage(view.requestedPage, total, SIZE);
  const logs = await prisma.auditLog.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take: SIZE,
    include: { user: { select: { name: true } } },
  });
  return { total, page, pageCount, logs };
}
