import { requireChannelUser } from "@/lib/auth/session";
import { buildCancellationTemplate, loadChannelProducts } from "@/lib/channel/bulk-cancellations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Descarga la plantilla Excel de cancelación de pólizas del canal. */
export async function GET() {
  const session = await requireChannelUser();
  const products = await loadChannelProducts({ insurerId: session.insurerId!, channelId: session.channelId! });
  const file = await buildCancellationTemplate(products);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla-cancelaciones.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
