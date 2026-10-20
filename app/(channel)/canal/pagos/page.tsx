import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { PaymentsTable } from "@/components/channel/payments-table";
import { requireChannelUser } from "@/lib/auth/session";
import { dateOnly } from "@/lib/channel/schemas";
import { getDbPool } from "@/lib/db/pool";
import { blockedSql, payableSql, paymentScope } from "@/lib/payments/queries";
import { paymentFiltersSchema, type PaymentRow, type PaymentSummary } from "@/lib/payments/types";

export const metadata: Metadata = { title: "Pagos del canal | Kuantiq", robots: { index: false, follow: false } };
const PAGE_SIZE = 50;
const field = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand";
type Params = { from?: string; to?: string; products?: string | string[]; status?: string; page?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireChannelUser();
  const params = await searchParams;
  const today = dateOnly(new Date());
  const first = `${today.slice(0, 7)}-01`;
  const last = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const parsed = paymentFiltersSchema.safeParse({ from: params.from ?? first, to: params.to ?? last,
    products: params.products ? (Array.isArray(params.products) ? params.products : [params.products]) : [], status: params.status ?? "POR_COBRAR" });
  const products = await getDbPool().query<{ id: string; nombre: string }>(
    `select p.id, p.nombre from producto p where p.aseguradora_id = $2 and
      (p.canal_id = $1 or exists (select 1 from cotizacion c where c.producto_id = p.id and c.canal_id = $1 and c.aseguradora_id = $2)) order by p.nombre`,
    [session.channelId, session.insurerId],
  );
  const filters = parsed.success ? parsed.data : { from: first, to: last, products: [], status: "POR_COBRAR" as const };
  const scope = paymentScope(session.channelId!, session.insurerId!, filters, today);
  let summary: PaymentSummary = { total: 0, payable: 0, balance: "0", blocked: 0, max_issued: null };
  let rows: PaymentRow[] = [];
  let page = 1;
  if (parsed.success) {
    const totals = await getDbPool().query<PaymentSummary>(
      `select count(*)::int as total,
        count(*) filter (where ${payableSql})::int as payable,
        coalesce(sum(t.monto - payments.paid) filter (where ${payableSql}),0)::text as balance,
        count(*) filter (where t.estado in ('PENDIENTE','VENCIDO') and t.monto > payments.paid and ${blockedSql})::int as blocked,
        (max(po.fecha_emision) filter (where ${payableSql}))::text as max_issued ${scope.from}`, scope.values,
    );
    summary = totals.rows[0];
    page = Math.min(Math.max(1, Number.isSafeInteger(Number(params.page)) ? Number(params.page) : 1), Math.max(1, Math.ceil(summary.total / PAGE_SIZE)));
    const result = await getDbPool().query<PaymentRow>(
      `select t.id, po.id as policy_id, po.numero_poliza as policy, po.fecha_emision::text as issued, cl.nombre_razon_social as client, cl.identificacion as identification,
        v.placa as plate, p.nombre as product, t.numero_cuota as installment, t.fecha_vencimiento::text as due,
        t.monto::text as amount, greatest(t.monto - payments.paid,0)::text as balance,
        case when t.estado = 'PAGADO' then 'PAGADO' when t.fecha_vencimiento < $6::date then 'VENCIDO' else 'PENDIENTE' end as status,
        (select max(pa.fecha_pago)::text from pago pa where pa.cobranza_id = t.id and pa.estado = 'REGISTRADO') as paid_on,
        (select pa.metodo_pago from pago pa where pa.cobranza_id = t.id and pa.estado = 'REGISTRADO' order by pa.fecha_pago desc, pa.id desc limit 1) as method,
        (select pa.referencia from pago pa where pa.cobranza_id = t.id and pa.estado = 'REGISTRADO' order by pa.fecha_pago desc, pa.id desc limit 1) as reference,
        (select u.nombre from pago pa left join usuario u on u.id = pa.usuario_registro_id where pa.cobranza_id = t.id and pa.estado = 'REGISTRADO' order by pa.fecha_pago desc, pa.id desc limit 1) as registered_by,
        (select min(tn.numero_cuota) from tabla_cobranza tn where tn.poliza_id = t.poliza_id and tn.estado in ('PENDIENTE','VENCIDO')) as next_pending,
        ${blockedSql} as blocked,
        (count(*) filter (where ${payableSql}) over tail)::int as tail_count,
        coalesce(sum(t.monto - payments.paid) filter (where ${payableSql}) over tail, 0)::text as tail_balance
       ${scope.from}
       window tail as (partition by t.poliza_id order by t.numero_cuota desc) order by t.fecha_vencimiento, po.numero_poliza, t.id limit ${PAGE_SIZE} offset $8`, [...scope.values, (page - 1) * PAGE_SIZE],
    );
    rows = result.rows;
  }
  function pageHref(target: number) {
    const query = new URLSearchParams({ from: filters.from, to: filters.to, status: filters.status, page: String(target) });
    filters.products.forEach((id) => query.append("products", id));
    return `/canal/pagos?${query}`;
  }
  return <AdminPage eyebrow="Cobranzas del canal" title="Pagos" description="Consulta las cuotas por mes de vencimiento y registra el pago de una o varias. Cada pago se aplica únicamente a las cuotas seleccionadas.">
    <form action="/canal/pagos" className="glass-panel mt-7 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_1fr_auto] lg:items-end">
      <label className="grid gap-2 text-xs font-semibold">Vencimiento desde<input className={field} type="date" name="from" defaultValue={params.from ?? first} required /></label>
      <label className="grid gap-2 text-xs font-semibold">Vencimiento hasta<input className={field} type="date" name="to" defaultValue={params.to ?? last} required /></label>
      <fieldset className="min-w-0"><legend className="mb-2 text-xs font-semibold">Productos</legend><details className="relative"><summary className={`${field} flex cursor-pointer items-center justify-between gap-2`}><span>{filters.products.length ? `${filters.products.length} seleccionados` : "Todos los productos"}</span><span aria-hidden="true">⌄</span></summary><div className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-auto rounded-xl border border-line bg-white p-2 shadow-xl">{products.rows.map((p) => <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-surface-muted"><input type="checkbox" name="products" value={p.id} defaultChecked={filters.products.includes(p.id)} className="size-4 accent-ink" />{p.nombre}</label>)}{!products.rows.length && <p className="p-3 text-sm text-ink-muted">Sin productos disponibles.</p>}</div></details></fieldset>
      <label className="grid gap-2 text-xs font-semibold">Estado<select className={field} name="status" defaultValue={filters.status}><option value="POR_COBRAR">Por cobrar</option><option value="PENDIENTE">Pendientes</option><option value="VENCIDO">Vencidos</option><option value="PAGADO">Pagados</option><option value="TODOS">Todos</option></select></label>
      <div className="flex gap-2"><button className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white"><Search className="size-4" />Filtrar</button><Link href="/canal/pagos" className="flex min-h-11 items-center px-2 text-xs font-semibold text-ink-muted hover:text-ink">Limpiar</Link></div>
    </form>
    {!parsed.success ? <p role="alert" className="mt-5 text-sm text-red-700">Revisa el rango de fechas, los productos y el estado. La fecha desde debe ser anterior o igual a la fecha hasta.</p> : <>
      <PaymentsTable key={JSON.stringify(filters)} rows={rows} summary={summary} filters={filters} today={today} />
      <nav aria-label="Páginas de cuotas" className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-muted"><p>{summary.total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, summary.total)} de ${summary.total} cuotas` : "0 cuotas"} · Página {page} de {Math.max(1, Math.ceil(summary.total / PAGE_SIZE))}</p><div className="flex gap-3">{page > 1 && <Link className="flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:bg-white" href={pageHref(page - 1)}>Anterior</Link>}{page * PAGE_SIZE < summary.total && <Link className="flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:bg-white" href={pageHref(page + 1)}>Siguiente</Link>}</div></nav>
    </>}
  </AdminPage>;
}
