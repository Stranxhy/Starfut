import "server-only";
import { Prisma, type UserRole } from "@prisma/client";
import { ZodError } from "zod";
import { getCurrentUser, WRITE_ROLES, type SessionUser } from "./auth";
import { ActionError } from "./errors";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; warnings?: string[]; data?: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      warnings?: string[];
      /** El servidor detectó advertencias: el cliente puede reenviar con confirm=true. */
      needsConfirmation?: boolean;
    };

export { ActionError };

export async function runAction<T = undefined>(
  fn: (user: SessionUser) => Promise<ActionResult<T> | void>,
  area: keyof typeof WRITE_ROLES = "default",
): Promise<ActionResult<T>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const roles: UserRole[] = WRITE_ROLES[area] ?? WRITE_ROLES.default;
  if (!roles.includes(user.role)) return { ok: false, error: "No tienes permiso para realizar esta operación." };
  try {
    const r = await fn(user);
    return r ?? { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export function toActionError(e: unknown): ActionResult<never> {
  if (e instanceof ActionError) return { ok: false, error: e.message, ...e.extra };
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of e.issues) {
      const k = issue.path.join(".") || "_";
      fieldErrors[k] ??= issue.message;
    }
    return { ok: false, error: "Revisa los datos marcados.", fieldErrors };
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      const target = String((e.meta?.target as string[] | string | undefined) ?? "");
      if (target.includes("field_slot")) return { ok: false, error: "La cancha ya está ocupada en esa fecha y horario." };
      if (target.includes("referee_slot")) return { ok: false, error: "El árbitro ya tiene un partido en esa fecha y horario." };
      return { ok: false, error: "Ya existe un registro con esos datos (duplicado)." };
    }
    if (e.code === "P2003") return { ok: false, error: "La operación no es posible porque existen registros relacionados." };
    if (e.code === "P2025") return { ok: false, error: "El registro no existe o fue modificado." };
  }
  console.error("[action]", e);
  return { ok: false, error: "Ocurrió un error inesperado. No se guardaron cambios." };
}
