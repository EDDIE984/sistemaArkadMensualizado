import { z } from "zod";

export const PAYMENT_METHODS = [
  ["TRANSFERENCIA", "Transferencia"], ["EFECTIVO", "Efectivo"], ["DEPOSITO", "Depósito"], ["CHEQUE", "Cheque"], ["OTRO", "Otro"],
] as const;
export const RECONCILIATION_OPTIONS = [["TODOS", "Todos"], ["PENDIENTES", "Por conciliar"], ["CONCILIADOS", "Conciliados"]] as const;

/** Filtros de Pagos de la aseguradora. Canal y productos se validan aparte contra la aseguradora de la sesión. */
export const insurerPaymentFiltersSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  channel: z.string().uuid().nullable(),
  products: z.array(z.string().uuid()).max(200),
  reconciliation: z.enum(["TODOS", "PENDIENTES", "CONCILIADOS"]),
  method: z.enum(["TODOS", ...PAYMENT_METHODS.map(([value]) => value)] as [string, ...string[]]),
}).refine((v) => v.from <= v.to, { message: "La fecha desde debe ser anterior o igual a la fecha hasta." });
export type InsurerPaymentFilters = z.infer<typeof insurerPaymentFiltersSchema>;

export const reconcileInputSchema = z.object({
  reconcile: z.boolean(),
  selection: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("ids"), ids: z.array(z.string().uuid()).min(1).max(10_000) }),
    z.object({ mode: z.literal("all"), filters: insurerPaymentFiltersSchema, exclude: z.array(z.string().uuid()).max(10_000) }),
  ]),
  expectedCount: z.number().int().min(1).max(10_000),
});
export type ReconcileInput = z.infer<typeof reconcileInputSchema>;
export type ReconcileResult = { status: "success" | "error"; message: string };

export type InsurerPaymentRow = {
  id: string; paidOn: string; amount: number; method: string | null; reference: string | null; registeredBy: string | null;
  client: string; identification: string | null; email: string | null; policy: string; plate: string | null; brand: string | null; model: string | null;
  product: string; channel: string | null; installment: number; due: string;
  reconciledAt: string | null; reconciledBy: string | null;
};
export type InsurerPaymentSummary = { total: number; amount: number; reconciled: number; reconciledAmount: number; pending: number; pendingAmount: number };

export const methodLabel = (value: string | null) => PAYMENT_METHODS.find(([key]) => key === value)?.[1] ?? value ?? "—";

/** Query de los filtros vigentes (para paginar y descargar). */
export function paymentsQuery(f: InsurerPaymentFilters, extra: Record<string, string> = {}) {
  const query = new URLSearchParams({ desde: f.from, hasta: f.to, conciliacion: f.reconciliation, metodo: f.method, ...extra });
  if (f.channel) query.set("canal", f.channel);
  f.products.forEach((id) => query.append("productos", id));
  return query.toString();
}
