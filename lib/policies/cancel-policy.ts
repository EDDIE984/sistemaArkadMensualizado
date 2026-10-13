import "server-only";

import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/db/pool";

/*
 * Cancelación de pólizas del canal y nivelación (reglas 18 y 19 de
 * PLATAFORMA_SEGUROS_MODELO_ER.md). Las cuotas desde el mes de cancelación
 * quedan CANCELADA y se registra la nivelación (interna) de esas cuotas.
 */

export class CancellationError extends Error {}

type Queryable = Pick<PoolClient, "query">;

export type CancellationPreview = {
  policyId: string;
  policyNumber: string;
  client: string;
  identification: string | null;
  plate: string | null;
  product: string;
  issuedOn: string;
  month: string; // aaaa-mm-01
  from: number;
  to: number;
  count: number;
  firstDue: string;
};

/** Valor interno: nunca se envía al navegador. */
type Resolved = CancellationPreview & { quoteId: string; leveling: string };

/** Normaliza "aaaa-mm", "aaaa-mm-dd", "mm/aaaa" o "dd/mm/aaaa" al primer día del mes (aaaa-mm-01). */
export function toMonthStart(value: string): string | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
  if (m) return valid(m[1], m[2]);
  m = v.match(/^(?:\d{1,2}[/-])?(\d{1,2})[/-](\d{4})$/);
  if (m) return valid(m[2], m[1]);
  return null;
}
function valid(year: string, month: string) {
  const n = Number(month);
  return n >= 1 && n <= 12 ? `${year}-${String(n).padStart(2, "0")}-01` : null;
}

/** Valida la cancelación de una póliza del canal y calcula las cuotas afectadas y la nivelación. No escribe. */
async function resolveCancellation(conn: Queryable, channelId: string, input: { policyId: string; month: string }, lock = false): Promise<Resolved> {
  const month = toMonthStart(input.month);
  if (!month) throw new CancellationError("Mes de cancelación inválido (usa mm/aaaa).");

  const policy = await conn.query<{
    id: string; numero_poliza: string; estado: string; fecha_emision: string; cotizacion_id: string;
    cliente: string; identificacion: string | null; placa: string | null; producto: string;
  }>(
    `select po.id, po.numero_poliza, po.estado, po.fecha_emision::text, po.cotizacion_id,
            cl.nombre_razon_social as cliente, cl.identificacion, v.placa, p.nombre as producto
     from poliza po
     join cotizacion c on c.id = po.cotizacion_id
     join cliente cl on cl.id = c.cliente_id
     left join vehiculo v on v.id = c.vehiculo_id
     join producto p on p.id = c.producto_id
     where po.id = $1 and c.canal_id = $2
     ${lock ? "for update of po" : ""}`,
    [input.policyId, channelId],
  );
  const po = policy.rows[0];
  if (!po) throw new CancellationError("La póliza no existe o no pertenece a tu canal.");
  if (po.estado === "CANCELADA") throw new CancellationError(`La póliza ${po.numero_poliza} ya está cancelada.`);
  if (po.estado !== "VIGENTE") throw new CancellationError(`La póliza ${po.numero_poliza} está ${po.estado.toLowerCase()}; solo se cancelan pólizas vigentes.`);
  if (month < `${po.fecha_emision.slice(0, 7)}-01`) throw new CancellationError("El mes de cancelación es anterior al mes de emisión de la póliza.");

  const installments = await conn.query<{ numero_cuota: number; fecha_vencimiento: string; estado: string }>(
    `select numero_cuota, fecha_vencimiento::text, estado from tabla_cobranza where poliza_id = $1 order by numero_cuota`,
    [po.id],
  );
  const cancelled = installments.rows.filter((r) => r.fecha_vencimiento >= month);
  if (!cancelled.length) throw new CancellationError("El mes de cancelación está fuera de la vigencia: no hay cuotas desde ese mes.");
  const paid = cancelled.filter((r) => r.estado === "PAGADO").map((r) => r.numero_cuota);
  if (paid.length) {
    throw new CancellationError(`${paid.length === 1 ? "La cuota" : "Las cuotas"} ${paid.join(", ")} ya ${paid.length === 1 ? "está pagada" : "están pagadas"}; elige un mes posterior a la última cuota pagada.`);
  }
  const from = cancelled[0].numero_cuota;
  const to = cancelled[cancelled.length - 1].numero_cuota;

  const leveling = await conn.query<{ valor: string }>(
    `select coalesce(sum(nivelacion_acumulada), 0)::text as valor
     from amortizacion_mensual where cotizacion_id = $1 and mes between $2 and $3`,
    [po.cotizacion_id, from, to],
  );

  return {
    policyId: po.id,
    policyNumber: po.numero_poliza,
    client: po.cliente,
    identification: po.identificacion,
    plate: po.placa,
    product: po.producto,
    issuedOn: po.fecha_emision,
    month,
    from,
    to,
    count: cancelled.length,
    firstDue: cancelled[0].fecha_vencimiento,
    quoteId: po.cotizacion_id,
    leveling: leveling.rows[0].valor,
  };
}

function withoutInternals(r: Resolved): CancellationPreview {
  const { quoteId, leveling, ...preview } = r;
  void quoteId;
  void leveling;
  return preview;
}

/** Vista previa para el canal (sin el valor de nivelación). */
export async function previewPolicyCancellation(channelId: string, input: { policyId: string; month: string }): Promise<CancellationPreview> {
  return withoutInternals(await resolveCancellation(getDbPool(), channelId, input));
}

export type CancellationInput = { policyId: string; month: string; reason?: string | null; origin: "INDIVIDUAL" | "EXCEL"; channelId: string; userId: string };

/** Cancela la póliza dentro de la transacción de `conn` (el llamador hace begin/commit). */
export async function cancelPolicyWithConnection(conn: PoolClient, input: CancellationInput): Promise<CancellationPreview> {
  const r = await resolveCancellation(conn, input.channelId, input, true);
  await conn.query(
    `update tabla_cobranza set estado = 'CANCELADA' where poliza_id = $1 and numero_cuota between $2 and $3`,
    [r.policyId, r.from, r.to],
  );
  await conn.query(`update poliza set estado = 'CANCELADA', fecha_cancelacion = $2 where id = $1`, [r.policyId, r.month]);
  const inserted = await conn.query<{ id: string }>(
    `insert into cancelacion_poliza (poliza_id, canal_id, mes_cancelacion, cuota_desde, cuotas_canceladas, motivo, origen, usuario_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [r.policyId, input.channelId, r.month, r.from, r.count, input.reason?.trim() || null, input.origin, input.userId],
  );
  await conn.query(
    `insert into nivelacion (cancelacion_id, poliza_id, cuota_desde, cuota_hasta, valor) values ($1, $2, $3, $4, $5)`,
    [inserted.rows[0].id, r.policyId, r.from, r.to, r.leveling],
  );
  await conn.query(
    `insert into auditoria (entidad, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
     values ('POLIZA', $1::uuid, 'CAMBIO_ESTADO', jsonb_build_object('estado', 'VIGENTE'),
             jsonb_build_object('estado', 'CANCELADA', 'mes_cancelacion', $2::text, 'cuota_desde', $3::int,
                                'cuotas_canceladas', $4::int, 'origen', $5::text, 'cancelacion_id', $6::text), $7::uuid)`,
    [r.policyId, r.month, r.from, r.count, input.origin, inserted.rows[0].id, input.userId],
  );
  return withoutInternals(r);
}

/** Cancelación individual en su propia transacción. */
export async function cancelPolicy(input: CancellationInput) {
  const conn = await getDbPool().connect();
  try {
    await conn.query("begin");
    const result = await cancelPolicyWithConnection(conn, input);
    await conn.query("commit");
    return result;
  } catch (error) {
    await conn.query("rollback");
    if ((error as { code?: string })?.code === "23505") throw new CancellationError("Esta póliza ya tiene una cancelación registrada.");
    throw error;
  } finally {
    conn.release();
  }
}

/** Pólizas del canal que coinciden con cédula + placa + producto (clave de la plantilla Excel). */
export async function findPoliciesForCancellation(conn: Queryable, channelId: string, key: { identification: string; plate: string; productId: string }) {
  const { rows } = await conn.query<{ id: string; numero_poliza: string; estado: string }>(
    `select po.id, po.numero_poliza, po.estado
     from poliza po
     join cotizacion c on c.id = po.cotizacion_id
     join cliente cl on cl.id = c.cliente_id
     join vehiculo v on v.id = c.vehiculo_id
     where c.canal_id = $1 and c.producto_id = $2 and cl.identificacion = $3
       and upper(regexp_replace(coalesce(v.placa, ''), '[^A-Za-z0-9]', '', 'g')) = $4
     order by po.fecha_emision desc`,
    [channelId, key.productId, key.identification, key.plate.replace(/[^a-z0-9]/gi, "").toUpperCase()],
  );
  return rows;
}
