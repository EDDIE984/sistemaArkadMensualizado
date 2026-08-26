import Link from "next/link";

export const MONTHS: [number, string][] = [
  [1, "Enero"], [2, "Febrero"], [3, "Marzo"], [4, "Abril"], [5, "Mayo"], [6, "Junio"],
  [7, "Julio"], [8, "Agosto"], [9, "Septiembre"], [10, "Octubre"], [11, "Noviembre"], [12, "Diciembre"],
];

const control =
  "min-h-11 min-w-0 rounded-xl border border-white/15 bg-[#061323]/65 px-3.5 text-sm text-white outline-none focus:border-cyan-100/55 [color-scheme:dark]";

type Selected = { canal: string | null; anio: number; mes: number | null };

export function DashboardFilters({
  canales,
  years,
  selected,
}: {
  canales: { id: string; nombre: string }[];
  years: number[];
  selected: Selected;
}) {
  const dirty = selected.canal !== null || selected.mes !== null || selected.anio !== years[0];

  return (
    <form className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="grid gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Canal</span>
        <select name="canal" defaultValue={selected.canal ?? ""} className={control}>
          <option value="">Todos los canales</option>
          {canales.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Año</span>
        <select name="anio" defaultValue={String(selected.anio)} className={control}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Mes</span>
        <select name="mes" defaultValue={selected.mes ? String(selected.mes) : ""} className={control}>
          <option value="">Todo el año</option>
          {MONTHS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#071426]">
          Aplicar
        </button>
        {dirty && (
          <Link
            href="/aseguradora"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/14 px-5 text-sm font-bold text-white/70"
          >
            Limpiar
          </Link>
        )}
      </div>
    </form>
  );
}
