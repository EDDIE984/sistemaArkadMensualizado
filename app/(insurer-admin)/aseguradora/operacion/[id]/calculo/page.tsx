import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Detalle del cálculo | Arkad", robots: { index: false, follow: false } };

type Amort = {
  mes: number;
  valor_asegurado_mes: string;
  prima_neta_mes: string;
  comision_canal: string;
  super_bancos: string;
  seguro_campesino: string;
  derechos_emision: string;
  subtotal: string;
  iva: string;
  prima_total_mes: string;
  cuota_fija: string;
  diferencia: string;
  nivelacion_acumulada: string;
};

const NUM_COLS = [
  "valor_asegurado_mes", "prima_neta_mes", "comision_canal", "super_bancos", "seguro_campesino",
  "derechos_emision", "subtotal", "iva", "prima_total_mes", "cuota_fija", "diferencia", "nivelacion_acumulada",
] as const;

export default async function CalculoDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ recalculado?: string }>;
}) {
  const session = await requireInsurerAdmin();
  const insurerId = session.insurerId!;
  const { id } = await params;
  const { recalculado } = await searchParams;
  const db = createAdminClient();

  const { data: quote } = await db
    .from("cotizacion")
    .select("id,estado,origen,anios_vigencia,tasa_promedio,nivel_riesgo,cuota_fija_mensual,comision_canal_pct,fecha_inicio_vigencia,fecha_fin_vigencia,total_dias,creado_en,cliente(nombre_razon_social,identificacion),producto(nombre),vehiculo(marca,modelo,anio,valor_asegurado,estado_vh,uso)")
    .eq("id", id)
    .eq("aseguradora_id", insurerId)
    .maybeSingle();
  if (!quote) notFound();

  const [{ data: schedule }, { data: coverages }, { data: policy }] = await Promise.all([
    db.from("amortizacion_mensual")
      .select("mes,valor_asegurado_mes,prima_neta_mes,comision_canal,super_bancos,seguro_campesino,derechos_emision,subtotal,iva,prima_total_mes,cuota_fija,diferencia,nivelacion_acumulada")
      .eq("cotizacion_id", id)
      .order("mes"),
    db.from("cotizacion_cobertura")
      .select("valor_aplicado,producto_cobertura(cobertura_base(nombre))")
      .eq("cotizacion_id", id),
    db.from("poliza").select("numero_poliza").eq("cotizacion_id", id).maybeSingle(),
  ]);

  const rows = (schedule || []) as Amort[];
  const totals = Object.fromEntries(
    NUM_COLS.map((col) => [col, rows.reduce((sum, r) => sum + Number(r[col]), 0)]),
  ) as Record<(typeof NUM_COLS)[number], number>;
  const commissionPct = quote.comision_canal_pct == null ? null : Number(quote.comision_canal_pct);

  return (
    <AdminPage
      eyebrow="Operación"
      title="Detalle del cálculo"
      description="Amortización mensual completa: prima neta, comisión del canal, impuestos y nivelación de la cuota."
    >
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <Link href="/aseguradora/operacion" className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-cyan-100">
          <ArrowLeft className="size-4" /> Volver a Operación
        </Link>
        {quote.estado === "PENDIENTE" && (
          <Link href={`/aseguradora/operacion/${id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3.5 text-xs font-bold text-white/75 hover:bg-white/8">
            Editar y recalcular
          </Link>
        )}
      </div>

      {recalculado === "1" && (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-50">
          <CheckCircle2 className="size-4" /> Cotización recalculada. Este es el nuevo cronograma.
        </p>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Cliente" value={rel(quote.cliente, "nombre_razon_social")} detail={rel(quote.cliente, "identificacion")} />
        <Info label="Producto" value={rel(quote.producto, "nombre")} detail={`Estado: ${quote.estado}${policy?.numero_poliza ? ` · Póliza ${policy.numero_poliza}` : ""}`} />
        <Info
          label="Vehículo"
          value={`${rel(quote.vehiculo, "marca")} ${rel(quote.vehiculo, "modelo")}`}
          detail={`${rel(quote.vehiculo, "anio")} · ${rel(quote.vehiculo, "estado_vh")} · ${money(rel(quote.vehiculo, "valor_asegurado"))}`}
        />
        <Info label="Vigencia" value={`${quote.anios_vigencia} años · ${rows.length} cuotas`} detail={vigencia(quote.fecha_inicio_vigencia, quote.fecha_fin_vigencia, quote.total_dias)} />
        <Info label="Tasa promedio" value={pct(Number(quote.tasa_promedio), 4)} detail={`Nivel de riesgo ${quote.nivel_riesgo}`} />
        <Info label="Comisión del canal" value={commissionPct == null ? "Sin calcular" : pct(commissionPct, 2)} detail={commissionPct == null ? "Recalcula la cotización" : `${money(totals.comision_canal)} en total`} highlight={commissionPct == null} />
        <Info label="Cuota fija mensual" value={money(Number(quote.cuota_fija_mensual))} detail="Pago nivelado del cliente" />
        <Info label="Prima neta total" value={money(totals.prima_neta_mes)} detail={`Prima total ${money(totals.prima_total_mes)}`} />
      </section>

      {coverages && coverages.length > 0 && (
        <section className="mt-4 flex flex-wrap gap-2">
          {coverages.map((c, i) => (
            <span key={i} className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-white/70">
              {nested(c.producto_cobertura, "cobertura_base", "nombre")}
              {c.valor_aplicado != null && <span className="ml-1.5 text-white/45">· {String(c.valor_aplicado)}</span>}
            </span>
          ))}
        </section>
      )}

      <section className="glass-panel mt-4 overflow-hidden">
        <header className="border-b border-white/10 p-5">
          <h2 className="font-bold">Amortización mensual ({rows.length} cuotas)</h2>
          <p className="mt-1 text-xs text-white/45">Todos los importes en USD. La comisión del canal es interna y no altera la cuota del cliente.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-3 py-3 text-left">Mes</th>
                <th className="px-3 py-3 text-left">Vencimiento</th>
                <th className="px-3 py-3">Valor asegurado</th>
                <th className="px-3 py-3">Prima neta</th>
                <th className="px-3 py-3 text-cyan-100/70">Comisión canal</th>
                <th className="px-3 py-3">Super Bancos</th>
                <th className="px-3 py-3">Seg. Campesino</th>
                <th className="px-3 py-3">Der. emisión</th>
                <th className="px-3 py-3">Subtotal</th>
                <th className="px-3 py-3">IVA</th>
                <th className="px-3 py-3">Prima total</th>
                <th className="px-3 py-3">Cuota fija</th>
                <th className="px-3 py-3">Diferencia</th>
                <th className="px-3 py-3">Nivelación acum.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {rows.map((r) => (
                <tr key={r.mes}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-white/75">{r.mes}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-left text-white/72">{dueDate(quote.fecha_inicio_vigencia, r.mes)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/72">{money(r.valor_asegurado_mes)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/72">{money(r.prima_neta_mes)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-cyan-100/90">{money(r.comision_canal)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/72">{money(r.super_bancos)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/72">{money(r.seguro_campesino)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/72">{money(r.derechos_emision)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/72">{money(r.subtotal)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/72">{money(r.iva)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-white/85">{money(r.prima_total_mes)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/72">{money(r.cuota_fija)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/55">{money(r.diferencia)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/55">{money(r.nivelacion_acumulada)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={14} className="px-3 py-8 text-center text-white/45">Esta cotización no tiene cronograma calculado.</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-white/15 text-[11px] font-bold text-white/80">
                <tr>
                  <td className="px-3 py-3 text-left uppercase tracking-wider text-white/45">Totales</td>
                  <td className="px-3 py-3">—</td>
                  <td className="px-3 py-3">—</td>
                  <td className="px-3 py-3">{money(totals.prima_neta_mes)}</td>
                  <td className="px-3 py-3 text-cyan-100/90">{money(totals.comision_canal)}</td>
                  <td className="px-3 py-3">{money(totals.super_bancos)}</td>
                  <td className="px-3 py-3">{money(totals.seguro_campesino)}</td>
                  <td className="px-3 py-3">{money(totals.derechos_emision)}</td>
                  <td className="px-3 py-3">{money(totals.subtotal)}</td>
                  <td className="px-3 py-3">{money(totals.iva)}</td>
                  <td className="px-3 py-3">{money(totals.prima_total_mes)}</td>
                  <td className="px-3 py-3">{money(totals.cuota_fija)}</td>
                  <td className="px-3 py-3">—</td>
                  <td className="px-3 py-3">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </AdminPage>
  );
}

function Info({ label, value, detail, highlight = false }: { label: string; value: string; detail?: string; highlight?: boolean }) {
  return (
    <article className={`glass-panel min-w-0 p-4 ${highlight ? "border border-amber-200/30" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/42">{label}</p>
      <p className="mt-2 break-words text-lg font-bold tracking-[-0.02em]">{value}</p>
      {detail && <p className="mt-1 text-xs text-white/45">{detail}</p>}
    </article>
  );
}

function rel(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" && key in row && (row as Record<string, unknown>)[key] != null
    ? String((row as Record<string, unknown>)[key])
    : "—";
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
function money(v: number | string) {
  const n = Number(v);
  return Number.isNaN(n) ? "—" : new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n);
}
function pct(v: number, digits: number) {
  return `${(v * 100).toLocaleString("es-EC", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}
// Vencimiento de la cuota `month` = inicio de vigencia + `month` meses (cuota 1 = mes siguiente),
// con recorte de fin de mes igual que `date + interval 'n months'` de Postgres (tabla_cobranza).
function dueDate(start: string | Date | null, month: number): string {
  if (!start) return "—";
  const iso = typeof start === "string" ? start : start.toISOString();
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + month, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toLocaleDateString("es-EC", { timeZone: "UTC" });
}
function vigencia(inicio: string | null, fin: string | null, dias: number | null) {
  if (!inicio || !fin) return "Se define al emitir la póliza";
  const fmt = (s: string) => new Date(s).toLocaleDateString("es-EC");
  return `${fmt(inicio)} – ${fmt(fin)}${dias ? ` · ${dias} días` : ""}`;
}
