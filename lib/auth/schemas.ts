import { z } from "zod";

export const registrationSchema = z.object({
  name: z.string().trim().min(2, "Ingresa al menos 2 caracteres.").max(120, "El nombre es demasiado largo."),
  email: z.string().trim().toLowerCase().email("Ingresa un correo válido.").max(254),
  website: z.string().max(0, "Solicitud inválida."),
});

export const activationSchema = z
  .object({
    token: z.string().min(32),
    password: z.string().min(10, "Usa al menos 10 caracteres.").max(128, "La contraseña es demasiado larga."),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresa un correo válido."),
  password: z.string().min(1, "Ingresa tu contraseña.").max(128),
});

export const passwordRecoveryRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresa un correo válido.").max(254),
  website: z.string().max(0, "Solicitud inválida."),
});

export const passwordResetSchema = z
  .object({
    token: z.string().min(32),
    password: z.string().min(10, "Usa al menos 10 caracteres.").max(128, "La contraseña es demasiado larga."),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"],
  });
