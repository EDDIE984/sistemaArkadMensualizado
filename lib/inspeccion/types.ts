import type { Carroceria, SlotCode } from "@/lib/inspeccion/slots";

export type InspeccionActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fields?: Record<string, string[]>;
};

export const initialInspeccionState: InspeccionActionState = { status: "idle" };

export type InspeccionFotoView = {
  id: string;
  slot: SlotCode;
  signedUrl: string;
  capturadoCon: "CAMARA" | "ARCHIVO";
  lat: number | null;
  lng: number | null;
  creadoEn: string;
};

export type InspeccionView = {
  id: string;
  cotizacionId: string;
  carroceria: Carroceria;
  estado: "EN_PROGRESO" | "COMPLETADA";
  fotos: InspeccionFotoView[];
  completadas: number;
  requeridas: number;
};

// Respuesta JSON del Route Handler tras subir/borrar una foto.
export type FotoMutationResult = {
  estado: "EN_PROGRESO" | "COMPLETADA";
  completadas: number;
  requeridas: number;
  foto?: InspeccionFotoView;
};
