"use client";

import { useState } from "react";

/*
 * Gráficos del Resumen del canal. Una sola serie por gráfico, en el teal de
 * texto (#00897B, contraste ≥ 3:1 sobre blanco). Marcas finas (≤ 24 px, extremo
 * redondeado de 4 px), grilla tenue, etiquetas selectivas y tooltip al pasar el
 * mouse o enfocar con teclado (cada valor también está en la tabla/descarga).
 */

type Point = { label: string; sublabel?: string; value: number };
type Format = "number" | "currency";


function fmt(v: number, format: Format, compact = false) {
  if (format === "currency") {
    return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", notation: compact && v >= 1000 ? "compact" : "standard", maximumFractionDigits: compact && v >= 1000 ? 1 : 2 }).format(v);
  }
  return new Intl.NumberFormat("es-EC", { notation: compact && v >= 1000 ? "compact" : "standard" }).format(v);
}

/** Escala "redonda" para los ejes: 3 divisiones con valores limpios (enteros para conteos). */
function niceMax(max: number, integer = false) {
  if (max <= 0) return integer ? 3 : 1;
  // Conteos: cada una de las 3 divisiones es un entero (7 → 9, 10 → 12).
  if (integer) return Math.max(1, Math.ceil(max / 3)) * 3;
  const step = Math.pow(10, Math.floor(Math.log10(max / 3)));
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => s * 3 >= max) ?? step * 10;
  return unit * 3;
}

function Empty({ text }: { text: string }) {
  return <p className="grid h-28 place-items-center rounded-xl border border-dashed border-line text-sm text-ink-subtle">{text}</p>;
}

function Tooltip({ title, value }: { title: string; value: string }) {
  return (
    <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-center text-white shadow-lg">
      <span className="block text-[13px] font-bold leading-4">{value}</span>
      <span className="block text-[10px] leading-4 text-white/70">{title}</span>
    </span>
  );
}

/** Columnas verticales (vehículos por mes, vencimientos por mes). */
export function ColumnChart({ data, format = "number", empty, ariaLabel }: { data: Point[]; format?: Format; empty: string; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(0, ...data.map((d) => d.value));
  if (!peak) return <Empty text={empty} />;
  const max = niceMax(peak, format === "number");
  const ticks = [max, (max * 2) / 3, max / 3, 0];
  return (
    <div role="img" aria-label={ariaLabel} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
      <div className="flex h-48 flex-col justify-between pb-0 text-right text-[10px] text-ink-subtle">
        {ticks.map((t) => <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:-translate-y-full">{fmt(t, format, true)}</span>)}
      </div>
      <div className="relative h-48">
        {ticks.map((t) => <div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: `${100 - (t / max) * 100}%` }} />)}
        <div className="absolute inset-0 flex items-end">
          {data.map((d, i) => {
            const h = (d.value / max) * 100;
            const isPeak = d.value === peak;
            return (
              <button
                key={d.label}
                type="button"
                className="group relative flex h-full flex-1 items-end justify-center outline-none"
                onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                aria-label={`${d.label}: ${fmt(d.value, format)}`}
              >
                {active === i && <Tooltip title={d.sublabel ?? d.label} value={fmt(d.value, format)} />}
                {isPeak && active !== i && <span className="absolute text-[10px] font-bold text-ink" style={{ bottom: `calc(${h}% + 4px)` }}>{fmt(d.value, format, true)}</span>}
                <span
                  className={`w-[min(24px,60%)] rounded-t-[4px] transition-opacity ${d.value ? "bg-brand-text" : ""} ${active !== null && active !== i ? "opacity-45" : ""} group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-brand`}
                  style={{ height: `${h}%`, minHeight: d.value ? 3 : 0 }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <span />
      <div className="mt-2 flex">
        {data.map((d, i) => (
          <span key={d.label} className={`flex-1 truncate text-center text-[10px] ${active === i ? "font-bold text-ink" : "text-ink-subtle"} ${data.length > 8 && i % 2 ? "max-sm:invisible" : ""}`}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Área con línea (comisión por mes), crosshair y tooltip. */
export function AreaChart({ data, format = "currency", empty, ariaLabel }: { data: Point[]; format?: Format; empty: string; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(0, ...data.map((d) => d.value));
  if (!peak) return <Empty text={empty} />;
  const max = niceMax(peak);
  const n = data.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const y = (v: number) => 100 - (v / max) * 100;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = `M${x(0)},100 ${data.map((d, i) => `L${x(i)},${y(d.value)}`).join(" ")} L${x(n - 1)},100 Z`;
  const ticks = [max, (max * 2) / 3, max / 3, 0];
  const pick = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setActive(Math.max(0, Math.min(n - 1, Math.round(((clientX - r.left) / r.width) * (n - 1)))));
  };
  return (
    <div role="img" aria-label={ariaLabel} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
      <div className="flex h-48 flex-col justify-between text-right text-[10px] text-ink-subtle">
        {ticks.map((t) => <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:-translate-y-full">{fmt(t, format, true)}</span>)}
      </div>
      <div
        className="relative h-48 touch-none"
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={() => setActive(null)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
          if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
        }}
        onBlur={() => setActive(null)}
      >
        {ticks.map((t) => <div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: `${y(t)}%` }} />)}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
          <path d={area} fill="#00897b" fillOpacity={0.1} />
          <path d={line} fill="none" stroke="#00897b" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {data.map((d, i) => (d.value === peak || i === active) && (
          <span key={d.label} className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-text" style={{ left: `${x(i)}%`, top: `${y(d.value)}%` }} />
        ))}
        {active !== null && (
          <>
            <div className="pointer-events-none absolute inset-y-0 border-l border-ink/25" style={{ left: `${x(active)}%` }} />
            <div className="absolute" style={{ left: `${x(active)}%`, top: `${y(data[active].value)}%` }}>
              <Tooltip title={data[active].sublabel ?? data[active].label} value={fmt(data[active].value, format)} />
            </div>
          </>
        )}
      </div>
      <span />
      <div className="relative mt-2 h-4">
        {data.map((d, i) => (
          <span key={d.label} className={`absolute -translate-x-1/2 whitespace-nowrap text-[10px] ${active === i ? "font-bold text-ink" : "text-ink-subtle"} ${n > 8 && i % 2 ? "max-sm:hidden" : ""}`} style={{ left: `${x(i)}%` }}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontales con el valor en la punta (participación por producto, marcas). */
export function BarList({ data, format = "number", showShare = false, empty }: { data: Point[]; format?: Format; showShare?: boolean; empty: string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const total = data.reduce((t, d) => t + d.value, 0);
  if (!max) return <Empty text={empty} />;
  return (
    <ul className="grid gap-3.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
          <span className="min-w-0"><span className="block truncate text-xs font-semibold text-ink-muted" title={d.label}>{d.label}</span>{d.sublabel && <span className="block truncate text-[11px] text-ink-subtle" title={d.sublabel}>{d.sublabel}</span>}</span>
          <span className="flex min-w-0 items-center gap-2">
            {d.value > 0 && <span className="h-3 rounded-r-[4px] bg-brand-text" style={{ width: `${Math.max(1, (d.value / max) * 78)}%` }} />}
            <span className="shrink-0 text-xs font-bold text-ink">
              {fmt(d.value, format)}{showShare && total ? <span className="ml-1 font-normal text-ink-subtle">· {Math.round((d.value / total) * 100)} %</span> : null}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
