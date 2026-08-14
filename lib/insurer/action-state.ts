export type InsurerActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fields?: Record<string, string[]>;
};

export const initialInsurerState: InsurerActionState = { status: "idle" };
