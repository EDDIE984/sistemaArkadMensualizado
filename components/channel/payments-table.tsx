"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, CreditCard, Info, LoaderCircle, RefreshCw } from "lucide-react";
import { savePayments } from "@/app/actions/payments";
import { day, money, month, type PaymentFilters, type PaymentInput, type PaymentResult, type PaymentRow, type PaymentSummary } from "@/lib/payments/types";

const field = "mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand";
const toCents = (v: string | number) => Math.round(Number(v) * 100);

/** Cuota elegida a mano (se conserva al cambiar de página). */
type Picked = Pick<PaymentRow, "id" | "policy_id" | "policy" | "client" | "installment" | "due" | "balance" | "issued">;
/** En "todas las del filtro": por póliza, cuotas excluidas desde `from` (con su cantidad y saldo). */
type Exclusion = { policy: string; from: number; count: number; cents: number };

const payableRow = (r: PaymentRow) => r.status !== "PAGADO" && Number(r.balance) > 0 && !r.blocked;
const byPolicyInstallment = (a: { policy: string; installment: number }, b: { policy: string; installment: number }) =>
  a.policy.localeCompare(b.policy) || a.installment - b.installment;

export function PaymentsTable({ rows, summary, filters, today }: { rows: PaymentRow[]; summary: PaymentSummary; filters: PaymentFilters; today: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [all, setAll] = useState(false);
  const [picked, setPicked] = useState<Map<string, Picked>>(new Map());
  const [excluded, setExcluded] = useState<Map<string, Exclusion>>(new Map());
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<PaymentInput["method"]>("TRANSFERENCIA");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [pending, startTransition] = useTransition();

  const payable = rows.filter(payableRow);
  const excludedList = [...excluded.values()];
  const count = all ? summary.payable - excludedList.reduce((s, e) => s + e.count, 0) : picked.size;
  const cents = all
    ? toCents(summary.balance) - excludedList.reduce((s, e) => s + e.cents, 0)
    : [...picked.values()].reduce((s, r) => s + toCents(r.balance), 0);
  const minDate = all
    ? summary.max_issued ?? undefined
    : [...picked.values()].reduce<string | undefined>((max, r) => (!max || r.issued > max ? r.issued : max), undefined);
  const dateError = !date ? "Indica la fecha de pago." : date > today ? "La fecha de pago no puede ser futura." : minDate && date < minDate ? `La fecha de pago no puede ser anterior a la emisión de la póliza (${day(minDate)}).` : null;

  const isChecked = (r: PaymentRow, ex = excluded, pk = picked) => {
    if (!payableRow(r)) return false;
    if (!all) return pk.has(r.id);
    const e = ex.get(r.policy_id);
    return !e || r.installment < e.from;
  };
  /** Orden de pago: solo se puede marcar la siguiente cuota por cobrar de la póliza. */
  const canPick = (r: PaymentRow, pk = picked) =>
    r.installment === r.next_pending || [...pk.values()].some((p) => p.policy_id === r.policy_id && p.installment === r.installment - 1);

  function pickRows(target: PaymentRow[], pk: Map<string, Picked>) {
    const next = new Map(pk);
    for (const r of [...target].sort(byPolicyInstallment)) {
      if (!next.has(r.id) && canPick(r, next)) next.set(r.id, { id: r.id, policy_id: r.policy_id, policy: r.policy, client: r.client, installment: r.installment, due: r.due, balance: r.balance, issued: r.issued });
    }
    return next;
  }
  /** Quitar una cuota quita también las siguientes de la misma póliza. */
  function unpickRows(target: PaymentRow[], pk: Map<string, Picked>) {
    const next = new Map(pk);
    for (const r of target) for (const [id, p] of next) if (p.policy_id === r.policy_id && p.installment >= r.installment) next.delete(id);
    return next;
  }
  function excludeRows(target: PaymentRow[], ex: Map<string, Exclusion>) {
    const next = new Map(ex);
    for (const r of target) {
      const e = next.get(r.policy_id);
      if (!e || r.installment < e.from) next.set(r.policy_id, { policy: r.policy, from: r.installment, count: r.tail_count, cents: toCents(r.tail_balance) });
    }
    return next;
  }
  /** Volver a incluir solo es posible para la primera cuota excluida de la póliza. */
  function includeRows(target: PaymentRow[], ex: Map<string, Exclusion>) {
    const next = new Map(ex);
    for (const r of [...target].sort(byPolicyInstallment)) {
      const e = next.get(r.policy_id);
      if (!e || e.from !== r.installment) continue;
      if (e.count <= 1) next.delete(r.policy_id);
      else next.set(r.policy_id, { ...e, from: e.from + 1, count: e.count - 1, cents: e.cents - toCents(r.balance) });
    }
    return next;
  }

  function toggle(r: PaymentRow) {
    if (all) setExcluded(isChecked(r) ? excludeRows([r], excluded) : includeRows([r], excluded));
    else setPicked(picked.has(r.id) ? unpickRows([r], picked) : pickRows([r], picked));
  }
  const pageChecked = payable.length > 0 && payable.every((r) => isChecked(r));
  function togglePage() {
    if (all) setExcluded(pageChecked ? excludeRows(payable, excluded) : includeRows(payable, excluded));
    else setPicked(pageChecked ? unpickRows(payable, picked) : pickRows(payable, picked));
  }
  function disabledReason(r: PaymentRow) {
    if (!payableRow(r)) return r.blocked ? `Primero debe pagarse la cuota ${r.next_pending}, que está fuera del filtro.` : null;
    if (all) {
      const e = excluded.get(r.policy_id);
      return e && r.installment > e.from ? `Incluye antes la cuota ${e.from}.` : null;
    }
    return !picked.has(r.id) && !canPick(r) ? `Selecciona antes la cuota ${r.installment - 1}.` : null;
  }
  function clear() { setAll(false); setPicked(new Map()); setExcluded(new Map()); }

  function submit() {
    if (dateError) return;
    startTransition(async () => {
      try {
        const selection: PaymentInput["selection"] = all
          ? { mode: "all", filters, exclude: [...excluded].map(([policyId, e]) => ({ policyId, from: e.from })) }
          : { mode: "ids", ids: [...picked.keys()] };
        const response = await savePayments({ selection, date, method, reference, expectedCount: count, expectedCents: cents });
        setResult(response);
        if (response.status === "success") { clear(); setReference(""); }
        dialog.current?.close();
        router.refresh();
      } catch {
        dialog.current?.close();
        setResult({ status: "error", message: "Se interrumpió la conexión. Actualiza la consulta para revisar los pagos antes de reintentar." });
      }
    });
  }

  return <div className="mt-6">
    {result && <div role={result.status === "error" ? "alert" : "status"} className={`mb-4 rounded-xl border p-4 text-sm ${result.status === "success" ? "border-brand/30 bg-brand/10 text-brand-text" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message}</div>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-ink-muted"><strong className="text-ink">{summary.payable}</strong> cuotas por cobrar en el filtro <span className="mx-2 text-line">/</span><strong className="tabular-nums text-ink">{money(summary.balance)}</strong></p><button type="button" disabled={pending} onClick={() => { clear(); router.refresh(); }} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-50"><RefreshCw className="size-3.5" />Actualizar consulta</button></div>
    {summary.blocked > 0 && <p className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><Info className="mt-0.5 size-4 shrink-0" />{summary.blocked} {summary.blocked === 1 ? "cuota no se puede seleccionar porque su póliza tiene" : "cuotas no se pueden seleccionar porque sus pólizas tienen"} cuotas anteriores por cobrar fuera del filtro. Las cuotas se pagan en orden: amplía la fecha desde para incluirlas.</p>}
    {summary.payable > 0 && <div className="mb-3 flex flex-wrap items-center gap-3 text-xs"><button type="button" disabled={pending || summary.payable > 10_000} onClick={() => { setAll(true); setPicked(new Map()); setExcluded(new Map()); }} className="min-h-11 rounded-full border border-brand/30 px-4 font-bold text-brand-text hover:bg-brand/10 disabled:opacity-50">Seleccionar todas las cuotas por cobrar del filtro ({summary.payable})</button>{(all || count > 0) && <button type="button" disabled={pending} onClick={clear} className="min-h-11 px-2 font-semibold text-ink-muted">Quitar selección</button>}{summary.payable > 10_000 && <p className="text-ink-muted">Reduce el rango o los productos: máximo 10.000 cuotas por operación.</p>}</div>}
    {all && <p role="status" className="mb-3 text-sm font-semibold text-brand-text">Seleccionadas {count} de las {summary.payable} cuotas por cobrar del filtro, incluidas las de otras páginas.{excluded.size > 0 && " Desmarcar una cuota también desmarca las siguientes de esa póliza."}</p>}
    {!all && picked.size > 0 && <p className="mb-3 text-xs text-ink-muted">La selección se conserva al cambiar de página. Las cuotas se pagan en orden: al desmarcar una cuota también se desmarcan las siguientes de esa póliza.</p>}
    <section aria-label="Cuotas mensuales" className="glass-panel overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-surface-muted text-[10px] uppercase tracking-wider text-ink-subtle"><tr>
        <th className="w-12 px-3 py-2"><label className="flex size-11 cursor-pointer items-center justify-center"><input type="checkbox" aria-label="Seleccionar cuotas por cobrar de esta página" checked={pageChecked} disabled={!payable.length || pending} onChange={togglePage} className="size-4 accent-ink" /></label></th>
        <th className="px-3 py-4">Cliente / póliza</th><th className="px-3 py-4">Producto / placa</th><th className="px-3 py-4">Mes afectado</th><th className="px-3 py-4 text-right">Cuota / saldo</th><th className="px-3 py-4">Estado / pago</th>
      </tr></thead><tbody className="divide-y divide-line">{rows.map((r) => {
        const checked = isChecked(r);
        const reason = disabledReason(r);
        return <tr key={r.id} className={checked ? "bg-brand/5" : "hover:bg-surface-muted/50"}>
          <td className="px-3 py-3"><label className="flex size-11 cursor-pointer items-center justify-center" title={reason ?? undefined}><input type="checkbox" aria-label={`Seleccionar cuota ${r.installment} de ${r.client}, ${month(r.due)}, póliza ${r.policy}`} checked={checked} disabled={pending || !payableRow(r) || (!checked && Boolean(reason))} onChange={() => toggle(r)} className="size-4 accent-ink" /></label></td>
          <td className="px-3 py-4"><p className="font-semibold">{r.client}</p><p className="mt-1 text-xs text-ink-subtle">{r.identification || "Sin identificación"}</p><p className="mt-1 text-xs text-ink-muted">Póliza {r.policy}</p></td>
          <td className="px-3 py-4"><p>{r.product}</p><p className="mt-1 text-xs text-ink-subtle">{r.plate || "Sin placa"}</p></td>
          <td className="px-3 py-4"><p className="font-semibold capitalize">{month(r.due)}</p><p className="mt-1 text-xs text-ink-subtle">Cuota {r.installment} · vence {day(r.due)}</p>{reason && <p className="mt-1 max-w-56 text-[11px] text-amber-700">{reason}</p>}</td>
          <td className="px-3 py-4 text-right tabular-nums"><p className="font-bold">{money(r.balance)}</p><p className="mt-1 text-xs text-ink-subtle">Cuota {money(r.amount)}</p></td>
          <td className="px-3 py-4"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${r.status === "PAGADO" ? "border-brand/30 bg-brand/10 text-brand-text" : r.status === "VENCIDO" ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-surface-muted text-ink-muted"}`}>{r.status === "PAGADO" ? "Pagado" : r.status === "VENCIDO" ? "Vencido" : "Pendiente"}</span>{r.paid_on && <div className="mt-2 max-w-48 break-words text-[11px] text-ink-subtle"><p>Último pago: {day(r.paid_on)}</p><p>{r.method}{r.reference && ` · ${r.reference}`}</p><p>{r.registered_by}</p></div>}</td>
        </tr>;
      })}</tbody></table></div>
      {!rows.length && <div className="px-6 py-14 text-center"><CreditCard className="mx-auto size-8 text-brand-text" /><p className="mt-4 font-bold">Sin cuotas para estos filtros</p><p className="mt-2 text-sm text-ink-muted">Prueba otro rango de vencimiento, producto o estado.</p></div>}
    </section>
    {count > 0 && <div className="sticky bottom-3 z-10 mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/30 bg-white p-4 shadow-lg sm:px-6"><div><p className="text-xs text-ink-muted">{count} {count === 1 ? "cuota seleccionada" : "cuotas seleccionadas"}{all ? " del filtro" : ""}</p><p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{money(cents / 100)}</p></div><button type="button" disabled={pending} onClick={() => { if (minDate && date < minDate) setDate(minDate > today ? today : minDate); dialog.current?.showModal(); }} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-white hover:bg-ink/90 disabled:opacity-50"><CheckCheck className="size-4" />Registrar pagos</button></div>}
    <dialog ref={dialog} aria-labelledby="payment-title" onCancel={(e) => { if (pending) e.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-line bg-white p-6 text-ink shadow-xl backdrop:bg-ink/35 backdrop:backdrop-blur-sm sm:p-8">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <h2 id="payment-title" className="text-2xl font-bold tracking-tight">Registrar pagos</h2><p className="mt-2 text-sm leading-6 text-ink-muted">Se pagará el saldo completo de {count} {count === 1 ? "cuota" : "cuotas"}, por <strong className="text-ink">{money(cents / 100)}</strong>.</p>
        <ul className="mt-4 max-h-40 space-y-2 overflow-auto rounded-xl bg-surface-muted p-3 text-xs">{all ? <>
          <li>Todo el filtro: vencimientos del {day(filters.from)} al {day(filters.to)}, {filters.products.length || "todos los"} productos, estado {filters.status === "POR_COBRAR" ? "por cobrar" : filters.status.toLowerCase()}. Incluye todas las páginas.</li>
          {excludedList.map((e) => <li key={e.policy} className="text-ink-muted">Excepto póliza {e.policy}: desde la cuota {e.from} ({e.count} {e.count === 1 ? "cuota" : "cuotas"}, {money(e.cents / 100)}).</li>)}
        </> : [...picked.values()].sort(byPolicyInstallment).map((r) => <li key={r.id} className="flex justify-between gap-3"><span>{r.client} · {r.policy} · cuota {r.installment}<span className="block font-semibold capitalize">{month(r.due)}</span></span><strong className="whitespace-nowrap">{money(r.balance)}</strong></li>)}</ul>
        <fieldset disabled={pending} className="mt-5 grid gap-4"><label className="text-xs font-semibold">Fecha de pago<input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={minDate} max={today} required className={field} />{dateError ? <span role="alert" className="mt-1 block font-normal text-red-700">{dateError}</span> : minDate && <span className="mt-1 block font-normal text-ink-subtle">No puede ser anterior a la emisión de la póliza ({day(minDate)}).</span>}</label><label className="text-xs font-semibold">Método de pago<select value={method} onChange={(e) => setMethod(e.target.value as PaymentInput["method"])} className={field}><option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option><option value="DEPOSITO">Depósito</option><option value="CHEQUE">Cheque</option><option value="OTRO">Otro</option></select></label><label className="text-xs font-semibold">Referencia (opcional)<input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} className={field} placeholder="Número de comprobante o referencia" /></label></fieldset>
        <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="min-h-11 rounded-full border border-line px-5 text-sm font-bold disabled:opacity-50">Volver</button><button disabled={pending || Boolean(dateError)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white disabled:opacity-50">{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? "Registrando…" : "Confirmar pagos"}</button></div>
      </form>
    </dialog>
  </div>;
}
