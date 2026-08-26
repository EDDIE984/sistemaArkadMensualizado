"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { saveAssistedClient } from "@/app/actions/channel";
import { initialChannelState } from "@/lib/channel/action-state";
import { useCedulaLookup } from "@/lib/cedula/use-cedula-lookup";

const input = "min-h-12 min-w-0 w-full rounded-xl border border-white/15 bg-[#061323]/65 px-4 text-sm text-white outline-none focus:border-cyan-100/55 [color-scheme:dark]";

export function AssistedClientForm({ cities }: { cities: { id: string; nombre: string }[] }) {
  const [state, action, pending] = useActionState(saveAssistedClient, initialChannelState);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("HOMBRE");
  const [birthDate, setBirthDate] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("SOLTERO");
  const [address, setAddress] = useState("");
  const { status: lookupStatus, run: runLookup } = useCedulaLookup((data) => {
    if (data.nombre) setName(data.nombre);
    if (data.genero) setGender(data.genero);
    if (data.fechaNacimiento) setBirthDate(data.fechaNacimiento);
    if (data.estadoCivil) setMaritalStatus(data.estadoCivil);
    if (data.direccion) setAddress(data.direccion);
  });

  return (
    <form action={action} className="grid min-w-0 gap-4">
      {state.message && (
        <p className={`rounded-xl border px-4 py-3 text-sm ${state.status === "success" ? "border-emerald-300/25 bg-emerald-300/10" : "border-red-300/25 bg-red-300/10"}`}>
          {state.message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombres completos">
          <input name="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </Field>
        <Field label="Cédula o RUC">
          <input name="identification" required inputMode="numeric" onChange={(e) => runLookup(e.target.value)} onBlur={(e) => runLookup(e.target.value)} className={input} />
          {lookupStatus === "loading" && (
            <span className="mt-2 flex items-center gap-1.5 text-xs text-white/60">
              <LoaderCircle className="size-3 animate-spin" />Consultando cédula…
            </span>
          )}
          {lookupStatus === "not-found" && (
            <span className="mt-2 block text-xs text-amber-200">No encontramos datos para esta cédula. Ingresa los datos manualmente.</span>
          )}
          {lookupStatus === "error" && (
            <span className="mt-2 block text-xs text-red-200">No pudimos consultar el servicio. Ingresa los datos manualmente.</span>
          )}
        </Field>
        <Field label="Correo">
          <input name="email" type="email" required autoComplete="email" className={input} />
        </Field>
        <Field label="Teléfono">
          <input name="phone" required autoComplete="tel" className={input} />
        </Field>
        <Field label="Ciudad">
          <select name="cityId" required className={input}>
            <option value="">Selecciona</option>
            {cities.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </Field>
        <Field label="Fecha de nacimiento">
          <input name="birthDate" type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={input} />
        </Field>
        <Field label="Género">
          <select name="gender" value={gender} onChange={(e) => setGender(e.target.value)} className={input}>
            <option value="HOMBRE">Hombre</option>
            <option value="MUJER">Mujer</option>
          </select>
        </Field>
        <Field label="Estado civil">
          <select name="maritalStatus" value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={input}>
            <option value="SOLTERO">Soltero/a</option>
            <option value="CASADO">Casado/a</option>
            <option value="DIVORCIADO">Divorciado/a</option>
            <option value="VIUDO">Viudo/a</option>
            <option value="UNION_DE_HECHO">Unión de hecho</option>
          </select>
        </Field>
        <Field label="Dirección (opcional)">
          <input name="address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {state.clientId && (
          <Link href={`/canal/cotizaciones/nueva?cliente=${state.clientId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-200 px-5 text-sm font-bold text-[#071426]">
            <ShieldCheck className="size-4" />Cotizar para este cliente
          </Link>
        )}
        <button disabled={pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#071426] disabled:opacity-60">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {pending ? "Guardando…" : "Registrar cliente"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/48">{label}</span>
      {children}
    </label>
  );
}
