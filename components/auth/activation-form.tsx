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
        <p className="rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-50" role="alert">
          {state.message}
        </p>
      )}
      <div>
        <label htmlFor="activation-password" className="mb-2 block text-sm font-semibold">Contraseña</label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-white/55" aria-hidden="true" />
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
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1.5 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
            {showPassword ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
          </button>
        </div>
        {state.fields?.password?.[0] && <p className="mt-1.5 text-xs text-red-200">{state.fields.password[0]}</p>}
      </div>
      <div>
        <label htmlFor="activation-confirmation" className="mb-2 block text-sm font-semibold">Confirmar contraseña</label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-white/55" aria-hidden="true" />
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
        {state.fields?.passwordConfirmation?.[0] && <p className="mt-1.5 text-xs text-red-200">{state.fields.passwordConfirmation[0]}</p>}
      </div>
      <p className="text-xs leading-5 text-white/60">Usa una frase larga y única. No reutilices la contraseña de tu correo.</p>
      <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-65">
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {pending ? "Activando…" : "Activar mi cuenta"}
      </button>
    </form>
  );
}

const inputClass = "min-h-12 w-full rounded-xl border border-white/20 bg-black/20 pl-11 pr-12 text-sm text-white outline-none transition-colors placeholder:text-white/42 focus:border-white/60 focus:bg-black/30";
