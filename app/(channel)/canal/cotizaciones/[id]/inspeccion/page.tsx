import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireChannelUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadInspeccionForCotizacion } from "@/lib/inspeccion/data";
import { InspeccionWorkspace } from "@/components/inspeccion/inspeccion-workspace";

export const metadata: Metadata = { title: "Inspección | Arkad", robots: { index: false, follow: false } };

export default async function InspeccionPage({ params }: PageProps<"/canal/cotizaciones/[id]/inspeccion">) {
  const session = await requireChannelUser();
  const { id } = await params;

  const { data: quote } = await createAdminClient()
    .from("cotizacion")
    .select("id,vehiculo(marca,modelo,anio)")
    .eq("id", id)
    .eq("canal_id", session.channelId!)
    .maybeSingle();
  if (!quote) redirect("/canal/cotizaciones");

  const vehicle = Array.isArray(quote.vehiculo) ? quote.vehiculo[0] : quote.vehiculo;
  const inspeccion = await loadInspeccionForCotizacion(id);

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-7 lg:px-10 lg:py-12">
      <Link
        href={`/canal/cotizaciones/${id}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/60 hover:text-white"
      >
        <ArrowLeft className="size-4" /> Volver a la cotización
      </Link>
      <h1 className="mt-4 text-[32px] font-bold tracking-[-0.035em] sm:text-[40px]">Inspección con IA</h1>
      <p className="mt-2 max-w-2xl text-sm text-white/60">
        Captura las fotos del vehículo siguiendo la guía de cada toma. Puedes repetir o eliminar cualquier foto.
      </p>
      <div className="mt-7">
        <InspeccionWorkspace
          cotizacionId={id}
          actor="CANAL"
          vehiculo={{ marca: vehicle?.marca ?? null, modelo: vehicle?.modelo ?? null, anio: vehicle?.anio ?? null }}
          inspeccion={inspeccion}
        />
      </div>
    </main>
  );
}
