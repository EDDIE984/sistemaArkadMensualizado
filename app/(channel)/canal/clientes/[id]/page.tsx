import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { ResendCertificateButton } from "@/components/channel/resend-certificate-button";
import { OrderDetailView } from "@/components/policy/order-detail-view";
import { requireChannelUser } from "@/lib/auth/session";
import { normalizeEcuadorPhone } from "@/lib/certificates/send";
import { getOrderDetail } from "@/lib/policies/order-detail";

export const metadata: Metadata = { title: "Detalle de la Orden de Emisión | Kuantix", robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const s = await requireChannelUser();
  const { id } = await params;
  const { q = "" } = await searchParams;
  const data = await getOrderDetail(id, { channelId: s.channelId! });
  if (!data) notFound();
  const o = data.order;

  return (
    <OrderDetailView
      data={data}
      eyebrow="Orden de Emisión"
      backHref={q ? `/canal/clientes?q=${encodeURIComponent(q)}` : "/canal/clientes"}
      backLabel="Volver a la búsqueda"
      actions={o.cert_numero && <>
        <a href={`/canal/cotizaciones/${o.id}/certificado`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-ink-strong"><Eye className="size-4" />Ver certificado</a>
        <ResendCertificateButton variant="button" quoteId={o.id} client={o.cliente} certificateNumber={o.cert_numero} email={o.email} phone={o.telefono ? normalizeEcuadorPhone(o.telefono) : null} />
      </>}
    />
  );
}
