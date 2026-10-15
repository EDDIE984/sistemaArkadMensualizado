import "server-only";

import { z } from "zod";
import { getDbPool } from "@/lib/db/pool";
import type { SummaryScope } from "@/lib/channel/summary";

/*
 * Pólizas emitidas de la aseguradora. Alcance como el Resumen: canal dueño del
 * producto (`producto.canal_id`) y productos validados. La fecha del filtro es
 * `poliza.fecha_emision`. Lista, totales y Excel comparten el mismo `from`.
 */

export const POLICY_STATES = [["TODAS", "Todas"], ["VIGENTE", "Vigentes"], ["VENCIDA", "Vencidas"], ["CANCELADA", "Canceladas"]] as const;

export const policyFiltersSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  status: z.enum(["TODAS", "VIGENTE", "VENCIDA", "CANCELADA"]),
  q: z.string().trim().max(100),
}).refine((v) => v.from <= v.to);
export type PolicyFilters = z.infer<typeof policyFiltersSchema>;

type Scope = SummaryScope & { insurerId: string };

/** $1 aseguradora, $2 canal, $3 productos, $4/$5 emisión, $6 estado, $7 texto, $8 placa. */
function policyScope(scope: Scope, f: PolicyFilters) {
  const plate = f.q.replace(/[^A-Za-z0-9]/g, "");
  const values = [scope.insurerId, scope.channelId, scope.productIds, f.from, f.to, f.status, f.q ? `%${f.q}%` : null, plate ? `%${plate}%` : null];
  const from = `from poliza po
    join cotizacion c on c.id = po.cotizacion_id
    join producto p on p.id = c.producto_id
    join cliente cl on cl.id = c.cliente_id
    join vehiculo v on v.id = c.vehiculo_id
    left join canal ch on ch.id = p.canal_id
    left join ciudad ci on ci.id = coalesce(cl.ciudad_id, c.ciudad_id)
    cross join lateral (
      select count(*)::int as installments,
             count(*) filter (where t.estado = 'PAGADO')::int as paid,
             count(*) filter (where t.estado in ('PENDIENTE', 'VENCIDO') and t.fecha_vencimiento < (now() at time zone 'America/Guayaquil')::date)::int as overdue,
             coalesce(sum(t.monto) filter (where t.estado <> 'CANCELADA'), 0)::float as billed,
             coalesce((select sum(pa.monto_pagado) from pago pa join tabla_cobranza tp on tp.id = pa.cobranza_id where tp.poliza_id = po.id and pa.estado = 'REGISTRADO'), 0)::float as "paidAmount"
      from tabla_cobranza t where t.poliza_id = po.id
    ) k
    where c.aseguradora_id = $1
      and ($2::uuid is null or p.canal_id = $2)
      and (cardinality($3::uuid[]) = 0 or c.producto_id = any($3::uuid[]))
      and po.fecha_emision between $4::date and $5::date
      and ($6 = 'TODAS' or po.estado = $6)
      and ($7::text is null
        or cl.nombre_razon_social ilike $7 or cl.identificacion ilike $7 or po.numero_poliza ilike $7
        or v.marca ilike $7 or v.modelo ilike $7 or concat_ws(' ', v.marca, v.modelo) ilike $7
        or ($8::text is not null and regexp_replace(coalesce(v.placa, ''), '[^A-Za-z0-9]', '', 'g') ilike $8))`;
  return { from, values };
}

export type PolicyRow = {
  quoteId: string; policy: string; status: string; issued: string; start: string; end: string;
  client: string; identification: string | null; email: string | null; phone: string | null; city: string | null;
  brand: string; model: string; year: number | null; color: string | null; plate: string | null; insuredValue: number; use: string | null;
  product: string; channel: string | null; years: number; riskLevel: number; rate: number; monthly: number;
  installments: number; paid: number; overdue: number; billed: number; paidAmount: number;
};

const COLUMNS = `c.id as "quoteId", po.numero_poliza as policy, po.estado as status, po.fecha_emision::text as issued,
  po.fecha_inicio_vigencia::text as start, po.fecha_fin_vigencia::text as "end",
  cl.nombre_razon_social as client, cl.identificacion as identification, cl.email, cl.telefono as phone, ci.nombre as city,
  v.marca as brand, v.modelo as model, v.anio as year, v.color, v.placa as plate, v.valor_asegurado::float as "insuredValue", v.uso as use,
  p.nombre as product, ch.nombre as channel, c.anios_vigencia as years, c.nivel_riesgo as "riskLevel", c.tasa_promedio::float as rate,
  c.cuota_fija_mensual::float as monthly, k.installments, k.paid, k.overdue, k.billed, k."paidAmount"`;
const ORDER = `order by po.fecha_emision desc, po.numero_poliza desc`;

export type PolicySummary = { total: number; active: number; cancelled: number; monthly: number; paidAmount: number; withOverdue: number };

export async function getPolicies(scope: Scope, f: PolicyFilters, page: number, pageSize: number) {
  const db = getDbPool();
  const { from, values } = policyScope(scope, f);
  const totals = await db.query<PolicySummary>(
    `select count(*)::int as total, count(*) filter (where po.estado = 'VIGENTE')::int as active,
       count(*) filter (where po.estado = 'CANCELADA')::int as cancelled,
       coalesce(sum(c.cuota_fija_mensual) filter (where po.estado = 'VIGENTE'), 0)::float as monthly,
       coalesce(sum(k."paidAmount"), 0)::float as "paidAmount", count(*) filter (where k.overdue > 0)::int as "withOverdue"
     ${from}`, values,
  );
  const summary = totals.rows[0];
  const current = Math.min(Math.max(1, page), Math.max(1, Math.ceil(summary.total / pageSize)));
  const rows = await db.query<PolicyRow>(`select ${COLUMNS} ${from} ${ORDER} limit ${pageSize} offset $9`, [...values, (current - 1) * pageSize]);
  return { summary, rows: rows.rows, page: current };
}

export type PolicyCoverageText = { quoteId: string; coverages: string; deductibles: string };
export type PolicyInstallmentRow = {
  policy: string; client: string; installment: number; due: string; amount: number; status: string;
  paidOn: string | null; paidAmount: number; method: string | null; reference: string | null;
};

/** Excel: pólizas con sus condiciones (coberturas y deducibles en texto) y todas sus cuotas con pagos. */
export async function getPoliciesForExport(scope: Scope, f: PolicyFilters) {
  const db = getDbPool();
  const { from, values } = policyScope(scope, f);
  const policies = (await db.query<PolicyRow>(`select ${COLUMNS} ${from} ${ORDER}`, values)).rows;
  const ids = policies.map((p) => p.quoteId);
  const [conditions, installments] = await Promise.all([
    db.query<PolicyCoverageText>(
      `select c.id as "quoteId",
         coalesce((select string_agg(cb.nombre || coalesce(' (' || coalesce(cc.valor_aplicado, pc.valor_o_porcentaje)::text || ')', ''), '; ' order by pc.orden, cb.nombre)
           from cotizacion_cobertura cc join producto_cobertura pc on pc.id = cc.producto_cobertura_id join cobertura_base cb on cb.id = pc.cobertura_base_id
           where cc.cotizacion_id = c.id), '') as coverages,
         coalesce((select string_agg(dbs.nombre || ': ' || cd.valor_aplicado::text || case when dbs.tipo_calculo = 'PORCENTAJE' then ' %' else ' USD' end
             || coalesce(' (' || cbd.nombre || ')', ''), '; ' order by dbs.nombre)
           from cotizacion_deducible cd join producto_deducible pd on pd.id = cd.producto_deducible_id join deducible_base dbs on dbs.id = pd.deducible_base_id
           left join cotizacion_cobertura ccd on ccd.id = cd.cotizacion_cobertura_id left join producto_cobertura pcd on pcd.id = ccd.producto_cobertura_id
           left join cobertura_base cbd on cbd.id = pcd.cobertura_base_id
           where cd.cotizacion_id = c.id), '') as deductibles
       from cotizacion c where c.id = any($1::uuid[])`, [ids]),
    db.query<PolicyInstallmentRow>(
      `select po.numero_poliza as policy, cl.nombre_razon_social as client, t.numero_cuota as installment, t.fecha_vencimiento::text as due,
         t.monto::float as amount, t.estado as status,
         max(pa.fecha_pago)::text as "paidOn", coalesce(sum(pa.monto_pagado), 0)::float as "paidAmount",
         string_agg(distinct pa.metodo_pago, ', ') as method, string_agg(distinct pa.referencia, ', ') as reference
       from tabla_cobranza t
       join poliza po on po.id = t.poliza_id
       join cotizacion c on c.id = po.cotizacion_id
       join cliente cl on cl.id = c.cliente_id
       left join pago pa on pa.cobranza_id = t.id and pa.estado = 'REGISTRADO'
       where c.id = any($1::uuid[])
       group by po.numero_poliza, po.fecha_emision, cl.nombre_razon_social, t.id
       order by po.fecha_emision desc, po.numero_poliza desc, t.numero_cuota`, [ids]),
  ]);
  return { policies, conditions: new Map(conditions.rows.map((r) => [r.quoteId, r])), installments: installments.rows };
}

const isoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());

/**
 * Filtros desde la URL (`desde`, `hasta`, `estado`, `q`). Por defecto: emisiones
 * del año en curso. `valid` es false si las fechas no son correctas.
 */
export function readPolicyFilters(get: (key: string) => string | undefined) {
  const today = isoToday();
  const defaults: PolicyFilters = { from: `${today.slice(0, 4)}-01-01`, to: today, status: "TODAS", q: "" };
  const parsed = policyFiltersSchema.safeParse({
    from: get("desde") || defaults.from, to: get("hasta") || defaults.to, status: get("estado") || "TODAS", q: get("q") ?? "",
  });
  return { filters: parsed.success ? parsed.data : defaults, valid: parsed.success };
}

/** Query de los filtros vigentes, con canal y productos ya validados. */
export function policiesQuery(f: PolicyFilters, channelId: string | null, productIds: string[], extra: Record<string, string> = {}) {
  const query = new URLSearchParams({ desde: f.from, hasta: f.to, estado: f.status, ...(f.q ? { q: f.q } : {}), ...extra });
  if (channelId) query.set("canal", channelId);
  productIds.forEach((id) => query.append("productos", id));
  return query.toString();
}
