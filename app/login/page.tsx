import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { AuthPanel } from "@/components/auth/auth-panel";
import { LoginBgVideo } from "@/components/auth/login-bg-video";
import { getSession, sessionHome } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Iniciar sesión | Confia",
  description:
    "Accede a Confia para consultar y gestionar tus alternativas de seguro vehicular.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getSession();
  if (session) redirect(sessionHome(session));
  const params = await searchParams;
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0a0a0a] text-white">
      <LoginBgVideo />

      <div
        className="pointer-events-none fixed inset-0 animate-[fadeIn_1.2s_ease-out_both] bg-[linear-gradient(100deg,rgba(6,6,8,0.9)_0%,rgba(6,6,8,0.73)_35%,rgba(6,6,8,0.4)_62%,rgba(6,6,8,0.3)_82%,rgba(6,6,8,0.48)_100%)]"
        aria-hidden="true"
      />

      <SiteNav />

      <section className="relative z-[1] mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[1180px] items-center px-5 py-8 sm:px-8 lg:px-14 lg:py-10">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(390px,0.62fr)] lg:gap-16">
          <div className="hidden max-w-[540px] animate-[fadeUp_0.8s_cubic-bezier(0.16,1,0.3,1)_both] lg:block">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
              TU PROTECCIÓN, EN UN SOLO LUGAR
            </p>
            <p className="mt-3 text-balance text-[48px] font-bold leading-[1.08] tracking-[-0.025em] text-white">
              Vuelve a conducir con confianza.
            </p>
            <p className="mt-4 max-w-[480px] text-pretty text-[15.5px] leading-[1.6] text-white/72">
              Accede a tus cotizaciones, compara alternativas y continúa gestionando la protección de tu vehículo.
            </p>
          </div>

          <AuthPanel activated={params.activated === "1"} passwordReset={params.passwordReset === "1"} />
        </div>
      </section>
    </main>
  );
}
