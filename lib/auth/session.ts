import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/auth/crypto";

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-confia_session" : "confia_session";

export type AppSession = {
  id: string;
  actorType: "CLIENTE" | "USUARIO";
  actorId: string;
  name: string;
  email: string;
  profileCode: string | null;
  insurerId: string | null;
  channelId: string | null;
};

export function sessionHome(session: AppSession) {
  if (session.actorType === "CLIENTE") return "/mi-cuenta";
  if (session.profileCode === "ADMIN_PLATAFORMA") return "/admin";
  if (session.profileCode === "ADMIN_ASEGURADORA") return "/aseguradora";
  if (session.profileCode === "USUARIO_CANAL") return "/canal";
  return "/mi-cuenta";
}

export async function createSession({
  actorType,
  actorId,
  ipHash,
  userAgent,
  remember,
}: {
  actorType: "CLIENTE" | "USUARIO";
  actorId: string;
  ipHash: string;
  userAgent: string | null;
  remember: boolean;
}) {
  const rawToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const configuredDays = Number(process.env.AUTH_SESSION_DAYS || 7);
  const durationMs = (remember ? configuredDays : 1) * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + durationMs);
  const { error } = await createAdminClient().from("sesion_autenticacion").insert({
    token_hash: tokenHash,
    tipo_actor: actorType,
    cliente_id: actorType === "CLIENTE" ? actorId : null,
    usuario_id: actorType === "USUARIO" ? actorId : null,
    expira_en: expiresAt.toISOString(),
    ip_hash: ipHash,
    user_agent: userAgent,
  });
  if (error) throw error;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: remember ? expiresAt : undefined,
  });
}

export async function getSession(): Promise<AppSession | null> {
  const rawToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const supabase = createAdminClient();
  const { data: session, error } = await supabase
    .from("sesion_autenticacion")
    .select("id,tipo_actor,cliente_id,usuario_id,expira_en,revocado_en")
    .eq("token_hash", hashOpaqueToken(rawToken))
    .is("revocado_en", null)
    .gt("expira_en", new Date().toISOString())
    .maybeSingle();

  if (error || !session) return null;

  if (session.tipo_actor === "CLIENTE" && session.cliente_id) {
    const { data: client } = await supabase
      .from("cliente")
      .select("id,nombre_razon_social,email,activo,estado_registro")
      .eq("id", session.cliente_id)
      .eq("activo", true)
      .eq("estado_registro", "ACTIVO")
      .maybeSingle();
    if (!client) return null;
    return {
      id: session.id,
      actorType: "CLIENTE",
      actorId: client.id,
      name: client.nombre_razon_social,
      email: client.email,
      profileCode: null,
      insurerId: null,
      channelId: null,
    };
  }

  if (session.tipo_actor === "USUARIO" && session.usuario_id) {
    const { data: user } = await supabase
      .from("usuario")
      .select("id,nombre,email,activo,aseguradora_id,canal_id,perfil(codigo)")
      .eq("id", session.usuario_id)
      .eq("activo", true)
      .maybeSingle();
    if (!user) return null;
    const profile = Array.isArray(user.perfil) ? user.perfil[0] : user.perfil;
    return {
      id: session.id,
      actorType: "USUARIO",
      actorId: user.id,
      name: user.nombre,
      email: user.email,
      profileCode: profile?.codigo || null,
      insurerId: user.aseguradora_id,
      channelId: user.canal_id,
    };
  }

  return null;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requirePlatformAdmin() {
  const session = await requireSession();
  if (session.actorType !== "USUARIO" || session.profileCode !== "ADMIN_PLATAFORMA") {
    redirect(session.actorType === "CLIENTE" ? "/mi-cuenta" : "/login");
  }
  return session;
}

export async function requireInsurerAdmin() {
  const session = await requireSession();
  if (
    session.actorType !== "USUARIO" ||
    session.profileCode !== "ADMIN_ASEGURADORA" ||
    !session.insurerId
  ) {
    redirect(session.actorType === "CLIENTE" ? "/mi-cuenta" : session.profileCode === "ADMIN_PLATAFORMA" ? "/admin" : "/login");
  }
  return session;
}

export async function requireChannelUser() {
  const session = await requireSession();
  if (
    session.actorType !== "USUARIO" ||
    session.profileCode !== "USUARIO_CANAL" ||
    !session.insurerId ||
    !session.channelId
  ) {
    redirect(session.actorType === "CLIENTE" ? "/mi-cuenta" : session.profileCode === "ADMIN_PLATAFORMA" ? "/admin" : session.profileCode === "ADMIN_ASEGURADORA" ? "/aseguradora" : "/login");
  }
  return session;
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    await createAdminClient()
      .from("sesion_autenticacion")
      .update({ revocado_en: new Date().toISOString() })
      .eq("token_hash", hashOpaqueToken(rawToken));
  }
  cookieStore.delete(SESSION_COOKIE);
}
