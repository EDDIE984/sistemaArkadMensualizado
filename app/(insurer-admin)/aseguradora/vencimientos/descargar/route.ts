import ExcelJS from "exceljs";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { getAllExpirations, readExpirationFilters } from "@/lib/insurer/expirations";
import { resolveInsurerSummaryScope } from "@/lib/insurer/summary-scope";
import { addSheet } from "@/lib/reports/xlsx-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONEY = '"$"#,##0.00';
const DATE = "dd/mm/yyyy";
const toDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : null);
const dateLabel = (iso: string) => iso.split("-").reverse().join("/");

/** Excel de Vencimientos: todas las pólizas del filtro (mismo alcance que la pantalla). */
export async function GET(request: Request) {
  const session = await requireInsurerAdmin();
  const url = new URL(request.url);
  const { filters, valid } = readExpirationFilters((key) => url.searchParams.get(key) ?? undefined);
  if (!valid) return new Response("Filtros inválidos.", { status: 400 });
  const { scope } = await resolveInsurerSummaryScope(session.insurerId!, { canal: url.searchParams.get("canal") ?? undefined, productos: url.searchParams.getAll("productos") });
  const rows = await getAllExpirations({ ...scope, insurerId: session.insurerId! }, filters);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kuantiq";
  workbook.created = new Date();
  addSheet(workbook, "Vencimientos", `Pólizas que vencen entre ${dateLabel(filters.from)} y ${dateLabel(filters.to)}`, [
    { header: "Cliente", key: "client", width: 32 }, { header: "Cédula / RUC", key: "identification", width: 15 },
    { header: "Teléfono", key: "phone", width: 14 }, { header: "Correo", key: "email", width: 28 },
    { header: "Marca", key: "brand", width: 14 }, { header: "Modelo", key: "model", width: 16 }, { header: "Año", key: "year", width: 8 }, { header: "Placa", key: "plate", width: 11 },
    { header: "Valor asegurado", key: "insuredValue", width: 15, numFmt: MONEY, total: true },
    { header: "Producto", key: "product", width: 20 }, { header: "Canal", key: "channel", width: 20 },
    { header: "Nº póliza", key: "policy", width: 12 }, { header: "Estado", key: "statusLabel", width: 10 },
    { header: "Emisión", key: "issued", width: 12, numFmt: DATE }, { header: "Inicio de vigencia", key: "start", width: 14, numFmt: DATE }, { header: "Fin de vigencia", key: "end", width: 14, numFmt: DATE },
    { header: "Días restantes", key: "days", width: 12 }, { header: "Cuota mensual", key: "monthly", width: 13, numFmt: MONEY, total: true },
    { header: "Cuotas vencidas", key: "overdue", width: 12, total: true },
  ], rows.map((r) => ({
    ...r, plate: r.plate?.toUpperCase() ?? null, statusLabel: r.status === "VIGENTE" ? "Vigente" : "Vencida",
    issued: toDate(r.issued), start: toDate(r.start), end: toDate(r.end),
  })));

  const file = Buffer.from(await workbook.xlsx.writeBuffer());
  return new Response(new Uint8Array(file), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="vencimientos-${filters.from}_${filters.to}.xlsx"`,
    "Cache-Control": "no-store",
  } });
}
