export type AuthActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fields?: Record<string, string[]>;
};

export const initialAuthState: AuthActionState = { status: "idle" };
