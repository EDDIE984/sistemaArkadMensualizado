import "server-only";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPrivateValue } from "@/lib/auth/crypto";

export async function getRequestIdentity(email?: string) {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || requestHeaders.get("x-real-ip") || "unknown";
  return {
    ipHash: hashPrivateValue(ip),
    emailHash: email ? hashPrivateValue(email.toLowerCase()) : null,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 500) || null,
  };
}

export async function isRateLimited({
  action,
  ipHash,
  emailHash,
  ipLimit,
  emailLimit,
  windowMinutes = 15,
}: {
  action: "REGISTRO" | "LOGIN" | "REENVIO_ACTIVACION" | "RECUPERACION_CONTRASENA";
  ipHash: string;
  emailHash: string | null;
  ipLimit: number;
  emailLimit: number;
  windowMinutes?: number;
}) {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const ipQuery = supabase
    .from("intento_autenticacion")
    .select("id", { count: "exact", head: true })
    .eq("accion", action)
    .eq("ip_hash", ipHash)
    .gte("creado_en", since);

  const emailQuery = emailHash
    ? supabase
        .from("intento_autenticacion")
        .select("id", { count: "exact", head: true })
        .eq("accion", action)
        .eq("email_hash", emailHash)
        .gte("creado_en", since)
    : Promise.resolve({ count: 0, error: null });

  const [ipResult, emailResult] = await Promise.all([ipQuery, emailQuery]);
  if (ipResult.error || emailResult.error) throw ipResult.error || emailResult.error;
  return (ipResult.count || 0) >= ipLimit || (emailResult.count || 0) >= emailLimit;
}

export async function recordAuthAttempt({
  action,
  ipHash,
  emailHash,
  success,
}: {
  action: "REGISTRO" | "LOGIN" | "REENVIO_ACTIVACION" | "RECUPERACION_CONTRASENA";
  ipHash: string;
  emailHash: string | null;
  success: boolean;
}) {
  const { error } = await createAdminClient().from("intento_autenticacion").insert({
    accion: action,
    ip_hash: ipHash,
    email_hash: emailHash,
    exitoso: success,
  });
  if (error) throw error;
}
