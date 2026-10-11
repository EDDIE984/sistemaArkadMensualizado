import { requireChannelUser } from "@/lib/auth/session";
import { certificateSignedUrl } from "@/lib/certificates/issue";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Abre el PDF del certificado de una Orden de Emisión del canal (URL firmada de corta duración). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireChannelUser();
  const { id } = await params;
  const db = createAdminClient();
  const { data: quote } = await db.from("cotizacion").select("id").eq("id", id).eq("canal_id", session.channelId!).maybeSingle();
  if (!quote) return new Response("No encontrado.", { status: 404 });
  const { data: cert } = await db.from("certificado_cobertura").select("storage_path").eq("cotizacion_id", id).maybeSingle();
  if (!cert) return new Response("La Orden de Emisión no tiene certificado.", { status: 404 });
  const url = await certificateSignedUrl(cert.storage_path);
  if (!url) return new Response("No pudimos abrir el certificado.", { status: 500 });
  return Response.redirect(url, 302);
}
