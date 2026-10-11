"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Mail, MessageCircle, Send, X } from "lucide-react";
import { resendCertificate, type ResendState } from "@/app/actions/channel";
import { ActionTip, iconActionClass } from "@/components/channel/action-tip";

type Props = {
  quoteId: string;
  client: string;
  certificateNumber: string;
  email: string | null;
  phone: string | null;
  /** `icon`: botón redondo de fila; `button`: botón con texto (detalle). */
  variant?: "icon" | "button";
};

/** Reenvía al cliente el certificado ya emitido, por correo o WhatsApp. */
export function ResendCertificateButton({ quoteId, client, certificateNumber, email, phone, variant = "icon" }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [channel, setChannel] = useState<"CORREO" | "WHATSAPP">(email ? "CORREO" : "WHATSAPP");
  const [result, setResult] = useState<ResendState>({ status: "idle" });
  const [sending, start] = useTransition();

  const open = () => { setResult({ status: "idle" }); dialogRef.current?.showModal(); };
  const close = () => { if (!sending) dialogRef.current?.close(); };
  const send = () => start(async () => setResult(await resendCertificate(quoteId, channel)));

  const options = [
    { id: "CORREO" as const, icon: Mail, title: "Correo electrónico", detail: email || "El cliente no tiene correo", enabled: Boolean(email) },
    { id: "WHATSAPP" as const, icon: MessageCircle, title: "WhatsApp", detail: phone || "Teléfono no válido para WhatsApp", enabled: Boolean(phone) },
  ];

  return (
    <>
      {variant === "icon" ? (
        <ActionTip label="Reenviar certificado">
          <button type="button" onClick={open} aria-label={`Reenviar certificado de ${client}`} className={`${iconActionClass} text-ink-subtle hover:border-brand/40 hover:bg-brand/10 hover:text-brand-text focus-visible:outline-brand`}>
            <Send className="size-[17px]" aria-hidden="true" />
          </button>
        </ActionTip>
      ) : (
        <button type="button" onClick={open} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink hover:bg-surface-muted">
          <Send className="size-4" aria-hidden="true" />Reenviar certificado
        </button>
      )}

      <dialog
        ref={dialogRef}
        onCancel={(e) => { if (sending) e.preventDefault(); }}
        aria-labelledby={`resend-${quoteId}`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-white p-0 text-left text-ink shadow-[0_24px_70px_rgba(23,50,80,0.18)] backdrop:bg-ink/35 backdrop:backdrop-blur-sm"
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-text/80">Certificado {certificateNumber}</p>
              <h2 id={`resend-${quoteId}`} className="mt-1.5 text-xl font-bold tracking-[-0.02em]">Reenviar certificado</h2>
              <p className="mt-1 text-sm text-ink-muted">Se enviará nuevamente a <strong className="text-ink">{client}</strong>.</p>
            </div>
            <button type="button" onClick={close} disabled={sending} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-surface-muted hover:text-ink" aria-label="Cerrar">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {result.status === "sent" ? (
            <div className="mt-6">
              <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                Certificado reenviado por {result.channel === "CORREO" ? "correo" : "WhatsApp"} a {result.destination}.
              </p>
              <button type="button" onClick={close} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-ink-strong">Listo</button>
            </div>
          ) : (
            <>
              <fieldset className="mt-6 grid gap-3" disabled={sending}>
                <legend className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Enviar por</legend>
                {options.map(({ id, icon: Icon, title, detail, enabled }) => (
                  <label key={id} className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors ${!enabled ? "cursor-not-allowed border-dashed border-line bg-surface-muted opacity-60" : channel === id ? "cursor-pointer border-brand/60 bg-brand/5" : "cursor-pointer border-line hover:border-brand/40"}`}>
                    <input type="radio" name={`resend-channel-${quoteId}`} checked={channel === id} disabled={!enabled} onChange={() => setChannel(id)} className="size-4 accent-[#02c7b3]" />
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-text"><Icon className="size-5" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{title}</span>
                      <span className="block truncate text-xs text-ink-muted">{detail}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {result.status === "error" && (
                <p role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="mt-0.5 size-4 shrink-0" />{result.message}</p>
              )}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={close} disabled={sending} className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-bold hover:bg-surface-muted disabled:opacity-60">Cancelar</button>
                <button type="button" onClick={send} disabled={sending || !options.find((o) => o.id === channel)?.enabled} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-ink hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60">
                  {sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {sending ? "Enviando…" : "Reenviar"}
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
