import "server-only";

import { getDbPool } from "@/lib/db/pool";
import type { Period, SummaryScope } from "@/lib/channel/summary";

const TODAY = "(now() at time zone 'America/Guayaquil')::date";
const SCOPE_WHERE = `
  where ($1::uuid is null or c.aseguradora_id = $1)
    and ($2::uuid is null or p.canal_id = $2)
    and (cardinality($3::uuid[]) = 0 or c.producto_id = any($3::uuid[]))
    and t.estado <> 'CANCELADA'`;

// La misma base de Pagos: cobranza + pagos REGISTRADO, sin cuotas canceladas.
const COLLECTIONS_BASE = `
  from tabla_cobranza t
  join poliza po on po.id = t.poliza_id
  join cotizacion c on c.id = po.cotizacion_id
  join producto p on p.id = c.producto_id
  left join canal ch on ch.id = p.canal_id
  cross join lateral (
    select coalesce(sum(pa.monto_pagado), 0)::float as paid
    from pago pa where pa.cobranza_id = t.id and pa.estado = 'REGISTRADO'
  ) payments
  ${SCOPE_WHERE}`;

const scopeValues = (scope: SummaryScope) => [scope.insurerId, scope.channelId, scope.productIds];

export type CollectionsKpis = {
  collected: number;
  receivable: number;
  overdue: number;
  overduePolicies: number;
  due: number;
  duePaid: number;
  effectiveness: number | null;
};
export type AgingBucket = { label: string; amount: number; installments: number; policies: number };
export type CollectionChannel = { id: string; name: string; due: number; paid: number; effectiveness: number | null; overdue: number; overduePolicies: number };

export async function getCollections(scope: SummaryScope, period: Period) {
  const db = getDbPool();
  const values = [...scopeValues(scope), period.from, period.to];
  const [kpisResult, agingResult, channelsResult] = await Promise.all([
    db.query<Omit<CollectionsKpis, "effectiveness">>(
      `with base as (select t.id, t.poliza_id, t.fecha_vencimiento, t.monto::float as amount, t.estado, payments.paid ${COLLECTIONS_BASE}),
       collected as (
         select coalesce(sum(pa.monto_pagado), 0)::float as amount
         from pago pa join base on base.id = pa.cobranza_id
         where pa.estado = 'REGISTRADO' and pa.fecha_pago between $4::date and $5::date
       ), due as (
         select coalesce(sum(amount), 0)::float as amount, coalesce(sum(least(paid, amount)), 0)::float as paid
         from base where fecha_vencimiento between $4::date and $5::date and fecha_vencimiento <= ${TODAY}
       )
       select (select amount from collected) as collected,
              coalesce(sum(greatest(amount - paid, 0)) filter (where estado in ('PENDIENTE', 'VENCIDO') and fecha_vencimiento >= ${TODAY}), 0)::float as receivable,
              coalesce(sum(greatest(amount - paid, 0)) filter (where estado in ('PENDIENTE', 'VENCIDO') and fecha_vencimiento < ${TODAY}), 0)::float as overdue,
              count(distinct poliza_id) filter (where estado in ('PENDIENTE', 'VENCIDO') and fecha_vencimiento < ${TODAY} and amount > paid)::int as "overduePolicies",
              (select amount from due) as due, (select paid from due) as "duePaid"
       from base`,
      values,
    ),
    db.query<AgingBucket>(
      `with base as (select t.poliza_id, t.fecha_vencimiento, t.monto::float as amount, t.estado, payments.paid ${COLLECTIONS_BASE}),
       overdue as (
         select *, (${TODAY} - fecha_vencimiento)::int as days
         from base where estado in ('PENDIENTE', 'VENCIDO') and fecha_vencimiento < ${TODAY} and amount > paid
       ), buckets as (
         select 1 as position, '1–30 días'::text as label, 1 as first_day, 30 as last_day union all
         select 2, '31–60 días', 31, 60 union all
         select 3, '61–90 días', 61, 90 union all
         select 4, '> 90 días', 91, null
       )
       select buckets.label, coalesce(sum(greatest(overdue.amount - overdue.paid, 0)), 0)::float as amount,
              count(overdue.poliza_id)::int as installments, count(distinct overdue.poliza_id)::int as policies
       from buckets left join overdue on overdue.days >= buckets.first_day and (buckets.last_day is null or overdue.days <= buckets.last_day)
       group by buckets.position, buckets.label order by buckets.position`,
      scopeValues(scope),
    ),
    scope.channelId === null
      ? db.query<Omit<CollectionChannel, "effectiveness"> & { paid: number }>(
          `with base as (select ch.id, ch.nombre as name, t.poliza_id, t.fecha_vencimiento, t.monto::float as amount, t.estado, payments.paid ${COLLECTIONS_BASE})
           select id, name,
                  coalesce(sum(amount) filter (where fecha_vencimiento between $4::date and $5::date and fecha_vencimiento <= ${TODAY}), 0)::float as due,
                  coalesce(sum(least(paid, amount)) filter (where fecha_vencimiento between $4::date and $5::date and fecha_vencimiento <= ${TODAY}), 0)::float as paid,
                  coalesce(sum(greatest(amount - paid, 0)) filter (where estado in ('PENDIENTE', 'VENCIDO') and fecha_vencimiento < ${TODAY}), 0)::float as overdue,
                  count(distinct poliza_id) filter (where estado in ('PENDIENTE', 'VENCIDO') and fecha_vencimiento < ${TODAY} and amount > paid)::int as "overduePolicies"
           from base group by id, name order by overdue desc, name`,
          values,
        )
      : Promise.resolve({ rows: [] as (Omit<CollectionChannel, "effectiveness"> & { paid: number })[] }),
  ]);

  const kpis = kpisResult.rows[0] ?? { collected: 0, receivable: 0, overdue: 0, overduePolicies: 0, due: 0, duePaid: 0 };
  return {
    kpis: { ...kpis, effectiveness: kpis.due ? kpis.duePaid / kpis.due : null },
    aging: agingResult.rows,
    channels: channelsResult.rows.map((channel) => ({ ...channel, effectiveness: channel.due ? channel.paid / channel.due : null })),
  };
}
