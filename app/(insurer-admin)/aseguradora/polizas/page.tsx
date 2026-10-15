import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarRange, Car, ChevronRight, CircleDollarSign, Download, FileCheck2, FileX2, Package, RectangleHorizontal, SearchX, ShieldCheck, TriangleAlert, Wallet } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { ActionTip, iconActionClass } from "@/components/channel/action-tip";
import { Meta } from "@/components/channel/order-meta";
import { StatusPill } from "@/components/channel/order-status-pill";
import { SummaryScopeFilter } from "@/components/insurer/summary-scope-filter";
import { Kpi, money, num } from "@/components/summary/summary-ui";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { POLICY_STATES, getPolicies, policiesQuery, readPolicyFilters, type PolicyRow } from "@/lib/insurer/policies";
import { resolveInsurerSummaryScope } from "@/lib/insurer/summary-scope";

export const metadata: Metadata = { title: "Pólizas emitidas | Kuantix", robots: { index: false, follow: false } };

const PAGE_SIZE = 50;
const label = "text-[10px] font-bold uppercase tracking-wider text-ink-subtle";
const control = "min-h-11 min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none focus:border-brand/60 [color-scheme:light]";
type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireInsurerAdmin();
  const params = await searchParams;
  const { filters, valid } = readPolicyFilters((key) => one(params[key]));
  const scopeData = await resolveInsurerSummaryScope(session.insurerId!, { canal: params.canal, productos: params.productos });
  const { selectedChannelId: channelId, selectedProductIds: productIds } = scopeData;
  const { summary, rows, page } = await getPolicies({ ...scopeData.scope, insurerId: session.insurerId! }, filters, Number(one(params.page)) || 1, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(summary.total / PAGE_SIZE));
  const listQuery = policiesQuery(filters, channelId, productIds, page > 1 ? { page: String(page) } : {});

  return <AdminPage eyebrow="Producción" title="Pólizas emitidas" description="Consulta las pólizas emitidas por canal y producto, revisa sus condiciones y pagos, y expórtalas a Excel.">
    <section className="glass-panel mt-7 p-4 sm:p-5">
      <SummaryScopeFilter key={`${channelId ?? "all"}-${productIds.join("-")}`} basePath="/aseguradora/polizas" channels={scopeData.channels} products={scopeData.products} selectedChannelId={channelId} selectedProductIds={productIds} preserve={{}}>
        <label className="grid gap-1.5"><span className={label}>Emisión desde</span><input type="date" name="desde" defaultValue={filters.from} required className={control} /></label>
        <label className="grid gap-1.5"><span className={label}>Emisión hasta</span><input type="date" name="hasta" defaultValue={filters.to} required className={control} /></label>
        <label className="grid gap-1.5"><span className={label}>Estado</span><select name="estado" defaultValue={filters.status} className={control}>{POLICY_STATES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
        <label className="grid gap-1.5"><span className={label}>Buscar</span><input name="q" defaultValue={filters.q} maxLength={100} placeholder="Cliente, cédula, placa, póliza" className={control} /></label>
      </SummaryScopeFilter>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-ink-subtle">Pólizas emitidas entre el <span className="font-semibold text-ink-muted">{day(filters.from)}</span> y el <span className="font-semibold text-ink-muted">{day(filters.to)}</span>.</p>
        <a href={`/aseguradora/polizas/descargar?${policiesQuery(filters, channelId, productIds)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-brand/50 bg-brand/10 px-5 text-sm font-bold text-ink hover:bg-brand/20"><Download className="size-4" />Descargar Excel</a>
      </div>
    </section>
    {!valid && <p role="alert" className="mt-4 text-sm text-red-700">Revisa las fechas: la fecha desde debe ser anterior o igual a la fecha hasta. Se muestran las emisiones del año en curso.</p>}

    <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi icon={FileCheck2} label="Pólizas" value={num(summary.total)} hint="Emitidas en el filtro" />
      <Kpi icon={ShieldCheck} label="Vigentes" value={num(summary.active)} hint={`Cuota mensual ${money(summary.monthly)}`} accent />
      <Kpi icon={FileX2} label="Canceladas" value={num(summary.cancelled)} hint="Del filtro" />
      <Kpi icon={Wallet} label="Monto pagado" value={money(summary.paidAmount)} hint="Pagos registrados de estas pólizas" />
      <Kpi icon={TriangleAlert} label="Con cuotas vencidas" value={num(summary.withOverdue)} hint="Pólizas con mora a hoy" tone={summary.withOverdue ? "warn" : undefined} />
    </section>

    {!rows.length ? (
      <div className="glass-panel mt-4 flex flex-col items-center px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-brand-text"><SearchX className="size-7" /></span>
        <p className="mt-5 text-base font-bold">Sin pólizas para estos filtros</p>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-ink-muted">Prueba otro rango de emisión, canal, producto o estado.</p>
      </div>
    ) : (
      <section className="mt-4 grid gap-3">{rows.map((r) => <PolicyCard key={r.quoteId} row={r} back={listQuery} />)}</section>
    )}

    <nav aria-label="Páginas de pólizas" className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-muted">
      <p>{summary.total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, summary.total)} de ${summary.total} pólizas` : "0 pólizas"} · Página {page} de {pages}</p>
      <div className="flex gap-3">
        {page > 1 && <Link className="flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:bg-white" href={`/aseguradora/polizas?${policiesQuery(filters, channelId, productIds, { page: String(page - 1) })}`}>Anterior</Link>}
        {page < pages && <Link className="flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:bg-white" href={`/aseguradora/polizas?${policiesQuery(filters, channelId, productIds, { page: String(page + 1) })}`}>Siguiente</Link>}
      </div>
    </nav>
  </AdminPage>;
}

function PolicyCard({ row: r, back }: { row: PolicyRow; back: string }) {
  const href = `/aseguradora/polizas/${r.quoteId}?volver=${encodeURIComponent(back)}`;
  const vehicle = [r.brand, r.model, r.year].filter(Boolean).join(" ");
  return (
    <article className="glass-panel grid gap-5 p-5 transition-shadow hover:shadow-[0_14px_34px_rgba(23,50,80,0.1)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <Link href={href} className="block truncate text-sm font-bold text-ink hover:text-brand-text">{r.client}</Link>
            <p className="text-xs text-ink-subtle">{r.identification ?? "Sin identificación"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status="ACEPTADA" policy={r.policy} policyStatus={r.status} />
            {r.status === "VENCIDA" && <span className="rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Vencida</span>}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[11px] text-ink-muted">
              <CalendarRange className="size-3 text-brand-text" aria-hidden="true" />Emitida <span className="font-semibold text-ink">{day(r.issued)}</span> · Vigencia <span className="font-semibold text-ink">{day(r.start)} – {day(r.end)}</span>
            </span>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 min-[480px]:grid-cols-2 md:flex md:flex-wrap md:gap-x-8 md:gap-y-4">
          <Meta icon={Car} label="Vehículo" value={vehicle || "—"} />
          <Meta icon={RectangleHorizontal} label="Placa" value={r.plate ? r.plate.toUpperCase() : "Sin placa"} mono={Boolean(r.plate)} />
          <Meta icon={Package} label="Producto" value={r.product} />
          <Meta icon={Building2} label="Canal" value={r.channel ?? "—"} />
          <Meta icon={CircleDollarSign} label="Cuotas pagadas" value={`${r.paid} de ${r.installments}${r.overdue ? ` · ${r.overdue} vencidas` : ""}`} />
        </dl>
      </div>
      <div className="flex items-center justify-between gap-5 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:py-1 lg:pl-6 lg:pt-1">
        <div className="lg:text-right">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Cuota mensual</p>
          <p className="mt-0.5 text-base font-bold tracking-[-0.02em] text-ink">{money(r.monthly)}</p>
          <p className="text-[11px] text-ink-subtle">Pagado {money(r.paidAmount)}</p>
        </div>
        <ActionTip label="Ver detalle">
          <Link href={href} aria-label={`Ver detalle de ${r.client}`} className={`${iconActionClass} text-ink-subtle hover:border-brand/40 hover:bg-brand/10 hover:text-brand-text focus-visible:outline-brand`}>
            <ChevronRight className="size-[18px]" aria-hidden="true" />
          </Link>
        </ActionTip>
      </div>
    </article>
  );
}

function day(v: string | null) {
  if (!v) return "—";
  const [y, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
