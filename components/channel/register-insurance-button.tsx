"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronDown, ChevronRight, DatabaseZap, FilePlus2, FileSpreadsheet, Keyboard, X } from "lucide-react";

const OPTIONS = [
  {
    href: "/canal/cotizaciones/nueva",
    icon: Keyboard,
    title: "Ingreso manual",
    description: "Registra una orden digitando los datos del cliente y su vehículo.",
  },
  {
    href: "/canal/cotizaciones/carga-masiva",
    icon: FileSpreadsheet,
    title: "Carga masiva desde Excel",
    description: "Sube un listado de clientes y vehículos usando la plantilla.",
  },
] as const;

/** Botón principal del canal: abre las opciones para registrar seguros. */
export function RegisterInsuranceButton({ className = "" }: { className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-ink-strong ${className}`}
        aria-haspopup="dialog"
      >
        <FilePlus2 className="size-4" aria-hidden="true" />
        Registrar seguros
        <ChevronDown className="size-4 opacity-70" aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="register-title"
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-line bg-white p-0 text-ink shadow-[0_24px_70px_rgba(23,50,80,0.18)] backdrop:bg-ink/35 backdrop:backdrop-blur-sm"
        onClick={(event) => { if (event.target === dialogRef.current) close(); }}
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-text/80">Órdenes de Emisión</p>
              <h2 id="register-title" className="mt-1.5 text-xl font-bold tracking-[-0.02em]">Registrar seguros</h2>
              <p className="mt-1 text-sm text-ink-muted">Elige cómo quieres registrar las órdenes.</p>
            </div>
            <button type="button" onClick={close} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-surface-muted hover:text-ink" aria-label="Cerrar">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <ul className="mt-6 grid gap-3">
            {OPTIONS.map(({ href, icon: Icon, title, description }) => (
              <li key={href}>
                <Link href={href} onClick={close} className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-brand/50 hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-text">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{description}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-text" aria-hidden="true" />
                </Link>
              </li>
            ))}
            <li>
              <div aria-disabled="true" className="flex cursor-not-allowed items-center gap-4 rounded-2xl border border-dashed border-line bg-surface-muted p-4 opacity-70">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-ink-subtle">
                  <DatabaseZap className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-muted">
                    Sincronizar con la base del canal
                    <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-subtle">Próximamente</span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-ink-subtle">Importa las órdenes directamente desde el sistema del canal.</span>
                </span>
              </div>
            </li>
          </ul>
        </div>
      </dialog>
    </>
  );
}
