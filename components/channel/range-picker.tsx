"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Check, X } from "lucide-react";

type Option = { key: string; label: string };

/**
 * Selector de rango con UNA sola forma de elegir: opciones rápidas o
 * "Personalizado", que es lo único que muestra los campos de fecha.
 */
export function RangePicker({
  label,
  options,
  activeKey,
  param,
  fromParam,
  toParam,
  range,
  preserve,
  anchor = "",
}: {
  label: string;
  options: readonly Option[];
  activeKey: string;
  /** Parámetro de la URL que guarda la opción (`periodo` o `vence`). */
  param: string;
  fromParam: string;
  toParam: string;
  /** Rango efectivo actual (se usa de partida al personalizar). */
  range: { from: string; to: string };
  /** Otros filtros de la URL que se conservan. */
  preserve: Record<string, string>;
  anchor?: string;
}) {
  const [custom, setCustom] = useState(activeKey === "rango");
  const selected = custom ? "rango" : activeKey;
  const hrefFor = (key: string) => `/canal?${new URLSearchParams({ ...preserve, [param]: key }).toString()}${anchor}`;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">{label}</span>
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-full border border-line bg-surface-muted p-1">
          {options.map((o) => {
            const on = selected === o.key;
            const cls = `inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-colors ${on ? "bg-white text-ink shadow-[0_2px_8px_rgba(23,50,80,0.12)]" : "text-ink-muted hover:text-ink"}`;
            return o.key === "rango" ? (
              <button key={o.key} type="button" role="radio" aria-checked={on} onClick={() => setCustom(true)} className={cls}>
                <CalendarDays className="size-3.5" aria-hidden="true" />{o.label}
              </button>
            ) : (
              <Link key={o.key} href={hrefFor(o.key)} role="radio" aria-checked={on} onClick={() => setCustom(false)} className={cls} scroll={!anchor}>
                {o.label}
              </Link>
            );
          })}
        </div>
      </div>

      {custom && (
        <form action={`/canal${anchor}`} className="flex flex-wrap items-end gap-2 rounded-2xl border border-brand/30 bg-brand/5 p-3">
          {Object.entries(preserve).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input type="hidden" name={param} value="rango" />
          <DateInput name={fromParam} label="Desde" value={range.from} />
          <DateInput name={toParam} label="Hasta" value={range.to} />
          <button className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-bold text-white hover:bg-ink-strong"><Check className="size-3.5" />Aplicar</button>
          {activeKey !== "rango" && (
            <button type="button" onClick={() => setCustom(false)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-ink-muted hover:text-ink"><X className="size-3.5" />Cancelar</button>
          )}
        </form>
      )}
    </div>
  );
}

function DateInput({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">{label}</span>
      <input key={value} type="date" name={name} defaultValue={value} required className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand/60 [color-scheme:light]" />
    </label>
  );
}
