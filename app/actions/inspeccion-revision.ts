"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { getDbPool } from "@/lib/db/pool";
import {
  assertInsurerOwnsInspeccion,
  InspeccionAccessError,
  InspeccionNotFoundError,
} from "@/lib/inspeccion/data";
import { isSeveridad } from "@/lib/inspeccion/labels";
import type { InsurerActionState } from "@/lib/insurer/action-state";

const UUID = z.string().uuid();

function fail(message: string): InsurerActionState {
  return { status: "error", message };
}
function ok(message: string): InsurerActionState {
  return { status: "success", message };
}

function revalidate(inspeccionId: string) {
  revalidatePath("/aseguradora/inspecciones");
  revalidatePath(`/aseguradora/inspecciones/${inspeccionId}`);
}

async function guard(inspeccionId: string) {
  const session = await requireInsurerAdmin();
  await assertInsurerOwnsInspeccion(session, inspeccionId); // lanza si no le pertenece
  return session;
}

/**
 * Guarda la edición del técnico: observación por foto (`obs_<fotoId>`) y override
 * de gravedad por daño (`sev_<danoId>` = LEVE|MODERADA|GRAVE o "" para quitarlo).
 */
export async function guardarRevisionTecnico(
  _prev: InsurerActionState,
  formData: FormData,
): Promise<InsurerActionState> {
  const inspeccionId = String(formData.get("inspeccionId") ?? "");
  if (!UUID.safeParse(inspeccionId).success) return fail("Solicitud inválida.");

  const obs: Array<{ fotoId: string; texto: string }> = [];
  const sev: Array<{ danoId: string; valor: string | null }> = [];
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key.startsWith("obs_")) {
      const fotoId = key.slice(4);
      if (UUID.safeParse(fotoId).success) obs.push({ fotoId, texto: value.trim() });
    } else if (key.startsWith("sev_")) {
      const danoId = key.slice(4);
      if (!UUID.safeParse(danoId).success) continue;
      if (value === "") sev.push({ danoId, valor: null });
      else if (isSeveridad(value)) sev.push({ danoId, valor: value });
      else return fail("Gravedad inválida.");
    }
  }

  let actorId: string;
  try {
    actorId = (await guard(inspeccionId)).actorId;
  } catch (error) {
    if (error instanceof InspeccionAccessError) return fail(error.message);
    if (error instanceof InspeccionNotFoundError) return fail(error.message);
    throw error;
  }

  const conn = await getDbPool().connect();
  try {
    await conn.query("begin");
    for (const { fotoId, texto } of obs) {
      await conn.query(
        "update inspeccion_foto set observacion_tecnico = $3 where id = $1 and inspeccion_id = $2",
        [fotoId, inspeccionId, texto || null],
      );
    }
    for (const { danoId, valor } of sev) {
      await conn.query(
        `update inspeccion_dano
            set severidad_revisada = $3,
                dano_revisado_en = case when $3 is null then null else now() end
          where id = $1
            and inspeccion_foto_id in (select id from inspeccion_foto where inspeccion_id = $2)`,
        [danoId, inspeccionId, valor],
      );
    }
    await conn.query(
      `insert into auditoria (entidad, entidad_id, accion, datos_nuevos, usuario_id)
       values ('INSPECCION', $1, 'CAMBIO_ESTADO',
               jsonb_build_object('accion','REVISION_TECNICO','fotos',$2::int,'danos',$3::int), $4)`,
      [inspeccionId, obs.length, sev.length, actorId],
    );
    await conn.query("commit");
  } catch (error) {
    await conn.query("rollback").catch(() => {});
    console.error("[inspeccion-revision] guardar técnico falló", error);
    return fail("No pudimos guardar las observaciones. Inténtalo de nuevo.");
  } finally {
    conn.release();
  }

  revalidate(inspeccionId);
  return ok("Observaciones guardadas.");
}

const dictamenSchema = z.object({
  inspeccionId: UUID,
  motivo: z.string().trim().min(3, "El motivo es obligatorio (mínimo 3 caracteres).").max(1000),
});

async function setDictamen(
  formData: FormData,
  estado: "APROBADA" | "RECHAZADA",
): Promise<InsurerActionState> {
  const parsed = dictamenSchema.safeParse({
    inspeccionId: formData.get("inspeccionId"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { inspeccionId, motivo } = parsed.data;

  let actorId: string;
  try {
    actorId = (await guard(inspeccionId)).actorId;
  } catch (error) {
    if (error instanceof InspeccionAccessError) return fail(error.message);
    if (error instanceof InspeccionNotFoundError) return fail(error.message);
    throw error;
  }

  const conn = await getDbPool().connect();
  try {
    await conn.query("begin");
    await conn.query(
      `update inspeccion
          set estado_revision = $2, revisado_por_usuario_id = $3, revisado_en = now(), revision_motivo = $4
        where id = $1`,
      [inspeccionId, estado, actorId, motivo],
    );
    await conn.query(
      `insert into auditoria (entidad, entidad_id, accion, datos_nuevos, usuario_id)
       values ('INSPECCION', $1, 'CAMBIO_ESTADO',
               jsonb_build_object('accion', $2::text, 'motivo', $3::text), $4)`,
      [inspeccionId, estado === "APROBADA" ? "APROBACION" : "RECHAZO", motivo, actorId],
    );
    await conn.query("commit");
  } catch (error) {
    await conn.query("rollback").catch(() => {});
    console.error("[inspeccion-revision] dictamen falló", error);
    return fail("No pudimos registrar el dictamen. Inténtalo de nuevo.");
  } finally {
    conn.release();
  }

  revalidate(inspeccionId);
  return ok(estado === "APROBADA" ? "Inspección aprobada." : "Inspección rechazada.");
}

export async function aprobarInspeccion(
  _prev: InsurerActionState,
  formData: FormData,
): Promise<InsurerActionState> {
  return setDictamen(formData, "APROBADA");
}

export async function rechazarInspeccion(
  _prev: InsurerActionState,
  formData: FormData,
): Promise<InsurerActionState> {
  return setDictamen(formData, "RECHAZADA");
}
