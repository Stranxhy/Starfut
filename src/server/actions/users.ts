"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { ActionError, runAction, type ActionResult } from "../action";
import { audit } from "../audit";
import { getCurrentUser } from "../auth";
import { parseForm, zs } from "../validation";

const ROLES = ["ADMIN", "AUXILIAR", "ARBITRO", "CONSULTA"] as const;

export async function createUserAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const d = parseForm(
      z.object({ name: zs.text(80, "El nombre"), email: z.string().trim().toLowerCase().email("Correo inválido"), role: z.enum(ROLES), password: z.string() }),
      fd,
    );
    const problem = passwordProblems(d.password);
    if (problem) throw new ActionError(problem, { fieldErrors: { password: problem } });
    if (await prisma.user.findUnique({ where: { email: d.email } })) throw new ActionError("Ya existe un usuario con ese correo.", { fieldErrors: { email: "Duplicado" } });
    await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { name: d.name, email: d.email, role: d.role, passwordHash: await hashPassword(d.password) } });
      await audit(tx, { userId: user.id, action: "CREAR", entity: "Usuario", entityId: u.id, summary: `${u.name} (${u.role})` });
    });
    revalidatePath("/usuarios");
    return { ok: true, message: "Usuario creado." };
  });
}

export async function setUserActiveAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const active = fd.get("active") === "1";
    if (id === user.id && !active) throw new ActionError("No puedes desactivar tu propia cuenta.");
    if (!active) {
      const admins = await prisma.user.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
      if (admins === 0) throw new ActionError("Debe existir al menos un administrador activo.");
    }
    await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data: { active } });
      await audit(tx, { userId: user.id, action: active ? "ACTIVAR" : "DESACTIVAR", entity: "Usuario", entityId: id, summary: u.name });
    });
    revalidatePath("/usuarios");
    return { ok: true, message: active ? "Usuario activado." : "Usuario desactivado." };
  });
}

export async function resetPasswordAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (user) => {
    const id = String(fd.get("id"));
    const password = String(fd.get("password") ?? "");
    const problem = passwordProblems(password);
    if (problem) throw new ActionError(problem, { fieldErrors: { password: problem } });
    await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
      await audit(tx, { userId: user.id, action: "EDITAR", entity: "Usuario", entityId: id, summary: `Contraseña restablecida: ${u.name}` });
    });
    return { ok: true, message: "Contraseña actualizada." };
  });
}

/** Cambio de contraseña propio (cualquier rol). */
export async function changeOwnPasswordAction(fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Tu sesión expiró." };
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirmNext") ?? "");
  const db = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, db.passwordHash))) return { ok: false, error: "La contraseña actual no es correcta.", fieldErrors: { current: "Incorrecta" } };
  const problem = passwordProblems(next);
  if (problem) return { ok: false, error: problem, fieldErrors: { next: problem } };
  if (next !== confirm) return { ok: false, error: "Las contraseñas no coinciden.", fieldErrors: { confirmNext: "No coincide" } };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await audit(prisma, { userId: user.id, action: "EDITAR", entity: "Usuario", entityId: user.id, summary: "Cambio de contraseña propia" });
  return { ok: true, message: "Contraseña actualizada." };
}
