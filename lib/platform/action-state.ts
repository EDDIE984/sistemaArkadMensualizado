export type PlatformActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fields?: Record<string, string[]>;
};

export const initialPlatformState: PlatformActionState = { status: "idle" };
