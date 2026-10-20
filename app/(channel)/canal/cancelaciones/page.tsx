import type { Metadata } from "next";
import Link from "next/link";
import { Ban, CalendarX2, Car, CheckCircle2, ChevronRight, FileSpreadsheet, Hash, Package, RectangleHorizontal, Search, SearchCheck, X } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { ActionTip, iconActionClass } from "@/components/channel/action-tip";
import { Meta } from "@/components/channel/order-meta";
import { RegisterCancellationButton } from "@/components/channel/register-cancellation-button";
import { requireChannelUser } from "@/lib/auth/session";
import { getDbPool } from "@/lib/db/pool";

export const metadata: Metadata = { title: "Cancelaciones del canal | Kuantiq", robots: { index: false, follow: false } };

type Row = {
  id: string; cotizacion_id: string; numero_poliza: string; cliente: string; identificacion: string | null;
  marca: string | null; modelo: string | null; placa: string | null; producto: string;
  fecha_emision: string; mes_cancelacion: string; cuota_desde: number; cuotas_canceladas: number; total_cuotas: number; valor: string;
  motivo: string | null; origen: "INDIVIDUAL" | "EXCEL"; creado_en: string; usuario: string | null;
  tipo: "NORMAL" | "PERDIDA_TOTAL"; fecha_siniestro: string | null; numero_reclamo: string | null;
};

const LIMIT = 100;

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; registradas?: string }> }) {
  const s = await requireChannelUser();
  const { q = "", registradas } = await searchParams;
  const registered = Number(registradas) > 0 ? Number(registradas) : 0;
  const term = q.trim();
  const plate = term.replace(/[^A-Za-z0-9]/g, "");

  const { rows } = await getDbPool().query<Row>(
    `select cp.id, c.id as cotizacion_id, po.numero_poliza, cl.nombre_razon_social as cliente, cl.identificacion,
            v.marca, v.modelo, v.placa, p.nombre as producto, po.fecha_emision::text, cp.mes_cancelacion::text,
            cp.cuota_desde, cp.cuotas_canceladas, (select count(*)::int from tabla_cobranza t where t.poliza_id = po.id) as total_cuotas,
            (select coalesce(sum(t.monto), 0)::text from tabla_cobranza t where t.poliza_id = po.id and t.numero_cuota >= cp.cuota_desde) as valor,
            cp.motivo, cp.origen, cp.creado_en::text, u.nombre as usuario,
            cp.tipo, cp.fecha_siniestro::text, cp.numero_reclamo
     from cancelacion_poliza cp
     join poliza po on po.id = cp.poliza_id
     join cotizacion c on c.id = po.cotizacion_id
     join cliente cl on cl.id = c.cliente_id
     left join vehiculo v on v.id = c.vehiculo_id
     join producto p on p.id = c.producto_id
     left join usuario u on u.id = cp.usuario_id
     where cp.canal_id = $1
       and ($2::text is null or cl.nombre_razon_social ilike $2 or cl.identificacion ilike $2 or po.numero_poliza ilike $2
            or p.nombre ilike $2 or ($3::text is not null and regexp_replace(coalesce(v.placa, ''), '[^A-Za-z0-9]', '', 'g') ilike $3))
     order by cp.creado_en desc
     limit ${LIMIT}`,
    [s.channelId, term ? `%${term}%` : null, plate ? `%${plate}%` : null],
  );

  return (
    <AdminPage
      eyebrow="Producción del canal"
      title="Cancelaciones"
      description="Cancela pólizas emitidas desde un mes determinado, de forma individual o con la plantilla en Excel. Las cuotas desde ese mes quedan canceladas."
      action={<RegisterCancellationButton />}
    >
      {registered > 0 && (
        <div role="status" className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <span className="flex items-center gap-2"><CheckCircle2 className="size-5 shrink-0" />{registered === 1 ? "Se canceló 1 póliza." : `Se cancelaron ${registered} pólizas.`}</span>
          <Link href="/canal/cancelaciones" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-emerald-100" aria-label="Cerrar aviso"><X className="size-4" /></Link>
        </div>
      )}

      <form className="mt-7 flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Buscar por cliente, cédula, placa, póliza o producto</span>
          <input name="q" defaultValue={term} placeholder="Buscar por cliente, cédula, placa, póliza o producto" className="min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none focus:border-brand/60" />
        </label>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white">
          <Search className="size-4" />Buscar
        </button>
        {term && (
          <Link href="/canal/cancelaciones" className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-5 text-sm font-bold text-ink/80">
            Limpiar
          </Link>
        )}
      </form>

      <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-ink-subtle">
        {rows.length} {rows.length === 1 ? "cancelación" : "cancelaciones"}{term ? ` para "${term}"` : ""}
        {rows.length === LIMIT && <span className="normal-case tracking-normal"> · se muestran las {LIMIT} más recientes</span>}
      </p>

      {!rows.length ? (
        <div className="glass-panel mt-3 flex flex-col items-center px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-brand-text"><Ban className="size-7" /></span>
          <p className="mt-5 text-base font-bold">{term ? `Sin cancelaciones para "${term}"` : "Aún no hay cancelaciones"}</p>
          <p className="mt-1.5 max-w-md text-sm leading-6 text-ink-muted">Usa &quot;Registrar cancelación&quot; para cancelar una póliza individualmente o varias con la plantilla en Excel.</p>
        </div>
      ) : (
        <section className="mt-3 grid gap-3">
          {rows.map((r) => {
            const href = `/canal/clientes/${r.cotizacion_id}`;
            return (
              <article key={r.id} className="glass-panel grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <Link href={href} className="block truncate text-sm font-bold text-ink hover:text-brand-text">{r.cliente}</Link>
                      <p className="text-xs text-ink-subtle">{r.identificacion ?? "Sin identificación"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.tipo === "PERDIDA_TOTAL" && <span className="rounded-full border border-ink/20 bg-ink px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Pérdida total · siniestro {day(r.fecha_siniestro!)}{r.numero_reclamo ? ` · reclamo ${r.numero_reclamo}` : ""}</span>}
                      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">Cancelada desde cuota {r.cuota_desde}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[11px] text-ink-muted">
                        {r.origen === "EXCEL" ? <FileSpreadsheet className="size-3 text-brand-text" /> : <SearchCheck className="size-3 text-brand-text" />}
                        {r.origen === "EXCEL" ? "Carga Excel" : "Individual"} · {day(r.creado_en.slice(0, 10))}
                      </span>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 min-[480px]:grid-cols-2 md:flex md:flex-wrap md:gap-x-8 md:gap-y-4">
                    <Meta icon={Hash} label="Póliza" value={r.numero_poliza} />
                    <Meta icon={Car} label="Vehículo" value={[r.marca, r.modelo].filter(Boolean).join(" ") || "—"} />
                    <Meta icon={RectangleHorizontal} label="Placa" value={r.placa ? r.placa.toUpperCase() : "Sin placa"} mono={Boolean(r.placa)} />
                    <Meta icon={Package} label="Producto" value={r.producto} />
                  </dl>
                  {r.motivo && <p className="mt-3 text-xs text-ink-muted"><span className="font-semibold text-ink">Motivo:</span> {r.motivo}</p>}
                </div>
                <div className="flex items-center justify-between gap-5 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:py-1 lg:pl-6 lg:pt-1">
                  <div className="grid gap-2 lg:text-right">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Emitida</p>
                      <p className="text-sm font-semibold text-ink">{day(r.fecha_emision)}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle lg:justify-end"><CalendarX2 className="size-3" />Cancelada desde</p>
                      <p className="text-sm font-semibold text-ink">{monthLabel(r.mes_cancelacion)}</p>
                      <p className="text-[11px] text-ink-subtle">Cuotas {r.cuota_desde}–{r.total_cuotas} ({r.cuotas_canceladas})</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Valor cancelación</p>
                      <p className="text-sm font-bold text-red-700">{money(r.valor)}</p>
                    </div>
                  </div>
                  <ActionTip label="Ver detalle">
                    <Link href={href} aria-label={`Ver detalle de ${r.cliente}`} className={`${iconActionClass} text-ink-subtle hover:border-brand/40 hover:bg-brand/10 hover:text-brand-text focus-visible:outline-brand`}>
                      <ChevronRight className="size-[18px]" aria-hidden="true" />
                    </Link>
                  </ActionTip>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </AdminPage>
  );
}

function day(v: string) {
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}
function money(v: string) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(v));
}
function monthLabel(v: string) {
  const [y, m] = v.split("-");
  const name = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-EC", { month: "long" });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}
