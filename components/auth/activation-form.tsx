"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { activateClient } from "@/app/actions/auth";
import { initialAuthState } from "@/lib/auth/action-state";

export function ActivationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(activateClient, initialAuthState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="mt-7 space-y-4" aria-label="Crear contraseña">
      <input type="hidden" name="token" value={token} />
      {state.message && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      )}
      <div>
        <label htmlFor="activation-password" className="mb-2 block text-sm font-semibold">Contraseña</label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            id="activation-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            placeholder="Mínimo 10 caracteres"
            className={inputClass}
          />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1.5 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
            {showPassword ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
          </button>
        </div>
        {state.fields?.password?.[0] && <p className="mt-1.5 text-xs text-red-600">{state.fields.password[0]}</p>}
      </div>
      <div>
        <label htmlFor="activation-confirmation" className="mb-2 block text-sm font-semibold">Confirmar contraseña</label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            id="activation-confirmation"
            name="passwordConfirmation"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            placeholder="Repite tu contraseña"
            className={inputClass}
          />
        </div>
        {state.fields?.passwordConfirmation?.[0] && <p className="mt-1.5 text-xs text-red-600">{state.fields.passwordConfirmation[0]}</p>}
      </div>
      <p className="text-xs leading-5 text-ink-muted">Usa una frase larga y única. No reutilices la contraseña de tu correo.</p>
      <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-65">
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {pending ? "Activando…" : "Activar mi cuenta"}
      </button>
    </form>
  );
}

const inputClass = "min-h-12 w-full rounded-xl border border-line bg-surface-muted pl-11 pr-12 text-base text-white outline-none transition-colors placeholder:text-ink-subtle focus:border-ink/25 focus:bg-surface-muted sm:text-sm";
