import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireInsurerAdmin } from "@/lib/auth/session";
import {
  InspeccionAccessError,
  InspeccionNotFoundError,
  loadInspeccionRevisionForInsurer,
} from "@/lib/inspeccion/data";
import { InspeccionRevision } from "@/components/insurer/inspeccion-revision";

export const metadata: Metadata = { title: "Revisión de inspección | Arkad", robots: { index: false, follow: false } };

export default async function InspeccionRevisionPage({ params }: PageProps<"/aseguradora/inspecciones/[id]">) {
  const session = await requireInsurerAdmin();
  const { id } = await params;

  let view;
  try {
    view = await loadInspeccionRevisionForInsurer(session, id);
  } catch (error) {
    if (error instanceof InspeccionAccessError || error instanceof InspeccionNotFoundError) notFound();
    throw error;
  }

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-7 lg:px-10">
      <Link
        href="/aseguradora/inspecciones"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-cyan-100"
      >
        <ArrowLeft className="size-4" /> Volver a Inspecciones
      </Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-cyan-100/65">Revisión de inspección</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
        {view.vehiculo.placa || "Sin placa"} · {view.vehiculo.marca} {view.vehiculo.modelo}
      </h1>
      <p className="mt-2 text-sm text-white/55">
        {view.cliente.nombre} · Completada {view.completadaEn ? new Date(view.completadaEn).toLocaleDateString("es-EC") : "—"}
      </p>

      <div className="mt-6">
        <InspeccionRevision view={view} />
      </div>
    </main>
  );
}
