import "server-only";

import { getDbPool } from "@/lib/db/pool";

/**
 * Filtro de búsqueda de Órdenes de Emisión del canal: cliente, cédula/RUC,
 * marca, modelo, "marca modelo", placa (sin guiones ni espacios), producto y
 * aseguradora. `$1` canal, `$2` patrón ILIKE, `$3` patrón de placa o null.
 */
const MATCH = `
  (cl.nombre_razon_social ilike $2
   or cl.identificacion ilike $2
   or regexp_replace(coalesce(v.placa, ''), '[^A-Za-z0-9]', '', 'g') ilike $3
   or v.marca ilike $2
   or v.modelo ilike $2
   or concat_ws(' ', v.marca, v.modelo) ilike $2
   or p.nombre ilike $2
   or a.nombre_comercial ilike $2
   or a.razon_social ilike $2)`;

const FROM = `
  from cotizacion c
  join cliente cl on cl.id = c.cliente_id
  left join vehiculo v on v.id = c.vehiculo_id
  left join producto p on p.id = c.producto_id
  left join aseguradora a on a.id = c.aseguradora_id`;

function params(channelId: string, term: string) {
  // Para la placa se ignoran guiones y espacios; si no queda nada, ese criterio no aplica (null).
  const plate = term.replace(/[^A-Za-z0-9]/g, "");
  return [channelId, `%${term}%`, plate ? `%${plate}%` : null];
}

/** IDs de Órdenes de Emisión pendientes del canal que coinciden con el texto. */
export async function searchPendingOrderIds(channelId: string, term: string) {
  const { rows } = await getDbPool().query<{ id: string }>(
    `select c.id ${FROM} where c.canal_id = $1 and c.estado = 'PENDIENTE' and ${MATCH}`,
    params(channelId, term),
  );
  return rows.map((r) => r.id);
}

export type ChannelOrderResult = {
  id: string;
  client: string;
  identification: string | null;
  email: string | null;
  phone: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  product: string | null;
  insurer: string | null;
  status: string;
  policyNumber: string | null;
  policyStatus: string | null;
  certificateNumber: string | null;
  monthlyPayment: string;
  start: string | null;
  end: string | null;
};

export const ORDER_SEARCH_LIMIT = 50;

/** Todas las Órdenes de Emisión del canal que coinciden con el texto (con o sin certificado). */
export async function searchRegisteredOrders(channelId: string, term: string) {
  const { rows } = await getDbPool().query<ChannelOrderResult>(
    `select c.id, cl.nombre_razon_social as client, cl.identificacion as identification, cl.email, cl.telefono as phone,
            v.marca as brand, v.modelo as model, v.anio as year, v.placa as plate,
            p.nombre as product, a.nombre_comercial as insurer, c.estado as status,
            po.numero_poliza as "policyNumber", po.estado as "policyStatus", cc.numero as "certificateNumber",
            c.cuota_fija_mensual::text as "monthlyPayment",
            c.fecha_inicio_vigencia::text as start, c.fecha_fin_vigencia::text as "end"
     ${FROM}
     left join certificado_cobertura cc on cc.cotizacion_id = c.id
     left join poliza po on po.cotizacion_id = c.id
     where c.canal_id = $1 and ${MATCH}
     order by coalesce(cc.enviado_en, c.creado_en) desc
     limit ${ORDER_SEARCH_LIMIT + 1}`,
    params(channelId, term),
  );
  return { orders: rows.slice(0, ORDER_SEARCH_LIMIT), more: rows.length > ORDER_SEARCH_LIMIT };
}

export type ActivePolicyResult = {
  policyId: string;
  policyNumber: string;
  client: string;
  identification: string | null;
  brand: string | null;
  model: string | null;
  plate: string | null;
  product: string | null;
  issuedOn: string;
  start: string;
  end: string;
};

/** Pólizas VIGENTES del canal que coinciden con el texto (búsqueda también por número de póliza). */
export async function searchActivePolicies(channelId: string, term: string) {
  const { rows } = await getDbPool().query<ActivePolicyResult>(
    `select po.id as "policyId", po.numero_poliza as "policyNumber", cl.nombre_razon_social as client, cl.identificacion as identification,
            v.marca as brand, v.modelo as model, v.placa as plate, p.nombre as product,
            po.fecha_emision::text as "issuedOn", po.fecha_inicio_vigencia::text as start, po.fecha_fin_vigencia::text as "end"
     ${FROM}
     join poliza po on po.cotizacion_id = c.id
     where c.canal_id = $1 and po.estado = 'VIGENTE' and (${MATCH} or po.numero_poliza ilike $2)
     order by po.fecha_emision desc
     limit ${ORDER_SEARCH_LIMIT + 1}`,
    params(channelId, term),
  );
  return { policies: rows.slice(0, ORDER_SEARCH_LIMIT), more: rows.length > ORDER_SEARCH_LIMIT };
}
