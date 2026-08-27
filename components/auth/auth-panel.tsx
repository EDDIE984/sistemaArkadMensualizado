"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { login, registerClient } from "@/app/actions/auth";
import { initialAuthState } from "@/lib/auth/action-state";

export function AuthPanel({ activated = false, passwordReset = false }: { activated?: boolean; passwordReset?: boolean }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginState, loginAction, loginPending] = useActionState(login, initialAuthState);
  const [registerState, registerAction, registerPending] = useActionState(registerClient, initialAuthState);
  const state = mode === "login" ? loginState : registerState;
  const pending = mode === "login" ? loginPending : registerPending;

  return (
    <div className="w-full max-w-[440px] justify-self-center rounded-[26px] border border-white/30 bg-black/22 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-md animate-[fadeUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.14s_both] sm:p-7 lg:justify-self-end">
      <div className="flex size-14 items-center justify-center rounded-[18px] border border-white/25 bg-white/10 text-white">
        <ShieldCheck className="size-7" strokeWidth={1.8} aria-hidden="true" />
      </div>

      <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">
        {mode === "login" ? "Acceso seguro" : "Crea tu cuenta"}
      </p>
      <h1 className="mt-2 text-[32px] font-bold tracking-[-0.035em]">
        {mode === "login" ? "Bienvenido" : "Comencemos"}
      </h1>
      <p className="mt-1.5 text-sm text-white/65">
        {mode === "login" ? "Inicia sesión para continuar" : "Te enviaremos un enlace para crear tu contraseña"}
      </p>

      {(activated || passwordReset || state.message) && (
        <div
          className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-5 ${
            activated || passwordReset || state.status === "success"
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-50"
              : "border-red-300/25 bg-red-300/10 text-red-50"
          }`}
          role="status"
        >
          {activated ? "Tu cuenta fue activada. Ya puedes iniciar sesión." : passwordReset ? "Tu contraseña fue actualizada. Inicia sesión nuevamente." : state.message}
        </div>
      )}

      {mode === "login" ? (
        <form action={loginAction} className="mt-7 space-y-4" aria-label="Formulario de inicio de sesión">
          <FieldError errors={loginState.fields?.email}>
            <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-white">Correo electrónico</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-white/55" aria-hidden="true" />
              <input id="login-email" name="email" type="email" autoComplete="email" required placeholder="nombre@correo.com" className={inputClass} />
            </div>
          </FieldError>

          <FieldError errors={loginState.fields?.password}>
            <label htmlFor="login-password" className="mb-2 block text-sm font-semibold text-white">Contraseña</label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-white/55" aria-hidden="true" />
              <input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Ingresa tu contraseña" className={`${inputClass} pr-12`} />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1.5 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                {showPassword ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
              </button>
            </div>
          </FieldError>

          <div className="flex min-h-11 items-center justify-between gap-4 text-xs sm:text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-white/65">
              <input type="checkbox" name="remember" className="size-4 accent-white" /> Recordarme
            </label>
            <Link href="/recuperar-contrasena" className="font-semibold text-white hover:underline">¿Olvidaste tu contraseña?</Link>
          </div>

          <SubmitButton pending={pending}>Iniciar sesión</SubmitButton>
          <p className="pt-2 text-center text-sm text-white/65">
            ¿No tienes una cuenta?{" "}
            <button type="button" onClick={() => setMode("register")} className="font-semibold text-white hover:underline">Regístrate</button>
          </p>
        </form>
      ) : (
        <form action={registerAction} className="mt-7 space-y-4" aria-label="Formulario de registro">
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <label htmlFor="register-website">Sitio web</label>
            <input id="register-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <FieldError errors={registerState.fields?.name}>
            <label htmlFor="register-name" className="mb-2 block text-sm font-semibold text-white">Nombres completos</label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-white/55" aria-hidden="true" />
              <input id="register-name" name="name" type="text" autoComplete="name" required minLength={2} maxLength={120} placeholder="Tus nombres y apellidos" className={inputClass} />
            </div>
          </FieldError>
          <FieldError errors={registerState.fields?.email}>
            <label htmlFor="register-email" className="mb-2 block text-sm font-semibold text-white">Correo electrónico</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-white/55" aria-hidden="true" />
              <input id="register-email" name="email" type="email" autoComplete="email" required placeholder="nombre@correo.com" className={inputClass} />
            </div>
          </FieldError>
          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <>
              <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
              <div className="cf-turnstile min-h-[65px]" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} data-theme="dark" />
            </>
          )}
          <SubmitButton pending={pending}>Enviar enlace de activación</SubmitButton>
          <p className="pt-2 text-center text-sm text-white/65">
            ¿Ya tienes una cuenta?{" "}
            <button type="button" onClick={() => setMode("login")} className="font-semibold text-white hover:underline">Inicia sesión</button>
          </p>
        </form>
      )}
    </div>
  );
}

// Safari en iOS amplía la página cuando un campo enfocable mide menos de 16 px.
// Mantenemos 16 px en móvil y recuperamos la escala compacta desde `sm`.
const inputClass = "min-h-12 w-full rounded-xl border border-white/20 bg-black/20 pl-11 pr-4 text-base text-white outline-none transition-colors placeholder:text-white/42 focus:border-white/60 focus:bg-black/30 sm:text-sm";

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition-[transform,opacity] hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:translate-y-0 disabled:cursor-wait disabled:opacity-65">
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? "Procesando…" : children}
    </button>
  );
}

function FieldError({ children, errors }: { children: React.ReactNode; errors?: string[] }) {
  return (
    <div>
      {children}
      {errors?.[0] && <p className="mt-1.5 text-xs text-red-200">{errors[0]}</p>}
    </div>
  );
}
