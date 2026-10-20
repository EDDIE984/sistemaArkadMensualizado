import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { CertificateData } from "@/lib/certificates/data";

const NAVY = rgb(23 / 255, 50 / 255, 80 / 255);
const TEAL = rgb(2 / 255, 199 / 255, 179 / 255);
const TEAL_TEXT = rgb(0, 137 / 255, 123 / 255);
const MUTED = rgb(91 / 255, 107 / 255, 127 / 255);
const SUBTLE = rgb(116 / 255, 131 / 255, 154 / 255);
const LINE = rgb(227 / 255, 233 / 255, 240 / 255);
const SURFACE = rgb(245 / 255, 248 / 255, 251 / 255);
const TEAL_SOFT = rgb(230 / 255, 249 / 255, 247 / 255);

const W = 595.28;
const H = 841.89;
const M = 42;

const money = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n);
const day = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const today = (d: Date) => new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
const title = (v: string) => v.toLowerCase().replace(/(^|[\s_])\p{L}/gu, (m) => m.toUpperCase()).replace(/_/g, " ");

let logoBytes: Promise<Buffer> | null = null;

/** Genera el PDF del certificado. Con `preview` se marca como vista previa (aún sin número). */
export async function renderCertificatePdf(data: CertificateData, opts: { preview?: boolean } = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Certificado de cobertura ${data.number}`);
  doc.setAuthor("Kuantiq");
  doc.setSubject(`${data.product} · ${data.insurer}`);
  const page = doc.addPage([W, H]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  logoBytes ??= readFile(path.join(process.cwd(), "public/images/logo-kuantiq.png"));
  const logo = await doc.embedPng(await logoBytes);

  const text = (p: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = NAVY) => p.drawText(s, { x, y, size, font, color });
  const fit = (s: string, font: PDFFont, size: number, max: number) => {
    if (font.widthOfTextAtSize(s, size) <= max) return s;
    let out = s;
    while (out.length > 1 && font.widthOfTextAtSize(out + "…", size) > max) out = out.slice(0, -1);
    return out + "…";
  };

  // ── Encabezado ──
  const logoH = 40;
  page.drawImage(logo, { x: M, y: H - M - logoH, width: (logo.width / logo.height) * logoH, height: logoH });
  const rightX = W - M;
  const label = "CERTIFICADO DE COBERTURA";
  text(page, label, rightX - bold.widthOfTextAtSize(label, 8), H - M - 8, 8, bold, TEAL_TEXT);
  const num = opts.preview ? "Nº se asigna al enviar" : `Nº ${data.number}`;
  text(page, num, rightX - bold.widthOfTextAtSize(num, 15), H - M - 27, 15, bold);
  const issued = `Emitido el ${today(data.issuedAt)}`;
  text(page, issued, rightX - regular.widthOfTextAtSize(issued, 9), H - M - 41, 9, regular, MUTED);
  let y = H - M - logoH - 18;
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 2.5, color: TEAL });
  y -= 26;

  text(page, "Certificamos que el vehículo descrito a continuación cuenta con las coberturas indicadas,", M, y, 9.5, regular, MUTED);
  y -= 13;
  text(page, `contratadas con ${data.insurer} mediante el producto ${data.product}.`, M, y, 9.5, regular, MUTED);
  y -= 22;

  // ── Bloques de datos (dos columnas) ──
  const colW = (W - 2 * M - 14) / 2;
  const section = (heading: string, x: number, top: number, rows: [string, string][]) => {
    const h = 30 + rows.length * 27;
    page.drawRectangle({ x, y: top - h, width: colW, height: h, color: rgb(1, 1, 1), borderColor: LINE, borderWidth: 1 });
    page.drawRectangle({ x, y: top - 24, width: colW, height: 24, color: SURFACE });
    page.drawRectangle({ x, y: top - 24, width: 3, height: 24, color: TEAL });
    text(page, heading.toUpperCase(), x + 12, top - 16, 8, bold, NAVY);
    rows.forEach(([k, v], i) => {
      const ry = top - 40 - i * 27;
      text(page, k.toUpperCase(), x + 12, ry, 6.5, bold, SUBTLE);
      text(page, fit(v || "—", regular, 9.5, colW - 24), x + 12, ry - 11, 9.5, regular, NAVY);
    });
    return h;
  };
  const left: [string, string][] = [
    ["Asegurado", data.client.name],
    ["Cédula / RUC", data.client.identification],
    ["Correo", data.client.email],
    ["Teléfono", data.client.phone],
    ["Ciudad", data.client.city],
  ];
  const right: [string, string][] = [
    ["Vehículo", `${data.vehicle.brand} ${data.vehicle.model} ${data.vehicle.year}`],
    ["Placa", data.vehicle.plate ? data.vehicle.plate.toUpperCase() : "Sin placa"],
    ["Color", title(data.vehicle.color)],
    ["Uso / Estado", `${title(data.vehicle.use)} · ${title(data.vehicle.status)}`],
    ["Valor asegurado", money(data.vehicle.insuredValue)],
  ];
  const h1 = section("Datos del asegurado", M, y, left);
  section("Datos del vehículo", M + colW + 14, y, right);
  y -= h1 + 14;

  const policy: [string, string][] = [
    ["Aseguradora", data.insurer],
    ["Producto", data.product],
    ["Canal", data.channel ? title(data.channel) : "—"],
  ];
  const term: [string, string][] = [
    ["Inicio de vigencia", day(data.term.start)],
    ["Fin de vigencia", day(data.term.end)],
    ["Plazo", `${data.term.years} ${data.term.years === 1 ? "año" : "años"} · ${data.term.installments} cuotas`],
  ];
  const h2 = section("Producto", M, y, policy);
  section("Vigencia", M + colW + 14, y, term);
  y -= h2 + 14;

  // ── Coberturas ──
  const fullW = W - 2 * M;
  const covH = 30 + Math.max(1, data.coverages.length) * 22 + 6;
  page.drawRectangle({ x: M, y: y - covH, width: fullW, height: covH, color: rgb(1, 1, 1), borderColor: LINE, borderWidth: 1 });
  page.drawRectangle({ x: M, y: y - 24, width: fullW, height: 24, color: SURFACE });
  page.drawRectangle({ x: M, y: y - 24, width: 3, height: 24, color: TEAL });
  text(page, "COBERTURAS", M + 12, y - 16, 8, bold);
  const valueLabel = "VALOR";
  text(page, valueLabel, M + fullW - 12 - bold.widthOfTextAtSize(valueLabel, 7), y - 16, 7, bold, SUBTLE);
  data.coverages.forEach((c, i) => {
    const ry = y - 42 - i * 22;
    if (i > 0) page.drawLine({ start: { x: M + 12, y: ry + 14 }, end: { x: M + fullW - 12, y: ry + 14 }, thickness: 0.6, color: LINE });
    page.drawCircle({ x: M + 16, y: ry + 3, size: 2.2, color: TEAL });
    text(page, fit(c.name, regular, 10, fullW - 160), M + 26, ry, 10, regular);
    const v = c.value === null ? "Incluida" : c.value <= 100 ? `${c.value.toLocaleString("es-EC")} %` : money(c.value);
    text(page, v, M + fullW - 12 - bold.widthOfTextAtSize(v, 10), ry, 10, bold);
  });
  if (!data.coverages.length) text(page, "—", M + 26, y - 42, 10, regular, MUTED);
  y -= covH + 14;

  // ── Resumen de pago ──
  const payH = 64;
  page.drawRectangle({ x: M, y: y - payH, width: fullW, height: payH, color: TEAL_SOFT, borderColor: TEAL, borderWidth: 1 });
  text(page, "CUOTA MENSUAL", M + 16, y - 22, 7.5, bold, TEAL_TEXT);
  text(page, money(data.monthlyPayment), M + 16, y - 46, 22, bold);
  const totalLabel = "TOTAL DE LA VIGENCIA";
  const totalValue = money(data.totalTerm);
  const tx = M + fullW - 16;
  text(page, totalLabel, tx - bold.widthOfTextAtSize(totalLabel, 7.5), y - 22, 7.5, bold, TEAL_TEXT);
  text(page, totalValue, tx - bold.widthOfTextAtSize(totalValue, 15), y - 42, 15, bold);
  const nCuotas = `${data.term.installments} cuotas mensuales`;
  text(page, nCuotas, tx - regular.widthOfTextAtSize(nCuotas, 8.5), y - 55, 8.5, regular, MUTED);

  // ── Pie ──
  const notes = [
    "Documento generado electrónicamente; no requiere firma. La póliza será emitida por la aseguradora conforme a sus",
    "condiciones generales y particulares. Ante cualquier consulta comunícate con tu asesor; este documento se envía desde",
    "una dirección automática, por favor no respondas al mensaje.",
  ];
  notes.forEach((n, i) => text(page, n, M, M + 30 - i * 11, 7.5, regular, SUBTLE));
  page.drawLine({ start: { x: M, y: M + 44 }, end: { x: W - M, y: M + 44 }, thickness: 0.6, color: LINE });
  const brand = "Kuantiq · Tecnología confiable";
  text(page, brand, W - M - bold.widthOfTextAtSize(brand, 7.5), M - 6, 7.5, bold, TEAL_TEXT);
  text(page, opts.preview ? "Vista previa" : `Nº ${data.number}`, M, M - 6, 7.5, regular, SUBTLE);

  if (opts.preview) {
    page.drawText("VISTA PREVIA", { x: 120, y: 300, size: 72, font: bold, color: TEAL, opacity: 0.08, rotate: degrees(35) });
  }
  return doc.save();
}
