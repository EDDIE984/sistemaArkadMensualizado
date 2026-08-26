"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  CircleCheckBig,
  ImageUp,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { cambiarCarroceria, eliminarInspeccion, iniciarInspeccion } from "@/app/actions/inspeccion";
import { compressToJpeg } from "@/lib/inspeccion/compress";
import {
  CARROCERIAS,
  CARROCERIA_LABELS,
  requiredSlots,
  SLOT_HINTS,
  SLOT_LABELS,
  type Carroceria,
  type SlotCode,
} from "@/lib/inspeccion/slots";
import { initialInspeccionState, type InspeccionFotoView, type InspeccionView } from "@/lib/inspeccion/types";
import { CarroceriaIcon } from "@/components/inspeccion/carroceria-icons";
import { Silhouette } from "@/components/inspeccion/silhouettes";

type Props = {
  cotizacionId: string;
  actor: "CLIENTE" | "CANAL";
  vehiculo: { marca: string | null; modelo: string | null; anio: number | null };
  inspeccion: InspeccionView | null;
};

const panel = "rounded-2xl border border-white/12 bg-[#05121f]/60 backdrop-blur";

export function InspeccionWorkspace({ cotizacionId, actor, vehiculo, inspeccion }: Props) {
  const vehicleLabel = [vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(" ") || "tu vehículo";

  if (!inspeccion) {
    return <CarroceriaPicker cotizacionId={cotizacionId} vehicleLabel={vehicleLabel} />;
  }
  return <SlotBoard cotizacionId={cotizacionId} actor={actor} inspeccion={inspeccion} />;
}

/* ------------------------------------------------------------------ */
/* Paso 1 — elegir carrocería                                          */
/* ------------------------------------------------------------------ */

function CarroceriaPicker({ cotizacionId, vehicleLabel }: { cotizacionId: string; vehicleLabel: string }) {
  const [state, action, pending] = useActionState(iniciarInspeccion, initialInspeccionState);
  const [carroceria, setCarroceria] = useState<Carroceria>("SEDAN");

  return (
    <form action={action} className={`${panel} p-5 sm:p-7`}>
      <input type="hidden" name="cotizacionId" value={cotizacionId} />
      <input type="hidden" name="carroceria" value={carroceria} />
      <h2 className="text-lg font-bold">Selecciona la carrocería</h2>
      <p className="mt-1 text-sm text-white/60">
        Elige la forma que más se parece a {vehicleLabel}. Con esto definimos qué fotos pedirte.
      </p>

      {state.status === "error" && state.message && (
        <p className="mt-4 rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-50" role="alert">
          {state.message}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {CARROCERIAS.map((option) => {
          const selected = option === carroceria;
          return (
            <label
              key={option}
              className={`cursor-pointer rounded-xl border p-4 text-center transition-colors ${
                selected ? "border-cyan-200/70 bg-cyan-100/12" : "border-white/12 bg-[#061323]/40 hover:border-white/30"
              }`}
            >
              <input
                type="radio"
                name="carroceriaChoice"
                value={option}
                checked={selected}
                onChange={() => setCarroceria(option)}
                className="sr-only"
              />
              <span className="mx-auto block h-16 w-full text-cyan-100/85">
                <CarroceriaIcon carroceria={option} className="mx-auto h-full w-auto" />
              </span>
              <span className="mt-2 block text-xs font-bold">{CARROCERIA_LABELS[option]}</span>
            </label>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-cyan-200 px-6 text-sm font-bold text-[#071426] hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
        Comenzar inspección
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Paso 2 — grilla de tomas                                            */
/* ------------------------------------------------------------------ */

function SlotBoard({
  cotizacionId,
  actor,
  inspeccion,
}: {
  cotizacionId: string;
  actor: "CLIENTE" | "CANAL";
  inspeccion: InspeccionView;
}) {
  const router = useRouter();
  const [captureSlot, setCaptureSlot] = useState<SlotCode | null>(null);
  const [busySlot, setBusySlot] = useState<SlotCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slots = requiredSlots(inspeccion.carroceria);
  const fotoBySlot = new Map(inspeccion.fotos.map((foto) => [foto.slot, foto] as const));

  const removeFoto = useCallback(
    async (slot: SlotCode) => {
      setBusySlot(slot);
      setError(null);
      try {
        const response = await fetch("/api/inspeccion/fotos", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cotizacionId, slot }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "No pudimos borrar la foto.");
        }
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No pudimos borrar la foto.");
      } finally {
        setBusySlot(null);
      }
    },
    [cotizacionId, router],
  );

  return (
    <div className="grid gap-4">
      <ProgressHeader cotizacionId={cotizacionId} inspeccion={inspeccion} />

      <p className={`${panel} px-4 py-3 text-xs leading-5 text-white/55`}>
        {actor === "CANAL"
          ? "Captura las fotos con el dispositivo del cliente o el tuyo. "
          : "Puedes usar el celular o la webcam del computador. "}
        La inspección es informativa: no cambia el estado de la cotización ni bloquea la emisión.
      </p>

      {error && (
        <p className="rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-50" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => (
          <SlotCard
            key={slot}
            slot={slot}
            foto={fotoBySlot.get(slot) ?? null}
            busy={busySlot === slot}
            onCapture={() => {
              setError(null);
              setCaptureSlot(slot);
            }}
            onRemove={() => removeFoto(slot)}
          />
        ))}
      </div>

      {captureSlot && (
        <CaptureModal
          cotizacionId={cotizacionId}
          slot={captureSlot}
          onClose={() => setCaptureSlot(null)}
          onSaved={() => {
            setCaptureSlot(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ProgressHeader({ cotizacionId, inspeccion }: { cotizacionId: string; inspeccion: InspeccionView }) {
  const [state, action, pending] = useActionState(cambiarCarroceria, initialInspeccionState);
  const [deleteState, deleteAction, deletePending] = useActionState(eliminarInspeccion, initialInspeccionState);
  const [carroceria, setCarroceria] = useState<Carroceria>(inspeccion.carroceria);
  const [editing, setEditing] = useState(false);
  const pct = inspeccion.requeridas ? Math.round((inspeccion.completadas / inspeccion.requeridas) * 100) : 0;
  const done = inspeccion.estado === "COMPLETADA";
  const errorMessage =
    state.status === "error" ? state.message : deleteState.status === "error" ? deleteState.message : null;

  return (
    <div className={`${panel} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100/60">Inspección fotográfica</p>
          <h2 className="mt-1 text-xl font-bold">
            {inspeccion.completadas} de {inspeccion.requeridas} fotos
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
            done
              ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-50"
              : "border-cyan-100/25 bg-cyan-100/10 text-cyan-50"
          }`}
        >
          {done ? <CircleCheckBig className="size-4" /> : null}
          {done ? "Completada" : "En progreso"}
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/12">
        <div className="h-full rounded-full bg-cyan-200 transition-[width]" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-white/55">
          Carrocería: <strong className="text-white/85">{CARROCERIA_LABELS[inspeccion.carroceria]}</strong>
        </span>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-bold text-cyan-100 underline decoration-cyan-100/40 underline-offset-4 hover:decoration-cyan-100"
          >
            Cambiar
          </button>
        ) : (
          <form
            action={action}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Cambiar la carrocería puede eliminar fotos que ya no apliquen (por ejemplo, puertas traseras). ¿Continuar?",
                )
              ) {
                event.preventDefault();
              }
            }}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="cotizacionId" value={cotizacionId} />
            <input type="hidden" name="carroceria" value={carroceria} />
            <select
              value={carroceria}
              onChange={(event) => setCarroceria(event.target.value as Carroceria)}
              className="min-h-9 rounded-lg border border-white/18 bg-[#061323]/70 px-2 text-xs text-white [color-scheme:dark]"
            >
              {CARROCERIAS.map((option) => (
                <option key={option} value={option}>
                  {CARROCERIA_LABELS[option]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white px-3 text-xs font-bold text-[#071426] disabled:opacity-60"
            >
              {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setCarroceria(inspeccion.carroceria);
              }}
              className="text-xs font-semibold text-white/55 hover:text-white"
            >
              Cancelar
            </button>
          </form>
        )}

        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                "Se eliminará la inspección y todas sus fotos. Podrás volver a generarla desde el inicio. ¿Continuar?",
              )
            ) {
              event.preventDefault();
            }
          }}
          className="ml-auto"
        >
          <input type="hidden" name="cotizacionId" value={cotizacionId} />
          <button
            type="submit"
            disabled={deletePending}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-red-300/30 bg-red-300/10 px-3 text-xs font-bold text-red-100 hover:bg-red-300/16 disabled:opacity-60"
          >
            {deletePending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Eliminar inspección
          </button>
        </form>
      </div>

      {errorMessage && <p className="mt-3 text-xs font-semibold text-red-200">{errorMessage}</p>}
    </div>
  );
}

function SlotCard({
  slot,
  foto,
  busy,
  onCapture,
  onRemove,
}: {
  slot: SlotCode;
  foto: InspeccionFotoView | null;
  busy: boolean;
  onCapture: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`${panel} flex flex-col gap-3 p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">{SLOT_LABELS[slot]}</p>
          <p className="mt-0.5 text-xs leading-4 text-white/50">{SLOT_HINTS[slot]}</p>
        </div>
        {foto && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold text-emerald-50">
            <Check className="size-3" />
          </span>
        )}
      </div>

      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-[#061323]/60">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto.signedUrl} alt={SLOT_LABELS[slot]} className="size-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center p-6 text-white/25">
            <Silhouette slot={slot} className="h-full w-full" />
          </span>
        )}
        {foto && (
          <div className="absolute left-2 top-2 flex gap-1">
            <Badge>{foto.capturadoCon === "ARCHIVO" ? <ImageUp className="size-3" /> : <Camera className="size-3" />}</Badge>
            {foto.lat !== null && (
              <Badge>
                <MapPin className="size-3" />
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCapture}
          disabled={busy}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-[#071426] hover:opacity-90 disabled:opacity-60"
        >
          {foto ? <RefreshCw className="size-3.5" /> : <Camera className="size-3.5" />}
          {foto ? "Repetir" : "Tomar foto"}
        </button>
        {foto && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-bold text-white/70 hover:bg-white/8 disabled:opacity-60"
            aria-label="Eliminar foto"
          >
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Modal de captura                                                    */
/* ------------------------------------------------------------------ */

type Geo = { lat: number; lng: number; precisionM: number | null; capturadoEn: string } | null;

function CaptureModal({
  cotizacionId,
  slot,
  onClose,
  onSaved,
}: {
  cotizacionId: string;
  slot: SlotCode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<"loading" | "camera" | "fallback">("loading");
  const [preview, setPreview] = useState<{ url: string; blob: Blob; width: number; height: number } | null>(null);
  const [geo, setGeo] = useState<Geo>(null);
  const [geoState, setGeoState] = useState<"pending" | "ok" | "denied">(() =>
    typeof navigator !== "undefined" && navigator.geolocation ? "pending" : "denied",
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const close = useCallback(() => {
    stopStream();
    if (preview) URL.revokeObjectURL(preview.url);
    onClose();
  }, [onClose, preview, stopStream]);

  // Cámara + geolocalización al abrir.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setMode("camera");
      } catch {
        if (!cancelled) setMode("fallback");
      }
    })();

    navigator.geolocation?.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setGeo({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          precisionM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          capturadoEn: new Date(position.timestamp).toISOString(),
        });
        setGeoState("ok");
      },
      () => !cancelled && setGeoState("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => stopStream, [stopStream]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [close]);

  const setFromBlob = useCallback(
    async (raw: Blob) => {
      setError(null);
      try {
        const { blob, width, height } = await compressToJpeg(raw);
        setPreview((current) => {
          if (current) URL.revokeObjectURL(current.url);
          return { url: URL.createObjectURL(blob), blob, width, height };
        });
        stopStream();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No pudimos procesar la imagen.");
      }
    },
    [stopStream],
  );

  const shoot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob && setFromBlob(blob), "image/jpeg", 0.92);
  }, [setFromBlob]);

  const retake = useCallback(async () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setMode("loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setMode("camera");
    } catch {
      setMode("fallback");
    }
  }, [preview]);

  const save = useCallback(async () => {
    if (!preview) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("cotizacionId", cotizacionId);
      form.set("slot", slot);
      form.set("capturadoCon", mode === "fallback" ? "ARCHIVO" : "CAMARA");
      form.set("ancho", String(preview.width));
      form.set("alto", String(preview.height));
      form.set("file", preview.blob, `${slot.toLowerCase()}.jpg`);
      if (geo) {
        form.set("lat", String(geo.lat));
        form.set("lng", String(geo.lng));
        if (geo.precisionM !== null) form.set("precisionM", String(geo.precisionM));
        form.set("geoCapturadoEn", geo.capturadoEn);
      }
      const response = await fetch("/api/inspeccion/fotos", { method: "POST", body: form });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "No pudimos guardar la foto.");
      }
      URL.revokeObjectURL(preview.url);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos guardar la foto.");
      setUploading(false);
    }
  }, [cotizacionId, geo, mode, onSaved, preview, slot]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#030b16]/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-bold">{SLOT_LABELS[slot]}</p>
          <p className="text-xs text-white/55">{SLOT_HINTS[slot]}</p>
        </div>
        <button
          type="button"
          onClick={close}
          className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 hover:bg-white/8"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.url} alt="Vista previa" className="max-h-full max-w-full rounded-xl object-contain" />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`max-h-full max-w-full rounded-xl object-contain ${mode === "camera" ? "" : "hidden"}`}
            />
            {mode === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <LoaderCircle className="size-6 animate-spin text-white/60" />
              </div>
            )}
            {mode === "fallback" && (
              <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 px-4 text-center">
                <p className="text-xs text-white/60">No pudimos abrir la cámara. Sube una foto desde tu dispositivo.</p>
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#071426]">
                  <ImageUp className="size-4" />
                  Elegir imagen
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setFromBlob(file);
                    }}
                  />
                </label>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        {error && <p className="mb-3 text-center text-xs font-semibold text-red-200">{error}</p>}
        <div className="flex items-center justify-between gap-3 text-xs text-white/55">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            {geoState === "ok"
              ? "Ubicación capturada"
              : geoState === "denied"
                ? "Sin ubicación (opcional)"
                : "Obteniendo ubicación…"}
          </span>
          <div className="flex gap-2">
            {preview ? (
              <>
                <button
                  type="button"
                  onClick={retake}
                  disabled={uploading}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-4 text-sm font-bold text-white/75 hover:bg-white/8 disabled:opacity-60"
                >
                  <RefreshCw className="size-4" />
                  Repetir
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={uploading}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-cyan-200 px-5 text-sm font-bold text-[#071426] hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                >
                  {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Guardar
                </button>
              </>
            ) : (
              mode === "camera" && (
                <button
                  type="button"
                  onClick={shoot}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-6 text-sm font-bold text-[#071426] hover:opacity-90"
                >
                  <Camera className="size-4" />
                  Capturar
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
