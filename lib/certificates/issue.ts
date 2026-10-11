import "server-only";

import type { PoolClient } from "pg";
import { loadCertificateData, type CertificateData } from "@/lib/certificates/data";
import { renderCertificatePdf } from "@/lib/certificates/pdf";
import { CertificateDeliveryError, sendCertificateEmail, sendCertificateWhatsApp, type DeliveryChannel } from "@/lib/certificates/send";
import { createAdminClient } from "@/lib/supabase/admin";

export const CERTIFICATE_BUCKET = "certificados";
const SIGNED_URL_SECONDS = 7 * 24 * 3600;

export type PreparedCertificate = { quoteId: string; data: CertificateData; pdf: Uint8Array; path: string };
export type RefreshedCertificate = PreparedCertificate & { previousPdf: Uint8Array | null };

const bucket = () => createAdminClient().storage.from(CERTIFICATE_BUCKET);

/** PDF de vista previa (sin número) de una cotización aún no confirmada. */
export async function renderCertificatePreview(conn: PoolClient, quoteId: string) {
  const data = await loadCertificateData(conn, quoteId, "VISTA-PREVIA");
  return { data, pdf: await renderCertificatePdf(data, { preview: true }) };
}

/** Reserva el número, genera el PDF definitivo y lo sube a Storage (aún sin enviar). */
export async function prepareCertificate(conn: PoolClient, quoteId: string): Promise<PreparedCertificate> {
  const { rows } = await conn.query<{ n: string }>("select nextval('certificado_cobertura_seq')::text as n");
  const year = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric" }).format(new Date());
  const number = `KX-${year}-${rows[0].n.padStart(6, "0")}`;
  const data = await loadCertificateData(conn, quoteId, number);
  const pdf = await renderCertificatePdf(data);
  const path = `${quoteId}/${number}.pdf`;
  const { error } = await bucket().upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) {
    console.error("No se pudo subir el certificado", error.message);
    throw new CertificateDeliveryError("No pudimos guardar el PDF del certificado.");
  }
  return { quoteId, data, pdf, path };
}

/** Regenera el PDF de un certificado existente sin cambiar su número ni crear otra fila. */
export async function refreshCertificate(
  conn: PoolClient,
  certificate: { quoteId: string; number: string; path: string },
): Promise<RefreshedCertificate> {
  const previousPdf = await downloadCertificate(certificate.path).catch(() => null);
  const data = await loadCertificateData(conn, certificate.quoteId, certificate.number);
  const pdf = await renderCertificatePdf(data);
  const { error } = await bucket().upload(certificate.path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) {
    console.error("No se pudo actualizar el certificado", error.message);
    throw new CertificateDeliveryError("No pudimos guardar el PDF actualizado del certificado.");
  }
  return { quoteId: certificate.quoteId, data, pdf, path: certificate.path, previousPdf };
}

/** Envía el certificado y registra el envío. Si falla lanza `CertificateDeliveryError` (el llamador revierte). */
export async function deliverCertificate(
  conn: PoolClient,
  cert: PreparedCertificate,
  input: { channel: DeliveryChannel; destination: string; userId: string },
) {
  let sent: { messageId: string | null; to: string };
  if (input.channel === "CORREO") {
    const r = await sendCertificateEmail(input.destination, cert.data, cert.pdf);
    sent = { messageId: r.messageId, to: input.destination };
  } else {
    const { data, error } = await bucket().createSignedUrl(cert.path, SIGNED_URL_SECONDS);
    if (error || !data) throw new CertificateDeliveryError("No pudimos generar el enlace del PDF para WhatsApp.");
    sent = await sendCertificateWhatsApp(conn, input.destination, cert.data, data.signedUrl);
  }
  await conn.query(
    `insert into certificado_cobertura (cotizacion_id, numero, storage_path, canal_envio, destino, proveedor_mensaje_id, enviado_por_usuario_id)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [cert.quoteId, cert.data.number, cert.path, input.channel, sent.to, sent.messageId, input.userId],
  );
  return sent;
}

/** Envía una versión corregida y actualiza el único registro de certificado de la orden. */
export async function deliverRefreshedCertificate(
  conn: PoolClient,
  cert: PreparedCertificate,
  input: { channel: DeliveryChannel; destination: string; userId: string },
) {
  let sent: { messageId: string | null; to: string };
  if (input.channel === "CORREO") {
    const result = await sendCertificateEmail(input.destination, cert.data, cert.pdf);
    sent = { messageId: result.messageId, to: input.destination };
  } else {
    const { data, error } = await bucket().createSignedUrl(cert.path, SIGNED_URL_SECONDS);
    if (error || !data) throw new CertificateDeliveryError("No pudimos generar el enlace del PDF para WhatsApp.");
    sent = await sendCertificateWhatsApp(conn, input.destination, cert.data, data.signedUrl);
  }
  const updated = await conn.query(
    `update certificado_cobertura
     set storage_path=$2, canal_envio=$3, destino=$4, proveedor_mensaje_id=$5,
         enviado_por_usuario_id=$6, enviado_en=now()
     where cotizacion_id=$1`,
    [cert.quoteId, cert.path, input.channel, sent.to, sent.messageId, input.userId],
  );
  if (updated.rowCount !== 1) throw new CertificateDeliveryError("No encontramos el certificado de la Orden de Emisión.");
  return sent;
}

/** Restaura el PDF previo si no se logra confirmar una corrección. */
export async function restoreCertificateFile(path: string, pdf: Uint8Array) {
  const { error } = await bucket().upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) console.error("No se pudo restaurar el certificado anterior", error.message);
}

/** Borra PDFs subidos cuando la transacción se revierte. */
export async function removeCertificateFiles(paths: string[]) {
  if (!paths.length) return;
  const { error } = await bucket().remove(paths);
  if (error) console.error("No se pudieron borrar certificados", error.message);
}

/** PDF de un certificado ya emitido (para reenviarlo por correo). */
export async function downloadCertificate(path: string) {
  const { data, error } = await bucket().download(path);
  if (error || !data) throw new CertificateDeliveryError("No encontramos el PDF del certificado.");
  return new Uint8Array(await data.arrayBuffer());
}

/** URL firmada para ver un certificado ya emitido. */
export async function certificateSignedUrl(path: string, seconds = 300) {
  const { data, error } = await bucket().createSignedUrl(path, seconds);
  return error ? null : data.signedUrl;
}
