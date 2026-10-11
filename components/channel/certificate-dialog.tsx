"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Download, LoaderCircle, Mail, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { finalizeAssistedQuote, type FinalizeQuoteState } from "@/app/actions/channel";

type Props = {
  preview: { pdf: string; clientName: string; email: string; phone: string | null };
  formData: FormData;
  onCancel: () => void;
};

function pdfUrl(base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

/**
 * Diálogo bloqueante del registro manual: muestra el certificado y obliga a
 * enviarlo (correo o WhatsApp). La Orden de Emisión solo se guarda si el envío
 * se completa; la única salida sin enviar es cancelar la orden.
 */
export function CertificateDialog({ preview, formData, onCancel }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [channel, setChannel] = useState<"CORREO" | "WHATSAPP">(preview.email ? "CORREO" : "WHATSAPP");
  const [result, setResult] = useState<FinalizeQuoteState | null>(null);
  const [sending, startSending] = useTransition();
  const sent = result?.status === "sent" ? result : null;
  const previewUrl = useMemo(() => pdfUrl(preview.pdf), [preview.pdf]);
  const finalUrl = useMemo(() => (sent ? pdfUrl(sent.pdf) : null), [sent]);

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  useEffect(() => () => { if (finalUrl) URL.revokeObjectURL(finalUrl); }, [finalUrl]);

  // Mientras no se envíe, avisar antes de salir: la orden no se guardará.
  useEffect(() => {
    if (sent) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sent]);

  const send = () =>
    startSending(async () => {
      const fd = new FormData();
      formData.forEach((v, k) => fd.append(k, v));
      fd.set("deliveryChannel", channel);
      setResult(await finalizeAssistedQuote(fd));
    });

  const options = [
    { id: "CORREO" as const, icon: Mail, title: "Correo electrónico", detail: preview.email || "El cliente no tiene correo", enabled: Boolean(preview.email) },
    { id: "WHATSAPP" as const, icon: MessageCircle, title: "WhatsApp", detail: preview.phone || "Teléfono no válido para WhatsApp", enabled: Boolean(preview.phone) },
  ];

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => e.preventDefault()}
      aria-labelledby="cert-title"
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-ink backdrop:bg-ink/45 backdrop:backdrop-blur-sm sm:m-auto sm:h-[min(92dvh,900px)] sm:w-[min(96vw,1200px)] sm:rounded-3xl"
    >
      <div className="grid h-full bg-white sm:rounded-3xl lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="hidden min-h-0 border-r border-line bg-surface-muted lg:block lg:rounded-l-3xl">
          <iframe title="Certificado de cobertura" src={`${finalUrl ?? previewUrl}#toolbar=0&view=FitH`} className="size-full lg:rounded-l-3xl" />
        </div>

        <div className="flex min-h-0 flex-col overflow-y-auto p-6 sm:p-7">
          {sent ? (
            <>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-6" /></span>
              <h2 id="cert-title" className="mt-5 text-xl font-bold tracking-[-0.02em]">Orden de Emisión registrada</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                El certificado <strong className="text-ink">{sent.number}</strong> se envió por {sent.channel === "CORREO" ? "correo" : "WhatsApp"} a <strong className="text-ink">{sent.destination}</strong>.
              </p>
              <a href={finalUrl!} download={`Certificado-${sent.number}.pdf`} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold hover:bg-surface-muted">
                <Download className="size-4" />Descargar PDF
              </a>
              <a href={finalUrl!} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold hover:bg-surface-muted lg:hidden">
                Ver certificado
              </a>
              <button type="button" onClick={() => router.push(`/canal/cotizaciones/${sent.quoteId}?created=1`)} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-white hover:bg-ink-strong">
                Ir a la Orden de Emisión <ArrowRight className="size-4" />
              </button>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-text/80">Certificado de cobertura</p>
              <h2 id="cert-title" className="mt-1.5 text-xl font-bold tracking-[-0.02em]">Envía el certificado al cliente</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                La Orden de Emisión de <strong className="text-ink">{preview.clientName}</strong> solo se registrará cuando el certificado se envíe correctamente.
              </p>
              <a href={previewUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-5 text-sm font-bold lg:hidden">
                Ver vista previa del certificado
              </a>

              <fieldset className="mt-6 grid gap-3" disabled={sending}>
                <legend className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Enviar por</legend>
                {options.map(({ id, icon: Icon, title, detail, enabled }) => (
                  <label key={id} className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors ${!enabled ? "cursor-not-allowed border-dashed border-line bg-surface-muted opacity-60" : channel === id ? "cursor-pointer border-brand/60 bg-brand/5" : "cursor-pointer border-line hover:border-brand/40"}`}>
                    <input type="radio" name="deliveryChannel" value={id} checked={channel === id} disabled={!enabled} onChange={() => setChannel(id)} className="size-4 accent-[#02c7b3]" />
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-text"><Icon className="size-5" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{title}</span>
                      <span className="block truncate text-xs text-ink-muted">{detail}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {result?.status === "error" && (
                <p role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="mt-0.5 size-4 shrink-0" />{result.message}</p>
              )}

              <p className="mt-4 flex gap-2 text-xs leading-5 text-ink-subtle"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-text" />El mensaje indica que es automático y que el cliente no debe responderlo.</p>

              <div className="mt-auto grid gap-3 pt-6">
                <button type="button" onClick={send} disabled={sending || !options.find((o) => o.id === channel)?.enabled} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-ink hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60">
                  {sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {sending ? (channel === "WHATSAPP" ? "Enviando por WhatsApp…" : "Enviando correo…") : "Enviar y registrar"}
                </button>
                <button type="button" onClick={() => { dialogRef.current?.close(); onCancel(); }} disabled={sending} className="min-h-11 rounded-full px-5 text-sm font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-50">
                  Cancelar orden (no se guardará)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
