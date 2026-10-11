"use client";

import { useActionState, useRef } from "react";
import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { deleteChannelQuote } from "@/app/actions/channel";
import { initialChannelState } from "@/lib/channel/action-state";
import { ActionTip, iconActionClass } from "@/components/channel/action-tip";

type Props = { quoteId: string; client: string; vehicle: string; amount: string };

/** Botón + diálogo de confirmación para eliminar definitivamente una Orden de Emisión pendiente. */
export function DeleteOrderButton({ quoteId, client, vehicle, amount }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(deleteChannelQuote, initialChannelState);

  return (
    <>
      <ActionTip label="Eliminar">
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className={`${iconActionClass} text-ink-subtle hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-red-500`}
          aria-label={`Eliminar Orden de Emisión de ${client}`}
        >
          <Trash2 className="size-[18px]" aria-hidden="true" />
        </button>
      </ActionTip>

      <dialog
        ref={dialogRef}
        aria-labelledby={`del-title-${quoteId}`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-white p-0 text-ink shadow-[0_24px_70px_rgba(23,50,80,0.18)] backdrop:bg-ink/35 backdrop:backdrop-blur-sm"
      >
        <form action={action} className="p-6 sm:p-7">
          <input type="hidden" name="quoteId" value={quoteId} />
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertTriangle className="size-6" aria-hidden="true" />
            </span>
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={pending} className="inline-flex size-9 items-center justify-center rounded-full text-ink-subtle hover:bg-surface-muted hover:text-ink" aria-label="Cerrar">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <h2 id={`del-title-${quoteId}`} className="mt-5 text-xl font-bold tracking-[-0.02em]">¿Eliminar esta Orden de Emisión?</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Se eliminará definitivamente junto con su cronograma de pagos y la inspección fotográfica. Esta acción no se puede deshacer.
          </p>

          <dl className="mt-5 grid gap-3 rounded-2xl border border-line bg-surface-muted p-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-ink-subtle">Cliente</dt><dd className="text-right font-semibold">{client}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-subtle">Vehículo</dt><dd className="text-right font-semibold">{vehicle}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-subtle">Cuota mensual</dt><dd className="text-right font-semibold">{amount}</dd></div>
          </dl>

          {state.status === "error" && (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-bold text-ink hover:bg-surface-muted disabled:opacity-60">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-70">
              {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
              {pending ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
          </div>
        </form>
      </dialog>

    </>
  );
}
