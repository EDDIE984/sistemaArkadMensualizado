import "server-only";

import ExcelJS from "exceljs";
import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/db/pool";
import { createQuoteWithConnection, QuoteConfigurationError } from "@/lib/quotes/create-quote";
import { CertificateDeliveryError, verifyEmailDomain } from "@/lib/certificates/send";
import { deliverCertificate, prepareCertificate, removeCertificateFiles, type PreparedCertificate } from "@/lib/certificates/issue";
import { bulkRowSchema, MARITAL_STATUSES, startDateRange, VEHICLE_STATUSES, VEHICLE_USES, type BulkRow } from "@/lib/channel/schemas";

/*
 * Carga masiva de Órdenes de Emisión del canal (regla en
 * PLATAFORMA_SEGUROS_MODELO_ER.md): un producto por archivo, todo o nada,
 * y el cliente existente (misma cédula/RUC o correo) se actualiza.
 */

export const BULK_MAX_ROWS = 100;
export const BULK_MAX_BYTES = 5 * 1024 * 1024;

type Scope = { insurerId: string; channelId: string; userId: string };

export type BulkCatalog = {
  product: { id: string; name: string; insurerName: string };
  coverages: { id: string; name: string }[];
  cities: { id: string; name: string }[];
  vehicleTypes: { id: string; name: string }[];
  models: { brand: string; model: string }[];
  colors: string[];
};

/** Fila tal como se muestra/edita en la revisión: número de fila del Excel + datos crudos + errores. */
export type BulkRowResult = { row: number; data: Record<keyof BulkRow, string>; errors: string[] };

/** Columnas de la plantilla, en orden. `key` es el campo de `BulkRow`. */
export const BULK_COLUMNS: { key: keyof BulkRow; header: string; required: boolean; width: number; note: string }[] = [
  { key: "name", header: "Nombre o razón social", required: true, width: 32, note: "Nombres y apellidos del cliente o razón social." },
  { key: "identification", header: "Cédula/RUC", required: true, width: 16, note: "10 dígitos (cédula) o 13 (RUC), sin guiones." },
  { key: "email", header: "Correo", required: true, width: 28, note: "Correo del cliente." },
  { key: "phone", header: "Teléfono", required: true, width: 15, note: "Mínimo 7 caracteres." },
  { key: "city", header: "Ciudad", required: true, width: 20, note: "Elige de la lista." },
  { key: "birthDate", header: "Fecha de nacimiento", required: true, width: 18, note: "Formato dd/mm/aaaa." },
  { key: "gender", header: "Género", required: true, width: 12, note: "HOMBRE o MUJER." },
  { key: "maritalStatus", header: "Estado civil", required: true, width: 17, note: MARITAL_STATUSES.join(", ") + "." },
  { key: "address", header: "Dirección", required: false, width: 30, note: "Opcional." },
  { key: "vehicleType", header: "Tipo de vehículo", required: true, width: 24, note: "Elige de la lista (tipos del producto)." },
  { key: "brand", header: "Marca", required: true, width: 16, note: "Elige de la lista." },
  { key: "model", header: "Modelo", required: true, width: 18, note: "La combinación Marca + Modelo debe existir en la hoja Catálogos." },
  { key: "year", header: "Año", required: true, width: 9, note: "Año de fabricación (4 dígitos)." },
  { key: "color", header: "Color", required: true, width: 14, note: "Elige de la lista." },
  { key: "insuredValue", header: "Valor asegurado", required: true, width: 16, note: "Valor en USD, sin símbolo." },
  { key: "vehicleStatus", header: "Estado", required: true, width: 11, note: "NUEVO o USADO." },
  { key: "use", header: "Uso", required: true, width: 15, note: VEHICLE_USES.join(", ") + "." },
  { key: "plate", header: "Placa", required: false, width: 12, note: "Opcional. Sin guion o con guion." },
  { key: "durationYears", header: "Años de vigencia", required: true, width: 16, note: "De 1 a 5." },
  { key: "startDate", header: "Inicio de vigencia", required: true, width: 18, note: "Formato dd/mm/aaaa, desde hoy hasta 90 días." },
];

/** Catálogo del producto, garantizando que pertenece a la aseguradora y al canal del usuario. */
export async function loadBulkCatalog(productId: string, scope: Pick<Scope, "insurerId" | "channelId">): Promise<BulkCatalog> {
  const db = getDbPool();
  const product = await db.query<{ id: string; nombre: string; aseguradora: string; aplica_todas_ciudades: boolean }>(
    `select p.id, p.nombre, a.nombre_comercial as aseguradora, p.aplica_todas_ciudades
     from producto p join aseguradora a on a.id = p.aseguradora_id
     where p.id = $1 and p.activo and p.aseguradora_id = $2 and p.canal_id = $3`,
    [productId, scope.insurerId, scope.channelId],
  );
  if (product.rowCount !== 1) throw new QuoteConfigurationError("El producto no está disponible para tu canal.");
  const p = product.rows[0];
  const [coverages, cities, types, models, colors] = await Promise.all([
    db.query<{ id: string; name: string }>(
      `select pc.id, cb.nombre as name from producto_cobertura pc join cobertura_base cb on cb.id = pc.cobertura_base_id
       where pc.producto_id = $1 and pc.activo and cb.activo order by cb.nombre`, [productId]),
    p.aplica_todas_ciudades
      ? db.query<{ id: string; name: string }>(`select id, nombre as name from ciudad order by nombre`)
      : db.query<{ id: string; name: string }>(
          `select c.id, c.nombre as name from producto_ciudad pc join ciudad c on c.id = pc.ciudad_id where pc.producto_id = $1 order by c.nombre`, [productId]),
    db.query<{ id: string; name: string }>(`select id, descripcion as name from tipo_vehiculo where producto_id = $1 order by descripcion`, [productId]),
    db.query<{ brand: string; model: string }>(`select marca as brand, modelo as model from riesgo_modelo where producto_id = $1 order by marca, modelo`, [productId]),
    db.query<{ color: string }>(`select color from riesgo_color where producto_id = $1 order by color`, [productId]),
  ]);
  return {
    product: { id: p.id, name: p.nombre, insurerName: p.aseguradora },
    coverages: coverages.rows,
    cities: cities.rows,
    vehicleTypes: types.rows,
    models: models.rows,
    colors: colors.rows.map((r) => r.color),
  };
}

// ── Plantilla ────────────────────────────────────────────────────────────────

const NAVY = "FF173250";
const TEAL = "FF02C7B3";

export async function buildBulkTemplate(catalog: BulkCatalog) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kuantix";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Órdenes", { views: [{ state: "frozen", ySplit: 1 }] });
  const info = wb.addWorksheet("Instrucciones");
  const lists = wb.addWorksheet("Catálogos");

  // Catálogos: una columna por lista, referenciadas por las validaciones.
  const brands = [...new Set(catalog.models.map((m) => m.brand))];
  const modelNames = [...new Set(catalog.models.map((m) => m.model))];
  const catalogCols: [string, string[]][] = [
    ["Ciudades", catalog.cities.map((c) => c.name)],
    ["Tipos de vehículo", catalog.vehicleTypes.map((t) => t.name)],
    ["Marcas", brands],
    ["Modelos", modelNames],
    ["Colores", catalog.colors],
    ["Marca + Modelo habilitados", catalog.models.map((m) => `${m.brand} - ${m.model}`)],
  ];
  catalogCols.forEach(([title, values], i) => {
    const col = lists.getColumn(i + 1);
    col.width = Math.max(18, title.length + 4);
    lists.getCell(1, i + 1).value = title;
    lists.getCell(1, i + 1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    lists.getCell(1, i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    values.forEach((v, r) => { lists.getCell(r + 2, i + 1).value = v; });
  });
  const listRef = (colIndex: number, count: number) => {
    const letter = lists.getColumn(colIndex).letter;
    return `'Catálogos'!$${letter}$2:$${letter}$${Math.max(2, count + 1)}`;
  };

  // Hoja principal.
  sheet.columns = BULK_COLUMNS.map((c) => ({ header: c.header + (c.required ? " *" : ""), key: c.key, width: c.width }));
  const header = sheet.getRow(1);
  header.height = 30;
  header.eachCell((cell, i) => {
    const required = BULK_COLUMNS[i - 1].required;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: required ? NAVY : "FF5B6B7F" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: TEAL } } };
    cell.note = BULK_COLUMNS[i - 1].note;
  });

  const { min } = startDateRange();
  const sample = catalog.models[0];
  sheet.addRow({
    name: "EJEMPLO PÉREZ JUAN CARLOS (borra esta fila)",
    identification: "1700000000",
    email: "cliente@correo.com",
    phone: "0991234567",
    city: catalog.cities[0]?.name ?? "",
    birthDate: new Date("1985-06-15T12:00:00"),
    gender: "HOMBRE",
    maritalStatus: "CASADO",
    address: "Av. Amazonas N24-03",
    vehicleType: catalog.vehicleTypes[0]?.name ?? "",
    brand: sample?.brand ?? "",
    model: sample?.model ?? "",
    year: new Date().getFullYear(),
    color: catalog.colors[0] ?? "",
    insuredValue: 25000,
    vehicleStatus: "NUEVO",
    use: "PARTICULAR",
    plate: "PBA1234",
    durationYears: 4,
    startDate: new Date(`${min}T12:00:00`),
  });
  sheet.getRow(2).font = { italic: true, color: { argb: "FF5B6B7F" } };

  const lastRow = BULK_MAX_ROWS + 1;
  const colOf = (key: keyof BulkRow) => sheet.getColumn(key).letter;
  const listValidation = (key: keyof BulkRow, formula: string, title: string) => {
    for (let r = 2; r <= lastRow; r++) {
      sheet.getCell(`${colOf(key)}${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [formula], showErrorMessage: true,
        errorStyle: "warning", errorTitle: title, error: "Elige un valor de la lista.",
      };
    }
  };
  listValidation("city", listRef(1, catalog.cities.length), "Ciudad");
  listValidation("vehicleType", listRef(2, catalog.vehicleTypes.length), "Tipo de vehículo");
  listValidation("brand", listRef(3, brands.length), "Marca");
  listValidation("model", listRef(4, modelNames.length), "Modelo");
  listValidation("color", listRef(5, catalog.colors.length), "Color");
  listValidation("gender", `"HOMBRE,MUJER"`, "Género");
  listValidation("maritalStatus", `"${MARITAL_STATUSES.join(",")}"`, "Estado civil");
  listValidation("vehicleStatus", `"${VEHICLE_STATUSES.join(",")}"`, "Estado");
  listValidation("use", `"${VEHICLE_USES.join(",")}"`, "Uso");
  listValidation("durationYears", `"1,2,3,4,5"`, "Años de vigencia");
  for (let r = 2; r <= lastRow; r++) {
    for (const key of ["birthDate", "startDate"] as const) sheet.getCell(`${colOf(key)}${r}`).numFmt = "dd/mm/yyyy";
    sheet.getCell(`${colOf("identification")}${r}`).numFmt = "@";
    sheet.getCell(`${colOf("phone")}${r}`).numFmt = "@";
    sheet.getCell(`${colOf("insuredValue")}${r}`).numFmt = "#,##0.00";
  }

  // Instrucciones.
  info.getColumn(1).width = 26;
  info.getColumn(2).width = 90;
  const title = info.getCell("A1");
  title.value = "Plantilla de carga masiva de Órdenes de Emisión";
  title.font = { bold: true, size: 14, color: { argb: NAVY } };
  const meta: [string, string][] = [
    ["Producto", catalog.product.name],
    ["Aseguradora", catalog.product.insurerName],
    ["Coberturas", "Se aplican todas las coberturas activas del producto."],
    ["Máximo de filas", `${BULK_MAX_ROWS} por archivo.`],
    ["Guardado", "Todo o nada: si alguna fila tiene error no se guarda ninguna hasta corregirla o eliminarla."],
    ["Clientes existentes", "Si la cédula/RUC o el correo ya existe, se actualizan los datos del cliente con los del archivo."],
  ];
  meta.forEach(([k, v], i) => {
    info.getCell(i + 3, 1).value = k;
    info.getCell(i + 3, 1).font = { bold: true };
    info.getCell(i + 3, 2).value = v;
  });
  const start = meta.length + 5;
  info.getCell(start, 1).value = "Columna";
  info.getCell(start, 2).value = "Cómo llenarla";
  [1, 2].forEach((c) => {
    const cell = info.getCell(start, c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  });
  BULK_COLUMNS.forEach((c, i) => {
    info.getCell(start + 1 + i, 1).value = c.header + (c.required ? " *" : "");
    info.getCell(start + 1 + i, 2).value = c.note;
  });
  info.getCell(start + BULK_COLUMNS.length + 2, 1).value = "* Obligatorio. La fila de ejemplo (en cursiva) debe borrarse antes de subir el archivo.";
  info.getCell(start + BULK_COLUMNS.length + 2, 1).font = { italic: true, color: { argb: "FF5B6B7F" } };

  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── Lectura y validación ─────────────────────────────────────────────────────

export const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\*/g, "").trim().toLowerCase();

export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text);
    if ("richText" in value) return value.richText.map((t) => t.text).join("");
    if ("hyperlink" in value) return String((value as { text?: string }).text ?? "");
  }
  return String(value).trim();
}

/** Acepta `aaaa-mm-dd`, `dd/mm/aaaa` o `dd-mm-aaaa`; devuelve `aaaa-mm-dd` o el texto original si no reconoce el formato. */
function toIsoDate(v: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : v;
}

export function restoreLeadingZero(v: string, lengths: number[]) {
  const digits = v.replace(/\.0+$/, "");
  return /^\d+$/.test(digits) && lengths.includes(digits.length) ? `0${digits}` : digits;
}

/** Lee la hoja "Órdenes" mapeando las columnas por su encabezado. */
export async function parseBulkWorkbook(buffer: ArrayBuffer): Promise<{ rows: BulkRowResult[]; error?: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { rows: [], error: "No pudimos leer el archivo. Usa la plantilla en formato .xlsx." };
  }
  const sheet = wb.getWorksheet("Órdenes") ?? wb.worksheets[0];
  if (!sheet) return { rows: [], error: "El archivo no tiene hojas." };

  const headerMap = new Map<number, keyof BulkRow>();
  sheet.getRow(1).eachCell((cell, col) => {
    const found = BULK_COLUMNS.find((c) => norm(c.header) === norm(cellText(cell.value)));
    if (found) headerMap.set(col, found.key);
  });
  const missing = BULK_COLUMNS.filter((c) => c.required && ![...headerMap.values()].includes(c.key));
  if (missing.length) return { rows: [], error: `Faltan columnas de la plantilla: ${missing.map((c) => c.header).join(", ")}.` };

  const rows: BulkRowResult[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const data = Object.fromEntries(BULK_COLUMNS.map((c) => [c.key, ""])) as Record<keyof BulkRow, string>;
    headerMap.forEach((key, col) => { data[key] = cellText(row.getCell(col).value); });
    if (Object.values(data).every((v) => !v)) return; // fila vacía
    if (/^ejemplo\b/i.test(data.name)) return; // fila de ejemplo de la plantilla
    data.birthDate = toIsoDate(data.birthDate);
    data.startDate = toIsoDate(data.startDate);
    // Excel guarda cédulas y teléfonos numéricos sin el 0 inicial: se restituye.
    data.identification = restoreLeadingZero(data.identification, [9, 12]);
    data.phone = restoreLeadingZero(data.phone, [9]);
    rows.push({ row: rowNumber, data, errors: [] });
  });
  if (rows.length > BULK_MAX_ROWS) return { rows: [], error: `El archivo tiene ${rows.length} filas; el máximo es ${BULK_MAX_ROWS}.` };
  return { rows };
}

export type ResolvedRow = BulkRow & { cityId: string; vehicleTypeId: string };

/** Valida forma y catálogos del producto; devuelve los errores por fila y las filas resueltas (ids de ciudad/tipo). */
export function validateBulkRows(rows: BulkRowResult[], catalog: BulkCatalog) {
  const { min, max } = startDateRange();
  const findBy = <T extends { name: string }>(list: T[], v: string) => list.find((x) => norm(x.name) === norm(v));
  const plates = new Map<string, number>();
  for (const r of rows) {
    const p = r.data.plate.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (p) plates.set(p, (plates.get(p) ?? 0) + 1);
  }
  const resolved = new Map<number, ResolvedRow>();
  const results = rows.map((r) => {
    const errors: string[] = [];
    const parsed = bulkRowSchema.safeParse({ ...r.data, address: r.data.address || undefined, plate: r.data.plate || undefined });
    if (!parsed.success) for (const issue of parsed.error.issues) errors.push(issue.message);
    const city = findBy(catalog.cities, r.data.city);
    if (r.data.city && !city) errors.push(`Ciudad "${r.data.city}" no habilitada para el producto.`);
    const type = findBy(catalog.vehicleTypes, r.data.vehicleType);
    if (r.data.vehicleType && !type) errors.push(`Tipo de vehículo "${r.data.vehicleType}" no existe en el producto.`);
    const model = catalog.models.find((m) => norm(m.brand) === norm(r.data.brand) && norm(m.model) === norm(r.data.model));
    if (r.data.brand && r.data.model && !model) errors.push(`${r.data.brand} ${r.data.model} no está habilitado en el producto.`);
    const color = catalog.colors.find((c) => norm(c) === norm(r.data.color));
    if (r.data.color && !color) errors.push(`Color "${r.data.color}" no habilitado en el producto.`);
    if (parsed.success && (parsed.data.startDate < min || parsed.data.startDate > max)) errors.push("Inicio de vigencia: entre hoy y los próximos 90 días.");
    const plate = r.data.plate.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (plate && (plates.get(plate) ?? 0) > 1) errors.push(`Placa ${plate} repetida en el archivo.`);
    if (!errors.length && parsed.success && city && type && model && color) {
      resolved.set(r.row, { ...parsed.data, brand: model.brand, model: model.model, color, plate: plate || undefined, cityId: city.id, vehicleTypeId: type.id });
    }
    return { ...r, errors };
  });
  return { results, resolved };
}

// ── Guardado (todo o nada) ───────────────────────────────────────────────────

async function upsertClient(conn: PoolClient, r: ResolvedRow, scope: Scope) {
  const found = await conn.query<{ id: string }>(
    `select id from cliente where identificacion = $1 or lower(email) = lower($2)`,
    [r.identification, r.email],
  );
  const ids = [...new Set(found.rows.map((x) => x.id))];
  if (ids.length > 1) throw new QuoteConfigurationError("La cédula/RUC y el correo pertenecen a clientes distintos.");
  const values = [r.name, r.identification, r.email, r.phone, r.cityId, r.address || null, r.birthDate, r.gender, r.maritalStatus];
  let clientId: string;
  if (ids.length === 1) {
    clientId = ids[0];
    await conn.query(
      `update cliente set nombre_razon_social=$1, identificacion=$2, email=$3, telefono=$4, ciudad_id=$5,
         direccion=coalesce($6, direccion), fecha_nacimiento=$7, genero=$8, estado_civil=$9
       where id=$10`,
      [...values, clientId],
    );
  } else {
    const inserted = await conn.query<{ id: string }>(
      `insert into cliente (tipo_cliente, nombre_razon_social, identificacion, email, password_hash, telefono, ciudad_id,
         direccion, fecha_nacimiento, genero, estado_civil, activo, estado_registro)
       values ('INDIVIDUAL', $1, $2, $3, null, $4, $5, $6, $7, $8, $9, true, 'SIN_ACCESO') returning id`,
      values,
    );
    clientId = inserted.rows[0].id;
  }
  await conn.query(
    `insert into canal_cliente (canal_id, cliente_id, creado_por_usuario_id) values ($1, $2, $3)
     on conflict (canal_id, cliente_id) do nothing`,
    [scope.channelId, clientId, scope.userId],
  );
  return clientId;
}

function friendly(error: unknown) {
  if (error instanceof QuoteConfigurationError) return error.message;
  const code = (error as { code?: string })?.code;
  if (code === "23505") return "Ya existe un registro con esa cédula/RUC, correo o placa.";
  console.error("Error en carga masiva", error);
  return "No pudimos calcular esta Orden de Emisión.";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Verifica que el dominio de cada correo reciba correos (registro MX). Devuelve errores por fila. */
export async function verifyBulkEmails(rows: { row: number; email: string }[]) {
  const cache = new Map<string, boolean>();
  const errors = new Map<number, string>();
  for (const r of rows) {
    if (!(await verifyEmailDomain(r.email, cache))) errors.set(r.row, `El dominio del correo ${r.email} no recibe correos.`);
  }
  return errors;
}

export type BulkSaveResult = { saved: number; errors: Map<number, string>; alreadySent: string[] };

/**
 * Crea todas las Órdenes de Emisión y envía por correo su certificado, todo en
 * una sola transacción (regla 17 del ER):
 * 1. Crea las órdenes (cada fila en un SAVEPOINT para reportar todos los errores).
 * 2. Genera y sube todos los PDF.
 * 3. Envía los correos en secuencia con reintentos.
 * Si algo falla —o es `dryRun`— se revierte todo y se borran los PDF; si el fallo
 * ocurre en el envío, se informa a qué clientes ya se les envió.
 */
export async function saveBulkOrders(
  rows: ResolvedRow[],
  rowNumbers: number[],
  input: { productId: string; coverageIds: string[]; scope: Scope; dryRun?: boolean },
): Promise<BulkSaveResult> {
  const conn = await getDbPool().connect();
  const errors = new Map<number, string>();
  const quoteIds: string[] = [];
  const uploaded: string[] = [];
  const alreadySent: string[] = [];
  let committed = false;
  try {
    await conn.query("begin");
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      await conn.query("savepoint fila");
      try {
        const clientId = await upsertClient(conn, r, input.scope);
        quoteIds[i] = await createQuoteWithConnection(conn, {
          clientId,
          productId: input.productId,
          vehicleTypeId: r.vehicleTypeId,
          brand: r.brand,
          model: r.model,
          year: r.year,
          color: r.color,
          insuredValue: r.insuredValue,
          vehicleStatus: r.vehicleStatus,
          use: r.use,
          plate: r.plate,
          durationYears: r.durationYears,
          coverageIds: input.coverageIds,
          coverageStartDate: r.startDate,
          assistedBy: { userId: input.scope.userId, insurerId: input.scope.insurerId, channelId: input.scope.channelId },
        });
        await conn.query("release savepoint fila");
      } catch (error) {
        await conn.query("rollback to savepoint fila");
        errors.set(rowNumbers[i], friendly(error));
      }
    }
    if (errors.size || input.dryRun) return { saved: 0, errors, alreadySent };

    // 2. Certificados (PDF + Storage) de todas las órdenes antes de enviar nada.
    const certs: PreparedCertificate[] = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        const cert = await prepareCertificate(conn, quoteIds[i]);
        uploaded.push(cert.path);
        certs.push(cert);
      } catch (error) {
        errors.set(rowNumbers[i], error instanceof CertificateDeliveryError ? error.message : "No pudimos generar el certificado.");
        return { saved: 0, errors, alreadySent };
      }
    }

    // 3. Envío por correo, en secuencia y con reintentos.
    for (let i = 0; i < certs.length; i++) {
      const destination = rows[i].email;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await deliverCertificate(conn, certs[i], { channel: "CORREO", destination, userId: input.scope.userId });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          await sleep(1500 * (attempt + 1));
        }
      }
      if (lastError) {
        errors.set(rowNumbers[i], lastError instanceof CertificateDeliveryError ? lastError.message : `No pudimos enviar el correo a ${destination}.`);
        return { saved: 0, errors, alreadySent };
      }
      alreadySent.push(`${rows[i].name} (${destination})`);
      if (i < certs.length - 1) await sleep(800);
    }

    await conn.query("commit");
    committed = true;
    return { saved: rows.length, errors, alreadySent: [] };
  } finally {
    if (!committed) {
      await conn.query("rollback").catch(() => {});
      await removeCertificateFiles(uploaded);
    }
    conn.release();
  }
}
