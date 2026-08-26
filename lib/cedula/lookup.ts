import "server-only";

export type CedulaData = {
  nombre?: string;
  genero?: "HOMBRE" | "MUJER";
  fechaNacimiento?: string;
  estadoCivil?: string;
  direccion?: string;
};

export type CedulaLookup =
  | { ok: true; data: CedulaData }
  | { ok: false; reason: "not-found" | "error" };

const ESTADO_CIVIL_MAP: Record<string, string> = {
  SOLTERO: "SOLTERO",
  SOLTERA: "SOLTERO",
  CASADO: "CASADO",
  CASADA: "CASADO",
  DIVORCIADO: "DIVORCIADO",
  DIVORCIADA: "DIVORCIADO",
  VIUDO: "VIUDO",
  VIUDA: "VIUDO",
  "UNION LIBRE": "UNION_DE_HECHO",
  "UNION DE HECHO": "UNION_DE_HECHO",
};

function normalizeGenero(raw: unknown): "HOMBRE" | "MUJER" | undefined {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return value === "HOMBRE" || value === "MUJER" ? value : undefined;
}

function normalizeEstadoCivil(raw: unknown): string | undefined {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return ESTADO_CIVIL_MAP[value];
}

function normalizeFechaNacimiento(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function cleanText(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
}

// El API entrega el domicilio en calle + numeración + lugar (provincia/cantón/parroquia).
function normalizeDireccion(data: Record<string, unknown>): string | undefined {
  const calle = cleanText(data.calleDomicilio);
  const numeracion = cleanText(data.numeracionDomicilio);
  const lugar = cleanText(data.lugarDomicilio).replace(/\//g, " / ");
  const numeracionUtil = numeracion && !/^0+$/.test(numeracion) ? numeracion : "";
  const parts = [calle, numeracionUtil, lugar].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

export async function lookupCedula(cedula: string): Promise<CedulaLookup> {
  const baseUrl = process.env.CEDULA_API_URL;
  const apiKey = process.env.CEDULA_API_KEY;
  if (!baseUrl || !apiKey) return { ok: false, reason: "error" };

  const url = new URL(baseUrl);
  url.searchParams.set("Cedula", cedula);
  url.searchParams.set("Apikey", apiKey);

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    return { ok: false, reason: "error" };
  }
  // El API responde 500 cuando la cédula no existe, por eso un !ok se trata como "sin datos".
  if (!response.ok) return { ok: false, reason: "not-found" };

  const data = await response.json().catch(() => null);
  const nombre = typeof data?.nombre === "string" ? data.nombre.trim() : "";
  if (!nombre) return { ok: false, reason: "not-found" };

  return {
    ok: true,
    data: {
      nombre,
      genero: normalizeGenero(data.genero),
      fechaNacimiento: normalizeFechaNacimiento(data.fechaNacimiento),
      estadoCivil: normalizeEstadoCivil(data.estadoCivil),
      direccion: normalizeDireccion(data),
    },
  };
}
