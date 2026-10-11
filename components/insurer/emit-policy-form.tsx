"use client";

import { useActionState } from "react";
import { FileCheck2, LoaderCircle } from "lucide-react";
import { emitPolicy } from "@/app/actions/insurer";
import { initialInsurerState } from "@/lib/insurer/action-state";

export function EmitPolicyForm({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState(emitPolicy, initialInsurerState);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input
        name="policyNumber"
        required
        minLength={3}
        maxLength={40}
        placeholder="N.º de póliza"
        className="min-h-10 min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none focus:border-brand/60 sm:w-44"
      />
      <button
        disabled={pending}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-ink px-4 text-xs font-bold text-white disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
        {pending ? "Emitiendo…" : "Emitir"}
      </button>
      {state.message && (
        <p className={`text-xs ${state.status === "success" ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
