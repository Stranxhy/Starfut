import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { getSeasonId } from "@/server/season";
import { buildPdf, isPdfDocKey } from "@/pdf/registry";
import { PdfParamError } from "@/pdf/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * GET /api/pdf/<doc>?<parámetros>[&season=<id>][&download=1]
 * Devuelve el PDF para vista previa en el navegador (inline) o para descarga (attachment).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ doc: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Debes iniciar sesión para generar documentos.");

  const { doc } = await ctx.params;
  if (!isPdfDocKey(doc)) return jsonError(404, `El documento «${doc}» no existe.`);

  const params = req.nextUrl.searchParams;
  let seasonId = params.get("season");
  if (seasonId) {
    const exists = await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true } });
    if (!exists) return jsonError(400, "La temporada indicada no existe.");
  } else {
    seasonId = await getSeasonId();
    if (!seasonId) return jsonError(400, "No hay ninguna temporada registrada.");
  }

  try {
    const { buffer, filename } = await buildPdf(doc, seasonId, params);
    const disposition = params.get("download") === "1" ? "attachment" : "inline";
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof PdfParamError) return jsonError(400, e.message);
    console.error(`[pdf] Error al generar «${doc}»:`, e);
    return jsonError(500, "No se pudo generar el documento. Intenta de nuevo o revisa los datos.");
  }
}
