import ExcelJS from "exceljs";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { getPoliciesForExport, readPolicyFilters } from "@/lib/insurer/policies";
import { resolveInsurerSummaryScope } from "@/lib/insurer/summary-scope";
import { addSheet } from "@/lib/reports/xlsx-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONEY = '"$"#,##0.00';
const DATE = "dd/mm/yyyy";
const toDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : null);
const dateLabel = (iso: string) => iso.split("-").reverse().join("/");
const nice = (v: string | null) => (v ? v.toLowerCase().replace(/_/g, " ").replace(/^\p{L}/u, (c) => c.toUpperCase()) : null);
const RISK: Record<number, string> = { 1: "Alto", 2: "Moderado", 3: "Bajo" };

/** Excel de Pólizas emitidas: pólizas con condiciones + cuotas con pagos (mismo alcance que la pantalla). */
export async function GET(request: Request) {
  const session = await requireInsurerAdmin();
  const url = new URL(request.url);
  const { filters, valid } = readPolicyFilters((key) => url.searchParams.get(key) ?? undefined);
  if (!valid) return new Response("Filtros inválidos.", { status: 400 });
  const { scope } = await resolveInsurerSummaryScope(session.insurerId!, { canal: url.searchParams.get("canal") ?? undefined, productos: url.searchParams.getAll("productos") });
  const { policies, conditions, installments } = await getPoliciesForExport({ ...scope, insurerId: session.insurerId! }, filters);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kuantiq";
  workbook.created = new Date();
  addSheet(workbook, "Pólizas", `Pólizas emitidas · ${dateLabel(filters.from)} – ${dateLabel(filters.to)}`, [
    { header: "Nº póliza", key: "policy", width: 12 }, { header: "Estado", key: "statusLabel", width: 11 },
    { header: "Emisión", key: "issued", width: 12, numFmt: DATE }, { header: "Inicio de vigencia", key: "start", width: 14, numFmt: DATE }, { header: "Fin de vigencia", key: "end", width: 14, numFmt: DATE },
    { header: "Cliente", key: "client", width: 32 }, { header: "Cédula / RUC", key: "identification", width: 15 }, { header: "Correo", key: "email", width: 28 }, { header: "Teléfono", key: "phone", width: 14 }, { header: "Ciudad", key: "city", width: 14 },
    { header: "Marca", key: "brand", width: 14 }, { header: "Modelo", key: "model", width: 16 }, { header: "Año", key: "year", width: 8 }, { header: "Color", key: "color", width: 12 }, { header: "Placa", key: "plate", width: 11 }, { header: "Uso", key: "useLabel", width: 12 },
    { header: "Valor asegurado", key: "insuredValue", width: 15, numFmt: MONEY, total: true },
    { header: "Producto", key: "product", width: 20 }, { header: "Canal", key: "channel", width: 20 },
    { header: "Plazo (años)", key: "years", width: 10 }, { header: "Nivel de riesgo", key: "risk", width: 12 }, { header: "Tasa promedio", key: "rate", width: 12, numFmt: "0.00%" },
    { header: "Coberturas", key: "coverages", width: 48 }, { header: "Deducibles", key: "deductibles", width: 48 },
    { header: "Cuota mensual", key: "monthly", width: 13, numFmt: MONEY, total: true },
    { header: "Cuotas", key: "installments", width: 9, total: true }, { header: "Pagadas", key: "paid", width: 9, total: true }, { header: "Vencidas", key: "overdue", width: 9, total: true },
    { header: "Facturado (sin canceladas)", key: "billed", width: 15, numFmt: MONEY, total: true }, { header: "Pagado", key: "paidAmount", width: 13, numFmt: MONEY, total: true },
  ], policies.map((p) => ({
    ...p, statusLabel: nice(p.status), issued: toDate(p.issued), start: toDate(p.start), end: toDate(p.end), plate: p.plate?.toUpperCase() ?? null,
    color: nice(p.color), useLabel: nice(p.use), risk: RISK[p.riskLevel] ?? p.riskLevel,
    coverages: conditions.get(p.quoteId)?.coverages ?? "", deductibles: conditions.get(p.quoteId)?.deductibles ?? "",
  })));
  addSheet(workbook, "Cuotas y pagos", "Cuotas de las pólizas del filtro con sus pagos registrados", [
    { header: "Nº póliza", key: "policy", width: 12 }, { header: "Cliente", key: "client", width: 32 }, { header: "Cuota", key: "installment", width: 8 },
    { header: "Vencimiento", key: "due", width: 13, numFmt: DATE }, { header: "Monto", key: "amount", width: 13, numFmt: MONEY, total: true }, { header: "Estado", key: "statusLabel", width: 12 },
    { header: "Fecha de pago", key: "paidOn", width: 13, numFmt: DATE }, { header: "Pagado", key: "paidAmount", width: 13, numFmt: MONEY, total: true },
    { header: "Método", key: "methodLabel", width: 15 }, { header: "Referencia", key: "reference", width: 24 },
  ], installments.map((i) => ({ ...i, due: toDate(i.due), paidOn: toDate(i.paidOn), statusLabel: nice(i.status), methodLabel: nice(i.method) })));

  const file = Buffer.from(await workbook.xlsx.writeBuffer());
  return new Response(new Uint8Array(file), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="polizas-emitidas-${filters.from}_${filters.to}.xlsx"`,
    "Cache-Control": "no-store",
  } });
}
