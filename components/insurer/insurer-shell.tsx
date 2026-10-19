"use client";

import Link from "next/link";
import { useState } from "react";
import { Boxes, CalendarClock, ChartNoAxesCombined, ChevronLeft, ChevronRight, CreditCard, FileCheck2, FileStack, LogOut, Network, ScanSearch, Users } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { MobileNavigationMenu } from "@/components/internal/mobile-navigation-menu";
import { KuantixLogo, KuantixMark } from "@/components/brand/kuantix-logo";
import { SupportAssistant } from "@/components/support/support-assistant";
import type { AppSession } from "@/lib/auth/session";

const items = [
  { href: "/aseguradora", label: "Resumen", icon: ChartNoAxesCombined },
  { href: "/aseguradora/pagos", label: "Pagos", icon: CreditCard },
  { href: "/aseguradora/canales", label: "Canales", icon: Network },
  { href: "/aseguradora/productos", label: "Productos", icon: Boxes },
  { href: "/aseguradora/agentes", label: "Usuarios de canal", icon: Users },
  { href: "/aseguradora/polizas", label: "Pólizas emitidas", icon: FileCheck2 },
  { href: "/aseguradora/vencimientos", label: "Vencimientos", icon: CalendarClock },
  { href: "/aseguradora/operacion", label: "Pendientes de emisión", icon: FileStack },
  { href: "/aseguradora/inspecciones", label: "Inspecciones", icon: ScanSearch },
];

export function InsurerShell({ session, insurerName, children }: { session: AppSession; insurerName: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return <div className="internal-background min-h-dvh overflow-x-clip text-ink">
    <header className="relative z-30 w-full max-w-full border-b border-line bg-white/85 backdrop-blur-xl lg:hidden"><div className="flex min-h-16 min-w-0 items-center justify-between gap-3 px-4"><Link href="/aseguradora" className="flex min-h-11 min-w-0 items-center gap-2.5 font-bold"><KuantixLogo className="h-8 w-auto shrink-0" /> <span className="max-w-28 truncate text-xs font-medium text-ink-subtle">{insurerName}</span></Link><MobileNavigationMenu label="Abrir menú de aseguradora"><nav className="fixed inset-x-3 top-[4.5rem] max-h-[calc(100dvh-5.25rem)] overflow-y-auto rounded-2xl border border-brand/25 bg-white/98 p-2 shadow-2xl backdrop-blur-xl">{items.map(({ href,label,icon:Icon }) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-ink/5"><Icon className="size-4 text-brand" />{label}</Link>)}<form action={logout} className="border-t border-line pt-1"><button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-ink/5"><LogOut className="size-4" />Cerrar sesión</button></form></nav></MobileNavigationMenu></div></header>
    <div className={`mx-auto grid min-h-dvh max-w-[1800px] transition-[grid-template-columns] duration-300 ${collapsed ? "lg:grid-cols-[84px_1fr]" : "lg:grid-cols-[260px_1fr]"}`}>
      <aside className="hidden min-h-full border-r border-line bg-white/85 backdrop-blur-xl lg:block">
       <div className={`sticky top-0 flex h-dvh flex-col transition-[padding] duration-300 ${collapsed ? "p-3" : "p-5"}`}>
        <div className={`flex min-h-12 items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          <Link href="/aseguradora" className="flex min-h-12 items-center gap-3 text-lg font-bold" title={collapsed ? `Kuantix · ${insurerName}` : undefined}>{collapsed?<KuantixMark className="size-9 shrink-0" />:<span><KuantixLogo className="h-9 w-auto" /><small className="mt-1 block max-w-36 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">{insurerName}</small></span>}</Link>
          {!collapsed&&<button type="button" onClick={()=>setCollapsed(true)} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted hover:bg-ink/5 hover:text-ink" aria-label="Contraer menú" title="Contraer menú"><ChevronLeft className="size-4"/></button>}
        </div>
        {collapsed&&<button type="button" onClick={()=>setCollapsed(false)} className="mt-3 flex min-h-10 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-brand-text hover:bg-brand/15" aria-label="Expandir menú" title="Expandir menú"><ChevronRight className="size-4"/></button>}
        <nav className="mt-6 grid gap-1" aria-label="Administración de aseguradora">{items.map(({ href,label,icon:Icon }) => <Link key={href} href={href} title={collapsed?label:undefined} aria-label={collapsed?label:undefined} className={`group flex min-h-11 items-center rounded-xl text-sm font-semibold text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink ${collapsed?"justify-center px-2":"gap-3 px-3"}`}><Icon className="size-[18px] shrink-0 text-brand/80 group-hover:text-brand" />{!collapsed&&label}</Link>)}</nav>
        <div className="mt-auto border-t border-line pt-4">{!collapsed&&<><p className="truncate px-3 text-sm font-semibold">{session.name}</p><p className="mt-1 truncate px-3 text-xs text-ink-subtle">Administrador de aseguradora</p></>}<form action={logout}><button title={collapsed?"Cerrar sesión":undefined} aria-label={collapsed?"Cerrar sesión":undefined} className={`mt-3 flex min-h-11 w-full items-center rounded-xl text-sm font-semibold text-ink-muted hover:bg-ink/5 hover:text-ink ${collapsed?"justify-center":"gap-3 px-3"}`}><LogOut className="size-4 shrink-0" />{!collapsed&&"Cerrar sesión"}</button></form></div>
       </div>
      </aside>
      <div className="min-w-0 overflow-x-clip"><header className="sticky top-0 z-30 hidden min-h-16 items-center justify-between border-b border-line bg-white/85 px-6 backdrop-blur-xl lg:flex"><div className="min-w-0"><p className="truncate text-sm font-bold">{insurerName}</p><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-subtle">Panel de aseguradora</p></div><form action={logout}><button className="flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface-muted px-4 text-xs font-bold text-ink/80 transition-colors hover:bg-ink/5 hover:text-ink"><LogOut className="size-4"/>Cerrar sesión</button></form></header>{children}</div>
    </div>
    <SupportAssistant scope="insurer" />
  </div>;
}
