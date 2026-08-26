import type { Carroceria, SlotCode } from "@/lib/inspeccion/slots";
import type { Severidad } from "@/lib/inspeccion/labels";

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

/* ------------------------------------------------------------------ */
/* Fase 3 — panel de revisión del inspector (aseguradora)              */
/* ------------------------------------------------------------------ */

export type EstadoRevision = "PENDIENTE" | "APROBADA" | "RECHAZADA";
export type AnalisisEstadoRollup = "PENDIENTE" | "EN_PROCESO" | "COMPLETADO" | "CON_ERRORES";

export type InspeccionListaItem = {
  id: string;
  cotizacionId: string;
  placa: string | null;
  carroceria: Carroceria;
  miniaturaUrl: string | null;
  analisisEstado: AnalisisEstadoRollup;
  estadoRevision: EstadoRevision;
  danosTotal: number;
  gravedadPeor: Severidad | null;
  creadoPor: string;
  completadaEn: string | null;
};

export type DanoRevisionView = {
  id: string;
  tipo: string;
  severidadIa: Severidad;
  severidadRevisada: Severidad | null;
  accionRecomendada: string;
  pieza: string | null;
  descripcion: string | null;
  confianza: number | null;
  bbox: { x: number; y: number; w: number; h: number };
};

export type FotoRevisionView = {
  id: string;
  slot: SlotCode;
  originalUrl: string;
  analizadaUrl: string | null;
  analisisEstado: "PENDIENTE" | "ANALIZANDO" | "ANALIZADA" | "SIN_DANOS" | "ERROR";
  danosTotal: number;
  lat: number | null;
  lng: number | null;
  precisionM: number | null;
  geoEn: string | null;
  observacionTecnico: string | null;
  danos: DanoRevisionView[];
};

export type InspeccionRevisionView = {
  id: string;
  cotizacionId: string;
  carroceria: Carroceria;
  origen: "AUTOGESTION" | "CANAL";
  completadaEn: string | null;
  analisisEstado: AnalisisEstadoRollup;
  calificacionIa: Severidad | "SIN_DANOS" | null;
  estadoRevision: EstadoRevision;
  revisadoEn: string | null;
  revisionMotivo: string | null;
  revisorNombre: string | null;
  vehiculo: {
    marca: string;
    modelo: string;
    anio: number | null;
    color: string | null;
    placa: string | null;
    valorAsegurado: number;
    estadoVh: string;
    uso: string;
  };
  cliente: {
    nombre: string;
    identificacion: string | null;
    email: string;
    telefono: string | null;
    ciudad: string | null;
  };
  agente: string | null;
  fotos: FotoRevisionView[];
  mapa: { lat: number; lng: number } | null;
};
