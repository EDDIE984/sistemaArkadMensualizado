import type { Metadata } from "next";
import { BadgeDollarSign, BadgePercent, CalendarClock, CircleDollarSign, Download, FileClock, Landmark, Package, ReceiptText, Users, Wallet } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { AreaChart, BarList, ColumnChart } from "@/components/channel/summary-charts";
import { RangePicker } from "@/components/channel/range-picker";
import { SummaryScopeFilter } from "@/components/insurer/summary-scope-filter";
import { ChartCard, ExpiringTable, Kpi, Stat, day, delta, money, num } from "@/components/summary/summary-ui";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { monthLabel } from "@/lib/channel/month-label";
import { EXPIRY_OPTIONS, PERIOD_OPTIONS, getSummary, parseSummaryFilters } from "@/lib/channel/summary";
import { getCollections, type CollectionChannel } from "@/lib/insurer/collections";
import { resolveInsurerSummaryScope } from "@/lib/insurer/summary-scope";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Resumen de la aseguradora | Kuantiq", robots: { index: false, follow: false } };

type SearchParams = { periodo?: string | string[]; desde?: string | string[]; hasta?: string | string[]; vence?: string | string[]; vdesde?: string | string[]; vhasta?: string | string[]; canal?: string | string[]; productos?: string | string[] };
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;
const selectedQuery = (channelId: string | null, productIds: string[]) => ({ ...(channelId ? { canal: channelId } : {}), ...(productIds.length ? { productos: productIds } : {}) });

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireInsurerAdmin();
  const params = await searchParams;
  const filters = parseSummaryFilters({ periodo: first(params.periodo), desde: first(params.desde), hasta: first(params.hasta), vence: first(params.vence), vdesde: first(params.vdesde), vhasta: first(params.vhasta) });
  const scopeData = await resolveInsurerSummaryScope(session.insurerId!, { canal: params.canal, productos: params.productos });
  const [insurerResult, summary, collections] = await Promise.all([
    createAdminClient().from("aseguradora").select("nombre_comercial").eq("id", session.insurerId!).single(),
    getSummary(scopeData.scope, filters.period, filters.expiry),
    getCollections(scopeData.scope, filters.period),
  ]);
  const { current, previous } = summary;
  const scopeQuery = selectedQuery(scopeData.selectedChannelId, scopeData.selectedProductIds);
  const query = new URLSearchParams({ ...filters.periodQs, ...filters.expiryQs, ...(scopeData.selectedChannelId ? { canal: scopeData.selectedChannelId } : {}) });
  scopeData.selectedProductIds.forEach((productId) => query.append("productos", productId));
  const download = `/aseguradora/resumen/descargar?${query.toString()}`;
  const expiryLabel = filters.expiryKey === "rango" ? `${day(filters.expiry.from)} – ${day(filters.expiry.to)}` : `Próximos ${filters.expiryKey} días`;
  const totalNet = summary.products.reduce((total, product) => total + product.net, 0);
  const isAllChannels = scopeData.selectedChannelId === null;

  return <AdminPage eyebrow="Resumen de la aseguradora" title={insurerResult.data?.nombre_comercial ?? "Mi aseguradora"} description="Producción, cobranza y vencimientos de todos tus canales y productos.">
    <section className="glass-panel mt-7 p-4 sm:p-5">
      <SummaryScopeFilter key={`${scopeData.selectedChannelId ?? "all"}-${scopeData.selectedProductIds.join("-")}`} channels={scopeData.channels} products={scopeData.products} selectedChannelId={scopeData.selectedChannelId} selectedProductIds={scopeData.selectedProductIds} preserve={{ ...filters.periodQs, ...filters.expiryQs }} />
      <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4 lg:flex-row lg:items-start lg:justify-between"><RangePicker key={`p-${filters.periodKey}-${filters.period.from}-${filters.period.to}`} basePath="/aseguradora" label="Período" options={PERIOD_OPTIONS} activeKey={filters.periodKey} param="periodo" fromParam="desde" toParam="hasta" range={filters.period} preserve={{ ...filters.expiryQs, ...scopeQuery }} /><a href={download} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-brand/50 bg-brand/10 px-5 text-sm font-bold text-ink hover:bg-brand/20"><Download className="size-4" />Descargar Excel</a></div>
      <p className="mt-4 text-xs text-ink-subtle">Del <span className="font-semibold text-ink-muted">{day(filters.period.from)}</span> al <span className="font-semibold text-ink-muted">{day(filters.period.to)}</span>: vehículos y clientes emitidos; prima y comisión de las cuotas de cartera que vencen en esas fechas.</p>
    </section>

    <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
      <Kpi icon={Users} label="Clientes" value={num(current.clients)} delta={delta(current.clients, previous.clients)} hint={`${num(summary.portfolioClients)} en la cartera`} />
      <Kpi icon={BadgeDollarSign} label="Comisión del período" value={money(current.commission)} delta={delta(current.commission, previous.commission)} accent />
      <Kpi icon={Wallet} label="Comisión proyectada" value={money(summary.futureCommission)} hint={`Cuotas por vencer de ${num(summary.futurePolicies)} ${summary.futurePolicies === 1 ? "póliza" : "pólizas"}`} />
      <Kpi icon={CircleDollarSign} label="Prima neta del período" value={money(current.premium)} delta={delta(current.premium, previous.premium)} />
      <Kpi icon={FileClock} label="Órdenes pendientes" value={num(summary.pendingOrders)} hint="Por emitir (hoy)" href="/aseguradora/operacion" />
      <Kpi icon={CalendarClock} label="Próximos a vencer" value={num(summary.expiring.length)} hint={expiryLabel} href="#vencimientos" tone={summary.expiring.length ? "warn" : undefined} />
    </section>

    <section className="glass-panel mt-4 p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Landmark className="size-4 text-brand-text" />Cobranza</h2>
        <p className="mt-1 text-xs text-ink-subtle">Recaudado y efectividad corresponden al período seleccionado; por cobrar y mora, a la fecha de hoy.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={ReceiptText} label="Recaudado" value={money(collections.kpis.collected)} hint="Pagos registrados en el período" />
        <Kpi icon={CircleDollarSign} label="Por cobrar" value={money(collections.kpis.receivable)} hint="Cuotas que vencen desde hoy" />
        <Kpi icon={Wallet} label="Vencido (mora)" value={money(collections.kpis.overdue)} hint={`${plural(collections.kpis.overduePolicies, "póliza", "pólizas")} con cuotas vencidas`} tone={collections.kpis.overdue ? "warn" : undefined} />
        <Kpi icon={BadgePercent} label="Efectividad de cobro" value={percent(collections.kpis.effectiveness)} hint={`${money(collections.kpis.duePaid)} pagado de ${money(collections.kpis.due)} exigible`} />
      </div>
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-sm font-bold">Antigüedad de la mora</h3>
        <p className="mt-0.5 text-xs text-ink-subtle">Saldo vencido sin pagar según los días de atraso, a hoy.</p>
        <div className="mt-4"><BarList format="currency" empty="No hay cuotas vencidas." data={collections.aging.map((bucket) => ({ label: bucket.label, sublabel: `${plural(bucket.installments, "cuota", "cuotas")} · ${plural(bucket.policies, "póliza", "pólizas")}`, value: bucket.amount }))} /></div>
      </div>
    </section>

    {isAllChannels && <section className="glass-panel mt-4 p-5 sm:p-6"><div className="mb-4"><h2 className="text-sm font-bold">Cobranza por canal</h2><p className="mt-1 text-xs text-ink-subtle">Exigible y mora de cada canal dueño del producto.</p></div><CollectionChannelsTable rows={collections.channels} /></section>}

    <section className="mt-4"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h2 className="flex items-center gap-2 text-sm font-bold"><Package className="size-4 text-brand-text" />Producción por producto</h2><p className="text-xs text-ink-subtle">Cuotas de cartera que vencen en el período seleccionado</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{summary.products.map((product) => <article key={product.id} className="glass-panel p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{product.name}</p><p className="text-xs text-ink-subtle">{product.channel ?? "Sin canal"}</p></div><span className="shrink-0 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[11px] font-bold text-ink-muted">{totalNet ? Math.round((product.net / totalNet) * 100) : 0} %</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand/10"><div className="h-full rounded-full bg-brand-text" style={{ width: `${totalNet ? (product.net / totalNet) * 100 : 0}%` }} /></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3"><Stat label="Vehículos" value={num(product.policies)} /><Stat label="Clientes" value={num(product.clients)} /><Stat label="Prima neta" value={money(product.net)} /><Stat label="Prima total (inc. imp.)" value={money(product.total)} /><div className="col-span-2 border-t border-line pt-3"><Stat label="Comisión" value={money(product.commission)} /></div></dl></article>)}{!summary.products.length && <p className="glass-panel p-5 text-sm text-ink-subtle">No hay productos activos para este alcance.</p>}</div></section>

    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <ChartCard title="Vehículos emitidos por mes" subtitle="Pólizas emitidas en el período"><ColumnChart ariaLabel="Vehículos emitidos por mes" empty="Sin pólizas emitidas en el período." data={summary.monthly.map((month) => ({ label: monthLabel(month.month), sublabel: `Vehículos emitidos · ${monthLabel(month.month)}`, value: month.vehicles }))} /></ChartCard>
      <ChartCard title="Comisión por mes" subtitle={`Cuotas que vencen cada mes · total: ${money(current.commission)}`}><AreaChart ariaLabel="Comisión por mes" empty="Sin comisiones en el período." data={summary.monthly.map((month) => ({ label: monthLabel(month.month), sublabel: `Comisión · ${monthLabel(month.month)}`, value: month.commission }))} /></ChartCard>
      <ChartCard title="Participación por producto" subtitle="Vehículos emitidos en el período"><BarList showShare empty="Sin pólizas emitidas en el período." data={summary.products.filter((product) => product.vehicles).map((product) => ({ label: product.name, value: product.vehicles }))} /></ChartCard>
      <ChartCard title="Marcas más aseguradas" subtitle="Top 6 del período"><BarList empty="Sin pólizas emitidas en el período." data={summary.brands.map((brand) => ({ label: brand.brand, value: brand.vehicles }))} /></ChartCard>
      {isAllChannels && <ChartCard title="Comisión por canal" subtitle="Cuotas que vencen en el período seleccionado"><BarList format="currency" empty="Sin comisiones en el período." data={summary.channels.map((channel) => ({ label: channel.name, sublabel: `${num(channel.policies)} pólizas · prima neta ${money(channel.premium)}`, value: channel.commission }))} /></ChartCard>}
      <ChartCard title="Vencimientos de los próximos 12 meses" subtitle="Pólizas vigentes por mes de fin de vigencia — planifica las renovaciones" wide><ColumnChart ariaLabel="Vencimientos por mes" empty="Ninguna póliza vence en los próximos 12 meses." data={summary.expiringByMonth.map((month) => ({ label: monthLabel(month.month), sublabel: `Vencen · ${monthLabel(month.month)}`, value: month.vehicles }))} /></ChartCard>
    </section>

    <section id="vencimientos" className="glass-panel mt-4 scroll-mt-24 p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-bold"><CalendarClock className="size-4 text-brand-text" />Vehículos próximos a vencer</h2><p className="mt-1 text-xs text-ink-subtle">Pólizas vigentes cuyo fin de vigencia está entre {day(filters.expiry.from)} y {day(filters.expiry.to)}.</p></div><RangePicker key={`v-${filters.expiryKey}-${filters.expiry.from}-${filters.expiry.to}`} basePath="/aseguradora" label="Vencen" options={EXPIRY_OPTIONS} activeKey={filters.expiryKey} param="vence" fromParam="vdesde" toParam="vhasta" range={filters.expiry} preserve={{ ...filters.periodQs, ...scopeQuery }} anchor="#vencimientos" /></div><ExpiringTable rows={summary.expiring} showChannel /></section>
  </AdminPage>;
}

function CollectionChannelsTable({ rows }: { rows: CollectionChannel[] }) {
  if (!rows.length) return <p className="rounded-xl border border-line bg-surface-muted px-4 py-6 text-center text-sm text-ink-muted">No hay cuotas para los canales seleccionados.</p>;
  return <div className="overflow-x-auto rounded-2xl border border-line"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-surface-muted text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-subtle"><tr>{["Canal", "Exigible", "Pagado", "Efectividad", "Mora a hoy", "Pólizas en mora"].map((heading) => <th key={heading} className="px-3 py-2.5">{heading}</th>)}</tr></thead><tbody className="divide-y divide-line bg-white">{rows.map((row) => <tr key={row.id}><td className="px-3 py-3 font-semibold text-ink">{row.name}</td><td className="px-3 py-3">{money(row.due)}</td><td className="px-3 py-3">{money(row.paid)}</td><td className="px-3 py-3"><span className="font-semibold text-brand-text">{percent(row.effectiveness)}</span></td><td className="px-3 py-3">{money(row.overdue)}</td><td className="px-3 py-3">{num(row.overduePolicies)}</td></tr>)}</tbody></table></div>;
}

function plural(count: number, one: string, many: string) {
  return `${num(count)} ${count === 1 ? one : many}`;
}

function percent(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 1 }).format(value);
}
