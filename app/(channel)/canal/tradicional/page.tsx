import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-ui";
import { TraditionalCalculator } from "@/components/channel/traditional-calculator";
import { requireChannelUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tradicional | Kuantiq", robots: { index: false, follow: false } };

export default async function Page() {
  await requireChannelUser();
  return (
    <AdminPage
      eyebrow="Herramientas"
      title="Tradicional"
      description="Compara el cálculo de primas tradicional (anual) con el nuevo modelo mensual de cuota fija y nivelación."
    >
      <TraditionalCalculator />
    </AdminPage>
  );
}
