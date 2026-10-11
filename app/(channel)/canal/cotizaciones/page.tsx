import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarRange, Car, CheckCircle2, Eye, FileClock, Package, RectangleHorizontal, Search, X } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { ActionTip, iconActionClass } from "@/components/channel/action-tip";
import { DeleteOrderButton } from "@/components/channel/delete-order-button";
import { Meta } from "@/components/channel/order-meta";
import { RegisterInsuranceButton } from "@/components/channel/register-insurance-button";
import { requireChannelUser } from "@/lib/auth/session";
import { searchPendingOrderIds } from "@/lib/channel/order-search";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Órdenes de Emisión del canal | Kuantix", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; eliminada?: string; registradas?: string }> }) {
  const s = await requireChannelUser();
  const { q = "", eliminada, registradas } = await searchParams;
  const registered = Number(registradas) > 0 ? Number(registradas) : 0;
  const term = q.trim();

  // El canal solo trabaja sobre las Órdenes de Emisión pendientes.
  let query = createAdminClient()
    .from("cotizacion")
    .select("id,creado_en,cuota_fija_mensual,fecha_inicio_vigencia,fecha_fin_vigencia,cliente!inner(nombre_razon_social,identificacion),vehiculo(marca,modelo,placa),producto(nombre),aseguradora(nombre_comercial)")
    .eq("canal_id", s.channelId!)
    .eq("estado", "PENDIENTE")
    .order("creado_en", { ascending: false });
  if (term) {
    const ids = await searchPendingOrderIds(s.channelId!, term);
    // Sin coincidencias se envía un UUID imposible para que `.in()` devuelva vacío.
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data } = await query;
  const orders = data || [];

  return (
    <AdminPage
      eyebrow="Producción del canal"
      title="Órdenes de Emisión"
      description="Órdenes de Emisión pendientes registradas desde este canal. Revisa su detalle o elimina las que ya no se emitirán."
      action={
        <RegisterInsuranceButton />
      }
    >
      {registered > 0 && (
        <div role="status" className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <span className="flex items-center gap-2"><CheckCircle2 className="size-5 shrink-0" />{registered === 1 ? "Se registró 1 Orden de Emisión." : `Se registraron ${registered} Órdenes de Emisión.`}</span>
          <Link href="/canal/cotizaciones" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-emerald-100" aria-label="Cerrar aviso"><X className="size-4" /></Link>
        </div>
      )}
      {eliminada === "1" && (
        <div role="status" className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <span className="flex items-center gap-2"><CheckCircle2 className="size-5 shrink-0" />Orden de Emisión eliminada definitivamente.</span>
          <Link href="/canal/cotizaciones" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-emerald-100" aria-label="Cerrar aviso"><X className="size-4" /></Link>
        </div>
      )}

      <form className="mt-7 flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Buscar por cliente, cédula, placa, marca, modelo, producto o aseguradora</span>
          <input name="q" defaultValue={term} placeholder="Buscar por cliente, cédula, placa, marca, modelo, producto o aseguradora" className="min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none focus:border-brand/60" />
        </label>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white">
          <Search className="size-4" />Buscar
        </button>
        {term && (
          <Link href="/canal/cotizaciones" className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-5 text-sm font-bold text-ink/80">
            Limpiar
          </Link>
        )}
      </form>

      <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-ink-subtle">
        {orders.length} {orders.length === 1 ? "pendiente" : "pendientes"}{term ? ` para "${term}"` : ""}
      </p>

      <section className="mt-3 grid gap-3">
        {orders.map((x) => {
          const client = rel(x.cliente, "nombre_razon_social");
          const rawPlate = rel(x.vehiculo, "placa");
          const plate = rawPlate === "—" || rawPlate === "null" ? null : rawPlate.toUpperCase();
          const vehicle = `${rel(x.vehiculo, "marca")} ${rel(x.vehiculo, "modelo")}`;
          const amount = money(x.cuota_fija_mensual);
          const href = `/canal/cotizaciones/${x.id}`;
          return (
            <article key={x.id} className="glass-panel grid gap-5 p-5 transition-shadow hover:shadow-[0_14px_34px_rgba(23,50,80,0.1)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <Link href={href} className="min-w-0 truncate text-sm font-bold text-ink hover:text-brand-text">{client}</Link>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[11px] text-ink-muted">
                    <CalendarRange className="size-3 text-brand-text" aria-hidden="true" />
                    Vigencia <span className="font-semibold text-ink">{day(x.fecha_inicio_vigencia)} – {day(x.fecha_fin_vigencia)}</span>
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 min-[480px]:grid-cols-2 md:flex md:flex-wrap md:gap-x-8 md:gap-y-4">
                  <Meta icon={Car} label="Vehículo" value={vehicle} />
                  <Meta icon={RectangleHorizontal} label="Placa" value={plate ?? "Sin placa"} mono={Boolean(plate)} />
                  <Meta icon={Package} label="Producto" value={rel(x.producto, "nombre")} />
                  <Meta icon={Building2} label="Aseguradora" value={rel(x.aseguradora, "nombre_comercial")} />
                </dl>
              </div>
              <div className="flex items-center justify-between gap-5 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:py-1 lg:pl-6 lg:pt-1">
                <div className="lg:text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Cuota mensual</p>
                  <p className="mt-0.5 text-base font-bold tracking-[-0.02em] text-ink">{amount}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ActionTip label="Ver detalle">
                    <Link href={href} aria-label={`Ver detalle de la Orden de Emisión de ${client}`} className={`${iconActionClass} text-ink-subtle hover:border-brand/40 hover:bg-brand/10 hover:text-brand-text focus-visible:outline-brand`}>
                      <Eye className="size-[18px]" aria-hidden="true" />
                    </Link>
                  </ActionTip>
                  <DeleteOrderButton quoteId={x.id} client={client} vehicle={plate ? `${vehicle} · ${plate}` : vehicle} amount={amount} />
                </div>
              </div>
            </article>
          );
        })}
        {!orders.length && (
          <div className="glass-panel flex flex-col items-center p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><FileClock className="size-6" /></span>
            <p className="mt-4 font-bold">{term ? `No hay Órdenes de Emisión pendientes para "${term}".` : "No tienes Órdenes de Emisión pendientes."}</p>
            <p className="mt-1 text-sm text-ink-subtle">Las nuevas órdenes que registres aparecerán aquí hasta que se emitan.</p>
          </div>
        )}
      </section>
    </AdminPage>
  );
}

function rel(v: unknown, k: string) {
  const r = Array.isArray(v) ? v[0] : v;
  return r && typeof r === "object" && k in r ? String((r as Record<string, unknown>)[k]) : "—";
}
/** Fecha `YYYY-MM-DD` de la base → `dd/mm/aaaa`, sin conversión de zona horaria. */
function day(v: string | null) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}
function money(v: number | string) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(v));
}
