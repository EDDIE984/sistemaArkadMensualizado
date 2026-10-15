import "server-only";

import { getDbPool } from "@/lib/db/pool";

/*
 * Detalle de una Orden de Emisión / póliza (cliente, vehículo, producto,
 * vigencia, coberturas, deducibles, cuotas con sus pagos y envíos del
 * certificado). Lo comparten el canal (solo sus órdenes) y la aseguradora
 * (solo las suyas): el acceso se restringe en el `where`.
 */

export type OrderDetail = {
  id: string; estado: string; creado_en: string; anios_vigencia: number; inicio: string | null; fin: string | null; total_dias: number | null;
  tasa_promedio: string; nivel_riesgo: number; cuota_fija_mensual: string;
  cliente: string; identificacion: string | null; email: string | null; telefono: string | null; direccion: string | null;
  fecha_nacimiento: string | null; genero: string | null; estado_civil: string | null; ciudad: string | null;
  marca: string; modelo: string; anio: number | null; color: string | null; placa: string | null; uso: string | null; estado_vh: string | null;
  valor_asegurado: string; tipo_vehiculo: string | null;
  producto: string; aseguradora: string; canal: string | null; agente: string | null;
  cert_id: string | null; cert_numero: string | null; cert_canal: string | null; cert_destino: string | null; cert_enviado_en: string | null; cert_usuario: string | null;
  poliza_numero: string | null; poliza_estado: string | null; poliza_emision: string | null; poliza_inicio: string | null; poliza_fin: string | null;
  poliza_cancelacion: string | null; cancel_cuota_desde: number | null; cancel_motivo: string | null; cancel_registrada: string | null;
  cancel_tipo: "NORMAL" | "PERDIDA_TOTAL" | null; cancel_siniestro: string | null; cancel_reclamo: string | null;
};
/** Desglose interno de la nivelación: solo se carga para la aseguradora. */
export type Leveling = { tipo: "NORMAL" | "PERDIDA_TOTAL"; cuota_desde: number; cuota_hasta: number; valor: string; prima_pendiente: string | null; nivelacion_acumulada: string | null };
export type Installment = { numero_cuota: number; fecha_vencimiento: string; monto: string; estado: string; pagos: { fecha: string; monto: string; metodo: string | null; referencia: string | null }[] };
export type Send = { kind: string; channel: string; destination: string; at: string; user: string | null };

export type OrderAccess = { channelId: string } | { insurerId: string };

export async function getOrderDetail(id: string, access: OrderAccess) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = getDbPool();
  // Canal: por `cotizacion.canal_id` (como siempre). Aseguradora: sus cotizaciones con póliza emitida.
  const scope = "channelId" in access ? "c.canal_id = $2" : "c.aseguradora_id = $2 and po.id is not null";
  const { rows } = await db.query<OrderDetail>(
    `select c.id, c.estado, c.creado_en::text, c.anios_vigencia, c.fecha_inicio_vigencia::text as inicio, c.fecha_fin_vigencia::text as fin, c.total_dias,
            c.tasa_promedio::text, c.nivel_riesgo, c.cuota_fija_mensual::text,
            cl.nombre_razon_social as cliente, cl.identificacion, cl.email, cl.telefono, cl.direccion, cl.fecha_nacimiento::text,
            cl.genero, cl.estado_civil, ci.nombre as ciudad,
            v.marca, v.modelo, v.anio, v.color, v.placa, v.uso, v.estado_vh, v.valor_asegurado::text, tv.descripcion as tipo_vehiculo,
            p.nombre as producto, a.nombre_comercial as aseguradora, coalesce(ca.nombre, pca.nombre) as canal, u.nombre as agente,
            cc.id as cert_id, cc.numero as cert_numero, cc.canal_envio as cert_canal, cc.destino as cert_destino,
            cc.enviado_en::text as cert_enviado_en, cu.nombre as cert_usuario,
            po.numero_poliza as poliza_numero, po.estado as poliza_estado, po.fecha_emision::text as poliza_emision,
            po.fecha_inicio_vigencia::text as poliza_inicio, po.fecha_fin_vigencia::text as poliza_fin,
            po.fecha_cancelacion::text as poliza_cancelacion, cp.cuota_desde as cancel_cuota_desde, cp.motivo as cancel_motivo,
            cp.creado_en::text as cancel_registrada, cp.tipo as cancel_tipo, cp.fecha_siniestro::text as cancel_siniestro,
            cp.numero_reclamo as cancel_reclamo
     from cotizacion c
     left join certificado_cobertura cc on cc.cotizacion_id = c.id
     join cliente cl on cl.id = c.cliente_id
     left join ciudad ci on ci.id = coalesce(cl.ciudad_id, c.ciudad_id)
     join vehiculo v on v.id = c.vehiculo_id
     left join tipo_vehiculo tv on tv.id = v.tipo_vehiculo_id
     join producto p on p.id = c.producto_id
     left join canal pca on pca.id = p.canal_id
     join aseguradora a on a.id = c.aseguradora_id
     left join canal ca on ca.id = c.canal_id
     left join usuario u on u.id = c.usuario_id
     left join usuario cu on cu.id = cc.enviado_por_usuario_id
     left join poliza po on po.cotizacion_id = c.id
     left join cancelacion_poliza cp on cp.poliza_id = po.id
     where c.id = $1 and ${scope}`,
    [id, "channelId" in access ? access.channelId : access.insurerId],
  );
  const order = rows[0];
  if (!order) return null;

  const [coverages, deductibles, schedule, installments, resends, leveling] = await Promise.all([
    db.query<{ name: string; value: string | null }>(
      `select cb.nombre as name, coalesce(cc.valor_aplicado, pc.valor_o_porcentaje)::text as value
       from cotizacion_cobertura cc join producto_cobertura pc on pc.id = cc.producto_cobertura_id
       join cobertura_base cb on cb.id = pc.cobertura_base_id
       where cc.cotizacion_id = $1 order by pc.orden, cb.nombre`, [id]),
    db.query<{ name: string; type: string; value: string; coverage: string | null }>(
      `select db.nombre as name, db.tipo_calculo as type, cd.valor_aplicado::text as value, cb.nombre as coverage
       from cotizacion_deducible cd
       join producto_deducible pd on pd.id = cd.producto_deducible_id
       join deducible_base db on db.id = pd.deducible_base_id
       left join cotizacion_cobertura cc on cc.id = cd.cotizacion_cobertura_id
       left join producto_cobertura pc on pc.id = cc.producto_cobertura_id
       left join cobertura_base cb on cb.id = pc.cobertura_base_id
       where cd.cotizacion_id = $1 order by cb.nombre nulls first, db.nombre`, [id]),
    db.query<{ mes: number; valor_asegurado_mes: string; cuota_fija: string }>(
      `select mes, valor_asegurado_mes::text, cuota_fija::text from amortizacion_mensual where cotizacion_id = $1 order by mes`, [id]),
    order.poliza_numero
      ? db.query<Installment>(
          `select t.numero_cuota, t.fecha_vencimiento::text, t.monto::text, t.estado,
                  coalesce(json_agg(json_build_object('fecha', pg.fecha_pago::text, 'monto', pg.monto_pagado::text, 'metodo', pg.metodo_pago, 'referencia', pg.referencia)
                    order by pg.fecha_pago) filter (where pg.id is not null), '[]') as pagos
           from tabla_cobranza t
           join poliza po on po.id = t.poliza_id
           left join pago pg on pg.cobranza_id = t.id and pg.estado = 'REGISTRADO'
           where po.cotizacion_id = $1
           group by t.id order by t.numero_cuota`, [id])
      : Promise.resolve({ rows: [] as Installment[] }),
    !order.cert_id ? Promise.resolve({ rows: [] as { canal: string; destino: string; creado_en: string; usuario: string | null; correccion: boolean }[] }) : db.query<{ canal: string; destino: string; creado_en: string; usuario: string | null; correccion: boolean }>(
      `select au.datos_nuevos->>'canal' as canal, au.datos_nuevos->>'destino' as destino, au.creado_en::text, u.nombre as usuario,
              coalesce((au.datos_nuevos->>'correccion_orden')::boolean, false) as correccion
       from auditoria au left join usuario u on u.id = au.usuario_id
       where au.entidad = 'CERTIFICADO_COBERTURA' and au.entidad_id = $1
         and (coalesce((au.datos_nuevos->>'reenvio')::boolean, false) or coalesce((au.datos_nuevos->>'correccion_orden')::boolean, false))
       order by au.creado_en desc`, [order.cert_id]),
    // La nivelación es interna: el canal nunca la recibe.
    "insurerId" in access && order.poliza_cancelacion
      ? db.query<Leveling>(
          `select n.tipo, n.cuota_desde, n.cuota_hasta, n.valor::text, n.prima_pendiente::text, n.nivelacion_acumulada::text
           from nivelacion n join poliza po on po.id = n.poliza_id where po.cotizacion_id = $1`, [id])
      : Promise.resolve({ rows: [] as Leveling[] }),
  ]);

  // Una corrección de la orden reescribe el registro del certificado con su envío; en ese
  // caso el envío inicial ya no está disponible y la corrección figura en la auditoría.
  const corrected = resends.rows.some((r) => r.correccion);
  const sends: Send[] = order.cert_id ? [
    ...resends.rows.map((r) => ({ kind: r.correccion ? "Certificado corregido" : "Reenvío", channel: r.canal, destination: r.destino, at: r.creado_en, user: r.usuario })),
    ...(corrected ? [] : [{ kind: "Envío original", channel: order.cert_canal!, destination: order.cert_destino!, at: order.cert_enviado_en!, user: order.cert_usuario }]),
  ] : [];

  return { order, coverages: coverages.rows, deductibles: deductibles.rows, schedule: schedule.rows, installments: installments.rows, sends, leveling: leveling.rows[0] ?? null };
}

export type OrderDetailData = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;
