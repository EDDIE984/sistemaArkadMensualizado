import type { LucideIcon } from "lucide-react";

/** Dato de la fila: ícono + etiqueta + valor, con el mismo formato para todos. */
export function Meta({ icon: Icon, label, value, mono = false }: { icon: LucideIcon; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-text">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle">{label}</dt>
        <dd className={`truncate text-xs font-semibold text-ink ${mono ? "tracking-wider" : ""}`} title={value}>{value}</dd>
      </div>
    </div>
  );
}
