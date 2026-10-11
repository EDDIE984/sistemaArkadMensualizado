"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { updateClientProfile } from "@/app/actions/profile";
import { initialAuthState } from "@/lib/auth/action-state";
import { useCedulaLookup } from "@/lib/cedula/use-cedula-lookup";

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
  const [gender, setGender] = useState(profile.genero || "");
  const [birthDate, setBirthDate] = useState(profile.fecha_nacimiento || "");
  const [maritalStatus, setMaritalStatus] = useState(profile.estado_civil || "");
  const [address, setAddress] = useState(profile.direccion || "");
  const { status: lookupStatus, run: runLookup } = useCedulaLookup((data) => {
    if (data.genero) setGender(data.genero);
    if (data.fechaNacimiento) setBirthDate(data.fechaNacimiento);
    if (data.estadoCivil) setMaritalStatus(data.estadoCivil);
    if (data.direccion) setAddress(data.direccion);
  });

  return (
    <form action={action} className="glass-panel mt-7 grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
      {state.message && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2" role="alert">{state.message}</p>}
      <Field label="Cédula o RUC" name="identification" error={state.fields?.identification?.[0]}>
        <input id="identification" name="identification" inputMode="numeric" required defaultValue={profile.identificacion || ""} placeholder="10 o 13 dígitos" onChange={(e) => runLookup(e.target.value)} onBlur={(e) => runLookup(e.target.value)} className={inputClass} />
        {lookupStatus === "loading" && (
          <span className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
            <LoaderCircle className="size-3 animate-spin" />Consultando cédula…
          </span>
        )}
        {lookupStatus === "not-found" && (
          <span className="mt-2 block text-xs text-amber-700">No encontramos datos para esta cédula. Ingresa los datos manualmente.</span>
        )}
        {lookupStatus === "error" && (
          <span className="mt-2 block text-xs text-red-600">No pudimos consultar el servicio. Ingresa los datos manualmente.</span>
        )}
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
        <input id="birthDate" name="birthDate" type="date" autoComplete="bday" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Género" name="gender" error={state.fields?.gender?.[0]}>
        <select id="gender" name="gender" required value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
          <option value="" disabled>Selecciona una opción</option><option value="HOMBRE">Hombre</option><option value="MUJER">Mujer</option>
        </select>
      </Field>
      <Field label="Estado civil" name="maritalStatus" error={state.fields?.maritalStatus?.[0]}>
        <select id="maritalStatus" name="maritalStatus" required value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={inputClass}>
          <option value="" disabled>Selecciona una opción</option><option value="SOLTERO">Soltero/a</option><option value="CASADO">Casado/a</option><option value="DIVORCIADO">Divorciado/a</option><option value="VIUDO">Viudo/a</option><option value="UNION_DE_HECHO">Unión de hecho</option>
        </select>
      </Field>
      <div className="sm:col-span-2">
        <label htmlFor="address" className="mb-2 block text-sm font-semibold">Dirección <span className="font-normal text-ink-subtle">(opcional)</span></label>
        <textarea id="address" name="address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Tu dirección" className={`${inputClass} resize-none py-3`} />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-65 sm:w-auto">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{pending ? "Guardando…" : "Guardar perfil"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: React.ReactNode }) {
  return <div><label htmlFor={name} className="mb-2 block text-sm font-semibold">{label}</label>{children}{error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}</div>;
}

const inputClass = "min-h-12 w-full rounded-xl border border-line bg-surface-muted px-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-brand/60 focus:bg-white [color-scheme:light]";
