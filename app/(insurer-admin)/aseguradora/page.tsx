import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgePercent, DollarSign, FileCheck2, FileText, HandCoins, Percent, TriangleAlert } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { ComparisonChart, StatusChart, TrendArea } from "@/components/insurer/dashboard-charts";
import { DashboardFilters, MONTHS } from "@/components/insurer/dashboard-filters";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDbPool } from "@/lib/db/pool";

export const metadata: Metadata = { title: "Administración de aseguradora | Arkad", robots: { index: false, follow: false } };

type KpiRow = {
  quotes: string; accepted: string; policies: string;
  commission_generated: string; commission_confirmed: string;
  billed: string; paid: string; overdue: string;
};
type SeriesRow = { label: string; quotes?: string; policies?: string; billed?: string; paid?: string; commission?: string };
type StatusRow = { label: string; value: string };

// Ecuador (UTC-5, sin horario de verano). Los indicadores de producción y comisiones
// se anclan a cotizacion.creado_en; la cobranza a tabla_cobranza.fecha_vencimiento.
const TZ = "America/Guayaquil";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ canal?: string; anio?: string; mes?: string }> }) {
  const session = await requireInsurerAdmin();
  const insurerId = session.insurerId!;
  const db = createAdminClient();
  const pool = getDbPool();

  const { data: canales = [] } = await db
    .from("canal").select("id,nombre").eq("aseguradora_id", insurerId).eq("activo", true).order("nombre");

  const sp = await searchParams;
  const canalId = (canales ?? []).some((c) => c.id === sp.canal) ? sp.canal! : null;
  const currentYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric" }).format(new Date()));
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  const year = yearOptions.includes(Number(sp.anio)) ? Number(sp.anio) : currentYear;
  const month = /^([1-9]|1[0-2])$/.test(sp.mes ?? "") ? Number(sp.mes) : null;

  const periodParams = [insurerId, canalId, year, month];
  const yearParams = [insurerId, canalId, year];

  const [insurer, kpis, statuses, commercialTrend, cobranzaTrend, commissionTrend, byChannel, recent] = await Promise.all([
    db.from("aseguradora").select("nombre_comercial").eq("id", insurerId).single(),
    pool.query<KpiRow>(`
      with base as (
        select c.id, c.estado
        from cotizacion c
        where c.aseguradora_id = $1
          and ($2::uuid is null or c.canal_id = $2)
          and extract(year  from c.creado_en at time zone '${TZ}') = $3
          and ($4::int is null or extract(month from c.creado_en at time zone '${TZ}') = $4)
      ),
      comm as (
        select coalesce(sum(am.comision_canal), 0) generated,
               coalesce(sum(am.comision_canal) filter (where b.estado = 'ACEPTADA'), 0) confirmed
        from base b join amortizacion_mensual am on am.cotizacion_id = b.id
      ),
      pol as (select count(*) n from poliza p join base b on b.id = p.cotizacion_id),
      pay as (select cobranza_id, sum(monto_pagado) filter (where estado = 'REGISTRADO') paid from pago group by cobranza_id),
      col as (
        select coalesce(sum(t.monto), 0) billed,
               coalesce(sum(pg.paid), 0) paid,
               coalesce(sum(t.monto) filter (where t.estado = 'VENCIDO'), 0) overdue
        from tabla_cobranza t
        join poliza p     on p.id = t.poliza_id
        join cotizacion c on c.id = p.cotizacion_id
        left join pay pg  on pg.cobranza_id = t.id
        where c.aseguradora_id = $1
          and ($2::uuid is null or c.canal_id = $2)
          and extract(year  from t.fecha_vencimiento) = $3
          and ($4::int is null or extract(month from t.fecha_vencimiento) = $4)
      )
      select (select count(*) from base)::text quotes,
             (select count(*) from base where estado = 'ACEPTADA')::text accepted,
             (select n from pol)::text policies,
             (select generated from comm)::text commission_generated,
             (select confirmed from comm)::text commission_confirmed,
             col.billed::text, col.paid::text, col.overdue::text
      from col
    `, periodParams),
    pool.query<StatusRow>(`
      select c.estado label, count(*)::text value
      from cotizacion c
      where c.aseguradora_id = $1
        and ($2::uuid is null or c.canal_id = $2)
        and extract(year  from c.creado_en at time zone '${TZ}') = $3
        and ($4::int is null or extract(month from c.creado_en at time zone '${TZ}') = $4)
      group by c.estado order by count(*) desc
    `, periodParams),
    pool.query<SeriesRow>(`
      with months as (select generate_series(make_date($3,1,1)::timestamp, make_date($3,12,1)::timestamp, interval '1 month') m),
      q as (
        select date_trunc('month', creado_en at time zone '${TZ}') m, count(*) n
        from cotizacion
        where aseguradora_id = $1 and ($2::uuid is null or canal_id = $2)
          and extract(year from creado_en at time zone '${TZ}') = $3
        group by 1
      ),
      p as (
        select date_trunc('month', po.fecha_emision)::timestamp m, count(*) n
        from poliza po join cotizacion c on c.id = po.cotizacion_id
        where c.aseguradora_id = $1 and ($2::uuid is null or c.canal_id = $2)
          and extract(year from po.fecha_emision) = $3
        group by 1
      )
      select to_char(months.m,'Mon') label, coalesce(q.n,0)::text quotes, coalesce(p.n,0)::text policies
      from months left join q using(m) left join p using(m)
      order by months.m
    `, yearParams),
    pool.query<SeriesRow>(`
      with months as (select generate_series(make_date($3,1,1)::timestamp, make_date($3,12,1)::timestamp, interval '1 month') m),
      payments as (select cobranza_id, sum(monto_pagado) filter (where estado = 'REGISTRADO') paid from pago group by cobranza_id),
      totals as (
        select date_trunc('month', t.fecha_vencimiento)::timestamp m, sum(t.monto) billed, sum(coalesce(pg.paid,0)) paid
        from tabla_cobranza t
        join poliza p     on p.id = t.poliza_id
        join cotizacion c on c.id = p.cotizacion_id
        left join payments pg on pg.cobranza_id = t.id
        where c.aseguradora_id = $1 and ($2::uuid is null or c.canal_id = $2)
          and extract(year from t.fecha_vencimiento) = $3
        group by 1
      )
      select to_char(months.m,'Mon') label, coalesce(totals.billed,0)::text billed, coalesce(totals.paid,0)::text paid
      from months left join totals using(m)
      order by months.m
    `, yearParams),
    pool.query<SeriesRow>(`
      with months as (select generate_series(make_date($3,1,1)::timestamp, make_date($3,12,1)::timestamp, interval '1 month') m),
      data as (
        select date_trunc('month', c.creado_en at time zone '${TZ}') m, sum(am.comision_canal) commission
        from amortizacion_mensual am
        join cotizacion c on c.id = am.cotizacion_id
        where c.aseguradora_id = $1 and ($2::uuid is null or c.canal_id = $2)
          and extract(year from c.creado_en at time zone '${TZ}') = $3
        group by 1
      )
      select to_char(months.m,'Mon') label, coalesce(data.commission,0)::text commission
      from months left join data using(m)
      order by months.m
    `, yearParams),
    canalId
      ? Promise.resolve({ rows: [] as StatusRow[] })
      : pool.query<StatusRow>(`
          select coalesce(ch.nombre, 'Autogestión') label, coalesce(sum(am.comision_canal), 0)::text value
          from amortizacion_mensual am
          join cotizacion c  on c.id = am.cotizacion_id
          left join canal ch on ch.id = c.canal_id
          where c.aseguradora_id = $1
            and extract(year  from c.creado_en at time zone '${TZ}') = $2
            and ($3::int is null or extract(month from c.creado_en at time zone '${TZ}') = $3)
          group by 1 order by 2 desc
        `, [insurerId, year, month]),
    recentQuotes(db, insurerId, canalId, year, month),
  ]);

  const k = kpis.rows[0] || { quotes: "0", accepted: "0", policies: "0", commission_generated: "0", commission_confirmed: "0", billed: "0", paid: "0", overdue: "0" };
  const quoteCount = Number(k.quotes);
  const policyCount = Number(k.policies);
  const billed = Number(k.billed);
  const paid = Number(k.paid);
  const commissionGenerated = Number(k.commission_generated);
  const commissionConfirmed = Number(k.commission_confirmed);

  const commercial = commercialTrend.rows.map((x) => ({ label: monthLabel(x.label), primary: Number(x.quotes ?? 0), secondary: Number(x.policies ?? 0) }));
  const collections = cobranzaTrend.rows.map((x) => ({ label: monthLabel(x.label), primary: Number(x.billed ?? 0), secondary: Number(x.paid ?? 0) }));
  const commissionSeries = commissionTrend.rows.map((x) => ({ label: x.label, value: Number(x.commission ?? 0) }));

  const canalName = canalId ? (canales ?? []).find((c) => c.id === canalId)?.nombre ?? null : null;
  const monthName = month ? MONTHS.find(([v]) => v === month)?.[1] ?? null : null;
  const periodLabel = `${monthName ? `${monthName} ` : ""}${year}${canalName ? ` · ${canalName}` : ""}`;

  return (
    <AdminPage
      eyebrow="Indicadores ejecutivos"
      title={insurer.data?.nombre_comercial || "Mi aseguradora"}
      description="Monitorea producción, conversión, comisiones del canal y cobranza de tu operación."
    >
      <DashboardFilters canales={canales ?? []} years={yearOptions} selected={{ canal: canalId, anio: year, mes: month }} />
      <p className="mt-3 text-xs text-white/40">
        Producción, conversión y comisiones corresponden a las cotizaciones creadas en el período; la cobranza se calcula por fecha de vencimiento.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<FileText />} label="Cotizaciones" value={quoteCount.toLocaleString("es-EC")} detail={`${Number(k.accepted)} aceptadas`} />
        <Metric icon={<FileCheck2 />} label="Pólizas emitidas" value={policyCount.toLocaleString("es-EC")} detail="De cotizaciones del período" />
        <Metric icon={<Percent />} label="Conversión" value={percentage(policyCount, quoteCount)} detail="Pólizas / cotizaciones" />
        <Metric icon={<DollarSign />} label="Eficiencia de cobro" value={percentage(paid, billed)} detail={`${money(paid)} recaudado`} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.6fr]">
        <div className="glass-panel grid content-start gap-3 p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/60">Comisiones del canal</p>
            <h2 className="mt-2 text-lg font-bold">{periodLabel}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <CommissionTile icon={<HandCoins />} label="Comisión generada" value={money(commissionGenerated)} detail="Programada en la amortización" />
            <CommissionTile icon={<BadgePercent />} label="Comisión confirmada" value={money(commissionConfirmed)} detail="Cotizaciones aceptadas" />
          </div>
        </div>
        <ChartPanel title="Comisiones del canal por mes" description={`Año ${year}${canalName ? ` · ${canalName}` : ""}`}>
          <TrendArea data={commissionSeries} format="currency" />
        </ChartPanel>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Cotizaciones vs. emisiones" description={`Meses de ${year}`}>
          <ComparisonChart data={commercial} primaryLabel="Cotizaciones" secondaryLabel="Pólizas emitidas" />
        </ChartPanel>
        <ChartPanel title="Cobranza mensual" description="Facturado frente a efectivamente cobrado">
          <ComparisonChart data={collections} primaryLabel="Facturado" secondaryLabel="Cobrado" format="currency" />
        </ChartPanel>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.35fr]">
        <ChartPanel title="Estado de cotizaciones" description="Distribución del embudo comercial">
          <StatusChart data={statuses.rows.map((x) => ({ label: x.label, value: Number(x.value) }))} />
        </ChartPanel>
        <div className="glass-panel grid gap-5 p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/60">Atención de cartera</p>
            <h2 className="mt-2 text-lg font-bold">Resumen de cobranza</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <CollectionMetric label="Facturado" value={money(billed)} />
            <CollectionMetric label="Cobrado" value={money(paid)} />
            <CollectionMetric label="Vencido" value={money(Number(k.overdue))} alert={Number(k.overdue) > 0} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="font-semibold text-white/55">Avance de recaudación</span>
              <span className="font-bold text-cyan-100">{percentage(paid, billed)}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, billed ? (paid / billed) * 100 : 0)}%` }} />
            </div>
          </div>
        </div>
      </section>

      {!canalId && byChannel.rows.length > 1 && (
        <section className="mt-4">
          <ChartPanel title="Comisión por canal" description={`Distribución ${monthName ? `de ${monthName} ` : ""}${year}`}>
            <StatusChart data={byChannel.rows.map((x) => ({ label: x.label, value: Number(x.value) }))} format="currency" />
          </ChartPanel>
        </section>
      )}

      <section className="glass-panel mt-4 overflow-hidden">
        <header className="flex items-center justify-between border-b border-white/10 p-5 sm:p-6">
          <div>
            <h2 className="font-bold">Cotizaciones recientes</h2>
            <p className="mt-1 text-xs text-white/45">{periodLabel}</p>
          </div>
          <Link href="/aseguradora/operacion" className="flex min-h-11 items-center gap-2 text-sm font-bold text-cyan-100">
            Ver operación <ArrowRight className="size-4" />
          </Link>
        </header>
        <div className="divide-y divide-white/8">
          {(recent ?? []).map((x) => (
            <div key={x.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="font-semibold">{relationName(x.cliente, "nombre_razon_social")}</p>
                <p className="mt-1 text-xs text-white/42">{relationName(x.producto, "nombre")} · {new Date(x.creado_en).toLocaleDateString("es-EC")}</p>
              </div>
              <p className="text-sm font-bold">{money(Number(x.cuota_fija_mensual))} <span className="ml-2 text-xs text-cyan-100/70">{x.estado}</span></p>
            </div>
          ))}
          {!recent?.length && <p className="p-6 text-sm text-white/50">No hay cotizaciones para este filtro.</p>}
        </div>
      </section>
    </AdminPage>
  );
}

type RecentQuote = {
  id: string; creado_en: string; estado: string; cuota_fija_mensual: number | string;
  cliente: unknown; producto: unknown;
};

async function recentQuotes(
  db: ReturnType<typeof createAdminClient>,
  insurerId: string,
  canalId: string | null,
  year: number,
  month: number | null,
): Promise<RecentQuote[]> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = month ? `${year}-${pad(month)}-01T00:00:00-05:00` : `${year}-01-01T00:00:00-05:00`;
  const endYear = month ? (month === 12 ? year + 1 : year) : year + 1;
  const endMonth = month ? (month === 12 ? 1 : month + 1) : 1;
  const end = `${endYear}-${pad(endMonth)}-01T00:00:00-05:00`;
  const base = db
    .from("cotizacion")
    .select("id,creado_en,estado,cuota_fija_mensual,cliente(nombre_razon_social),producto(nombre)")
    .eq("aseguradora_id", insurerId)
    .gte("creado_en", start)
    .lt("creado_en", end);
  const filtered = canalId ? base.eq("canal_id", canalId) : base;
  const { data } = await filtered.order("creado_en", { ascending: false }).limit(8);
  return (data ?? []) as RecentQuote[];
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="glass-panel min-w-0 p-5">
      <span className="text-cyan-100 [&_svg]:size-5">{icon}</span>
      <p className="mt-7 break-words text-3xl font-bold tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-white/42">{label}</p>
      <p className="mt-2 text-xs text-white/38">{detail}</p>
    </article>
  );
}

function CommissionTile({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-cyan-100/15 bg-cyan-100/[0.06] p-4">
      <span className="text-cyan-100 [&_svg]:size-4">{icon}</span>
      <p className="mt-3 break-words text-2xl font-bold tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/42">{label}</p>
      <p className="mt-1 text-[11px] text-white/38">{detail}</p>
    </article>
  );
}

function ChartPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="glass-panel min-w-0 p-5 sm:p-6">
      <header className="mb-6">
        <h2 className="font-bold">{title}</h2>
        <p className="mt-1 text-xs text-white/45">{description}</p>
      </header>
      {children}
    </section>
  );
}

function CollectionMetric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <article className={`min-w-0 rounded-2xl border p-4 ${alert ? "border-amber-200/20 bg-amber-200/8" : "border-white/10 bg-white/4"}`}>
      <div className="flex items-center gap-2">
        {alert && <TriangleAlert className="size-4 text-amber-200" />}
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/42">{label}</p>
      </div>
      <p className="mt-3 break-words text-xl font-bold">{value}</p>
    </article>
  );
}

function percentage(value: number, total: number) {
  return total ? `${((value / total) * 100).toLocaleString("es-EC", { maximumFractionDigits: 1 })}%` : "0%";
}
function money(value: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
function monthLabel(value: string) {
  const map: Record<string, string> = { Jan: "Ene", Feb: "Feb", Mar: "Mar", Apr: "Abr", May: "May", Jun: "Jun", Jul: "Jul", Aug: "Ago", Sep: "Sep", Oct: "Oct", Nov: "Nov", Dec: "Dic" };
  return map[value] || value;
}
function relationName(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" && key in row ? String((row as Record<string, unknown>)[key]) : "—";
}
