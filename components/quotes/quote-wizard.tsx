"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, CarFront, Check, Info, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { createQuoteAction } from "@/app/actions/quotes";
import { createAssistedQuote } from "@/app/actions/channel";
import { initialQuoteState, type QuoteFormData } from "@/lib/quotes/types";

const steps = ["Producto", "Vehículo", "Protección", "Confirmar"];

export function QuoteWizard({ data, mode="self", clientId }: { data: QuoteFormData; mode?:"self"|"channel"; clientId?:string }) {
  const [state, action, pending] = useActionState(mode==="channel"?createAssistedQuote:createQuoteAction, initialQuoteState);
  const [step, setStep] = useState(0);
  const [aiInspectionDone, setAiInspectionDone] = useState(false);
  const [productId, setProductId] = useState(data.products[0]?.id || "");
  const [vehicleMode, setVehicleMode] = useState<"new" | "existing">(data.vehicles.length ? "existing" : "new");
  const [existingVehicleId, setExistingVehicleId] = useState(data.vehicles[0]?.id || "");
  const [vehicleTypeId, setVehicleTypeId] = useState(data.products[0]?.vehicleTypes[0]?.id || "");
  const [brand, setBrand] = useState(data.products[0]?.models[0]?.brand || "");
  const [model, setModel] = useState(data.products[0]?.models[0]?.model || "");
  const [duration, setDuration] = useState("4");
  const [startDate, setStartDate] = useState(todayInEcuador());

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
    return <div className="glass-panel p-6 text-sm text-white/70">No hay productos vehiculares disponibles para cotizar.</div>;
  }

  return (
    <form action={action} className="mt-7">
      <input type="hidden" name="vehicleMode" value={vehicleMode} />
      {mode==="channel"&&<input type="hidden" name="clientId" value={clientId}/>} 
      <div className="glass-panel overflow-hidden">
        <div className="border-b border-white/10 px-4 py-5 sm:px-7">
          <ol className="grid grid-cols-4 gap-2" aria-label="Progreso de la cotización">
            {steps.map((label, index) => (
              <li key={label} className="relative">
                <div className={`mb-2 h-1 rounded-full transition-colors ${index <= step ? "bg-cyan-200" : "bg-white/12"}`} />
                <span className={`text-[10px] font-bold uppercase tracking-[0.12em] sm:text-xs ${index <= step ? "text-white" : "text-white/38"}`}>
                  <span className="hidden sm:inline">{index + 1}. </span>{label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {state.message && <p className="mx-4 mt-5 rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-50 sm:mx-7" role="alert">{state.message}</p>}

        <div className="min-h-[440px] p-4 sm:p-7">
          <section aria-labelledby="product-step" className={step === 0 ? "" : "hidden"}>
              <StepHeading icon={<Building2 />} id="product-step" eyebrow="Compara con confianza" title="Elige el producto" description="Solo ves opciones activas disponibles para clientes individuales en tu ciudad." />
              <div className="mt-7 grid gap-3 md:grid-cols-2">
                {data.products.map((item) => (
                  <label key={item.id} className={`cursor-pointer rounded-2xl border p-5 transition-all ${productId === item.id ? "border-cyan-200/70 bg-cyan-100/12" : "border-white/12 bg-[#061323]/35 hover:border-white/30"}`}>
                    <input type="radio" name="productId" value={item.id} checked={productId === item.id} onChange={() => selectProduct(item.id)} className="sr-only" />
                    <span className="flex items-start justify-between gap-4"><span><strong className="block text-lg">{item.name}</strong><span className="mt-1 block text-sm text-white/55">{item.insurerName}</span></span>{productId === item.id && <span className="flex size-7 items-center justify-center rounded-full bg-cyan-200 text-[#071426]"><Check className="size-4" /></span>}</span>
                  </label>
                ))}
              </div>
          </section>

          <section aria-labelledby="vehicle-step" className={step === 1 ? "" : "hidden"}>
              <StepHeading icon={<CarFront />} id="vehicle-step" eyebrow="Datos del riesgo" title="Cuéntanos sobre el vehículo" description="Estos datos determinan la tasa; revísalos antes de continuar." />
              {data.vehicles.length > 0 && (
                <div className="mt-6 inline-flex rounded-full border border-white/12 bg-[#061323]/45 p-1">
                  <button type="button" onClick={() => setVehicleMode("existing")} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${vehicleMode === "existing" ? "bg-white text-[#071426]" : "text-white/65"}`}>Ya registrado</button>
                  <button type="button" onClick={() => setVehicleMode("new")} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${vehicleMode === "new" ? "bg-white text-[#071426]" : "text-white/65"}`}>Vehículo nuevo</button>
                </div>
              )}
              {vehicleMode === "existing" ? (
                <div className="mt-6">
                  <Field label="Selecciona tu vehículo" error={state.fields?.existingVehicleId?.[0]}>
                    <select name="existingVehicleId" value={existingVehicleId} onChange={(event) => setExistingVehicleId(event.target.value)} className={inputClass}>
                      {data.vehicles.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model}{item.plate ? ` · ${item.plate}` : ""} · ${money(item.insuredValue)}</option>)}
                    </select>
                  </Field>
                  {vehicle && <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/65">{vehicle.status === "NUEVO" ? "Nuevo" : "Usado"} · {vehicle.use.toLowerCase()} · {vehicle.color?.toLowerCase()} · valor asegurado {money(vehicle.insuredValue)}</p>}
                </div>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3 rounded-2xl border border-cyan-100/20 bg-cyan-100/8 p-4 text-sm leading-6 text-cyan-50/85 sm:col-span-2">
                    <Info className="mt-0.5 size-5 shrink-0 text-cyan-100" aria-hidden="true" />
                    <p><strong className="text-white">¿No encuentras la marca o el modelo?</strong> No te preocupes. La lista muestra los vehículos habilitados actualmente para cotización en línea. <Link href="/contacto" className="font-bold text-cyan-100 underline decoration-cyan-100/35 underline-offset-4 hover:decoration-cyan-100">Contáctanos</Link> y te ayudaremos a revisar tu vehículo.</p>
                  </div>
                  <Field label="Tipo de vehículo" error={state.fields?.vehicleTypeId?.[0]}><select name="vehicleTypeId" value={vehicleTypeId} onChange={(e) => setVehicleTypeId(e.target.value)} className={inputClass}><option value="">Selecciona</option>{product.vehicleTypes.map((item) => <option key={item.id} value={item.id}>{friendlyVehicleType(item.description)}</option>)}</select></Field>
                  <Field label="Marca" error={state.fields?.brand?.[0]}><select name="brand" value={brand} onChange={(e) => { const next = e.target.value; setBrand(next); setModel(product.models.find((item) => item.brand === next)?.model || ""); }} className={inputClass}><option value="">Selecciona</option>{brands.map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="Modelo" error={state.fields?.model?.[0]}><select name="model" value={model} onChange={(e) => setModel(e.target.value)} className={inputClass}><option value="">Selecciona</option>{models.map((item) => <option key={`${item.brand}-${item.model}`} value={item.model}>{item.model}</option>)}</select></Field>
                  <Field label="Año" error={state.fields?.year?.[0]}><input name="year" type="number" min="1950" max={new Date().getFullYear() + 1} defaultValue={new Date().getFullYear()} className={inputClass} /></Field>
                  <Field label="Color" error={state.fields?.color?.[0]}><select name="color" defaultValue="PLATA" className={inputClass}><option value="">Selecciona</option>{product.colors.map((item) => <option key={item}>{title(item)}</option>)}</select></Field>
                  <Field label="Valor asegurado" error={state.fields?.insuredValue?.[0]}><input name="insuredValue" type="number" min="1" step="0.01" defaultValue="40000" inputMode="decimal" className={inputClass} /></Field>
                  <Field label="Estado" error={state.fields?.vehicleStatus?.[0]}><select name="vehicleStatus" defaultValue="USADO" className={inputClass}><option value="NUEVO">Nuevo</option><option value="USADO">Usado</option></select></Field>
                  <Field label="Uso" error={state.fields?.use?.[0]}><select name="use" defaultValue="PARTICULAR" className={inputClass}><option value="PARTICULAR">Particular</option><option value="COMERCIAL">Comercial</option><option value="CORPORATIVO">Corporativo</option></select></Field>
                  <Field label="Placa (opcional)"><input name="plate" maxLength={15} autoCapitalize="characters" placeholder="ABC-1234" className={inputClass} /></Field>
                </div>
              )}
          </section>

          <section aria-labelledby="coverage-step" className={step === 2 ? "" : "hidden"}>
              <StepHeading icon={<ShieldCheck />} id="coverage-step" eyebrow="Protección" title="Define tu cobertura" description="Selecciona la vigencia y las protecciones que quieres incluir en el cálculo." />
              <div className="mt-7 grid gap-6">
                <div className={mode === "channel" ? "grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,0.8fr)]" : "max-w-sm"}>
                  <Field label="Años de vigencia" error={state.fields?.durationYears?.[0]}><select name="durationYears" value={duration} onChange={(event) => setDuration(event.target.value)} className={inputClass}>{[1,2,3,4,5].map((year) => <option key={year} value={year}>{year} {year === 1 ? "año" : "años"}</option>)}</select></Field>
                  {mode==="channel"&&<><Field label="Fecha de inicio de vigencia" error={state.fields?.startDate?.[0]}><input name="startDate" type="date" required min={todayInEcuador()} max={maxStartDate()} value={startDate} onChange={event=>setStartDate(event.target.value)} className={inputClass}/><span className="mt-1.5 block text-xs leading-5 text-white/45">Puedes seleccionar desde hoy hasta 90 días en el futuro.</span></Field><div className="rounded-2xl border border-cyan-100/15 bg-cyan-100/7 p-4 md:col-span-2 xl:col-span-1"><p className="flex items-center gap-2 text-xs font-bold text-cyan-50"><CalendarDays className="size-4"/>Vigencia calculada</p><dl className="mt-3 grid gap-2 text-xs"><DateSummary label="Finaliza" value={formatDate(coverageEndDate)}/><DateSummary label="Total de días" value={String(coverageDays)}/><DateSummary label="Cuotas" value={String(Number(duration)*12)}/></dl></div></>}
                </div>
                <fieldset><legend className="mb-2 text-sm font-semibold">Coberturas</legend><div className="grid gap-3">{product.coverages.map((coverage) => <label key={coverage.id} className="flex cursor-pointer gap-3 rounded-2xl border border-white/12 bg-[#061323]/35 p-4 hover:border-white/30"><input type="checkbox" name="coverageIds" value={coverage.id} defaultChecked className="mt-1 size-4 accent-cyan-200" /><span><strong className="text-sm">{coverage.name}</strong>{coverage.description && <span className="mt-1 block text-xs leading-5 text-white/55">{coverage.description}</span>}</span></label>)}</div>{state.fields?.coverageIds?.[0] && <p className="mt-2 text-xs text-red-200">{state.fields.coverageIds[0]}</p>}</fieldset>
              </div>
          </section>

          <section aria-labelledby="confirm-step" className={step === 3 ? "" : "hidden"}>
              <StepHeading icon={<Check />} id="confirm-step" eyebrow="Todo listo" title="Confirma para calcular" description="El cálculo se realizará en el servidor y se guardará completo en una sola transacción." />
              <dl className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-white/12 bg-white/10 sm:grid-cols-2">
                <Summary label="Producto" value={`${product.name} · ${product.insurerName}`} />
                <Summary label="Vehículo" value={vehicleMode === "existing" && vehicle ? `${vehicle.brand} ${vehicle.model}` : `${brand} ${model}`} />
                <Summary label="Vigencia" value={`${duration} ${duration === "1" ? "año" : "años"}`} />
                <Summary label="Modalidad" value={mode==="channel"?"Cotización asistida por canal":"Cotización individual en autogestión"} />
                {mode==="channel"&&<><Summary label="Inicio de vigencia" value={formatDate(startDate)}/><Summary label="Fin de vigencia" value={formatDate(coverageEndDate)}/><Summary label="Días de cobertura" value={String(coverageDays)}/><Summary label="Cuotas completas" value={String(Number(duration)*12)}/></>}
              </dl>
              <p className="mt-5 text-xs leading-5 text-white/48">El valor final depende de tus datos personales, el vehículo y la configuración vigente del producto. Esta cotización no constituye todavía una póliza.</p>
              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-cyan-100/20 bg-cyan-100/8 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 size-5 shrink-0 text-cyan-100" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold text-white">Inspección IA</p>
                    <p className="mt-1 text-xs leading-5 text-white/60">Ejecuta la inspección asistida por IA del vehículo antes de guardar la cotización.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAiInspectionDone(true)}
                  aria-pressed={aiInspectionDone}
                  className={aiInspectionDone
                    ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 text-xs font-bold text-emerald-50"
                    : "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#071426] hover:opacity-90"}
                >
                  {aiInspectionDone ? <><Check className="size-4" />Completado</> : <><Sparkles className="size-4" />Iniciar Inspección IA</>}
                </button>
              </div>
              {!aiInspectionDone && <p className="mt-3 text-xs font-semibold text-amber-200">Completa la Inspección IA para poder guardar la cotización.</p>}
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-4 sm:px-7">
          <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || pending} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white/65 hover:bg-white/8 disabled:invisible"><ArrowLeft className="size-4" /> Atrás</button>
          {step < steps.length - 1 ? <button type="button" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#071426] hover:opacity-90">Continuar <ArrowRight className="size-4" /></button> : <button type="submit" disabled={pending || !aiInspectionDone} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-cyan-200 px-6 text-sm font-bold text-[#071426] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{pending ? "Calculando…" : "Calcular cotización"}</button>}
        </div>
      </div>
    </form>
  );
}

function StepHeading({ icon, id, eyebrow, title: heading, description }: { icon: React.ReactNode; id: string; eyebrow: string; title: string; description: string }) {
  return <header className="flex gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-cyan-100/20 bg-cyan-100/10 text-cyan-100 [&_svg]:size-5">{icon}</span><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/60">{eyebrow}</p><h2 id={id} className="mt-1 text-2xl font-bold tracking-[-0.025em] sm:text-3xl">{heading}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">{description}</p></div></header>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span>{children}{error && <span className="mt-1.5 block text-xs text-red-200">{error}</span>}</label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="bg-[#061323]/65 p-4"><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{label}</dt><dd className="mt-1 text-sm font-semibold text-white/85">{value}</dd></div>; }
function DateSummary({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between gap-3"><dt className="text-white/45">{label}</dt><dd className="font-bold text-white/85">{value}</dd></div>}
function money(value: number) { return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value); }
function title(value: string) { return value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
function friendlyVehicleType(value: string) { return value.replace("VH USADOS Y NUEVOS ", "").replace("VH LIVIANOS NUEVOS Y USADOS ", "").replace("VH ", "").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
const inputClass = "min-h-12 w-full rounded-xl border border-white/18 bg-[#061323]/60 px-4 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-cyan-100/60 [color-scheme:dark]";
function todayInEcuador(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Guayaquil",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function maxStartDate(){const d=new Date(`${todayInEcuador()}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+90);return d.toISOString().slice(0,10)}
function endDate(start:string,years:number){if(!start)return"";const d=new Date(`${start}T12:00:00Z`);d.setUTCFullYear(d.getUTCFullYear()+years);d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
function inclusiveDays(start:string,end:string){if(!start||!end)return 0;return Math.round((new Date(`${end}T12:00:00Z`).getTime()-new Date(`${start}T12:00:00Z`).getTime())/86400000)+1}
function formatDate(value:string){if(!value)return"—";return new Intl.DateTimeFormat("es-EC",{dateStyle:"long",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`))}
