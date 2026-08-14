"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createSelfServiceQuote, QuoteConfigurationError } from "@/lib/quotes/create-quote";
import type { QuoteActionState } from "@/lib/quotes/types";

const quoteSchema = z.object({
  productId: z.string().uuid("Selecciona un producto."),
  vehicleMode: z.enum(["new", "existing"]),
  existingVehicleId: z.string().uuid().optional().or(z.literal("")),
  vehicleTypeId: z.string().uuid().optional().or(z.literal("")),
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1).optional(),
  color: z.string().trim().max(50).optional(),
  insuredValue: z.coerce.number().positive().max(5_000_000).optional(),
  vehicleStatus: z.enum(["NUEVO", "USADO"]).optional(),
  use: z.enum(["COMERCIAL", "PARTICULAR", "CORPORATIVO"]).optional(),
  plate: z.string().trim().max(15).optional(),
  durationYears: z.coerce.number().int().min(1).max(5),
  coverageIds: z.array(z.string().uuid()).min(1, "Selecciona al menos una cobertura."),
}).superRefine((data, context) => {
  if (data.vehicleMode === "existing" && !data.existingVehicleId) {
    context.addIssue({ code: "custom", path: ["existingVehicleId"], message: "Selecciona un vehículo." });
  }
  if (data.vehicleMode === "new") {
    const required: Array<keyof typeof data> = ["vehicleTypeId", "brand", "model", "year", "color", "insuredValue", "vehicleStatus", "use"];
    for (const field of required) {
      if (data[field] === undefined || data[field] === "") {
        context.addIssue({ code: "custom", path: [field], message: "Este campo es obligatorio." });
      }
    }
  }
});

export async function createQuoteAction(_: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const session = await requireSession();
  if (session.actorType !== "CLIENTE") return { status: "error", message: "Este flujo es exclusivo para clientes." };

  const parsed = quoteSchema.safeParse({
    productId: formData.get("productId"),
    vehicleMode: formData.get("vehicleMode"),
    existingVehicleId: formData.get("existingVehicleId") || "",
    vehicleTypeId: formData.get("vehicleTypeId") || "",
    brand: formData.get("brand") || "",
    model: formData.get("model") || "",
    year: formData.get("year") || undefined,
    color: formData.get("color") || "",
    insuredValue: formData.get("insuredValue") || undefined,
    vehicleStatus: formData.get("vehicleStatus") || undefined,
    use: formData.get("use") || undefined,
    plate: formData.get("plate") || "",
    durationYears: formData.get("durationYears"),
    coverageIds: formData.getAll("coverageIds"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Revisa los datos indicados para continuar.", fields: parsed.error.flatten().fieldErrors };
  }

  let quoteId: string;
  try {
    quoteId = await createSelfServiceQuote({
      clientId: session.actorId,
      productId: parsed.data.productId,
      existingVehicleId: parsed.data.vehicleMode === "existing" ? parsed.data.existingVehicleId || undefined : undefined,
      vehicleTypeId: parsed.data.vehicleTypeId || undefined,
      brand: parsed.data.brand,
      model: parsed.data.model,
      year: parsed.data.year,
      color: parsed.data.color,
      insuredValue: parsed.data.insuredValue,
      vehicleStatus: parsed.data.vehicleStatus,
      use: parsed.data.use,
      plate: parsed.data.plate,
      durationYears: parsed.data.durationYears,
      coverageIds: [...new Set(parsed.data.coverageIds)],
    });
  } catch (error) {
    console.error("Error al crear cotización", error);
    return {
      status: "error",
      message: error instanceof QuoteConfigurationError
        ? error.message
        : "No pudimos calcular la cotización. No se guardó ningún dato; inténtalo nuevamente.",
    };
  }
  redirect(`/mi-cuenta/cotizaciones/${quoteId}?created=1`);
}
