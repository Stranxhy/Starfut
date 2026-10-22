import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id }, select: { logo: true, logoMime: true } });
  if (!team?.logo) return new Response("Sin escudo", { status: 404 });
  return new Response(Buffer.from(team.logo), {
    headers: { "Content-Type": team.logoMime ?? "image/png", "Cache-Control": "private, max-age=300" },
  });
}
