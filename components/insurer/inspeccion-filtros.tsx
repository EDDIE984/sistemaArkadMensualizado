import Link from "next/link";

const control =
  "min-h-11 min-w-0 rounded-xl border border-white/15 bg-[#061323]/65 px-3.5 text-sm text-white outline-none focus:border-cyan-100/55 [color-scheme:dark]";

const RANGOS: { value: string; label: string }[] = [
  { value: "hoy", label: "Diario" },
  { value: "semana", label: "Semanal" },
  { value: "mes", label: "Mensual" },
];

type Selected = {
  rango: string | null;
  desde: string | null;
  hasta: string | null;
  revision: string | null;
  placa: string | null;
};

export function InspeccionFiltros({ selected }: { selected: Selected }) {
  const dirty =
    Boolean(selected.rango || selected.desde || selected.hasta || selected.revision || selected.placa);

  return (
    <div className="mt-6 grid gap-3">
      <div className="flex flex-wrap gap-2">
        {RANGOS.map((r) => {
          const active = selected.rango === r.value;
          return (
            <Link
              key={r.value}
              href={`/aseguradora/inspecciones?rango=${r.value}`}
              className={`inline-flex min-h-9 items-center rounded-full border px-4 text-xs font-bold ${
                active
                  ? "border-cyan-100/40 bg-cyan-100/12 text-cyan-50"
                  : "border-white/14 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {r.label}
            </Link>
          );
        })}
        <Link
          href="/aseguradora/inspecciones?rango=todo"
          className={`inline-flex min-h-9 items-center rounded-full border px-4 text-xs font-bold ${
            !selected.rango || selected.rango === "todo"
              ? "border-cyan-100/40 bg-cyan-100/12 text-cyan-50"
              : "border-white/14 bg-white/5 text-white/60 hover:bg-white/10"
          }`}
        >
          Todo
        </Link>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Desde</span>
          <input type="date" name="desde" defaultValue={selected.desde ?? ""} className={control} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Hasta</span>
          <input type="date" name="hasta" defaultValue={selected.hasta ?? ""} className={control} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Revisión</span>
          <select name="revision" defaultValue={selected.revision ?? ""} className={control}>
            <option value="">Todas</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="APROBADA">Aprobada</option>
            <option value="RECHAZADA">Rechazada</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Placa</span>
          <input
            name="placa"
            defaultValue={selected.placa ?? ""}
            placeholder="ABC-1234"
            autoCapitalize="characters"
            className={control}
          />
        </label>
        <div className="flex gap-2">
          <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#071426]">
            Aplicar
          </button>
          {dirty && (
            <Link
              href="/aseguradora/inspecciones"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/14 px-5 text-sm font-bold text-white/70"
            >
              Limpiar
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
