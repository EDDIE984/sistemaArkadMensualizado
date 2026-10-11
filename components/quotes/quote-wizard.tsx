"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, CarFront, Check, Info, LoaderCircle, ShieldCheck } from "lucide-react";
import { createQuoteAction } from "@/app/actions/quotes";
import { createAssistedQuote } from "@/app/actions/channel";
import { recalculateQuote } from "@/app/actions/insurer";
import { initialQuoteState, type QuoteFormData } from "@/lib/quotes/types";

const steps = ["Producto", "Vehículo", "Protección", "Confirmar"];

export type QuoteEditInitial = {
  origen: "AUTOGESTION" | "CANAL";
  productId: string;
  vehicle: {
    typeId: string;
    brand: string;
    model: string;
    year: number;
    color: string;
    insuredValue: number;
    status: "NUEVO" | "USADO";
    use: "COMERCIAL" | "PARTICULAR" | "CORPORATIVO";
    plate: string | null;
  };
  coverageIds: string[];
  durationYears: string;
  startDate: string;
};

export function QuoteWizard({ data, mode = "self", clientId, quoteId, initial }: { data: QuoteFormData; mode?: "self" | "channel" | "edit"; clientId?: string; quoteId?: string; initial?: QuoteEditInitial }) {
  const isEdit = mode === "edit";
  const action0 = isEdit ? recalculateQuote : mode === "channel" ? createAssistedQuote : createQuoteAction;
  const [state, action, pending] = useActionState(action0, initialQuoteState);
  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState(initial?.productId || data.products[0]?.id || "");
  const [vehicleMode, setVehicleMode] = useState<"new" | "existing">(isEdit || !data.vehicles.length ? "new" : "existing");
  const [existingVehicleId, setExistingVehicleId] = useState(data.vehicles[0]?.id || "");
  const initialProduct = data.products.find((item) => item.id === initial?.productId);
  const [vehicleTypeId, setVehicleTypeId] = useState(initial?.vehicle.typeId || (initialProduct || data.products[0])?.vehicleTypes[0]?.id || "");
  const [brand, setBrand] = useState(initial?.vehicle.brand || (initialProduct || data.products[0])?.models[0]?.brand || "");
  const [model, setModel] = useState(initial?.vehicle.model || (initialProduct || data.products[0])?.models[0]?.model || "");
  const [duration, setDuration] = useState(initial?.durationYears || "4");
  const [startDate, setStartDate] = useState(initial?.startDate || todayInEcuador());
  const vigenciaEditable = mode === "channel" || (isEdit && initial?.origen === "CANAL");
  const showVigenciaField = mode !== "self";

  const product = data.products.find((item) => item.id === productId) || data.products[0];
  const brands = useMemo(() => [...new Set((product?.models || []).map((item) => item.brand))].sort(), [product]);
  const models = useMemo(() => (product?.models || []).filter((item) => item.brand === brand), [product, brand]);
  const vehicle = data.vehicles.find((item) => item.id === existingVehicleId);
  const coverageEndDate = endDate(startDate, Number(duration));
  const coverageDays = inclusiveDays(startDate, coverageEndDate);

  function selectProduct(id: string) {
    const selected = data.products.find((item) => item.id === id);
    setProductId(id);
    setVehicleTypeId(selected?.vehicleTypes[0]?.id || "");
    setBrand(selected?.models[0]?.brand || "");
    setModel(selected?.models[0]?.model || "");
  }

  if (!product) {
    return <div className="glass-panel p-6 text-sm text-ink/80">No hay productos vehiculares disponibles para cotizar.</div>;
  }

  return (
    <form action={action} className="mt-7">
      <input type="hidden" name="vehicleMode" value={vehicleMode} />
      {mode==="channel"&&<input type="hidden" name="clientId" value={clientId}/>}
      {isEdit&&<input type="hidden" name="quoteId" value={quoteId}/>}
      <div className="glass-panel overflow-hidden">
        <div className="border-b border-line px-4 py-5 sm:px-7">
          <ol className="grid grid-cols-4 gap-2" aria-label="Progreso de la cotización">
            {steps.map((label, index) => (
              <li key={label} className="relative">
                <div className={`mb-2 h-1 rounded-full transition-colors ${index <= step ? "bg-brand" : "bg-ink/5"}`} />
                <span className={`text-[10px] font-bold uppercase tracking-[0.12em] sm:text-xs ${index <= step ? "text-ink" : "text-ink-subtle"}`}>
                  <span className="hidden sm:inline">{index + 1}. </span>{label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {state.message && <p className="mx-4 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-7" role="alert">{state.message}</p>}

        <div className="min-h-[440px] p-4 sm:p-7">
          <section aria-labelledby="product-step" className={step === 0 ? "" : "hidden"}>
              <StepHeading icon={<Building2 />} id="product-step" eyebrow="Compara con confianza" title="Elige el producto" description="Solo ves opciones activas disponibles para clientes individuales en tu ciudad." />
              <div className="mt-7 grid gap-3 md:grid-cols-2">
                {data.products.map((item) => (
                  <label key={item.id} className={`cursor-pointer rounded-2xl border p-5 transition-all ${productId === item.id ? "border-brand/60 bg-brand/15" : "border-line bg-surface-muted hover:border-ink/15"}`}>
                    <input type="radio" name="productId" value={item.id} checked={productId === item.id} onChange={() => selectProduct(item.id)} className="sr-only" />
                    <span className="flex items-start justify-between gap-4"><span><strong className="block text-lg">{item.name}</strong><span className="mt-1 block text-sm text-ink-muted">{item.insurerName}</span></span>{productId === item.id && <span className="flex size-7 items-center justify-center rounded-full bg-brand text-ink"><Check className="size-4" /></span>}</span>
                  </label>
                ))}
              </div>
          </section>

          <section aria-labelledby="vehicle-step" className={step === 1 ? "" : "hidden"}>
              <StepHeading icon={<CarFront />} id="vehicle-step" eyebrow="Datos del riesgo" title="Cuéntanos sobre el vehículo" description="Estos datos determinan la tasa; revísalos antes de continuar." />
              {!isEdit && data.vehicles.length > 0 && (
                <div className="mt-6 inline-flex rounded-full border border-line bg-surface-muted p-1">
                  <button type="button" onClick={() => setVehicleMode("existing")} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${vehicleMode === "existing" ? "bg-ink text-white" : "text-ink-muted"}`}>Ya registrado</button>
                  <button type="button" onClick={() => setVehicleMode("new")} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${vehicleMode === "new" ? "bg-ink text-white" : "text-ink-muted"}`}>Vehículo nuevo</button>
                </div>
              )}
              {vehicleMode === "existing" ? (
                <div className="mt-6">
                  <Field label="Selecciona tu vehículo" error={state.fields?.existingVehicleId?.[0]}>
                    <select name="existingVehicleId" value={existingVehicleId} onChange={(event) => setExistingVehicleId(event.target.value)} className={inputClass}>
                      {data.vehicles.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model}{item.plate ? ` · ${item.plate}` : ""} · ${money(item.insuredValue)}</option>)}
                    </select>
                  </Field>
                  {vehicle && <p className="mt-4 rounded-xl border border-line bg-surface-muted p-4 text-sm leading-6 text-ink-muted">{vehicle.status === "NUEVO" ? "Nuevo" : "Usado"} · {vehicle.use.toLowerCase()} · {vehicle.color?.toLowerCase()} · valor asegurado {money(vehicle.insuredValue)}</p>}
                </div>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3 rounded-2xl border border-brand/25 bg-brand/10 p-4 text-sm leading-6 text-brand-text sm:col-span-2">
                    <Info className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                    <p><strong className="text-ink">¿No encuentras la marca o el modelo?</strong> No te preocupes. La lista muestra los vehículos habilitados actualmente para cotización en línea. <Link href="/contacto" className="font-bold text-brand-text underline decoration-brand/35 underline-offset-4 hover:decoration-brand">Contáctanos</Link> y te ayudaremos a revisar tu vehículo.</p>
                  </div>
                  <Field label="Tipo de vehículo" error={state.fields?.vehicleTypeId?.[0]}><select name="vehicleTypeId" value={vehicleTypeId} onChange={(e) => setVehicleTypeId(e.target.value)} className={inputClass}><option value="">Selecciona</option>{product.vehicleTypes.map((item) => <option key={item.id} value={item.id}>{friendlyVehicleType(item.description)}</option>)}</select></Field>
                  <Field label="Marca" error={state.fields?.brand?.[0]}><select name="brand" value={brand} onChange={(e) => { const next = e.target.value; setBrand(next); setModel(product.models.find((item) => item.brand === next)?.model || ""); }} className={inputClass}><option value="">Selecciona</option>{brands.map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="Modelo" error={state.fields?.model?.[0]}><select name="model" value={model} onChange={(e) => setModel(e.target.value)} className={inputClass}><option value="">Selecciona</option>{models.map((item) => <option key={`${item.brand}-${item.model}`} value={item.model}>{item.model}</option>)}</select></Field>
                  <Field label="Año" error={state.fields?.year?.[0]}><input name="year" type="number" min="1950" max={new Date().getFullYear() + 1} defaultValue={initial?.vehicle.year ?? new Date().getFullYear()} className={inputClass} /></Field>
                  <Field label="Color" error={state.fields?.color?.[0]}><select name="color" defaultValue={initial?.vehicle.color ? title(initial.vehicle.color) : "PLATA"} className={inputClass}><option value="">Selecciona</option>{product.colors.map((item) => <option key={item}>{title(item)}</option>)}</select></Field>
                  <Field label="Valor asegurado" error={state.fields?.insuredValue?.[0]}><input name="insuredValue" type="number" min="1" step="0.01" defaultValue={initial?.vehicle.insuredValue ?? "40000"} inputMode="decimal" className={inputClass} /></Field>
                  <Field label="Estado" error={state.fields?.vehicleStatus?.[0]}><select name="vehicleStatus" defaultValue={initial?.vehicle.status ?? "USADO"} className={inputClass}><option value="NUEVO">Nuevo</option><option value="USADO">Usado</option></select></Field>
                  <Field label="Uso" error={state.fields?.use?.[0]}><select name="use" defaultValue={initial?.vehicle.use ?? "PARTICULAR"} className={inputClass}><option value="PARTICULAR">Particular</option><option value="COMERCIAL">Comercial</option><option value="CORPORATIVO">Corporativo</option></select></Field>
                  <Field label="Placa (opcional)"><input name="plate" maxLength={15} autoCapitalize="characters" placeholder="ABC-1234" defaultValue={initial?.vehicle.plate ?? ""} className={inputClass} /></Field>
                </div>
              )}
          </section>

          <section aria-labelledby="coverage-step" className={step === 2 ? "" : "hidden"}>
              <StepHeading icon={<ShieldCheck />} id="coverage-step" eyebrow="Protección" title="Define tu cobertura" description="Selecciona la vigencia y las protecciones que quieres incluir en el cálculo." />
              <div className="mt-7 grid gap-6">
                <div className={mode !== "self" ? "grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,0.8fr)]" : "max-w-sm"}>
                  <Field label="Años de vigencia" error={state.fields?.durationYears?.[0]}><select name="durationYears" value={duration} onChange={(event) => setDuration(event.target.value)} className={inputClass}>{[1,2,3,4,5].map((year) => <option key={year} value={year}>{year} {year === 1 ? "año" : "años"}</option>)}</select></Field>
                  {showVigenciaField && <><Field label="Fecha de inicio de vigencia" error={state.fields?.startDate?.[0]}><input name="startDate" type="date" required={vigenciaEditable} disabled={!vigenciaEditable} min={isEdit ? undefined : todayInEcuador()} max={isEdit ? undefined : maxStartDate()} value={startDate} onChange={event=>setStartDate(event.target.value)} className={`${inputClass} disabled:opacity-50`}/><span className="mt-1.5 block text-xs leading-5 text-ink-subtle">{vigenciaEditable ? (isEdit ? "Ajusta la fecha; el fin de vigencia se recalcula." : "Puedes seleccionar desde hoy hasta 90 días en el futuro.") : "La vigencia de una cotización de autogestión se define al emitir la póliza."}</span></Field>{vigenciaEditable && <div className="rounded-2xl border border-brand/25 bg-brand/10 p-4 md:col-span-2 xl:col-span-1"><p className="flex items-center gap-2 text-xs font-bold text-brand-text"><CalendarDays className="size-4"/>Vigencia calculada</p><dl className="mt-3 grid gap-2 text-xs"><DateSummary label="Finaliza" value={formatDate(coverageEndDate)}/><DateSummary label="Total de días" value={String(coverageDays)}/><DateSummary label="Cuotas" value={String(Number(duration)*12)}/></dl></div>}</>}
                </div>
                <fieldset><legend className="mb-2 text-sm font-semibold">Coberturas</legend><div className="grid gap-3">{product.coverages.map((coverage) => <label key={coverage.id} className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-surface-muted p-4 hover:border-ink/15"><input type="checkbox" name="coverageIds" value={coverage.id} defaultChecked={initial ? initial.coverageIds.includes(coverage.id) : true} className="mt-1 size-4 accent-brand" /><span><strong className="text-sm">{coverage.name}</strong>{coverage.description && <span className="mt-1 block text-xs leading-5 text-ink-muted">{coverage.description}</span>}</span></label>)}</div>{state.fields?.coverageIds?.[0] && <p className="mt-2 text-xs text-red-600">{state.fields.coverageIds[0]}</p>}</fieldset>
              </div>
          </section>

          <section aria-labelledby="confirm-step" className={step === 3 ? "" : "hidden"}>
              <StepHeading icon={<Check />} id="confirm-step" eyebrow="Todo listo" title="Confirma para calcular" description="El cálculo se realizará en el servidor y se guardará completo en una sola transacción." />
              <dl className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-line bg-ink/5 sm:grid-cols-2">
                <Summary label="Producto" value={`${product.name} · ${product.insurerName}`} />
                <Summary label="Vehículo" value={vehicleMode === "existing" && vehicle ? `${vehicle.brand} ${vehicle.model}` : `${brand} ${model}`} />
                <Summary label="Vigencia" value={`${duration} ${duration === "1" ? "año" : "años"}`} />
                <Summary label="Modalidad" value={isEdit?"Recálculo por la aseguradora":mode==="channel"?"Cotización asistida por canal":"Cotización individual en autogestión"} />
                {vigenciaEditable&&<><Summary label="Inicio de vigencia" value={formatDate(startDate)}/><Summary label="Fin de vigencia" value={formatDate(coverageEndDate)}/><Summary label="Días de cobertura" value={String(coverageDays)}/><Summary label="Cuotas completas" value={String(Number(duration)*12)}/></>}
              </dl>
              <p className="mt-5 text-xs leading-5 text-ink-subtle">{isEdit ? "El recálculo re-corre el motor con la parametrización vigente del producto (tasas, depreciación y comisión del canal) y reemplaza el cronograma. La cotización sigue pendiente." : "El valor final depende de tus datos personales, el vehículo y la configuración vigente del producto. Esta cotización no constituye todavía una póliza."}</p>
              {!isEdit && <p className="mt-3 text-xs leading-5 text-ink-subtle">Después de guardar podrás realizar la inspección fotográfica del vehículo desde el detalle de la cotización.</p>}
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-4 sm:px-7">
          <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || pending} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink-muted hover:bg-ink/5 disabled:invisible"><ArrowLeft className="size-4" /> Atrás</button>
          {step < steps.length - 1 ? <button type="button" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white hover:opacity-90">Continuar <ArrowRight className="size-4" /></button> : <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{pending ? (isEdit ? "Recalculando…" : "Calculando…") : (isEdit ? "Recalcular cotización" : "Calcular cotización")}</button>}
        </div>
      </div>
    </form>
  );
}

function StepHeading({ icon, id, eyebrow, title: heading, description }: { icon: React.ReactNode; id: string; eyebrow: string; title: string; description: string }) {
  return <header className="flex gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-brand/25 bg-brand/10 text-brand [&_svg]:size-5">{icon}</span><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-text/80">{eyebrow}</p><h2 id={id} className="mt-1 text-2xl font-bold tracking-[-0.025em] sm:text-3xl">{heading}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{description}</p></div></header>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span>{children}{error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}</label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="bg-white p-4"><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-subtle">{label}</dt><dd className="mt-1 text-sm font-semibold text-ink">{value}</dd></div>; }
function DateSummary({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between gap-3"><dt className="text-ink-subtle">{label}</dt><dd className="font-bold text-ink">{value}</dd></div>}
function money(value: number) { return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value); }
function title(value: string) { return value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
function friendlyVehicleType(value: string) { return value.replace("VH USADOS Y NUEVOS ", "").replace("VH LIVIANOS NUEVOS Y USADOS ", "").replace("VH ", "").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
const inputClass = "min-h-12 w-full rounded-xl border border-line bg-surface-muted px-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-brand/60 [color-scheme:light]";
function todayInEcuador(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Guayaquil",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function maxStartDate(){const d=new Date(`${todayInEcuador()}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+90);return d.toISOString().slice(0,10)}
function endDate(start:string,years:number){if(!start)return"";const d=new Date(`${start}T12:00:00Z`);d.setUTCFullYear(d.getUTCFullYear()+years);d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
function inclusiveDays(start:string,end:string){if(!start||!end)return 0;return Math.round((new Date(`${end}T12:00:00Z`).getTime()-new Date(`${start}T12:00:00Z`).getTime())/86400000)+1}
function formatDate(value:string){if(!value)return"—";return new Intl.DateTimeFormat("es-EC",{dateStyle:"long",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`))}
