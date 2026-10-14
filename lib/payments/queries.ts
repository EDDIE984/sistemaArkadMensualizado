import type { PaymentFilters } from "@/lib/payments/types";

// Reused by the list and the bulk mutation so “all filtered” has the same scope.
export function paymentScope(channelId: string, insurerId: string, filters: PaymentFilters, today: string) {
  const values = [channelId, insurerId, filters.from, filters.to, filters.products, today, filters.status];
  const from = `from tabla_cobranza t
    join poliza po on po.id = t.poliza_id
    join cotizacion c on c.id = po.cotizacion_id
    join cliente cl on cl.id = c.cliente_id
    join producto p on p.id = c.producto_id
    left join vehiculo v on v.id = c.vehiculo_id
    cross join lateral (
      select coalesce(sum(pa.monto_pagado), 0) as paid
      from pago pa where pa.cobranza_id = t.id and pa.estado = 'REGISTRADO'
    ) payments
    where c.canal_id = $1 and c.aseguradora_id = $2
      and t.fecha_vencimiento between $3::date and $4::date
      and (cardinality($5::uuid[]) = 0 or c.producto_id = any($5::uuid[]))
      and t.estado <> 'CANCELADA'
      and ($7 = 'TODOS'
        or ($7 = 'PAGADO' and t.estado = 'PAGADO')
        or ($7 = 'POR_COBRAR' and t.estado in ('PENDIENTE', 'VENCIDO'))
        or ($7 = 'VENCIDO' and t.estado in ('PENDIENTE', 'VENCIDO') and t.fecha_vencimiento < $6::date)
        or ($7 = 'PENDIENTE' and t.estado in ('PENDIENTE', 'VENCIDO') and t.fecha_vencimiento >= $6::date))`;
  return { from, values };
}

/*
 * Las cuotas se pagan en orden. Una cuota del filtro queda bloqueada si su póliza
 * tiene una cuota anterior por cobrar que el filtro deja fuera (vence antes de
 * "desde", o está vencida cuando se filtran solo pendientes): no podría pagarse
 * junto con ella. Usa los mismos parámetros que `paymentScope`.
 */
export const blockedSql = `exists (
    select 1 from tabla_cobranza tp
    where tp.poliza_id = t.poliza_id and tp.numero_cuota < t.numero_cuota
      and tp.estado in ('PENDIENTE', 'VENCIDO')
      and (tp.fecha_vencimiento < $3::date or ($7 = 'PENDIENTE' and tp.fecha_vencimiento < $6::date)))`;

/** Cuota del filtro que se puede pagar ahora (con sus anteriores del mismo filtro). */
export const payableSql = `(t.estado in ('PENDIENTE', 'VENCIDO') and t.monto > payments.paid and not ${blockedSql})`;
