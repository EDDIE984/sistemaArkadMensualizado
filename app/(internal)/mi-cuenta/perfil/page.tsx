import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileForm } from "@/components/internal/profile-form";

export const metadata: Metadata = { title: "Mi perfil | Kuantix", robots: { index: false, follow: false } };

export default async function ProfilePage({ searchParams }: PageProps<"/mi-cuenta/perfil">) {
  const session = await requireSession();
  const params = await searchParams;
  if (session.actorType !== "CLIENTE") return <main className="p-8">Este perfil se administra desde el panel interno.</main>;
  const supabase = createAdminClient();
  const [{ data: profile }, { data: cities }] = await Promise.all([
    supabase.from("cliente").select("identificacion,telefono,ciudad_id,fecha_nacimiento,genero,estado_civil,direccion").eq("id", session.actorId).single(),
    supabase.from("ciudad").select("id,nombre,provincia").order("nombre"),
  ]);

  return (
    <main className="relative z-10 mx-auto w-full max-w-[980px] px-4 py-8 sm:px-7 lg:px-10 lg:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-text/80">Configuración</p>
      <h1 className="mt-2 text-[36px] font-bold tracking-[-0.03em] sm:text-[44px]">Mi perfil</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">Completa estos datos una sola vez. Se utilizarán para evaluar el riesgo y preparar tus futuras cotizaciones.</p>
      {params.required === "quote" && <p className="mt-6 rounded-xl border border-brand/25 bg-brand/10 px-4 py-3 text-sm text-brand-text">Antes de cotizar necesitamos completar tu identificación y los datos que utiliza el motor de riesgo. Al guardar, te llevaremos directamente al cotizador.</p>}
      {params.updated === "1" && <p className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="size-4" /> Perfil actualizado correctamente.</p>}
      {profile && <ProfileForm cities={cities || []} profile={profile} />}
    </main>
  );
}
