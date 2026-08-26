// Catálogo de carrocerías y tomas (slots) de la inspección fotográfica, y la
// matriz carrocería -> slots requeridos. Vive en código (no en tablas): no son
// catálogos editables por tenant; la BD sólo fija los dominios vía CHECK.
//
// OJO: `carroceria` es la FORMA del chasis, usada sólo para decidir qué fotos
// pedir. NO tiene relación con `vehiculo.tipo_vehiculo_id`, que es la categoría
// tarifaria configurada por el producto.

export type Carroceria =
  | "SEDAN"
  | "SUV"
  | "STATION_WAGON"
  | "HATCHBACK"
  | "LCV"
  | "CAMIONETA"
  | "MINIVAN";

export type SlotCode =
  | "FRENTE"
  | "ATRAS"
  | "LATERAL_DERECHO"
  | "LATERAL_IZQUIERDO"
  | "MOTOR"
  | "CAJUELA"
  | "INTERIOR_TABLERO"
  | "ASIENTOS_DELANTEROS"
  | "ASIENTOS_TRASEROS"
  | "PUERTA_INT_DELANTERA_IZQ"
  | "PUERTA_INT_DELANTERA_DER"
  | "PUERTA_INT_TRASERA_IZQ"
  | "PUERTA_INT_TRASERA_DER";

export const CARROCERIAS: readonly Carroceria[] = [
  "SEDAN",
  "SUV",
  "STATION_WAGON",
  "HATCHBACK",
  "LCV",
  "CAMIONETA",
  "MINIVAN",
];

export const CARROCERIA_LABELS: Record<Carroceria, string> = {
  SEDAN: "Sedán",
  SUV: "SUV",
  STATION_WAGON: "Station Wagon",
  HATCHBACK: "Hatchback",
  LCV: "LCV (furgón liviano)",
  CAMIONETA: "Camioneta",
  MINIVAN: "Minivan",
};

// Orden estable de la grilla de tomas.
export const SLOT_ORDER: readonly SlotCode[] = [
  "FRENTE",
  "ATRAS",
  "LATERAL_DERECHO",
  "LATERAL_IZQUIERDO",
  "MOTOR",
  "CAJUELA",
  "INTERIOR_TABLERO",
  "ASIENTOS_DELANTEROS",
  "ASIENTOS_TRASEROS",
  "PUERTA_INT_DELANTERA_IZQ",
  "PUERTA_INT_DELANTERA_DER",
  "PUERTA_INT_TRASERA_IZQ",
  "PUERTA_INT_TRASERA_DER",
];

export const SLOT_LABELS: Record<SlotCode, string> = {
  FRENTE: "Frente del vehículo",
  ATRAS: "Parte trasera",
  LATERAL_DERECHO: "Lateral derecho",
  LATERAL_IZQUIERDO: "Lateral izquierdo",
  MOTOR: "Motor (capó abierto)",
  CAJUELA: "Cajuela / portón abierto",
  INTERIOR_TABLERO: "Interior — tablero",
  ASIENTOS_DELANTEROS: "Asientos delanteros",
  ASIENTOS_TRASEROS: "Asientos traseros",
  PUERTA_INT_DELANTERA_IZQ: "Puerta interior delantera izquierda",
  PUERTA_INT_DELANTERA_DER: "Puerta interior delantera derecha",
  PUERTA_INT_TRASERA_IZQ: "Puerta interior trasera izquierda",
  PUERTA_INT_TRASERA_DER: "Puerta interior trasera derecha",
};

export const SLOT_HINTS: Record<SlotCode, string> = {
  FRENTE: "Encuadra todo el frente: parrilla, faros y placa visibles.",
  ATRAS: "Encuadra toda la parte trasera con las luces y la placa visibles.",
  LATERAL_DERECHO: "El vehículo completo de lado, puertas del copiloto.",
  LATERAL_IZQUIERDO: "El vehículo completo de lado, puertas del conductor.",
  MOTOR: "Capó totalmente abierto, compartimiento del motor centrado.",
  CAJUELA: "Cajuela o portón abierto mostrando el piso y las paredes.",
  INTERIOR_TABLERO: "Tablero completo con el odómetro y el volante visibles.",
  ASIENTOS_DELANTEROS: "Asientos del conductor y copiloto desde la puerta trasera.",
  ASIENTOS_TRASEROS: "Banca trasera completa desde la puerta delantera.",
  PUERTA_INT_DELANTERA_IZQ: "Panel interior de la puerta del conductor.",
  PUERTA_INT_DELANTERA_DER: "Panel interior de la puerta del copiloto.",
  PUERTA_INT_TRASERA_IZQ: "Panel interior de la puerta trasera izquierda.",
  PUERTA_INT_TRASERA_DER: "Panel interior de la puerta trasera derecha.",
};

// 11 tomas comunes a toda carrocería.
export const BASE_SLOTS: readonly SlotCode[] = [
  "FRENTE",
  "ATRAS",
  "LATERAL_DERECHO",
  "LATERAL_IZQUIERDO",
  "MOTOR",
  "CAJUELA",
  "INTERIOR_TABLERO",
  "ASIENTOS_DELANTEROS",
  "ASIENTOS_TRASEROS",
  "PUERTA_INT_DELANTERA_IZQ",
  "PUERTA_INT_DELANTERA_DER",
];

// Carrocerías con puertas traseras (fase 1). LCV y CAMIONETA quedan fuera
// (cabina simple). Doble cabina se refina en fase 2.
export const CARROCERIAS_CON_PUERTAS_TRASERAS: ReadonlySet<Carroceria> = new Set<Carroceria>([
  "SEDAN",
  "SUV",
  "STATION_WAGON",
  "HATCHBACK",
  "MINIVAN",
]);

const REAR_DOOR_SLOTS: readonly SlotCode[] = ["PUERTA_INT_TRASERA_IZQ", "PUERTA_INT_TRASERA_DER"];

export function isCarroceria(value: unknown): value is Carroceria {
  return typeof value === "string" && (CARROCERIAS as readonly string[]).includes(value);
}

export function isSlotCode(value: unknown): value is SlotCode {
  return typeof value === "string" && (SLOT_ORDER as readonly string[]).includes(value);
}

/** Tomas requeridas para una carrocería, en `SLOT_ORDER`. 11 base, o 13 con puertas traseras. */
export function requiredSlots(carroceria: Carroceria): SlotCode[] {
  const set = new Set<SlotCode>(BASE_SLOTS);
  if (CARROCERIAS_CON_PUERTAS_TRASERAS.has(carroceria)) {
    for (const slot of REAR_DOOR_SLOTS) set.add(slot);
  }
  return SLOT_ORDER.filter((slot) => set.has(slot));
}

export function isSlotValidFor(carroceria: Carroceria, slot: SlotCode): boolean {
  return requiredSlots(carroceria).includes(slot);
}

export function progress(
  carroceria: Carroceria,
  filled: readonly SlotCode[],
): { completadas: number; requeridas: number; completa: boolean } {
  const required = requiredSlots(carroceria);
  const filledSet = new Set(filled);
  const completadas = required.filter((slot) => filledSet.has(slot)).length;
  return { completadas, requeridas: required.length, completa: completadas === required.length };
}

/** Estado derivado de la inspección a partir de los slots con foto. Sólo informativo. */
export function derivedEstado(
  carroceria: Carroceria,
  filled: readonly SlotCode[],
): "EN_PROGRESO" | "COMPLETADA" {
  return progress(carroceria, filled).completa ? "COMPLETADA" : "EN_PROGRESO";
}
