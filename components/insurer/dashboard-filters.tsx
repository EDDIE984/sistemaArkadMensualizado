import Link from "next/link";

export const MONTHS: [number, string][] = [
  [1, "Enero"], [2, "Febrero"], [3, "Marzo"], [4, "Abril"], [5, "Mayo"], [6, "Junio"],
  [7, "Julio"], [8, "Agosto"], [9, "Septiembre"], [10, "Octubre"], [11, "Noviembre"], [12, "Diciembre"],
];

const control =
  "min-h-11 min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none focus:border-brand/60 [color-scheme:light]";

type Selected = { canal: string | null; desde: number; hasta: number };

export function DashboardFilters({
  canales,
  years,
  selected,
}: {
  canales: { id: string; nombre: string }[];
  years: number[];
  selected: Selected;
}) {
  const dirty = selected.canal !== null || selected.desde !== years[0] || selected.hasta !== years[0];

  return (
    <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="grid gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">Canal</span>
        <select name="canal" defaultValue={selected.canal ?? ""} className={control}>
          <option value="">Todos los canales</option>
          {canales.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">Desde</span>
        <select name="desde" defaultValue={String(selected.desde)} className={control}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">Hasta</span>
        <select name="hasta" defaultValue={String(selected.hasta)} className={control}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white">
          Aplicar
        </button>
        {dirty && (
          <Link
            href="/aseguradora"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-bold text-ink/80"
          >
            Limpiar
          </Link>
        )}
      </div>
    </form>
  );
}
