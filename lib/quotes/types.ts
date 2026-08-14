export type QuoteProductOption = {
  id: string;
  name: string;
  insurerName: string;
  vehicleTypes: { id: string; description: string }[];
  models: { brand: string; model: string }[];
  colors: string[];
  coverages: { id: string; name: string; description: string | null; value: number | null }[];
};

export type ExistingVehicle = {
  id: string;
  typeId: string | null;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  insuredValue: number;
  status: "NUEVO" | "USADO";
  use: "COMERCIAL" | "PARTICULAR" | "CORPORATIVO";
  plate: string | null;
};

export type QuoteFormData = {
  products: QuoteProductOption[];
  vehicles: ExistingVehicle[];
};

export type QuoteActionState = {
  status: "idle" | "error";
  message?: string;
  fields?: Record<string, string[]>;
};

export const initialQuoteState: QuoteActionState = { status: "idle" };
