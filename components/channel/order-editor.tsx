"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, CarFront, LoaderCircle, Mail, Send, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { updateChannelOrder } from "@/app/actions/channel";
import { initialChannelState } from "@/lib/channel/action-state";
import type { QuoteEditInitial } from "@/components/quotes/quote-wizard";
import type { QuoteFormData } from "@/lib/quotes/types";

type ClientInitial = {
  name: string; identification: string; email: string; phone: string; cityId: string | null;
  birthDate: string | null; gender: "HOMBRE" | "MUJER" | null; maritalStatus: string | null; address: string | null;
};

export function OrderEditor({ quoteId, data, initial, client, cities }: {
  quoteId: string; data: QuoteFormData; initial: QuoteEditInitial; client: ClientInitial; cities: { id: string; nombre: string }[];
}) {
  const [state, action, pending] = useActionState(updateChannelOrder, initialChannelState);
  const [productId, setProductId] = useState(initial.productId);
  const [vehicleTypeId, setVehicleTypeId] = useState(initial.vehicle.typeId);
  const [brand, setBrand] = useState(initial.vehicle.brand);
  const [model, setModel] = useState(initial.vehicle.model);
  const [color, setColor] = useState(initial.vehicle.color);
  const [duration, setDuration] = useState(initial.durationYears);
  const product = data.products.find((item) => item.id === productId) ?? data.products[0];
  const brands = useMemo(() => [...new Set(product.models.map((item) => item.brand))].sort(), [product]);
  const models = useMemo(() => product.models.filter((item) => item.brand === brand), [product, brand]);

  function changeProduct(nextId: string) {
    const next = data.products.find((item) => item.id === nextId);
    setProductId(nextId);
    setVehicleTypeId(next?.vehicleTypes[0]?.id ?? "");
    setBrand(next?.models[0]?.brand ?? "");
    setModel(next?.models[0]?.model ?? "");
    setColor(next?.colors[0] ?? "");
  }

  if (!product) return <p className="glass-panel mt-6 p-5 text-sm text-ink-muted">No hay productos vehiculares activos para este canal.</p>;

  return (
    <form action={action} className="mt-7 grid gap-5">
      <input type="hidden" name="quoteId" value={quoteId} />
      {state.message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.message}</p>}

      <section className="glass-panel p-5 sm:p-6">
        <Title icon={UserRound} title="Datos del titular" description="Estos datos influyen en el cálculo y en el destino del certificado." />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nombres completos" error={state.fields?.name?.[0]}><input name="name" required defaultValue={client.name} className={input} /></Field>
          <Field label="Cédula o RUC" error={state.fields?.identification?.[0]}><input name="identification" required inputMode="numeric" defaultValue={client.identification} className={input} /></Field>
          <Field label="Correo" error={state.fields?.email?.[0]}><input name="email" required type="email" defaultValue={client.email} className={input} /></Field>
          <Field label="Teléfono" error={state.fields?.phone?.[0]}><input name="phone" required defaultValue={client.phone} className={input} /></Field>
          <Field label="Ciudad" error={state.fields?.cityId?.[0]}><select name="cityId" required defaultValue={client.cityId ?? ""} className={input}><option value="">Selecciona</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.nombre}</option>)}</select></Field>
          <Field label="Fecha de nacimiento" error={state.fields?.birthDate?.[0]}><input name="birthDate" required type="date" defaultValue={client.birthDate ?? ""} className={input} /></Field>
          <Field label="Género" error={state.fields?.gender?.[0]}><select name="gender" required defaultValue={client.gender ?? ""} className={input}><option value="">Selecciona</option><option value="HOMBRE">Hombre</option><option value="MUJER">Mujer</option></select></Field>
          <Field label="Estado civil" error={state.fields?.maritalStatus?.[0]}><select name="maritalStatus" required defaultValue={client.maritalStatus ?? ""} className={input}><option value="">Selecciona</option><option value="SOLTERO">Soltero/a</option><option value="CASADO">Casado/a</option><option value="DIVORCIADO">Divorciado/a</option><option value="VIUDO">Viudo/a</option><option value="UNION_DE_HECHO">Unión de hecho</option></select></Field>
          <Field label="Dirección"><input name="address" defaultValue={client.address ?? ""} className={input} /></Field>
        </div>
      </section>

      <section className="glass-panel p-5 sm:p-6">
        <Title icon={ShieldCheck} title="Producto y protección" description="Se aplicará la configuración vigente del producto al recalcular." />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {data.products.map((item) => <label key={item.id} className={`cursor-pointer rounded-2xl border p-4 transition-colors ${productId === item.id ? "border-brand/60 bg-brand/10" : "border-line bg-surface-muted hover:border-brand/30"}`}><input className="sr-only" type="radio" name="productId" value={item.id} checked={productId === item.id} onChange={() => changeProduct(item.id)} /><strong className="block text-sm">{item.name}</strong><span className="mt-1 block text-xs text-ink-muted">{item.insurerName}</span></label>)}
        </div>
        <fieldset className="mt-6"><legend className="text-sm font-bold">Coberturas</legend><div className="mt-3 grid gap-3 md:grid-cols-2">{product.coverages.map((coverage) => <label key={`${productId}-${coverage.id}`} className="flex cursor-pointer gap-3 rounded-xl border border-line bg-surface-muted p-4 text-sm"><input name="coverageIds" type="checkbox" value={coverage.id} defaultChecked={productId === initial.productId ? initial.coverageIds.includes(coverage.id) : true} className="mt-0.5 size-4 accent-brand" /><span><strong>{coverage.name}</strong>{coverage.description && <span className="mt-1 block text-xs text-ink-muted">{coverage.description}</span>}</span></label>)}</div>{state.fields?.coverageIds?.[0] && <p className="mt-2 text-xs text-red-600">{state.fields.coverageIds[0]}</p>}</fieldset>
      </section>

      <section className="glass-panel p-5 sm:p-6">
        <Title icon={CarFront} title="Vehículo" description="El vehículo de esta orden se actualiza y el riesgo se calcula nuevamente." />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tipo de vehículo" error={state.fields?.vehicleTypeId?.[0]}><select name="vehicleTypeId" required value={vehicleTypeId} onChange={(event) => setVehicleTypeId(event.target.value)} className={input}><option value="">Selecciona</option>{product.vehicleTypes.map((item) => <option key={item.id} value={item.id}>{item.description}</option>)}</select></Field>
          <Field label="Marca" error={state.fields?.brand?.[0]}><select name="brand" required value={brand} onChange={(event) => { const next = event.target.value; setBrand(next); setModel(product.models.find((item) => item.brand === next)?.model ?? ""); }} className={input}><option value="">Selecciona</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
          <Field label="Modelo" error={state.fields?.model?.[0]}><select name="model" required value={model} onChange={(event) => setModel(event.target.value)} className={input}><option value="">Selecciona</option>{models.map((item) => <option key={`${item.brand}-${item.model}`} value={item.model}>{item.model}</option>)}</select></Field>
          <Field label="Año" error={state.fields?.year?.[0]}><input name="year" required type="number" min="1950" max={new Date().getFullYear() + 1} defaultValue={initial.vehicle.year} className={input} /></Field>
          <Field label="Color" error={state.fields?.color?.[0]}><select name="color" required value={color} onChange={(event) => setColor(event.target.value)} className={input}><option value="">Selecciona</option>{product.colors.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select></Field>
          <Field label="Valor asegurado" error={state.fields?.insuredValue?.[0]}><input name="insuredValue" required type="number" min="1" step="0.01" defaultValue={initial.vehicle.insuredValue} className={input} /></Field>
          <Field label="Estado"><select name="vehicleStatus" defaultValue={initial.vehicle.status} className={input}><option value="NUEVO">Nuevo</option><option value="USADO">Usado</option></select></Field>
          <Field label="Uso"><select name="use" defaultValue={initial.vehicle.use} className={input}><option value="PARTICULAR">Particular</option><option value="COMERCIAL">Comercial</option><option value="CORPORATIVO">Corporativo</option></select></Field>
          <Field label="Placa"><input name="plate" maxLength={15} defaultValue={initial.vehicle.plate ?? ""} className={input} /></Field>
        </div>
      </section>

      <section className="glass-panel p-5 sm:p-6">
        <Title icon={CalendarDays} title="Vigencia y certificado" description="Al guardar se reemplaza el cronograma y se envía el certificado actualizado." />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="Años de vigencia" error={state.fields?.durationYears?.[0]}><select name="durationYears" value={duration} onChange={(event) => setDuration(event.target.value)} className={input}>{[1, 2, 3, 4, 5].map((year) => <option key={year} value={year}>{year} {year === 1 ? "año" : "años"}</option>)}</select></Field>
          <Field label="Inicio de vigencia" error={state.fields?.startDate?.[0]}><input name="startDate" required type="date" defaultValue={initial.startDate} className={input} /></Field>
          <Field label="Enviar certificado actualizado"><select name="deliveryChannel" defaultValue="CORREO" className={input}><option value="CORREO">Correo electrónico</option><option value="WHATSAPP">WhatsApp</option></select></Field>
        </div>
        <p className="mt-4 rounded-xl border border-brand/20 bg-brand/10 px-4 py-3 text-xs leading-5 text-brand-text"><Mail className="mr-1 inline size-4" />El certificado conserva su número y se reemplaza con la información corregida; se registrará el nuevo envío.</p>
      </section>

      <div className="flex justify-end"><button disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{pending ? "Actualizando y enviando…" : "Guardar y generar certificado"}</button></div>
    </form>
  );
}

function Title({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) { return <header className="flex gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-text"><Icon className="size-4" /></span><div><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm text-ink-muted">{description}</p></div></header>; }
function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) { return <label className="block min-w-0"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-subtle">{label}</span>{children}{error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}</label>; }
function title(value: string) { return value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
const input = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand/60 [color-scheme:light]";
