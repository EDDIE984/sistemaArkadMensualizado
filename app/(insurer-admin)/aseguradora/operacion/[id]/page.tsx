import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QuoteWizard, type QuoteEditInitial } from "@/components/quotes/quote-wizard";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuoteFormData } from "@/lib/quotes/data";

export const metadata: Metadata = { title: "Recalcular cotización | Arkad", robots: { index: false, follow: false } };

export default async function RecalculateQuote({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireInsurerAdmin();
  const insurerId = session.insurerId!;
  const { id } = await params;
  const db = createAdminClient();

  const { data: quote } = await db
    .from("cotizacion")
    .select("id,estado,origen,canal_id,aseguradora_id,cliente_id,vehiculo_id,producto_id,anios_vigencia,fecha_inicio_vigencia")
    .eq("id", id)
    .eq("aseguradora_id", insurerId)
    .maybeSingle();
  if (!quote || quote.estado !== "PENDIENTE") notFound();

  const { data: policy } = await db.from("poliza").select("id").eq("cotizacion_id", id).maybeSingle();
  if (policy) notFound();

  const [formData, { data: vehicle }, { data: coverages }] = await Promise.all([
    getQuoteFormData(quote.cliente_id, quote.canal_id ? { insurerId: quote.aseguradora_id, channelId: quote.canal_id } : undefined),
    db.from("vehiculo").select("tipo_vehiculo_id,marca,modelo,anio,color,valor_asegurado,estado_vh,uso,placa").eq("id", quote.vehiculo_id).single(),
    db.from("cotizacion_cobertura").select("producto_cobertura_id").eq("cotizacion_id", id),
  ]);
  if (!vehicle) notFound();

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const initial: QuoteEditInitial = {
    origen: quote.origen,
    productId: quote.producto_id,
    vehicle: {
      typeId: vehicle.tipo_vehiculo_id,
      brand: vehicle.marca,
      model: vehicle.modelo,
      year: vehicle.anio ?? new Date().getFullYear(),
      color: vehicle.color ?? "",
      insuredValue: Number(vehicle.valor_asegurado),
      status: vehicle.estado_vh,
      use: vehicle.uso,
      plate: vehicle.placa,
    },
    coverageIds: (coverages ?? []).map((c) => c.producto_cobertura_id),
    durationYears: String(quote.anios_vigencia),
    startDate: quote.fecha_inicio_vigencia ? String(quote.fecha_inicio_vigencia).slice(0, 10) : today,
  };

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-7 lg:px-10">
      <Link href="/aseguradora/operacion" className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-cyan-100">
        <ArrowLeft className="size-4" /> Volver a Operación
      </Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-cyan-100/65">Cotización pendiente</p>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.035em]">Editar y recalcular</h1>
      <p className="mt-2 text-sm text-white/58">
        Ajusta producto, vehículo, coberturas, años y fecha de inicio de vigencia. Al recalcular se re-corre el motor con la
        parametrización vigente del producto (incluida la comisión del canal) y se reemplaza el cronograma. La cotización sigue pendiente.
      </p>
      <QuoteWizard data={formData} mode="edit" quoteId={quote.id} initial={initial} />
    </main>
  );
}
