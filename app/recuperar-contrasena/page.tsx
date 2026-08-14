import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export const metadata: Metadata = { title: "Recuperar contraseña | Confia", description: "Solicita un enlace temporal para restablecer tu contraseña.", robots: { index: false, follow: false } };

export default function PasswordRecoveryPage() {
  return <main className="relative min-h-dvh overflow-x-hidden bg-[#0a0a0a] text-white">
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#0a0a0a]"><video src="https://res.cloudinary.com/urml6fcu/video/upload/v1786673694/kling_20260814_Image_to_Video_Animaci_nE_2609_0.mp4" autoPlay loop muted playsInline aria-hidden="true" className="absolute left-1/2 top-1/2 h-full min-h-full w-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover object-center" /></div>
    <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(100deg,rgba(6,6,8,0.9)_0%,rgba(6,6,8,0.73)_40%,rgba(6,6,8,0.4)_72%,rgba(6,6,8,0.48)_100%)]" />
    <SiteNav />
    <section className="relative z-[1] mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[1180px] items-center justify-end px-5 py-8 sm:px-8 lg:px-14">
      <div className="w-full max-w-[440px] rounded-[26px] border border-white/30 bg-black/22 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-md sm:p-7">
        <div className="flex size-14 items-center justify-center rounded-[18px] border border-white/25 bg-white/10"><KeyRound className="size-7" /></div>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">Recuperación segura</p>
        <h1 className="mt-2 text-[32px] font-bold tracking-[-0.035em]">Recupera tu acceso</h1>
        <p className="mt-2 text-sm leading-6 text-white/65">Ingresa el correo de tu cuenta. Si está registrado, te enviaremos un enlace temporal para crear una nueva contraseña.</p>
        <PasswordRecoveryForm />
      </div>
    </section>
  </main>;
}
