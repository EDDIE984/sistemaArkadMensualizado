import ExcelJS from "exceljs";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { insurerPaymentFiltersSchema, methodLabel } from "@/lib/insurer/payment-types";
import { getAllInsurerPayments } from "@/lib/insurer/payments";
import { resolveInsurerSummaryScope } from "@/lib/insurer/summary-scope";
import { addSheet } from "@/lib/reports/xlsx-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONEY = '"$"#,##0.00';
const DATE = "dd/mm/yyyy";
const toDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : null);
const dateLabel = (iso: string) => iso.split("-").reverse().join("/");

/** Excel de Pagos: todos los pagos del filtro (mismo alcance validado que la pantalla). */
export async function GET(request: Request) {
  const session = await requireInsurerAdmin();
  const url = new URL(request.url);
  const { scope, selectedChannelId, selectedProductIds } = await resolveInsurerSummaryScope(session.insurerId!, {
    canal: url.searchParams.get("canal") ?? undefined,
    productos: url.searchParams.getAll("productos"),
  });
  const parsed = insurerPaymentFiltersSchema.safeParse({
    from: url.searchParams.get("desde"), to: url.searchParams.get("hasta"),
    channel: selectedChannelId, products: selectedProductIds,
    reconciliation: url.searchParams.get("conciliacion") ?? "TODOS", method: url.searchParams.get("metodo") ?? "TODOS",
  });
  if (!parsed.success) return new Response("Filtros inválidos.", { status: 400 });
  const f = parsed.data;
  const rows = await getAllInsurerPayments({ ...scope, insurerId: session.insurerId! }, f);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kuantix";
  workbook.created = new Date();
  addSheet(workbook, "Pagos", `Pagos registrados por los canales · ${dateLabel(f.from)} – ${dateLabel(f.to)}`, [
    { header: "Fecha de pago", key: "paidOn", width: 13, numFmt: DATE },
    { header: "Cliente", key: "client", width: 32 },
    { header: "Cédula / RUC", key: "identification", width: 15 },
    { header: "Correo", key: "email", width: 28 },
    { header: "Nº póliza", key: "policy", width: 12 },
    { header: "Placa", key: "plate", width: 11 },
    { header: "Marca", key: "brand", width: 14 },
    { header: "Modelo", key: "model", width: 16 },
    { header: "Producto", key: "product", width: 20 },
    { header: "Canal", key: "channel", width: 20 },
    { header: "Cuota", key: "installment", width: 8 },
    { header: "Vencimiento", key: "due", width: 13, numFmt: DATE },
    { header: "Monto pagado", key: "amount", width: 14, numFmt: MONEY, total: true },
    { header: "Método", key: "method", width: 15 },
    { header: "Referencia", key: "reference", width: 24 },
    { header: "Registrado por", key: "registeredBy", width: 22 },
    { header: "Conciliación", key: "status", width: 14 },
    { header: "Conciliado el", key: "reconciledAt", width: 13, numFmt: DATE },
    { header: "Conciliado por", key: "reconciledBy", width: 22 },
  ], rows.map((r) => ({
    ...r, plate: r.plate?.toUpperCase() ?? null, paidOn: toDate(r.paidOn), due: toDate(r.due), method: methodLabel(r.method),
    status: r.reconciledAt ? "Conciliado" : "Por conciliar", reconciledAt: toDate(r.reconciledAt),
  })));

  const file = Buffer.from(await workbook.xlsx.writeBuffer());
  return new Response(new Uint8Array(file), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="pagos-${f.from}_${f.to}.xlsx"`,
    "Cache-Control": "no-store",
  } });
}
