import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BadgeDollarSign, CalendarClock, CarFront, ChevronRight, CircleDollarSign, Download, FileClock, Minus, Package, Users, type LucideIcon } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { AreaChart, BarList, ColumnChart } from "@/components/channel/summary-charts";
import { monthLabel } from "@/lib/channel/month-label";
import { requireChannelUser } from "@/lib/auth/session";
import { EXPIRY_OPTIONS, PERIOD_OPTIONS, getSummary, parseSummaryFilters, type ExpiringPolicy } from "@/lib/channel/summary";
import { RangePicker } from "@/components/channel/range-picker";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Resumen del canal | Kuantix", robots: { index: false, follow: false } };

type SP = { desde?: string; hasta?: string; vence?: string; vdesde?: string; vhasta?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireChannelUser();
  const sp = await searchParams;
  const f = parseSummaryFilters(sp);
  const [{ data: canal }, data] = await Promise.all([
    createAdminClient().from("canal").select("nombre").eq("id", s.channelId!).single(),
    getSummary(s.channelId!, f.period, f.expiry),
  ]);
  const { current: k, previous: prev } = data;
  const download = `/canal/resumen/descargar?${new URLSearchParams({ ...f.periodQs, ...f.expiryQs }).toString()}`;
  const expiryLabel = f.expiryKey === "rango" ? `${day(f.expiry.from)} – ${day(f.expiry.to)}` : `Próximos ${f.expiryKey} días`;
  const totalVehicles = data.products.reduce((t, p) => t + p.vehicles, 0);

  return (
    <AdminPage
      eyebrow="Resumen del canal"
      title={`Canal ${canal?.nombre ?? "comercial"}`}
      description="Producción, comisiones y vencimientos de las pólizas emitidas por tu canal."
    >
      {/* Filtro del período */}
      <section className="glass-panel mt-7 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <RangePicker key={`p-${f.periodKey}-${f.period.from}-${f.period.to}`} label="Período" options={PERIOD_OPTIONS} activeKey={f.periodKey} param="periodo" fromParam="desde" toParam="hasta" range={f.period} preserve={f.expiryQs} />
          <a href={download} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-brand/50 bg-brand/10 px-5 text-sm font-bold text-ink hover:bg-brand/20">
            <Download className="size-4" />Descargar Excel
          </a>
        </div>
        <p className="mt-3 text-xs text-ink-subtle">Mostrando pólizas emitidas del <span className="font-semibold text-ink-muted">{day(f.period.from)}</span> al <span className="font-semibold text-ink-muted">{day(f.period.to)}</span>.</p>
      </section>

      {/* KPIs */}
      <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={CarFront} label="Vehículos emitidos" value={num(k.vehicles)} delta={delta(k.vehicles, prev.vehicles)} />
        <Kpi icon={Users} label="Clientes" value={num(k.clients)} delta={delta(k.clients, prev.clients)} hint={`${num(data.portfolioClients)} en la cartera`} />
        <Kpi icon={BadgeDollarSign} label="Comisión generada" value={money(k.commission)} delta={delta(k.commission, prev.commission)} accent />
        <Kpi icon={CircleDollarSign} label="Prima emitida" value={money(k.premium)} delta={delta(k.premium, prev.premium)} />
        <Kpi icon={FileClock} label="Órdenes pendientes" value={num(data.pendingOrders)} hint="Por emitir (hoy)" href="/canal/cotizaciones" />
        <Kpi icon={CalendarClock} label="Próximos a vencer" value={num(data.expiring.length)} hint={expiryLabel} href="#vencimientos" tone={data.expiring.length ? "warn" : undefined} />
      </section>

      {/* Productos */}
      <section className="mt-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Package className="size-4 text-brand-text" />Productos</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.products.map((p) => (
            <article key={p.id} className="glass-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{p.name}</p>
                  <p className="text-xs text-ink-subtle">{p.insurer}</p>
                </div>
                <span className="shrink-0 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[11px] font-bold text-ink-muted">{totalVehicles ? Math.round((p.vehicles / totalVehicles) * 100) : 0} %</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand/10"><div className="h-full rounded-full bg-brand-text" style={{ width: `${totalVehicles ? (p.vehicles / totalVehicles) * 100 : 0}%` }} /></div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <Stat label="Vehículos" value={num(p.vehicles)} />
                <Stat label="Clientes" value={num(p.clients)} />
                <Stat label="Prima emitida" value={money(p.premium)} />
                <Stat label="Comisión" value={money(p.commission)} />
              </dl>
            </article>
          ))}
          {!data.products.length && <p className="glass-panel p-5 text-sm text-ink-subtle">Tu canal no tiene productos.</p>}
        </div>
      </section>

      {/* Gráficos */}
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Vehículos emitidos por mes" subtitle="Pólizas emitidas en el período">
          <ColumnChart ariaLabel="Vehículos emitidos por mes" empty="Sin pólizas emitidas en el período." data={data.monthly.map((m) => ({ label: monthLabel(m.month), sublabel: `Vehículos emitidos · ${monthLabel(m.month)}`, value: m.vehicles }))} />
        </ChartCard>
        <ChartCard title="Comisión generada por mes" subtitle={`Total del período: ${money(k.commission)}`}>
          <AreaChart ariaLabel="Comisión generada por mes" empty="Sin comisiones en el período." data={data.monthly.map((m) => ({ label: monthLabel(m.month), sublabel: `Comisión · ${monthLabel(m.month)}`, value: m.commission }))} />
        </ChartCard>
        <ChartCard title="Participación por producto" subtitle="Vehículos emitidos en el período">
          <BarList showShare empty="Sin pólizas emitidas en el período." data={data.products.filter((p) => p.vehicles).map((p) => ({ label: p.name, value: p.vehicles }))} />
        </ChartCard>
        <ChartCard title="Marcas más aseguradas" subtitle="Top 6 del período">
          <BarList empty="Sin pólizas emitidas en el período." data={data.brands.map((b) => ({ label: b.brand, value: b.vehicles }))} />
        </ChartCard>
        <ChartCard title="Vencimientos de los próximos 12 meses" subtitle="Pólizas vigentes por mes de fin de vigencia — planifica las renovaciones" wide>
          <ColumnChart ariaLabel="Vencimientos por mes" empty="Ninguna póliza vence en los próximos 12 meses." data={data.expiringByMonth.map((m) => ({ label: monthLabel(m.month), sublabel: `Vencen · ${monthLabel(m.month)}`, value: m.vehicles }))} />
        </ChartCard>
      </section>

      {/* Próximos a vencer */}
      <section id="vencimientos" className="glass-panel mt-4 scroll-mt-24 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold"><CalendarClock className="size-4 text-brand-text" />Vehículos próximos a vencer</h2>
            <p className="mt-1 text-xs text-ink-subtle">Pólizas vigentes cuyo fin de vigencia está entre {day(f.expiry.from)} y {day(f.expiry.to)}.</p>
          </div>
          <RangePicker key={`v-${f.expiryKey}-${f.expiry.from}-${f.expiry.to}`} label="Vencen" options={EXPIRY_OPTIONS} activeKey={f.expiryKey} param="vence" fromParam="vdesde" toParam="vhasta" range={f.expiry} preserve={f.periodQs} anchor="#vencimientos" />
        </div>
        <ExpiringTable rows={data.expiring} />
      </section>
    </AdminPage>
  );
}

function ExpiringTable({ rows }: { rows: ExpiringPolicy[] }) {
  if (!rows.length) {
    return <p className="mt-4 rounded-xl border border-line bg-surface-muted px-4 py-6 text-center text-sm text-ink-muted">Ningún vehículo vence en esta ventana.</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[820px] text-left text-xs">
        <thead className="bg-surface-muted text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-subtle">
          <tr>{["Cliente", "Contacto", "Vehículo", "Placa", "Producto", "Póliza", "Fin de vigencia", "Días", ""].map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">
          {rows.map((r) => (
            <tr key={r.quoteId}>
              <td className="px-3 py-2.5"><p className="font-semibold text-ink">{r.client}</p><p className="text-ink-subtle">{r.identification}</p></td>
              <td className="px-3 py-2.5 text-ink-muted"><p>{r.phone ?? "—"}</p><p className="truncate">{r.email ?? ""}</p></td>
              <td className="px-3 py-2.5 text-ink-muted">{r.brand} {r.model}</td>
              <td className="px-3 py-2.5 font-semibold uppercase tracking-wider">{r.plate ?? "—"}</td>
              <td className="px-3 py-2.5 text-ink-muted">{r.product}</td>
              <td className="px-3 py-2.5 text-ink-muted">{r.policy}</td>
              <td className="px-3 py-2.5 font-semibold">{day(r.end)}</td>
              <td className="px-3 py-2.5"><DaysPill days={r.days} /></td>
              <td className="px-3 py-2.5 text-right">
                <Link href={`/canal/clientes/${r.quoteId}`} aria-label={`Ver detalle de ${r.client}`} className="inline-flex size-8 items-center justify-center rounded-full border border-line text-ink-subtle hover:bg-brand/10 hover:text-brand-text"><ChevronRight className="size-4" /></Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DaysPill({ days }: { days: number }) {
  const cls = days <= 15 ? "border-red-200 bg-red-50 text-red-700" : days <= 30 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-line bg-surface-muted text-ink-muted";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>{days === 0 ? "Hoy" : `${days} ${days === 1 ? "día" : "días"}`}</span>;
}

function Kpi({ icon: Icon, label, value, delta, hint, href, accent, tone }: { icon: LucideIcon; label: string; value: string; delta?: number | null; hint?: string; href?: string; accent?: boolean; tone?: "warn" }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className={`flex size-8 items-center justify-center rounded-lg ${tone === "warn" ? "bg-amber-50 text-amber-700" : "bg-brand/10 text-brand-text"}`}><Icon className="size-4" /></span>
        {delta !== undefined && <Delta value={delta} />}
      </div>
      <p className="mt-4 truncate text-xl font-bold tracking-[-0.03em] text-ink sm:text-2xl" title={value}>{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle">{label}</p>
      {hint && <p className="mt-1 truncate text-[11px] text-ink-muted">{hint}</p>}
    </>
  );
  const cls = `glass-panel block min-w-0 p-4 ${accent ? "ring-1 ring-brand/40" : ""} ${href ? "transition-shadow hover:shadow-[0_14px_34px_rgba(23,50,80,0.1)]" : ""}`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <article className={cls}>{body}</article>;
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[10px] text-ink-subtle" title="Sin datos en el período anterior">—</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const cls = value > 0 ? "text-emerald-700" : value < 0 ? "text-red-600" : "text-ink-subtle";
  return <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${cls}`} title="Frente al período anterior de la misma duración"><Icon className="size-3.5" />{Math.abs(value)} %</span>;
}

function ChartCard({ title, subtitle, wide, children }: { title: string; subtitle: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <article className={`glass-panel p-5 sm:p-6 ${wide ? "lg:col-span-2" : ""}`}>
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle">{label}</dt><dd className="truncate text-sm font-bold text-ink">{value}</dd></div>;
}



function delta(cur: number, prev: number) {
  if (!prev) return cur ? null : 0;
  return Math.round(((cur - prev) / prev) * 100);
}
function day(v: string) {
  const [y, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function num(v: number) {
  return new Intl.NumberFormat("es-EC").format(v);
}
function money(v: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(v);
}
