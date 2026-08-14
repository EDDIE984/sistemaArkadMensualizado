"use client";

import Link from "next/link";
import { useState } from "react";
import { Boxes, Building2, ChartNoAxesCombined, ChevronLeft, ChevronRight, FileStack, LogOut, Menu, Network, ShieldCheck, Users } from "lucide-react";
import { logout } from "@/app/actions/auth";
import type { AppSession } from "@/lib/auth/session";

const items = [
  { href: "/aseguradora", label: "Resumen", icon: ChartNoAxesCombined },
  { href: "/aseguradora/canales", label: "Canales", icon: Network },
  { href: "/aseguradora/productos", label: "Productos", icon: Boxes },
  { href: "/aseguradora/agentes", label: "Usuarios de canal", icon: Users },
  { href: "/aseguradora/operacion", label: "Operación", icon: FileStack },
];

export function InsurerShell({ session, insurerName, children }: { session: AppSession; insurerName: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return <div className="internal-background min-h-dvh overflow-x-clip text-white">
    <header className="relative z-30 border-b border-white/10 bg-[#061323]/72 backdrop-blur-xl lg:hidden"><div className="flex min-h-16 items-center justify-between px-4"><Link href="/aseguradora" className="flex min-h-11 items-center gap-2.5 font-bold"><ShieldCheck className="size-5 text-cyan-200" /> Arkad <span className="max-w-28 truncate text-xs font-medium text-white/45">{insurerName}</span></Link><details className="relative"><summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-white/15 bg-white/5" aria-label="Abrir menú de aseguradora"><Menu className="size-5" /></summary><nav className="absolute right-0 top-13 w-72 rounded-2xl border border-white/15 bg-[#071426]/98 p-2 shadow-2xl">{items.map(({ href,label,icon:Icon }) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-white/10"><Icon className="size-4 text-cyan-100" />{label}</Link>)}<form action={logout} className="border-t border-white/10 pt-1"><button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-white/10"><LogOut className="size-4" />Cerrar sesión</button></form></nav></details></div></header>
    <div className={`mx-auto grid min-h-dvh max-w-[1800px] transition-[grid-template-columns] duration-300 ${collapsed ? "lg:grid-cols-[84px_1fr]" : "lg:grid-cols-[260px_1fr]"}`}>
      <aside className="hidden min-h-full border-r border-white/10 bg-[#061323]/72 backdrop-blur-xl lg:block">
       <div className={`sticky top-0 flex h-dvh flex-col transition-[padding] duration-300 ${collapsed ? "p-3" : "p-5"}`}>
        <div className={`flex min-h-12 items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          <Link href="/aseguradora" className="flex min-h-12 items-center gap-3 text-lg font-bold" title={collapsed ? `Arkad · ${insurerName}` : undefined}><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-100/10 text-cyan-100"><Building2 className="size-5" /></span>{!collapsed&&<span>Arkad<small className="block max-w-36 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/38">{insurerName}</small></span>}</Link>
          {!collapsed&&<button type="button" onClick={()=>setCollapsed(true)} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/12 text-white/55 hover:bg-white/8 hover:text-white" aria-label="Contraer menú" title="Contraer menú"><ChevronLeft className="size-4"/></button>}
        </div>
        {collapsed&&<button type="button" onClick={()=>setCollapsed(false)} className="mt-3 flex min-h-10 items-center justify-center rounded-xl border border-cyan-100/15 bg-cyan-100/6 text-cyan-100 hover:bg-cyan-100/12" aria-label="Expandir menú" title="Expandir menú"><ChevronRight className="size-4"/></button>}
        <nav className="mt-6 grid gap-1" aria-label="Administración de aseguradora">{items.map(({ href,label,icon:Icon }) => <Link key={href} href={href} title={collapsed?label:undefined} aria-label={collapsed?label:undefined} className={`group flex min-h-11 items-center rounded-xl text-sm font-semibold text-white/64 transition-colors hover:bg-white/9 hover:text-white ${collapsed?"justify-center px-2":"gap-3 px-3"}`}><Icon className="size-[18px] shrink-0 text-cyan-100/65 group-hover:text-cyan-100" />{!collapsed&&label}</Link>)}</nav>
        <div className="mt-auto border-t border-white/10 pt-4">{!collapsed&&<><p className="truncate px-3 text-sm font-semibold">{session.name}</p><p className="mt-1 truncate px-3 text-xs text-white/40">Administrador de aseguradora</p></>}<form action={logout}><button title={collapsed?"Cerrar sesión":undefined} aria-label={collapsed?"Cerrar sesión":undefined} className={`mt-3 flex min-h-11 w-full items-center rounded-xl text-sm font-semibold text-white/60 hover:bg-white/9 hover:text-white ${collapsed?"justify-center":"gap-3 px-3"}`}><LogOut className="size-4 shrink-0" />{!collapsed&&"Cerrar sesión"}</button></form></div>
       </div>
      </aside>
      <div className="min-w-0 overflow-x-clip"><header className="sticky top-0 z-30 hidden min-h-16 items-center justify-between border-b border-white/10 bg-[#061323]/72 px-6 backdrop-blur-xl lg:flex"><div className="min-w-0"><p className="truncate text-sm font-bold">{insurerName}</p><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">Panel de aseguradora</p></div><form action={logout}><button className="flex min-h-10 items-center gap-2 rounded-full border border-white/14 bg-white/5 px-4 text-xs font-bold text-white/72 transition-colors hover:bg-white/10 hover:text-white"><LogOut className="size-4"/>Cerrar sesión</button></form></header>{children}</div>
    </div>
  </div>;
}
