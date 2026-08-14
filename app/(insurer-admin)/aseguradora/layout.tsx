import { InsurerShell } from "@/components/insurer/insurer-shell";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function InsurerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireInsurerAdmin();
  const { data } = await createAdminClient().from("aseguradora").select("nombre_comercial,activo").eq("id", session.insurerId!).maybeSingle();
  return <InsurerShell session={session} insurerName={data?.nombre_comercial || "Aseguradora"}>{children}</InsurerShell>;
}
