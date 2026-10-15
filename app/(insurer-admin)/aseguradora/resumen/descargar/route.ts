import ExcelJS from "exceljs";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { getExpiring, getProductionDetail, parseSummaryFilters } from "@/lib/channel/summary";
import { getCollections } from "@/lib/insurer/collections";
import { resolveInsurerSummaryScope } from "@/lib/insurer/summary-scope";
import { addSheet } from "@/lib/reports/xlsx-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONEY = '"$"#,##0.00';
const DATE = "dd/mm/yyyy";
const toDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : null);
const dateLabel = (iso: string) => iso.split("-").reverse().join("/");

/** Exporta exactamente el mismo alcance validado del Resumen de aseguradora. */
export async function GET(request: Request) {
  const session = await requireInsurerAdmin();
  const url = new URL(request.url);
  const filters = parseSummaryFilters({
    periodo: url.searchParams.get("periodo") ?? undefined,
    desde: url.searchParams.get("desde") ?? undefined,
    hasta: url.searchParams.get("hasta") ?? undefined,
    vence: url.searchParams.get("vence") ?? undefined,
    vdesde: url.searchParams.get("vdesde") ?? undefined,
    vhasta: url.searchParams.get("vhasta") ?? undefined,
  });
  const { scope } = await resolveInsurerSummaryScope(session.insurerId!, {
    canal: url.searchParams.get("canal") ?? undefined,
    productos: url.searchParams.getAll("productos"),
  });
  const [production, expiring, collections] = await Promise.all([
    getProductionDetail(scope, filters.period),
    getExpiring(scope, filters.expiry),
    getCollections(scope, filters.period),
  ]);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kuantix";
  workbook.created = new Date();

  addSheet(workbook, "Producción del período", `Cuotas que vencen en el período · ${dateLabel(filters.period.from)} – ${dateLabel(filters.period.to)}`, [
    { header: "Cliente", key: "client", width: 32 }, { header: "Cédula / RUC", key: "identification", width: 15 }, { header: "Correo", key: "email", width: 28 }, { header: "Teléfono", key: "phone", width: 14 }, { header: "Ciudad", key: "city", width: 14 },
    { header: "Marca", key: "brand", width: 14 }, { header: "Modelo", key: "model", width: 16 }, { header: "Año", key: "year", width: 8 }, { header: "Color", key: "color", width: 13 }, { header: "Placa", key: "plate", width: 11 },
    { header: "Valor asegurado", key: "insuredValue", width: 15, numFmt: MONEY, total: true }, { header: "Producto", key: "product", width: 20 }, { header: "Canal", key: "channel", width: 20 }, { header: "Aseguradora", key: "insurer", width: 20 }, { header: "Nº póliza", key: "policy", width: 12 },
    { header: "Emisión", key: "issued", width: 12, numFmt: DATE }, { header: "Inicio de vigencia", key: "start", width: 14, numFmt: DATE }, { header: "Fin de vigencia", key: "end", width: 14, numFmt: DATE }, { header: "Cuotas en el período", key: "installments", width: 11, total: true },
    { header: "Prima neta", key: "net", width: 13, numFmt: MONEY, total: true }, { header: "Super de Bancos", key: "superBancos", width: 12, numFmt: MONEY, total: true }, { header: "Seguro Campesino", key: "seguroCampesino", width: 12, numFmt: MONEY, total: true }, { header: "Derechos de emisión", key: "derechosEmision", width: 12, numFmt: MONEY, total: true },
    { header: "Subtotal", key: "subtotal", width: 12, numFmt: MONEY, total: true }, { header: "IVA", key: "iva", width: 11, numFmt: MONEY, total: true }, { header: "Prima total (inc. imp.)", key: "total", width: 15, numFmt: MONEY, total: true }, { header: "Comisión del canal", key: "commission", width: 15, numFmt: MONEY, total: true },
  ], production.map((row) => ({ ...row, plate: row.plate?.toUpperCase() ?? null, issued: toDate(row.issued), start: toDate(row.start), end: toDate(row.end) })));

  addSheet(workbook, "Próximos a vencer", `Pólizas vigentes que vencen entre ${dateLabel(filters.expiry.from)} y ${dateLabel(filters.expiry.to)}`, [
    { header: "Cliente", key: "client", width: 32 }, { header: "Cédula / RUC", key: "identification", width: 15 }, { header: "Teléfono", key: "phone", width: 14 }, { header: "Correo", key: "email", width: 28 }, { header: "Marca", key: "brand", width: 14 }, { header: "Modelo", key: "model", width: 16 }, { header: "Placa", key: "plate", width: 11 }, { header: "Producto", key: "product", width: 20 }, { header: "Canal", key: "channel", width: 20 }, { header: "Nº póliza", key: "policy", width: 12 }, { header: "Fin de vigencia", key: "end", width: 14, numFmt: DATE }, { header: "Días restantes", key: "days", width: 13 },
  ], expiring.map((row) => ({ ...row, plate: row.plate?.toUpperCase() ?? null, end: toDate(row.end) })));

  addSheet(workbook, "Cobranza por canal", `Exigible del período · ${dateLabel(filters.period.from)} – ${dateLabel(filters.period.to)}`, [
    { header: "Canal", key: "name", width: 26 }, { header: "Exigible", key: "due", width: 15, numFmt: MONEY, total: true }, { header: "Pagado", key: "paid", width: 15, numFmt: MONEY, total: true }, { header: "Efectividad", key: "effectiveness", width: 14, numFmt: "0.0%" }, { header: "Mora a hoy", key: "overdue", width: 15, numFmt: MONEY, total: true }, { header: "Pólizas en mora", key: "overduePolicies", width: 16, total: true },
  ], collections.channels);

  addSheet(workbook, "Mora por antigüedad", "Saldo vencido a hoy (America/Guayaquil)", [
    { header: "Antigüedad", key: "label", width: 18 }, { header: "Saldo vencido", key: "amount", width: 16, numFmt: MONEY, total: true }, { header: "Cuotas", key: "installments", width: 12, total: true }, { header: "Pólizas", key: "policies", width: 12, total: true },
  ], collections.aging);

  const file = Buffer.from(await workbook.xlsx.writeBuffer());
  return new Response(new Uint8Array(file), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="resumen-aseguradora-${filters.period.from}_${filters.period.to}.xlsx"`,
    "Cache-Control": "no-store",
  } });
}
