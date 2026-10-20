import "server-only";

import { resolveMx } from "node:dns/promises";
import type { PoolClient } from "pg";
import type { CertificateData } from "@/lib/certificates/data";
import { createMailTransport, getMailConfig } from "@/lib/mail/smtp";

export class CertificateDeliveryError extends Error {}

export type DeliveryChannel = "CORREO" | "WHATSAPP";

const WHATSAPP_MIN_GAP_MS = 7_000; // WasenderAPI con Account Protection: 1 mensaje / 5 s; dejamos margen.
const WHATSAPP_MAX_WAIT_MS = 20_000;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n);
const firstName = (name: string) => name.split(/\s+/).find(Boolean) ?? name;

// ── Verificaciones previas ───────────────────────────────────────────────────

/** Normaliza teléfonos de Ecuador a E.164 (`0991234567` → `+593991234567`). Devuelve null si no es válido. */
export function normalizeEcuadorPhone(raw: string): string | null {
  const v = raw.replace(/[^\d+]/g, "");
  if (/^\+\d{10,15}$/.test(v)) return v;
  const d = v.replace(/\D/g, "");
  if (/^0\d{9}$/.test(d)) return `+593${d.slice(1)}`;
  if (/^593\d{9}$/.test(d)) return `+${d}`;
  if (/^9\d{8}$/.test(d)) return `+593${d}`;
  return null;
}

/** El dominio del correo tiene registros MX (puede recibir correo). Errores de red se consideran válidos. */
export async function verifyEmailDomain(email: string, cache = new Map<string, boolean>()) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  if (cache.has(domain)) return cache.get(domain)!;
  let ok = true;
  try {
    ok = (await resolveMx(domain)).length > 0;
  } catch (error) {
    const code = (error as { code?: string }).code;
    ok = !(code === "ENOTFOUND" || code === "ENODATA" || code === "ENOTIMP");
  }
  cache.set(domain, ok);
  return ok;
}

// ── Correo ───────────────────────────────────────────────────────────────────

export async function sendCertificateEmail(to: string, data: CertificateData, pdf: Uint8Array) {
  const config = getMailConfig();
  const fileName = `Certificado-${data.number}.pdf`;
  const vehicle = `${data.vehicle.brand} ${data.vehicle.model}${data.vehicle.plate ? ` (${data.vehicle.plate.toUpperCase()})` : ""}`;
  try {
    const info = await createMailTransport(config).sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject: `Tu certificado de cobertura ${data.number} · ${data.insurer}`,
      text: [
        `Hola ${firstName(data.client.name)},`,
        "",
        `Adjuntamos tu certificado de cobertura ${data.number} del producto ${data.product} de ${data.insurer} para tu vehículo ${vehicle}.`,
        `Cuota mensual: ${money(data.monthlyPayment)}.`,
        "",
        "Este es un correo automático, por favor no respondas a este mensaje. Ante cualquier consulta comunícate con tu asesor.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#173250">
          <div style="border-bottom:3px solid #02c7b3;padding:20px 0 14px">
            <p style="margin:0;font-size:12px;letter-spacing:.16em;color:#00897b;font-weight:bold">KUANTIQ · CERTIFICADO DE COBERTURA</p>
          </div>
          <h1 style="font-size:22px;margin:22px 0 8px">Hola ${escape(firstName(data.client.name))},</h1>
          <p style="font-size:15px;line-height:1.6;color:#5b6b7f;margin:0 0 16px">
            Adjuntamos tu certificado de cobertura <strong style="color:#173250">${escape(data.number)}</strong>
            del producto <strong style="color:#173250">${escape(data.product)}</strong> de ${escape(data.insurer)}.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;background:#f5f8fb;border-radius:12px">
            <tr><td style="padding:10px 14px;color:#74839a">Vehículo</td><td style="padding:10px 14px;text-align:right;font-weight:bold">${escape(vehicle)}</td></tr>
            <tr><td style="padding:10px 14px;color:#74839a">Vigencia</td><td style="padding:10px 14px;text-align:right;font-weight:bold">${escape(fmtDay(data.term.start))} – ${escape(fmtDay(data.term.end))}</td></tr>
            <tr><td style="padding:10px 14px;color:#74839a">Cuota mensual</td><td style="padding:10px 14px;text-align:right;font-weight:bold">${escape(money(data.monthlyPayment))}</td></tr>
          </table>
          <p style="font-size:12px;line-height:1.6;color:#74839a;margin:22px 0 0">
            Este es un correo automático, por favor <strong>no respondas</strong> a este mensaje. Ante cualquier consulta comunícate con tu asesor.
          </p>
        </div>`,
      attachments: [{ filename: fileName, content: Buffer.from(pdf), contentType: "application/pdf" }],
    });
    if (info.rejected?.length) throw new CertificateDeliveryError(`El servidor de correo rechazó ${to}.`);
    return { messageId: info.messageId ?? null };
  } catch (error) {
    if (error instanceof CertificateDeliveryError) throw error;
    console.error("Error al enviar certificado por correo", error);
    throw new CertificateDeliveryError(`No pudimos enviar el correo a ${to}.`);
  }
}

function fmtDay(iso: string | null) {
  return iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
}

// ── WhatsApp (WasenderAPI) ───────────────────────────────────────────────────

function wasender() {
  const token = process.env.WASENDER_API_TOKEN;
  if (!token) throw new CertificateDeliveryError("El envío por WhatsApp no está configurado (falta WASENDER_API_TOKEN).");
  const base = (process.env.WASENDER_API_URL || "https://www.wasenderapi.com/api").replace(/\/$/, "");
  return { base, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" } };
}

async function readJson(res: Response) {
  try {
    return (await res.json()) as { success?: boolean; message?: string; error?: string; retry_after?: number; data?: { exists?: boolean; msgId?: number | string } };
  } catch {
    return {};
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Espera lo necesario para mantener al menos 7 s entre mensajes de WhatsApp en
 * toda la plataforma. El candado se libera al terminar la transacción del llamador.
 */
async function throttleWhatsApp(conn: PoolClient) {
  await conn.query("select pg_advisory_xact_lock(hashtext('wasender-send'))");
  // Cuenta envíos originales y reenvíos (registrados en auditoría).
  const { rows } = await conn.query<{ ms: number | null }>(
    `select (extract(epoch from (now() - greatest(
        (select max(enviado_en) from certificado_cobertura where canal_envio = 'WHATSAPP'),
        (select max(creado_en) from auditoria where entidad = 'CERTIFICADO_COBERTURA' and datos_nuevos->>'canal' = 'WHATSAPP')
      ))) * 1000)::int as ms`,
  );
  const elapsed = rows[0]?.ms;
  if (elapsed !== null && elapsed !== undefined && elapsed < WHATSAPP_MIN_GAP_MS) await sleep(WHATSAPP_MIN_GAP_MS - elapsed);
}

export async function sendCertificateWhatsApp(conn: PoolClient, phone: string, data: CertificateData, documentUrl: string) {
  const to = normalizeEcuadorPhone(phone);
  if (!to) throw new CertificateDeliveryError(`El teléfono ${phone} no es un número de WhatsApp válido.`);
  const api = wasender();

  const check = await fetch(`${api.base}/on-whatsapp/${encodeURIComponent(to)}`, { headers: api.headers }).catch(() => null);
  const checked = check ? await readJson(check) : null;
  if (check?.ok && checked?.success && checked.data?.exists === false) {
    throw new CertificateDeliveryError(`El número ${to} no tiene WhatsApp.`);
  }

  await throttleWhatsApp(conn);
  const body = JSON.stringify({
    to,
    text: [
      `Hola ${firstName(data.client.name)}, te enviamos tu *certificado de cobertura ${data.number}* del producto ${data.product} de ${data.insurer}.`,
      "",
      "_Este es un mensaje automático, por favor no respondas a este número. Ante cualquier consulta comunícate con tu asesor._",
    ].join("\n"),
    documentUrl,
    fileName: `Certificado-${data.number}.pdf`,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${api.base}/send-message`, { method: "POST", headers: api.headers, body }).catch(() => null);
    if (!res) throw new CertificateDeliveryError("No pudimos conectar con el servicio de WhatsApp.");
    const json = await readJson(res);
    if (res.ok && json.success !== false) return { messageId: json.data?.msgId != null ? String(json.data.msgId) : null, to };
    const retryAfter = Number(json.retry_after ?? res.headers.get("retry-after") ?? 0) * 1000;
    if ((res.status === 429 || retryAfter > 0) && attempt === 0 && retryAfter <= WHATSAPP_MAX_WAIT_MS) {
      await sleep(Math.max(retryAfter, WHATSAPP_MIN_GAP_MS));
      continue;
    }
    console.error("WasenderAPI rechazó el envío", res.status, json);
    throw new CertificateDeliveryError(
      res.status === 429 || retryAfter > 0
        ? `WhatsApp está limitando los envíos; intenta de nuevo en ${Math.ceil(retryAfter / 1000) || 60} s o envía por correo.`
        : `WhatsApp no aceptó el envío${json.message || json.error ? `: ${json.message ?? json.error}` : "."}`,
    );
  }
  throw new CertificateDeliveryError("No pudimos enviar el mensaje de WhatsApp.");
}
