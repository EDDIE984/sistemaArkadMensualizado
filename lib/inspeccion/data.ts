import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AppSession } from "@/lib/auth/session";
import { isCarroceria, isSlotCode, progress, type Carroceria, type SlotCode } from "@/lib/inspeccion/slots";
import type { InspeccionFotoView, InspeccionView } from "@/lib/inspeccion/types";

export const INSPECCION_BUCKET = "inspecciones";
export const SIGNED_URL_TTL_SECONDS = 7200;

/** El usuario no es dueño de la cotización (403). */
export class InspeccionAccessError extends Error {}
/** La cotización no existe (404). */
export class InspeccionNotFoundError extends Error {}
/** Falta iniciar la inspección / elegir carrocería (409). */
export class InspeccionStateError extends Error {}
/** Datos inválidos: slot fuera de la carrocería, mime, etc. (422). */
export class InspeccionValidationError extends Error {}

export type QuoteOwnership = {
  cotizacionId: string;
  clienteId: string;
  canalId: string | null;
  origen: "AUTOGESTION" | "CANAL";
};

/**
 * Verifica que la sesión actual pueda inspeccionar esta cotización:
 * - CLIENTE: la cotización es suya (`cliente_id`).
 * - USUARIO_CANAL: la cotización pertenece a su canal (`canal_id`).
 * Cualquier otro caso -> InspeccionAccessError.
 */
export async function assertQuoteOwnership(
  session: AppSession,
  cotizacionId: string,
): Promise<QuoteOwnership> {
  const db = createAdminClient();
  const { data: quote } = await db
    .from("cotizacion")
    .select("id,cliente_id,canal_id,origen")
    .eq("id", cotizacionId)
    .maybeSingle();

  if (!quote) throw new InspeccionNotFoundError("La cotización no existe.");

  if (session.actorType === "CLIENTE") {
    if (quote.cliente_id !== session.actorId) {
      throw new InspeccionAccessError("Esta cotización no te pertenece.");
    }
  } else if (session.profileCode === "USUARIO_CANAL") {
    if (!session.channelId || quote.canal_id !== session.channelId) {
      throw new InspeccionAccessError("Esta cotización no pertenece a tu canal.");
    }
  } else {
    throw new InspeccionAccessError("Tu perfil no puede realizar inspecciones.");
  }

  return {
    cotizacionId: quote.id,
    clienteId: quote.cliente_id,
    canalId: quote.canal_id,
    origen: quote.origen,
  };
}

type InspeccionRow = { id: string; carroceria: string; estado: string };
type FotoRow = {
  id: string;
  slot: string;
  storage_path: string;
  capturado_con: string;
  lat: string | number | null;
  lng: string | number | null;
  creado_en: string;
};

async function buildView(inspeccion: InspeccionRow, fotos: FotoRow[]): Promise<InspeccionView> {
  const db = createAdminClient();
  const carroceria = inspeccion.carroceria as Carroceria;

  const valid = fotos.filter((f) => isSlotCode(f.slot));
  const paths = valid.map((f) => f.storage_path);
  const signed = paths.length
    ? (await db.storage.from(INSPECCION_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)).data ?? []
    : [];
  const urlByPath = new Map<string, string>();
  signed.forEach((entry, index) => {
    if (entry?.signedUrl) urlByPath.set(paths[index], entry.signedUrl);
  });

  const fotoViews: InspeccionFotoView[] = valid.map((f) => ({
    id: f.id,
    slot: f.slot as SlotCode,
    signedUrl: urlByPath.get(f.storage_path) ?? "",
    capturadoCon: f.capturado_con === "ARCHIVO" ? "ARCHIVO" : "CAMARA",
    lat: f.lat === null ? null : Number(f.lat),
    lng: f.lng === null ? null : Number(f.lng),
    creadoEn: f.creado_en,
  }));

  const { completadas, requeridas } = progress(
    carroceria,
    fotoViews.map((f) => f.slot),
  );

  return {
    id: inspeccion.id,
    cotizacionId: "",
    carroceria,
    estado: inspeccion.estado === "COMPLETADA" ? "COMPLETADA" : "EN_PROGRESO",
    fotos: fotoViews,
    completadas,
    requeridas,
  };
}

/** Carga la inspección de una cotización (o null si aún no se inició), con signed URLs frescas. */
export async function loadInspeccionForCotizacion(cotizacionId: string): Promise<InspeccionView | null> {
  const db = createAdminClient();
  const { data: inspeccion } = await db
    .from("inspeccion")
    .select("id,carroceria,estado")
    .eq("cotizacion_id", cotizacionId)
    .maybeSingle();

  if (!inspeccion || !isCarroceria(inspeccion.carroceria)) return null;

  const { data: fotos } = await db
    .from("inspeccion_foto")
    .select("id,slot,storage_path,capturado_con,lat,lng,creado_en")
    .eq("inspeccion_id", inspeccion.id)
    .order("creado_en", { ascending: true });

  const view = await buildView(inspeccion, fotos ?? []);
  view.cotizacionId = cotizacionId;
  return view;
}
