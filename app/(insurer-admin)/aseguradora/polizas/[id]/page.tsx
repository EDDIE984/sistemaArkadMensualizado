import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator } from "lucide-react";
import { OrderDetailView } from "@/components/policy/order-detail-view";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/policies/order-detail";

export const metadata: Metadata = { title: "Detalle de la póliza | Kuantix", robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  const session = await requireInsurerAdmin();
  const { id } = await params;
  const { volver = "" } = await searchParams;
  const data = await getOrderDetail(id, { insurerId: session.insurerId! });
  if (!data) notFound();
  // Solo se conserva la consulta de la lista (nunca otra ruta).
  const back = new URLSearchParams(volver).toString();

  return (
    <OrderDetailView
      data={data}
      eyebrow="Póliza emitida"
      backHref={back ? `/aseguradora/polizas?${back}` : "/aseguradora/polizas"}
      backLabel="Volver a pólizas emitidas"
      showDeductibles
      actions={<Link href={`/aseguradora/operacion/${data.order.id}/calculo`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-ink-strong"><Calculator className="size-4" />Ver cálculo</Link>}
    />
  );
}
