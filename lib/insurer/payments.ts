import "server-only";

import { getDbPool } from "@/lib/db/pool";
import type { SummaryScope } from "@/lib/channel/summary";
import { resolveInsurerSummaryScope } from "@/lib/insurer/summary-scope";
import type { InsurerPaymentFilters, InsurerPaymentRow, InsurerPaymentSummary, ReconcileInput } from "@/lib/insurer/payment-types";

/*
 * Pagos de la aseguradora: PAGO REGISTRADO de sus canales, una fila por cuota.
 * El alcance sigue al canal dueño del producto, como el Resumen. Página, Excel
 * y "conciliar todos los del filtro" usan el mismo `from` para no divergir.
 */

export class ReconcileError extends Error {}

type Scope = SummaryScope & { insurerId: string };
type Window = Pick<InsurerPaymentFilters, "from" | "to" | "reconciliation" | "method">;

/** $1 aseguradora, $2 canal, $3 productos, $4/$5 fechas de pago, $6 conciliación, $7 método. */
function paymentScope(scope: Scope, f: Window) {
  const values = [scope.insurerId, scope.channelId, scope.productIds, f.from, f.to, f.reconciliation, f.method];
  const from = `from pago pa
    join tabla_cobranza t on t.id = pa.cobranza_id
    join poliza po on po.id = t.poliza_id
    join cotizacion c on c.id = po.cotizacion_id
    join producto p on p.id = c.producto_id
    join cliente cl on cl.id = c.cliente_id
    left join vehiculo v on v.id = c.vehiculo_id
    left join canal ch on ch.id = p.canal_id
    left join usuario ur on ur.id = pa.usuario_registro_id
    left join usuario uc on uc.id = pa.conciliado_por_id
    where c.aseguradora_id = $1
      and ($2::uuid is null or p.canal_id = $2)
      and (cardinality($3::uuid[]) = 0 or c.producto_id = any($3::uuid[]))
      and pa.estado = 'REGISTRADO'
      and pa.fecha_pago between $4::date and $5::date
      and ($6 = 'TODOS' or ($6 = 'PENDIENTES' and pa.conciliado_en is null) or ($6 = 'CONCILIADOS' and pa.conciliado_en is not null))
      and ($7 = 'TODOS' or pa.metodo_pago = $7)`;
  return { from, values };
}

const COLUMNS = `pa.id, pa.fecha_pago::text as "paidOn", pa.monto_pagado::float as amount, pa.metodo_pago as method, pa.referencia as reference,
  ur.nombre as "registeredBy", cl.nombre_razon_social as client, cl.identificacion as identification, cl.email,
  po.numero_poliza as policy, v.placa as plate, v.marca as brand, v.modelo as model, p.nombre as product, ch.nombre as channel,
  t.numero_cuota as installment, t.fecha_vencimiento::text as due,
  pa.conciliado_en::text as "reconciledAt", uc.nombre as "reconciledBy"`;
const ORDER = `order by pa.fecha_pago desc, po.numero_poliza, t.numero_cuota, pa.id`;

export async function getInsurerPayments(scope: Scope, f: Window, page: number, pageSize: number) {
  const db = getDbPool();
  const { from, values } = paymentScope(scope, f);
  const totals = await db.query<InsurerPaymentSummary>(
    `select count(*)::int as total, coalesce(sum(pa.monto_pagado), 0)::float as amount,
       count(*) filter (where pa.conciliado_en is not null)::int as reconciled,
       coalesce(sum(pa.monto_pagado) filter (where pa.conciliado_en is not null), 0)::float as "reconciledAmount",
       count(*) filter (where pa.conciliado_en is null)::int as pending,
       coalesce(sum(pa.monto_pagado) filter (where pa.conciliado_en is null), 0)::float as "pendingAmount"
     ${from}`, values,
  );
  const summary = totals.rows[0];
  const current = Math.min(Math.max(1, page), Math.max(1, Math.ceil(summary.total / pageSize)));
  const rows = await db.query<InsurerPaymentRow>(`select ${COLUMNS} ${from} ${ORDER} limit ${pageSize} offset $8`, [...values, (current - 1) * pageSize]);
  return { summary, rows: rows.rows, page: current };
}

/** Todos los pagos del filtro, sin paginar (Excel). */
export async function getAllInsurerPayments(scope: Scope, f: Window) {
  const { from, values } = paymentScope(scope, f);
  return (await getDbPool().query<InsurerPaymentRow>(`select ${COLUMNS} ${from} ${ORDER}`, values)).rows;
}

/**
 * Concilia (o quita la conciliación de) pagos de la aseguradora. Solo cambia los
 * que están en el estado contrario; si el número no coincide con lo confirmado
 * en pantalla, no cambia nada. Marca interna: no toca montos ni estados.
 */
export async function reconcilePayments(actor: { insurerId: string; userId: string }, input: ReconcileInput) {
  let target: { from: string; values: unknown[]; extra: string };
  if (input.selection.mode === "all") {
    const f = input.selection.filters;
    const { scope } = await resolveInsurerSummaryScope(actor.insurerId, { canal: f.channel ?? undefined, productos: f.products });
    const base = paymentScope({ ...scope, insurerId: actor.insurerId }, f);
    target = { ...base, extra: `and not (pa.id = any($8::uuid[]))` };
    target.values = [...base.values, input.selection.exclude];
  } else {
    const base = paymentScope({ insurerId: actor.insurerId, channelId: null, productIds: [] }, { from: "1900-01-01", to: "2999-12-31", reconciliation: "TODOS", method: "TODOS" });
    target = { ...base, extra: `and pa.id = any($8::uuid[])` };
    target.values = [...base.values, input.selection.ids];
  }
  const state = input.reconcile ? "pa.conciliado_en is null" : "pa.conciliado_en is not null";
  const n = target.values.length;

  const conn = await getDbPool().connect();
  try {
    await conn.query("begin");
    const changed = await conn.query<{ id: string; before_at: string | null; before_by: string | null; after_at: string | null }>(
      `with picked as (
         select pa.id, pa.conciliado_en, pa.conciliado_por_id ${target.from} ${target.extra} and ${state}
         for update of pa
       )
       update pago set conciliado_en = ${input.reconcile ? "now()" : "null"}, conciliado_por_id = ${input.reconcile ? `$${n + 1}::uuid` : "null"}
       from picked where pago.id = picked.id
       returning pago.id, picked.conciliado_en::text as before_at, picked.conciliado_por_id::text as before_by, pago.conciliado_en::text as after_at`,
      input.reconcile ? [...target.values, actor.userId] : target.values,
    );
    if (!changed.rows.length) throw new ReconcileError(input.reconcile ? "No hay pagos por conciliar en la selección." : "No hay pagos conciliados en la selección.");
    if (changed.rows.length !== input.expectedCount) {
      throw new ReconcileError("Los pagos cambiaron desde la consulta. Actualiza y revisa la selección antes de reintentar.");
    }
    await conn.query(
      `insert into auditoria (entidad, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
       select 'PAGO', u.id, 'EDICION',
         jsonb_build_object('conciliado_en', u.before_at, 'conciliado_por_id', u.before_by),
         jsonb_build_object('conciliado_en', u.after_at, 'conciliado_por_id', $4::uuid), $5::uuid
       from unnest($1::uuid[], $2::text[], $3::text[], $6::text[]) as u(id, before_at, before_by, after_at)`,
      [changed.rows.map((r) => r.id), changed.rows.map((r) => r.before_at), changed.rows.map((r) => r.before_by),
        input.reconcile ? actor.userId : null, actor.userId, changed.rows.map((r) => r.after_at)],
    );
    await conn.query("commit");
    return changed.rows.length;
  } catch (error) {
    await conn.query("rollback");
    throw error;
  } finally {
    conn.release();
  }
}
