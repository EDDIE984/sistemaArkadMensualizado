import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Link2Off } from "lucide-react";
import { ActivationForm } from "@/components/auth/activation-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashOpaqueToken } from "@/lib/auth/crypto";

export const metadata: Metadata = {
  title: "Activar cuenta | Confia",
  description: "Confirma tu correo y crea la contraseña de acceso a Confia.",
  robots: { index: false, follow: false },
};

export default async function ActivationPage({ searchParams }: PageProps<"/activar-cuenta">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const valid = await isValidToken(token);

  return (
    <main className="internal-background relative flex min-h-dvh items-center justify-center overflow-x-hidden px-4 py-8 text-white sm:px-8">
      <div className="w-full max-w-[460px] rounded-[26px] border border-white/25 bg-[#071426]/72 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8">
        <div className="flex size-14 items-center justify-center rounded-[18px] border border-cyan-200/25 bg-cyan-200/10 text-cyan-100">
          {valid ? <KeyRound className="size-7" aria-hidden="true" /> : <Link2Off className="size-7" aria-hidden="true" />}
        </div>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">Confia</p>
        <h1 className="mt-2 text-[32px] font-bold tracking-[-0.035em]">
          {valid ? "Crea tu contraseña" : "Enlace no disponible"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/65">
          {valid
            ? "Tu correo fue validado. Define una contraseña para finalizar el registro."
            : "El enlace expiró, ya fue utilizado o no es válido. Inicia nuevamente el registro para recibir uno nuevo."}
        </p>
        {valid ? (
          <ActivationForm token={token} />
        ) : (
          <Link href="/login" className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#071426] hover:opacity-90">
            Volver al login
          </Link>
        )}
      </div>
    </main>
  );
}

async function isValidToken(token: string) {
  if (token.length < 32) return false;
  const { data, error } = await createAdminClient()
    .from("token_activacion")
    .select("id")
    .eq("token_hash", hashOpaqueToken(token))
    .is("usado_en", null)
    .gt("expira_en", new Date().toISOString())
    .maybeSingle();
  return !error && Boolean(data);
}
