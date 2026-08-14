import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Link2Off } from "lucide-react";
import { PasswordResetForm } from "@/components/auth/password-reset-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashOpaqueToken } from "@/lib/auth/crypto";

export const metadata: Metadata = { title: "Restablecer contraseña | Confia", robots: { index: false, follow: false } };

export default async function PasswordResetPage({ searchParams }: PageProps<"/restablecer-contrasena">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const valid = await isValidToken(token);
  return <main className="internal-background relative flex min-h-dvh items-center justify-center overflow-x-hidden px-4 py-8 text-white sm:px-8"><div className="w-full max-w-[460px] rounded-[26px] border border-white/25 bg-[#071426]/72 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8">
    <div className="flex size-14 items-center justify-center rounded-[18px] border border-cyan-200/25 bg-cyan-200/10 text-cyan-100">{valid ? <KeyRound className="size-7" /> : <Link2Off className="size-7" />}</div>
    <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">Acceso seguro</p>
    <h1 className="mt-2 text-[32px] font-bold tracking-[-0.035em]">{valid ? "Crea una nueva contraseña" : "Enlace no disponible"}</h1>
    <p className="mt-2 text-sm leading-6 text-white/65">{valid ? "Define una contraseña nueva para recuperar el acceso a tu cuenta." : "El enlace expiró, ya fue utilizado o no es válido. Solicita uno nuevo desde el inicio de sesión."}</p>
    {valid ? <PasswordResetForm token={token} /> : <Link href="/recuperar-contrasena" className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#071426] hover:opacity-90">Solicitar otro enlace</Link>}
  </div></main>;
}

async function isValidToken(token: string) {
  if (token.length < 32) return false;
  const { data, error } = await createAdminClient().from("token_recuperacion_contrasena").select("id").eq("token_hash", hashOpaqueToken(token)).is("usado_en", null).gt("expira_en", new Date().toISOString()).maybeSingle();
  return !error && Boolean(data);
}
