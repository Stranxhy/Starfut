import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_HOURS, signSession, verifySession } from "@/lib/auth/token";

export type SessionUser = Pick<User, "id" | "email" | "name" | "role">;

/** Roles con permiso de escritura por área. La arquitectura admite agregar roles sin tocar los módulos. */
export const WRITE_ROLES: Record<string, UserRole[]> = {
  default: ["ADMIN"],
  results: ["ADMIN", "AUXILIAR"],
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const payload = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Para páginas: redirige al inicio de sesión si no hay sesión válida. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function startSession(user: SessionUser): Promise<void> {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
