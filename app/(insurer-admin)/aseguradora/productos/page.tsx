import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Filter, X } from "lucide-react";
import { AdminPage, AdminPanel, StatusPill } from "@/components/admin/admin-ui";
import { ProductForm } from "@/components/insurer/maintenance-forms";
import { toggleProduct } from "@/app/actions/insurer";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Productos | Kuantix", robots: { index: false, follow: false } };

type SearchParams = { canal?: string | string[]; nuevoCanal?: string | string[] };
const one = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

export default async function Products({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireInsurerAdmin();
  const params = await searchParams;
  const db = createAdminClient();
  const insurerId = session.insurerId!;
  const [{ data: channelRows = [] }, branches] = await Promise.all([
    db.from("canal").select("id,nombre").eq("aseguradora_id", insurerId).eq("activo", true).order("nombre"),
    db.from("aseguradora_ramo").select("id,ramo_base(nombre)").eq("aseguradora_id", insurerId).eq("activo", true),
  ]);
  const channels = channelRows ?? [];
  const selectedChannel = channels.find((channel) => channel.id === one(params.canal));
  const newChannel = channels.find((channel) => channel.id === one(params.nuevoCanal));
  let productsQuery = db
    .from("producto")
    .select("id,nombre,canal_id,aseguradora_ramo_id,aplica_todas_ciudades,activo,comision_canal_pct,canal(nombre),aseguradora_ramo(ramo_base(nombre))")
    .eq("aseguradora_id", insurerId)
    .order("nombre");
  if (selectedChannel) productsQuery = productsQuery.eq("canal_id", selectedChannel.id);
  const products = await productsQuery;
  const branchOptions = (branches.data ?? []).map((branch) => ({ id: branch.id, name: relationName(branch.ramo_base, "nombre") }));
  const defaultChannelId = newChannel?.id ?? selectedChannel?.id;

  return <AdminPage eyebrow="Oferta comercial" title="Productos" description="Crea productos y entra a su configuración de riesgos, tarifas y protección.">
    <div className="mt-7 grid gap-4">
      {newChannel && <p role="status" className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand-text"><CheckCircle2 className="size-4 shrink-0" />Canal {newChannel.nombre} creado. Ahora crea su producto.</p>}

      <form action="/aseguradora/productos" className="glass-panel flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <label className="grid min-w-0 gap-1.5 sm:w-72"><span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">Filtrar por canal</span><select name="canal" defaultValue={selectedChannel?.id ?? ""} className="min-h-11 rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none focus:border-brand/60 [color-scheme:light]"><option value="">Todos los canales</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.nombre}</option>)}</select></label>
        <div className="flex flex-wrap items-center gap-2"><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-ink-strong"><Filter className="size-4" />Aplicar</button>{selectedChannel && <Link href="/aseguradora/productos" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold text-ink-muted hover:text-ink"><X className="size-3.5" />Limpiar</Link>}</div>
      </form>

      <p className="text-xs text-ink-subtle">{selectedChannel ? `${products.data?.length ?? 0} productos de ${selectedChannel.nombre}` : `${products.data?.length ?? 0} productos de todos los canales`}</p>

      <div id="nuevo-producto" className="scroll-mt-24"><AdminPanel title="Nuevo producto" description="Asócialo a un canal y un ramo habilitado" open={Boolean(newChannel) || !products.data?.length}><ProductForm key={defaultChannelId ?? "nuevo"} channels={channels} branches={branchOptions} defaultChannelId={defaultChannelId} /></AdminPanel></div>

      {(products.data ?? []).map((product) => <AdminPanel key={product.id} title={product.nombre} description={`${relationName(product.canal, "nombre")} · ${relationName(product.aseguradora_ramo, "ramo_base", "nombre")}`}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><StatusPill active={product.activo} /><div className="flex gap-2"><form action={toggleProduct}><input type="hidden" name="id" value={product.id} /><input type="hidden" name="active" value={String(!product.activo)} /><button className="min-h-10 rounded-full border border-line px-4 text-xs font-bold hover:bg-ink/5">{product.activo ? "Desactivar" : "Activar"}</button></form><Link href={`/aseguradora/productos/${product.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-xs font-bold text-white">Configurar <ArrowRight className="size-3.5" /></Link></div></div>
        <ProductForm channels={channels} branches={branchOptions} item={product} />
      </AdminPanel>)}

      {!products.data?.length && selectedChannel && <p className="rounded-xl border border-dashed border-line bg-surface-muted px-4 py-6 text-center text-sm text-ink-muted">No hay productos configurados para este canal.</p>}
    </div>
  </AdminPage>;
}

function relationName(value: unknown, key: string, nestedKey?: string) {
  let row = Array.isArray(value) ? value[0] : value;
  if (nestedKey && row && typeof row === "object" && key in row) row = (row as Record<string, unknown>)[key];
  row = Array.isArray(row) ? row[0] : row;
  return row && typeof row === "object" && (nestedKey || key) in row ? String((row as Record<string, unknown>)[nestedKey || key]) : "—";
}
