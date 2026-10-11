import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarRange, Car, CircleDollarSign, Eye, FileText, History, Mail, MessageCircle, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { ResendCertificateButton } from "@/components/channel/resend-certificate-button";
import { StatusPill } from "@/components/channel/order-status-pill";
import { requireChannelUser } from "@/lib/auth/session";
import { normalizeEcuadorPhone } from "@/lib/certificates/send";
import { getDbPool } from "@/lib/db/pool";

export const metadata: Metadata = { title: "Detalle de la Orden de Emisión | Kuantix", robots: { index: false, follow: false } };

type Order = {
  id: string; estado: string; creado_en: string; anios_vigencia: number; inicio: string | null; fin: string | null; total_dias: number | null;
  tasa_promedio: string; nivel_riesgo: number; cuota_fija_mensual: string;
  cliente: string; identificacion: string | null; email: string | null; telefono: string | null; direccion: string | null;
  fecha_nacimiento: string | null; genero: string | null; estado_civil: string | null; ciudad: string | null;
  marca: string; modelo: string; anio: number | null; color: string | null; placa: string | null; uso: string | null; estado_vh: string | null;
  valor_asegurado: string; tipo_vehiculo: string | null;
  producto: string; aseguradora: string; canal: string | null; agente: string | null;
  cert_id: string | null; cert_numero: string | null; cert_canal: string | null; cert_destino: string | null; cert_enviado_en: string | null; cert_usuario: string | null;
  poliza_numero: string | null; poliza_estado: string | null; poliza_emision: string | null; poliza_inicio: string | null; poliza_fin: string | null;
};
type Installment = { numero_cuota: number; fecha_vencimiento: string; monto: string; estado: string; pagos: { fecha: string; monto: string; metodo: string | null; referencia: string | null }[] };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const s = await requireChannelUser();
  const { id } = await params;
  const { q = "" } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDbPool();

  const { rows } = await db.query<Order>(
    `select c.id, c.estado, c.creado_en::text, c.anios_vigencia, c.fecha_inicio_vigencia::text as inicio, c.fecha_fin_vigencia::text as fin, c.total_dias,
            c.tasa_promedio::text, c.nivel_riesgo, c.cuota_fija_mensual::text,
            cl.nombre_razon_social as cliente, cl.identificacion, cl.email, cl.telefono, cl.direccion, cl.fecha_nacimiento::text,
            cl.genero, cl.estado_civil, ci.nombre as ciudad,
            v.marca, v.modelo, v.anio, v.color, v.placa, v.uso, v.estado_vh, v.valor_asegurado::text, tv.descripcion as tipo_vehiculo,
            p.nombre as producto, a.nombre_comercial as aseguradora, ca.nombre as canal, u.nombre as agente,
            cc.id as cert_id, cc.numero as cert_numero, cc.canal_envio as cert_canal, cc.destino as cert_destino,
            cc.enviado_en::text as cert_enviado_en, cu.nombre as cert_usuario,
            po.numero_poliza as poliza_numero, po.estado as poliza_estado, po.fecha_emision::text as poliza_emision,
            po.fecha_inicio_vigencia::text as poliza_inicio, po.fecha_fin_vigencia::text as poliza_fin
     from cotizacion c
     left join certificado_cobertura cc on cc.cotizacion_id = c.id
     join cliente cl on cl.id = c.cliente_id
     left join ciudad ci on ci.id = coalesce(cl.ciudad_id, c.ciudad_id)
     join vehiculo v on v.id = c.vehiculo_id
     left join tipo_vehiculo tv on tv.id = v.tipo_vehiculo_id
     join producto p on p.id = c.producto_id
     join aseguradora a on a.id = c.aseguradora_id
     left join canal ca on ca.id = c.canal_id
     left join usuario u on u.id = c.usuario_id
     left join usuario cu on cu.id = cc.enviado_por_usuario_id
     left join poliza po on po.cotizacion_id = c.id
     where c.id = $1 and c.canal_id = $2`,
    [id, s.channelId],
  );
  const o = rows[0];
  if (!o) notFound();

  const [coverages, schedule, installments, resends] = await Promise.all([
    db.query<{ name: string; value: string | null }>(
      `select cb.nombre as name, coalesce(cc.valor_aplicado, pc.valor_o_porcentaje)::text as value
       from cotizacion_cobertura cc join producto_cobertura pc on pc.id = cc.producto_cobertura_id
       join cobertura_base cb on cb.id = pc.cobertura_base_id
       where cc.cotizacion_id = $1 order by pc.orden, cb.nombre`, [id]),
    db.query<{ mes: number; valor_asegurado_mes: string; cuota_fija: string }>(
      `select mes, valor_asegurado_mes::text, cuota_fija::text from amortizacion_mensual where cotizacion_id = $1 order by mes`, [id]),
    o.poliza_numero
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
    !o.cert_id ? Promise.resolve({ rows: [] as { canal: string; destino: string; creado_en: string; usuario: string | null; correccion: boolean }[] }) : db.query<{ canal: string; destino: string; creado_en: string; usuario: string | null; correccion: boolean }>(
      `select au.datos_nuevos->>'canal' as canal, au.datos_nuevos->>'destino' as destino, au.creado_en::text, u.nombre as usuario,
              coalesce((au.datos_nuevos->>'correccion_orden')::boolean, false) as correccion
       from auditoria au left join usuario u on u.id = au.usuario_id
       where au.entidad = 'CERTIFICADO_COBERTURA' and au.entidad_id = $1
         and (coalesce((au.datos_nuevos->>'reenvio')::boolean, false) or coalesce((au.datos_nuevos->>'correccion_orden')::boolean, false))
       order by au.creado_en desc`, [o.cert_id]),
  ]);

  const total = schedule.rows.reduce((t, r) => t + Number(r.cuota_fija), 0);
  const cobranza = installments.rows;
  const paid = cobranza.filter((c) => c.estado === "PAGADO");
  const overdue = cobranza.filter((c) => c.estado === "VENCIDO");
  const paidAmount = cobranza.flatMap((c) => c.pagos).reduce((t, p) => t + Number(p.monto), 0);
  // Una corrección de la orden reescribe el registro del certificado con su envío; en ese
  // caso el envío inicial ya no está disponible y la corrección figura en la auditoría.
  const corrected = resends.rows.some((r) => r.correccion);
  const sends = o.cert_id ? [
    ...resends.rows.map((r) => ({ kind: r.correccion ? "Certificado corregido" : "Reenvío", channel: r.canal, destination: r.destino, at: r.creado_en, user: r.usuario })),
    ...(corrected ? [] : [{ kind: "Envío original", channel: o.cert_canal!, destination: o.cert_destino!, at: o.cert_enviado_en!, user: o.cert_usuario }]),
  ] : [];
  const back = q ? `/canal/clientes?q=${encodeURIComponent(q)}` : "/canal/clientes";

  return (
    <main className="relative z-10 mx-auto w-full min-w-0 max-w-[1280px] overflow-x-clip px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <Link href={back} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink"><ArrowLeft className="size-4" />Volver a la búsqueda</Link>

      {/* Cabecera */}
      <header className="glass-panel mt-3 flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-text/80">Orden de Emisión</p>
          <h1 className="mt-1.5 truncate text-2xl font-bold tracking-[-0.03em] sm:text-3xl">{o.cliente}</h1>
          <p className="mt-1 text-sm text-ink-muted">{o.identificacion ?? "Sin identificación"} · {o.marca} {o.modelo}{o.placa ? ` · ${o.placa.toUpperCase()}` : ""}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill status={o.estado} policy={o.poliza_numero} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[11px] text-ink-muted"><FileText className="size-3 text-brand-text" />{o.cert_numero ? `Certificado ${o.cert_numero}` : "Sin certificado"}</span>
          </div>
        </div>
        {o.cert_numero && <div className="flex flex-wrap gap-2">
          <a href={`/canal/cotizaciones/${o.id}/certificado`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-ink-strong"><Eye className="size-4" />Ver certificado</a>
          <ResendCertificateButton variant="button" quoteId={o.id} client={o.cliente} certificateNumber={o.cert_numero} email={o.email} phone={o.telefono ? normalizeEcuadorPhone(o.telefono) : null} />
        </div>}
      </header>

      {/* Datos */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card icon={UserRound} title="Cliente" rows={[
          ["Nombre o razón social", o.cliente], ["Cédula / RUC", o.identificacion], ["Correo", o.email], ["Teléfono", o.telefono],
          ["Ciudad", o.ciudad], ["Dirección", o.direccion], ["Fecha de nacimiento", day(o.fecha_nacimiento)], ["Género", nice(o.genero)], ["Estado civil", nice(o.estado_civil)],
        ]} />
        <Card icon={Car} title="Vehículo" rows={[
          ["Marca", o.marca], ["Modelo", o.modelo], ["Año", o.anio ? String(o.anio) : null], ["Color", nice(o.color)],
          ["Placa", o.placa ? o.placa.toUpperCase() : "Sin placa"], ["Tipo de vehículo", o.tipo_vehiculo], ["Uso", nice(o.uso)], ["Estado", nice(o.estado_vh)],
          ["Valor asegurado", money(o.valor_asegurado)],
        ]} />
        <Card icon={Building2} title="Producto" rows={[
          ["Producto", o.producto], ["Aseguradora", o.aseguradora], ["Canal", nice(o.canal)], ["Agente", o.agente],
          ["Registrada el", dateTime(o.creado_en)], ...(o.poliza_numero ? [["Póliza", `${o.poliza_numero} · ${nice(o.poliza_estado)}`], ["Emitida el", day(o.poliza_emision)]] as [string, string | null][] : []),
        ]} />
        <Card icon={CalendarRange} title="Vigencia y riesgo" rows={[
          ["Inicio de vigencia", day(o.poliza_inicio ?? o.inicio)], ["Fin de vigencia", day(o.poliza_fin ?? o.fin)],
          ["Plazo", `${o.anios_vigencia} ${o.anios_vigencia === 1 ? "año" : "años"}${o.total_dias ? ` · ${o.total_dias} días` : ""}`],
          ["Nivel de riesgo", o.nivel_riesgo === 1 ? "Alto" : o.nivel_riesgo === 2 ? "Moderado" : "Bajo"], ["Tasa promedio", `${(Number(o.tasa_promedio) * 100).toFixed(2)} %`],
        ]} />
      </div>

      {/* Coberturas */}
      <section className="glass-panel mt-4 p-5 sm:p-6">
        <SectionTitle icon={ShieldCheck} title="Coberturas contratadas" />
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {coverages.rows.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="flex items-center gap-2.5"><span className="size-1.5 rounded-full bg-brand" />{c.name}</span>
              <span className="font-bold">{coverageValue(c.value)}</span>
            </li>
          ))}
          {!coverages.rows.length && <li className="px-4 py-3 text-sm text-ink-subtle">Sin coberturas registradas.</li>}
        </ul>
      </section>

      {/* Pago */}
      <section className="glass-panel mt-4 p-5 sm:p-6">
        <SectionTitle icon={CircleDollarSign} title="Pago" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Kpi label="Cuota mensual" value={money(o.cuota_fija_mensual)} strong />
          <Kpi label="Total de la vigencia" value={money(total)} />
          <Kpi label="Número de cuotas" value={String(schedule.rows.length || o.anios_vigencia * 12)} />
        </div>

        {o.poliza_numero ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Kpi label="Pagadas" value={String(paid.length)} tone="good" />
              <Kpi label="Pendientes" value={String(cobranza.length - paid.length - overdue.length)} />
              <Kpi label="Vencidas" value={String(overdue.length)} tone={overdue.length ? "bad" : undefined} />
              <Kpi label="Monto pagado" value={money(paidAmount)} />
            </div>
            <Table head={["Cuota", "Vencimiento", "Monto", "Estado", "Pagos registrados"]}>
              {cobranza.map((c) => (
                <tr key={c.numero_cuota}>
                  <td className="px-3 py-2.5 font-semibold text-ink-subtle">{c.numero_cuota}</td>
                  <td className="px-3 py-2.5">{day(c.fecha_vencimiento)}</td>
                  <td className="px-3 py-2.5 font-semibold">{money(c.monto)}</td>
                  <td className="px-3 py-2.5"><InstallmentPill estado={c.estado} /></td>
                  <td className="px-3 py-2.5 text-ink-muted">{c.pagos.length ? c.pagos.map((p, i) => <span key={i} className="block">{day(p.fecha)} · {money(p.monto)}{p.metodo ? ` · ${p.metodo}` : ""}{p.referencia ? ` · Ref. ${p.referencia}` : ""}</span>) : "—"}</td>
                </tr>
              ))}
              {!cobranza.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-subtle">La póliza aún no tiene cuotas de cobranza.</td></tr>}
            </Table>
          </>
        ) : (
          <>
            <p className="mt-4 rounded-xl border border-line bg-surface-muted px-4 py-3 text-xs text-ink-muted">La cobranza inicia cuando la aseguradora emita la póliza. Este es el cronograma calculado para la orden.</p>
            <Table head={["Mes", "Valor asegurado", "Cuota"]}>
              {schedule.rows.map((r) => (
                <tr key={r.mes}>
                  <td className="px-3 py-2.5 font-semibold text-ink-subtle">{r.mes}</td>
                  <td className="px-3 py-2.5">{money(r.valor_asegurado_mes)}</td>
                  <td className="px-3 py-2.5 font-semibold">{money(r.cuota_fija)}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </section>

      {/* Historial de envíos */}
      <section className="glass-panel mt-4 p-5 sm:p-6">
        <SectionTitle icon={History} title="Historial de envíos del certificado" />
        {!sends.length && <p className="mt-4 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink-muted">Esta Orden de Emisión se registró antes de que existiera el certificado de cobertura; no tiene envíos.</p>}
        <ol className="mt-4 grid gap-2">
          {sends.map((e, i) => {
            const Icon = e.channel === "WHATSAPP" ? MessageCircle : Mail;
            return (
              <li key={i} className="flex flex-col gap-1 rounded-2xl border border-line px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-text"><Icon className="size-4" /></span>
                  <span className="min-w-0"><span className="font-semibold">{e.kind}</span> por {e.channel === "WHATSAPP" ? "WhatsApp" : "correo"} a <span className="font-semibold">{e.destination}</span></span>
                </span>
                <span className="pl-11 text-xs text-ink-subtle sm:pl-0">{dateTime(e.at)}{e.user ? ` · ${e.user}` : ""}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return <h2 className="flex items-center gap-2.5 text-sm font-bold"><span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand-text"><Icon className="size-4" /></span>{title}</h2>;
}

function Card({ icon, title, rows }: { icon: LucideIcon; title: string; rows: [string, string | null][] }) {
  return (
    <section className="glass-panel p-5 sm:p-6">
      <SectionTitle icon={icon} title={title} />
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle">{k}</dt>
            <dd className="mt-0.5 break-words text-sm font-semibold text-ink">{v || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Kpi({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-600" : "text-ink";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${strong ? "border-brand/40 bg-brand/5" : "border-line bg-white"}`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
      <p className={`mt-1 text-lg font-bold tracking-[-0.02em] ${color}`}>{value}</p>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="mt-4 max-h-[420px] overflow-auto rounded-2xl border border-line">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead className="sticky top-0 bg-surface-muted text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-subtle">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line bg-white">{children}</tbody>
      </table>
    </div>
  );
}

function InstallmentPill({ estado }: { estado: string }) {
  const cls = estado === "PAGADO" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : estado === "VENCIDO" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{nice(estado)}</span>;
}

function nice(v: string | null) {
  return v ? v.toLowerCase().replace(/_/g, " ").replace(/^\p{L}/u, (c) => c.toUpperCase()) : null;
}
function day(v: string | null) {
  if (!v) return "—";
  const [y, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function dateTime(v: string) {
  return new Date(v).toLocaleString("es-EC", { timeZone: "America/Guayaquil", dateStyle: "medium", timeStyle: "short" });
}
function money(v: number | string) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(v));
}
function coverageValue(v: string | null) {
  if (v === null) return "Incluida";
  const n = Number(v);
  return n <= 100 ? `${n.toLocaleString("es-EC")} %` : money(n);
}
