import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  assertQuoteOwnership,
  InspeccionAccessError,
  InspeccionNotFoundError,
  InspeccionStateError,
  InspeccionValidationError,
  loadInspeccionForCotizacion,
} from "@/lib/inspeccion/data";
import { deleteFoto, saveFoto } from "@/lib/inspeccion/service";
import { isSlotCode, type SlotCode } from "@/lib/inspeccion/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12_582_912; // 12 MiB — coincide con el bucket y el CHECK de la tabla
const ALLOWED_MIME = new Set(["image/jpeg", "image/webp"]);

function json(body: unknown, status: number) {
  return Response.json(body, { status });
}

function mapError(error: unknown): Response | null {
  if (error instanceof InspeccionAccessError) return json({ error: error.message }, 403);
  if (error instanceof InspeccionNotFoundError) return json({ error: error.message }, 404);
  if (error instanceof InspeccionStateError) return json({ error: error.message }, 409);
  if (error instanceof InspeccionValidationError) return json({ error: error.message }, 422);
  return null;
}

const numericField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value === "" ? null : Number(value)))
  .refine((value) => value === null || Number.isFinite(value), "número inválido");

const postSchema = z.object({
  cotizacionId: z.string().uuid(),
  slot: z.string().refine(isSlotCode, "slot inválido"),
  capturadoCon: z.enum(["CAMARA", "ARCHIVO"]),
  ancho: numericField,
  alto: numericField,
  lat: numericField,
  lng: numericField,
  precisionM: numericField,
  geoCapturadoEn: z.string().trim().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BYTES + 64_000) {
    return json({ error: "La imagen supera el tamaño máximo permitido (12 MB)." }, 413);
  }

  const session = await getSession();
  if (!session) return json({ error: "No autenticado." }, 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Cuerpo de la solicitud inválido." }, 400);
  }

  const parsed = postSchema.safeParse({
    cotizacionId: form.get("cotizacionId"),
    slot: form.get("slot"),
    capturadoCon: form.get("capturadoCon"),
    ancho: form.get("ancho") ?? undefined,
    alto: form.get("alto") ?? undefined,
    lat: form.get("lat") ?? undefined,
    lng: form.get("lng") ?? undefined,
    precisionM: form.get("precisionM") ?? undefined,
    geoCapturadoEn: form.get("geoCapturadoEn") ?? undefined,
  });
  if (!parsed.success) return json({ error: "Datos de la foto inválidos." }, 422);

  const file = form.get("file");
  if (!(file instanceof Blob)) return json({ error: "Falta el archivo de la foto." }, 422);
  if (!ALLOWED_MIME.has(file.type)) return json({ error: "Formato no permitido; usa JPEG o WebP." }, 422);
  if (file.size <= 0 || file.size > MAX_BYTES) return json({ error: "Tamaño de imagen inválido." }, 422);

  try {
    await assertQuoteOwnership(session, parsed.data.cotizacionId);
    const hasGeo = parsed.data.lat !== null && parsed.data.lng !== null;
    const result = await saveFoto({
      cotizacionId: parsed.data.cotizacionId,
      slot: parsed.data.slot as SlotCode,
      bytes: Buffer.from(await file.arrayBuffer()),
      mime: file.type as "image/jpeg" | "image/webp",
      ancho: parsed.data.ancho,
      alto: parsed.data.alto,
      geo: hasGeo
        ? {
            lat: parsed.data.lat as number,
            lng: parsed.data.lng as number,
            precisionM: parsed.data.precisionM,
            capturadoEn: parsed.data.geoCapturadoEn?.trim() || null,
          }
        : null,
      capturadoCon: parsed.data.capturadoCon,
      actorUserId: session.actorType === "USUARIO" ? session.actorId : null,
    });
    return json(result, 201);
  } catch (error) {
    const mapped = mapError(error);
    if (mapped) return mapped;
    console.error("[inspeccion] error al guardar foto", error);
    return json({ error: "No pudimos guardar la foto. Inténtalo de nuevo." }, 500);
  }
}

const deleteSchema = z.object({
  cotizacionId: z.string().uuid(),
  slot: z.string().refine(isSlotCode, "slot inválido"),
});

export async function DELETE(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "No autenticado." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Cuerpo de la solicitud inválido." }, 400);
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Datos inválidos." }, 422);

  try {
    await assertQuoteOwnership(session, parsed.data.cotizacionId);
    const result = await deleteFoto({
      cotizacionId: parsed.data.cotizacionId,
      slot: parsed.data.slot as SlotCode,
      actorUserId: session.actorType === "USUARIO" ? session.actorId : null,
    });
    return json(result, 200);
  } catch (error) {
    const mapped = mapError(error);
    if (mapped) return mapped;
    console.error("[inspeccion] error al borrar foto", error);
    return json({ error: "No pudimos borrar la foto. Inténtalo de nuevo." }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return json({ error: "No autenticado." }, 401);

  const cotizacionId = new URL(request.url).searchParams.get("cotizacionId") ?? "";
  if (!z.string().uuid().safeParse(cotizacionId).success) {
    return json({ error: "cotizacionId inválido." }, 422);
  }

  try {
    await assertQuoteOwnership(session, cotizacionId);
    const inspeccion = await loadInspeccionForCotizacion(cotizacionId);
    return json({ fotos: inspeccion?.fotos ?? [] }, 200);
  } catch (error) {
    const mapped = mapError(error);
    if (mapped) return mapped;
    console.error("[inspeccion] error al refrescar fotos", error);
    return json({ error: "No pudimos actualizar las fotos." }, 500);
  }
}
