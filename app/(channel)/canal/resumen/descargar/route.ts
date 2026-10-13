import ExcelJS from "exceljs";
import { requireChannelUser } from "@/lib/auth/session";
import { getExpiring, getProductionDetail, parseSummaryFilters } from "@/lib/channel/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAVY = "FF173250";
const TEAL = "FF02C7B3";
const MONEY = '"$"#,##0.00';
const DATE = "dd/mm/yyyy";

type Col = { header: string; key: string; width: number; numFmt?: string; total?: boolean };

const toDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : null);

function addSheet(wb: ExcelJS.Workbook, name: string, title: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
  ws.mergeCells(1, 1, 1, cols.length);
  ws.getCell(1, 1).value = title;
  ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: NAVY } };
  ws.getRow(1).height = 22;
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const header = ws.getRow(3);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: TEAL } } };
  });
  header.height = 28;
  rows.forEach((r) => {
    const row = ws.addRow(cols.map((c) => r[c.key] ?? null));
    cols.forEach((c, i) => { if (c.numFmt) row.getCell(i + 1).numFmt = c.numFmt; });
  });
  if (rows.length) {
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + rows.length, column: cols.length } };
    if (cols.some((c) => c.total)) {
      const total = ws.addRow(cols.map((c, i) => {
        if (i === 0) return `Total (${rows.length})`;
        if (!c.total) return null;
        const letter = ws.getColumn(i + 1).letter;
        return { formula: `SUBTOTAL(9,${letter}4:${letter}${3 + rows.length})` };
      }));
      total.font = { bold: true, color: { argb: NAVY } };
      total.eachCell((cell, i) => {
        cell.border = { top: { style: "thin", color: { argb: TEAL } } };
        if (cols[i - 1].numFmt) cell.numFmt = cols[i - 1].numFmt!;
      });
    }
  } else {
    ws.getCell(4, 1).value = "Sin registros para el filtro seleccionado.";
    ws.getCell(4, 1).font = { italic: true, color: { argb: "FF5B6B7F" } };
  }
}

/** Excel del Resumen: producción del período por póliza (cuotas que vencen) + próximos a vencer. */
export async function GET(request: Request) {
  const s = await requireChannelUser();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const f = parseSummaryFilters(sp);
  const [production, expiring] = await Promise.all([getProductionDetail(s.channelId!, f.period), getExpiring(s.channelId!, f.expiry)]);
  const fmt = (iso: string) => iso.split("-").reverse().join("/");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kuantix";
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
