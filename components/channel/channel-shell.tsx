"use client";

import Link from "next/link";
import { useState } from "react";
import { Ban, Calculator, ChartNoAxesCombined, ChevronLeft, ChevronRight, CreditCard, Files, LogOut, UserRound, Users } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { MobileNavigationMenu } from "@/components/internal/mobile-navigation-menu";
import { KuantiqLogo, KuantiqMark } from "@/components/brand/kuantiq-logo";
import { SupportAssistant } from "@/components/support/support-assistant";
import type { AppSession } from "@/lib/auth/session";

const items = [
  { href: "/canal", label: "Resumen", icon: ChartNoAxesCombined },
  { href: "/canal/cotizaciones", label: "Órdenes de Emisión", icon: Files },
  { href: "/canal/clientes", label: "Clientes", icon: Users },
  { href: "/canal/pagos", label: "Pagos", icon: CreditCard },
  { href: "/canal/cancelaciones", label: "Cancelaciones", icon: Ban },
  { href: "/canal/tradicional", label: "Tradicional", icon: Calculator },
  { href: "/canal/perfil", label: "Mi perfil", icon: UserRound },
];

export function ChannelShell({ session, insurerName, channelName, children }: { session: AppSession; insurerName: string; channelName: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return <div className="internal-background min-h-dvh w-full max-w-full overflow-x-clip text-ink">
    <header className="relative z-30 w-full max-w-full border-b border-line bg-white/85 backdrop-blur-xl lg:hidden">
      <div className="flex min-h-16 min-w-0 items-center justify-between gap-3 px-4">
        <Link href="/canal" className="flex min-h-11 min-w-0 items-center gap-2.5 font-bold"><KuantiqLogo className="h-8 w-auto shrink-0"/><span className="max-w-24 truncate text-xs text-ink-subtle">{channelName}</span></Link>
        <MobileNavigationMenu label="Abrir menú de canal"><nav className="fixed inset-x-3 top-[4.5rem] max-h-[calc(100dvh-5.25rem)] overflow-y-auto rounded-2xl border border-brand/25 bg-white/98 p-2 shadow-2xl backdrop-blur-xl">{items.map(({href,label,icon:Icon})=><Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-ink/5"><Icon className="size-4 text-brand"/>{label}</Link>)}<form action={logout} className="border-t border-line"><button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold"><LogOut className="size-4"/>Cerrar sesión</button></form></nav></MobileNavigationMenu>
      </div>
    </header>
    <div className={`mx-auto grid min-h-dvh max-w-[1800px] transition-[grid-template-columns] ${collapsed?"lg:grid-cols-[84px_1fr]":"lg:grid-cols-[250px_1fr]"}`}>
      <aside className="hidden min-h-full border-r border-line bg-white/85 lg:block"><div className={`sticky top-0 flex h-dvh flex-col ${collapsed?"p-3":"p-5"}`}><div className={`flex items-center ${collapsed?"justify-center":"justify-between"}`}><Link href="/canal" className="flex min-h-12 items-center gap-3 font-bold" title={collapsed?channelName:undefined}>{collapsed?<KuantiqMark className="size-9 shrink-0"/>:<span><KuantiqLogo className="h-9 w-auto"/><small className="mt-1 block max-w-32 truncate text-[10px] uppercase tracking-wider text-ink-subtle">{channelName}</small></span>}</Link>{!collapsed&&<button onClick={()=>setCollapsed(true)} className="flex size-10 items-center justify-center rounded-full border border-line" aria-label="Contraer menú"><ChevronLeft className="size-4"/></button>}</div>{collapsed&&<button onClick={()=>setCollapsed(false)} className="mt-3 flex min-h-10 items-center justify-center rounded-xl border border-brand/25 text-brand-text" aria-label="Expandir menú"><ChevronRight className="size-4"/></button>}<nav className="mt-6 grid gap-1">{items.map(({href,label,icon:Icon})=><Link key={href} href={href} title={collapsed?label:undefined} className={`flex min-h-11 items-center rounded-xl text-sm font-semibold text-ink-muted hover:bg-ink/5 hover:text-ink ${collapsed?"justify-center":"gap-3 px-3"}`}><Icon className="size-[18px] shrink-0 text-brand/80"/>{!collapsed&&label}</Link>)}</nav><div className="mt-auto border-t border-line pt-4">{!collapsed&&<><p className="truncate px-3 text-sm font-semibold">{session.name}</p><p className="mt-1 truncate px-3 text-xs text-ink-subtle">Usuario de canal</p></>}<form action={logout}><button className={`mt-3 flex min-h-11 w-full items-center rounded-xl text-sm font-semibold text-ink-muted hover:bg-ink/5 ${collapsed?"justify-center":"gap-3 px-3"}`}><LogOut className="size-4"/>{!collapsed&&"Cerrar sesión"}</button></form></div></div></aside>
      <div className="min-w-0 max-w-full overflow-x-clip"><header className="sticky top-0 z-30 hidden min-h-16 items-center justify-between border-b border-line bg-white/85 px-6 backdrop-blur-xl lg:flex"><div><p className="text-sm font-bold">{insurerName}</p><p className="text-[10px] uppercase tracking-wider text-ink-subtle">Canal {channelName}</p></div><form action={logout}><button className="flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface-muted px-4 text-xs font-bold"><LogOut className="size-4"/>Cerrar sesión</button></form></header>{children}</div>
    </div>
    <SupportAssistant scope="channel" />
  </div>;
}
