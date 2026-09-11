import type { Metadata } from "next";
import { BadgePercent, FileCheck2, FileText, HandCoins, Percent } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { ComparisonChart, StatusChart } from "@/components/insurer/dashboard-charts";
import { DashboardFilters, MONTHS } from "@/components/insurer/dashboard-filters";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDbPool } from "@/lib/db/pool";

export const metadata: Metadata = { title: "Administración de aseguradora | Arkad", robots: { index: false, follow: false } };

type KpiRow = {
  quotes: string; accepted: string; policies: string;
  commission_projected: string; commission_monthly: string;
};
type SeriesRow = { label: string; quotes?: string; policies?: string };
type StatusRow = { label: string; value: string };

// Ecuador (UTC-5, sin horario de verano). Producción se ancla a la cotización
// y las comisiones a pólizas emitidas.
const TZ = "America/Guayaquil";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ canal?: string; desde?: string; hasta?: string; comisionAnio?: string; comisionMes?: string }> }) {
  const session = await requireInsurerAdmin();
  const insurerId = session.insurerId!;
  const db = createAdminClient();
  const pool = getDbPool();

  const { data: canales = [] } = await db
    .from("canal").select("id,nombre").eq("aseguradora_id", insurerId).eq("activo", true).order("nombre");

  const sp = await searchParams;
  const canalId = (canales ?? []).some((c) => c.id === sp.canal) ? sp.canal! : null;
  const currentYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric" }).format(new Date()));
  const currentMonth = Number(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, month: "numeric" }).format(new Date()));
  const yearOptions = Array.from({ length: 11 }, (_, index) => currentYear + 5 - index);
  const rawFrom = yearOptions.includes(Number(sp.desde)) ? Number(sp.desde) : currentYear;
  const rawTo = yearOptions.includes(Number(sp.hasta)) ? Number(sp.hasta) : currentYear;
  const fromYear = Math.min(rawFrom, rawTo);
  const toYear = Math.max(rawFrom, rawTo);
  const commissionYear = yearOptions.includes(Number(sp.comisionAnio)) ? Number(sp.comisionAnio) : currentYear;
  const commissionMonth = /^([1-9]|1[0-2])$/.test(sp.comisionMes ?? "") ? Number(sp.comisionMes) : currentMonth;

  const yearParams = [insurerId, canalId, fromYear, toYear];
  const periodParams = [...yearParams, commissionYear, commissionMonth];

  const [insurer, kpis, statuses, commercialTrend, byChannel] = await Promise.all([
    db.from("aseguradora").select("nombre_comercial").eq("id", insurerId).single(),
    pool.query<KpiRow>(`
      with base as (
        select c.id, c.estado
        from cotizacion c
        where c.aseguradora_id = $1
          and ($2::uuid is null or c.canal_id = $2)
          and extract(year from c.creado_en at time zone '${TZ}') between $3 and $4
      ),
      projected_comm as (
        select coalesce(sum(am.comision_canal), 0) projected
        from poliza p
        join cotizacion c on c.id = p.cotizacion_id
        join amortizacion_mensual am on am.cotizacion_id = c.id
        where c.aseguradora_id = $1
          and ($2::uuid is null or c.canal_id = $2)
          and (p.fecha_inicio_vigencia + make_interval(months => am.mes)) >= make_date($3::int, 1, 1)
          and (p.fecha_inicio_vigencia + make_interval(months => am.mes)) < make_date(($4::int + 1), 1, 1)
      ),
      monthly_comm as (
        select coalesce(sum(am.comision_canal), 0) monthly
        from poliza p
        join cotizacion c on c.id = p.cotizacion_id
        join amortizacion_mensual am on am.cotizacion_id = c.id
        where c.aseguradora_id = $1
          and ($2::uuid is null or c.canal_id = $2)
          and date_trunc('month', p.fecha_inicio_vigencia + make_interval(months => am.mes)) = make_date($5::int, $6::int, 1)
      ),
      pol as (
        select count(*) n
        from poliza p join cotizacion c on c.id = p.cotizacion_id
        where c.aseguradora_id = $1
          and ($2::uuid is null or c.canal_id = $2)
          and extract(year from p.fecha_emision) between $3 and $4
      )
      select (select count(*) from base)::text quotes,
             (select count(*) from base where estado = 'ACEPTADA')::text accepted,
             (select n from pol)::text policies,
             (select projected from projected_comm)::text commission_projected,
             (select monthly from monthly_comm)::text commission_monthly
    `, periodParams),
    pool.query<StatusRow>(`
      select c.estado label, count(*)::text value
      from cotizacion c
      where c.aseguradora_id = $1
        and ($2::uuid is null or c.canal_id = $2)
        and extract(year from c.creado_en at time zone '${TZ}') between $3 and $4
      group by c.estado order by count(*) desc
    `, yearParams),
    pool.query<SeriesRow>(`
      with years as (select generate_series(make_date($3::int,1,1)::timestamp, make_date($4::int,1,1)::timestamp, interval '1 year') y),
      q as (
        select date_trunc('year', creado_en at time zone '${TZ}') y, count(*) n
        from cotizacion
        where aseguradora_id = $1 and ($2::uuid is null or canal_id = $2)
          and extract(year from creado_en at time zone '${TZ}') between $3 and $4
        group by 1
      ),
      p as (
        select date_trunc('year', po.fecha_emision)::timestamp y, count(*) n
        from poliza po join cotizacion c on c.id = po.cotizacion_id
        where c.aseguradora_id = $1 and ($2::uuid is null or c.canal_id = $2)
          and extract(year from po.fecha_emision) between $3 and $4
        group by 1
      )
      select to_char(years.y,'YYYY') label, coalesce(q.n,0)::text quotes, coalesce(p.n,0)::text policies
      from years left join q using(y) left join p using(y)
      order by years.y
    `, yearParams),
    canalId
      ? Promise.resolve({ rows: [] as StatusRow[] })
      : pool.query<StatusRow>(`
          select coalesce(ch.nombre, 'Autogestión') label, coalesce(sum(am.comision_canal), 0)::text value
          from poliza p
          join cotizacion c on c.id = p.cotizacion_id
          join amortizacion_mensual am on am.cotizacion_id = c.id
          left join canal ch on ch.id = c.canal_id
          where c.aseguradora_id = $1
            and extract(year from p.fecha_emision) between $2 and $3
          group by 1 order by 2 desc
        `, [insurerId, fromYear, toYear]),
  ]);

  const k = kpis.rows[0] || { quotes: "0", accepted: "0", policies: "0", commission_projected: "0", commission_monthly: "0" };
  const quoteCount = Number(k.quotes);
  const policyCount = Number(k.policies);
  const commissionProjected = Number(k.commission_projected);
  const commissionMonthly = Number(k.commission_monthly);

  const commercial = commercialTrend.rows.map((x) => ({ label: monthLabel(x.label), primary: Number(x.quotes ?? 0), secondary: Number(x.policies ?? 0) }));

  const canalName = canalId ? (canales ?? []).find((c) => c.id === canalId)?.nombre ?? null : null;
  const periodLabel = `${fromYear}${fromYear === toYear ? "" : `–${toYear}`}${canalName ? ` · ${canalName}` : ""}`;

  return (
    <AdminPage
      eyebrow="Indicadores ejecutivos"
      title={insurer.data?.nombre_comercial || "Mi aseguradora"}
      description="Monitorea producción, conversión y comisiones del canal de tu operación."
    >
      <p className="mt-3 text-xs text-white/40">Los indicadores se obtienen de cotizaciones y pólizas registradas en la base de datos.</p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric icon={<FileText />} label="Cotizaciones" value={quoteCount.toLocaleString("es-EC")} detail={`${Number(k.accepted)} aceptadas`} />
        <Metric icon={<FileCheck2 />} label="Pólizas emitidas" value={policyCount.toLocaleString("es-EC")} detail="De cotizaciones del período" />
        <Metric icon={<Percent />} label="Conversión" value={percentage(policyCount, quoteCount)} detail="Pólizas / cotizaciones" />
      </section>

      <section className="mt-4 grid gap-4">
        <div className="glass-panel grid content-start gap-3 p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/60">Comisiones del canal</p>
            <h2 className="mt-2 text-lg font-bold">Comisión proyectada</h2>
            <p className="mt-1 text-xs text-white/45">Cuotas proyectadas con vencimiento entre {periodLabel}</p>
          </div>
          <DashboardFilters canales={canales ?? []} years={yearOptions} selected={{ canal: canalId, desde: fromYear, hasta: toYear }} />
          <CommissionTile icon={<HandCoins />} label="Proyección total" value={money(commissionProjected)} detail="Comisión de las cuotas proyectadas dentro del período" />
        </div>
        <div className="glass-panel grid content-start gap-4 p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/60">Consulta independiente</p>
            <h2 className="mt-2 text-lg font-bold">Comisión mensualizada</h2>
          </div>
          <form className="flex flex-wrap items-end gap-2" aria-label="Consultar comisión mensualizada">
            {canalId && <input type="hidden" name="canal" value={canalId} />}
            <input type="hidden" name="desde" value={fromYear} />
            <input type="hidden" name="hasta" value={toYear} />
            <label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Año</span><select name="comisionAnio" defaultValue={String(commissionYear)} className="min-h-11 rounded-xl border border-white/15 bg-[#061323]/65 px-3 text-sm text-white [color-scheme:dark]">{yearOptions.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
            <label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Mes</span><select name="comisionMes" defaultValue={String(commissionMonth)} className="min-h-11 rounded-xl border border-white/15 bg-[#061323]/65 px-3 text-sm text-white [color-scheme:dark]">{MONTHS.map(([month, label]) => <option key={month} value={month}>{label}</option>)}</select></label>
            <button className="min-h-11 rounded-full bg-white px-4 text-xs font-bold text-[#071426]">Consultar</button>
          </form>
          <CommissionTile icon={<BadgePercent />} label="Comisión del mes" value={money(commissionMonthly)} detail={`Cuotas con vencimiento en ${MONTHS.find(([value]) => value === commissionMonth)?.[1]} de ${commissionYear}`} />
        </div>
      </section>

      <section className="mt-4">
        <ChartPanel title="Cotizaciones vs. emisiones" description={`Años del período ${periodLabel}`}>
          <ComparisonChart data={commercial} primaryLabel="Cotizaciones" secondaryLabel="Pólizas emitidas" />
        </ChartPanel>
      </section>

      <section className="mt-4">
        <ChartPanel title="Estado de cotizaciones" description="Distribución del embudo comercial">
          <StatusChart data={statuses.rows.map((x) => ({ label: x.label, value: Number(x.value) }))} />
        </ChartPanel>
      </section>

      {!canalId && byChannel.rows.length > 1 && (
        <section className="mt-4">
          <ChartPanel title="Comisión por canal" description={`Proyección de pólizas emitidas · ${periodLabel}`}>
            <StatusChart data={byChannel.rows.map((x) => ({ label: x.label, value: Number(x.value) }))} format="currency" />
          </ChartPanel>
        </section>
      )}

    </AdminPage>
  );
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
