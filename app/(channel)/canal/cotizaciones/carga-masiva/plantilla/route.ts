import { z } from "zod";
import { requireChannelUser } from "@/lib/auth/session";
import { buildBulkTemplate, loadBulkCatalog } from "@/lib/channel/bulk-orders";
import { QuoteConfigurationError } from "@/lib/quotes/create-quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Descarga la plantilla Excel de carga masiva para un producto del canal. */
export async function GET(request: Request) {
  const session = await requireChannelUser();
  const productId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("producto"));
  if (!productId.success) return new Response("Producto inválido.", { status: 400 });
  try {
    const catalog = await loadBulkCatalog(productId.data, { insurerId: session.insurerId!, channelId: session.channelId! });
    const file = await buildBulkTemplate(catalog);
    const name = `plantilla-ordenes-${catalog.product.name.normalize("NFD").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`;
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof QuoteConfigurationError) return new Response(error.message, { status: 404 });
    throw error;
  }
}
