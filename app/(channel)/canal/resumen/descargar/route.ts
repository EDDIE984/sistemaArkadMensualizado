import ExcelJS from "exceljs";
import { requireChannelUser } from "@/lib/auth/session";
import { getExpiring, getProductionDetail, parseSummaryFilters } from "@/lib/channel/summary";
import { addSheet } from "@/lib/reports/xlsx-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONEY = '"$"#,##0.00';
const DATE = "dd/mm/yyyy";

const toDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : null);

/** Excel del Resumen: producción del período por póliza (cuotas que vencen) + próximos a vencer. */
export async function GET(request: Request) {
  const s = await requireChannelUser();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const f = parseSummaryFilters(sp);
  const scope = { insurerId: null, channelId: s.channelId!, productIds: [] };
  const [production, expiring] = await Promise.all([getProductionDetail(scope, f.period), getExpiring(scope, f.expiry)]);
  const fmt = (iso: string) => iso.split("-").reverse().join("/");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kuantiq";
  wb.created = new Date();

  addSheet(wb, "Producción del período", `Cuotas que vencen en el período · ${fmt(f.period.from)} – ${fmt(f.period.to)}`, [
    { header: "Cliente", key: "client", width: 32 },
    { header: "Cédula / RUC", key: "identification", width: 15 },
    { header: "Correo", key: "email", width: 28 },
    { header: "Teléfono", key: "phone", width: 14 },
    { header: "Ciudad", key: "city", width: 14 },
    { header: "Marca", key: "brand", width: 14 },
    { header: "Modelo", key: "model", width: 16 },
    { header: "Año", key: "year", width: 8 },
    { header: "Color", key: "color", width: 13 },
    { header: "Placa", key: "plate", width: 11 },
    { header: "Valor asegurado", key: "insuredValue", width: 15, numFmt: MONEY, total: true },
    { header: "Producto", key: "product", width: 20 },
    { header: "Aseguradora", key: "insurer", width: 20 },
    { header: "Nº póliza", key: "policy", width: 12 },
    { header: "Emisión", key: "issued", width: 12, numFmt: DATE },
    { header: "Inicio de vigencia", key: "start", width: 14, numFmt: DATE },
    { header: "Fin de vigencia", key: "end", width: 14, numFmt: DATE },
    { header: "Cuotas en el período", key: "installments", width: 11, total: true },
    { header: "Prima neta", key: "net", width: 13, numFmt: MONEY, total: true },
    { header: "Super de Bancos", key: "superBancos", width: 12, numFmt: MONEY, total: true },
    { header: "Seguro Campesino", key: "seguroCampesino", width: 12, numFmt: MONEY, total: true },
    { header: "Derechos de emisión", key: "derechosEmision", width: 12, numFmt: MONEY, total: true },
    { header: "Subtotal", key: "subtotal", width: 12, numFmt: MONEY, total: true },
    { header: "IVA", key: "iva", width: 11, numFmt: MONEY, total: true },
    { header: "Prima total (inc. imp.)", key: "total", width: 15, numFmt: MONEY, total: true },
    { header: "Comisión del canal", key: "commission", width: 15, numFmt: MONEY, total: true },
  ], production.map((r) => ({ ...r, plate: r.plate?.toUpperCase() ?? null, issued: toDate(r.issued), start: toDate(r.start), end: toDate(r.end) })));

  addSheet(wb, "Próximos a vencer", `Pólizas vigentes que vencen entre ${fmt(f.expiry.from)} y ${fmt(f.expiry.to)}`, [
    { header: "Cliente", key: "client", width: 32 },
    { header: "Cédula / RUC", key: "identification", width: 15 },
    { header: "Teléfono", key: "phone", width: 14 },
    { header: "Correo", key: "email", width: 28 },
    { header: "Marca", key: "brand", width: 14 },
    { header: "Modelo", key: "model", width: 16 },
    { header: "Placa", key: "plate", width: 11 },
    { header: "Producto", key: "product", width: 20 },
    { header: "Nº póliza", key: "policy", width: 12 },
    { header: "Fin de vigencia", key: "end", width: 14, numFmt: DATE },
    { header: "Días restantes", key: "days", width: 13 },
  ], expiring.map((r) => ({ ...r, plate: r.plate?.toUpperCase() ?? null, end: toDate(r.end) })));

  const file = Buffer.from(await wb.xlsx.writeBuffer());
  const name = `resumen-canal-${f.period.from}_${f.period.to}.xlsx`;
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
