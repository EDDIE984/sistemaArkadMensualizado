import "server-only";

import { getDbPool } from "@/lib/db/pool";

/*
 * Tablero del canal (Resumen). Todo se filtra por `cotizacion.canal_id`.
 * "Emitido" = póliza emitida por la aseguradora (`poliza.fecha_emision`).
 * Comisión = `amortizacion_mensual.comision_canal` de esas pólizas (vigencia completa).
 */

export type Period = { from: string; to: string };

const TZ_TODAY = "(now() at time zone 'America/Guayaquil')::date";

/** Pólizas del canal emitidas en el período (CTE reutilizable). $1 canal, $2 desde, $3 hasta. */
const ISSUED = `
  issued as (
    select po.id as poliza_id, po.numero_poliza, po.fecha_emision, po.fecha_inicio_vigencia, po.fecha_fin_vigencia, po.estado as poliza_estado,
           c.id as cotizacion_id, c.cliente_id, c.producto_id, c.vehiculo_id, c.cuota_fija_mensual,
           (select coalesce(sum(m.cuota_fija), 0) from amortizacion_mensual m where m.cotizacion_id = c.id) as prima,
           (select coalesce(sum(m.comision_canal), 0) from amortizacion_mensual m where m.cotizacion_id = c.id) as comision
    from poliza po
    join cotizacion c on c.id = po.cotizacion_id
    where c.canal_id = $1 and po.fecha_emision between $2::date and $3::date
  )`;

export type SummaryKpis = { vehicles: number; clients: number; commission: number; premium: number };

async function kpis(channelId: string, p: Period): Promise<SummaryKpis> {
  const { rows } = await getDbPool().query(
    `with ${ISSUED}
     select count(*)::int as vehicles, count(distinct cliente_id)::int as clients,
            coalesce(sum(comision), 0)::float as commission, coalesce(sum(prima), 0)::float as premium
     from issued`,
    [channelId, p.from, p.to],
  );
  return rows[0];
}

/** Período anterior de la misma duración, para las variaciones de los KPI. */
export function previousPeriod(p: Period): Period {
  const from = new Date(`${p.from}T12:00:00Z`);
  const to = new Date(`${p.to}T12:00:00Z`);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

export async function getSummary(channelId: string, period: Period, expiry: Period) {
  const db = getDbPool();
  const args = [channelId, period.from, period.to];
  const [current, previous, pending, portfolio, products, monthly, brands, expiring, expiringByMonth] = await Promise.all([
    kpis(channelId, period),
    kpis(channelId, previousPeriod(period)),
    db.query(`select count(*)::int as n from cotizacion where canal_id = $1 and estado = 'PENDIENTE'`, [channelId]),
    db.query(`select count(*)::int as n from canal_cliente where canal_id = $1`, [channelId]),
    // Todos los productos del canal (aunque no tengan pólizas en el período).
    db.query<{ id: string; name: string; insurer: string; vehicles: number; clients: number; premium: number; commission: number }>(
      `with ${ISSUED}
       select p.id, p.nombre as name, a.nombre_comercial as insurer,
              count(i.poliza_id)::int as vehicles, count(distinct i.cliente_id)::int as clients,
              coalesce(sum(i.prima), 0)::float as premium, coalesce(sum(i.comision), 0)::float as commission
       from producto p
       join aseguradora a on a.id = p.aseguradora_id
       left join issued i on i.producto_id = p.id
       where p.canal_id = $1
       group by p.id, a.nombre_comercial
       order by vehicles desc, p.nombre`,
      args,
    ),
    // Un registro por mes del período, con 0 donde no hubo emisiones.
    db.query<{ month: string; vehicles: number; commission: number }>(
      `with ${ISSUED},
       months as (select generate_series(date_trunc('month', $2::date), date_trunc('month', $3::date), interval '1 month')::date as m)
       select to_char(months.m, 'YYYY-MM') as month,
              count(i.poliza_id)::int as vehicles, coalesce(sum(i.comision), 0)::float as commission
       from months left join issued i on date_trunc('month', i.fecha_emision) = months.m
       group by months.m order by months.m`,
      args,
    ),
    db.query<{ brand: string; vehicles: number }>(
      `with ${ISSUED}
       select initcap(lower(v.marca)) as brand, count(*)::int as vehicles
       from issued i join vehiculo v on v.id = i.vehiculo_id
       group by initcap(lower(v.marca)) order by vehicles desc, brand limit 6`,
      args,
    ),
    getExpiring(channelId, expiry),
    db.query<{ month: string; vehicles: number }>(
      `with months as (select generate_series(date_trunc('month', ${TZ_TODAY}), date_trunc('month', ${TZ_TODAY}) + interval '11 months', interval '1 month')::date as m)
       select to_char(months.m, 'YYYY-MM') as month, count(po.id)::int as vehicles
       from months
       left join (poliza po join cotizacion c on c.id = po.cotizacion_id and c.canal_id = $1 and po.estado = 'VIGENTE')
         on date_trunc('month', po.fecha_fin_vigencia) = months.m and po.fecha_fin_vigencia >= ${TZ_TODAY}
       group by months.m order by months.m`,
      [channelId],
    ),
  ]);
  return {
    current,
    previous,
    pendingOrders: pending.rows[0].n as number,
    portfolioClients: portfolio.rows[0].n as number,
    products: products.rows,
    monthly: monthly.rows,
    brands: brands.rows,
    expiring,
    expiringByMonth: expiringByMonth.rows,
  };
}

export type ExpiringPolicy = {
  quoteId: string; client: string; identification: string | null; phone: string | null; email: string | null;
  brand: string; model: string; plate: string | null; product: string; policy: string; end: string; days: number;
};

/** Pólizas vigentes del canal que vencen dentro de la ventana. */
export async function getExpiring(channelId: string, w: Period): Promise<ExpiringPolicy[]> {
  const { rows } = await getDbPool().query<ExpiringPolicy>(
    `select c.id as "quoteId", cl.nombre_razon_social as client, cl.identificacion as identification, cl.telefono as phone, cl.email,
            v.marca as brand, v.modelo as model, v.placa as plate, p.nombre as product, po.numero_poliza as policy,
            po.fecha_fin_vigencia::text as "end", (po.fecha_fin_vigencia - ${TZ_TODAY})::int as days
     from poliza po
     join cotizacion c on c.id = po.cotizacion_id
     join cliente cl on cl.id = c.cliente_id
     join vehiculo v on v.id = c.vehiculo_id
     join producto p on p.id = c.producto_id
     where c.canal_id = $1 and po.estado = 'VIGENTE' and po.fecha_fin_vigencia between $2::date and $3::date
     order by po.fecha_fin_vigencia, cl.nombre_razon_social`,
    [channelId, w.from, w.to],
  );
  return rows;
}

export type IssuedDetail = {
  client: string; identification: string | null; email: string | null; phone: string | null; city: string | null;
  brand: string; model: string; year: number | null; color: string | null; plate: string | null; insuredValue: number;
  product: string; insurer: string; policy: string; issued: string; start: string; end: string;
  monthly: number; premium: number; commission: number;
};

/** Detalle de vehículos y clientes con póliza emitida en el período (para la descarga). */
export async function getIssuedDetail(channelId: string, p: Period): Promise<IssuedDetail[]> {
  const { rows } = await getDbPool().query<IssuedDetail>(
    `with ${ISSUED}
     select cl.nombre_razon_social as client, cl.identificacion as identification, cl.email, cl.telefono as phone, ci.nombre as city,
            v.marca as brand, v.modelo as model, v.anio as year, v.color, v.placa as plate, v.valor_asegurado::float as "insuredValue",
            pr.nombre as product, a.nombre_comercial as insurer, i.numero_poliza as policy,
            i.fecha_emision::text as issued, i.fecha_inicio_vigencia::text as start, i.fecha_fin_vigencia::text as "end",
            i.cuota_fija_mensual::float as monthly, i.prima::float as premium, i.comision::float as commission
     from issued i
     join cliente cl on cl.id = i.cliente_id
     left join ciudad ci on ci.id = cl.ciudad_id
     join vehiculo v on v.id = i.vehiculo_id
     join producto pr on pr.id = i.producto_id
     join aseguradora a on a.id = pr.aseguradora_id
     order by i.fecha_emision desc, cl.nombre_razon_social`,
    [channelId, p.from, p.to],
  );
  return rows;
}

// ── Filtros ──────────────────────────────────────────────────────────────────

const isoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const validDate = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);

export const PERIOD_OPTIONS = [
  { key: "3m", label: "Últimos 3 meses" },
  { key: "6m", label: "Últimos 6 meses" },
  { key: "12m", label: "Últimos 12 meses" },
  { key: "anio", label: "Este año" },
  { key: "rango", label: "Personalizado" },
] as const;
export const EXPIRY_OPTIONS = [
  { key: "30", label: "Próximos 30 días" },
  { key: "60", label: "Próximos 60 días" },
  { key: "90", label: "Próximos 90 días" },
  { key: "rango", label: "Personalizado" },
] as const;

type SummaryParams = { periodo?: string; desde?: string; hasta?: string; vence?: string; vdesde?: string; vhasta?: string };

function ordered(a: string, b: string): Period {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/**
 * Lee los filtros de la URL. Cada filtro tiene UNA sola forma de elegirse:
 * - `periodo`: 3m | 6m | 12m (por defecto) | anio | rango (con `desde`/`hasta`).
 * - `vence`: 30 | 60 (por defecto) | 90 | rango (con `vdesde`/`vhasta`).
 */
export function parseSummaryFilters(sp: SummaryParams) {
  const today = isoToday();
  const lastMonths = (n: number): Period => ({ from: addDays(addMonths(today, -n), 1), to: today });

  let periodKey: string = PERIOD_OPTIONS.some((o) => o.key === sp.periodo) ? sp.periodo! : "12m";
  let period: Period;
  const desde = validDate(sp.desde), hasta = validDate(sp.hasta);
  if (periodKey === "rango" && desde && hasta) period = ordered(desde, hasta);
  else if (periodKey === "3m") period = lastMonths(3);
  else if (periodKey === "6m") period = lastMonths(6);
  else if (periodKey === "anio") period = { from: `${today.slice(0, 4)}-01-01`, to: today };
  else { periodKey = "12m"; period = lastMonths(12); }

  let expiryKey: string = EXPIRY_OPTIONS.some((o) => o.key === sp.vence) ? sp.vence! : "60";
  let expiry: Period;
  const vdesde = validDate(sp.vdesde), vhasta = validDate(sp.vhasta);
  if (expiryKey === "rango" && vdesde && vhasta) expiry = ordered(vdesde, vhasta);
  else { if (expiryKey === "rango") expiryKey = "60"; expiry = { from: today, to: addDays(today, Number(expiryKey)) }; }

  const periodQs: Record<string, string> = periodKey === "rango" ? { periodo: "rango", desde: period.from, hasta: period.to } : { periodo: periodKey };
  const expiryQs: Record<string, string> = expiryKey === "rango" ? { vence: "rango", vdesde: expiry.from, vhasta: expiry.to } : { vence: expiryKey };
  return { today, period, periodKey, expiry, expiryKey, periodQs, expiryQs };
}
