"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Mail, RotateCcw, Save, Search, Trash2, Upload } from "lucide-react";
import { saveBulkUpload, validateBulkUpload, type BulkUploadState } from "@/app/actions/channel";
import { ActionTip, iconActionClass } from "@/components/channel/action-tip";
import type { BulkRowResult } from "@/lib/channel/bulk-orders";

export type BulkProduct = { id: string; name: string; insurerName: string; coverages: { id: string; name: string }[] };

const initial: BulkUploadState = { status: "idle", rows: [] };
const card = "glass-panel p-5 sm:p-6";
const stepTitle = "flex items-center gap-3 text-sm font-bold";
const stepNumber = "flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white";

export function BulkUpload({ products }: { products: BulkProduct[] }) {
  const [productId, setProductId] = useState(products.length === 1 ? products[0].id : "");
  const product = products.find((p) => p.id === productId);
  const [state, upload, uploading] = useActionState(validateBulkUpload, initial);
  const [rows, setRows] = useState<BulkRowResult[]>([]);
  const [shownState, setShownState] = useState(state);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [term, setTerm] = useState("");
  const [saving, startSaving] = useTransition();
  const [alreadySent, setAlreadySent] = useState<string[]>([]);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cada respuesta nueva de la validación reemplaza las filas en revisión.
  if (state !== shownState) {
    setShownState(state);
    setRows(state.rows);
    setNotice(state.message ? { kind: state.status === "error" ? "error" : "info", text: state.message } : null);
  }

  const selectProduct = (id: string) => {
    setProductId(id);
    setRows([]);
    setNotice(null);
  };
  const reset = () => { setRows([]); setNotice(null); setTerm(""); if (fileRef.current) fileRef.current.value = ""; };

  const withErrors = rows.filter((r) => r.errors.length).length;
  const ready = Boolean(product?.coverages.length);
  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.data.name, r.data.identification, r.data.plate, r.data.brand, r.data.model, r.data.email].some((v) => v.toLowerCase().includes(q)));
  }, [rows, term]);

  // Mientras se guardan y envían los certificados, avisar antes de salir de la página.
  useEffect(() => {
    if (!saving) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);

  const save = () => {
    confirmRef.current?.close();
    setAlreadySent([]);
    startSaving(async () => {
      const result = await saveBulkUpload({ productId, rows: rows.map((r) => ({ ...r, errors: [] })) });
      // Solo vuelve aquí si no se guardó (el éxito redirige a la lista).
      setRows(result.rows);
      setAlreadySent(result.alreadySent ?? []);
      setNotice({ kind: "error", text: result.message ?? "No se guardó ninguna orden." });
    });
  };
  const estimate = Math.max(1, Math.ceil((rows.length * 4) / 60));

  if (!products.length) {
    return <div className={`${card} mt-7 text-sm text-ink-muted`}>Tu canal no tiene productos activos para registrar Órdenes de Emisión.</div>;
  }

  return (
    <div className="mt-7 grid gap-4">
      {/* 1. Producto */}
      <section className={card}>
        <h2 className={stepTitle}><span className={stepNumber}>1</span>Producto</h2>
        <p className="mt-1 pl-10 text-xs text-ink-muted">Todo el archivo se registra con el mismo producto y sus coberturas.</p>
        <div className="mt-4 sm:pl-10">
          <label className="grid max-w-sm gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Producto</span>
            <select value={productId} onChange={(e) => selectProduct(e.target.value)} disabled={uploading || saving} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand/60">
              <option value="">Selecciona un producto</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.insurerName}</option>)}
            </select>
          </label>
          {product && !product.coverages.length && <p className="mt-2 text-xs text-red-600">Este producto no tiene coberturas activas; pide a la aseguradora que las configure.</p>}
        </div>
      </section>

      {/* 2. Plantilla */}
      <section className={`${card} ${ready ? "" : "opacity-60"}`}>
        <h2 className={stepTitle}><span className={stepNumber}>2</span>Plantilla</h2>
        <p className="mt-1 pl-10 text-xs text-ink-muted">Descarga la plantilla del producto, llénala y súbela. Máximo 100 filas por archivo (.xlsx, hasta 5 MB).</p>
        <form ref={formRef} action={upload} className="mt-4 flex flex-col gap-3 sm:flex-row sm:pl-10">
          <input type="hidden" name="productId" value={productId} />
          <a
            href={ready ? `/canal/cotizaciones/carga-masiva/plantilla?producto=${productId}` : undefined}
            aria-disabled={!ready}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink ${ready ? "hover:bg-surface-muted" : "pointer-events-none"}`}
          >
            <Download className="size-4" />Descargar plantilla
          </a>
          <label className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white ${ready && !uploading && !saving ? "cursor-pointer hover:bg-ink-strong" : "pointer-events-none opacity-70"}`}>
            {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? "Validando archivo…" : "Subir plantilla"}
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={!ready || uploading || saving}
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

      {/* 3. Revisión */}
      {rows.length > 0 && (
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={stepTitle}><span className={stepNumber}>3</span>Revisión</h2>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-ink-muted">{rows.length} filas</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">{rows.length - withErrors} listas</span>
              {withErrors > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">{withErrors} con errores</span>}
            </div>
          </div>

          {notice && (
            <p role="status" className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${withErrors || notice.kind === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {withErrors || notice.kind === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
              {notice.kind === "error" ? notice.text : withErrors ? `${withErrors} ${withErrors === 1 ? "fila tiene" : "filas tienen"} errores. Corrige el archivo y vuelve a subirlo, o elimina esas filas para guardar el resto.` : notice.text}
            </p>
          )}
          {alreadySent.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <p className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4 shrink-0" />Clientes que ya recibieron el correo (sin orden registrada):</p>
              <ul className="mt-2 grid gap-0.5 pl-6 text-xs">{alreadySent.map((c) => <li key={c} className="list-disc">{c}</li>)}</ul>
            </div>
          )}

          <label className="relative mt-4 block">
            <span className="sr-only">Buscar en la carga</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar por cliente, cédula, correo, placa, marca o modelo" className="min-h-11 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-sm text-ink outline-none focus:border-brand/60" />
          </label>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="bg-surface-muted text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-subtle">
                <tr>
                  <th className="px-3 py-2.5">Fila</th>
                  <th className="px-3 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5">Vehículo</th>
                  <th className="px-3 py-2.5">Placa</th>
                  <th className="px-3 py-2.5 text-right">Valor asegurado</th>
                  <th className="px-3 py-2.5">Vigencia</th>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-3 py-2.5"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => (
                  <tr key={r.row} className={r.errors.length ? "bg-red-50/40" : ""}>
                    <td className="px-3 py-3 font-semibold text-ink-subtle">{r.row}</td>
                    <td className="px-3 py-3"><p className="font-semibold text-ink">{r.data.name || "—"}</p><p className="text-ink-subtle">{r.data.identification}</p></td>
                    <td className="px-3 py-3 text-ink-muted">{r.data.brand} {r.data.model} {r.data.year}</td>
                    <td className="px-3 py-3 font-semibold uppercase tracking-wider text-ink">{r.data.plate || "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold text-ink">{money(r.data.insuredValue)}</td>
                    <td className="px-3 py-3 text-ink-muted">{r.data.durationYears ? `${r.data.durationYears} ${r.data.durationYears === "1" ? "año" : "años"}` : "—"}<span className="block text-ink-subtle">desde {day(r.data.startDate)}</span></td>
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

          <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-ink">
            <Mail className="mt-0.5 size-4 shrink-0 text-brand-text" />
            <span>Al guardar se enviará <strong>automáticamente por correo</strong> el certificado de cobertura a cada cliente ({rows.length} {rows.length === 1 ? "correo" : "correos"}). Si un envío falla, no se guarda ninguna orden.</span>
          </p>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={reset} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink hover:bg-surface-muted disabled:opacity-60">
              <RotateCcw className="size-4" />Subir otro archivo
            </button>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <button type="button" onClick={() => confirmRef.current?.showModal()} disabled={saving || withErrors > 0 || !rows.length || !ready} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-ink hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? "Guardando…" : `Guardar y enviar ${rows.length} ${rows.length === 1 ? "certificado" : "certificados"}`}
              </button>
              {withErrors > 0 && <p className="text-xs text-ink-subtle">Se guarda todo o nada: elimina o corrige las filas con errores.</p>}
            </div>
          </div>
        </section>
      )}

      {!rows.length && ready && !uploading && (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-white/70 px-5 py-4 text-xs text-ink-muted">
          <FileSpreadsheet className="size-5 shrink-0 text-brand-text" />
          Después de subir la plantilla verás aquí cada fila validada antes de guardarla.
        </div>
      )}
      <dialog ref={confirmRef} aria-labelledby="bulk-confirm-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-white p-0 text-ink shadow-[0_24px_70px_rgba(23,50,80,0.18)] backdrop:bg-ink/35 backdrop:backdrop-blur-sm">
        <div className="p-6 sm:p-7">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><AlertTriangle className="size-6" /></span>
          <h2 id="bulk-confirm-title" className="mt-5 text-xl font-bold tracking-[-0.02em]">¿Guardar y enviar {rows.length} {rows.length === 1 ? "certificado" : "certificados"}?</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink-muted">
            <li>• Se {rows.length === 1 ? "registrará" : "registrarán"} <strong className="text-ink">{rows.length} {rows.length === 1 ? "Orden de Emisión" : "Órdenes de Emisión"}</strong> y se enviará automáticamente el certificado de cobertura <strong className="text-ink">por correo</strong> a cada cliente.</li>
            <li>• El proceso puede tardar cerca de <strong className="text-ink">{estimate} {estimate === 1 ? "minuto" : "minutos"}</strong>. No cierres esta página.</li>
            <li>• Si un envío falla, <strong className="text-ink">no se guarda ninguna orden</strong> y te mostraremos a quién ya le llegó el correo.</li>
          </ul>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => confirmRef.current?.close()} className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-bold hover:bg-surface-muted">Cancelar</button>
            <button type="button" onClick={save} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-ink hover:bg-brand-strong"><Mail className="size-4" />Guardar y enviar</button>
          </div>
        </div>
      </dialog>

      {saving && (
        <div role="alertdialog" aria-live="assertive" aria-label="Enviando certificados" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-[0_24px_70px_rgba(23,50,80,0.18)]">
            <LoaderCircle className="mx-auto size-10 animate-spin text-brand" />
            <p className="mt-5 text-lg font-bold">Registrando y enviando certificados…</p>
            <p className="mt-2 text-sm leading-6 text-ink-muted">Se están enviando {rows.length} correos. Puede tardar cerca de {estimate} {estimate === 1 ? "minuto" : "minutos"}. <strong className="text-ink">No cierres esta página.</strong></p>
          </div>
        </div>
      )}
    </div>
  );
}

function money(v: string) {
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) && v ? new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n) : "—";
}
function day(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v || "—";
}
