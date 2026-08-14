"use server";

import { redirect, RedirectType } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { activationSchema, loginSchema, passwordRecoveryRequestSchema, passwordResetSchema, registrationSchema } from "@/lib/auth/schemas";
import { generateOpaqueToken, hashOpaqueToken, hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { sendActivationEmail, sendPasswordResetEmail } from "@/lib/auth/email";
import { createSession, revokeCurrentSession } from "@/lib/auth/session";
import { getRequestIdentity, isRateLimited, recordAuthAttempt } from "@/lib/auth/rate-limit";
import type { AuthActionState } from "@/lib/auth/action-state";
import { verifyRegistrationCaptcha } from "@/lib/auth/captcha";

export async function registerClient(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = registrationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    website: formData.get("website") || "",
  });
  if (!parsed.success) {
    return { status: "error", message: "Revisa los datos ingresados.", fields: parsed.error.flatten().fieldErrors };
  }

  const { name, email } = parsed.data;
  const identity = await getRequestIdentity(email);
  try {
    if (!(await verifyRegistrationCaptcha(formData.get("cf-turnstile-response")))) {
      return { status: "error", message: "No pudimos validar que eres una persona. Completa la verificación e inténtalo de nuevo." };
    }
    if (await isRateLimited({ action: "REGISTRO", ...identity, ipLimit: 10, emailLimit: 3 })) {
      return { status: "error", message: "Has realizado demasiados intentos. Espera unos minutos e inténtalo nuevamente." };
    }

    const supabase = createAdminClient();
    const { data: existingClient } = await supabase.from("cliente").select("id").ilike("email", email).maybeSingle();
    if (existingClient) {
      await recordAuthAttempt({ action: "REGISTRO", ...identity, success: true });
      return registrationSuccess();
    }

    const { data: currentPending } = await supabase
      .from("registro_cliente_pendiente")
      .select("id,ultimo_envio_en")
      .ilike("email", email)
      .eq("estado", "PENDIENTE_CONFIRMACION")
      .maybeSingle();

    if (currentPending) {
      const elapsed = Date.now() - new Date(currentPending.ultimo_envio_en).getTime();
      if (elapsed < 60_000) {
        await recordAuthAttempt({ action: "REGISTRO", ...identity, success: true });
        return registrationSuccess();
      }
      await supabase.from("registro_cliente_pendiente").update({ estado: "CANCELADO" }).eq("id", currentPending.id);
    }

    const rawToken = generateOpaqueToken();
    const activationMinutes = Number(process.env.AUTH_ACTIVATION_MINUTES || 30);
    const expiresAt = new Date(Date.now() + activationMinutes * 60_000).toISOString();
    const { data: pending, error: pendingError } = await supabase
      .from("registro_cliente_pendiente")
      .insert({ nombre: name, email, expira_en: expiresAt })
      .select("id")
      .single();
    if (pendingError) throw pendingError;

    const { error: tokenError } = await supabase.from("token_activacion").insert({
      registro_pendiente_id: pending.id,
      token_hash: hashOpaqueToken(rawToken),
      expira_en: expiresAt,
    });
    if (tokenError) throw tokenError;

    try {
      await sendActivationEmail({ email, name, token: rawToken });
    } catch (error) {
      await supabase.from("registro_cliente_pendiente").update({ estado: "CANCELADO" }).eq("id", pending.id);
      throw error;
    }

    await recordAuthAttempt({ action: "REGISTRO", ...identity, success: true });
    return registrationSuccess();
  } catch (error) {
    console.error("Registration failed", error instanceof Error ? error.message : "Unknown error");
    try {
      await recordAuthAttempt({ action: "REGISTRO", ...identity, success: false });
    } catch {}
    return { status: "error", message: "No pudimos enviar el correo de activación. Inténtalo nuevamente más tarde." };
  }
}

function registrationSuccess(): AuthActionState {
  return {
    status: "success",
    message: "Revisa tu correo. Si la cuenta es nueva, recibirás en unos minutos un enlace para crear tu contraseña. Revisa también la carpeta de spam.",
  };
}

export async function activateClient(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = activationSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Revisa los datos ingresados.", fields: parsed.error.flatten().fieldErrors };
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const { error } = await createAdminClient().rpc("activar_registro_cliente", {
      p_token_hash: hashOpaqueToken(parsed.data.token),
      p_password_hash: passwordHash,
    });
    if (error) throw error;
  } catch (error) {
    console.error("Activation failed", error instanceof Error ? error.message : "Unknown error");
    return { status: "error", message: "El enlace es inválido, expiró o ya fue utilizado. Solicita un nuevo registro." };
  }
  redirect("/login?activated=1");
}

export async function login(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { status: "error", message: "Revisa los datos ingresados.", fields: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;
  const identity = await getRequestIdentity(email);
  let destination = "/mi-cuenta";
  try {
    if (await isRateLimited({ action: "LOGIN", ...identity, ipLimit: 20, emailLimit: 10 })) {
      return { status: "error", message: "Demasiados intentos. Espera 15 minutos antes de volver a intentarlo." };
    }

    const supabase = createAdminClient();
    const { data: client } = await supabase
      .from("cliente")
      .select("id,password_hash,activo,estado_registro,intentos_fallidos,bloqueado_hasta,identificacion,telefono,ciudad_id,fecha_nacimiento,genero,estado_civil")
      .ilike("email", email)
      .maybeSingle();
    const { data: internalUser } = client
      ? { data: null }
      : await supabase
          .from("usuario")
          .select("id,password_hash,activo,intentos_fallidos,bloqueado_hasta,perfil(codigo)")
          .ilike("email", email)
          .maybeSingle();
    const actor = client || internalUser;
    const actorType = client ? "CLIENTE" : "USUARIO";
    const table = client ? "cliente" : "usuario";

    const blocked = actor?.bloqueado_hasta && new Date(actor.bloqueado_hasta).getTime() > Date.now();
    const allowed = actor && actor.activo && (!client || client.estado_registro === "ACTIVO") && !blocked;
    const passwordMatches = allowed ? await verifyPassword(actor.password_hash, password) : false;

    if (!actor || !passwordMatches) {
      if (actor && !blocked) {
        const attempts = (actor.intentos_fallidos || 0) + 1;
        await supabase
          .from(table)
          .update({
            intentos_fallidos: attempts,
            bloqueado_hasta: attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
          })
          .eq("id", actor.id);
      }
      await recordAuthAttempt({ action: "LOGIN", ...identity, success: false });
      return { status: "error", message: "Correo o contraseña incorrectos, o la cuenta no está disponible." };
    }

    await supabase
      .from(table)
      .update({ intentos_fallidos: 0, bloqueado_hasta: null, ultimo_acceso_en: new Date().toISOString() })
      .eq("id", actor.id);
    await createSession({
      actorType,
      actorId: actor.id,
      ipHash: identity.ipHash,
      userAgent: identity.userAgent,
      remember: formData.get("remember") === "on",
    });
    const clientProfileComplete = actorType === "CLIENTE" && client && Boolean(
      client.identificacion && client.telefono && client.ciudad_id && client.fecha_nacimiento && client.genero && client.estado_civil
    );
    const internalProfile = internalUser && (Array.isArray(internalUser.perfil) ? internalUser.perfil[0] : internalUser.perfil);
    destination = actorType === "CLIENTE"
      ? (clientProfileComplete ? "/mi-cuenta/cotizaciones/nueva" : "/mi-cuenta/perfil")
      : internalProfile?.codigo === "ADMIN_PLATAFORMA"
        ? "/admin"
        : internalProfile?.codigo === "ADMIN_ASEGURADORA"
          ? "/aseguradora"
          : internalProfile?.codigo === "USUARIO_CANAL"
            ? "/canal"
            : "/mi-cuenta";
    await recordAuthAttempt({ action: "LOGIN", ...identity, success: true });
  } catch (error) {
    console.error("Login failed", error instanceof Error ? error.message : "Unknown error");
    return { status: "error", message: "No pudimos iniciar sesión en este momento. Inténtalo nuevamente." };
  }
  redirect(destination, RedirectType.replace);
}

export async function logout() {
  await revokeCurrentSession();
  redirect("/login");
}

export async function requestPasswordRecovery(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = passwordRecoveryRequestSchema.safeParse({
    email: formData.get("email"),
    website: formData.get("website") || "",
  });
  if (!parsed.success) {
    return { status: "error", message: "Revisa el correo ingresado.", fields: parsed.error.flatten().fieldErrors };
  }

  const identity = await getRequestIdentity(parsed.data.email);
  const genericSuccess: AuthActionState = {
    status: "success",
    message: "Si el correo está asociado a una cuenta, recibirás un enlace temporal para crear una nueva contraseña. Revisa también la carpeta de spam.",
  };

  try {
    if (!(await verifyRegistrationCaptcha(formData.get("cf-turnstile-response")))) {
      return { status: "error", message: "No pudimos validar que eres una persona. Completa la verificación e inténtalo nuevamente." };
    }
    if (await isRateLimited({
      action: "RECUPERACION_CONTRASENA", ...identity, ipLimit: 8, emailLimit: 3, windowMinutes: 30,
    })) {
      return { status: "error", message: "Has solicitado demasiados enlaces. Espera 30 minutos antes de intentarlo nuevamente." };
    }

    const db = createAdminClient();
    const { data: client } = await db.from("cliente")
      .select("id,nombre_razon_social,email,activo,estado_registro")
      .ilike("email", parsed.data.email).maybeSingle();
    const { data: user } = client ? { data: null } : await db.from("usuario")
      .select("id,nombre,email,activo").ilike("email", parsed.data.email).maybeSingle();
    const activeClient = client?.activo && client.estado_registro === "ACTIVO" ? client : null;
    const activeUser = user?.activo ? user : null;
    const actor = activeClient || activeUser;

    if (actor) {
      const actorType = activeClient ? "CLIENTE" : "USUARIO";
      const rawToken = generateOpaqueToken();
      const expiresAt = new Date(Date.now() + Number(process.env.AUTH_PASSWORD_RESET_MINUTES || 30) * 60_000).toISOString();
      const actorColumn = actorType === "CLIENTE" ? "cliente_id" : "usuario_id";
      await db.from("token_recuperacion_contrasena").update({ usado_en: new Date().toISOString() })
        .eq(actorColumn, actor.id).is("usado_en", null);
      const { data: createdToken, error: tokenError } = await db.from("token_recuperacion_contrasena").insert({
        token_hash: hashOpaqueToken(rawToken),
        tipo_actor: actorType,
        cliente_id: actorType === "CLIENTE" ? actor.id : null,
        usuario_id: actorType === "USUARIO" ? actor.id : null,
        expira_en: expiresAt,
      }).select("id").single();
      if (tokenError) throw tokenError;

      try {
        await sendPasswordResetEmail({
          email: actor.email,
          name: activeClient ? activeClient.nombre_razon_social : activeUser!.nombre,
          token: rawToken,
        });
      } catch (error) {
        await db.from("token_recuperacion_contrasena").update({ usado_en: new Date().toISOString() }).eq("id", createdToken.id);
        throw error;
      }
    }
    await recordAuthAttempt({ action: "RECUPERACION_CONTRASENA", ...identity, success: true });
    return genericSuccess;
  } catch (error) {
    console.error("Password recovery request failed", error instanceof Error ? error.message : "Unknown error");
    try { await recordAuthAttempt({ action: "RECUPERACION_CONTRASENA", ...identity, success: false }); } catch {}
    return genericSuccess;
  }
}

export async function resetPassword(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = passwordResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Revisa los datos ingresados.", fields: parsed.error.flatten().fieldErrors };
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const { error } = await createAdminClient().rpc("restablecer_contrasena", {
      p_token_hash: hashOpaqueToken(parsed.data.token),
      p_password_hash: passwordHash,
    });
    if (error) throw error;
  } catch (error) {
    console.error("Password reset failed", error instanceof Error ? error.message : "Unknown error");
    return { status: "error", message: "El enlace expiró, ya fue utilizado o la cuenta no está disponible. Solicita un enlace nuevo." };
  }
  redirect("/login?passwordReset=1");
}
