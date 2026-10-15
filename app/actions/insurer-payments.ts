"use server";

import { revalidatePath } from "next/cache";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { ReconcileError, reconcilePayments } from "@/lib/insurer/payments";
import { reconcileInputSchema, type ReconcileInput, type ReconcileResult } from "@/lib/insurer/payment-types";

export async function saveReconciliation(input: ReconcileInput): Promise<ReconcileResult> {
  const session = await requireInsurerAdmin();
  const parsed = reconcileInputSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Revisa la selección y los filtros antes de continuar." };
  let count;
  try {
    count = await reconcilePayments({ insurerId: session.insurerId!, userId: session.actorId }, parsed.data);
  } catch (error) {
    if (error instanceof ReconcileError) return { status: "error", message: error.message };
    console.error("Error al conciliar pagos", error instanceof Error ? error.message : "Error desconocido");
    return { status: "error", message: "No pudimos actualizar la conciliación. Actualiza la consulta antes de reintentar." };
  }
  revalidatePath("/aseguradora/pagos");
  const noun = count === 1 ? "pago" : "pagos";
  return { status: "success", message: parsed.data.reconcile ? `Se conciliaron ${count} ${noun}.` : `Se quitó la conciliación de ${count} ${noun}.` };
}
