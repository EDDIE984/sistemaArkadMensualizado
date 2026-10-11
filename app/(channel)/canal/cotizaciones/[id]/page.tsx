import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, PencilLine, ScanLine } from "lucide-react";
import { OrderEditor } from "@/components/channel/order-editor";
import type { QuoteEditInitial } from "@/components/quotes/quote-wizard";
import { requireChannelUser } from "@/lib/auth/session";
import { getQuoteFormData } from "@/lib/quotes/data";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Editar Orden de Emisión | Kuantix", robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ actualizada?: string }> }) {
  const session = await requireChannelUser();
  const { id } = await params;
  const { actualizada } = await searchParams;
  const db = createAdminClient();
  const { data: quote } = await db
    .from("cotizacion")
    .select("id,estado,origen,cliente_id,producto_id,anios_vigencia,fecha_inicio_vigencia,cliente(nombre_razon_social,identificacion,email,telefono,ciudad_id,direccion,fecha_nacimiento,genero,estado_civil),vehiculo(tipo_vehiculo_id,marca,modelo,anio,color,valor_asegurado,estado_vh,uso,placa),certificado_cobertura(numero)")
    .eq("id", id)
    .eq("canal_id", session.channelId!)
    .eq("origen", "CANAL")
    .eq("estado", "PENDIENTE")
    .maybeSingle();
  if (!quote) notFound();

  const client = one(quote.cliente);
  const vehicle = one(quote.vehiculo);
  if (!client || !vehicle) notFound();
  const [{ data: coverages }, { data: cities }, formData] = await Promise.all([
    db.from("cotizacion_cobertura").select("producto_cobertura_id").eq("cotizacion_id", id),
    db.from("ciudad").select("id,nombre").order("nombre"),
    getQuoteFormData(quote.cliente_id, { insurerId: session.insurerId!, channelId: session.channelId! }),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const initial: QuoteEditInitial = {
    origen: "CANAL",
    productId: quote.producto_id,
    vehicle: {
      typeId: vehicle.tipo_vehiculo_id ?? "", brand: vehicle.marca, model: vehicle.modelo, year: vehicle.anio ?? new Date().getFullYear(),
      color: vehicle.color ?? "", insuredValue: Number(vehicle.valor_asegurado), status: vehicle.estado_vh, use: vehicle.uso, plate: vehicle.placa,
    },
    coverageIds: (coverages ?? []).map((coverage) => coverage.producto_cobertura_id),
    durationYears: String(quote.anios_vigencia),
    startDate: quote.fecha_inicio_vigencia ? String(quote.fecha_inicio_vigencia).slice(0, 10) : today,
  };
  const certificate = one(quote.certificado_cobertura);

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-7 lg:px-10">
      <Link href="/canal/cotizaciones" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-muted"><ArrowLeft className="size-4" />Órdenes de Emisión</Link>
      {actualizada === "1" && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">La Orden de Emisión fue actualizada y el certificado corregido se envió al cliente.</p>}
      <header className="mt-5 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-brand-text/80"><PencilLine className="size-3.5" />Orden de Emisión pendiente</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.035em]">Editar orden</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Corrige todos los datos antes de la emisión. Al guardar recalculamos la cuota y generamos el certificado actualizado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/canal/cotizaciones/${id}/inspeccion`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-5 text-sm font-bold text-brand-text hover:bg-brand/15"><ScanLine className="size-4" />Inspección</Link>
          {certificate && <a href={`/canal/cotizaciones/${id}/certificado`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold hover:bg-surface-muted"><FileDown className="size-4" />Ver certificado {certificate.numero}</a>}
        </div>
      </header>
      <OrderEditor quoteId={id} data={formData} initial={initial} client={{ name: client.nombre_razon_social, identification: client.identificacion ?? "", email: client.email, phone: client.telefono ?? "", cityId: client.ciudad_id, birthDate: client.fecha_nacimiento, gender: client.genero, maritalStatus: client.estado_civil, address: client.direccion }} cities={cities ?? []} />
    </main>
  );
}

function one<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] ?? null : value; }
