"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthActionState } from "@/lib/auth/action-state";

const profileSchema = z.object({
  identification: z.string().trim().regex(/^\d{10}(\d{3})?$/, "Ingresa una cédula de 10 dígitos o un RUC de 13 dígitos."),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, "Ingresa un teléfono válido."),
  cityId: z.string().uuid("Selecciona una ciudad."),
  birthDate: z.string().date("Ingresa una fecha válida."),
  gender: z.enum(["HOMBRE", "MUJER"], { message: "Selecciona una opción." }),
  maritalStatus: z.string().trim().min(2, "Selecciona tu estado civil.").max(40),
  address: z.string().trim().max(250, "La dirección es demasiado larga.").optional(),
});

export async function updateClientProfile(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const session = await requireSession();
  if (session.actorType !== "CLIENTE") return { status: "error", message: "Esta cuenta no corresponde a un cliente." };

  const parsed = profileSchema.safeParse({
    identification: formData.get("identification"),
    phone: formData.get("phone"),
    cityId: formData.get("cityId"),
    birthDate: formData.get("birthDate"),
    gender: formData.get("gender"),
    maritalStatus: formData.get("maritalStatus"),
    address: formData.get("address") || "",
  });
  if (!parsed.success) {
    return { status: "error", message: "Revisa los campos indicados.", fields: parsed.error.flatten().fieldErrors };
  }

  const birthDate = new Date(`${parsed.data.birthDate}T12:00:00Z`);
  if (birthDate > new Date() || birthDate.getUTCFullYear() < 1900) {
    return { status: "error", message: "La fecha de nacimiento no es válida.", fields: { birthDate: ["Revisa la fecha ingresada."] } };
  }

  const { error } = await createAdminClient()
    .from("cliente")
    .update({
      identificacion: parsed.data.identification,
      telefono: parsed.data.phone,
      ciudad_id: parsed.data.cityId,
      fecha_nacimiento: parsed.data.birthDate,
      genero: parsed.data.gender,
      estado_civil: parsed.data.maritalStatus,
      direccion: parsed.data.address || null,
    })
    .eq("id", session.actorId);

  if (error) {
    const duplicate = error.code === "23505";
    return {
      status: "error",
      message: duplicate ? "La identificación ya está asociada a otra cuenta." : "No pudimos guardar tu perfil. Inténtalo nuevamente.",
      fields: duplicate ? { identification: ["Esta identificación ya está registrada."] } : undefined,
    };
  }
  redirect("/mi-cuenta/cotizaciones/nueva?profile=completed");
}
