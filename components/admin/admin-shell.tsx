import Link from "next/link";
import { Building2, ChartNoAxesCombined, CreditCard, Database, LogOut, ShieldCheck, UserCog } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { MobileNavigationMenu } from "@/components/internal/mobile-navigation-menu";
import { KuantiqLogo } from "@/components/brand/kuantiq-logo";
import type { AppSession } from "@/lib/auth/session";

const items = [
  { href: "/admin", label: "Resumen", icon: ChartNoAxesCombined },
  { href: "/admin/aseguradoras", label: "Aseguradoras", icon: Building2 },
  { href: "/admin/suscripciones", label: "Suscripciones", icon: CreditCard },
  { href: "/admin/planes", label: "Planes", icon: ShieldCheck },
  { href: "/admin/catalogos", label: "Catálogos", icon: Database },
  { href: "/admin/administradores", label: "Administradores", icon: UserCog },
];

export function AdminShell({ session, children }: { session: AppSession; children: React.ReactNode }) {
  return <div className="internal-background min-h-dvh w-full max-w-full overflow-x-clip text-ink">
    <header className="relative z-30 w-full max-w-full border-b border-line bg-white/85 backdrop-blur-xl lg:hidden"><div className="flex min-h-16 min-w-0 items-center justify-between gap-3 px-4"><Link href="/admin" className="flex min-h-11 min-w-0 items-center gap-2.5 font-bold"><KuantiqLogo className="h-8 w-auto shrink-0" /> <span className="truncate text-xs font-medium text-ink-subtle">Plataforma</span></Link><MobileNavigationMenu label="Abrir menú administrativo"><nav className="fixed inset-x-3 top-[4.5rem] max-h-[calc(100dvh-5.25rem)] overflow-y-auto rounded-2xl border border-brand/25 bg-white/98 p-2 shadow-2xl backdrop-blur-xl">{items.map(({ href,label,icon:Icon }) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-ink/5"><Icon className="size-4 text-brand" />{label}</Link>)}<form action={logout} className="border-t border-line pt-1"><button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-ink/5"><LogOut className="size-4" />Cerrar sesión</button></form></nav></MobileNavigationMenu></div></header>
    <div className="mx-auto grid min-h-dvh max-w-[1600px] lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-white/85 p-5 backdrop-blur-xl lg:flex lg:flex-col"><Link href="/admin" className="block px-2" aria-label="Kuantiq · Plataforma"><KuantiqLogo className="h-11 w-auto" /><small className="mt-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">Plataforma</small></Link><nav className="mt-8 grid gap-1" aria-label="Administración de plataforma">{items.map(({ href,label,icon:Icon }) => <Link key={href} href={href} className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"><Icon className="size-[18px] text-brand/80 group-hover:text-brand" />{label}</Link>)}</nav><div className="mt-auto border-t border-line pt-4"><p className="truncate px-3 text-sm font-semibold">{session.name}</p><p className="mt-1 truncate px-3 text-xs text-ink-subtle">Administrador de plataforma</p><form action={logout}><button className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-muted hover:bg-ink/5 hover:text-ink"><LogOut className="size-4" />Cerrar sesión</button></form></div></aside>
      <div className="min-w-0 max-w-full overflow-x-clip">{children}</div>
    </div>
  </div>;
}
