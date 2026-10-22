"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "../auth";
import { SEASON_COOKIE } from "../season";

export async function selectSeasonAction(fd: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(fd.get("seasonId") ?? "");
  const s = await prisma.season.findUnique({ where: { id } });
  if (!s) return;
  (await cookies()).set(SEASON_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  revalidatePath("/", "layout");
}
