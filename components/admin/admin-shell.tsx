import Link from "next/link";
import { Building2, ChartNoAxesCombined, CreditCard, Database, LogOut, ShieldCheck, UserCog } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { MobileNavigationMenu } from "@/components/internal/mobile-navigation-menu";
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
  return <div className="internal-background min-h-dvh w-full max-w-full overflow-x-clip text-white">
    <header className="relative z-30 w-full max-w-full border-b border-white/10 bg-[#061323]/72 backdrop-blur-xl lg:hidden"><div className="flex min-h-16 min-w-0 items-center justify-between gap-3 px-4"><Link href="/admin" className="flex min-h-11 min-w-0 items-center gap-2.5 font-bold"><ShieldCheck className="size-5 shrink-0 text-cyan-200" /> <span className="shrink-0">Arkad</span> <span className="truncate text-xs font-medium text-white/45">Plataforma</span></Link><MobileNavigationMenu label="Abrir menú administrativo"><nav className="fixed inset-x-3 top-[4.5rem] max-h-[calc(100dvh-5.25rem)] overflow-y-auto rounded-2xl border border-cyan-100/15 bg-[#071426]/98 p-2 shadow-2xl backdrop-blur-xl">{items.map(({ href,label,icon:Icon }) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-white/10"><Icon className="size-4 text-cyan-100" />{label}</Link>)}<form action={logout} className="border-t border-white/10 pt-1"><button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-white/10"><LogOut className="size-4" />Cerrar sesión</button></form></nav></MobileNavigationMenu></div></header>
    <div className="mx-auto grid min-h-dvh max-w-[1600px] lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-white/10 bg-[#061323]/72 p-5 backdrop-blur-xl lg:flex lg:flex-col"><Link href="/admin" className="flex min-h-12 items-center gap-3 px-2 text-lg font-bold"><span className="flex size-9 items-center justify-center rounded-xl bg-cyan-100/10 text-cyan-100"><ShieldCheck className="size-5" /></span><span>Arkad<small className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/38">Plataforma</small></span></Link><nav className="mt-8 grid gap-1" aria-label="Administración de plataforma">{items.map(({ href,label,icon:Icon }) => <Link key={href} href={href} className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/64 transition-colors hover:bg-white/9 hover:text-white"><Icon className="size-[18px] text-cyan-100/65 group-hover:text-cyan-100" />{label}</Link>)}</nav><div className="mt-auto border-t border-white/10 pt-4"><p className="truncate px-3 text-sm font-semibold">{session.name}</p><p className="mt-1 truncate px-3 text-xs text-white/40">Administrador de plataforma</p><form action={logout}><button className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/60 hover:bg-white/9 hover:text-white"><LogOut className="size-4" />Cerrar sesión</button></form></div></aside>
      <div className="min-w-0 max-w-full overflow-x-clip">{children}</div>
    </div>
  </div>;
}
