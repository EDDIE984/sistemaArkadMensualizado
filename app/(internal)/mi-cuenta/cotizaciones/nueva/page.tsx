import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { QuoteWizard } from "@/components/quotes/quote-wizard";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuoteFormData } from "@/lib/quotes/data";

export const metadata: Metadata = { title: "Nueva cotización | Confia", robots: { index: false, follow: false } };

export default async function NewQuotePage({ searchParams }: PageProps<"/mi-cuenta/cotizaciones/nueva">) {
  const session = await requireSession();
  if (session.actorType !== "CLIENTE") redirect("/mi-cuenta");
  const params = await searchParams;
  const { data: profile } = await createAdminClient().from("cliente")
    .select("identificacion,telefono,ciudad_id,fecha_nacimiento,genero,estado_civil")
    .eq("id", session.actorId).single();
  const complete = Boolean(profile?.identificacion && profile?.telefono && profile?.ciudad_id && profile?.fecha_nacimiento && profile?.genero && profile?.estado_civil);
  if (!complete) redirect("/mi-cuenta/perfil?required=quote");
  const data = await getQuoteFormData(session.actorId);

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-7 lg:px-10 lg:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/70">Cotizador vehicular</p>
      <h1 className="mt-2 text-balance text-[36px] font-bold tracking-[-0.035em] sm:text-[46px]">Tu protección empieza aquí.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">Completa cuatro pasos para conocer tu cuota mensual. Tus datos se evalúan de forma segura y solo para esta cotización.</p>
      {params.profile === "completed" && <p className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-50"><CheckCircle2 className="size-4" /> Perfil completado. Ya puedes realizar tu primera cotización.</p>}
      <QuoteWizard data={data} />
    </main>
  );
}
