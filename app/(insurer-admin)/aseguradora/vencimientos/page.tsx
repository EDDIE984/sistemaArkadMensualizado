import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CalendarX2, ChevronRight, Download, Hourglass, ShieldAlert, TriangleAlert } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { ColumnChart } from "@/components/channel/summary-charts";
import { SummaryScopeFilter } from "@/components/insurer/summary-scope-filter";
import { ChartCard, DaysPill, Kpi, money, num } from "@/components/summary/summary-ui";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { monthLabel } from "@/lib/channel/month-label";
import { addDays, expirationsQuery, getExpirations, readExpirationFilters, type ExpirationFilters, type ExpirationRow } from "@/lib/insurer/expirations";
import { resolveInsurerSummaryScope } from "@/lib/insurer/summary-scope";

export const metadata: Metadata = { title: "Vencimientos | Kuantix", robots: { index: false, follow: false } };

const PAGE_SIZE = 50;
const label = "text-[10px] font-bold uppercase tracking-wider text-ink-subtle";
const control = "min-h-11 min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none focus:border-brand/60 [color-scheme:light]";
type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireInsurerAdmin();
  const params = await searchParams;
  const { filters, valid, today } = readExpirationFilters((key) => one(params[key]));
  const scopeData = await resolveInsurerSummaryScope(session.insurerId!, { canal: params.canal, productos: params.productos });
  const { selectedChannelId: channelId, selectedProductIds: productIds } = scopeData;
  const { summary, months, rows, page } = await getExpirations({ ...scopeData.scope, insurerId: session.insurerId! }, filters, Number(one(params.page)) || 1, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(summary.total / PAGE_SIZE));
  const href = (f: ExpirationFilters, extra: Record<string, string> = {}) => `/aseguradora/vencimientos?${expirationsQuery(f, channelId, productIds, extra)}`;
  const presets: [string, ExpirationFilters][] = [
    ["Próximos 30 días", { ...filters, from: today, to: addDays(today, 30) }],
    ["Próximos 60 días", { ...filters, from: today, to: addDays(today, 60) }],
    ["Próximos 90 días", { ...filters, from: today, to: addDays(today, 90) }],
    ["Vencidas (últimos 90 días)", { ...filters, from: addDays(today, -90), to: addDays(today, -1) }],
  ];

  return <AdminPage eyebrow="Renovaciones" title="Vencimientos" description="Pólizas cuyo fin de vigencia cae en el rango elegido, para gestionar a tiempo su renovación.">
    <section className="glass-panel mt-7 p-4 sm:p-5">
      <SummaryScopeFilter key={`${channelId ?? "all"}-${productIds.join("-")}`} basePath="/aseguradora/vencimientos" channels={scopeData.channels} products={scopeData.products} selectedChannelId={channelId} selectedProductIds={productIds} preserve={{}}>
        <label className="grid gap-1.5"><span className={label}>Vence desde</span><input type="date" name="desde" defaultValue={filters.from} required className={control} /></label>
        <label className="grid gap-1.5"><span className={label}>Vence hasta</span><input type="date" name="hasta" defaultValue={filters.to} required className={control} /></label>
        <label className="grid gap-1.5 xl:col-span-2"><span className={label}>Buscar</span><input name="q" defaultValue={filters.q} maxLength={100} placeholder="Cliente, cédula, placa, póliza" className={control} /></label>
      </SummaryScopeFilter>
      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className={label}>Rápido</span>
          {presets.map(([text, f]) => {
            const on = f.from === filters.from && f.to === filters.to;
            return <Link key={text} href={href(f)} className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-xs font-bold ${on ? "border-brand/50 bg-brand/10 text-ink" : "border-line text-ink-muted hover:text-ink"}`}>{text}</Link>;
          })}
        </div>
        <a href={`/aseguradora/vencimientos/descargar?${expirationsQuery(filters, channelId, productIds)}`} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full border border-brand/50 bg-brand/10 px-5 text-sm font-bold text-ink hover:bg-brand/20"><Download className="size-4" />Descargar Excel</a>
      </div>
      <p className="mt-3 text-xs text-ink-subtle">Pólizas vigentes o vencidas (sin las canceladas) con fin de vigencia entre el <span className="font-semibold text-ink-muted">{day(filters.from)}</span> y el <span className="font-semibold text-ink-muted">{day(filters.to)}</span>.</p>
    </section>
    {!valid && <p role="alert" className="mt-4 text-sm text-red-700">Revisa las fechas: la fecha desde debe ser anterior o igual a la fecha hasta. Se muestran los próximos 90 días.</p>}

    <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi icon={CalendarClock} label="Pólizas" value={num(summary.total)} hint="Vencen en el rango" accent />
      <Kpi icon={ShieldAlert} label="En 15 días o menos" value={num(summary.within15)} hint="Desde hoy" tone={summary.within15 ? "warn" : undefined} />
      <Kpi icon={Hourglass} label="De 16 a 30 días" value={num(summary.within30)} hint="Desde hoy" />
      <Kpi icon={CalendarX2} label="Ya vencidas" value={num(summary.expired)} hint="Fin de vigencia antes de hoy" />
      <Kpi icon={TriangleAlert} label="Con cuotas vencidas" value={num(summary.withOverdue)} hint="Revisar antes de renovar" tone={summary.withOverdue ? "warn" : undefined} />
    </section>

    {months.length > 1 && <div className="mt-4"><ChartCard title="Vencimientos por mes" subtitle="Pólizas por mes de fin de vigencia dentro del rango"><ColumnChart ariaLabel="Vencimientos por mes" empty="Ninguna póliza vence en el rango." data={months.map((m) => ({ label: monthLabel(m.month), sublabel: `Vencen · ${monthLabel(m.month)}`, value: m.policies }))} /></ChartCard></div>}

    <section className="glass-panel mt-4 overflow-hidden">
      {!rows.length ? <p className="px-6 py-14 text-center text-sm text-ink-muted">Ninguna póliza vence en este rango con los filtros elegidos.</p> : <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-xs">
          <thead className="bg-surface-muted text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-subtle"><tr>{["Cliente", "Contacto", "Vehículo", "Producto / canal", "Póliza", "Fin de vigencia", "Días", "Cuota mensual", "Cuotas vencidas", ""].map((h, i) => <th key={i} className="px-3 py-2.5">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line bg-white">{rows.map((r) => <Row key={r.quoteId} row={r} back={expirationsQuery(filters, channelId, productIds, page > 1 ? { page: String(page) } : {})} />)}</tbody>
        </table>
      </div>}
    </section>

    <nav aria-label="Páginas de vencimientos" className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-muted">
      <p>{summary.total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, summary.total)} de ${summary.total} pólizas` : "0 pólizas"} · Página {page} de {pages}</p>
      <div className="flex gap-3">
        {page > 1 && <Link className="flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:bg-white" href={href(filters, { page: String(page - 1) })}>Anterior</Link>}
        {page < pages && <Link className="flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:bg-white" href={href(filters, { page: String(page + 1) })}>Siguiente</Link>}
      </div>
    </nav>
  </AdminPage>;
}

function Row({ row: r, back }: { row: ExpirationRow; back: string }) {
  const detail = `/aseguradora/polizas/${r.quoteId}?volver=${encodeURIComponent(back)}`;
  return <tr>
    <td className="px-3 py-2.5"><Link href={detail} className="font-semibold text-ink hover:text-brand-text">{r.client}</Link><p className="text-ink-subtle">{r.identification ?? "Sin identificación"}</p></td>
    <td className="px-3 py-2.5 text-ink-muted"><p>{r.phone ?? "—"}</p><p className="max-w-48 truncate">{r.email ?? ""}</p></td>
    <td className="px-3 py-2.5 text-ink-muted"><p>{[r.brand, r.model, r.year].filter(Boolean).join(" ")}</p><p className="font-semibold uppercase tracking-wider text-ink">{r.plate ?? "Sin placa"}</p></td>
    <td className="px-3 py-2.5 text-ink-muted"><p>{r.product}</p><p className="text-ink-subtle">{r.channel ?? "—"}</p></td>
    <td className="px-3 py-2.5 text-ink-muted">{r.policy}</td>
    <td className="px-3 py-2.5 font-semibold">{day(r.end)}</td>
    <td className="px-3 py-2.5"><DaysPill days={r.days} /></td>
    <td className="px-3 py-2.5 font-semibold tabular-nums">{money(r.monthly)}</td>
    <td className="px-3 py-2.5">{r.overdue ? <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">{r.overdue}</span> : <span className="text-ink-subtle">0</span>}</td>
    <td className="px-3 py-2.5 text-right"><Link href={detail} aria-label={`Ver detalle de ${r.client}`} className="inline-flex size-8 items-center justify-center rounded-full border border-line text-ink-subtle hover:bg-brand/10 hover:text-brand-text"><ChevronRight className="size-4" /></Link></td>
  </tr>;
}

function day(v: string) {
  const [y, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
