import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarRange, Car, ChevronRight, Hash, Package, RectangleHorizontal, Search, SearchX, ShieldCheck, X } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { Meta } from "@/components/channel/order-meta";
import { CancelPolicyForm, type CancelInstallment } from "@/components/channel/cancel-policy-form";
import { requireChannelUser } from "@/lib/auth/session";
import { getDbPool } from "@/lib/db/pool";
import { ORDER_SEARCH_LIMIT, searchActivePolicies } from "@/lib/channel/order-search";

export const metadata: Metadata = { title: "Cancelación individual | Kuantix", robots: { index: false, follow: false } };

type Policy = {
  id: string; numero_poliza: string; estado: string; fecha_emision: string; inicio: string; fin: string;
  cliente: string; identificacion: string | null; marca: string | null; modelo: string | null; anio: number | null; placa: string | null;
  producto: string; aseguradora: string; cuota: string;
};

const back = (
  <Link href="/canal/cancelaciones" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-surface-muted">
    <ArrowLeft className="size-4" />Cancelaciones
  </Link>
);

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; poliza?: string }> }) {
  const s = await requireChannelUser();
  const { q = "", poliza } = await searchParams;
  const term = q.trim();

  if (poliza) {
    if (!/^[0-9a-f-]{36}$/i.test(poliza)) notFound();
    const db = getDbPool();
    const { rows } = await db.query<Policy>(
      `select po.id, po.numero_poliza, po.estado, po.fecha_emision::text, po.fecha_inicio_vigencia::text as inicio, po.fecha_fin_vigencia::text as fin,
              cl.nombre_razon_social as cliente, cl.identificacion, v.marca, v.modelo, v.anio, v.placa,
              p.nombre as producto, a.nombre_comercial as aseguradora, c.cuota_fija_mensual::text as cuota
       from poliza po
       join cotizacion c on c.id = po.cotizacion_id
       join cliente cl on cl.id = c.cliente_id
       left join vehiculo v on v.id = c.vehiculo_id
       join producto p on p.id = c.producto_id
       join aseguradora a on a.id = c.aseguradora_id
       where po.id = $1 and c.canal_id = $2`,
      [poliza, s.channelId],
    );
    const p = rows[0];
    if (!p) notFound();
    const installments = await db.query<CancelInstallment>(
      `select numero_cuota as number, fecha_vencimiento::text as due, monto::text as amount, estado as status
       from tabla_cobranza where poliza_id = $1 order by numero_cuota`,
      [p.id],
    );
    return (
      <AdminPage eyebrow="Cancelaciones" title="Cancelación individual" description="Revisa la póliza, elige el mes de cancelación y confirma. Las cuotas que vencen desde ese mes quedarán canceladas." action={back}>
        <section className="glass-panel mt-7 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{p.cliente}</p>
              <p className="text-xs text-ink-subtle">{p.identificacion ?? "Sin identificación"}</p>
            </div>
            <Link href={`/canal/cancelaciones/individual${term ? `?q=${encodeURIComponent(term)}` : ""}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-xs font-bold text-ink/80 hover:bg-surface-muted">
              <X className="size-3.5" />Elegir otra póliza
            </Link>
          </div>
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 min-[480px]:grid-cols-2 md:flex md:flex-wrap md:gap-x-8 md:gap-y-4">
            <Meta icon={Hash} label="Póliza" value={p.numero_poliza} />
            <Meta icon={Car} label="Vehículo" value={[p.marca, p.modelo, p.anio].filter(Boolean).join(" ") || "—"} />
            <Meta icon={RectangleHorizontal} label="Placa" value={p.placa ? p.placa.toUpperCase() : "Sin placa"} mono={Boolean(p.placa)} />
            <Meta icon={Package} label="Producto" value={p.producto} />
            <Meta icon={Building2} label="Aseguradora" value={p.aseguradora} />
            <Meta icon={ShieldCheck} label="Emitida el" value={day(p.fecha_emision)} />
            <Meta icon={CalendarRange} label="Vigencia" value={`${day(p.inicio)} – ${day(p.fin)}`} />
          </dl>
        </section>
        {p.estado === "VIGENTE" ? (
          <CancelPolicyForm policyId={p.id} issuedOn={p.fecha_emision} installments={installments.rows} />
        ) : (
          <p className="glass-panel mt-4 p-5 text-sm text-ink-muted">Esta póliza está <strong className="text-ink">{p.estado.toLowerCase()}</strong>; solo se cancelan pólizas vigentes.</p>
        )}
      </AdminPage>
    );
  }

  const result = term ? await searchActivePolicies(s.channelId!, term) : null;
  return (
    <AdminPage eyebrow="Cancelaciones" title="Cancelación individual" description="Busca la emisión que quieres cancelar. Solo aparecen pólizas vigentes de tu canal." action={back}>
      <form className="glass-panel mt-7 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar pólizas vigentes</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
            <input name="q" defaultValue={term} autoFocus placeholder="Cliente, cédula/RUC, placa, número de póliza, marca, modelo o producto" className="min-h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm text-ink outline-none focus:border-brand/60" />
          </label>
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-white hover:bg-ink-strong">
            <Search className="size-4" />Buscar
          </button>
        </div>
      </form>

      {!result ? (
        <Empty icon={Search} title="Busca la póliza a cancelar" text="Escribe el nombre del cliente, su cédula o RUC, la placa o el número de póliza." />
      ) : !result.policies.length ? (
        <Empty icon={SearchX} title={`Sin pólizas vigentes para "${term}"`} text="Revisa lo que escribiste. Las pólizas ya canceladas o sin emitir no aparecen aquí." />
      ) : (
        <>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-ink-subtle">
            {result.policies.length} {result.policies.length === 1 ? "póliza vigente" : "pólizas vigentes"} para &quot;{term}&quot;
            {result.more && <span className="normal-case tracking-normal"> · se muestran las {ORDER_SEARCH_LIMIT} más recientes, afina la búsqueda</span>}
          </p>
          <section className="mt-3 grid gap-3">
            {result.policies.map((p) => (
              <Link key={p.policyId} href={`/canal/cancelaciones/individual?poliza=${p.policyId}&q=${encodeURIComponent(term)}`} className="glass-panel group flex items-center gap-5 p-5 transition-shadow hover:shadow-[0_14px_34px_rgba(23,50,80,0.1)] sm:p-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink group-hover:text-brand-text">{p.client}</p>
                      <p className="text-xs text-ink-subtle">{p.identification ?? "Sin identificación"}</p>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Póliza {p.policyNumber}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 min-[480px]:grid-cols-2 md:flex md:flex-wrap md:gap-x-8">
                    <Meta icon={Car} label="Vehículo" value={[p.brand, p.model].filter(Boolean).join(" ") || "—"} />
                    <Meta icon={RectangleHorizontal} label="Placa" value={p.plate ? p.plate.toUpperCase() : "Sin placa"} mono={Boolean(p.plate)} />
                    <Meta icon={Package} label="Producto" value={p.product ?? "—"} />
                    <Meta icon={ShieldCheck} label="Emitida el" value={day(p.issuedOn)} />
                  </dl>
                </div>
                <ChevronRight className="size-5 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-text" />
              </Link>
            ))}
          </section>
        </>
      )}
    </AdminPage>
  );
}

function Empty({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return (
    <div className="glass-panel mt-4 flex flex-col items-center px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-brand-text"><Icon className="size-7" /></span>
      <p className="mt-5 text-base font-bold">{title}</p>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-ink-muted">{text}</p>
    </div>
  );
}

function day(v: string) {
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}
