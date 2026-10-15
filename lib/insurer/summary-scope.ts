import "server-only";

import type { SummaryScope } from "@/lib/channel/summary";
import { createAdminClient } from "@/lib/supabase/admin";

export type InsurerSummarySearch = { canal?: string | string[]; productos?: string | string[] };
export type ScopeChannel = { id: string; nombre: string };
export type ScopeProduct = { id: string; nombre: string; canal_id: string; canal: string | null };

const single = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
const many = (value: string | string[] | undefined) => [...new Set((Array.isArray(value) ? value : value ? [value] : []).filter(Boolean))].slice(0, 200);

/**
 * Lista únicamente datos activos de la aseguradora autenticada y descarta todo
 * id ajeno o incompatible con el canal. Se comparte entre página y Excel para
 * que la URL nunca amplíe el tenant al que se accede.
 */
export async function resolveInsurerSummaryScope(insurerId: string, search: InsurerSummarySearch) {
  const db = createAdminClient();
  const [{ data: channelRows = [] }, { data: productRows = [] }] = await Promise.all([
    db.from("canal").select("id,nombre").eq("aseguradora_id", insurerId).eq("activo", true).order("nombre"),
    db.from("producto").select("id,nombre,canal_id,canal(nombre)").eq("aseguradora_id", insurerId).eq("activo", true).order("nombre"),
  ]);
  const channels = (channelRows ?? []) as ScopeChannel[];
  const selectedChannelId = channels.some((channel) => channel.id === single(search.canal)) ? single(search.canal)! : null;
  const products = (productRows ?? []).map((product) => ({
    id: product.id,
    nombre: product.nombre,
    canal_id: product.canal_id,
    canal: (Array.isArray(product.canal) ? product.canal[0] : product.canal)?.nombre ?? null,
  })) as ScopeProduct[];
  const eligibleProducts = products.filter((product) => !selectedChannelId || product.canal_id === selectedChannelId);
  const requestedProducts = new Set(many(search.productos));
  const selectedProductIds = eligibleProducts.filter((product) => requestedProducts.has(product.id)).map((product) => product.id);
  const scope: SummaryScope = { insurerId, channelId: selectedChannelId, productIds: selectedProductIds };
  return { scope, channels, products, selectedChannelId, selectedProductIds };
}
