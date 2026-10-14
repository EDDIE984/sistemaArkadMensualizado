import "server-only";
import { getDbPool } from "@/lib/db/pool";
import { dateOnly } from "@/lib/channel/schemas";
import { paymentInputSchema, type PaymentInput } from "@/lib/payments/types";
import { payableSql, paymentScope } from "@/lib/payments/queries";

export class PaymentError extends Error {}
type Actor = { channelId: string; insurerId: string; userId: string };

export async function registerPayments(actor: Actor, raw: PaymentInput) {
  const parsed = paymentInputSchema.safeParse(raw);
  if (!parsed.success) throw new PaymentError("Revisa la selección y los datos del pago (máximo 10.000 cuotas por operación).");
  const input = parsed.data;
  const today = dateOnly(new Date());
  if (input.date > today) throw new PaymentError("La fecha de pago no puede ser futura.");
  const conn = await getDbPool().connect();
  try {
    await conn.query("begin");
    let ids: string[];
    if (input.selection.mode === "all") {
      const scope = paymentScope(actor.channelId, actor.insurerId, input.selection.filters, today);
      const exclude = input.selection.exclude;
      const result = await conn.query<{ id: string }>(
        `select t.id ${scope.from} and ${payableSql}
           and not exists (select 1 from unnest($8::uuid[], $9::int[]) as x(policy_id, from_installment)
                           where x.policy_id = t.poliza_id and t.numero_cuota >= x.from_installment)
         order by t.id limit 10001`,
        [...scope.values, exclude.map((e) => e.policyId), exclude.map((e) => e.from)],
      );
      ids = result.rows.map((r) => r.id);
    } else {
      ids = [...new Set(input.selection.ids)];
    }
    if (!ids.length || ids.length > 10_000 || ids.length !== input.expectedCount) {
      throw new PaymentError("La selección cambió o supera 10.000 cuotas. Actualiza la consulta y vuelve a seleccionar.");
    }
    // Cancellation also locks the policy first. Deterministic ordering avoids
    // concurrent batches paying/cancelling the same installments or deadlocking.
    const policies = await conn.query<{ numero_poliza: string; fecha_emision: string }>(
      `select po.id, po.numero_poliza, po.fecha_emision::text from poliza po join cotizacion c on c.id = po.cotizacion_id
       where c.canal_id = $2 and c.aseguradora_id = $3
         and exists (select 1 from tabla_cobranza t where t.poliza_id = po.id and t.id = any($1::uuid[]))
       order by po.id for update of po`, [ids, actor.channelId, actor.insurerId],
    );
    const { rows } = await conn.query<{ id: string; estado: string; balance: string }>(
      `select t.id, t.estado, (t.monto - coalesce((select sum(pa.monto_pagado) from pago pa
         where pa.cobranza_id = t.id and pa.estado = 'REGISTRADO'),0))::text as balance
       from tabla_cobranza t join poliza po on po.id = t.poliza_id join cotizacion c on c.id = po.cotizacion_id
       where t.id = any($1::uuid[]) and c.canal_id = $2 and c.aseguradora_id = $3
       order by t.id for update of t`, [ids, actor.channelId, actor.insurerId],
    );
    if (rows.length !== ids.length || rows.some((r) => !["PENDIENTE", "VENCIDO"].includes(r.estado) || Number(r.balance) <= 0)) {
      throw new PaymentError("Hay cuotas pagadas, canceladas o ajenas a tu canal. Actualiza la consulta antes de continuar.");
    }
    const early = policies.rows.filter((p) => input.date < p.fecha_emision);
    if (early.length) {
      const p = early[0];
      throw new PaymentError(`La fecha de pago no puede ser anterior a la emisión de la póliza ${p.numero_poliza} (${p.fecha_emision.split("-").reverse().join("/")}).`);
    }
    // Orden: ninguna cuota por cobrar puede quedar sin pagar antes de una cuota pagada en este lote.
    const gaps = await conn.query<{ numero_poliza: string; numero_cuota: number }>(
      `select po.numero_poliza, t.numero_cuota
       from tabla_cobranza t join poliza po on po.id = t.poliza_id
       where t.estado in ('PENDIENTE','VENCIDO') and not (t.id = any($1::uuid[]))
         and exists (select 1 from tabla_cobranza s where s.id = any($1::uuid[]) and s.poliza_id = t.poliza_id and s.numero_cuota > t.numero_cuota)
       order by po.numero_poliza, t.numero_cuota limit 1`, [ids],
    );
    if (gaps.rows.length) {
      const g = gaps.rows[0];
      throw new PaymentError(`Las cuotas se pagan en orden: primero debe pagarse la cuota ${g.numero_cuota} de la póliza ${g.numero_poliza}.`);
    }
    const cents = rows.reduce((sum, r) => sum + Math.round(Number(r.balance) * 100), 0);
    if (cents !== input.expectedCents) throw new PaymentError("El saldo cambió desde la consulta. Actualiza y revisa el total antes de pagar.");
    ids = rows.map((r) => r.id);
    const paid = await conn.query<{ id: string; cobranza_id: string; monto_pagado: string }>(
      `insert into pago (cobranza_id, fecha_pago, monto_pagado, metodo_pago, referencia, usuario_registro_id)
       select u.id, $2::date, u.balance, $3, $4, $5::uuid
       from unnest($1::uuid[], $6::numeric[]) as u(id, balance)
       returning id, cobranza_id, monto_pagado::text`,
      [ids, input.date, input.method, input.reference || null, actor.userId, rows.map((r) => r.balance)],
    );
    await conn.query(`update tabla_cobranza set estado = 'PAGADO' where id = any($1::uuid[])`, [ids]);
    await conn.query(
      `insert into auditoria (entidad, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
       select 'PAGO', u.id, 'CREACION', null,
         jsonb_build_object('cobranza_id',u.cobranza_id,'monto_pagado',u.monto,'fecha_pago',$4::text,'metodo_pago',$5::text,'referencia',$6::text), $7::uuid
       from unnest($1::uuid[], $2::uuid[], $3::numeric[]) as u(id, cobranza_id, monto)`,
      [paid.rows.map((r) => r.id), paid.rows.map((r) => r.cobranza_id), paid.rows.map((r) => r.monto_pagado), input.date, input.method, input.reference || null, actor.userId],
    );
    await conn.query(
      `insert into auditoria (entidad, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
       select 'TABLA_COBRANZA', u.id, 'CAMBIO_ESTADO', jsonb_build_object('estado',u.estado),
         jsonb_build_object('estado','PAGADO'), $3::uuid
       from unnest($1::uuid[], $2::text[]) as u(id, estado)`, [ids, rows.map((r) => r.estado), actor.userId],
    );
    await conn.query("commit");
    return { count: rows.length, cents };
  } catch (error) {
    await conn.query("rollback");
    throw error;
  } finally {
    conn.release();
  }
}
