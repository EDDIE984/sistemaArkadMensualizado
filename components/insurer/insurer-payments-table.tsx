"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CreditCard, LoaderCircle, RefreshCw, Undo2 } from "lucide-react";
import { saveReconciliation } from "@/app/actions/insurer-payments";
import { methodLabel, type InsurerPaymentFilters, type InsurerPaymentRow, type InsurerPaymentSummary, type ReconcileInput, type ReconcileResult } from "@/lib/insurer/payment-types";

type Picked = { amount: number; reconciled: boolean };

const money = (value: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value);
const day = (value: string) => value.slice(0, 10).split("-").reverse().join("/");
const sum = (items: Picked[], reconciled: boolean) => items.filter((p) => p.reconciled === reconciled).reduce((t, p) => ({ count: t.count + 1, amount: t.amount + p.amount }), { count: 0, amount: 0 });

/**
 * Pagos del filtro con selección para conciliar. Se pueden marcar filas sueltas
 * (se conservan al cambiar de página) o todos los del filtro con exclusiones.
 */
export function InsurerPaymentsTable({ rows, summary, filters }: { rows: InsurerPaymentRow[]; summary: InsurerPaymentSummary; filters: InsurerPaymentFilters }) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const [picked, setPicked] = useState<Map<string, Picked>>(new Map());
  const [excluded, setExcluded] = useState<Map<string, Picked>>(new Map());
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [pending, startTransition] = useTransition();

  const exPending = sum([...excluded.values()], false);
  const exDone = sum([...excluded.values()], true);
  const toReconcile = all ? { count: summary.pending - exPending.count, amount: summary.pendingAmount - exPending.amount } : sum([...picked.values()], false);
  const toUndo = all ? { count: summary.reconciled - exDone.count, amount: summary.reconciledAmount - exDone.amount } : sum([...picked.values()], true);
  const selected = toReconcile.count + toUndo.count;

  const pick = (r: InsurerPaymentRow): Picked => ({ amount: r.amount, reconciled: Boolean(r.reconciledAt) });
  const isChecked = (r: InsurerPaymentRow) => (all ? !excluded.has(r.id) : picked.has(r.id));
  function toggle(r: InsurerPaymentRow) {
    const next = new Map(all ? excluded : picked);
    if (next.has(r.id)) next.delete(r.id); else next.set(r.id, pick(r));
    if (all) setExcluded(next); else setPicked(next);
  }
  const pageChecked = rows.length > 0 && rows.every(isChecked);
  function togglePage() {
    const next = new Map(all ? excluded : picked);
    // En "todos", marcar la página = sacar sus filas de las exclusiones.
    for (const r of rows) {
      if (all) { if (pageChecked) next.set(r.id, pick(r)); else next.delete(r.id); }
      else if (pageChecked) next.delete(r.id); else next.set(r.id, pick(r));
    }
    if (all) setExcluded(next); else setPicked(next);
  }
  function clear() { setAll(false); setPicked(new Map()); setExcluded(new Map()); }

  function submit(reconcile: boolean) {
    const target = reconcile ? toReconcile : toUndo;
    startTransition(async () => {
      try {
        const selection: ReconcileInput["selection"] = all
          ? { mode: "all", filters, exclude: [...excluded.keys()] }
          : { mode: "ids", ids: [...picked].filter(([, p]) => p.reconciled !== reconcile).map(([id]) => id) };
        const response = await saveReconciliation({ reconcile, selection, expectedCount: target.count });
        setResult(response);
        if (response.status === "success") clear();
        router.refresh();
      } catch {
        setResult({ status: "error", message: "Se interrumpió la conexión. Actualiza la consulta para revisar la conciliación." });
      }
    });
  }

  return <div className="mt-6">
    {result && <div role={result.status === "error" ? "alert" : "status"} className={`mb-4 rounded-xl border p-4 text-sm ${result.status === "success" ? "border-brand/30 bg-brand/10 text-brand-text" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message}</div>}
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {summary.total > 0 && <button type="button" disabled={pending || summary.total > 10_000} onClick={() => { setAll(true); setPicked(new Map()); setExcluded(new Map()); }} className="min-h-11 rounded-full border border-brand/30 px-4 font-bold text-brand-text hover:bg-brand/10 disabled:opacity-50">Seleccionar todos los pagos del filtro ({summary.total})</button>}
        {selected > 0 && <button type="button" disabled={pending} onClick={clear} className="min-h-11 px-2 font-semibold text-ink-muted hover:text-ink">Quitar selección</button>}
        {summary.total > 10_000 && <p className="text-ink-muted">Reduce el rango o los filtros: máximo 10.000 pagos por operación.</p>}
      </div>
      <button type="button" disabled={pending} onClick={() => { clear(); router.refresh(); }} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-50"><RefreshCw className="size-3.5" />Actualizar consulta</button>
    </div>
    {all && <p role="status" className="mb-3 text-sm font-semibold text-brand-text">Seleccionados {selected} de los {summary.total} pagos del filtro, incluidos los de otras páginas.</p>}
    {!all && picked.size > 0 && <p className="mb-3 text-xs text-ink-muted">La selección se conserva al cambiar de página.</p>}

    <section aria-label="Pagos registrados por los canales" className="glass-panel overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="bg-surface-muted text-[10px] uppercase tracking-wider text-ink-subtle"><tr>
          <th className="w-12 px-3 py-2"><label className="flex size-11 cursor-pointer items-center justify-center"><input type="checkbox" aria-label="Seleccionar los pagos de esta página" checked={pageChecked} disabled={!rows.length || pending} onChange={togglePage} className="size-4 accent-ink" /></label></th>
          <th className="px-3 py-4">Fecha de pago</th><th className="px-3 py-4">Cliente / póliza</th><th className="px-3 py-4">Producto / canal</th><th className="px-3 py-4">Cuota</th><th className="px-3 py-4 text-right">Monto</th><th className="px-3 py-4">Método / referencia</th><th className="px-3 py-4">Conciliación</th>
        </tr></thead>
        <tbody className="divide-y divide-line">{rows.map((r) => {
          const checked = isChecked(r);
          return <tr key={r.id} className={checked ? "bg-brand/5" : "hover:bg-surface-muted/50"}>
            <td className="px-3 py-3"><label className="flex size-11 cursor-pointer items-center justify-center"><input type="checkbox" aria-label={`Seleccionar pago de ${r.client}, póliza ${r.policy}, cuota ${r.installment}`} checked={checked} disabled={pending} onChange={() => toggle(r)} className="size-4 accent-ink" /></label></td>
            <td className="px-3 py-4"><p className="font-semibold">{day(r.paidOn)}</p><p className="mt-1 text-xs text-ink-subtle">{r.registeredBy ?? "—"}</p></td>
            <td className="px-3 py-4"><p className="font-semibold">{r.client}</p><p className="mt-1 text-xs text-ink-subtle">{r.identification || "Sin identificación"}</p><p className="mt-1 text-xs text-ink-muted">Póliza {r.policy}{r.plate && ` · ${r.plate.toUpperCase()}`}</p></td>
            <td className="px-3 py-4"><p>{r.product}</p><p className="mt-1 text-xs text-ink-subtle">{r.channel ?? "—"}</p></td>
            <td className="px-3 py-4"><p className="font-semibold">Cuota {r.installment}</p><p className="mt-1 text-xs text-ink-subtle">Vence {day(r.due)}</p></td>
            <td className="px-3 py-4 text-right font-bold tabular-nums">{money(r.amount)}</td>
            <td className="px-3 py-4"><p>{methodLabel(r.method)}</p><p className="mt-1 max-w-48 break-words text-xs text-ink-subtle">{r.reference || "Sin referencia"}</p></td>
            <td className="px-3 py-4">{r.reconciledAt
              ? <><span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-1 text-[10px] font-bold text-brand-text">Conciliado</span><p className="mt-2 text-[11px] text-ink-subtle">{day(r.reconciledAt)}{r.reconciledBy && ` · ${r.reconciledBy}`}</p></>
              : <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Por conciliar</span>}</td>
          </tr>;
        })}</tbody>
      </table></div>
      {!rows.length && <div className="px-6 py-14 text-center"><CreditCard className="mx-auto size-8 text-brand-text" /><p className="mt-4 font-bold">Sin pagos para estos filtros</p><p className="mt-2 text-sm text-ink-muted">Prueba otro rango de fechas, canal o producto.</p></div>}
    </section>

    {selected > 0 && <div className="sticky bottom-3 z-10 mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/30 bg-white p-4 shadow-lg sm:px-6">
      <div><p className="text-xs text-ink-muted">{selected} {selected === 1 ? "pago seleccionado" : "pagos seleccionados"}{all ? " del filtro" : ""}</p><p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{money(toReconcile.amount + toUndo.amount)}</p></div>
      <div className="flex flex-wrap gap-2">
        {toUndo.count > 0 && <button type="button" disabled={pending} onClick={() => submit(false)} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line px-5 text-sm font-bold text-ink hover:bg-surface-muted disabled:opacity-50"><Undo2 className="size-4" />Quitar conciliación ({toUndo.count})</button>}
        {toReconcile.count > 0 && <button type="button" disabled={pending} onClick={() => submit(true)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-white hover:bg-ink/90 disabled:opacity-50">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}Conciliar {toReconcile.count} · {money(toReconcile.amount)}</button>}
      </div>
    </div>}
  </div>;
}
