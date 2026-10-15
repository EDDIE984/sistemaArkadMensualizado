"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useState } from "react";

type Channel = { id: string; nombre: string };
type Product = { id: string; nombre: string; canal_id: string };

const field = "min-h-11 min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none focus:border-brand/60 [color-scheme:light]";

/** Mantiene la lista de productos limitada al canal elegido antes de consultar. */
export function PendingEmissionFilters({
  channels,
  products,
  selectedChannelId,
  selectedProductId,
  from,
  to,
}: {
  channels: Channel[];
  products: Product[];
  selectedChannelId: string | null;
  selectedProductId: string | null;
  from: string;
  to: string;
}) {
  const [channelId, setChannelId] = useState(selectedChannelId ?? "");
  const [productId, setProductId] = useState(selectedProductId ?? "");
  const visibleProducts = products.filter((product) => !channelId || product.canal_id === channelId);
  const dirty = Boolean(channelId || productId || from || to);

  return <form action="/aseguradora/operacion" className="glass-panel mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(11rem,0.8fr)_minmax(12rem,1fr)_minmax(9rem,0.7fr)_minmax(9rem,0.7fr)_auto] xl:items-end">
    <label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">Canal</span><select name="canal" value={channelId} onChange={(event) => { setChannelId(event.target.value); setProductId(""); }} className={field}><option value="">Todos los canales</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.nombre}</option>)}</select></label>
    <label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">Producto</span><select name="producto" value={productId} onChange={(event) => setProductId(event.target.value)} className={field}><option value="">Todos los productos</option>{visibleProducts.map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}</select></label>
    <label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">Desde</span><input type="date" name="desde" defaultValue={from} className={field} /></label>
    <label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">Hasta</span><input type="date" name="hasta" defaultValue={to} className={field} /></label>
    <div className="flex gap-2"><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-ink-strong"><Search className="size-4" />Aplicar</button>{dirty && <Link href="/aseguradora/operacion" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold text-ink-muted hover:text-ink"><X className="size-3.5" />Limpiar</Link>}</div>
  </form>;
}
