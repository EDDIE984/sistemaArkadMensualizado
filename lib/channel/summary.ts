import "server-only";

import { getDbPool } from "@/lib/db/pool";

/*
 * Resúmenes de canal y aseguradora. El alcance siempre sigue al canal dueño
 * del producto (`producto.canal_id`), nunca al `cotizacion.canal_id`: así las
 * cotizaciones de autogestión se atribuyen al producto INDIVIDUAL correcto.
 */

export type Period = { from: string; to: string };
export type SummaryScope = { insurerId: string | null; channelId: string | null; productIds: string[] };

const TZ_TODAY = "(now() at time zone 'America/Guayaquil')::date";

// Parámetros compartidos: $1 aseguradora, $2 canal dueño del producto,
// $3 productos. Las fechas de los CTE de período son siempre $4 y $5.
const SCOPE_WHERE = `
  where ($1::uuid is null or c.aseguradora_id = $1)
    and ($2::uuid is null or p.canal_id = $2)
    and (cardinality($3::uuid[]) = 0 or c.producto_id = any($3::uuid[]))`;

/** Pólizas emitidas en el período. */
const ISSUED = `
  issued as (
    select po.id as poliza_id, po.fecha_emision, c.cliente_id, c.producto_id, c.vehiculo_id, p.canal_id as channel_id
    from poliza po
    join cotizacion c on c.id = po.cotizacion_id
    join producto p on p.id = c.producto_id
    ${SCOPE_WHERE} and po.fecha_emision between $4::date and $5::date
  )`;

/** Cuotas no canceladas que vencen en el período, con su desglose mensual. */
const PRODUCTION = `
  production as (
    select po.id as poliza_id, c.id as cotizacion_id, c.cliente_id, c.producto_id, c.vehiculo_id, p.canal_id as channel_id,
           t.fecha_vencimiento, m.prima_neta_mes, m.super_bancos, m.seguro_campesino, m.derechos_emision,
           m.subtotal, m.iva, m.prima_total_mes, m.comision_canal
    from poliza po
    join cotizacion c on c.id = po.cotizacion_id
    join producto p on p.id = c.producto_id
    join tabla_cobranza t on t.poliza_id = po.id
    join amortizacion_mensual m on m.cotizacion_id = c.id and m.mes = t.numero_cuota
    ${SCOPE_WHERE} and t.estado <> 'CANCELADA' and t.fecha_vencimiento between $4::date and $5::date
  )`;

const scopeValues = (scope: SummaryScope) => [scope.insurerId, scope.channelId, scope.productIds];

export type SummaryKpis = { vehicles: number; clients: number; commission: number; premium: number };

async function kpis(scope: SummaryScope, period: Period): Promise<SummaryKpis> {
  const { rows } = await getDbPool().query<SummaryKpis>(
    `with ${ISSUED}, ${PRODUCTION}
     select (select count(*)::int from issued) as vehicles,
            (select count(distinct cliente_id)::int from issued) as clients,
            (select coalesce(sum(comision_canal), 0)::float from production) as commission,
            (select coalesce(sum(prima_neta_mes), 0)::float from production) as premium`,
    [...scopeValues(scope), period.from, period.to],
  );
  return rows[0];
}

/** Período anterior de la misma duración, para las variaciones de los KPI. */
export function previousPeriod(period: Period): Period {
  const from = new Date(`${period.from}T12:00:00Z`);
  const to = new Date(`${period.to}T12:00:00Z`);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const previousTo = new Date(from.getTime() - 86400000);
  const previousFrom = new Date(previousTo.getTime() - (days - 1) * 86400000);
  return { from: previousFrom.toISOString().slice(0, 10), to: previousTo.toISOString().slice(0, 10) };
}

export type SummaryProduct = {
  id: string; name: string; insurer: string; channel: string | null; vehicles: number; policies: number; clients: number;
  net: number; total: number; commission: number;
};
export type SummaryMonth = { month: string; vehicles: number; commission: number };
export type SummaryChannel = { id: string; name: string; commission: number; premium: number; policies: number };

export async function getSummary(scope: SummaryScope, period: Period, expiry: Period) {
  const db = getDbPool();
  const args = [...scopeValues(scope), period.from, period.to];
  const [current, previous, future, pending, portfolio, products, monthly, brands, expiring, expiringByMonth, channels] = await Promise.all([
    kpis(scope, period),
    kpis(scope, previousPeriod(period)),
    // Comisión proyectada = cuotas futuras de la cartera, sin las canceladas.
    db.query<{ commission: number; policies: number }>(
      `select coalesce(sum(m.comision_canal), 0)::float as commission, count(distinct po.id)::int as policies
       from poliza po
       join cotizacion c on c.id = po.cotizacion_id
       join producto p on p.id = c.producto_id
       join tabla_cobranza t on t.poliza_id = po.id
       join amortizacion_mensual m on m.cotizacion_id = c.id and m.mes = t.numero_cuota
       ${SCOPE_WHERE} and t.estado <> 'CANCELADA' and t.fecha_vencimiento > ${TZ_TODAY}`,
      scopeValues(scope),
    ),
    db.query<{ n: number }>(
      `select count(*)::int as n
       from cotizacion c
       join producto p on p.id = c.producto_id
       ${SCOPE_WHERE} and c.estado = 'PENDIENTE'`,
      scopeValues(scope),
    ),
    // El tablero de canal mantiene su cartera explícita; para aseguradora la
    // cartera es la de clientes con pólizas dentro del alcance elegido.
    scope.insurerId === null && scope.channelId
      ? db.query<{ n: number }>(`select count(*)::int as n from canal_cliente where canal_id = $1`, [scope.channelId])
      : db.query<{ n: number }>(
          `select count(distinct c.cliente_id)::int as n
           from poliza po
           join cotizacion c on c.id = po.cotizacion_id
           join producto p on p.id = c.producto_id
           ${SCOPE_WHERE}`,
          scopeValues(scope),
        ),
    // Productos del alcance aunque no tengan movimiento; la aseguradora solo ve los activos.
    db.query<SummaryProduct>(
      `with ${ISSUED}, ${PRODUCTION},
       prod as (
         select producto_id, count(distinct poliza_id)::int as policies, count(distinct cliente_id)::int as clients,
                sum(prima_neta_mes)::float as net, sum(prima_total_mes)::float as total, sum(comision_canal)::float as commission
         from production group by producto_id
       ),
       iss as (select producto_id, count(*)::int as vehicles from issued group by producto_id)
       select p.id, p.nombre as name, a.nombre_comercial as insurer, ch.nombre as channel,
              coalesce(iss.vehicles, 0)::int as vehicles, coalesce(prod.policies, 0)::int as policies,
              coalesce(prod.clients, 0)::int as clients, coalesce(prod.net, 0)::float as net,
              coalesce(prod.total, 0)::float as total, coalesce(prod.commission, 0)::float as commission
       from producto p
       join aseguradora a on a.id = p.aseguradora_id
       left join canal ch on ch.id = p.canal_id
       left join prod on prod.producto_id = p.id
       left join iss on iss.producto_id = p.id
       where ($1::uuid is null or p.activo)
         and ($1::uuid is null or p.aseguradora_id = $1)
         and ($2::uuid is null or p.canal_id = $2)
         and (cardinality($3::uuid[]) = 0 or p.id = any($3::uuid[]))
       order by policies desc, vehicles desc, p.nombre`,
      args,
    ),
    db.query<SummaryMonth>(
      `with ${ISSUED}, ${PRODUCTION},
       months as (select generate_series(date_trunc('month', $4::date), date_trunc('month', $5::date), interval '1 month')::date as m)
       select to_char(months.m, 'YYYY-MM') as month,
              (select count(*)::int from issued i where date_trunc('month', i.fecha_emision) = months.m) as vehicles,
              (select coalesce(sum(x.comision_canal), 0)::float from production x where date_trunc('month', x.fecha_vencimiento) = months.m) as commission
       from months order by months.m`,
      args,
    ),
    db.query<{ brand: string; vehicles: number }>(
      `with ${ISSUED}
       select initcap(lower(v.marca)) as brand, count(*)::int as vehicles
       from issued i join vehiculo v on v.id = i.vehiculo_id
       group by initcap(lower(v.marca)) order by vehicles desc, brand limit 6`,
      args,
    ),
    getExpiring(scope, expiry),
    db.query<{ month: string; vehicles: number }>(
      `with months as (
         select generate_series(date_trunc('month', ${TZ_TODAY}), date_trunc('month', ${TZ_TODAY}) + interval '11 months', interval '1 month')::date as m
       ), scoped as (
         select po.id, po.fecha_fin_vigencia
         from poliza po
         join cotizacion c on c.id = po.cotizacion_id
         join producto p on p.id = c.producto_id
         ${SCOPE_WHERE} and po.estado = 'VIGENTE' and po.fecha_fin_vigencia >= ${TZ_TODAY}
       )
       select to_char(months.m, 'YYYY-MM') as month, count(scoped.id)::int as vehicles
       from months left join scoped on date_trunc('month', scoped.fecha_fin_vigencia) = months.m
       group by months.m order by months.m`,
      scopeValues(scope),
    ),
    db.query<SummaryChannel>(
      `with ${PRODUCTION}
       select ch.id, ch.nombre as name, coalesce(sum(x.comision_canal), 0)::float as commission,
              coalesce(sum(x.prima_neta_mes), 0)::float as premium, count(distinct x.poliza_id)::int as policies
       from production x
       join canal ch on ch.id = x.channel_id
       group by ch.id, ch.nombre
       order by commission desc, ch.nombre`,
      args,
    ),
  ]);

  return {
    current,
    previous,
    futureCommission: future.rows[0].commission,
    futurePolicies: future.rows[0].policies,
    pendingOrders: pending.rows[0].n,
    portfolioClients: portfolio.rows[0].n,
    products: products.rows,
    monthly: monthly.rows,
    brands: brands.rows,
    expiring,
    expiringByMonth: expiringByMonth.rows,
    channels: channels.rows,
  };
}

export type ExpiringPolicy = {
  quoteId: string; client: string; identification: string | null; phone: string | null; email: string | null;
  brand: string; model: string; plate: string | null; product: string; channel: string | null; policy: string; end: string; days: number;
};

/** Pólizas vigentes del alcance que vencen dentro de la ventana. */
export async function getExpiring(scope: SummaryScope, window: Period): Promise<ExpiringPolicy[]> {
  const { rows } = await getDbPool().query<ExpiringPolicy>(
    `select c.id as "quoteId", cl.nombre_razon_social as client, cl.identificacion as identification, cl.telefono as phone, cl.email,
            v.marca as brand, v.modelo as model, v.placa as plate, p.nombre as product, ch.nombre as channel, po.numero_poliza as policy,
            po.fecha_fin_vigencia::text as "end", (po.fecha_fin_vigencia - ${TZ_TODAY})::int as days
     from poliza po
     join cotizacion c on c.id = po.cotizacion_id
     join producto p on p.id = c.producto_id
     join cliente cl on cl.id = c.cliente_id
     join vehiculo v on v.id = c.vehiculo_id
     left join canal ch on ch.id = p.canal_id
     ${SCOPE_WHERE} and po.estado = 'VIGENTE' and po.fecha_fin_vigencia between $4::date and $5::date
     order by po.fecha_fin_vigencia, cl.nombre_razon_social`,
    [...scopeValues(scope), window.from, window.to],
  );
  return rows;
}

export type ProductionDetail = {
  client: string; identification: string | null; email: string | null; phone: string | null; city: string | null;
  brand: string; model: string; year: number | null; color: string | null; plate: string | null; insuredValue: number;
  product: string; insurer: string; channel: string | null; policy: string; issued: string; start: string; end: string; installments: number;
  net: number; superBancos: number; seguroCampesino: number; derechosEmision: number;
  subtotal: number; iva: number; total: number; commission: number;
};

/** Producción del período por póliza: suma de sus cuotas con vencimiento en el rango. */
export async function getProductionDetail(scope: SummaryScope, period: Period): Promise<ProductionDetail[]> {
  const { rows } = await getDbPool().query<ProductionDetail>(
    `with ${PRODUCTION},
     per_policy as (
       select poliza_id, cliente_id, producto_id, vehiculo_id, channel_id, count(*)::int as installments,
              sum(prima_neta_mes)::float as net, sum(super_bancos)::float as "superBancos", sum(seguro_campesino)::float as "seguroCampesino",
              sum(derechos_emision)::float as "derechosEmision", sum(subtotal)::float as subtotal, sum(iva)::float as iva,
              sum(prima_total_mes)::float as total, sum(comision_canal)::float as commission
       from production group by poliza_id, cliente_id, producto_id, vehiculo_id, channel_id
     )
     select cl.nombre_razon_social as client, cl.identificacion as identification, cl.email, cl.telefono as phone, ci.nombre as city,
            v.marca as brand, v.modelo as model, v.anio as year, v.color, v.placa as plate, v.valor_asegurado::float as "insuredValue",
            pr.nombre as product, a.nombre_comercial as insurer, ch.nombre as channel, po.numero_poliza as policy,
            po.fecha_emision::text as issued, po.fecha_inicio_vigencia::text as start, po.fecha_fin_vigencia::text as "end",
            x.installments, x.net, x."superBancos", x."seguroCampesino", x."derechosEmision", x.subtotal, x.iva, x.total, x.commission
     from per_policy x
     join poliza po on po.id = x.poliza_id
     join cliente cl on cl.id = x.cliente_id
     left join ciudad ci on ci.id = cl.ciudad_id
     join vehiculo v on v.id = x.vehiculo_id
     join producto pr on pr.id = x.producto_id
     join aseguradora a on a.id = pr.aseguradora_id
     left join canal ch on ch.id = x.channel_id
     order by po.fecha_emision desc, cl.nombre_razon_social`,
    [...scopeValues(scope), period.from, period.to],
  );
  return rows;
}

// ── Filtros ──────────────────────────────────────────────────────────────────

const isoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const addMonths = (iso: string, n: number) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + n);
  return date.toISOString().slice(0, 10);
};
const validDate = (value: string | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null);

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

function ordered(first: string, second: string): Period {
  return first <= second ? { from: first, to: second } : { from: second, to: first };
}

/** Lee los filtros de período y vencimientos, con rangos inclusivos. */
export function parseSummaryFilters(params: SummaryParams) {
  const today = isoToday();
  const lastMonths = (months: number): Period => ({ from: addDays(addMonths(today, -months), 1), to: today });
  let periodKey: string = PERIOD_OPTIONS.some((option) => option.key === params.periodo) ? params.periodo! : "12m";
  const from = validDate(params.desde);
  const to = validDate(params.hasta);
  let period: Period;
  if (periodKey === "rango" && from && to) period = ordered(from, to);
  else if (periodKey === "3m") period = lastMonths(3);
  else if (periodKey === "6m") period = lastMonths(6);
  else if (periodKey === "anio") period = { from: `${today.slice(0, 4)}-01-01`, to: today };
  else { periodKey = "12m"; period = lastMonths(12); }

  let expiryKey: string = EXPIRY_OPTIONS.some((option) => option.key === params.vence) ? params.vence! : "60";
  const expiryFrom = validDate(params.vdesde);
  const expiryTo = validDate(params.vhasta);
  let expiry: Period;
  if (expiryKey === "rango" && expiryFrom && expiryTo) expiry = ordered(expiryFrom, expiryTo);
  else { if (expiryKey === "rango") expiryKey = "60"; expiry = { from: today, to: addDays(today, Number(expiryKey)) }; }

  const periodQs: Record<string, string> = periodKey === "rango" ? { periodo: "rango", desde: period.from, hasta: period.to } : { periodo: periodKey };
  const expiryQs: Record<string, string> = expiryKey === "rango" ? { vence: "rango", vdesde: expiry.from, vhasta: expiry.to } : { vence: expiryKey };
  return { today, period, periodKey, expiry, expiryKey, periodQs, expiryQs };
}
