"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { endSession, startSession } from "../auth";
import { audit } from "../audit";

// Limitador sencillo en memoria: 8 intentos fallidos por 15 minutos (por correo + IP).
const attempts = new Map<string, { count: number; until: number }>();
const WINDOW = 15 * 60 * 1000;

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(1, "Escribe tu contraseña"),
  next: z.string().optional(),
});

export async function loginAction(_prev: { error?: string } | undefined, fd: FormData): Promise<{ error?: string }> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${email}|${ip}`;
  const a = attempts.get(key);
  if (a && a.count >= 8 && a.until > Date.now()) {
    return { error: "Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo." };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && user.active && (await verifyPassword(password, user.passwordHash));
  if (!ok) {
    const cur = a && a.until > Date.now() ? a : { count: 0, until: Date.now() + WINDOW };
    attempts.set(key, { count: cur.count + 1, until: cur.until });
    return { error: "Correo o contraseña incorrectos." };
  }
  attempts.delete(key);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(prisma, { userId: user.id, action: "LOGIN", entity: "Usuario", entityId: user.id, summary: `Inicio de sesión (${ip})` });
  await startSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  const next = parsed.data.next && parsed.data.next.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/";
  redirect(next);
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}
