import "server-only";

import ExcelJS from "exceljs";
import { getDbPool } from "@/lib/db/pool";
import { BULK_MAX_ROWS, cellText, norm, restoreLeadingZero } from "@/lib/channel/bulk-orders";
import { cancelPolicyWithConnection, CancellationError, findPoliciesForCancellation, previewPolicyCancellation, toMonthStart } from "@/lib/policies/cancel-policy";

/*
 * Carga masiva de cancelaciones del canal (regla 18 de
 * PLATAFORMA_SEGUROS_MODELO_ER.md): la póliza se identifica por cédula +
 * placa + producto y el guardado es todo o nada.
 */

type Scope = { insurerId: string; channelId: string; userId: string };

export type CancellationRowData = { identification: string; plate: string; product: string; month: string; reason: string };

/** Resultado por fila; `preview` existe si la fila es válida (sin valor de nivelación). */
export type CancellationRowResult = {
  row: number;
  data: CancellationRowData;
  errors: string[];
  preview?: { policyNumber: string; client: string; from: number; to: number; count: number; month: string; total: string };
};

export const CANCELLATION_COLUMNS: { key: keyof CancellationRowData; header: string; required: boolean; width: number; note: string }[] = [
  { key: "identification", header: "Cédula/RUC", required: true, width: 16, note: "Cédula o RUC del cliente, sin guiones." },
  { key: "plate", header: "Placa", required: true, width: 12, note: "Placa del vehículo asegurado (con o sin guion)." },
  { key: "product", header: "Producto", required: true, width: 30, note: "Elige de la lista." },
  { key: "month", header: "Mes de cancelación", required: true, width: 20, note: "Formato mm/aaaa. Se cancelan las cuotas que vencen desde ese mes." },
  { key: "reason", header: "Motivo", required: false, width: 36, note: "Opcional." },
];

export async function loadChannelProducts(scope: Pick<Scope, "insurerId" | "channelId">) {
  const { rows } = await getDbPool().query<{ id: string; name: string }>(
    `select id, nombre as name from producto where aseguradora_id = $1 and canal_id = $2 order by nombre`,
    [scope.insurerId, scope.channelId],
  );
  return rows;
}

// ── Plantilla ────────────────────────────────────────────────────────────────

const NAVY = "FF173250";
const TEAL = "FF02C7B3";

export async function buildCancellationTemplate(products: { name: string }[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kuantix";
  wb.created = new Date();
  const sheet = wb.addWorksheet("Cancelaciones", { views: [{ state: "frozen", ySplit: 1 }] });
  const info = wb.addWorksheet("Instrucciones");
  const lists = wb.addWorksheet("Catálogos");

  lists.getColumn(1).width = 36;
  lists.getCell(1, 1).value = "Productos";
  lists.getCell(1, 1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  lists.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  products.forEach((p, i) => { lists.getCell(i + 2, 1).value = p.name; });

  sheet.columns = CANCELLATION_COLUMNS.map((c) => ({ header: c.header + (c.required ? " *" : ""), key: c.key, width: c.width }));
  const header = sheet.getRow(1);
  header.height = 30;
  header.eachCell((cell, i) => {
    const required = CANCELLATION_COLUMNS[i - 1].required;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required ? NAVY : "FF5B6B7F" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: TEAL } } };
    cell.note = CANCELLATION_COLUMNS[i - 1].note;
  });

  const next = new Date();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  sheet.addRow({
    identification: "EJEMPLO 1700000000 (borra esta fila)",
    plate: "PBA1234",
    product: products[0]?.name ?? "",
    month: `${String(next.getMonth() + 1).padStart(2, "0")}/${next.getFullYear()}`,
    reason: "Venta del vehículo",
  });
  sheet.getRow(2).font = { italic: true, color: { argb: "FF5B6B7F" } };

  const col = (key: keyof CancellationRowData) => sheet.getColumn(key).letter;
  for (let r = 2; r <= BULK_MAX_ROWS + 1; r++) {
    sheet.getCell(`${col("product")}${r}`).dataValidation = {
      type: "list", allowBlank: true, formulae: [`'Catálogos'!$A$2:$A$${Math.max(2, products.length + 1)}`],
      showErrorMessage: true, errorStyle: "warning", errorTitle: "Producto", error: "Elige un valor de la lista.",
    };
    sheet.getCell(`${col("identification")}${r}`).numFmt = "@";
    sheet.getCell(`${col("month")}${r}`).numFmt = "@";
  }

  info.getColumn(1).width = 26;
  info.getColumn(2).width = 90;
  info.getCell("A1").value = "Plantilla de cancelación de pólizas";
  info.getCell("A1").font = { bold: true, size: 14, color: { argb: NAVY } };
  const meta: [string, string][] = [
    ["Identificación", "La póliza se busca por Cédula/RUC + Placa + Producto dentro de tu canal."],
    ["Mes de cancelación", "Se cancelan todas las cuotas que vencen desde ese mes hasta el final de la vigencia."],
    ["Cuotas pagadas", "Si alguna cuota desde ese mes ya está pagada, la fila se rechaza."],
    ["Máximo de filas", `${BULK_MAX_ROWS} por archivo.`],
    ["Guardado", "Todo o nada: si alguna fila tiene error no se cancela ninguna póliza."],
  ];
  meta.forEach(([k, v], i) => {
    info.getCell(i + 3, 1).value = k;
    info.getCell(i + 3, 1).font = { bold: true };
    info.getCell(i + 3, 2).value = v;
  });
  const start = meta.length + 5;
  CANCELLATION_COLUMNS.forEach((c, i) => {
    info.getCell(start + i, 1).value = c.header + (c.required ? " *" : "");
    info.getCell(start + i, 2).value = c.note;
  });
  info.getCell(start + CANCELLATION_COLUMNS.length + 1, 1).value = "* Obligatorio. La fila de ejemplo (en cursiva) debe borrarse antes de subir el archivo.";
  info.getCell(start + CANCELLATION_COLUMNS.length + 1, 1).font = { italic: true, color: { argb: "FF5B6B7F" } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── Lectura y validación ─────────────────────────────────────────────────────

export async function parseCancellationWorkbook(buffer: ArrayBuffer): Promise<{ rows: CancellationRowResult[]; error?: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { rows: [], error: "No pudimos leer el archivo. Usa la plantilla en formato .xlsx." };
  }
  const sheet = wb.getWorksheet("Cancelaciones") ?? wb.worksheets[0];
  if (!sheet) return { rows: [], error: "El archivo no tiene hojas." };

  const headerMap = new Map<number, keyof CancellationRowData>();
  sheet.getRow(1).eachCell((cell, c) => {
    const found = CANCELLATION_COLUMNS.find((x) => norm(x.header) === norm(cellText(cell.value)));
    if (found) headerMap.set(c, found.key);
  });
  const missing = CANCELLATION_COLUMNS.filter((c) => c.required && ![...headerMap.values()].includes(c.key));
  if (missing.length) return { rows: [], error: `Faltan columnas de la plantilla: ${missing.map((c) => c.header).join(", ")}.` };

  const rows: CancellationRowResult[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const data: CancellationRowData = { identification: "", plate: "", product: "", month: "", reason: "" };
    headerMap.forEach((key, c) => { data[key] = cellText(row.getCell(c).value); });
    if (Object.values(data).every((v) => !v)) return;
    if (/^ejemplo\b/i.test(data.identification)) return;
    data.identification = restoreLeadingZero(data.identification, [9, 12]);
    rows.push({ row: rowNumber, data, errors: [] });
  });
  if (rows.length > BULK_MAX_ROWS) return { rows: [], error: `El archivo tiene ${rows.length} filas; el máximo es ${BULK_MAX_ROWS}.` };
  return { rows };
}

/** Valida cada fila: forma, producto del canal, póliza única y reglas de cancelación. */
export async function validateCancellationRows(rows: CancellationRowResult[], scope: Pick<Scope, "insurerId" | "channelId">) {
  const products = await loadChannelProducts(scope);
  const db = getDbPool();
  const policyOf = new Map<number, string>();
  const results: CancellationRowResult[] = [];
  for (const r of rows) {
    const errors: string[] = [];
    const d = r.data;
    if (!/^\d{10}(\d{3})?$/.test(d.identification.trim())) errors.push("Cédula/RUC: 10 o 13 dígitos.");
    if (!d.plate.replace(/[^a-z0-9]/gi, "")) errors.push("Placa obligatoria.");
    const product = products.find((p) => norm(p.name) === norm(d.product));
    if (!d.product) errors.push("Producto obligatorio.");
    else if (!product) errors.push(`Producto "${d.product}" no pertenece a tu canal.`);
    const month = toMonthStart(d.month);
    if (!month) errors.push("Mes de cancelación inválido (usa mm/aaaa).");
    if (d.reason.length > 300) errors.push("Motivo: máximo 300 caracteres.");
    let preview: CancellationRowResult["preview"];
    if (!errors.length && product && month) {
      const found = await findPoliciesForCancellation(db, scope.channelId, { identification: d.identification.trim(), plate: d.plate, productId: product.id });
      const active = found.filter((p) => p.estado === "VIGENTE");
      if (!found.length) errors.push("No hay una póliza emitida con esa cédula, placa y producto en tu canal.");
      else if (!active.length) errors.push(`La póliza ${found[0].numero_poliza} está ${found[0].estado.toLowerCase()}; solo se cancelan pólizas vigentes.`);
      else if (active.length > 1) errors.push(`Hay ${active.length} pólizas vigentes con esos datos; cancélalas individualmente.`);
      else {
        try {
          const p = await previewPolicyCancellation(scope.channelId, { policyId: active[0].id, month });
          policyOf.set(r.row, p.policyId);
          preview = { policyNumber: p.policyNumber, client: p.client, from: p.from, to: p.to, count: p.count, month: p.month, total: p.total };
        } catch (error) {
          if (!(error instanceof CancellationError)) throw error;
          errors.push(error.message);
        }
      }
    }
    results.push({ ...r, errors, preview });
  }
  // Una póliza solo puede aparecer una vez en el archivo.
  const counts = new Map<string, number>();
  policyOf.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  for (const r of results) {
    const id = policyOf.get(r.row);
    if (id && (counts.get(id) ?? 0) > 1) {
      r.errors.push(`La póliza ${r.preview?.policyNumber} está repetida en el archivo.`);
      r.preview = undefined;
      policyOf.delete(r.row);
    }
  }
  return { results, policyOf };
}

// ── Guardado (todo o nada) ───────────────────────────────────────────────────

/** Cancela todas las pólizas en una transacción; si una fila falla no se guarda nada. */
export async function saveCancellations(items: { row: number; policyId: string; month: string; reason: string }[], scope: Scope) {
  const conn = await getDbPool().connect();
  const errors = new Map<number, string>();
  let committed = false;
  try {
    await conn.query("begin");
    for (const item of items) {
      await conn.query("savepoint fila");
      try {
        await cancelPolicyWithConnection(conn, {
          policyId: item.policyId, month: item.month, reason: item.reason, origin: "EXCEL",
          channelId: scope.channelId, userId: scope.userId,
        });
        await conn.query("release savepoint fila");
      } catch (error) {
        await conn.query("rollback to savepoint fila");
        if (error instanceof CancellationError) errors.set(item.row, error.message);
        else {
          console.error("Error en cancelación masiva", error);
          errors.set(item.row, "No pudimos cancelar esta póliza.");
        }
      }
    }
    if (errors.size) return { saved: 0, errors };
    await conn.query("commit");
    committed = true;
    return { saved: items.length, errors };
  } finally {
    if (!committed) await conn.query("rollback").catch(() => {});
    conn.release();
  }
}
