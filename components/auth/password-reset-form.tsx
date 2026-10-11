"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { resetPassword } from "@/app/actions/auth";
import { initialAuthState } from "@/lib/auth/action-state";

export function PasswordResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, initialAuthState);
  const [visible, setVisible] = useState(false);
  return <form action={action} className="mt-7 space-y-4" aria-label="Crear nueva contraseña">
    <input type="hidden" name="token" value={token} />
    {state.message && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{state.message}</p>}
    <PasswordField id="reset-password" name="password" label="Nueva contraseña" placeholder="Mínimo 10 caracteres" visible={visible} error={state.fields?.password?.[0]} toggle={() => setVisible((value) => !value)} />
    <PasswordField id="reset-confirmation" name="passwordConfirmation" label="Confirmar contraseña" placeholder="Repite tu nueva contraseña" visible={visible} error={state.fields?.passwordConfirmation?.[0]} />
    <p className="text-xs leading-5 text-ink-muted">Usa una frase larga y única. Al guardar, todas tus sesiones anteriores se cerrarán por seguridad.</p>
    <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-65">{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? "Guardando…" : "Guardar nueva contraseña"}</button>
  </form>;
}

function PasswordField({ id, name, label, placeholder, visible, error, toggle }: { id: string; name: string; label: string; placeholder: string; visible: boolean; error?: string; toggle?: () => void }) {
  return <div><label htmlFor={id} className="mb-2 block text-sm font-semibold">{label}</label><div className="relative"><LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-muted" /><input id={id} name={name} type={visible ? "text" : "password"} autoComplete="new-password" required minLength={10} maxLength={128} placeholder={placeholder} className={inputClass} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />{toggle && <button type="button" onClick={toggle} className="absolute right-1.5 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:bg-ink/5" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}>{visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}</button>}</div>{error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-600">{error}</p>}</div>;
}

const inputClass = "min-h-12 w-full rounded-xl border border-line bg-surface-muted pl-11 pr-12 text-base text-white outline-none transition-colors placeholder:text-ink-subtle focus:border-ink/25 focus:bg-surface-muted sm:text-sm";
