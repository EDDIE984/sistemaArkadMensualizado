import { z } from "zod";

/** Reglas del cliente asistido por canal (alta manual y carga masiva). */
export const clientSchema = z.object({
  name: z.string().trim().min(3).max(160),
  identification: z.string().trim().regex(/^\d{10}(\d{3})?$/, "Ingresa una cédula de 10 dígitos o RUC de 13."),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(20),
  cityId: z.string().uuid(),
  birthDate: z.string().date(),
  gender: z.enum(["HOMBRE", "MUJER"]),
  maritalStatus: z.string().trim().min(2).max(50),
  address: z.string().trim().max(300).optional(),
});

export const MARITAL_STATUSES = ["SOLTERO", "CASADO", "DIVORCIADO", "VIUDO", "UNION_DE_HECHO"] as const;
export const VEHICLE_STATUSES = ["NUEVO", "USADO"] as const;
export const VEHICLE_USES = ["PARTICULAR", "COMERCIAL", "CORPORATIVO"] as const;

/** Fecha `YYYY-MM-DD` en la zona horaria de Ecuador. */
export function dateOnly(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Rango permitido para el inicio de vigencia de una orden asistida: hoy … +90 días. */
export function startDateRange() {
  return { min: dateOnly(new Date()), max: dateOnly(new Date(Date.now() + 90 * 86400000)) };
}

/** Fila de la carga masiva ya normalizada (textos recortados, fechas `YYYY-MM-DD`). */
export const bulkRowSchema = z.object({
  name: z.string().trim().min(3, "Nombre: mínimo 3 caracteres.").max(160),
  identification: z.string().trim().regex(/^\d{10}(\d{3})?$/, "Cédula/RUC: 10 o 13 dígitos."),
  email: z.string().trim().toLowerCase().email("Correo inválido."),
  phone: z.string().trim().min(7, "Teléfono: mínimo 7 caracteres.").max(20),
  city: z.string().trim().min(1, "Ciudad obligatoria."),
  birthDate: z.string().date("Fecha de nacimiento inválida."),
  gender: z.enum(["HOMBRE", "MUJER"], { error: "Género: HOMBRE o MUJER." }),
  maritalStatus: z.enum(MARITAL_STATUSES, { error: `Estado civil: ${MARITAL_STATUSES.join(", ")}.` }),
  address: z.string().trim().max(300).optional(),
  vehicleType: z.string().trim().min(1, "Tipo de vehículo obligatorio."),
  brand: z.string().trim().min(1, "Marca obligatoria.").max(80),
  model: z.string().trim().min(1, "Modelo obligatorio.").max(80),
  year: z.coerce.number({ error: "Año inválido." }).int("Año inválido.").min(1950, "Año inválido.").max(new Date().getFullYear() + 1, "Año inválido."),
  color: z.string().trim().min(1, "Color obligatorio.").max(50),
  insuredValue: z.coerce.number({ error: "Valor asegurado inválido." }).positive("Valor asegurado inválido.").max(5_000_000, "Valor asegurado excede el máximo."),
  vehicleStatus: z.enum(VEHICLE_STATUSES, { error: "Estado: NUEVO o USADO." }),
  use: z.enum(VEHICLE_USES, { error: `Uso: ${VEHICLE_USES.join(", ")}.` }),
  plate: z.string().trim().max(15, "Placa: máximo 15 caracteres.").optional(),
  durationYears: z.coerce.number({ error: "Años de vigencia: 1 a 5." }).int("Años de vigencia: 1 a 5.").min(1, "Años de vigencia: 1 a 5.").max(5, "Años de vigencia: 1 a 5."),
  startDate: z.string().date("Fecha de inicio de vigencia inválida."),
});
export type BulkRow = z.infer<typeof bulkRowSchema>;
