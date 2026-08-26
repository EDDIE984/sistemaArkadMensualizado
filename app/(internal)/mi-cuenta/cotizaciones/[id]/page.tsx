import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, CarFront, ScanLine, ShieldCheck, TrendingUp } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCarroceria, requiredSlots } from "@/lib/inspeccion/slots";

export const metadata: Metadata = { title: "Detalle de cotización | Confia", robots: { index: false, follow: false } };

export default async function QuoteDetailPage({ params, searchParams }: PageProps<"/mi-cuenta/cotizaciones/[id]">) {
  const session = await requireSession();
  if (session.actorType !== "CLIENTE") redirect("/mi-cuenta");
  const { id } = await params;
  const query = await searchParams;
  const db = createAdminClient();
  const { data: quote } = await db.from("cotizacion").select(`
    id,producto_id,creado_en,estado,anios_vigencia,tasa_promedio,nivel_riesgo,cuota_fija_mensual,
    producto(nombre),aseguradora(nombre_comercial),ciudad(nombre,provincia),
    vehiculo(marca,modelo,anio,color,valor_asegurado,estado_vh,uso,placa),
    cotizacion_cobertura(valor_aplicado,producto_cobertura(cobertura_base(nombre,descripcion_generica))),
    cotizacion_deducible(valor_aplicado,producto_deducible(deducible_base(nombre,tipo_calculo))),
    inspeccion(carroceria,estado,inspeccion_foto(count))
  `).eq("id", id).eq("cliente_id", session.actorId).maybeSingle();
  if (!quote) redirect("/mi-cuenta/cotizaciones");
  const inspeccionBadge = inspectionBadge(quote.inspeccion);
  const [{ data: schedule }, { data: losses }] = await Promise.all([
    db.from("amortizacion_mensual").select("mes,valor_asegurado_mes,prima_total_mes,cuota_fija").eq("cotizacion_id", id).order("mes"),
    db.from("tabla_perdidas").select("perdidas_parciales,perdidas_totales").eq("producto_id", quote.producto_id).eq("nivel_riesgo", quote.nivel_riesgo).maybeSingle(),
  ]);
  const product = first(quote.producto);
  const insurer = first(quote.aseguradora);
  const city = first(quote.ciudad);
  const vehicle = first(quote.vehiculo);
  const riskLabel = quote.nivel_riesgo === 1 ? "Alto" : quote.nivel_riesgo === 2 ? "Moderado" : "Bajo";

  return <main className="relative z-10 mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-7 lg:px-10 lg:py-12">
    <Link href="/mi-cuenta/cotizaciones" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/60 hover:text-white"><ArrowLeft className="size-4" /> Mis cotizaciones</Link>
    {query.created === "1" && <p className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-50">Cotización calculada y guardada correctamente.</p>}
    <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/70">{insurer?.nombre_comercial}</p><h1 className="mt-2 text-[34px] font-bold tracking-[-0.035em] sm:text-[44px]">{vehicle?.marca} {vehicle?.modelo}</h1><p className="mt-2 text-sm text-white/58">{product?.nombre} · {city?.nombre}{city?.provincia ? `, ${city.provincia}` : ""}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/mi-cuenta/cotizaciones/${id}/inspeccion`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-100/25 bg-cyan-100/10 px-4 text-xs font-bold uppercase tracking-wider text-cyan-50 hover:bg-cyan-100/16"><ScanLine className="size-4" /> Inspección{inspeccionBadge ? ` · ${inspeccionBadge}` : ""}</Link>
        <span className="w-fit rounded-full border border-cyan-100/20 bg-cyan-100/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-50">{quote.estado}</span>
      </div>
    </header>

    <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric icon={<ShieldCheck />} label="Cuota fija mensual" value={money(Number(quote.cuota_fija_mensual))} />
      <Metric icon={<TrendingUp />} label="Tasa promedio" value={`${(Number(quote.tasa_promedio) * 100).toFixed(3)}%`} />
      <Metric icon={<ShieldCheck />} label="Nivel de riesgo" value={riskLabel} />
      <Metric icon={<CalendarDays />} label="Vigencia" value={`${quote.anios_vigencia} años`} />
    </section>

    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <article className="glass-panel p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><CarFront className="size-5 text-cyan-100" /> Vehículo asegurado</h2><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><Detail label="Año" value={String(vehicle?.anio || "No indicado")} /><Detail label="Color" value={title(vehicle?.color || "")} /><Detail label="Estado" value={title(vehicle?.estado_vh || "")} /><Detail label="Uso" value={title(vehicle?.uso || "")} /><Detail label="Valor asegurado" value={money(Number(vehicle?.valor_asegurado || 0))} /><Detail label="Placa" value={vehicle?.placa || "No indicada"} /></dl></article>
      <article className="glass-panel p-5 sm:p-6"><h2 className="text-lg font-bold">Condiciones por pérdidas</h2><dl className="mt-5 grid gap-4 text-sm"><Detail label="Pérdidas parciales" value={losses?.perdidas_parciales || "No configurado"} /><Detail label="Pérdidas totales" value={losses?.perdidas_totales || "No configurado"} /></dl></article>
    </section>

    <section className="glass-panel mt-4 p-5 sm:p-6"><h2 className="text-lg font-bold">Coberturas incluidas</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{(quote.cotizacion_cobertura || []).map((snapshot, index) => { const configured = first(snapshot.producto_cobertura); const coverage = configured ? first(configured.cobertura_base) : null; return <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-sm font-bold">{coverage?.nombre || "Cobertura"}</p><p className="mt-1 text-xs leading-5 text-white/50">{coverage?.descripcion_generica}</p></div>; })}</div></section>

    <section className="glass-panel mt-4 overflow-hidden"><header className="border-b border-white/10 p-5 sm:p-6"><h2 className="text-lg font-bold">Proyección mensual</h2><p className="mt-1 text-sm text-white/52">La cuota se nivela para mantener un pago estable durante los {schedule?.length || 0} meses.</p></header><div className="max-h-[520px] overflow-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="sticky top-0 bg-[#071426] text-[10px] uppercase tracking-wider text-white/45"><tr><th className="px-5 py-3">Mes</th><th className="px-5 py-3">Valor asegurado</th><th className="px-5 py-3">Costo real</th><th className="px-5 py-3 text-right">Cuota fija</th></tr></thead><tbody>{(schedule || []).map((row) => <tr key={row.mes} className="border-t border-white/8"><td className="px-5 py-3 font-semibold">{row.mes}</td><td className="px-5 py-3 text-white/60">{money(Number(row.valor_asegurado_mes))}</td><td className="px-5 py-3 text-white/60">{money(Number(row.prima_total_mes))}</td><td className="px-5 py-3 text-right font-bold">{money(Number(row.cuota_fija))}</td></tr>)}</tbody></table></div></section>
    <p className="mt-5 text-xs leading-5 text-white/42">Cotización informativa creada el {new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short" }).format(new Date(quote.creado_en))}. No constituye una póliza ni confirma cobertura.</p>
  </main>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="glass-panel p-5"><span className="text-cyan-100 [&_svg]:size-5">{icon}</span><p className="mt-6 text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></article>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/38">{label}</dt><dd className="mt-1 leading-5 text-white/82">{value}</dd></div>; }
function first<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] || null : value; }
function money(value: number) { return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value); }
function title(value: string) { return value.toLowerCase().replace(/_/g, " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
function inspectionBadge(value: unknown): string | null {
  const row = first(value as { carroceria?: string; estado?: string; inspeccion_foto?: { count: number }[] } | null);
  if (!row || !isCarroceria(row.carroceria)) return null;
  if (row.estado === "COMPLETADA") return "Completada";
  const count = Array.isArray(row.inspeccion_foto) ? row.inspeccion_foto[0]?.count ?? 0 : 0;
  return `${count}/${requiredSlots(row.carroceria).length}`;
}
