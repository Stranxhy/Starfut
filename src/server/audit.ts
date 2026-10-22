import "server-only";
import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/prisma";

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(
    JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val instanceof Uint8Array ? "[binario]" : val)),
  );
}

/** Registra una operación importante. Debe llamarse dentro de la misma transacción que el cambio. */
export async function audit(tx: Tx, e: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: e.userId ?? null,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? null,
      summary: e.summary,
      before: toJson(e.before),
      after: toJson(e.after),
      reason: e.reason || null,
    },
  });
}
