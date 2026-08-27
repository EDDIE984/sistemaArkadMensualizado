import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, ChevronDown, FileText, ReceiptText, ScanSearch, Search, ShieldCheck, Table2, TriangleAlert } from "lucide-react";
import { AdminPage, AdminPanel } from "@/components/admin/admin-ui";
import { EmitPolicyForm } from "@/components/insurer/emit-policy-form";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDbPool } from "@/lib/db/pool";
import { isCarroceria, requiredSlots } from "@/lib/inspeccion/slots";

export const metadata: Metadata = { title: "Operación | Arkad", robots: { index: false, follow: false } };

type PendingRow = {
  id: string;
  anios_vigencia: number;
  cuota_fija_mensual: string;
  fecha_inicio_vigencia: string | null;
  cliente: string;
  producto: string;
  puede_emitir: boolean;
  inspeccion_id: string | null;
  inspeccion_estado: string | null;
  inspeccion_carroceria: string | null;
  inspeccion_analisis: string | null;
  inspeccion_revision: string | null;
  inspeccion_fotos: string | number | null;
  inspeccion_danos: string | number | null;
};

type Cuota = { poliza_id: string; numero_cuota: number; fecha_vencimiento: string; monto: string; estado: string };

export default async function Operation({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireInsurerAdmin();
  const insurerId = session.insurerId!;
  const db = createAdminClient();
  const pool = getDbPool();
  const { q = "" } = await searchParams;
  const policySearch = q.trim();

  const [pending, quotes, policies, cobranzas] = await Promise.all([
    pool.query<PendingRow>(
      `select c.id, c.anios_vigencia, c.cuota_fija_mensual::text, c.fecha_inicio_vigencia::text as fecha_inicio_vigencia,
              cl.nombre_razon_social as cliente, p.nombre as producto,
              (
                c.comision_canal_pct is not null
                and (select count(*) from amortizacion_mensual am where am.cotizacion_id = c.id) = c.anios_vigencia * 12
                and not exists (
                  select 1 from amortizacion_mensual am
                  where am.cotizacion_id = c.id
                    and (am.comision_canal is null
                         or abs(am.comision_canal - round(am.prima_neta_mes * c.comision_canal_pct, 4)) > 0.01)
                )
              ) as puede_emitir,
              i.id as inspeccion_id, i.estado as inspeccion_estado, i.carroceria as inspeccion_carroceria,
              i.analisis_estado as inspeccion_analisis, i.estado_revision as inspeccion_revision,
              (select count(*) from inspeccion_foto f where f.inspeccion_id = i.id) as inspeccion_fotos,
              (select count(*) from inspeccion_dano d
                 join inspeccion_foto f2 on f2.id = d.inspeccion_foto_id
                where f2.inspeccion_id = i.id) as inspeccion_danos
       from cotizacion c
       join cliente cl on cl.id = c.cliente_id
       join producto p on p.id = c.producto_id
       left join inspeccion i on i.cotizacion_id = c.id
       where c.aseguradora_id = $1 and c.estado = 'PENDIENTE'
       order by c.creado_en desc
       limit 100`,
      [insurerId],
    ),
    db.from("cotizacion").select("id,creado_en,estado,cuota_fija_mensual,anios_vigencia,cliente(nombre_razon_social,identificacion),producto(nombre)").eq("aseguradora_id", insurerId).order("creado_en", { ascending: false }).limit(200),
    db.from("poliza").select("id,numero_poliza,fecha_emision,fecha_inicio_vigencia,fecha_fin_vigencia,estado,cotizacion!inner(id,aseguradora_id,cuota_fija_mensual,cliente(nombre_razon_social,identificacion),producto(nombre),vehiculo(placa))").eq("cotizacion.aseguradora_id", insurerId).order("fecha_emision", { ascending: false }).limit(200),
    db.from("tabla_cobranza").select("poliza_id,numero_cuota,fecha_vencimiento,monto,estado,poliza!inner(cotizacion!inner(aseguradora_id))").eq("poliza.cotizacion.aseguradora_id", insurerId).order("poliza_id").order("numero_cuota").limit(4000),
  ]);

  const pendingRows = pending.rows;
  const allPolicyRows = policies.data || [];
  const normalizedSearch = normalizeSearch(policySearch);
  const policyRows = normalizedSearch
    ? allPolicyRows.filter((policy) => {
        const quote = firstRelation(policy.cotizacion);
        const client = firstRelation(quote?.cliente);
        const vehicle = firstRelation(quote?.vehiculo);
        return [client?.nombre_razon_social, client?.identificacion, vehicle?.placa]
          .some((value) => normalizeSearch(value).includes(normalizedSearch));
      })
    : allPolicyRows;
  const cuotas = (cobranzas.data || []) as unknown as Cuota[];

  const cuotasByPolicy = new Map<string, Cuota[]>();
  for (const cuota of cuotas) {
    const list = cuotasByPolicy.get(cuota.poliza_id) || [];
    list.push(cuota);
    cuotasByPolicy.set(cuota.poliza_id, list);
  }

  const vigentes = allPolicyRows.filter((p) => p.estado === "VIGENTE").length;
  const porCobrar = cuotas.filter((c) => c.estado !== "PAGADO");
  const vencidas = cuotas.filter((c) => c.estado === "VENCIDO");
  const montoPorCobrar = porCobrar.reduce((sum, c) => sum + Number(c.monto), 0);

  return (
    <AdminPage eyebrow="Seguimiento" title="Operación" description="Emite pólizas, revisa el cronograma de cobranza y consulta la producción de tu aseguradora.">
      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<ShieldCheck />} label="Pendientes de emisión" value={String(pendingRows.length)} />
        <Stat icon={<FileText />} label="Pólizas vigentes" value={String(vigentes)} detail={`${policyRows.length} emitidas`} />
        <Stat icon={<ReceiptText />} label="Cuotas por cobrar" value={String(porCobrar.length)} detail={money(montoPorCobrar)} />
        <Stat icon={<TriangleAlert />} label="Cuotas vencidas" value={String(vencidas.length)} alert={vencidas.length > 0} />
      </section>

      <div className="mt-4 grid gap-4">
        <AdminPanel title={`Emitir pólizas (${pendingRows.length})`} description="Ingresa el número de póliza para emitir y generar el cronograma de cobranza" open>
          <div className="grid gap-3">
            {pendingRows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{row.cliente}</p>
                    <p className="mt-0.5 text-xs text-white/45">{row.producto}</p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/55">
                      <span><b className="text-white/80">{money(row.cuota_fija_mensual)}</b> / mes</span>
                      <span>{row.anios_vigencia * 12} cuotas</span>
                      {row.fecha_inicio_vigencia && <span>Inicio {date(row.fecha_inicio_vigencia)}</span>}
                      {row.fecha_inicio_vigencia && <span>1ª cuota {dueDate(row.fecha_inicio_vigencia, 1)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <InspeccionPill row={row} />
                    <Link href={`/aseguradora/operacion/${row.id}/calculo`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3.5 text-xs font-bold text-white/75 hover:bg-white/8">
                      <Table2 className="size-3.5" /> Ver cálculo
                    </Link>
                    <Link href={`/aseguradora/operacion/${row.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3.5 text-xs font-bold text-white/75 hover:bg-white/8">
                      <Calculator className="size-3.5" /> Editar y recalcular
                    </Link>
                  </div>
                </div>
                <div className="mt-4 border-t border-white/8 pt-4">
                  {row.puede_emitir ? (
                    <EmitPolicyForm quoteId={row.id} />
                  ) : (
                    <p className="flex items-center gap-2 text-xs text-amber-200">
                      <TriangleAlert className="size-4 shrink-0" />
                      Falta el cálculo de comisión del canal. Usa el botón Editar y recalcular antes de emitir.
                    </p>
                  )}
                </div>
              </article>
            ))}
            {!pendingRows.length && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/45">No hay cotizaciones pendientes de emisión.</p>}
          </div>
        </AdminPanel>

        <AdminPanel title={`Pólizas emitidas (${policyRows.length}${policySearch ? ` de ${allPolicyRows.length}` : ""})`} description="Busca por cédula, nombre o placa; abre una póliza para ver su cronograma" open>
          <form className="mb-4 flex flex-col gap-3 sm:flex-row" role="search" aria-label="Buscar pólizas emitidas">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Cédula, nombre del cliente o placa</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/42" aria-hidden="true" />
              <input
                name="q"
                defaultValue={policySearch}
                placeholder="Cédula, nombre del cliente o placa"
                className="min-h-11 w-full rounded-xl border border-white/15 bg-[#061323]/65 py-2 pl-11 pr-4 text-base text-white outline-none placeholder:text-white/35 focus:border-cyan-100/55 sm:text-sm"
              />
            </label>
            <div className="flex gap-2">
              <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#071426] sm:flex-none">Buscar</button>
              {policySearch && <Link href="/aseguradora/operacion" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-bold text-white/72 hover:bg-white/8 sm:flex-none">Limpiar</Link>}
            </div>
          </form>
          <div className="grid gap-2">
            {policyRows.map((p) => {
              const rows = cuotasByPolicy.get(p.id) || [];
              const pagadas = rows.filter((c) => c.estado === "PAGADO").length;
              const saldo = rows.filter((c) => c.estado !== "PAGADO").reduce((sum, c) => sum + Number(c.monto), 0);
              return (
                <details key={p.id} className="group rounded-2xl border border-white/10 bg-white/[0.03]">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="font-bold">{p.numero_poliza}</p>
                      <p className="mt-0.5 text-xs text-white/45">
                        {nested(p.cotizacion, "cliente", "nombre_razon_social")} · {nested(p.cotizacion, "producto", "nombre")} · {date(p.fecha_inicio_vigencia)} – {date(p.fecha_fin_vigencia)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatePill state={p.estado} />
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-100">
                        Ver cronograma ({rows.length})
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                      </span>
                    </div>
                  </summary>
                  <div className="border-t border-white/10 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/55">
                      <span>Cuota: <b className="text-white/80">{money(nested(p.cotizacion, "cuota_fija_mensual"))}</b></span>
                      <span>Cobradas: {pagadas} / {rows.length}</span>
                      <span>Saldo por cobrar: <b className="text-white/80">{money(saldo)}</b></span>
                      <Link href={`/aseguradora/operacion/${nested(p.cotizacion, "id")}/calculo`} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 font-bold text-white/75 hover:bg-white/8">
                        <Table2 className="size-3.5" /> Ver cálculo completo
                      </Link>
                    </div>
                    <Table
                      headers={["#", "Vencimiento", "Monto", "Estado"]}
                      rows={rows.map((c) => [String(c.numero_cuota), date(c.fecha_vencimiento), money(c.monto), c.estado])}
                    />
                  </div>
                </details>
              );
            })}
            {!policyRows.length && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/45">{policySearch ? "No encontramos pólizas con esos datos." : "Todavía no hay pólizas emitidas."}</p>}
          </div>
        </AdminPanel>

        <AdminPanel title={`Cotizaciones (${quotes.data?.length || 0})`} description="Últimas 200 cotizaciones de tu aseguradora">
          <Table
            headers={["Cliente", "Producto", "Fecha", "Cuota", "Estado"]}
            rows={(quotes.data || []).map((x) => [relation(x.cliente, "nombre_razon_social"), relation(x.producto, "nombre"), date(x.creado_en), money(x.cuota_fija_mensual), x.estado])}
          />
        </AdminPanel>
      </div>
    </AdminPage>
  );
}

function Stat({ icon, label, value, detail, alert = false }: { icon: React.ReactNode; label: string; value: string; detail?: string; alert?: boolean }) {
  return (
    <article className={`glass-panel min-w-0 p-5 ${alert ? "border border-amber-200/25" : ""}`}>
      <span className={alert ? "text-amber-200 [&_svg]:size-5" : "text-cyan-100 [&_svg]:size-5"}>{icon}</span>
      <p className="mt-6 break-words text-3xl font-bold tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-white/42">{label}</p>
      {detail && <p className="mt-2 text-xs text-white/38">{detail}</p>}
    </article>
  );
}

function StatePill({ state }: { state: string }) {
  const tone =
    state === "VIGENTE" ? "border-emerald-200/25 bg-emerald-200/10 text-emerald-100"
    : state === "CANCELADA" ? "border-rose-200/25 bg-rose-200/10 text-rose-100"
    : "border-white/15 bg-white/6 text-white/60";
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}>{state}</span>;
}

function InspeccionPill({ row }: { row: PendingRow }) {
  const cls = "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-bold";
  if (!row.inspeccion_id) {
    return <span className={`${cls} border-white/15 text-white/45`} title="Sin inspección">Sin inspección</span>;
  }

  let label: string;
  let tone: string;
  if (row.inspeccion_estado !== "COMPLETADA") {
    const total = isCarroceria(row.inspeccion_carroceria) ? requiredSlots(row.inspeccion_carroceria).length : 13;
    label = `Inspección ${Number(row.inspeccion_fotos ?? 0)}/${total}`;
    tone = "border-amber-200/30 bg-amber-200/10 text-amber-100";
  } else if (row.inspeccion_analisis === "PENDIENTE" || row.inspeccion_analisis === "EN_PROCESO") {
    label = "Analizando IA";
    tone = "border-cyan-100/25 bg-cyan-100/10 text-cyan-50";
  } else if (row.inspeccion_revision === "APROBADA") {
    label = "Inspección aprobada";
    tone = "border-emerald-300/30 bg-emerald-300/10 text-emerald-50";
  } else if (row.inspeccion_revision === "RECHAZADA") {
    label = "Inspección rechazada";
    tone = "border-rose-300/30 bg-rose-300/10 text-rose-50";
  } else {
    const n = Number(row.inspeccion_danos ?? 0);
    label = `${n ? `${n} daño(s)` : "Sin daños"} · rev. pendiente`;
    tone = "border-white/20 bg-white/6 text-white/70";
  }

  return (
    <Link href={`/aseguradora/inspecciones/${row.inspeccion_id}`} className={`${cls} ${tone} hover:opacity-90`} title="Ver revisión de la inspección">
      <ScanSearch className="mr-1.5 size-3.5" /> {label}
    </Link>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-white/40">
          <tr>{headers.map((x) => <th key={x} className="px-3 py-3">{x}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-white/8">
          {rows.map((row, i) => (
            <tr key={i}>{row.map((x, j) => <td key={j} className="whitespace-nowrap px-3 py-3 text-white/72">{x}</td>)}</tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-white/45">Sin registros</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function relation(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" && key in row ? String((row as Record<string, unknown>)[key]) : "—";
}
function nested(value: unknown, ...keys: string[]): string {
  let current: unknown = Array.isArray(value) ? value[0] : value;
  for (const key of keys) {
    if (!current || typeof current !== "object" || !(key in current)) return "—";
    current = (current as Record<string, unknown>)[key];
    if (Array.isArray(current)) current = current[0];
  }
  return current == null ? "—" : String(current);
}

function firstRelation(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? row as Record<string, unknown> : null;
}

function normalizeSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-EC")
    .replace(/[^a-z0-9]/g, "");
}
function date(v: string) {
  return new Date(v).toLocaleDateString("es-EC");
}
// inicio de vigencia + `month` meses, con recorte de fin de mes como Postgres `date + interval 'n months'`.
function dueDate(start: string | Date, month: number): string {
  const iso = typeof start === "string" ? start : start.toISOString();
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + month, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toLocaleDateString("es-EC", { timeZone: "UTC" });
}
function money(v: number | string) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(v));
}
