"use client";

import { useActionState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { updateClientProfile } from "@/app/actions/profile";
import { initialAuthState } from "@/lib/auth/action-state";

type City = { id: string; nombre: string; provincia: string | null };
type ClientProfile = {
  identificacion: string | null;
  telefono: string | null;
  ciudad_id: string | null;
  fecha_nacimiento: string | null;
  genero: string | null;
  estado_civil: string | null;
  direccion: string | null;
};

export function ProfileForm({ cities, profile }: { cities: City[]; profile: ClientProfile }) {
  const [state, action, pending] = useActionState(updateClientProfile, initialAuthState);
  return (
    <form action={action} className="glass-panel mt-7 grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
      {state.message && <p className="rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-50 sm:col-span-2" role="alert">{state.message}</p>}
      <Field label="Cédula o RUC" name="identification" error={state.fields?.identification?.[0]}>
        <input id="identification" name="identification" inputMode="numeric" required defaultValue={profile.identificacion || ""} placeholder="10 o 13 dígitos" className={inputClass} />
      </Field>
      <Field label="Teléfono" name="phone" error={state.fields?.phone?.[0]}>
        <input id="phone" name="phone" type="tel" autoComplete="tel" required defaultValue={profile.telefono || ""} placeholder="+593 99 000 0000" className={inputClass} />
      </Field>
      <Field label="Ciudad" name="cityId" error={state.fields?.cityId?.[0]}>
        <select id="cityId" name="cityId" required defaultValue={profile.ciudad_id || ""} className={inputClass}>
          <option value="" disabled>Selecciona una ciudad</option>
          {cities.map((city) => <option key={city.id} value={city.id}>{city.nombre}{city.provincia ? ` · ${city.provincia}` : ""}</option>)}
        </select>
      </Field>
      <Field label="Fecha de nacimiento" name="birthDate" error={state.fields?.birthDate?.[0]}>
        <input id="birthDate" name="birthDate" type="date" autoComplete="bday" required defaultValue={profile.fecha_nacimiento || ""} className={inputClass} />
      </Field>
      <Field label="Género" name="gender" error={state.fields?.gender?.[0]}>
        <select id="gender" name="gender" required defaultValue={profile.genero || ""} className={inputClass}>
          <option value="" disabled>Selecciona una opción</option><option value="HOMBRE">Hombre</option><option value="MUJER">Mujer</option>
        </select>
      </Field>
      <Field label="Estado civil" name="maritalStatus" error={state.fields?.maritalStatus?.[0]}>
        <select id="maritalStatus" name="maritalStatus" required defaultValue={profile.estado_civil || ""} className={inputClass}>
          <option value="" disabled>Selecciona una opción</option><option value="SOLTERO">Soltero/a</option><option value="CASADO">Casado/a</option><option value="DIVORCIADO">Divorciado/a</option><option value="VIUDO">Viudo/a</option><option value="UNION_DE_HECHO">Unión de hecho</option>
        </select>
      </Field>
      <div className="sm:col-span-2">
        <label htmlFor="address" className="mb-2 block text-sm font-semibold">Dirección <span className="font-normal text-white/50">(opcional)</span></label>
        <textarea id="address" name="address" rows={3} defaultValue={profile.direccion || ""} placeholder="Tu dirección" className={`${inputClass} resize-none py-3`} />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#071426] hover:opacity-90 disabled:cursor-wait disabled:opacity-65 sm:w-auto">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{pending ? "Guardando…" : "Guardar perfil"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: React.ReactNode }) {
  return <div><label htmlFor={name} className="mb-2 block text-sm font-semibold">{label}</label>{children}{error && <p className="mt-1.5 text-xs text-red-200">{error}</p>}</div>;
}

const inputClass = "min-h-12 w-full rounded-xl border border-white/18 bg-[#061323]/55 px-4 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-cyan-100/60 focus:bg-[#061323]/75 [color-scheme:dark]";
