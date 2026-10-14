import { z } from "zod";

export const paymentFiltersSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  products: z.array(z.string().uuid()).max(200),
  status: z.enum(["POR_COBRAR", "PENDIENTE", "VENCIDO", "PAGADO", "TODOS"]),
}).refine((v) => v.from <= v.to, { message: "La fecha desde debe ser anterior o igual a la fecha hasta." });
export type PaymentFilters = z.infer<typeof paymentFiltersSchema>;
export const paymentInputSchema = z.object({
  selection: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("ids"), ids: z.array(z.string().uuid()).min(1).max(10_000) }),
    // Todas las del filtro menos, por póliza, las cuotas desde `from` (quitar una cuota quita también las siguientes).
    z.object({ mode: z.literal("all"), filters: paymentFiltersSchema, exclude: z.array(z.object({ policyId: z.string().uuid(), from: z.number().int().min(1) })).max(10_000) }),
  ]),
  date: z.string().date(),
  method: z.enum(["TRANSFERENCIA", "EFECTIVO", "DEPOSITO", "CHEQUE", "OTRO"]),
  reference: z.string().trim().max(200),
  expectedCount: z.number().int().min(1).max(10_000),
  expectedCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export type PaymentInput = z.infer<typeof paymentInputSchema>;
export type PaymentResult = { status: "success" | "error"; message: string };
export type PaymentRow = {
  id: string; policy_id: string; policy: string; issued: string; client: string; identification: string | null;
  plate: string | null; product: string; installment: number; due: string;
  amount: string; balance: string; status: string;
  paid_on: string | null; method: string | null; reference: string | null; registered_by: string | null;
  /** Primera cuota por cobrar de la póliza (orden de pago). */
  next_pending: number | null;
  /** Tiene una cuota anterior por cobrar fuera del filtro. */
  blocked: boolean;
  /** Cuotas pagables del filtro de esta póliza desde esta cuota (inclusive), y su saldo. */
  tail_count: number; tail_balance: string;
};
export type PaymentSummary = { total: number; payable: number; balance: string; blocked: number; max_issued: string | null };

export const money = (value: string | number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(value));
export const day = (value: string) => value.split("-").reverse().join("/");
export const month = (value: string) => new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
