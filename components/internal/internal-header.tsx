import Link from "next/link";
import { FileText, LogOut, Menu, Plus, ShieldCheck, UserRound } from "lucide-react";
import { logout } from "@/app/actions/auth";
import type { AppSession } from "@/lib/auth/session";

export function InternalHeader({ session }: { session: AppSession }) {
  return (
    <header className="relative z-20 border-b border-white/10 bg-[#061323]/55 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
        <Link href="/mi-cuenta" className="flex min-h-11 items-center gap-2.5 font-bold text-white">
          <ShieldCheck className="size-5 text-cyan-200" aria-hidden="true" /> Arkad
        </Link>
        <nav className="hidden items-center gap-2 md:flex" aria-label="Navegación de cuenta">
          <Link href="/mi-cuenta" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white">Resumen</Link>
          {session.actorType === "CLIENTE" && <Link href="/mi-cuenta/cotizaciones/nueva" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white"><Plus className="size-4" /> Cotizar</Link>}
          {session.actorType === "CLIENTE" && <Link href="/mi-cuenta/cotizaciones" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white">Mis cotizaciones</Link>}
          <Link href="/mi-cuenta/perfil" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white">Mi perfil</Link>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <span className="max-w-48 truncate text-sm text-white/65">{session.name}</span>
          <form action={logout}>
            <button type="submit" className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/12" aria-label="Cerrar sesión">
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
        <details className="shrink-0 md:hidden">
          <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-white/15 bg-white/5 text-white" aria-label="Abrir menú">
            <Menu className="size-5" aria-hidden="true" />
          </summary>
          <div className="fixed inset-x-3 top-[4.5rem] max-h-[calc(100dvh-5.25rem)] overflow-y-auto rounded-2xl border border-cyan-100/15 bg-[#071426]/95 p-2 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3 text-sm text-white/70"><UserRound className="size-4" /> <span className="truncate">{session.name}</span></div>
            <Link href="/mi-cuenta" className="mt-1 flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-white hover:bg-white/10">Resumen</Link>
            {session.actorType === "CLIENTE" && <Link href="/mi-cuenta/cotizaciones/nueva" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white hover:bg-white/10"><Plus className="size-4" /> Nueva cotización</Link>}
            {session.actorType === "CLIENTE" && <Link href="/mi-cuenta/cotizaciones" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white hover:bg-white/10"><FileText className="size-4" /> Mis cotizaciones</Link>}
            <Link href="/mi-cuenta/perfil" className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-white hover:bg-white/10">Mi perfil</Link>
            <form action={logout}>
              <button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white hover:bg-white/10"><LogOut className="size-4" /> Cerrar sesión</button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
