"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import {
  assertQuoteOwnership,
  InspeccionAccessError,
  InspeccionNotFoundError,
} from "@/lib/inspeccion/data";
import { deleteInspeccion, startOrUpdateInspeccion } from "@/lib/inspeccion/service";
import { CARROCERIAS } from "@/lib/inspeccion/slots";
import type { InspeccionActionState } from "@/lib/inspeccion/types";

const schema = z.object({
  cotizacionId: z.string().uuid(),
  carroceria: z.enum(CARROCERIAS as unknown as [string, ...string[]]),
});

function revalidateAll(cotizacionId: string) {
  for (const base of ["/mi-cuenta/cotizaciones", "/canal/cotizaciones"]) {
    revalidatePath(`${base}/${cotizacionId}`);
    revalidatePath(`${base}/${cotizacionId}/inspeccion`);
  }
}

async function applyCarroceria(formData: FormData): Promise<InspeccionActionState> {
  const session = await requireSession();
  const parsed = schema.safeParse({
    cotizacionId: formData.get("cotizacionId"),
    carroceria: formData.get("carroceria"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Selecciona una carrocería válida." };
  }

  try {
    const ownership = await assertQuoteOwnership(session, parsed.data.cotizacionId);
    await startOrUpdateInspeccion({
      cotizacionId: parsed.data.cotizacionId,
      carroceria: parsed.data.carroceria as (typeof CARROCERIAS)[number],
      origen: ownership.origen,
      actorUserId: session.actorType === "USUARIO" ? session.actorId : null,
    });
  } catch (error) {
    if (error instanceof InspeccionAccessError) return { status: "error", message: error.message };
    if (error instanceof InspeccionNotFoundError) return { status: "error", message: error.message };
    console.error("[inspeccion] error al guardar carrocería", error);
    return { status: "error", message: "No pudimos guardar la carrocería. Inténtalo de nuevo." };
  }

  revalidateAll(parsed.data.cotizacionId);
  return { status: "success" };
}

/** Inicia la inspección eligiendo la carrocería (form del picker, useActionState). */
export async function iniciarInspeccion(
  _prev: InspeccionActionState,
  formData: FormData,
): Promise<InspeccionActionState> {
  return applyCarroceria(formData);
}

/** Cambia la carrocería de una inspección ya iniciada (borra fotos fuera de alcance). */
export async function cambiarCarroceria(
  _prev: InspeccionActionState,
  formData: FormData,
): Promise<InspeccionActionState> {
  return applyCarroceria(formData);
}

/** Elimina la inspección completa (fotos + objetos) para volver a generarla desde el inicio. */
export async function eliminarInspeccion(
  _prev: InspeccionActionState,
  formData: FormData,
): Promise<InspeccionActionState> {
  const session = await requireSession();
  const cotizacionId = String(formData.get("cotizacionId") ?? "");
  if (!z.string().uuid().safeParse(cotizacionId).success) {
    return { status: "error", message: "Solicitud inválida." };
  }

  try {
    await assertQuoteOwnership(session, cotizacionId);
    await deleteInspeccion({
      cotizacionId,
      actorUserId: session.actorType === "USUARIO" ? session.actorId : null,
    });
  } catch (error) {
    if (error instanceof InspeccionAccessError) return { status: "error", message: error.message };
    if (error instanceof InspeccionNotFoundError) return { status: "error", message: error.message };
    console.error("[inspeccion] error al eliminar la inspección", error);
    return { status: "error", message: "No pudimos eliminar la inspección. Inténtalo de nuevo." };
  }

  revalidateAll(cotizacionId);
  return { status: "success" };
}
