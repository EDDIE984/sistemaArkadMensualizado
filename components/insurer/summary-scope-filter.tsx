"use client";

import Link from "next/link";
import { useState } from "react";
import { Filter, Search, X } from "lucide-react";

type Channel = { id: string; nombre: string };
type Product = { id: string; nombre: string; canal_id: string; canal: string | null };

const control = "min-h-11 min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none focus:border-brand/60 [color-scheme:light]";

/** Filtro cliente mínimo: cambiar de canal descarta productos no aplicables antes de enviar. */
export function SummaryScopeFilter({
  channels,
  products,
  selectedChannelId,
  selectedProductIds,
  preserve,
  basePath = "/aseguradora",
  children,
}: {
  channels: Channel[];
  products: Product[];
  selectedChannelId: string | null;
  selectedProductIds: string[];
  preserve: Record<string, string | string[]>;
  /** Ruta que recibe el formulario (Resumen o Pagos). */
  basePath?: string;
  /** Campos extra del mismo formulario (p. ej. fechas y estado en Pagos). */
  children?: React.ReactNode;
}) {
  const [channelId, setChannelId] = useState(selectedChannelId ?? "");
  const [productIds, setProductIds] = useState<string[]>(selectedProductIds);
  const visibleProducts = products.filter((product) => !channelId || product.canal_id === channelId);
  const selected = new Set(productIds);
  const dirty = Boolean(channelId || productIds.length);

  return <form action={basePath} className={children ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto] xl:items-end" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,18rem)_minmax(15rem,24rem)_auto] lg:items-end"}>
    {Object.entries(preserve).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map((item, index) => <input key={`${key}-${index}-${item}`} type="hidden" name={key} value={item} />))}
    <label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">Canal</span><select name="canal" value={channelId} onChange={(event) => { setChannelId(event.target.value); setProductIds([]); }} className={control}><option value="">Todos los canales</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.nombre}</option>)}</select></label>
    <fieldset className="min-w-0"><legend className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-subtle">Productos</legend><details className="relative"><summary className={`${control} flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden`}><span className="truncate">{productIds.length ? `${productIds.length} seleccionados` : "Todos los productos"}</span><Filter className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" /></summary><div className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-auto rounded-xl border border-line bg-white p-2 shadow-xl">{visibleProducts.map((product) => <label key={product.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-surface-muted"><input type="checkbox" name="productos" value={product.id} checked={selected.has(product.id)} onChange={(event) => setProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} className="size-4 accent-ink" /><span className="min-w-0 truncate">{product.nombre}{!channelId && product.canal && <span className="text-ink-subtle"> · {product.canal}</span>}</span></label>)}{!visibleProducts.length && <p className="p-3 text-sm text-ink-muted">Sin productos disponibles.</p>}</div></details></fieldset>
    {children}
    <div className="flex gap-2"><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-ink-strong"><Search className="size-4" />Aplicar</button>{(dirty || children) && <Link href={basePath} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold text-ink-muted hover:text-ink"><X className="size-3.5" />Limpiar</Link>}</div>
  </form>;
}
