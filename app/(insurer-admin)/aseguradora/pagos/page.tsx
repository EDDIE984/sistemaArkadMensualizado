import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CircleDollarSign, Clock3, Download, ReceiptText } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { InsurerPaymentsTable } from "@/components/insurer/insurer-payments-table";
import { SummaryScopeFilter } from "@/components/insurer/summary-scope-filter";
import { Kpi, money, num } from "@/components/summary/summary-ui";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { dateOnly } from "@/lib/channel/schemas";
import { PAYMENT_METHODS, RECONCILIATION_OPTIONS, insurerPaymentFiltersSchema, paymentsQuery, type InsurerPaymentFilters } from "@/lib/insurer/payment-types";
import { getInsurerPayments } from "@/lib/insurer/payments";
import { resolveInsurerSummaryScope } from "@/lib/insurer/summary-scope";

export const metadata: Metadata = { title: "Pagos | Kuantix", robots: { index: false, follow: false } };

const PAGE_SIZE = 50;
const label = "text-[10px] font-bold uppercase tracking-wider text-ink-subtle";
const control = "min-h-11 min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none focus:border-brand/60 [color-scheme:light]";
type Params = { canal?: string | string[]; productos?: string | string[]; desde?: string | string[]; hasta?: string | string[]; conciliacion?: string | string[]; metodo?: string | string[]; page?: string | string[] };
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireInsurerAdmin();
  const params = await searchParams;
  const today = dateOnly(new Date());
  const first = `${today.slice(0, 7)}-01`;
  const last = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const scopeData = await resolveInsurerSummaryScope(session.insurerId!, { canal: params.canal, productos: params.productos });
  const parsed = insurerPaymentFiltersSchema.safeParse({
    from: one(params.desde) ?? first, to: one(params.hasta) ?? last,
    channel: scopeData.selectedChannelId, products: scopeData.selectedProductIds,
    reconciliation: one(params.conciliacion) ?? "TODOS", method: one(params.metodo) ?? "TODOS",
  });
  const filters: InsurerPaymentFilters = parsed.success ? parsed.data
    : { from: first, to: last, channel: scopeData.selectedChannelId, products: scopeData.selectedProductIds, reconciliation: "TODOS", method: "TODOS" };
  const { summary, rows, page } = await getInsurerPayments({ ...scopeData.scope, insurerId: session.insurerId! }, filters, Number(one(params.page)) || 1, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(summary.total / PAGE_SIZE));

  return <AdminPage eyebrow="Cobranzas de los canales" title="Pagos" description="Pagos de cuotas que registraron tus canales. Concílialos cuando confirmes que recibiste el dinero y expórtalos a Excel.">
    <section className="glass-panel mt-7 p-4 sm:p-5">
      <SummaryScopeFilter key={`${filters.channel ?? "all"}-${filters.products.join("-")}`} basePath="/aseguradora/pagos" channels={scopeData.channels} products={scopeData.products} selectedChannelId={filters.channel} selectedProductIds={filters.products} preserve={{}}>
        <label className="grid gap-1.5"><span className={label}>Pago desde</span><input type="date" name="desde" defaultValue={filters.from} required className={control} /></label>
        <label className="grid gap-1.5"><span className={label}>Pago hasta</span><input type="date" name="hasta" defaultValue={filters.to} required className={control} /></label>
        <label className="grid gap-1.5"><span className={label}>Conciliación</span><select name="conciliacion" defaultValue={filters.reconciliation} className={control}>{RECONCILIATION_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
        <label className="grid gap-1.5"><span className={label}>Método</span><select name="metodo" defaultValue={filters.method} className={control}><option value="TODOS">Todos</option>{PAYMENT_METHODS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
      </SummaryScopeFilter>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-ink-subtle">Pagos con fecha de pago entre el <span className="font-semibold text-ink-muted">{dayLabel(filters.from)}</span> y el <span className="font-semibold text-ink-muted">{dayLabel(filters.to)}</span>.</p>
        <a href={`/aseguradora/pagos/descargar?${paymentsQuery(filters)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-brand/50 bg-brand/10 px-5 text-sm font-bold text-ink hover:bg-brand/20"><Download className="size-4" />Descargar Excel</a>
      </div>
    </section>
    {!parsed.success && <p role="alert" className="mt-4 text-sm text-red-700">Revisa las fechas: la fecha desde debe ser anterior o igual a la fecha hasta. Se muestra el mes en curso.</p>}

    <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi icon={ReceiptText} label="Pagos" value={num(summary.total)} hint="Cuotas pagadas en el filtro" />
      <Kpi icon={CircleDollarSign} label="Monto total" value={money(summary.amount)} hint="Suma de los pagos del filtro" accent />
      <Kpi icon={BadgeCheck} label="Conciliado" value={money(summary.reconciledAmount)} hint={`${num(summary.reconciled)} ${summary.reconciled === 1 ? "pago" : "pagos"}`} />
      <Kpi icon={Clock3} label="Por conciliar" value={money(summary.pendingAmount)} hint={`${num(summary.pending)} ${summary.pending === 1 ? "pago" : "pagos"}`} tone={summary.pending ? "warn" : undefined} />
    </section>

    <InsurerPaymentsTable key={JSON.stringify(filters)} rows={rows} summary={summary} filters={filters} />
    <nav aria-label="Páginas de pagos" className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-muted">
      <p>{summary.total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, summary.total)} de ${summary.total} pagos` : "0 pagos"} · Página {page} de {pages}</p>
      <div className="flex gap-3">
        {page > 1 && <Link className="flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:bg-white" href={`/aseguradora/pagos?${paymentsQuery(filters, { page: String(page - 1) })}`}>Anterior</Link>}
        {page < pages && <Link className="flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:bg-white" href={`/aseguradora/pagos?${paymentsQuery(filters, { page: String(page + 1) })}`}>Siguiente</Link>}
      </div>
    </nav>
  </AdminPage>;
}

function dayLabel(value: string) {
  return value.split("-").reverse().join("/");
}
