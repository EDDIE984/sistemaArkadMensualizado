import Link from "next/link";
import { FileText, LogOut, Plus, UserRound } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { MobileNavigationMenu } from "@/components/internal/mobile-navigation-menu";
import { KuantiqLogo } from "@/components/brand/kuantiq-logo";
import type { AppSession } from "@/lib/auth/session";

export function InternalHeader({ session }: { session: AppSession }) {
  return (
    <header className="relative z-20 border-b border-line bg-surface-muted backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
        <Link href="/mi-cuenta" className="flex min-h-11 items-center gap-2.5 font-bold text-ink">
          <KuantiqLogo className="h-9 w-auto" />
        </Link>
        <nav className="hidden items-center gap-2 md:flex" aria-label="Navegación de cuenta">
          <Link href="/mi-cuenta" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/5 hover:text-ink">Resumen</Link>
          {session.actorType === "CLIENTE" && <Link href="/mi-cuenta/cotizaciones/nueva" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/5 hover:text-ink"><Plus className="size-4" /> Cotizar</Link>}
          {session.actorType === "CLIENTE" && <Link href="/mi-cuenta/cotizaciones" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/5 hover:text-ink">Mis cotizaciones</Link>}
          <Link href="/mi-cuenta/perfil" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/5 hover:text-ink">Mi perfil</Link>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <span className="max-w-48 truncate text-sm text-ink-muted">{session.name}</span>
          <form action={logout}>
            <button type="submit" className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface-muted text-ink transition-colors hover:bg-ink/5" aria-label="Cerrar sesión">
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
        <div className="md:hidden">
          <MobileNavigationMenu label="Abrir menú de cuenta">
          <div className="fixed inset-x-3 top-[4.5rem] max-h-[calc(100dvh-5.25rem)] overflow-y-auto rounded-2xl border border-brand/25 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-line px-3 py-3 text-sm text-ink/80"><UserRound className="size-4" /> <span className="truncate">{session.name}</span></div>
            <Link href="/mi-cuenta" className="mt-1 flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-ink hover:bg-ink/5">Resumen</Link>
            {session.actorType === "CLIENTE" && <Link href="/mi-cuenta/cotizaciones/nueva" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-ink/5"><Plus className="size-4" /> Nueva cotización</Link>}
            {session.actorType === "CLIENTE" && <Link href="/mi-cuenta/cotizaciones" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-ink/5"><FileText className="size-4" /> Mis cotizaciones</Link>}
            <Link href="/mi-cuenta/perfil" className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-ink hover:bg-ink/5">Mi perfil</Link>
            <form action={logout}>
              <button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-ink/5"><LogOut className="size-4" /> Cerrar sesión</button>
            </form>
          </div>
          </MobileNavigationMenu>
        </div>
      </div>
    </header>
  );
}
