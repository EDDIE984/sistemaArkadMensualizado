"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, Calculator, Info, RotateCcw } from "lucide-react";
import { calculateTraditional, MAX_YEARS, SAMPLE_INPUTS, type TraditionalInputs, type YearRow } from "@/lib/channel/traditional-calc";

const card = "glass-panel p-5 sm:p-6";
const input = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand/60";
const label = "text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle";
const th = "px-3 py-2.5";
const td = "px-3 py-2.5 text-right tabular-nums";

/** Calculadora demo: todo vive en el navegador, no se consulta ni guarda nada. */
export function TraditionalCalculator() {
  const [form, setForm] = useState<TraditionalInputs>(SAMPLE_INPUTS);
  const result = useMemo(() => calculateTraditional(form), [form]);
  const set = <K extends keyof TraditionalInputs>(key: K, value: TraditionalInputs[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setYearValue = (key: "depreciation" | "rate", i: number, value: number) =>
    setForm((f) => ({ ...f, [key]: f[key].map((v, j) => (j === i ? value : v)) }));
  const years = result.annualValues.length;

  return (
    <div className="mt-7 grid gap-4">
      <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Info className="mt-0.5 size-4 shrink-0" />Página demo: modifica los valores y los cálculos se actualizan al instante. Nada se guarda.
      </p>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Calculator className="size-4 text-brand-text" />Datos del cálculo</h2>
          <button type="button" onClick={() => setForm(SAMPLE_INPUTS)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-xs font-bold text-ink/80 hover:bg-surface-muted">
            <RotateCcw className="size-3.5" />Restablecer valores de ejemplo
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nombre del asegurado"><input value={form.insured} onChange={(e) => set("insured", e.target.value)} className={input} /></Field>
          <Field label="Vehículo"><input value={form.vehicle} onChange={(e) => set("vehicle", e.target.value)} className={input} /></Field>
          <Field label="Años de vigencia">
            <select value={form.years} onChange={(e) => set("years", Number(e.target.value))} className={input}>
              {Array.from({ length: MAX_YEARS }, (_, i) => <option key={i} value={i + 1}>{i + 1} {i === 0 ? "año" : "años"}</option>)}
            </select>
          </Field>
          <Field label="Valor asegurado (USD)"><NumberInput value={form.insuredValue} onChange={(v) => set("insuredValue", v)} step={100} /></Field>
          <Field label="Super de Bancos (%)"><PercentInput value={form.superRate} onChange={(v) => set("superRate", v)} /></Field>
          <Field label="Seguro Campesino (%)"><PercentInput value={form.farmerRate} onChange={(v) => set("farmerRate", v)} /></Field>
          <Field label="IVA (%)"><PercentInput value={form.vatRate} onChange={(v) => set("vatRate", v)} /></Field>
          <Field label="Derechos de emisión anual (USD)"><NumberInput value={form.issueFee} onChange={(v) => set("issueFee", v)} step={0.5} /></Field>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="bg-surface-muted text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-subtle">
              <tr><th className={th}>Año</th><th className={th}>Depreciación (%)</th><th className={th}>Tasa (%)</th><th className={`${th} text-right`}>Valor asegurado</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.annualValues.map((value, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-semibold">{ordinal(i + 1)} año</td>
                  <td className="px-3 py-2"><PercentInput value={form.depreciation[i]} onChange={(v) => setYearValue("depreciation", i, v)} compact /></td>
                  <td className="px-3 py-2"><PercentInput value={form.rate[i]} onChange={(v) => setYearValue("rate", i, v)} compact /></td>
                  <td className={`${td} font-semibold text-ink`}>{money(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-ink-subtle">La depreciación de cada año reduce el valor asegurado del año siguiente y, en el nuevo modelo, se descuenta mes a mes dentro del año.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat title="Tradicional" value={money(result.traditional.total)} note={`Cuota fija promedio ${money(result.traditional.averageInstallment)} · ${result.traditional.months} meses`} />
        <Stat title="Nuevo modelo" value={money(result.newModel.total)} note={`Cuota fija ${money(result.newModel.fixedInstallment)} · ${result.traditional.months} meses`} highlight />
        <Stat title="Ahorro para el cliente" value={money(result.savings)} note={`${pct(result.traditional.total ? result.savings / result.traditional.total : 0)} menos que el tradicional`} icon />
      </section>

      <YearTable title="Cálculo de primas de seguros (tradicional)" rows={result.traditional.years} years={years} total={result.traditional.total} installment={result.traditional.averageInstallment} form={form} />
      <YearTable title="Cálculo de primas de seguros (nuevo modelo)" rows={result.newModel.years} years={years} total={result.newModel.total} installment={result.newModel.fixedInstallment} form={form} monthlyFee />

      <section className={card}>
        <h2 className="text-sm font-bold">Detalle mensual del nuevo modelo</h2>
        <p className="mt-1 text-xs text-ink-muted">{form.insured || "Asegurado"} · {form.vehicle || "Vehículo"} · cuota fija {money(result.newModel.fixedInstallment)}</p>
        <div className="mt-4 max-h-[640px] overflow-auto rounded-2xl border border-line">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="sticky top-0 bg-surface-muted text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-subtle">
              <tr>
                <th className={th}>Mes</th>
                {["Valor asegurado", "Prima neta mes", "Super de Bancos", "Seguro Campesino", "Derechos emisión", "Subtotal", "IVA", "Prima total (costo real)", "Cuota fija", "Diferencia", "Nivelación acumulada"].map((h) => <th key={h} className={`${th} text-right`}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.newModel.months.map((m) => (
                <tr key={m.month} className={m.month % 12 === 1 && m.month > 1 ? "border-t-2 border-t-line" : ""}>
                  <td className="px-3 py-2.5 font-semibold">{m.month}</td>
                  <td className={td}>{money(m.insuredValue)}</td>
                  <td className={td}>{money(m.netPremium)}</td>
                  <td className={td}>{money(m.superFee)}</td>
                  <td className={td}>{money(m.farmerFee)}</td>
                  <td className={td}>{money(m.issueFee)}</td>
                  <td className={td}>{money(m.subtotal)}</td>
                  <td className={td}>{money(m.vat)}</td>
                  <td className={`${td} font-semibold text-ink`}>{money(m.total)}</td>
                  <td className={`${td} font-semibold text-brand-text`}>{money(m.fixedInstallment)}</td>
                  <td className={`${td} ${m.difference < 0 ? "text-red-700" : "text-emerald-700"}`}>{money(m.difference)}</td>
                  <td className={`${td} ${m.leveling < -0.005 ? "text-red-700" : "text-ink"}`}>{money(m.leveling)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t border-line bg-surface-muted font-bold">
              <tr>
                <td className="px-3 py-3 text-[10px] uppercase tracking-[0.12em] text-ink-subtle">Total</td>
                <td colSpan={7} />
                <td className={`${td} text-ink`}>{money(result.newModel.total)}</td>
                <td className={`${td} text-brand-text`}>{money(result.newModel.fixedInstallment * result.newModel.months.length)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function YearTable({ title, rows, years, total, installment, form, monthlyFee }: {
  title: string; rows: YearRow[]; years: number; total: number; installment: number; form: TraditionalInputs; monthlyFee?: boolean;
}) {
  const lines: [string, (r: YearRow) => string, string?][] = [
    ["Valor asegurado", (r) => money(r.insuredValue)],
    ["Depreciación", (r) => (r.year === 1 ? "—" : pct(form.depreciation[r.year - 2] ?? 0))],
    ["Tasa", (r) => pct(r.rate)],
    ["Prima neta", (r) => money(r.netPremium), "font-semibold text-ink"],
    [`Super de Bancos (${pct(form.superRate)})`, (r) => money(r.superFee)],
    [`Seguro Campesino (${pct(form.farmerRate)})`, (r) => money(r.farmerFee)],
    [monthlyFee ? "Derechos de emisión (mensual × 12)" : "Derechos de emisión", (r) => money(r.issueFee)],
    ["Subtotal", (r) => money(r.subtotal), "font-semibold text-ink"],
    [`IVA (${pct(form.vatRate)})`, (r) => money(r.vat)],
    ["Prima total", (r) => money(r.total), "font-bold text-ink"],
    ["Prima mensual (÷ 12)", (r) => money(r.monthly), "text-brand-text font-semibold"],
  ];
  return (
    <section className={card}>
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-surface-muted text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-subtle">
            <tr><th className={th}>Concepto</th>{rows.map((r) => <th key={r.year} className={`${th} text-right`}>{ordinal(r.year)} año</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map(([name, value, cls]) => (
              <tr key={name}>
                <td className="px-3 py-2.5 font-semibold text-ink-muted">{name}</td>
                {rows.map((r) => <td key={r.year} className={`${td} ${cls ?? ""}`}>{value(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <Summary label={`Valor del seguro por ${years} ${years === 1 ? "año" : "años"}`} value={money(total)} />
        <Summary label="Plazo de crédito" value={`${years * 12} meses`} />
        <Summary label="Cuota fija promedio" value={money(installment)} strong />
      </dl>
    </section>
  );
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5"><span className={label}>{text}</span>{children}</label>;
}

function NumberInput({ value, onChange, step }: { value: number; onChange: (v: number) => void; step?: number }) {
  return <input type="number" inputMode="decimal" min={0} step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className={input} />;
}

/** Se escribe en porcentaje (15) y se guarda como fracción (0.15). */
function PercentInput({ value, onChange, compact }: { value: number; onChange: (v: number) => void; compact?: boolean }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step={0.1}
      value={Number.isFinite(value) ? Number((value * 100).toFixed(6)) : ""}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value) / 100)}
      className={compact ? `${input} max-w-32 min-h-10` : input}
    />
  );
}

function Stat({ title, value, note, highlight, icon }: { title: string; value: string; note: string; highlight?: boolean; icon?: boolean }) {
  return (
    <div className={`rounded-2xl border px-5 py-4 ${highlight ? "border-brand/30 bg-brand/10" : icon ? "border-emerald-200 bg-emerald-50" : "glass-panel"}`}>
      <p className={`flex items-center gap-1.5 ${label}`}>{icon && <ArrowDownRight className="size-3.5 text-emerald-700" />}{title}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${icon ? "text-emerald-700" : highlight ? "text-brand-text" : "text-ink"}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-subtle">{note}</p>
    </div>
  );
}

function Summary({ label: text, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
      <dt className={label}>{text}</dt>
      <dd className={`mt-1 text-base font-bold tabular-nums ${strong ? "text-brand-text" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

function ordinal(n: number) {
  return ["1er", "2do", "3er", "4to"][n - 1] ?? `${n}°`;
}
function money(v: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Math.abs(v) < 0.005 ? 0 : v);
}
function pct(v: number) {
  return new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 2 }).format(v);
}
