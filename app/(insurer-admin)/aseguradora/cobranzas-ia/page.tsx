import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-ui";
import { CobranzasIaDemo } from "@/components/insurer/cobranzas-ia-demo";
import { requireInsurerAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Cobranzas IA · demo | Arkad",
  robots: { index: false, follow: false },
};

export default async function CobranzasIaDemoPage() {
  await requireInsurerAdmin();
  return (
    <AdminPage
      eyebrow="Prototipo · sin conexión a datos"
      title="Cobranzas asistidas por IA"
      description="Demostración interactiva con datos ficticios para evaluar el módulo antes de construirlo. No realiza envíos, cobros ni guarda información."
    >
      <div className="glass-panel mt-6 overflow-hidden rounded-2xl">
        <CobranzasIaDemo />
      </div>
    </AdminPage>
  );
}
