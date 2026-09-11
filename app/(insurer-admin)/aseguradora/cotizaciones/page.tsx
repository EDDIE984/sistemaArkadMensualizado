import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, Table2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { getDbPool } from "@/lib/db/pool";

export const metadata: Metadata = { title: "Cotizaciones | Arkad", robots: { index: false, follow: false } };

type QuoteRow = { id: string; creado_en: string; estado: string; anios_vigencia: number; cuota_fija_mensual: string; cliente: string; identificacion: string | null; producto: string; canal: string; marca: string; modelo: string; placa: string | null };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const session = await requireInsurerAdmin();
  const { q = "", estado = "" } = await searchParams;
  const term = q.trim();
  const states = ["PENDIENTE", "ACEPTADA", "RECHAZADA", "EXPIRADA"];
  const selectedState = states.includes(estado) ? estado : "";
  const result = await getDbPool().query<QuoteRow>(`
    select c.id, c.creado_en::text, c.estado, c.anios_vigencia, c.cuota_fija_mensual::text,
           cl.nombre_razon_social cliente, cl.identificacion, p.nombre producto,
           coalesce(ch.nombre, 'Autogestión') canal, v.marca, v.modelo, v.placa
    from cotizacion c
    join cliente cl on cl.id = c.cliente_id
    join producto p on p.id = c.producto_id
    join vehiculo v on v.id = c.vehiculo_id
    left join canal ch on ch.id = c.canal_id
    where c.aseguradora_id = $1
      and ($2::text = '' or c.estado = $2)
      and ($3::text = '' or concat_ws(' ', cl.nombre_razon_social, cl.identificacion, v.marca, v.modelo, v.placa, p.nombre) ilike '%' || $3 || '%')
    order by c.creado_en desc
    limit 200
  `, [session.insurerId!, selectedState, term]);
  const hrefFor = (state: string) => { const params = new URLSearchParams(); if (state) params.set("estado", state); if (term) params.set("q", term); const query = params.toString(); return query ? `?${query}` : "/aseguradora/cotizaciones"; };
  return <AdminPage eyebrow="Producción" title="Cotizaciones" description="Busca las cotizaciones de tu aseguradora y abre su detalle de cálculo.">
    <form className="mt-7 flex flex-col gap-3 sm:flex-row"><input name="q" defaultValue={term} placeholder="Cliente, identificación, vehículo, placa o producto" className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-[#061323]/65 px-4 text-sm outline-none focus:border-cyan-100/55"/>{selectedState&&<input type="hidden" name="estado" value={selectedState}/>}<button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#071426]"><Search className="size-4"/>Buscar</button>{term&&<Link href={selectedState?`?estado=${selectedState}`:"/aseguradora/cotizaciones"} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/14 px-5 text-sm font-bold">Limpiar</Link>}</form>
    <nav className="mt-4 flex flex-wrap gap-2">{[["", "Todas"], ...states.map(state => [state, state] as [string, string])].map(([state, label]) => <Link key={state} href={hrefFor(state)} className={`min-h-10 rounded-full border px-4 py-2.5 text-xs font-bold ${state === selectedState ? "border-cyan-100/40 bg-cyan-100/10" : "border-white/12"}`}>{label}</Link>)}</nav>
    <section className="mt-4 grid gap-3">{result.rows.map(row => <article key={row.id} className="glass-panel grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-bold">{row.cliente}</p><p className="mt-1 text-sm text-white/55">{row.marca} {row.modelo}{row.placa?` · ${row.placa}`:""} · {row.producto}</p><p className="mt-2 text-xs text-white/40">{row.canal} · {new Date(row.creado_en).toLocaleDateString("es-EC")} · {row.anios_vigencia * 12} cuotas</p></div><div className="flex items-center gap-4 sm:text-right"><div><p className="text-xs text-white/42">Cuota mensual</p><p className="mt-1 text-lg font-bold">{money(row.cuota_fija_mensual)}</p><p className="mt-1 text-[10px] font-bold text-cyan-100/65">{row.estado}</p></div><Link href={`/aseguradora/operacion/${row.id}/calculo`} aria-label={`Ver cálculo de ${row.cliente}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-bold"><Table2 className="size-4"/>Detalle <ArrowRight className="size-3.5"/></Link></div></article>)}{!result.rows.length&&<div className="glass-panel p-8 text-center text-sm text-white/50">No hay cotizaciones con este filtro.</div>}</section>
  </AdminPage>;
}

function money(value: string) { return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(value)); }
