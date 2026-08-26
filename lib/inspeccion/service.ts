import "server-only";

import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import { getDbPool } from "@/lib/db/pool";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  derivedEstado,
  isSlotValidFor,
  progress,
  requiredSlots,
  type Carroceria,
  type SlotCode,
} from "@/lib/inspeccion/slots";
import {
  INSPECCION_BUCKET,
  InspeccionStateError,
  InspeccionValidationError,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/inspeccion/data";
import type { FotoMutationResult, InspeccionFotoView } from "@/lib/inspeccion/types";

const EXT_BY_MIME: Record<"image/jpeg" | "image/webp", string> = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function loadHeader(
  conn: PoolClient,
  cotizacionId: string,
): Promise<{ id: string; carroceria: Carroceria; estado: string }> {
  const result = await conn.query<{ id: string; carroceria: string; estado: string }>(
    "select id, carroceria, estado from inspeccion where cotizacion_id = $1 for update",
    [cotizacionId],
  );
  if (result.rowCount !== 1) {
    throw new InspeccionStateError("Primero elige la carrocería para iniciar la inspección.");
  }
  return result.rows[0] as { id: string; carroceria: Carroceria; estado: string };
}

async function filledSlots(conn: PoolClient, inspeccionId: string): Promise<SlotCode[]> {
  const result = await conn.query<{ slot: string }>(
    "select slot from inspeccion_foto where inspeccion_id = $1",
    [inspeccionId],
  );
  return result.rows.map((row) => row.slot as SlotCode);
}

async function syncEstado(
  conn: PoolClient,
  inspeccion: { id: string; carroceria: Carroceria; estado: string },
  actorUserId: string | null,
): Promise<{ estado: "EN_PROGRESO" | "COMPLETADA"; completadas: number; requeridas: number }> {
  const filled = await filledSlots(conn, inspeccion.id);
  const { completadas, requeridas } = progress(inspeccion.carroceria, filled);
  const estado = derivedEstado(inspeccion.carroceria, filled);

  if (estado !== inspeccion.estado) {
    await conn.query(
      `update inspeccion
         set estado = $2,
             completada_en = case when $2 = 'COMPLETADA' then now() else null end
       where id = $1`,
      [inspeccion.id, estado],
    );
    if (estado === "COMPLETADA") {
      await conn.query(
        `insert into auditoria (entidad, entidad_id, accion, datos_nuevos, usuario_id)
         values ('INSPECCION', $1, 'CAMBIO_ESTADO', jsonb_build_object('estado', 'COMPLETADA'), $2)`,
        [inspeccion.id, actorUserId],
      );
    }
  }

  return { estado, completadas, requeridas };
}

function storageClient() {
  return createAdminClient().storage.from(INSPECCION_BUCKET);
}

async function removeObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;
  try {
    await storageClient().remove(paths);
  } catch (error) {
    console.error("[inspeccion] no se pudo borrar objeto(s) de Storage", paths, error);
  }
}

/**
 * Crea la inspección de una cotización o cambia su carrocería. Idempotente por
 * `unique(cotizacion_id)`. Si la nueva carrocería deja tomas fuera de alcance,
 * borra esas fotos (filas + objetos) y recalcula el estado.
 */
export async function startOrUpdateInspeccion(input: {
  cotizacionId: string;
  carroceria: Carroceria;
  origen: "AUTOGESTION" | "CANAL";
  actorUserId: string | null;
}): Promise<void> {
  const conn = await getDbPool().connect();
  const orphans: string[] = [];
  try {
    await conn.query("begin");

    const existing = await conn.query<{ id: string; carroceria: string; estado: string }>(
      "select id, carroceria, estado from inspeccion where cotizacion_id = $1 for update",
      [input.cotizacionId],
    );

    if (existing.rowCount === 0) {
      const inserted = await conn.query<{ id: string }>(
        `insert into inspeccion (cotizacion_id, carroceria, origen)
         values ($1, $2, $3)
         returning id`,
        [input.cotizacionId, input.carroceria, input.origen],
      );
      await conn.query(
        `insert into auditoria (entidad, entidad_id, accion, datos_nuevos, usuario_id)
         values ('INSPECCION', $1, 'CREACION',
                 jsonb_build_object('cotizacion_id', $2::text, 'carroceria', $3::text), $4)`,
        [inserted.rows[0].id, input.cotizacionId, input.carroceria, input.actorUserId],
      );
      await conn.query("commit");
      return;
    }

    const row = existing.rows[0];
    if (row.carroceria === input.carroceria) {
      await conn.query("commit");
      return;
    }

    const allowed = new Set(requiredSlots(input.carroceria));
    const stale = await conn.query<{ storage_path: string }>(
      `delete from inspeccion_foto
       where inspeccion_id = $1 and not (slot = any($2::text[]))
       returning storage_path`,
      [row.id, [...allowed]],
    );
    orphans.push(...stale.rows.map((r) => r.storage_path));

    await conn.query("update inspeccion set carroceria = $2 where id = $1", [row.id, input.carroceria]);
    await syncEstado(conn, { id: row.id, carroceria: input.carroceria, estado: row.estado }, input.actorUserId);

    await conn.query("commit");
  } catch (error) {
    await conn.query("rollback");
    throw error;
  } finally {
    conn.release();
  }

  await removeObjects(orphans);
}

/**
 * Guarda (o reemplaza) la foto de un slot. Sube el objeto ANTES de commitear la
 * fila; si la transacción falla, compensa borrando el objeto recién subido. El
 * objeto viejo se borra sólo después del commit.
 */
export async function saveFoto(input: {
  cotizacionId: string;
  slot: SlotCode;
  bytes: Buffer;
  mime: "image/jpeg" | "image/webp";
  ancho: number | null;
  alto: number | null;
  geo: { lat: number; lng: number; precisionM: number | null; capturadoEn: string | null } | null;
  capturadoCon: "CAMARA" | "ARCHIVO";
  actorUserId: string | null;
}): Promise<FotoMutationResult> {
  const conn = await getDbPool().connect();
  let newPath: string | null = null;
  const oldPaths: string[] = [];
  try {
    await conn.query("begin");
    const header = await loadHeader(conn, input.cotizacionId);

    if (!isSlotValidFor(header.carroceria, input.slot)) {
      throw new InspeccionValidationError("Esa toma no aplica para la carrocería seleccionada.");
    }

    newPath = `inspeccion/${header.id}/${input.slot.toLowerCase()}-${randomUUID()}.${EXT_BY_MIME[input.mime]}`;
    const uploaded = await storageClient().upload(newPath, input.bytes, {
      contentType: input.mime,
      upsert: false,
    });
    if (uploaded.error) {
      throw new Error(`No se pudo subir la foto: ${uploaded.error.message}`);
    }

    const previous = await conn.query<{ storage_path: string }>(
      "select storage_path from inspeccion_foto where inspeccion_id = $1 and slot = $2 for update",
      [header.id, input.slot],
    );
    if (previous.rowCount) {
      oldPaths.push(previous.rows[0].storage_path);
      await conn.query("delete from inspeccion_foto where inspeccion_id = $1 and slot = $2", [
        header.id,
        input.slot,
      ]);
    }

    const inserted = await conn.query<{
      id: string;
      slot: string;
      capturado_con: string;
      lat: string | null;
      lng: string | null;
      creado_en: string;
    }>(
      `insert into inspeccion_foto
         (inspeccion_id, slot, storage_path, mime, bytes, ancho, alto,
          lat, lng, precision_m, geo_capturado_en, capturado_con)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning id, slot, capturado_con, lat, lng, creado_en`,
      [
        header.id,
        input.slot,
        newPath,
        input.mime,
        input.bytes.byteLength,
        input.ancho,
        input.alto,
        input.geo?.lat ?? null,
        input.geo?.lng ?? null,
        input.geo?.precisionM ?? null,
        input.geo?.capturadoEn ?? null,
        input.capturadoCon,
      ],
    );

    const sync = await syncEstado(conn, header, input.actorUserId);
    await conn.query("commit");

    await removeObjects(oldPaths);

    const signed = await storageClient().createSignedUrl(newPath, SIGNED_URL_TTL_SECONDS);
    const row = inserted.rows[0];
    const foto: InspeccionFotoView = {
      id: row.id,
      slot: row.slot as SlotCode,
      signedUrl: signed.data?.signedUrl ?? "",
      capturadoCon: row.capturado_con === "ARCHIVO" ? "ARCHIVO" : "CAMARA",
      lat: row.lat === null ? null : Number(row.lat),
      lng: row.lng === null ? null : Number(row.lng),
      creadoEn: row.creado_en,
    };
    return { foto, estado: sync.estado, completadas: sync.completadas, requeridas: sync.requeridas };
  } catch (error) {
    await conn.query("rollback").catch(() => {});
    if (newPath) await removeObjects([newPath]);
    throw error;
  } finally {
    conn.release();
  }
}

/** Borra la foto de un slot (fila + objeto) y recalcula el estado. */
export async function deleteFoto(input: {
  cotizacionId: string;
  slot: SlotCode;
  actorUserId: string | null;
}): Promise<FotoMutationResult> {
  const conn = await getDbPool().connect();
  const removed: string[] = [];
  try {
    await conn.query("begin");
    const header = await loadHeader(conn, input.cotizacionId);

    const existing = await conn.query<{ storage_path: string }>(
      "select storage_path from inspeccion_foto where inspeccion_id = $1 and slot = $2 for update",
      [header.id, input.slot],
    );
    if (existing.rowCount) {
      removed.push(existing.rows[0].storage_path);
      await conn.query("delete from inspeccion_foto where inspeccion_id = $1 and slot = $2", [
        header.id,
        input.slot,
      ]);
    }

    const sync = await syncEstado(conn, header, input.actorUserId);
    await conn.query("commit");

    await removeObjects(removed);
    return { estado: sync.estado, completadas: sync.completadas, requeridas: sync.requeridas };
  } catch (error) {
    await conn.query("rollback").catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
}
