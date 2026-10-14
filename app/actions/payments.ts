"use server";

import { revalidatePath } from "next/cache";
import { requireChannelUser } from "@/lib/auth/session";
import { PaymentError, registerPayments } from "@/lib/payments/register";
import { money, type PaymentInput, type PaymentResult } from "@/lib/payments/types";

export async function savePayments(input: PaymentInput): Promise<PaymentResult> {
  const session = await requireChannelUser();
  let result;
  try {
    result = await registerPayments({ channelId: session.channelId!, insurerId: session.insurerId!, userId: session.actorId }, input);
  } catch (error) {
    if (error instanceof PaymentError) return { status: "error", message: error.message };
    console.error("Error al registrar pagos", error instanceof Error ? error.message : "Error desconocido");
    return { status: "error", message: "No pudimos registrar los pagos. Actualiza la consulta para revisar el estado antes de reintentar." };
  }
  for (const path of ["/canal/pagos", "/canal", "/canal/clientes", "/canal/cancelaciones", "/aseguradora/operacion", "/mi-cuenta"]) revalidatePath(path);
  return { status: "success", message: `Se registraron ${result.count} ${result.count === 1 ? "pago" : "pagos"} por ${money(result.cents / 100)}.` };
}
