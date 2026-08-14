import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CarFront, FilePlus2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Mis cotizaciones | Confia", robots: { index: false, follow: false } };

export default async function QuotesPage() {
  const session = await requireSession();
  const { data: quotes } = session.actorType === "CLIENTE" ? await createAdminClient().from("cotizacion")
    .select("id,creado_en,estado,anios_vigencia,cuota_fija_mensual,nivel_riesgo,producto(nombre),aseguradora(nombre_comercial),vehiculo(marca,modelo)")
    .eq("cliente_id", session.actorId).order("creado_en", { ascending: false }) : { data: [] };

  return <main className="relative z-10 mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-7 lg:px-10 lg:py-12">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/70">Historial personal</p><h1 className="mt-2 text-[36px] font-bold tracking-[-0.035em] sm:text-[44px]">Mis cotizaciones</h1><p className="mt-2 text-sm text-white/60">Solo tú puedes consultar estas alternativas.</p></div>
      <Link href="/mi-cuenta/cotizaciones/nueva" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#071426]"><FilePlus2 className="size-4" /> Nueva cotización</Link>
    </header>
    <section className="mt-7 grid gap-3">
      {(quotes || []).map((quote) => {
        const product = Array.isArray(quote.producto) ? quote.producto[0] : quote.producto;
        const insurer = Array.isArray(quote.aseguradora) ? quote.aseguradora[0] : quote.aseguradora;
        const vehicle = Array.isArray(quote.vehiculo) ? quote.vehiculo[0] : quote.vehiculo;
        return <Link key={quote.id} href={`/mi-cuenta/cotizaciones/${quote.id}`} className="glass-panel group grid gap-4 p-5 transition-colors hover:border-cyan-100/35 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cyan-100/10 text-cyan-100"><CarFront className="size-5" /></span><div><p className="font-bold">{vehicle?.marca} {vehicle?.modelo}</p><p className="mt-1 text-sm text-white/55">{product?.nombre} · {insurer?.nombre_comercial}</p><p className="mt-2 text-xs text-white/38">{new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(new Date(quote.creado_en))} · {quote.anios_vigencia} años</p></div></div>
          <div className="flex items-center justify-between gap-5 sm:justify-end"><div className="sm:text-right"><p className="text-xs uppercase tracking-wider text-white/42">Cuota mensual</p><p className="mt-1 text-xl font-bold">{money(Number(quote.cuota_fija_mensual))}</p></div><ArrowRight className="size-5 text-white/35 transition-transform group-hover:translate-x-1" /></div>
        </Link>;
      })}
      {!quotes?.length && <div className="glass-panel p-8 text-center"><CarFront className="mx-auto size-7 text-cyan-100" /><h2 className="mt-4 text-lg font-bold">Aún no tienes cotizaciones</h2><p className="mt-2 text-sm text-white/55">Registra tu vehículo para calcular la primera.</p></div>}
    </section>
  </main>;
}

function money(value: number) { return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value); }
