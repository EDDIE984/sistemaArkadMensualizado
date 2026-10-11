/** Envuelve un botón de solo ícono y muestra su nombre al pasar el mouse o enfocarlo con teclado. */
export function ActionTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="presentation"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition duration-150 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:translate-y-0 group-has-[:focus-visible]/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

/** Estilo común de los botones redondos de acción de una fila. */
export const iconActionClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
