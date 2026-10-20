import type { Metadata } from "next";
import { BadgeDollarSign, CalendarClock, CarFront, CircleDollarSign, Download, FileClock, Package, Users, Wallet } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { AreaChart, BarList, ColumnChart } from "@/components/channel/summary-charts";
import { RangePicker } from "@/components/channel/range-picker";
import { ChartCard, ExpiringTable, Kpi, Stat, day, delta, money, num } from "@/components/summary/summary-ui";
import { monthLabel } from "@/lib/channel/month-label";
import { requireChannelUser } from "@/lib/auth/session";
import { EXPIRY_OPTIONS, PERIOD_OPTIONS, getSummary, parseSummaryFilters } from "@/lib/channel/summary";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Resumen del canal | Kuantiq", robots: { index: false, follow: false } };

type SearchParams = { periodo?: string; desde?: string; hasta?: string; vence?: string; vdesde?: string; vhasta?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireChannelUser();
  const filters = parseSummaryFilters(await searchParams);
  const scope = { insurerId: null, channelId: session.channelId!, productIds: [] };
  const [{ data: channel }, data] = await Promise.all([
    createAdminClient().from("canal").select("nombre").eq("id", session.channelId!).single(),
    getSummary(scope, filters.period, filters.expiry),
  ]);
  const { current, previous } = data;
  const download = `/canal/resumen/descargar?${new URLSearchParams({ ...filters.periodQs, ...filters.expiryQs }).toString()}`;
  const expiryLabel = filters.expiryKey === "rango" ? `${day(filters.expiry.from)} – ${day(filters.expiry.to)}` : `Próximos ${filters.expiryKey} días`;
  const totalNet = data.products.reduce((total, product) => total + product.net, 0);

  return <AdminPage eyebrow="Resumen del canal" title={`Canal ${channel?.nombre ?? "comercial"}`} description="Producción, comisiones y vencimientos de las pólizas de tu canal.">
    <section className="glass-panel mt-7 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <RangePicker key={`p-${filters.periodKey}-${filters.period.from}-${filters.period.to}`} label="Período" options={PERIOD_OPTIONS} activeKey={filters.periodKey} param="periodo" fromParam="desde" toParam="hasta" range={filters.period} preserve={filters.expiryQs} />
        <a href={download} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-brand/50 bg-brand/10 px-5 text-sm font-bold text-ink hover:bg-brand/20"><Download className="size-4" />Descargar Excel</a>
      </div>
      <p className="mt-3 text-xs text-ink-subtle">Del <span className="font-semibold text-ink-muted">{day(filters.period.from)}</span> al <span className="font-semibold text-ink-muted">{day(filters.period.to)}</span>: vehículos y clientes emitidos; prima y comisión de las cuotas de tu cartera que vencen en esas fechas.</p>
    </section>

    <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
      <Kpi icon={CarFront} label="Vehículos emitidos" value={num(current.vehicles)} delta={delta(current.vehicles, previous.vehicles)} />
      <Kpi icon={Users} label="Clientes" value={num(current.clients)} delta={delta(current.clients, previous.clients)} hint={`${num(data.portfolioClients)} en la cartera`} />
      <Kpi icon={BadgeDollarSign} label="Comisión del período" value={money(current.commission)} delta={delta(current.commission, previous.commission)} accent />
      <Kpi icon={Wallet} label="Comisiones futuras" value={money(data.futureCommission)} hint={`Cuotas por vencer de ${num(data.futurePolicies)} ${data.futurePolicies === 1 ? "póliza" : "pólizas"}`} />
      <Kpi icon={CircleDollarSign} label="Prima neta del período" value={money(current.premium)} delta={delta(current.premium, previous.premium)} />
      <Kpi icon={FileClock} label="Órdenes pendientes" value={num(data.pendingOrders)} hint="Por emitir (hoy)" href="/canal/cotizaciones" />
      <Kpi icon={CalendarClock} label="Próximos a vencer" value={num(data.expiring.length)} hint={expiryLabel} href="#vencimientos" tone={data.expiring.length ? "warn" : undefined} />
    </section>

    <section className="mt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h2 className="flex items-center gap-2 text-sm font-bold"><Package className="size-4 text-brand-text" />Producción por producto</h2><p className="text-xs text-ink-subtle">Cuotas de tu cartera que vencen en el período seleccionado</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.products.map((product) => <article key={product.id} className="glass-panel p-5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{product.name}</p><p className="text-xs text-ink-subtle">{product.insurer}</p></div><span className="shrink-0 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[11px] font-bold text-ink-muted">{totalNet ? Math.round((product.net / totalNet) * 100) : 0} %</span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand/10"><div className="h-full rounded-full bg-brand-text" style={{ width: `${totalNet ? (product.net / totalNet) * 100 : 0}%` }} /></div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3"><Stat label="Vehículos" value={num(product.policies)} /><Stat label="Clientes" value={num(product.clients)} /><Stat label="Prima neta" value={money(product.net)} /><Stat label="Prima total (inc. imp.)" value={money(product.total)} /><div className="col-span-2 border-t border-line pt-3"><Stat label="Comisión" value={money(product.commission)} /></div></dl>
        </article>)}
        {!data.products.length && <p className="glass-panel p-5 text-sm text-ink-subtle">Tu canal no tiene productos.</p>}
      </div>
    </section>

    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <ChartCard title="Vehículos emitidos por mes" subtitle="Pólizas emitidas en el período"><ColumnChart ariaLabel="Vehículos emitidos por mes" empty="Sin pólizas emitidas en el período." data={data.monthly.map((month) => ({ label: monthLabel(month.month), sublabel: `Vehículos emitidos · ${monthLabel(month.month)}`, value: month.vehicles }))} /></ChartCard>
      <ChartCard title="Comisión por mes" subtitle={`Cuotas que vencen cada mes · total: ${money(current.commission)}`}><AreaChart ariaLabel="Comisión por mes" empty="Sin comisiones en el período." data={data.monthly.map((month) => ({ label: monthLabel(month.month), sublabel: `Comisión · ${monthLabel(month.month)}`, value: month.commission }))} /></ChartCard>
      <ChartCard title="Participación por producto" subtitle="Vehículos emitidos en el período"><BarList showShare empty="Sin pólizas emitidas en el período." data={data.products.filter((product) => product.vehicles).map((product) => ({ label: product.name, value: product.vehicles }))} /></ChartCard>
      <ChartCard title="Marcas más aseguradas" subtitle="Top 6 del período"><BarList empty="Sin pólizas emitidas en el período." data={data.brands.map((brand) => ({ label: brand.brand, value: brand.vehicles }))} /></ChartCard>
      <ChartCard title="Vencimientos de los próximos 12 meses" subtitle="Pólizas vigentes por mes de fin de vigencia — planifica las renovaciones" wide><ColumnChart ariaLabel="Vencimientos por mes" empty="Ninguna póliza vence en los próximos 12 meses." data={data.expiringByMonth.map((month) => ({ label: monthLabel(month.month), sublabel: `Vencen · ${monthLabel(month.month)}`, value: month.vehicles }))} /></ChartCard>
    </section>

    <section id="vencimientos" className="glass-panel mt-4 scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-bold"><CalendarClock className="size-4 text-brand-text" />Vehículos próximos a vencer</h2><p className="mt-1 text-xs text-ink-subtle">Pólizas vigentes cuyo fin de vigencia está entre {day(filters.expiry.from)} y {day(filters.expiry.to)}.</p></div><RangePicker key={`v-${filters.expiryKey}-${filters.expiry.from}-${filters.expiry.to}`} label="Vencen" options={EXPIRY_OPTIONS} activeKey={filters.expiryKey} param="vence" fromParam="vdesde" toParam="vhasta" range={filters.expiry} preserve={filters.periodQs} anchor="#vencimientos" /></div>
      <ExpiringTable rows={data.expiring} detailHref="/canal/clientes" />
    </section>
  </AdminPage>;
}
