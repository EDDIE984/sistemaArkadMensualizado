import "server-only";

import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";
import OpenAI from "openai";
import sharp from "sharp";
import { z } from "zod";

import { getDbPool } from "@/lib/db/pool";
import { createAdminClient } from "@/lib/supabase/admin";
import { INSPECCION_BUCKET } from "@/lib/inspeccion/data";
import { SLOT_LABELS, type SlotCode } from "@/lib/inspeccion/slots";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o";

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY en el entorno del servidor.");
    _openai = new OpenAI({ timeout: 60_000, maxRetries: 2 });
  }
  return _openai;
}

function bucket() {
  return createAdminClient().storage.from(INSPECCION_BUCKET);
}

async function removeObject(path: string | null): Promise<void> {
  if (!path) return;
  try {
    await bucket().remove([path]);
  } catch (error) {
    console.error("[inspeccion] no se pudo borrar objeto de Storage", path, error);
  }
}

/* ------------------------------------------------------------------ */
/* Taxonomía y schema de salida de la IA                               */
/* ------------------------------------------------------------------ */

const DANO_TIPOS = [
  "RAYON",
  "ABOLLADURA",
  "HUNDIMIENTO",
  "FISURA",
  "PIEZA_ROTA",
  "PIEZA_FALTANTE",
  "DESALINEACION",
  "CRISTAL_ROTO",
  "PINTURA_SALTADA",
  "CORROSION",
  "LLANTA",
  "OTRO",
] as const;
const SEVERIDADES = ["LEVE", "MODERADA", "GRAVE"] as const;
const ACCIONES = ["PULIR", "PINTAR", "REPARAR", "REEMPLAZAR", "REVISAR"] as const;

type Severidad = (typeof SEVERIDADES)[number];

const analisisSchema = z.object({
  danos: z.array(
    z.object({
      tipo: z.enum(DANO_TIPOS),
      severidad: z.enum(SEVERIDADES),
      accion_recomendada: z.enum(ACCIONES),
      pieza: z.string().max(160),
      descripcion: z.string().max(600),
      confianza: z.number(),
      bbox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    }),
  ),
});

type Dano = z.infer<typeof analisisSchema>["danos"][number];

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["danos"],
  properties: {
    danos: {
      type: "array",
      description: "Un elemento por cada daño visible distinto. Vacío si la foto no muestra daños.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "severidad", "accion_recomendada", "pieza", "descripcion", "confianza", "bbox"],
        properties: {
          tipo: { type: "string", enum: [...DANO_TIPOS] },
          severidad: { type: "string", enum: [...SEVERIDADES] },
          accion_recomendada: { type: "string", enum: [...ACCIONES] },
          pieza: { type: "string", description: "Pieza afectada, ej. 'parachoque delantero', 'puerta delantera izquierda'." },
          descripcion: { type: "string", description: "Descripción breve del daño en español." },
          confianza: { type: "number", description: "Confianza de la detección, 0 a 1." },
          bbox: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "w", "h"],
            description: "Recuadro del daño, normalizado 0..1 respecto al ancho/alto de la imagen mostrada.",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = [
  "Eres un perito de siniestros de vehículos. Analizas una sola fotografía y devuelves los daños VISIBLES en ella.",
  "Reglas:",
  "- Devuelve `danos: []` si no hay ningún daño claramente visible.",
  "- Un elemento por cada daño distinto (no agrupes daños separados; no dupliques el mismo daño).",
  "- `bbox` normalizado 0..1 respecto al ancho y alto de la imagen que ves, lo más ajustado posible al daño.",
  "- Severidad: LEVE = superficial/estético (rayón leve, marca de rozadura); MODERADA = requiere trabajo de chapa y/o pintura; GRAVE = pieza a reemplazar, cristal roto, o compromete estructura/seguridad.",
  "- `accion_recomendada` coherente con tipo y severidad (PULIR para rayón leve, PINTAR si se saltó la pintura, REPARAR chapa, REEMPLAZAR pieza rota/faltante o cristal, REVISAR si hay duda).",
  "- No inventes daños que no se ven. No reportes suciedad, reflejos, sombras ni el estado normal de uso como daño.",
  "- Responde SIEMPRE en el formato JSON indicado, en español.",
].join("\n");

const TIPO_LABEL: Record<(typeof DANO_TIPOS)[number], string> = {
  RAYON: "Rayón",
  ABOLLADURA: "Abolladura",
  HUNDIMIENTO: "Hundimiento",
  FISURA: "Fisura",
  PIEZA_ROTA: "Pieza rota",
  PIEZA_FALTANTE: "Pieza faltante",
  DESALINEACION: "Desalineación",
  CRISTAL_ROTO: "Cristal roto",
  PINTURA_SALTADA: "Pintura saltada",
  CORROSION: "Corrosión",
  LLANTA: "Llanta",
  OTRO: "Otro",
};

const SEV_COLOR: Record<Severidad, string> = {
  LEVE: "#22c55e",
  MODERADA: "#f59e0b",
  GRAVE: "#ef4444",
};

const SEV_RANK: Record<Severidad, number> = { LEVE: 1, MODERADA: 2, GRAVE: 3 };

function worstSeverity(list: Severidad[]): Severidad | null {
  let worst: Severidad | null = null;
  for (const s of list) {
    if (!worst || SEV_RANK[s] > SEV_RANK[worst]) worst = s;
  }
  return worst;
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

function clampBox(b: { x: number; y: number; w: number; h: number }) {
  const x = Math.min(Math.max(b.x, 0), 1);
  const y = Math.min(Math.max(b.y, 0), 1);
  const w = Math.min(Math.max(b.w, 0), 1 - x);
  const h = Math.min(Math.max(b.h, 0), 1 - y);
  return { x: round5(x), y: round5(y), w: round5(w), h: round5(h) };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* ------------------------------------------------------------------ */
/* Llamada a la IA                                                     */
/* ------------------------------------------------------------------ */

async function requestDanos(input: { dataUri: string; slot: SlotCode; carroceria: string }): Promise<Dano[]> {
  const completion = await openai().chat.completions.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Foto: ${SLOT_LABELS[input.slot] ?? input.slot} de un vehículo tipo ${input.carroceria}. Detecta y ubica los daños visibles.`,
          },
          { type: "image_url", image_url: { url: input.dataUri, detail: "high" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "analisis_danos", strict: true, schema: JSON_SCHEMA },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("La IA no devolvió contenido.");

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("La IA devolvió un JSON inválido.");
  }
  const parsed = analisisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Respuesta de la IA con formato inesperado: ${parsed.error.message.slice(0, 200)}`);
  }

  return parsed.data.danos
    .map((d) => ({
      ...d,
      confianza: Math.min(Math.max(d.confianza, 0), 1),
      bbox: clampBox(d.bbox),
    }))
    .filter((d) => d.bbox.w > 0 && d.bbox.h > 0);
}

/* ------------------------------------------------------------------ */
/* Imagen anotada                                                      */
/* ------------------------------------------------------------------ */

async function renderAnnotated(original: Buffer, danos: Dano[]): Promise<Buffer> {
  const base = await sharp(original)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .toBuffer();
  const meta = await sharp(base).metadata();
  const W = meta.width ?? 1600;
  const H = meta.height ?? 1200;
  const stroke = Math.max(3, Math.round(W / 400));
  const fontSize = Math.max(14, Math.round(W / 55));

  const shapes = danos
    .map((d) => {
      const color = SEV_COLOR[d.severidad];
      const x = d.bbox.x * W;
      const y = d.bbox.y * H;
      const w = d.bbox.w * W;
      const h = d.bbox.h * H;
      const label = `${TIPO_LABEL[d.tipo]} · ${d.severidad}`;
      const chipW = Math.min(W - x, label.length * fontSize * 0.62 + 14);
      const chipH = fontSize + 8;
      const chipY = y - chipH - 4 > 0 ? y - chipH - 4 : y + 4;
      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${stroke}" rx="6"/>
        <rect x="${x.toFixed(1)}" y="${chipY.toFixed(1)}" width="${chipW.toFixed(1)}" height="${chipH}" fill="${color}" rx="4"/>
        <text x="${(x + 7).toFixed(1)}" y="${(chipY + fontSize).toFixed(1)}" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff">${escapeXml(label)}</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${shapes}</svg>`;
  return sharp(base).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}

/* ------------------------------------------------------------------ */
/* Rollup en la cabecera                                               */
/* ------------------------------------------------------------------ */

async function recomputeInspeccionRollup(conn: PoolClient, inspeccionId: string): Promise<void> {
  const { rows } = await conn.query<{
    total: number;
    pendientes: number;
    errores: number;
    ok: number;
    peor: number;
  }>(
    `select count(*)::int total,
            count(*) filter (where analisis_estado in ('PENDIENTE','ANALIZANDO'))::int pendientes,
            count(*) filter (where analisis_estado = 'ERROR')::int errores,
            count(*) filter (where analisis_estado in ('ANALIZADA','SIN_DANOS'))::int ok,
            coalesce(max(case dano_peor when 'GRAVE' then 3 when 'MODERADA' then 2 when 'LEVE' then 1 else 0 end), 0)::int peor
       from inspeccion_foto
      where inspeccion_id = $1`,
    [inspeccionId],
  );
  const agg = rows[0];

  let estado: "PENDIENTE" | "EN_PROCESO" | "COMPLETADO" | "CON_ERRORES";
  if (agg.total === 0 || (agg.pendientes === agg.total)) estado = "PENDIENTE";
  else if (agg.pendientes > 0) estado = "EN_PROCESO";
  else if (agg.errores > 0) estado = "CON_ERRORES";
  else estado = "COMPLETADO";

  let calificacion: "SIN_DANOS" | Severidad | null = null;
  if (agg.peor === 3) calificacion = "GRAVE";
  else if (agg.peor === 2) calificacion = "MODERADA";
  else if (agg.peor === 1) calificacion = "LEVE";
  else if (estado === "COMPLETADO") calificacion = "SIN_DANOS";

  await conn.query(
    `update inspeccion
        set analisis_estado = $2,
            calificacion_dano = $3,
            analisis_completado_en = case when $2 = 'COMPLETADO' then now() else null end
      where id = $1`,
    [inspeccionId, estado, calificacion],
  );
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

export type FotoAnalisisEstado = "PENDIENTE" | "ANALIZANDO" | "ANALIZADA" | "SIN_DANOS" | "ERROR";

export type PhotoAnalisisResult = {
  estado: FotoAnalisisEstado;
  danosTotal: number;
  danoPeor: Severidad | null;
};

export type BatchResult = {
  analizadas: number;
  pendientes: number;
  errores: number;
  skipped?: "sin-inspeccion" | "no-completa";
};

/**
 * Analiza UNA foto: descarga el original, lo reduce, llama a OpenAI, genera y
 * sube el PNG anotado y persiste los daños + rollup en una transacción. Nunca
 * lanza: los errores dejan la foto en `analisis_estado='ERROR'`.
 */
export async function analyzePhoto(input: { fotoId: string }): Promise<PhotoAnalisisResult> {
  const pool = getDbPool();

  const claim = await pool.query<{
    inspeccion_id: string;
    slot: string;
    storage_path: string;
    analizada_storage_path: string | null;
  }>(
    `update inspeccion_foto
        set analisis_estado = 'ANALIZANDO', analisis_iniciado_en = now(), analisis_error = null
      where id = $1
        and (analisis_estado = 'PENDIENTE'
             or (analisis_estado = 'ERROR' and (analisis_iniciado_en is null or analisis_iniciado_en < now() - interval '30 minutes'))
             or (analisis_estado = 'ANALIZANDO' and analisis_iniciado_en < now() - interval '3 minutes'))
      returning inspeccion_id, slot, storage_path, analizada_storage_path`,
    [input.fotoId],
  );
  if (claim.rowCount !== 1) {
    return { estado: "ANALIZANDO", danosTotal: 0, danoPeor: null };
  }
  const { inspeccion_id, slot, storage_path, analizada_storage_path: oldAnnotated } = claim.rows[0];

  try {
    const insp = await pool.query<{ carroceria: string }>("select carroceria from inspeccion where id = $1", [
      inspeccion_id,
    ]);
    const carroceria = insp.rows[0]?.carroceria ?? "SEDAN";

    const dl = await bucket().download(storage_path);
    if (dl.error || !dl.data) {
      throw new Error(`No se pudo descargar la foto: ${dl.error?.message ?? "sin datos"}`);
    }
    const original = Buffer.from(await dl.data.arrayBuffer());

    const small = await sharp(original)
      .rotate()
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    const dataUri = `data:image/jpeg;base64,${small.toString("base64")}`;

    const danos = await requestDanos({ dataUri, slot: slot as SlotCode, carroceria });

    let annotatedPath: string | null = null;
    if (danos.length > 0) {
      const png = await renderAnnotated(original, danos);
      annotatedPath = `inspeccion/${inspeccion_id}/${slot.toLowerCase()}-${randomUUID()}-analizada.png`;
      const up = await bucket().upload(annotatedPath, png, { contentType: "image/png", upsert: false });
      if (up.error) throw new Error(`No se pudo subir la imagen anotada: ${up.error.message}`);
    }

    const estado: FotoAnalisisEstado = danos.length > 0 ? "ANALIZADA" : "SIN_DANOS";
    const danoPeor = worstSeverity(danos.map((d) => d.severidad));

    const conn = await pool.connect();
    try {
      await conn.query("begin");
      await conn.query("delete from inspeccion_dano where inspeccion_foto_id = $1", [input.fotoId]);
      for (const d of danos) {
        await conn.query(
          `insert into inspeccion_dano
             (inspeccion_foto_id, tipo, severidad, accion_recomendada, pieza, descripcion,
              bbox_x, bbox_y, bbox_w, bbox_h, confianza)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            input.fotoId,
            d.tipo,
            d.severidad,
            d.accion_recomendada,
            d.pieza.trim() || null,
            d.descripcion.trim() || null,
            d.bbox.x,
            d.bbox.y,
            d.bbox.w,
            d.bbox.h,
            round5(d.confianza),
          ],
        );
      }
      await conn.query(
        `update inspeccion_foto
            set analisis_estado = $2, analizada_storage_path = $3, analisis_modelo = $4,
                analizada_en = now(), danos_total = $5, dano_peor = $6, analisis_error = null
          where id = $1`,
        [input.fotoId, estado, annotatedPath, MODEL, danos.length, danoPeor],
      );
      await recomputeInspeccionRollup(conn, inspeccion_id);
      await conn.query(
        `insert into auditoria (entidad, entidad_id, accion, datos_nuevos, usuario_id)
         values ('INSPECCION', $1, 'CAMBIO_ESTADO',
                 jsonb_build_object('accion','ANALISIS_FOTO','foto_id',$2::text,'danos',$3::int), null)`,
        [inspeccion_id, input.fotoId, danos.length],
      );
      await conn.query("commit");
    } catch (err) {
      await conn.query("rollback").catch(() => {});
      await removeObject(annotatedPath);
      throw err;
    } finally {
      conn.release();
    }

    if (oldAnnotated && oldAnnotated !== annotatedPath) await removeObject(oldAnnotated);

    return { estado, danosTotal: danos.length, danoPeor };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido en el análisis.";
    console.error("[inspeccion] análisis de foto falló", input.fotoId, error);
    try {
      const conn = await pool.connect();
      try {
        await conn.query("begin");
        await conn.query("update inspeccion_foto set analisis_estado = 'ERROR', analisis_error = $2 where id = $1", [
          input.fotoId,
          msg.slice(0, 500),
        ]);
        await recomputeInspeccionRollup(conn, inspeccion_id);
        await conn.query("commit");
      } catch (e) {
        await conn.query("rollback").catch(() => {});
        throw e;
      } finally {
        conn.release();
      }
    } catch (e2) {
      console.error("[inspeccion] no se pudo marcar la foto como ERROR", input.fotoId, e2);
    }
    return { estado: "ERROR", danosTotal: 0, danoPeor: null };
  }
}

/**
 * Procesa hasta `max` fotos pendientes de una inspección COMPLETADA. Quien llama
 * (cron o el cliente) repite hasta `pendientes === 0`.
 */
export async function analyzeInspeccionBatch(input: { cotizacionId: string; max?: number }): Promise<BatchResult> {
  const max = input.max ?? 4;
  const pool = getDbPool();

  const insp = await pool.query<{ id: string; estado: string }>(
    "select id, estado from inspeccion where cotizacion_id = $1",
    [input.cotizacionId],
  );
  if (insp.rowCount !== 1) return { analizadas: 0, pendientes: 0, errores: 0, skipped: "sin-inspeccion" };
  if (insp.rows[0].estado !== "COMPLETADA") return { analizadas: 0, pendientes: 0, errores: 0, skipped: "no-completa" };
  const inspeccionId = insp.rows[0].id;

  const pend = await pool.query<{ id: string }>(
    `select id from inspeccion_foto
      where inspeccion_id = $1
        and (analisis_estado = 'PENDIENTE'
             or (analisis_estado = 'ERROR' and (analisis_iniciado_en is null or analisis_iniciado_en < now() - interval '30 minutes'))
             or (analisis_estado = 'ANALIZANDO' and analisis_iniciado_en < now() - interval '3 minutes'))
      order by creado_en asc
      limit $2`,
    [inspeccionId, max],
  );

  let analizadas = 0;
  for (const row of pend.rows) {
    const r = await analyzePhoto({ fotoId: row.id });
    if (r.estado === "ANALIZADA" || r.estado === "SIN_DANOS") analizadas++;
  }

  const agg = await pool.query<{ pendientes: number; errores: number }>(
    `select count(*) filter (where analisis_estado in ('PENDIENTE','ANALIZANDO'))::int pendientes,
            count(*) filter (where analisis_estado = 'ERROR')::int errores
       from inspeccion_foto where inspeccion_id = $1`,
    [inspeccionId],
  );
  return { analizadas, pendientes: agg.rows[0].pendientes, errores: agg.rows[0].errores };
}

/**
 * Barrido para el cron: toma inspecciones COMPLETADA con análisis pendiente y
 * procesa un lote de cada una.
 */
export async function sweepInspeccionesPendientes(input?: {
  maxInspecciones?: number;
  maxFotos?: number;
}): Promise<{ inspecciones: number; resultados: Array<{ cotizacionId: string } & BatchResult> }> {
  const maxInsp = input?.maxInspecciones ?? 3;
  const maxFotos = input?.maxFotos ?? 4;
  const pool = getDbPool();

  const { rows } = await pool.query<{ cotizacion_id: string }>(
    `select cotizacion_id from inspeccion
      where estado = 'COMPLETADA' and analisis_estado in ('PENDIENTE','EN_PROCESO','CON_ERRORES')
      order by completada_en asc nulls last
      limit $1`,
    [maxInsp],
  );

  const resultados: Array<{ cotizacionId: string } & BatchResult> = [];
  for (const row of rows) {
    resultados.push({
      cotizacionId: row.cotizacion_id,
      ...(await analyzeInspeccionBatch({ cotizacionId: row.cotizacion_id, max: maxFotos })),
    });
  }
  return { inspecciones: rows.length, resultados };
}
