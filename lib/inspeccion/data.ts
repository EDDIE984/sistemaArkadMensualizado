import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getDbPool } from "@/lib/db/pool";
import type { AppSession } from "@/lib/auth/session";
import {
  isCarroceria,
  isSlotCode,
  progress,
  SLOT_ORDER,
  type Carroceria,
  type SlotCode,
} from "@/lib/inspeccion/slots";
import { isSeveridad, type Severidad } from "@/lib/inspeccion/labels";
import type {
  AnalisisEstadoRollup,
  DanoRevisionView,
  EstadoRevision,
  FotoRevisionView,
  InspeccionFotoView,
  InspeccionListaItem,
  InspeccionRevisionView,
  InspeccionView,
} from "@/lib/inspeccion/types";

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

/* ------------------------------------------------------------------ */
/* Fase 3 — panel de revisión del inspector (aseguradora)              */
/* ------------------------------------------------------------------ */

/**
 * Verifica que la inspección pertenezca a una cotización de la aseguradora del
 * `ADMIN_ASEGURADORA` en sesión. `inspeccion` no tiene `aseguradora_id`: el scope
 * pasa por `cotizacion`.
 */
export async function assertInsurerOwnsInspeccion(
  session: AppSession,
  inspeccionId: string,
): Promise<{ inspeccionId: string; cotizacionId: string }> {
  if (session.actorType !== "USUARIO" || session.profileCode !== "ADMIN_ASEGURADORA" || !session.insurerId) {
    throw new InspeccionAccessError("Tu perfil no puede revisar inspecciones.");
  }
  const db = createAdminClient();
  const { data } = await db
    .from("inspeccion")
    .select("id, cotizacion_id, cotizacion:cotizacion_id ( aseguradora_id )")
    .eq("id", inspeccionId)
    .maybeSingle();

  if (!data) throw new InspeccionNotFoundError("La inspección no existe.");
  const cotizacion = Array.isArray(data.cotizacion) ? data.cotizacion[0] : data.cotizacion;
  if (!cotizacion || cotizacion.aseguradora_id !== session.insurerId) {
    throw new InspeccionAccessError("Esta inspección no pertenece a tu aseguradora.");
  }
  return { inspeccionId: data.id, cotizacionId: data.cotizacion_id };
}

export type InspeccionFiltro = {
  desde?: string | null; // 'YYYY-MM-DD'
  hasta?: string | null;
  revision?: EstadoRevision | null;
  placa?: string | null;
};

function rollupAnalisis(value: string | null): AnalisisEstadoRollup {
  return value === "EN_PROCESO" || value === "COMPLETADO" || value === "CON_ERRORES" ? value : "PENDIENTE";
}
function asRevision(value: string | null): EstadoRevision {
  return value === "APROBADA" || value === "RECHAZADA" ? value : "PENDIENTE";
}
function severidadFromRank(rank: number): Severidad | null {
  return rank === 3 ? "GRAVE" : rank === 2 ? "MODERADA" : rank === 1 ? "LEVE" : null;
}

type ListaRow = {
  id: string;
  cotizacion_id: string;
  placa: string | null;
  carroceria: string;
  analisis_estado: string | null;
  estado_revision: string | null;
  completada_en: string | null;
  creado_por: string | null;
  miniatura_path: string | null;
  danos_total: string | number | null;
  gravedad_rank: string | number | null;
};

/** Lista de inspecciones COMPLETADA de la aseguradora, con filtros y KPIs. */
export async function loadInspeccionesListForInsurer(
  insurerId: string,
  filtro: InspeccionFiltro,
): Promise<{
  items: InspeccionListaItem[];
  kpis: { totales: number; pendientes: number; aprobadas: number; rechazadas: number };
}> {
  const pool = getDbPool();

  const params: unknown[] = [insurerId];
  const where: string[] = ["c.aseguradora_id = $1", "i.estado = 'COMPLETADA'"];
  if (filtro.desde) {
    params.push(filtro.desde);
    where.push(`i.completada_en >= $${params.length}::date`);
  }
  if (filtro.hasta) {
    params.push(filtro.hasta);
    where.push(`i.completada_en < ($${params.length}::date + interval '1 day')`);
  }
  const baseWhere = where.join(" and ");

  // KPIs: mismo scope + rango de fechas, SIN el filtro de revisión.
  const kpiRes = await pool.query<{ estado_revision: string; n: string }>(
    `select i.estado_revision, count(*)::text n
       from inspeccion i
       join cotizacion c on c.id = i.cotizacion_id
      where ${baseWhere}
      group by i.estado_revision`,
    params,
  );
  const kpis = { totales: 0, pendientes: 0, aprobadas: 0, rechazadas: 0 };
  for (const r of kpiRes.rows) {
    const n = Number(r.n);
    kpis.totales += n;
    if (r.estado_revision === "APROBADA") kpis.aprobadas += n;
    else if (r.estado_revision === "RECHAZADA") kpis.rechazadas += n;
    else kpis.pendientes += n;
  }

  // Lista: aplica también el filtro de revisión y placa.
  const listWhere = [...where];
  const listParams = [...params];
  if (filtro.revision) {
    listParams.push(filtro.revision);
    listWhere.push(`i.estado_revision = $${listParams.length}`);
  }
  if (filtro.placa && filtro.placa.trim()) {
    listParams.push(`%${filtro.placa.trim()}%`);
    listWhere.push(`v.placa ilike $${listParams.length}`);
  }

  const rows = await pool.query<ListaRow>(
    `select i.id, i.cotizacion_id, v.placa, i.carroceria, i.analisis_estado, i.estado_revision,
            i.completada_en::text as completada_en,
            coalesce(u.email, cl.email) as creado_por,
            (select f.storage_path from inspeccion_foto f
              where f.inspeccion_id = i.id
              order by (f.slot = 'FRENTE') desc, f.creado_en asc limit 1) as miniatura_path,
            (select count(*) from inspeccion_dano d
               join inspeccion_foto f2 on f2.id = d.inspeccion_foto_id
              where f2.inspeccion_id = i.id) as danos_total,
            (select coalesce(max(case coalesce(d.severidad_revisada, d.severidad)
                     when 'GRAVE' then 3 when 'MODERADA' then 2 when 'LEVE' then 1 else 0 end), 0)
               from inspeccion_dano d
               join inspeccion_foto f2 on f2.id = d.inspeccion_foto_id
              where f2.inspeccion_id = i.id) as gravedad_rank
       from inspeccion i
       join cotizacion c on c.id = i.cotizacion_id
       join vehiculo v on v.id = c.vehiculo_id
       join cliente cl on cl.id = c.cliente_id
       left join usuario u on u.id = c.usuario_id
      where ${listWhere.join(" and ")}
      order by i.completada_en desc nulls last
      limit 500`,
    listParams,
  );

  const db = createAdminClient();
  const paths = rows.rows.map((r) => r.miniatura_path).filter((p): p is string => Boolean(p));
  const urlByPath = new Map<string, string>();
  if (paths.length) {
    const { data } = await db.storage.from(INSPECCION_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    (data ?? []).forEach((entry, i) => {
      if (entry?.signedUrl) urlByPath.set(paths[i], entry.signedUrl);
    });
  }

  const items: InspeccionListaItem[] = rows.rows.map((r) => ({
    id: r.id,
    cotizacionId: r.cotizacion_id,
    placa: r.placa,
    carroceria: (isCarroceria(r.carroceria) ? r.carroceria : "SEDAN") as Carroceria,
    miniaturaUrl: r.miniatura_path ? urlByPath.get(r.miniatura_path) ?? null : null,
    analisisEstado: rollupAnalisis(r.analisis_estado),
    estadoRevision: asRevision(r.estado_revision),
    danosTotal: Number(r.danos_total ?? 0),
    gravedadPeor: severidadFromRank(Number(r.gravedad_rank ?? 0)),
    creadoPor: r.creado_por ?? "—",
    completadaEn: r.completada_en,
  }));

  return { items, kpis };
}

type FirstOf<T> = T extends unknown[] ? T[number] : T;
function first<T>(value: T): FirstOf<T> {
  return (Array.isArray(value) ? value[0] : value) as FirstOf<T>;
}

/** Detalle completo de una inspección para la pantalla de revisión (con signed URLs). */
export async function loadInspeccionRevisionForInsurer(
  session: AppSession,
  inspeccionId: string,
): Promise<InspeccionRevisionView> {
  await assertInsurerOwnsInspeccion(session, inspeccionId);
  const db = createAdminClient();

  const { data: insp } = await db
    .from("inspeccion")
    .select(
      `id, carroceria, estado, origen, completada_en, analisis_estado, calificacion_dano,
       estado_revision, revisado_en, revision_motivo,
       revisor:revisado_por_usuario_id ( nombre ),
       cotizacion:cotizacion_id (
         aseguradora_id, cotizacion_id:id,
         vehiculo:vehiculo_id ( marca, modelo, anio, color, placa, valor_asegurado, estado_vh, uso ),
         cliente:cliente_id ( nombre_razon_social, identificacion, email, telefono, ciudad:ciudad_id ( nombre, provincia ) ),
         usuario:usuario_id ( nombre )
       ),
       inspeccion_foto (
         id, slot, storage_path, analizada_storage_path, analisis_estado, danos_total, dano_peor,
         lat, lng, precision_m, geo_capturado_en, observacion_tecnico,
         inspeccion_dano ( id, tipo, severidad, severidad_revisada, accion_recomendada, pieza, descripcion, confianza,
                            bbox_x, bbox_y, bbox_w, bbox_h )
       )`,
    )
    .eq("id", inspeccionId)
    .maybeSingle();

  if (!insp) throw new InspeccionNotFoundError("La inspección no existe.");
  const cot = first(insp.cotizacion);
  if (!cot || cot.aseguradora_id !== session.insurerId) {
    throw new InspeccionAccessError("Esta inspección no pertenece a tu aseguradora.");
  }
  const veh = first(cot.vehiculo);
  const cli = first(cot.cliente);
  const ciudad = cli ? first(cli.ciudad) : null;
  const agente = first(cot.usuario);
  const revisor = first(insp.revisor);

  type FotoRow = FirstOf<typeof insp.inspeccion_foto>;
  const fotoRows: FotoRow[] = Array.isArray(insp.inspeccion_foto)
    ? insp.inspeccion_foto
    : insp.inspeccion_foto
      ? [insp.inspeccion_foto]
      : [];

  const validFotos = fotoRows.filter((f) => isSlotCode(f.slot));
  const slotIndex = (slot: string) => {
    const i = SLOT_ORDER.indexOf(slot as SlotCode);
    return i === -1 ? 999 : i;
  };
  validFotos.sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot));

  // Firmar en batch todas las rutas (originales + anotadas).
  const allPaths: string[] = [];
  for (const f of validFotos) {
    if (f.storage_path) allPaths.push(f.storage_path);
    if (f.analizada_storage_path) allPaths.push(f.analizada_storage_path);
  }
  const urlByPath = new Map<string, string>();
  if (allPaths.length) {
    const { data } = await db.storage.from(INSPECCION_BUCKET).createSignedUrls(allPaths, SIGNED_URL_TTL_SECONDS);
    (data ?? []).forEach((entry, i) => {
      if (entry?.signedUrl) urlByPath.set(allPaths[i], entry.signedUrl);
    });
  }

  const fotos: FotoRevisionView[] = validFotos.map((f) => {
    const danoRows = Array.isArray(f.inspeccion_dano)
      ? f.inspeccion_dano
      : f.inspeccion_dano
        ? [f.inspeccion_dano]
        : [];
    const danos: DanoRevisionView[] = danoRows.map((d) => ({
      id: d.id,
      tipo: d.tipo,
      severidadIa: (isSeveridad(d.severidad) ? d.severidad : "LEVE") as Severidad,
      severidadRevisada: isSeveridad(d.severidad_revisada) ? (d.severidad_revisada as Severidad) : null,
      accionRecomendada: d.accion_recomendada,
      pieza: d.pieza,
      descripcion: d.descripcion,
      confianza: d.confianza === null ? null : Number(d.confianza),
      bbox: { x: Number(d.bbox_x), y: Number(d.bbox_y), w: Number(d.bbox_w), h: Number(d.bbox_h) },
    }));
    return {
      id: f.id,
      slot: f.slot as SlotCode,
      originalUrl: (f.storage_path && urlByPath.get(f.storage_path)) || "",
      analizadaUrl: f.analizada_storage_path ? urlByPath.get(f.analizada_storage_path) ?? null : null,
      analisisEstado: (f.analisis_estado ?? "PENDIENTE") as FotoRevisionView["analisisEstado"],
      danosTotal: Number(f.danos_total ?? 0),
      lat: f.lat === null ? null : Number(f.lat),
      lng: f.lng === null ? null : Number(f.lng),
      precisionM: f.precision_m === null ? null : Number(f.precision_m),
      geoEn: f.geo_capturado_en ?? null,
      observacionTecnico: f.observacion_tecnico ?? null,
      danos,
    };
  });

  const conGeo = fotos.find((f) => f.lat !== null && f.lng !== null);

  return {
    id: insp.id,
    cotizacionId: cot.cotizacion_id,
    carroceria: (isCarroceria(insp.carroceria) ? insp.carroceria : "SEDAN") as Carroceria,
    origen: insp.origen === "CANAL" ? "CANAL" : "AUTOGESTION",
    completadaEn: insp.completada_en ?? null,
    analisisEstado: rollupAnalisis(insp.analisis_estado),
    calificacionIa:
      insp.calificacion_dano === "SIN_DANOS" || isSeveridad(insp.calificacion_dano)
        ? (insp.calificacion_dano as Severidad | "SIN_DANOS")
        : null,
    estadoRevision: asRevision(insp.estado_revision),
    revisadoEn: insp.revisado_en ?? null,
    revisionMotivo: insp.revision_motivo ?? null,
    revisorNombre: revisor?.nombre ?? null,
    vehiculo: {
      marca: veh?.marca ?? "",
      modelo: veh?.modelo ?? "",
      anio: veh?.anio ?? null,
      color: veh?.color ?? null,
      placa: veh?.placa ?? null,
      valorAsegurado: Number(veh?.valor_asegurado ?? 0),
      estadoVh: veh?.estado_vh ?? "",
      uso: veh?.uso ?? "",
    },
    cliente: {
      nombre: cli?.nombre_razon_social ?? "",
      identificacion: cli?.identificacion ?? null,
      email: cli?.email ?? "",
      telefono: cli?.telefono ?? null,
      ciudad: ciudad ? [ciudad.nombre, ciudad.provincia].filter(Boolean).join(", ") : null,
    },
    agente: agente?.nombre ?? null,
    fotos,
    mapa: conGeo ? { lat: conGeo.lat as number, lng: conGeo.lng as number } : null,
  };
}
