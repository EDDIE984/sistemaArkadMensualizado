"use client";

import { useActionState } from "react";
import Link from "next/link";
import Script from "next/script";
import { ArrowLeft, LoaderCircle, Mail } from "lucide-react";
import { requestPasswordRecovery } from "@/app/actions/auth";
import { initialAuthState } from "@/lib/auth/action-state";

export function PasswordRecoveryForm() {
  const [state, action, pending] = useActionState(requestPasswordRecovery, initialAuthState);
  return (
    <form action={action} className="mt-7 space-y-4" aria-label="Recuperar contraseña">
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="recovery-website">Sitio web</label>
        <input id="recovery-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {state.message && <p className={`rounded-xl border px-4 py-3 text-sm leading-5 ${state.status === "success" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-50" : "border-red-300/25 bg-red-300/10 text-red-50"}`} role="status">{state.message}</p>}
      <div>
        <label htmlFor="recovery-email" className="mb-2 block text-sm font-semibold text-white">Correo electrónico</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-white/55" aria-hidden="true" />
          <input id="recovery-email" name="email" type="email" autoComplete="email" required placeholder="nombre@correo.com" className={inputClass} aria-invalid={Boolean(state.fields?.email)} aria-describedby={state.fields?.email ? "recovery-email-error" : undefined} />
        </div>
        {state.fields?.email?.[0] && <p id="recovery-email-error" className="mt-1.5 text-xs text-red-200">{state.fields.email[0]}</p>}
      </div>
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" /><div className="cf-turnstile min-h-[65px]" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} data-theme="dark" /></>}
      <button type="submit" disabled={pending || state.status === "success"} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-65">{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? "Enviando…" : state.status === "success" ? "Solicitud enviada" : "Enviar enlace temporal"}</button>
      <Link href="/login" className="flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-white/70 hover:text-white"><ArrowLeft className="size-4" /> Volver al inicio de sesión</Link>
    </form>
  );
}

const inputClass = "min-h-12 w-full rounded-xl border border-white/20 bg-black/20 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/42 focus:border-white/60 focus:bg-black/30";
