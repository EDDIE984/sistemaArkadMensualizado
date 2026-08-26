// Taxonomía de daños y etiquetas para UI, compartida por el pipeline de análisis
// (server) y el panel de revisión del inspector (client). Sin `server-only`: son
// datos puros reutilizables en ambos lados.

export const DANO_TIPOS = [
  "RAYON",
  "ABOLLADURA",
  "HUNDIMIENTO",
  "FISURA",
  "PIEZA_ROTA",
  "PIEZA_FALTANTE",
  "DESALINEACION",
  "CRISTAL_ROTO",
  "PINTURA_SALTADA",
  "CORROSION",
  "LLANTA",
  "OTRO",
] as const;
export const SEVERIDADES = ["LEVE", "MODERADA", "GRAVE"] as const;
export const ACCIONES = ["PULIR", "PINTAR", "REPARAR", "REEMPLAZAR", "REVISAR"] as const;

export type DanoTipo = (typeof DANO_TIPOS)[number];
export type Severidad = (typeof SEVERIDADES)[number];
export type AccionRecomendada = (typeof ACCIONES)[number];

export const TIPO_LABEL: Record<DanoTipo, string> = {
  RAYON: "Rayón",
  ABOLLADURA: "Abolladura",
  HUNDIMIENTO: "Hundimiento",
  FISURA: "Fisura",
  PIEZA_ROTA: "Pieza rota",
  PIEZA_FALTANTE: "Pieza faltante",
  DESALINEACION: "Desalineación",
  CRISTAL_ROTO: "Cristal roto",
  PINTURA_SALTADA: "Pintura saltada",
  CORROSION: "Corrosión",
  LLANTA: "Llanta",
  OTRO: "Otro",
};

export const SEVERIDAD_LABEL: Record<Severidad, string> = {
  LEVE: "Leve",
  MODERADA: "Moderada",
  GRAVE: "Grave",
};

export const ACCION_LABEL: Record<AccionRecomendada, string> = {
  PULIR: "Pulir",
  PINTAR: "Pintar",
  REPARAR: "Reparar",
  REEMPLAZAR: "Reemplazar pieza",
  REVISAR: "Revisar",
};

export const SEV_COLOR: Record<Severidad, string> = {
  LEVE: "#22c55e",
  MODERADA: "#f59e0b",
  GRAVE: "#ef4444",
};

export const SEV_RANK: Record<Severidad, number> = { LEVE: 1, MODERADA: 2, GRAVE: 3 };

export function worstSeverity(list: readonly (Severidad | null)[]): Severidad | null {
  let worst: Severidad | null = null;
  for (const s of list) {
    if (s && (!worst || SEV_RANK[s] > SEV_RANK[worst])) worst = s;
  }
  return worst;
}

/** Gravedad efectiva de un daño: el override del técnico si existe, si no la de la IA. */
export function severidadEfectiva(d: {
  severidad: Severidad;
  severidad_revisada?: Severidad | null;
}): Severidad {
  return d.severidad_revisada ?? d.severidad;
}

export function isSeveridad(value: unknown): value is Severidad {
  return typeof value === "string" && (SEVERIDADES as readonly string[]).includes(value);
}
