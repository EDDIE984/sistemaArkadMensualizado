import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertQuoteOwnership,
  InspeccionAccessError,
  InspeccionNotFoundError,
} from "@/lib/inspeccion/data";
import { analyzeInspeccionBatch, analyzePhoto } from "@/lib/inspeccion/analisis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function json(body: unknown, status: number) {
  return Response.json(body, { status });
}

const schema = z.object({
  cotizacionId: z.string().uuid(),
  fotoId: z.string().uuid().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "No autenticado." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Cuerpo de la solicitud inválido." }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: "Datos inválidos." }, 422);
  const { cotizacionId, fotoId } = parsed.data;

  try {
    await assertQuoteOwnership(session, cotizacionId);

    if (fotoId) {
      // La foto debe pertenecer a la inspección de esta cotización.
      const { data: foto } = await createAdminClient()
        .from("inspeccion_foto")
        .select("id, inspeccion:inspeccion_id ( cotizacion_id )")
        .eq("id", fotoId)
        .maybeSingle();
      const inspeccion = Array.isArray(foto?.inspeccion) ? foto?.inspeccion[0] : foto?.inspeccion;
      if (!foto || inspeccion?.cotizacion_id !== cotizacionId) {
        return json({ error: "La foto no pertenece a esta inspección." }, 404);
      }
      const result = await analyzePhoto({ fotoId });
      return json({ foto: { fotoId, ...result } }, 200);
    }

    const result = await analyzeInspeccionBatch({ cotizacionId, max: 4 });
    if (result.skipped === "sin-inspeccion") {
      return json({ error: "Esta cotización no tiene inspección." }, 404);
    }
    return json(result, 200);
  } catch (error) {
    if (error instanceof InspeccionAccessError) return json({ error: error.message }, 403);
    if (error instanceof InspeccionNotFoundError) return json({ error: error.message }, 404);
    console.error("[inspeccion] error al analizar", error);
    return json({ error: "No pudimos analizar la inspección." }, 500);
  }
}
