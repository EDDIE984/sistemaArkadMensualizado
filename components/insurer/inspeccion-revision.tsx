"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, MapPin, ScanSearch, ThumbsDown, ThumbsUp, X } from "lucide-react";
import {
  aprobarInspeccion,
  guardarRevisionTecnico,
  rechazarInspeccion,
} from "@/app/actions/inspeccion-revision";
import { initialInsurerState } from "@/lib/insurer/action-state";
import { CARROCERIA_LABELS, SLOT_LABELS } from "@/lib/inspeccion/slots";
import {
  ACCION_LABEL,
  SEV_COLOR,
  SEVERIDAD_LABEL,
  SEVERIDADES,
  TIPO_LABEL,
  type Severidad,
} from "@/lib/inspeccion/labels";
import type { InspeccionRevisionView } from "@/lib/inspeccion/types";
import { InspeccionMap } from "@/components/insurer/inspeccion-map";

const panel = "rounded-2xl border border-white/12 bg-[#05121f]/60 backdrop-blur";
const TABS = ["coche", "danos", "originales", "ia"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  coche: "Detalles del coche",
  danos: "Daños",
  originales: "Imágenes originales",
  ia: "Imágenes IA",
};

function money(v: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(v);
}
function fecha(v: string | null) {
  return v ? new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short" }).format(new Date(v)) : "—";
}
function title(v: string) {
  return v ? v.charAt(0) + v.slice(1).toLowerCase() : "—";
}

function SevPill({ sev }: { sev: Severidad | "SIN_DANOS" | null }) {
  if (!sev) return <span className="text-white/40">—</span>;
  if (sev === "SIN_DANOS")
    return (
      <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold text-emerald-100">
        Sin daños
      </span>
    );
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
      style={{ color: SEV_COLOR[sev], borderColor: `${SEV_COLOR[sev]}55`, background: `${SEV_COLOR[sev]}18` }}
    >
      {SEVERIDAD_LABEL[sev]}
    </span>
  );
}

function RevisionPill({ estado }: { estado: "PENDIENTE" | "APROBADA" | "RECHAZADA" }) {
  const tone =
    estado === "APROBADA"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
      : estado === "RECHAZADA"
        ? "border-rose-300/25 bg-rose-300/10 text-rose-100"
        : "border-amber-200/25 bg-amber-200/10 text-amber-100";
  const label = estado === "APROBADA" ? "Aprobada" : estado === "RECHAZADA" ? "Rechazada" : "Pendiente";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${tone}`}>{label}</span>
  );
}

export function InspeccionRevision({ view }: { view: InspeccionRevisionView }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("coche");
  const [lightbox, setLightbox] = useState<{ original: string; analizada: string | null; label: string } | null>(null);

  // Borradores del técnico.
  const initialObs = useMemo(
    () => Object.fromEntries(view.fotos.map((f) => [f.id, f.observacionTecnico ?? ""])),
    [view.fotos],
  );
  const initialSev = useMemo(
    () =>
      Object.fromEntries(
        view.fotos.flatMap((f) => f.danos.map((d) => [d.id, (d.severidadRevisada ?? "") as string])),
      ),
    [view.fotos],
  );
  const [obs, setObs] = useState<Record<string, string>>(initialObs);
  const [sev, setSev] = useState<Record<string, string>>(initialSev);
  // Re-sincroniza los borradores cuando el servidor trae datos nuevos (tras guardar
  // + router.refresh()). Patrón "ajustar estado en render" recomendado por React.
  const serverKey = view.fotos
    .map((f) => `${f.id}:${f.observacionTecnico ?? ""}:${f.danos.map((d) => `${d.id}=${d.severidadRevisada ?? ""}`).join(",")}`)
    .join("|");
  const [prevKey, setPrevKey] = useState(serverKey);
  if (serverKey !== prevKey) {
    setPrevKey(serverKey);
    setObs(initialObs);
    setSev(initialSev);
  }

  const dirty =
    view.fotos.some((f) => (obs[f.id] ?? "") !== (f.observacionTecnico ?? "")) ||
    view.fotos.some((f) => f.danos.some((d) => (sev[d.id] ?? "") !== (d.severidadRevisada ?? "")));

  const [saveState, saveAction, saving] = useActionState(guardarRevisionTecnico, initialInsurerState);
  const [aproState, aproAction, aproPending] = useActionState(aprobarInspeccion, initialInsurerState);
  const [rechState, rechAction, rechPending] = useActionState(rechazarInspeccion, initialInsurerState);

  useEffect(() => {
    if (saveState.status === "success" || aproState.status === "success" || rechState.status === "success") {
      router.refresh();
    }
  }, [saveState.status, aproState.status, rechState.status, router]);

  const [dictamen, setDictamen] = useState<null | "APROBADA" | "RECHAZADA">(null);

  const danosFlat = view.fotos.flatMap((f) => f.danos.map((d) => ({ dano: d, foto: f })));

  return (
    <div className="grid gap-4">
      {/* Barra de acciones */}
      <div className={`${panel} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <RevisionPill estado={view.estadoRevision} />
          {view.revisadoEn && (
            <span className="text-xs text-white/50">
              {view.revisorNombre ?? "—"} · {fecha(view.revisadoEn)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={saveAction}>
            <input type="hidden" name="inspeccionId" value={view.id} />
            {view.fotos.map((f) => (
              <input key={f.id} type="hidden" name={`obs_${f.id}`} value={obs[f.id] ?? ""} />
            ))}
            {danosFlat.map(({ dano }) => (
              <input key={dano.id} type="hidden" name={`sev_${dano.id}`} value={sev[dano.id] ?? ""} />
            ))}
            <button
              type="submit"
              disabled={!dirty || saving}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-bold text-white/80 hover:bg-white/8 disabled:opacity-40"
            >
              {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
              Guardar observaciones
            </button>
          </form>
          <button
            type="button"
            onClick={() => setDictamen("APROBADA")}
            disabled={view.estadoRevision === "APROBADA"}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 text-xs font-bold text-emerald-50 hover:bg-emerald-300/16 disabled:opacity-40"
          >
            <ThumbsUp className="size-4" /> Aprobar
          </button>
          <button
            type="button"
            onClick={() => setDictamen("RECHAZADA")}
            disabled={view.estadoRevision === "RECHAZADA"}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-300/30 bg-rose-300/10 px-4 text-xs font-bold text-rose-50 hover:bg-rose-300/16 disabled:opacity-40"
          >
            <ThumbsDown className="size-4" /> Rechazar
          </button>
        </div>
      </div>

      {(saveState.status === "error" || aproState.status === "error" || rechState.status === "error") && (
        <p className="rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-50" role="alert">
          {saveState.message || aproState.message || rechState.message}
        </p>
      )}

      {view.revisionMotivo && (
        <p className={`${panel} px-4 py-3 text-sm text-white/70`}>
          <span className="font-bold text-white/85">Motivo del dictamen:</span> {view.revisionMotivo}
        </p>
      )}

      {/* Panel de dictamen (motivo obligatorio) */}
      {dictamen && (
        <form
          action={dictamen === "APROBADA" ? aproAction : rechAction}
          className={`${panel} grid gap-3 p-4`}
        >
          <input type="hidden" name="inspeccionId" value={view.id} />
          <p className="text-sm font-bold">
            {dictamen === "APROBADA" ? "Aprobar inspección" : "Rechazar inspección"} — motivo (obligatorio)
          </p>
          <textarea
            name="motivo"
            required
            minLength={3}
            rows={3}
            placeholder={
              dictamen === "APROBADA"
                ? "Ej.: Fotos completas y daños correctamente clasificados."
                : "Ej.: Faltan fotos nítidas del lateral izquierdo; repetir captura."
            }
            className="min-h-20 w-full rounded-xl border border-white/15 bg-[#061323]/65 px-3 py-2 text-sm text-white outline-none focus:border-cyan-100/55"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={aproPending || rechPending}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full px-5 text-sm font-bold text-[#071426] disabled:opacity-60 ${
                dictamen === "APROBADA" ? "bg-emerald-200" : "bg-rose-200"
              }`}
            >
              {aproPending || rechPending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
              {dictamen === "APROBADA" ? "Confirmar aprobación" : "Confirmar rechazo"}
            </button>
            <button
              type="button"
              onClick={() => setDictamen(null)}
              className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold text-white/60 hover:bg-white/8"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className={`${panel} overflow-hidden`}>
        <div className="flex flex-wrap gap-1 border-b border-white/10 p-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors ${
                tab === t ? "bg-cyan-100/12 text-cyan-50" : "text-white/55 hover:bg-white/6 hover:text-white"
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {tab === "coche" && <TabCoche view={view} />}
          {tab === "danos" && (
            <TabDanos
              danosFlat={danosFlat}
              sev={sev}
              setSev={setSev}
              disabled={view.estadoRevision !== "PENDIENTE"}
              onVer={(f) => setLightbox({ original: f.originalUrl, analizada: f.analizadaUrl, label: SLOT_LABELS[f.slot] })}
            />
          )}
          {tab === "originales" && (
            <TabImagenes
              view={view}
              modo="original"
              obs={obs}
              setObs={setObs}
              disabled={view.estadoRevision !== "PENDIENTE"}
              onOpen={setLightbox}
            />
          )}
          {tab === "ia" && <TabImagenes view={view} modo="ia" obs={obs} setObs={setObs} disabled onOpen={setLightbox} />}
        </div>
      </div>

      {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

/* ---------------- Tab: Detalles del coche ---------------- */

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/42">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white/85">{value || "—"}</p>
    </div>
  );
}

function TabCoche({ view }: { view: InspeccionRevisionView }) {
  const v = view.vehiculo;
  const c = view.cliente;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-100/60">Vehículo</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Info label="Placa" value={v.placa ?? "—"} />
          <Info label="Marca / Modelo" value={`${v.marca} ${v.modelo}`.trim()} />
          <Info label="Año" value={v.anio ? String(v.anio) : "—"} />
          <Info label="Color" value={title(v.color ?? "")} />
          <Info label="Valor asegurado" value={money(v.valorAsegurado)} />
          <Info label="Estado / Uso" value={`${title(v.estadoVh)} · ${title(v.uso)}`} />
          <Info label="Número de chasis" value="No registrado" />
          <Info label="Carrocería (inspección)" value={CARROCERIA_LABELS[view.carroceria]} />
        </div>

        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-cyan-100/60">Cliente</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Info label="Nombre" value={c.nombre} />
          <Info label="Identificación" value={c.identificacion ?? "—"} />
          <Info label="Correo" value={c.email} />
          <Info label="Teléfono" value={c.telefono ?? "—"} />
          <Info label="Ciudad" value={c.ciudad ?? "—"} />
          {view.agente && <Info label="Agente de canal" value={view.agente} />}
        </div>

        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-cyan-100/60">Inspección</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Info label="Origen" value={view.origen === "CANAL" ? "Canal asistido" : "Autogestión"} />
          <Info label="Completada" value={fecha(view.completadaEn)} />
          <Info label="Análisis IA" value={title(view.analisisEstado)} />
          <Info label="Calificación IA" value={view.calificacionIa ? (view.calificacionIa === "SIN_DANOS" ? "Sin daños" : SEVERIDAD_LABEL[view.calificacionIa]) : "—"} />
        </div>
      </div>

      <div className="grid content-start gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-100/60">Ubicación</p>
        {view.mapa ? (
          <InspeccionMap lat={view.mapa.lat} lng={view.mapa.lng} />
        ) : (
          <p className={`${panel} px-4 py-6 text-center text-sm text-white/45`}>
            Sin ubicación registrada (el usuario no concedió geolocalización).
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Tab: Daños ---------------- */

type DanoFlat = { dano: InspeccionRevisionView["fotos"][number]["danos"][number]; foto: InspeccionRevisionView["fotos"][number] };

function TabDanos({
  danosFlat,
  sev,
  setSev,
  disabled,
  onVer,
}: {
  danosFlat: DanoFlat[];
  sev: Record<string, string>;
  setSev: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  disabled: boolean;
  onVer: (foto: DanoFlat["foto"]) => void;
}) {
  if (!danosFlat.length) {
    return <p className="py-8 text-center text-sm text-white/45">La IA no detectó daños en esta inspección.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-white/40">
          <tr>
            {["Foto", "Ubicación", "Tipo", "Pieza", "Descripción IA", "Conf.", "Gravedad IA", "Gravedad (técnico)", ""].map((h) => (
              <th key={h} className="px-3 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/8">
          {danosFlat.map(({ dano, foto }) => (
            <tr key={dano.id}>
              <td className="px-3 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.originalUrl} alt="" className="size-12 rounded-lg object-cover" />
              </td>
              <td className="px-3 py-3 text-white/72">{SLOT_LABELS[foto.slot]}</td>
              <td className="px-3 py-3 text-white/72">{TIPO_LABEL[dano.tipo as keyof typeof TIPO_LABEL] ?? dano.tipo}</td>
              <td className="px-3 py-3 text-white/72">{dano.pieza ?? "—"}</td>
              <td className="max-w-[280px] px-3 py-3 text-white/55">{dano.descripcion ?? "—"}</td>
              <td className="px-3 py-3 text-white/55">{dano.confianza !== null ? `${Math.round(dano.confianza * 100)}%` : "—"}</td>
              <td className="px-3 py-3"><SevPill sev={dano.severidadIa} /></td>
              <td className="px-3 py-3">
                <select
                  value={sev[dano.id] ?? ""}
                  disabled={disabled}
                  onChange={(e) => setSev((prev) => ({ ...prev, [dano.id]: e.target.value }))}
                  className="min-h-9 rounded-lg border border-white/18 bg-[#061323]/70 px-2 text-xs text-white [color-scheme:dark] disabled:opacity-50"
                >
                  <option value="">= IA ({SEVERIDAD_LABEL[dano.severidadIa]})</option>
                  {SEVERIDADES.map((s) => (
                    <option key={s} value={s}>{SEVERIDAD_LABEL[s]}</option>
                  ))}
                </select>
                <span className="ml-2 block text-[10px] text-white/35">Acción IA: {ACCION_LABEL[dano.accionRecomendada as keyof typeof ACCION_LABEL] ?? dano.accionRecomendada}</span>
              </td>
              <td className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => onVer(foto)}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-white/15 px-2.5 text-[11px] font-bold text-white/70 hover:bg-white/8"
                >
                  <ScanSearch className="size-3.5" /> Ver
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Tab: Imágenes (originales / IA) ---------------- */

function TabImagenes({
  view,
  modo,
  obs,
  setObs,
  disabled,
  onOpen,
}: {
  view: InspeccionRevisionView;
  modo: "original" | "ia";
  obs: Record<string, string>;
  setObs: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  disabled: boolean;
  onOpen: (lb: { original: string; analizada: string | null; label: string }) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {view.fotos.map((f) => {
        const src = modo === "ia" ? f.analizadaUrl ?? f.originalUrl : f.originalUrl;
        return (
          <div key={f.id} className="grid gap-2">
            <button
              type="button"
              onClick={() => onOpen({ original: f.originalUrl, analizada: f.analizadaUrl, label: SLOT_LABELS[f.slot] })}
              className="relative block aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-[#061323]/60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={SLOT_LABELS[f.slot]} className="size-full object-cover" />
              {f.lat !== null && (
                <span className="absolute left-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-black/55 text-white">
                  <MapPin className="size-3" />
                </span>
              )}
              {modo === "ia" && (
                <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
                  {f.danosTotal ? `${f.danosTotal} daño(s)` : "Sin daños"}
                </span>
              )}
            </button>
            <p className="text-xs font-bold text-white/80">{SLOT_LABELS[f.slot]}</p>
            {modo === "original" && (
              <>
                {f.danos.length > 0 && (
                  <ul className="grid gap-0.5 text-[11px] leading-4 text-white/45">
                    {f.danos.map((d) => (
                      <li key={d.id}>
                        · {TIPO_LABEL[d.tipo as keyof typeof TIPO_LABEL] ?? d.tipo}
                        {d.pieza ? ` (${d.pieza})` : ""} — {d.descripcion ?? SEVERIDAD_LABEL[d.severidadIa]}
                      </li>
                    ))}
                  </ul>
                )}
                <textarea
                  value={obs[f.id] ?? ""}
                  disabled={disabled}
                  onChange={(e) => setObs((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  rows={2}
                  placeholder="Observación del técnico…"
                  className="w-full rounded-lg border border-white/15 bg-[#061323]/65 px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-100/55 disabled:opacity-50"
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Lightbox ---------------- */

function Lightbox({
  original,
  analizada,
  label,
  onClose,
}: {
  original: string;
  analizada: string | null;
  label: string;
  onClose: () => void;
}) {
  const [ver, setVer] = useState<"original" | "analizada">(analizada ? "analizada" : "original");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  const src = ver === "analizada" && analizada ? analizada : original;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#030b16]/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm font-bold">{label}</p>
        <div className="flex items-center gap-2">
          {analizada && (
            <div className="flex overflow-hidden rounded-full border border-white/15 text-xs font-bold">
              <button
                type="button"
                onClick={() => setVer("original")}
                className={`px-3 py-1.5 ${ver === "original" ? "bg-white text-[#071426]" : "text-white/60"}`}
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => setVer("analizada")}
                className={`px-3 py-1.5 ${ver === "analizada" ? "bg-white text-[#071426]" : "text-white/60"}`}
              >
                Analizada
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 hover:bg-white/8"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="max-h-full max-w-full rounded-xl object-contain" />
      </div>
    </div>
  );
}
