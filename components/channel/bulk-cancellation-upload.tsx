"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, AlertTriangle, Ban, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import { saveCancellationUpload, validateCancellationUpload, type CancellationUploadState } from "@/app/actions/channel";
import { ActionTip, iconActionClass } from "@/components/channel/action-tip";
import type { CancellationRowResult } from "@/lib/channel/bulk-cancellations";

const initial: CancellationUploadState = { status: "idle", rows: [] };
const card = "glass-panel p-5 sm:p-6";
const stepTitle = "flex items-center gap-3 text-sm font-bold";
const stepNumber = "flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white";

export function BulkCancellationUpload() {
  const [state, upload, uploading] = useActionState(validateCancellationUpload, initial);
  const [rows, setRows] = useState<CancellationRowResult[]>([]);
  const [shownState, setShownState] = useState(state);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [term, setTerm] = useState("");
  const [saving, startSaving] = useTransition();
  const confirmRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cada respuesta nueva de la validación reemplaza las filas en revisión.
  if (state !== shownState) {
    setShownState(state);
    setRows(state.rows);
    setNotice(state.message ? { kind: state.status === "error" ? "error" : "info", text: state.message } : null);
  }

  const reset = () => { setRows([]); setNotice(null); setTerm(""); if (fileRef.current) fileRef.current.value = ""; };
  const withErrors = rows.filter((r) => r.errors.length).length;
  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.data.identification, r.data.plate, r.data.product, r.preview?.client ?? "", r.preview?.policyNumber ?? ""].some((v) => v.toLowerCase().includes(q)));
  }, [rows, term]);

  const save = () => {
    confirmRef.current?.close();
    startSaving(async () => {
      const result = await saveCancellationUpload({ rows: rows.map((r) => ({ ...r, errors: [] })) });
      // Solo vuelve aquí si no se guardó (el éxito redirige a la lista).
      setRows(result.rows);
      setNotice({ kind: "error", text: result.message ?? "No se canceló ninguna póliza." });
    });
  };

  return (
    <div className="mt-7 grid gap-4">
      <section className={card}>
        <h2 className={stepTitle}><span className={stepNumber}>1</span>Plantilla</h2>
        <p className="mt-1 pl-10 text-xs text-ink-muted">Descarga la plantilla, indica por cada póliza la cédula/RUC, la placa, el producto y el mes de cancelación, y súbela. Máximo 100 filas (.xlsx, hasta 5 MB).</p>
        <form ref={formRef} action={upload} className="mt-4 flex flex-col gap-3 sm:flex-row sm:pl-10">
          <a href="/canal/cancelaciones/carga-masiva/plantilla" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink hover:bg-surface-muted">
            <Download className="size-4" />Descargar plantilla
          </a>
          <label className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white ${!uploading && !saving ? "cursor-pointer hover:bg-ink-strong" : "pointer-events-none opacity-70"}`}>
            {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? "Validando archivo…" : "Subir plantilla"}
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={uploading || saving}
              onChange={(e) => { if (e.target.files?.length) formRef.current?.requestSubmit(); }}
            />
          </label>
        </form>
        {notice && !rows.length && (
          <p role="alert" className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm sm:ml-10 ${notice.kind === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-surface-muted text-ink-muted"}`}>
            <AlertCircle className="mt-0.5 size-4 shrink-0" />{notice.text}
          </p>
        )}
      </section>

      {rows.length > 0 && (
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={stepTitle}><span className={stepNumber}>2</span>Revisión</h2>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-ink-muted">{rows.length} filas</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">{rows.length - withErrors} listas</span>
              {withErrors > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">{withErrors} con errores</span>}
            </div>
          </div>

          {notice && (
            <p role="status" className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${withErrors || notice.kind === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {withErrors || notice.kind === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
              {notice.kind === "error" ? notice.text : withErrors ? `${withErrors} ${withErrors === 1 ? "fila tiene" : "filas tienen"} errores. Corrige el archivo y vuelve a subirlo, o elimina esas filas para cancelar el resto.` : notice.text}
            </p>
          )}

          <label className="relative mt-4 block">
            <span className="sr-only">Buscar en la carga</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar por cliente, cédula, placa, póliza o producto" className="min-h-11 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-sm text-ink outline-none focus:border-brand/60" />
          </label>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-surface-muted text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-subtle">
                <tr>
                  <th className="px-3 py-2.5">Fila</th>
                  <th className="px-3 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Placa</th>
                  <th className="px-3 py-2.5">Producto</th>
                  <th className="px-3 py-2.5">Póliza</th>
                  <th className="px-3 py-2.5">Cancela desde</th>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-3 py-2.5"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => (
                  <tr key={r.row} className={r.errors.length ? "bg-red-50/40" : ""}>
                    <td className="px-3 py-3 font-semibold text-ink-subtle">{r.row}</td>
                    <td className="px-3 py-3"><p className="font-semibold text-ink">{r.preview?.client ?? "—"}</p><p className="text-ink-subtle">{r.data.identification}</p></td>
                    <td className="px-3 py-3 font-semibold uppercase tracking-wider text-ink">{r.data.plate || "—"}</td>
                    <td className="px-3 py-3 text-ink-muted">{r.data.product || "—"}</td>
                    <td className="px-3 py-3 font-semibold text-ink">{r.preview?.policyNumber ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-muted">
                      {r.preview ? <>{monthLabel(r.preview.month)}<span className="block text-ink-subtle">Cuotas {r.preview.from}–{r.preview.to} ({r.preview.count})</span></> : r.data.month || "—"}
                    </td>
                    <td className="px-3 py-3">
                      {r.errors.length ? (
                        <ul className="grid gap-0.5 text-red-700">{r.errors.map((e) => <li key={e} className="flex gap-1.5"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{e}</li>)}</ul>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700"><CheckCircle2 className="size-3.5" />Lista</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <ActionTip label="Eliminar fila">
                        <button type="button" onClick={() => setRows((all) => all.filter((x) => x.row !== r.row))} disabled={saving} aria-label={`Eliminar fila ${r.row}`} className={`${iconActionClass} size-9 text-ink-subtle hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-red-500`}>
                          <Trash2 className="size-4" />
                        </button>
                      </ActionTip>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-ink-subtle">No hay filas que coincidan con &quot;{term}&quot;.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={reset} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink hover:bg-surface-muted disabled:opacity-60">
              <RotateCcw className="size-4" />Subir otro archivo
            </button>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <button type="button" onClick={() => confirmRef.current?.showModal()} disabled={saving || withErrors > 0 || !rows.length} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Ban className="size-4" />}
                {saving ? "Cancelando…" : `Cancelar ${rows.length} ${rows.length === 1 ? "póliza" : "pólizas"}`}
              </button>
              {withErrors > 0 && <p className="text-xs text-ink-subtle">Se guarda todo o nada: elimina o corrige las filas con errores.</p>}
            </div>
          </div>
        </section>
      )}

      {!rows.length && !uploading && (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-white/70 px-5 py-4 text-xs text-ink-muted">
          <FileSpreadsheet className="size-5 shrink-0 text-brand-text" />
          Después de subir la plantilla verás aquí cada póliza identificada y las cuotas que se cancelarán.
        </div>
      )}

      <dialog ref={confirmRef} aria-labelledby="bulk-cancel-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-white p-0 text-ink shadow-[0_24px_70px_rgba(23,50,80,0.18)] backdrop:bg-ink/35 backdrop:backdrop-blur-sm">
        <div className="p-6 sm:p-7">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertTriangle className="size-6" /></span>
          <h2 id="bulk-cancel-title" className="mt-5 text-xl font-bold tracking-[-0.02em]">¿Cancelar {rows.length} {rows.length === 1 ? "póliza" : "pólizas"}?</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink-muted">
            <li>• Las cuotas desde el mes indicado en cada fila quedarán <strong className="text-ink">canceladas</strong>.</li>
            <li>• Si alguna póliza falla, <strong className="text-ink">no se cancela ninguna</strong>.</li>
            <li>• Esta acción no se puede deshacer.</li>
          </ul>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => confirmRef.current?.close()} className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-bold hover:bg-surface-muted">Volver</button>
            <button type="button" onClick={save} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700"><Ban className="size-4" />Sí, cancelar</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function monthLabel(v: string) {
  const [y, m] = v.split("-");
  return `${m}/${y}`;
}
