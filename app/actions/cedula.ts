"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupCedula, type CedulaData } from "@/lib/cedula/lookup";

export type CedulaLookupResult =
  | ({ status: "found"; source: "db" | "external" } & CedulaData)
  | { status: "not-found" }
  | { status: "error" };

const cedulaSchema = z.string().regex(/^\d{10}$/);

// Acepta cédula (10 dígitos) o RUC (13 dígitos, cédula + 001); en RUC usamos los primeros 10.
function normalizeCedula(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const cedula = digits.length === 13 ? digits.slice(0, 10) : digits;
  return cedulaSchema.safeParse(cedula).success ? cedula : null;
}

export async function consultarCedula(cedula: string): Promise<CedulaLookupResult> {
  await requireSession();
  const normalized = normalizeCedula(cedula);
  if (!normalized) return { status: "not-found" };

  const db = createAdminClient();
  const { data: existing } = await db
    .from("cliente")
    .select("nombre_razon_social,genero,fecha_nacimiento,estado_civil,direccion")
    .eq("identificacion", normalized)
    .maybeSingle();

  if (existing) {
    return {
      status: "found",
      source: "db",
      nombre: existing.nombre_razon_social ?? undefined,
      genero: existing.genero === "HOMBRE" || existing.genero === "MUJER" ? existing.genero : undefined,
      fechaNacimiento: existing.fecha_nacimiento ?? undefined,
      estadoCivil: existing.estado_civil ?? undefined,
      direccion: existing.direccion ?? undefined,
    };
  }

  const external = await lookupCedula(normalized);
  if (!external.ok) return { status: external.reason };
  return { status: "found", source: "external", ...external.data };
}
