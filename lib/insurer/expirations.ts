import "server-only";

import { z } from "zod";
import { getDbPool } from "@/lib/db/pool";
import type { SummaryScope } from "@/lib/channel/summary";

/*
 * Vencimientos de pólizas de la aseguradora: pólizas no canceladas cuyo fin de
 * vigencia (`poliza.fecha_fin_vigencia`) cae en el rango. Alcance como el
 * Resumen (canal dueño del producto + productos validados). Lista, totales,
 * gráfico y Excel comparten el mismo `from`.
 */

const TODAY = "(now() at time zone 'America/Guayaquil')::date";

export const expirationFiltersSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  q: z.string().trim().max(100),
}).refine((v) => v.from <= v.to);
export type ExpirationFilters = z.infer<typeof expirationFiltersSchema>;

type Scope = SummaryScope & { insurerId: string };

/** $1 aseguradora, $2 canal, $3 productos, $4/$5 fin de vigencia, $6 texto, $7 placa. */
function expirationScope(scope: Scope, f: ExpirationFilters) {
  const plate = f.q.replace(/[^A-Za-z0-9]/g, "");
  const values = [scope.insurerId, scope.channelId, scope.productIds, f.from, f.to, f.q ? `%${f.q}%` : null, plate ? `%${plate}%` : null];
  const from = `from poliza po
    join cotizacion c on c.id = po.cotizacion_id
    join producto p on p.id = c.producto_id
    join cliente cl on cl.id = c.cliente_id
    join vehiculo v on v.id = c.vehiculo_id
    left join canal ch on ch.id = p.canal_id
    cross join lateral (
      select count(*) filter (where t.estado in ('PENDIENTE', 'VENCIDO') and t.fecha_vencimiento < ${TODAY})::int as overdue
      from tabla_cobranza t where t.poliza_id = po.id
    ) k
    where c.aseguradora_id = $1
      and ($2::uuid is null or p.canal_id = $2)
      and (cardinality($3::uuid[]) = 0 or c.producto_id = any($3::uuid[]))
      and po.estado <> 'CANCELADA'
      and po.fecha_fin_vigencia between $4::date and $5::date
      and ($6::text is null
        or cl.nombre_razon_social ilike $6 or cl.identificacion ilike $6 or po.numero_poliza ilike $6
        or v.marca ilike $6 or v.modelo ilike $6 or concat_ws(' ', v.marca, v.modelo) ilike $6
        or ($7::text is not null and regexp_replace(coalesce(v.placa, ''), '[^A-Za-z0-9]', '', 'g') ilike $7))`;
  return { from, values };
}

export type ExpirationRow = {
  quoteId: string; policy: string; status: string; issued: string; start: string; end: string; days: number;
  client: string; identification: string | null; email: string | null; phone: string | null;
  brand: string; model: string; year: number | null; plate: string | null; insuredValue: number;
  product: string; channel: string | null; monthly: number; overdue: number;
};
export type ExpirationSummary = { total: number; expired: number; within15: number; within30: number; later: number; withOverdue: number };

const COLUMNS = `c.id as "quoteId", po.numero_poliza as policy, po.estado as status, po.fecha_emision::text as issued,
  po.fecha_inicio_vigencia::text as start, po.fecha_fin_vigencia::text as "end", (po.fecha_fin_vigencia - ${TODAY})::int as days,
  cl.nombre_razon_social as client, cl.identificacion as identification, cl.email, cl.telefono as phone,
  v.marca as brand, v.modelo as model, v.anio as year, v.placa as plate, v.valor_asegurado::float as "insuredValue",
  p.nombre as product, ch.nombre as channel, c.cuota_fija_mensual::float as monthly, k.overdue`;
const ORDER = `order by po.fecha_fin_vigencia, cl.nombre_razon_social`;

export async function getExpirations(scope: Scope, f: ExpirationFilters, page: number, pageSize: number) {
  const db = getDbPool();
  const { from, values } = expirationScope(scope, f);
  const [totals, months] = await Promise.all([
    db.query<ExpirationSummary>(
      `select count(*)::int as total,
         count(*) filter (where po.fecha_fin_vigencia < ${TODAY})::int as expired,
         count(*) filter (where po.fecha_fin_vigencia - ${TODAY} between 0 and 15)::int as within15,
         count(*) filter (where po.fecha_fin_vigencia - ${TODAY} between 16 and 30)::int as within30,
         count(*) filter (where po.fecha_fin_vigencia - ${TODAY} > 30)::int as later,
         count(*) filter (where k.overdue > 0)::int as "withOverdue"
       ${from}`, values),
    db.query<{ month: string; policies: number }>(
      `with months as (select generate_series(date_trunc('month', $4::date), date_trunc('month', $5::date), interval '1 month')::date as m),
       scoped as (select po.fecha_fin_vigencia ${from})
       select to_char(months.m, 'YYYY-MM') as month, count(scoped.fecha_fin_vigencia)::int as policies
       from months left join scoped on date_trunc('month', scoped.fecha_fin_vigencia) = months.m
       group by months.m order by months.m`, values),
  ]);
  const summary = totals.rows[0];
  const current = Math.min(Math.max(1, page), Math.max(1, Math.ceil(summary.total / pageSize)));
  const rows = await db.query<ExpirationRow>(`select ${COLUMNS} ${from} ${ORDER} limit ${pageSize} offset $8`, [...values, (current - 1) * pageSize]);
  return { summary, months: months.rows, rows: rows.rows, page: current };
}

/** Todas las pólizas del filtro (Excel). */
export async function getAllExpirations(scope: Scope, f: ExpirationFilters) {
  const { from, values } = expirationScope(scope, f);
  return (await getDbPool().query<ExpirationRow>(`select ${COLUMNS} ${from} ${ORDER}`, values)).rows;
}

const isoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

/** Filtros desde la URL (`desde`, `hasta`, `q`). Por defecto: de hoy a 90 días. */
export function readExpirationFilters(get: (key: string) => string | undefined) {
  const today = isoToday();
  const defaults: ExpirationFilters = { from: today, to: addDays(today, 90), q: "" };
  const parsed = expirationFiltersSchema.safeParse({ from: get("desde") || defaults.from, to: get("hasta") || defaults.to, q: get("q") ?? "" });
  return { filters: parsed.success ? parsed.data : defaults, valid: parsed.success, today };
}

export function expirationsQuery(f: ExpirationFilters, channelId: string | null, productIds: string[], extra: Record<string, string> = {}) {
  const query = new URLSearchParams({ desde: f.from, hasta: f.to, ...(f.q ? { q: f.q } : {}), ...extra });
  if (channelId) query.set("canal", channelId);
  productIds.forEach((id) => query.append("productos", id));
  return query.toString();
}

export { addDays };
