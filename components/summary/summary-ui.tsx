import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus, type LucideIcon } from "lucide-react";
import type { ExpiringPolicy } from "@/lib/channel/summary";

export function Kpi({ icon: Icon, label, value, delta: change, hint, href, accent, tone }: {
  icon: LucideIcon; label: string; value: string; delta?: number | null; hint?: string; href?: string; accent?: boolean; tone?: "warn";
}) {
  const body = <>
    <div className="flex items-center justify-between gap-2">
      <span className={`flex size-8 items-center justify-center rounded-lg ${tone === "warn" ? "bg-amber-50 text-amber-700" : "bg-brand/10 text-brand-text"}`}><Icon className="size-4" /></span>
      {change !== undefined && <Delta value={change} />}
    </div>
    <p className="mt-4 truncate text-xl font-bold tracking-[-0.03em] text-ink sm:text-2xl" title={value}>{value}</p>
    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle">{label}</p>
    {hint && <p className="mt-1 truncate text-[11px] text-ink-muted">{hint}</p>}
  </>;
  const className = `glass-panel block min-w-0 p-4 ${accent ? "ring-1 ring-brand/40" : ""} ${href ? "transition-shadow hover:shadow-[0_14px_34px_rgba(23,50,80,0.1)]" : ""}`;
  return href ? <Link href={href} className={className}>{body}</Link> : <article className={className}>{body}</article>;
}

export function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[10px] text-ink-subtle" title="Sin datos en el período anterior">—</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const className = value > 0 ? "text-emerald-700" : value < 0 ? "text-red-600" : "text-ink-subtle";
  return <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${className}`} title="Frente al período anterior de la misma duración"><Icon className="size-3.5" />{Math.abs(value)} %</span>;
}

export function ChartCard({ title, subtitle, wide, children }: { title: string; subtitle: string; wide?: boolean; children: React.ReactNode }) {
  return <article className={`glass-panel p-5 sm:p-6 ${wide ? "lg:col-span-2" : ""}`}>
    <h3 className="text-sm font-bold">{title}</h3>
    <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p>
    <div className="mt-5">{children}</div>
  </article>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-subtle">{label}</dt><dd className="truncate text-sm font-bold text-ink">{value}</dd></div>;
}

export function ExpiringTable({ rows, detailHref, showChannel = false }: { rows: ExpiringPolicy[]; detailHref?: string; showChannel?: boolean }) {
  if (!rows.length) return <p className="mt-4 rounded-xl border border-line bg-surface-muted px-4 py-6 text-center text-sm text-ink-muted">Ningún vehículo vence en esta ventana.</p>;
  const headings = ["Cliente", "Contacto", "Vehículo", "Placa", "Producto", ...(showChannel ? ["Canal"] : []), "Póliza", "Fin de vigencia", "Días"];
  return <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
    <table className="w-full min-w-[820px] text-left text-xs">
      <thead className="bg-surface-muted text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-subtle"><tr>{headings.map((heading) => <th key={heading} className="px-3 py-2.5">{heading}</th>)}{detailHref && <th className="px-3 py-2.5"><span className="sr-only">Detalle</span></th>}</tr></thead>
      <tbody className="divide-y divide-line bg-white">
        {rows.map((row) => <tr key={row.quoteId}>
          <td className="px-3 py-2.5"><p className="font-semibold text-ink">{row.client}</p><p className="text-ink-subtle">{row.identification}</p></td>
          <td className="px-3 py-2.5 text-ink-muted"><p>{row.phone ?? "—"}</p><p className="truncate">{row.email ?? ""}</p></td>
          <td className="px-3 py-2.5 text-ink-muted">{row.brand} {row.model}</td>
          <td className="px-3 py-2.5 font-semibold uppercase tracking-wider">{row.plate ?? "—"}</td>
          <td className="px-3 py-2.5 text-ink-muted">{row.product}</td>
          {showChannel && <td className="px-3 py-2.5 text-ink-muted">{row.channel ?? "—"}</td>}
          <td className="px-3 py-2.5 text-ink-muted">{row.policy}</td>
          <td className="px-3 py-2.5 font-semibold">{day(row.end)}</td>
          <td className="px-3 py-2.5"><DaysPill days={row.days} /></td>
          {detailHref && <td className="px-3 py-2.5 text-right"><Link href={`${detailHref}/${row.quoteId}`} aria-label={`Ver detalle de ${row.client}`} className="inline-flex size-8 items-center justify-center rounded-full border border-line text-ink-subtle hover:bg-brand/10 hover:text-brand-text"><ChevronRight className="size-4" /></Link></td>}
        </tr>)}
      </tbody>
    </table>
  </div>;
}

export function DaysPill({ days }: { days: number }) {
  if (days < 0) return <span className="whitespace-nowrap rounded-full border border-ink/20 bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-ink">Venció hace {-days} {days === -1 ? "día" : "días"}</span>;
  const className = days <= 15 ? "border-red-200 bg-red-50 text-red-700" : days <= 30 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-line bg-surface-muted text-ink-muted";
  return <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${className}`}>{days === 0 ? "Hoy" : `${days} ${days === 1 ? "día" : "días"}`}</span>;
}

export function delta(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function day(value: string) {
  const [year, month, date] = value.slice(0, 10).split("-");
  return `${date}/${month}/${year}`;
}

export function num(value: number) {
  return new Intl.NumberFormat("es-EC").format(value);
}

export function money(value: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value);
}
