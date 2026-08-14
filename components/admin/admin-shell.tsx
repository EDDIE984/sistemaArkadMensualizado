import Link from "next/link";
import { Building2, ChartNoAxesCombined, CreditCard, Database, LogOut, Menu, ShieldCheck, UserCog } from "lucide-react";
import { logout } from "@/app/actions/auth";
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
  return <div className="internal-background min-h-dvh text-white">
    <header className="relative z-30 border-b border-white/10 bg-[#061323]/72 backdrop-blur-xl lg:hidden"><div className="flex min-h-16 items-center justify-between px-4"><Link href="/admin" className="flex min-h-11 items-center gap-2.5 font-bold"><ShieldCheck className="size-5 text-cyan-200" /> Arkad <span className="text-xs font-medium text-white/45">Plataforma</span></Link><details className="relative"><summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-white/15 bg-white/5" aria-label="Abrir menú administrativo"><Menu className="size-5" /></summary><nav className="absolute right-0 top-13 w-72 rounded-2xl border border-white/15 bg-[#071426]/98 p-2 shadow-2xl">{items.map(({ href,label,icon:Icon }) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-white/10"><Icon className="size-4 text-cyan-100" />{label}</Link>)}<form action={logout} className="border-t border-white/10 pt-1"><button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-white/10"><LogOut className="size-4" />Cerrar sesión</button></form></nav></details></div></header>
    <div className="mx-auto grid min-h-dvh max-w-[1600px] lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-white/10 bg-[#061323]/72 p-5 backdrop-blur-xl lg:flex lg:flex-col"><Link href="/admin" className="flex min-h-12 items-center gap-3 px-2 text-lg font-bold"><span className="flex size-9 items-center justify-center rounded-xl bg-cyan-100/10 text-cyan-100"><ShieldCheck className="size-5" /></span><span>Arkad<small className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/38">Plataforma</small></span></Link><nav className="mt-8 grid gap-1" aria-label="Administración de plataforma">{items.map(({ href,label,icon:Icon }) => <Link key={href} href={href} className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/64 transition-colors hover:bg-white/9 hover:text-white"><Icon className="size-[18px] text-cyan-100/65 group-hover:text-cyan-100" />{label}</Link>)}</nav><div className="mt-auto border-t border-white/10 pt-4"><p className="truncate px-3 text-sm font-semibold">{session.name}</p><p className="mt-1 truncate px-3 text-xs text-white/40">Administrador de plataforma</p><form action={logout}><button className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/60 hover:bg-white/9 hover:text-white"><LogOut className="size-4" />Cerrar sesión</button></form></div></aside>
      <div className="min-w-0">{children}</div>
    </div>
  </div>;
}
