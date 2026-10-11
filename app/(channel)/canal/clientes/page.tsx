import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarRange, Car, ChevronRight, Eye, EyeOff, FileText, Package, RectangleHorizontal, Search, SearchX, UsersRound, X } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { ActionTip, iconActionClass } from "@/components/channel/action-tip";
import { Meta } from "@/components/channel/order-meta";
import { StatusPill } from "@/components/channel/order-status-pill";
import { ResendCertificateButton } from "@/components/channel/resend-certificate-button";
import { requireChannelUser } from "@/lib/auth/session";
import { normalizeEcuadorPhone } from "@/lib/certificates/send";
import { ORDER_SEARCH_LIMIT, searchRegisteredOrders, type ChannelOrderResult } from "@/lib/channel/order-search";

export const metadata: Metadata = { title: "Clientes del canal | Kuantix", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireChannelUser();
  const { q = "" } = await searchParams;
  const term = q.trim();
  // Sin término no se consulta la base: la cartera solo se ve al buscar.
  const result = term ? await searchRegisteredOrders(s.channelId!, term) : null;

  return (
    <AdminPage
      eyebrow="Cartera del canal"
      title="Clientes"
      description="Consulta las Órdenes de Emisión del canal, revisa todos sus datos y pagos, y reenvía el certificado de cobertura."
    >
      <form className="glass-panel mt-7 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar Órdenes de Emisión</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
            <input name="q" defaultValue={term} autoFocus placeholder="Nombre del cliente, cédula/RUC, placa, marca, modelo, producto o aseguradora" className="min-h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm text-ink outline-none focus:border-brand/60" />
          </label>
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-white hover:bg-ink-strong">
            <Search className="size-4" />Buscar
          </button>
          {term && (
            <Link href="/canal/clientes" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink/80 hover:bg-surface-muted">
              <X className="size-4" />Limpiar
            </Link>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[10.5px] font-semibold text-ink-subtle">
          {["Cliente", "Cédula / RUC", "Placa", "Marca", "Modelo", "Producto", "Aseguradora"].map((f) => (
            <span key={f} className="rounded-full border border-line bg-surface-muted px-2.5 py-0.5">{f}</span>
          ))}
        </div>
      </form>

      {!result ? (
        <EmptyState icon={UsersRound} title="Busca para ver la cartera" text="Escribe el nombre del cliente, su cédula o RUC, la placa, la marca o el modelo del vehículo, el producto o la aseguradora." />
      ) : !result.orders.length ? (
        <EmptyState icon={SearchX} title={`Sin resultados para "${term}"`} text="Revisa lo que escribiste o intenta con otro dato del cliente o del vehículo." />
      ) : (
        <>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-ink-subtle">
            {result.orders.length} {result.orders.length === 1 ? "Orden de Emisión" : "Órdenes de Emisión"} para &quot;{term}&quot;
            {result.more && <span className="normal-case tracking-normal"> · se muestran las {ORDER_SEARCH_LIMIT} más recientes, afina la búsqueda</span>}
          </p>
          <section className="mt-3 grid gap-3">
            {result.orders.map((o) => <OrderCard key={o.id} order={o} term={term} />)}
          </section>
        </>
      )}
    </AdminPage>
  );
}

function OrderCard({ order: o, term }: { order: ChannelOrderResult; term: string }) {
  const href = `/canal/clientes/${o.id}?q=${encodeURIComponent(term)}`;
  const vehicle = [o.brand, o.model, o.year].filter(Boolean).join(" ");
  return (
    <article className="glass-panel grid gap-5 p-5 transition-shadow hover:shadow-[0_14px_34px_rgba(23,50,80,0.1)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <Link href={href} className="block truncate text-sm font-bold text-ink hover:text-brand-text">{o.client}</Link>
            <p className="text-xs text-ink-subtle">{o.identification ?? "Sin identificación"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={o.status} policy={o.policyNumber} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[11px] text-ink-muted">
              <FileText className="size-3 text-brand-text" aria-hidden="true" />{o.certificateNumber ?? "Sin certificado"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[11px] text-ink-muted">
              <CalendarRange className="size-3 text-brand-text" aria-hidden="true" />Vigencia <span className="font-semibold text-ink">{day(o.start)} – {day(o.end)}</span>
            </span>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 min-[480px]:grid-cols-2 md:flex md:flex-wrap md:gap-x-8 md:gap-y-4">
          <Meta icon={Car} label="Vehículo" value={vehicle || "—"} />
          <Meta icon={RectangleHorizontal} label="Placa" value={o.plate ? o.plate.toUpperCase() : "Sin placa"} mono={Boolean(o.plate)} />
          <Meta icon={Package} label="Producto" value={o.product ?? "—"} />
          <Meta icon={Building2} label="Aseguradora" value={o.insurer ?? "—"} />
        </dl>
      </div>
      <div className="flex items-center justify-between gap-5 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:py-1 lg:pl-6 lg:pt-1">
        <div className="lg:text-right">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Cuota mensual</p>
          <p className="mt-0.5 text-base font-bold tracking-[-0.02em] text-ink">{money(o.monthlyPayment)}</p>
        </div>
        <div className="flex items-center gap-2">
          {o.certificateNumber ? (
            <>
              <ActionTip label="Ver certificado">
                <a href={`/canal/cotizaciones/${o.id}/certificado`} target="_blank" rel="noreferrer" aria-label={`Ver certificado ${o.certificateNumber}`} className={`${iconActionClass} text-ink-subtle hover:border-brand/40 hover:bg-brand/10 hover:text-brand-text focus-visible:outline-brand`}>
                  <Eye className="size-[18px]" aria-hidden="true" />
                </a>
              </ActionTip>
              <ResendCertificateButton quoteId={o.id} client={o.client} certificateNumber={o.certificateNumber} email={o.email} phone={o.phone ? normalizeEcuadorPhone(o.phone) : null} />
            </>
          ) : (
            <ActionTip label="Registrada antes del certificado">
              <span aria-label="Sin certificado" className={`${iconActionClass} cursor-not-allowed border-dashed text-ink-subtle/50`}>
                <EyeOff className="size-[18px]" aria-hidden="true" />
              </span>
            </ActionTip>
          )}
          <ActionTip label="Ver detalle">
            <Link href={href} aria-label={`Ver detalle de ${o.client}`} className={`${iconActionClass} text-ink-subtle hover:border-brand/40 hover:bg-brand/10 hover:text-brand-text focus-visible:outline-brand`}>
              <ChevronRight className="size-[18px]" aria-hidden="true" />
            </Link>
          </ActionTip>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return (
    <div className="glass-panel mt-4 flex flex-col items-center px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-brand-text"><Icon className="size-7" /></span>
      <p className="mt-5 text-base font-bold">{title}</p>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-ink-muted">{text}</p>
    </div>
  );
}

function day(v: string | null) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}
function money(v: number | string) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(v));
}
