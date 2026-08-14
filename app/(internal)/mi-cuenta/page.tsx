import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CarFront, FileText, UserRound } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Mi cuenta | Confia", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const session = await requireSession();
  const { data: client } = session.actorType === "CLIENTE"
    ? await createAdminClient().from("cliente").select("identificacion,telefono,ciudad_id,fecha_nacimiento,genero,estado_civil").eq("id", session.actorId).single()
    : { data: null };
  const profileComplete = Boolean(client?.identificacion && client?.telefono && client?.ciudad_id && client?.fecha_nacimiento && client?.genero && client?.estado_civil);

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-7 lg:px-10 lg:py-12">
      <header className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/70">Panel personal</p>
        <h1 className="mt-2 text-balance text-[36px] font-bold tracking-[-0.03em] sm:text-[44px]">Hola, {session.name.split(" ")[0]}.</h1>
        <p className="mt-3 text-sm leading-6 text-white/65 sm:text-base">Gestiona tu perfil y, próximamente, tus vehículos, cotizaciones y pólizas desde un solo lugar.</p>
      </header>

      {!profileComplete && session.actorType === "CLIENTE" && (
        <section className="glass-panel mt-8 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cyan-200/12 text-cyan-100"><UserRound className="size-5" /></span>
            <div><h2 className="font-bold">Completa tu perfil</h2><p className="mt-1 text-sm leading-5 text-white/65">Necesitaremos tu identificación y datos personales antes de realizar una cotización.</p></div>
          </div>
          <Link href="/mi-cuenta/perfil" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#071426]">Completar ahora <ArrowRight className="size-4" /></Link>
        </section>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Link href={profileComplete ? "/mi-cuenta/cotizaciones/nueva" : "/mi-cuenta/perfil?required=quote"} className="glass-panel group p-6 transition-colors hover:border-cyan-100/35"><CarFront className="size-6 text-cyan-100" /><h2 className="mt-8 text-xl font-bold">Cotizar un vehículo</h2><p className="mt-2 text-sm leading-6 text-white/60">Registra o reutiliza un vehículo y conoce tu cuota mensual.</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-cyan-100">Empezar <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span></Link>
        <Link href="/mi-cuenta/cotizaciones" className="glass-panel group p-6 transition-colors hover:border-cyan-100/35"><FileText className="size-6 text-cyan-100" /><h2 className="mt-8 text-xl font-bold">Mis cotizaciones</h2><p className="mt-2 text-sm leading-6 text-white/60">Consulta el estado y detalle de tus alternativas de seguro.</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-cyan-100">Ver historial <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span></Link>
      </section>
    </main>
  );
}
