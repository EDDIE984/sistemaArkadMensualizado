import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { BulkCancellationUpload } from "@/components/channel/bulk-cancellation-upload";
import { requireChannelUser } from "@/lib/auth/session";

// Validar/guardar hasta 100 cancelaciones consulta cada póliza.
export const maxDuration = 300;

export const metadata: Metadata = { title: "Cancelación masiva | Kuantiq", robots: { index: false, follow: false } };

export default async function Page() {
  await requireChannelUser();
  return (
    <AdminPage
      eyebrow="Cancelaciones"
      title="Carga masiva"
      description="Cancela varias pólizas a la vez con la plantilla en Excel. Nada se guarda hasta que confirmes."
      action={
        <Link href="/canal/cancelaciones" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-surface-muted">
          <ArrowLeft className="size-4" />Cancelaciones
        </Link>
      }
    >
      <BulkCancellationUpload />
    </AdminPage>
  );
}
