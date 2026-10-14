/*
 * Cálculo demo "Tradicional vs nuevo modelo mensual", réplica de
 * archivos/alculo modelo MENSUAL_tradicional.xlsx. Funciones puras, sin
 * redondeos intermedios (igual que el Excel); se formatea solo al mostrar.
 */

export type TraditionalInputs = {
  insured: string;
  vehicle: string;
  years: number; // 1–4
  insuredValue: number;
  depreciation: number[]; // por año, fracción (0.15 = 15%)
  rate: number[]; // tasa por año, fracción
  superRate: number; // Super de Bancos
  farmerRate: number; // Seguro Campesino
  vatRate: number; // IVA
  issueFee: number; // derechos de emisión por año
};

export const MAX_YEARS = 4;

export const SAMPLE_INPUTS: TraditionalInputs = {
  insured: "HORNA GONZALES JEYDY ESTHER",
  vehicle: "GREAT WALL",
  years: 4,
  insuredValue: 25290,
  depreciation: [0.15, 0.1, 0.1, 0.1],
  rate: [0.03, 0.03, 0.03, 0.03],
  superRate: 0.035,
  farmerRate: 0.005,
  vatRate: 0.12,
  issueFee: 6,
};

export type YearRow = {
  year: number;
  insuredValue: number;
  depreciation: number;
  rate: number;
  netPremium: number;
  superFee: number;
  farmerFee: number;
  issueFee: number;
  subtotal: number;
  vat: number;
  total: number;
  monthly: number;
};

export type MonthRow = {
  month: number;
  year: number;
  insuredValue: number;
  netPremium: number;
  superFee: number;
  farmerFee: number;
  issueFee: number;
  subtotal: number;
  vat: number;
  total: number; // costo real del mes
  fixedInstallment: number;
  difference: number;
  leveling: number; // nivelación acumulada
};

export type TraditionalResult = {
  annualValues: number[];
  traditional: { years: YearRow[]; total: number; months: number; averageInstallment: number };
  newModel: { years: YearRow[]; months: MonthRow[]; total: number; fixedInstallment: number };
  savings: number;
};

const n = (v: number) => (Number.isFinite(v) ? v : 0);

export function calculateTraditional(input: TraditionalInputs): TraditionalResult {
  const years = Math.min(MAX_YEARS, Math.max(1, Math.trunc(n(input.years)) || 1));
  const dep = (i: number) => n(input.depreciation[i]);
  const rate = (i: number) => n(input.rate[i]);

  // Valor asegurado al inicio de cada año: VA(n+1) = VA(n) − VA(n)·dep(n).
  const annualValues: number[] = [];
  for (let i = 0; i < years; i++) annualValues.push(i === 0 ? n(input.insuredValue) : annualValues[i - 1] - annualValues[i - 1] * dep(i - 1));

  const charges = (netPremium: number, issueFee: number) => {
    const superFee = netPremium * n(input.superRate);
    const farmerFee = netPremium * n(input.farmerRate);
    const subtotal = netPremium + superFee + farmerFee + issueFee;
    const vat = subtotal * n(input.vatRate);
    return { superFee, farmerFee, issueFee, subtotal, vat, total: subtotal + vat };
  };

  // Tradicional: prima anual sobre el valor asegurado del año.
  const traditionalYears: YearRow[] = annualValues.map((value, i) => {
    const netPremium = value * rate(i);
    const c = charges(netPremium, n(input.issueFee));
    return { year: i + 1, insuredValue: value, depreciation: dep(i), rate: rate(i), netPremium, ...c, monthly: c.total / 12 };
  });
  const traditionalTotal = traditionalYears.reduce((s, y) => s + y.total, 0);

  // Nuevo modelo: prima mensual sobre un valor asegurado que se deprecia mes a mes.
  const monthlyFee = n(input.issueFee) / 12;
  const raw = annualValues.flatMap((value, i) => {
    const monthlyDepreciation = (value * dep(i)) / 12;
    return Array.from({ length: 12 }, (_, m) => {
      const insuredValue = value - monthlyDepreciation * m;
      const netPremium = insuredValue * (rate(i) / 12);
      return { month: i * 12 + m + 1, year: i + 1, insuredValue, netPremium, ...charges(netPremium, monthlyFee) };
    });
  });
  const newTotal = raw.reduce((s, r) => s + r.total, 0);
  const fixedInstallment = newTotal / raw.length;
  let leveling = 0;
  const months: MonthRow[] = raw.map((r) => {
    const difference = fixedInstallment - r.total;
    leveling += difference;
    return { ...r, fixedInstallment, difference, leveling };
  });

  const newYears: YearRow[] = annualValues.map((value, i) => {
    const rows = months.filter((m) => m.year === i + 1);
    const sum = (k: "netPremium" | "superFee" | "farmerFee" | "issueFee" | "subtotal" | "vat" | "total") => rows.reduce((s, r) => s + r[k], 0);
    const total = sum("total");
    return {
      year: i + 1, insuredValue: value, depreciation: dep(i), rate: rate(i),
      netPremium: sum("netPremium"), superFee: sum("superFee"), farmerFee: sum("farmerFee"), issueFee: sum("issueFee"),
      subtotal: sum("subtotal"), vat: sum("vat"), total, monthly: total / 12,
    };
  });

  return {
    annualValues,
    traditional: { years: traditionalYears, total: traditionalTotal, months: years * 12, averageInstallment: traditionalTotal / (years * 12) },
    newModel: { years: newYears, months, total: newTotal, fixedInstallment },
    savings: traditionalTotal - newTotal,
  };
}
