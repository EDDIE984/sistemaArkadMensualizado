/** Estado de una Orden de Emisión: número de póliza si ya se emitió (y si está cancelada); si no, su estado. */
export function StatusPill({ status, policy, policyStatus }: { status: string; policy: string | null; policyStatus?: string | null }) {
  if (policy && policyStatus === "CANCELADA") return <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">Póliza {policy} · Cancelada</span>;
  if (policy) return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Póliza {policy}</span>;
  const map: Record<string, [string, string]> = {
    PENDIENTE: ["Pendiente de emisión", "border-amber-200 bg-amber-50 text-amber-700"],
    ACEPTADA: ["Aceptada", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    RECHAZADA: ["Rechazada", "border-red-200 bg-red-50 text-red-700"],
    EXPIRADA: ["Expirada", "border-line bg-surface-muted text-ink-muted"],
  };
  const [label, cls] = map[status] ?? [status, "border-line bg-surface-muted text-ink-muted"];
  return <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{label}</span>;
}
