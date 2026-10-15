import type ExcelJS from "exceljs";

const NAVY = "FF173250";
const TEAL = "FF02C7B3";

export type SheetColumn = { header: string; key: string; width: number; numFmt?: string; total?: boolean };

export function addSheet(workbook: ExcelJS.Workbook, name: string, title: string, columns: SheetColumn[], rows: Record<string, unknown>[]) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { bold: true, size: 13, color: { argb: NAVY } };
  sheet.getRow(1).height = 22;
  sheet.columns = columns.map((column) => ({ key: column.key, width: column.width }));
  const header = sheet.getRow(3);
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: TEAL } } };
  });
  header.height = 28;
  rows.forEach((record) => {
    const row = sheet.addRow(columns.map((column) => record[column.key] ?? null));
    columns.forEach((column, index) => { if (column.numFmt) row.getCell(index + 1).numFmt = column.numFmt; });
  });
  if (!rows.length) {
    sheet.getCell(4, 1).value = "Sin registros para el filtro seleccionado.";
    sheet.getCell(4, 1).font = { italic: true, color: { argb: "FF5B6B7F" } };
    return;
  }
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + rows.length, column: columns.length } };
  if (!columns.some((column) => column.total)) return;
  const total = sheet.addRow(columns.map((column, index) => {
    if (index === 0) return `Total (${rows.length})`;
    if (!column.total) return null;
    const letter = sheet.getColumn(index + 1).letter;
    return { formula: `SUBTOTAL(9,${letter}4:${letter}${3 + rows.length})` };
  }));
  total.font = { bold: true, color: { argb: NAVY } };
  total.eachCell((cell, index) => {
    cell.border = { top: { style: "thin", color: { argb: TEAL } } };
    if (columns[index - 1].numFmt) cell.numFmt = columns[index - 1].numFmt!;
  });
}
