import Link from "next/link";
import { ArrowLeft, Ban, Building2, CalendarRange, Car, CircleDollarSign, FileText, History, Mail, MessageCircle, Scale, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { StatusPill } from "@/components/channel/order-status-pill";
import type { OrderDetailData } from "@/lib/policies/order-detail";

/** Detalle de una Orden de Emisión / póliza. Plantilla común del canal y de la aseguradora. */
export function OrderDetailView({ data, eyebrow, backHref, backLabel, actions, showDeductibles = false, showSends = true }: {
  data: OrderDetailData; eyebrow: string; backHref: string; backLabel: string; actions?: React.ReactNode; showDeductibles?: boolean; showSends?: boolean;
}) {
  const { order: o, coverages, deductibles, schedule, installments: cobranza, sends, leveling } = data;
  const total = schedule.reduce((t, r) => t + Number(r.cuota_fija), 0);
  const paid = cobranza.filter((c) => c.estado === "PAGADO");
  const overdue = cobranza.filter((c) => c.estado === "VENCIDO");
  const cancelled = cobranza.filter((c) => c.estado === "CANCELADA");
  const paidAmount = cobranza.flatMap((c) => c.pagos).reduce((t, p) => t + Number(p.monto), 0);

  return (
    <main className="relative z-10 mx-auto w-full min-w-0 max-w-[1280px] overflow-x-clip px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink"><ArrowLeft className="size-4" />{backLabel}</Link>

      {/* Cabecera */}
      <header className="glass-panel mt-3 flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-text/80">{eyebrow}</p>
          <h1 className="mt-1.5 truncate text-2xl font-bold tracking-[-0.03em] sm:text-3xl">{o.cliente}</h1>
          <p className="mt-1 text-sm text-ink-muted">{o.identificacion ?? "Sin identificación"} · {o.marca} {o.modelo}{o.placa ? ` · ${o.placa.toUpperCase()}` : ""}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill status={o.estado} policy={o.poliza_numero} policyStatus={o.poliza_estado} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[11px] text-ink-muted"><FileText className="size-3 text-brand-text" />{o.cert_numero ? `Certificado ${o.cert_numero}` : "Sin certificado"}</span>
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>

      {o.poliza_cancelacion && (
        <section role="status" className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600"><Ban className="size-5" /></span>
            <div>
              <p className="text-sm font-bold">{o.cancel_tipo === "PERDIDA_TOTAL" ? "Póliza cancelada por pérdida total" : "Póliza cancelada"} desde {monthLabel(o.poliza_cancelacion)}{o.cancel_cuota_desde ? ` · a partir de la cuota ${o.cancel_cuota_desde}` : ""}</p>
              {o.cancel_tipo === "PERDIDA_TOTAL" && <p className="mt-0.5 text-xs">Siniestro del {day(o.cancel_siniestro)}{o.cancel_reclamo ? ` · Reclamo ${o.cancel_reclamo}` : ""}</p>}
              <p className="mt-0.5 text-xs">Emitida el {day(o.poliza_emision)} · Cancelada desde el {day(o.poliza_cancelacion)}{o.cancel_registrada ? ` · Registrada el ${dateTime(o.cancel_registrada)}` : ""}</p>
              {o.cancel_motivo && <p className="mt-1 text-xs"><span className="font-semibold">Motivo:</span> {o.cancel_motivo}</p>}
            </div>
          </div>
          {leveling && <LevelingBox leveling={leveling} />}
        </section>
      )}

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
          ["Registrada el", dateTime(o.creado_en)], ...(o.poliza_numero ? [["Póliza", `${o.poliza_numero} · ${nice(o.poliza_estado)}`], ["Emitida el", day(o.poliza_emision)],
            ...(o.poliza_cancelacion ? [["Cancelada desde", `${day(o.poliza_cancelacion)}${o.cancel_cuota_desde ? ` (cuota ${o.cancel_cuota_desde})` : ""}`]] : [])] as [string, string | null][] : []),
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
          {coverages.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="flex items-center gap-2.5"><span className="size-1.5 rounded-full bg-brand" />{c.name}</span>
              <span className="font-bold">{coverageValue(c.value)}</span>
            </li>
          ))}
          {!coverages.length && <li className="px-4 py-3 text-sm text-ink-subtle">Sin coberturas registradas.</li>}
        </ul>
      </section>

      {showDeductibles && (
        <section className="glass-panel mt-4 p-5 sm:p-6">
          <SectionTitle icon={Scale} title="Deducibles" />
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {deductibles.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="min-w-0"><span className="flex items-center gap-2.5"><span className="size-1.5 rounded-full bg-brand" />{d.name}</span><span className="ml-4 block text-xs text-ink-subtle">{d.coverage ? `Cobertura: ${d.coverage}` : "Deducible general"}</span></span>
                <span className="shrink-0 font-bold">{d.type === "PORCENTAJE" ? `${Number(d.value).toLocaleString("es-EC")} %` : money(d.value)}</span>
              </li>
            ))}
            {!deductibles.length && <li className="px-4 py-3 text-sm text-ink-subtle">Sin deducibles registrados.</li>}
          </ul>
        </section>
      )}

      {/* Pago */}
      <section className="glass-panel mt-4 p-5 sm:p-6">
        <SectionTitle icon={CircleDollarSign} title="Pago" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Kpi label="Cuota mensual" value={money(o.cuota_fija_mensual)} strong />
          <Kpi label="Total de la vigencia" value={money(total)} />
          <Kpi label="Número de cuotas" value={String(schedule.length || o.anios_vigencia * 12)} />
        </div>

        {o.poliza_numero ? (
          <>
            <div className={`mt-4 grid gap-3 ${cancelled.length ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
              <Kpi label="Pagadas" value={String(paid.length)} tone="good" />
              <Kpi label="Pendientes" value={String(cobranza.length - paid.length - overdue.length - cancelled.length)} />
              {cancelled.length > 0 && <Kpi label="Canceladas" value={String(cancelled.length)} />}
              <Kpi label="Vencidas" value={String(overdue.length)} tone={overdue.length ? "bad" : undefined} />
              <Kpi label="Monto pagado" value={money(paidAmount)} />
            </div>
            <Table head={["Cuota", "Vencimiento", "Monto", "Estado", "Pagos registrados"]}>
              {cobranza.map((c) => (
                <tr key={c.numero_cuota} className={c.estado === "CANCELADA" ? "bg-surface-muted/60 text-ink-subtle" : ""}>
                  <td className="px-3 py-2.5 font-semibold text-ink-subtle">
                    {c.numero_cuota}
                    {c.numero_cuota === o.cancel_cuota_desde && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Cancelada desde aquí</span>}
                  </td>
                  <td className="px-3 py-2.5">{day(c.fecha_vencimiento)}</td>
                  <td className={`px-3 py-2.5 font-semibold ${c.estado === "CANCELADA" ? "line-through" : ""}`}>{money(c.monto)}</td>
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
              {schedule.map((r) => (
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

      {showSends && (
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
      )}
    </main>
  );
}

/** Nivelación interna de la cancelación (solo llega en el detalle de la aseguradora). */
function LevelingBox({ leveling: n }: { leveling: NonNullable<OrderDetailData["leveling"]> }) {
  const items: [string, string][] = n.tipo === "PERDIDA_TOTAL"
    ? [[`Prima pendiente (cuotas ${n.cuota_desde}–${n.cuota_hasta})`, money(n.prima_pendiente ?? 0)], ["Nivelación acumulada al siniestro", money(n.nivelacion_acumulada ?? 0)], ["Valor a descontar de la indemnización", money(n.valor)]]
    : [[`Nivelación de las cuotas ${n.cuota_desde}–${n.cuota_hasta}`, money(n.valor)]];
  return (
    <div className="shrink-0 rounded-xl border border-red-200 bg-white px-4 py-3 text-ink">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Nivelación (interna)</p>
      <dl className="mt-1.5 grid gap-1 text-xs">
        {items.map(([k, v], i) => <div key={k} className={`flex justify-between gap-6 ${i === items.length - 1 ? "border-t border-line pt-1 font-bold" : ""}`}><dt className="text-ink-muted">{k}</dt><dd className="tabular-nums">{v}</dd></div>)}
      </dl>
    </div>
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
  const cls = estado === "PAGADO" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : estado === "VENCIDO" ? "border-red-200 bg-red-50 text-red-700" : estado === "CANCELADA" ? "border-line bg-surface-muted text-ink-muted" : "border-amber-200 bg-amber-50 text-amber-700";
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
function monthLabel(v: string) {
  const [y, m] = v.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });
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
