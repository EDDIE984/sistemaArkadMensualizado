"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, AlertTriangle, Ban, CalendarX2, LoaderCircle } from "lucide-react";
import { confirmCancellation } from "@/app/actions/channel";

export type CancelInstallment = { number: number; due: string; amount: string; status: string };

const card = "glass-panel p-5 sm:p-6";

/** Elegir el mes de cancelación, ver qué cuotas se cancelan y confirmar (el servidor revalida todo). */
export function CancelPolicyForm({ policyId, issuedOn, installments }: { policyId: string; issuedOn: string; installments: CancelInstallment[] }) {
  const [month, setMonth] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const confirmRef = useRef<HTMLDialogElement>(null);
  // Solo se cancela desde cuotas por cobrar: si hay cuotas pagadas (incluso por adelantado), desde la siguiente a la última pagada.
  const lastPaid = installments.filter((i) => i.status === "PAGADO").at(-1);
  const firstAfterPaid = lastPaid ? installments.find((i) => i.number > lastPaid.number) : undefined;
  const minMonth = [issuedOn.slice(0, 7), firstAfterPaid?.due.slice(0, 7) ?? ""].sort().at(-1)!;
  const fullyPaid = Boolean(lastPaid && !firstAfterPaid);
  const maxMonth = installments.at(-1)?.due.slice(0, 7);

  const plan = useMemo(() => {
    if (!month) return null;
    if (fullyPaid) return { error: "Todas las cuotas están pagadas; no hay cuotas por cancelar." } as const;
    if (month < issuedOn.slice(0, 7)) return { error: "El mes de cancelación es anterior al mes de emisión de la póliza." } as const;
    const cancelled = installments.filter((i) => i.due >= `${month}-01`);
    if (!cancelled.length) return { error: "No hay cuotas desde ese mes: está fuera de la vigencia." } as const;
    const paid = cancelled.filter((i) => i.status === "PAGADO").map((i) => i.number);
    if (paid.length) return { error: `${paid.length === 1 ? "La cuota" : "Las cuotas"} ${paid.join(", ")} ya ${paid.length === 1 ? "está pagada" : "están pagadas"}; elige un mes posterior.` } as const;
    const total = cancelled.reduce((sum, i) => sum + Math.round(Number(i.amount) * 100), 0) / 100;
    return { from: cancelled[0].number, to: cancelled[cancelled.length - 1].number, count: cancelled.length, total } as const;
  }, [month, issuedOn, fullyPaid, installments]);
  const ok = plan && !("error" in plan) ? plan : null;
  const pending = useMemo(() => {
    const open = installments.filter((i) => i.status === "PENDIENTE" || i.status === "VENCIDO");
    return { count: open.length, total: open.reduce((sum, i) => sum + Math.round(Number(i.amount) * 100), 0) / 100 };
  }, [installments]);

  const submit = () => {
    confirmRef.current?.close();
    setError(null);
    startSaving(async () => {
      const result = await confirmCancellation({ policyId, month, reason: reason || undefined });
      // Solo vuelve aquí si falló (el éxito redirige a la lista).
      if (result.status === "error") setError(result.message);
    });
  };

  return (
    <div className="mt-4 grid gap-4">
      <section className={card}>
        <h2 className="flex items-center gap-2 text-sm font-bold"><CalendarX2 className="size-4 text-brand-text" />Mes de cancelación</h2>
        {lastPaid && !fullyPaid && <p className="mt-1 text-xs text-ink-muted">La cuota {lastPaid.number} ya está pagada: solo se puede cancelar desde {monthLabel(minMonth)} (cuota {firstAfterPaid!.number}).</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface-muted px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Total pendiente</p>
            <p className="mt-1 text-xl font-bold text-ink">{money(pending.total)}</p>
            <p className="text-[11px] text-ink-subtle">{pending.count} {pending.count === 1 ? "cuota pendiente" : "cuotas pendientes"}</p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${ok ? "border-red-200 bg-red-50" : "border-dashed border-line"}`}>
            <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${ok ? "text-red-700" : "text-ink-subtle"}`}>Total a cancelar</p>
            <p className={`mt-1 text-xl font-bold ${ok ? "text-red-700" : "text-ink-subtle"}`}>{ok ? money(ok.total) : "—"}</p>
            <p className="text-[11px] text-ink-subtle">{ok ? `${ok.count} ${ok.count === 1 ? "cuota" : "cuotas"} (de la ${ok.from} a la ${ok.to})` : "Elige el mes de cancelación"}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
          <label className="grid gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Cancelar desde</span>
            <input type="month" value={month} min={minMonth} max={maxMonth} onChange={(e) => { setMonth(e.target.value); setError(null); }} disabled={saving} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand/60" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Motivo (opcional)</span>
            <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} disabled={saving} placeholder="Ej.: venta del vehículo" className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand/60" />
          </label>
        </div>
        {plan && "error" in plan && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="mt-0.5 size-4 shrink-0" />{plan.error}</p>}
        {ok && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Se cancelarán <strong>{ok.count} {ok.count === 1 ? "cuota" : "cuotas"}</strong>: de la cuota <strong>{ok.from}</strong> a la <strong>{ok.to}</strong>. Valor total de la cancelación: <strong>{money(ok.total)}</strong>. La póliza quedará cancelada desde <strong>{monthLabel(month)}</strong>.</span>
          </p>
        )}
        {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
        <div className="mt-5 flex justify-end border-t border-line pt-5">
          <button type="button" onClick={() => confirmRef.current?.showModal()} disabled={!ok || saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Ban className="size-4" />}
            {saving ? "Cancelando…" : "Cancelar póliza"}
          </button>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">Cuotas</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="bg-surface-muted text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-subtle">
              <tr><th className="px-3 py-2.5">Cuota</th><th className="px-3 py-2.5">Vence</th><th className="px-3 py-2.5 text-right">Monto</th><th className="px-3 py-2.5">Estado</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {installments.map((i) => {
                const willCancel = ok && i.number >= ok.from;
                return (
                  <tr key={i.number} className={willCancel ? "bg-red-50/50 text-ink-subtle" : ""}>
                    <td className="px-3 py-2.5 font-semibold">{i.number}{ok?.from === i.number && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Desde aquí</span>}</td>
                    <td className="px-3 py-2.5">{day(i.due)}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${willCancel ? "line-through" : "text-ink"}`}>{money(i.amount)}</td>
                    <td className="px-3 py-2.5">{willCancel ? <Pill label="Se cancelará" cls="border-red-200 bg-red-50 text-red-700" /> : <StatusPill status={i.status} />}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-line">
              <tr className="bg-surface-muted">
                <td colSpan={2} className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Total pendiente ({pending.count} {pending.count === 1 ? "cuota" : "cuotas"})</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-ink">{money(pending.total)}</td>
                <td />
              </tr>
              {ok && (
                <tr className="border-t border-line bg-red-50/60">
                  <td colSpan={2} className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Total a cancelar ({ok.count} {ok.count === 1 ? "cuota" : "cuotas"})</td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-red-700">{money(ok.total)}</td>
                  <td />
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </section>

      <dialog ref={confirmRef} aria-labelledby="cancel-confirm-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-white p-0 text-ink shadow-[0_24px_70px_rgba(23,50,80,0.18)] backdrop:bg-ink/35 backdrop:backdrop-blur-sm">
        <div className="p-6 sm:p-7">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><Ban className="size-6" /></span>
          <h2 id="cancel-confirm-title" className="mt-5 text-xl font-bold tracking-[-0.02em]">¿Cancelar la póliza?</h2>
          {ok && <p className="mt-3 text-sm leading-6 text-ink-muted">Se cancelarán las cuotas <strong className="text-ink">{ok.from} a {ok.to}</strong> desde <strong className="text-ink">{monthLabel(month)}</strong>, por un valor total de <strong className="text-ink">{money(ok.total)}</strong>. Esta acción no se puede deshacer.</p>}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => confirmRef.current?.close()} className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-bold hover:bg-surface-muted">Volver</button>
            <button type="button" onClick={submit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700"><Ban className="size-4" />Sí, cancelar</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function Pill({ label, cls }: { label: string; cls: string }) {
  return <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{label}</span>;
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    PENDIENTE: ["Pendiente", "border-amber-200 bg-amber-50 text-amber-700"],
    PAGADO: ["Pagada", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    VENCIDO: ["Vencida", "border-red-200 bg-red-50 text-red-700"],
    CANCELADA: ["Cancelada", "border-line bg-surface-muted text-ink-muted"],
  };
  const [label, cls] = map[status] ?? [status, "border-line bg-surface-muted text-ink-muted"];
  return <Pill label={label} cls={cls} />;
}
function day(v: string) {
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}
function money(v: string | number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(v));
}
function monthLabel(v: string) {
  const [y, m] = v.split("-");
  const name = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-EC", { month: "long" });
  return `${name} de ${y}`;
}
