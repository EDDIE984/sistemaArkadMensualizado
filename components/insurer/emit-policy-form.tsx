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
        className="min-h-10 min-w-0 rounded-xl border border-white/15 bg-[#061323]/65 px-3.5 text-sm text-white outline-none focus:border-cyan-100/55 sm:w-44"
      />
      <button
        disabled={pending}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-bold text-[#071426] disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
        {pending ? "Emitiendo…" : "Emitir"}
      </button>
      {state.message && (
        <p className={`text-xs ${state.status === "success" ? "text-emerald-200" : "text-red-200"}`}>{state.message}</p>
      )}
    </form>
  );
}
