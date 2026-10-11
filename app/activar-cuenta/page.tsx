import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Link2Off } from "lucide-react";
import { ActivationForm } from "@/components/auth/activation-form";
import { KuantixLogo } from "@/components/brand/kuantix-logo";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashOpaqueToken } from "@/lib/auth/crypto";

export const metadata: Metadata = {
  title: "Activar cuenta | Kuantix",
  description: "Confirma tu correo y crea la contraseña de acceso a Kuantix.",
  robots: { index: false, follow: false },
};

export default async function ActivationPage({ searchParams }: PageProps<"/activar-cuenta">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const valid = await isValidToken(token);

  return (
    <main className="internal-background relative flex min-h-dvh items-center justify-center overflow-x-hidden px-4 py-8 text-ink sm:px-8">
      <div className="w-full max-w-[460px] rounded-[26px] border border-ink/15 bg-white/90 p-6 shadow-[0_24px_70px_rgba(23,50,80,0.12)] backdrop-blur-md sm:p-8">
        <div className="flex size-14 items-center justify-center rounded-[18px] border border-brand/25 bg-brand/10 text-brand">
          {valid ? <KeyRound className="size-7" aria-hidden="true" /> : <Link2Off className="size-7" aria-hidden="true" />}
        </div>
        <KuantixLogo className="mt-6 h-8 w-auto" />
        <h1 className="mt-2 text-[32px] font-bold tracking-[-0.035em]">
          {valid ? "Crea tu contraseña" : "Enlace no disponible"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {valid
            ? "Tu correo fue validado. Define una contraseña para finalizar el registro."
            : "El enlace expiró, ya fue utilizado o no es válido. Inicia nuevamente el registro para recibir uno nuevo."}
        </p>
        {valid ? (
          <ActivationForm token={token} />
        ) : (
          <Link href="/login" className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white hover:opacity-90">
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
