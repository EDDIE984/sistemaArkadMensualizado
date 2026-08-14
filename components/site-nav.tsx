"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const links = [
  { href: "/nosotros", label: "Nosotros" },
  { href: "/planes", label: "Planes" },
  { href: "/login", label: "Login" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <nav
      className="relative z-20 flex h-16 shrink-0 animate-[navDrop_0.8s_cubic-bezier(0.16,1,0.3,1)_both] items-center justify-between px-5 sm:px-8 lg:px-14"
      aria-label="Navegación principal"
    >
      <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label="Ir al inicio">
        <span className="h-[9px] w-[9px] rounded-full bg-white" aria-hidden="true" />
        <span className="text-[17px] font-bold tracking-[-0.01em] text-white">Inicio</span>
      </Link>

      <div className="hidden items-center gap-8 min-[861px]:flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            className={`text-[14.5px] font-medium text-white/85 transition-opacity duration-200 hover:opacity-75 ${
              pathname === link.href ? "border-b border-white pb-1 text-white" : ""
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/contacto"
          aria-current={pathname === "/contacto" ? "page" : undefined}
          className={`hidden min-h-11 items-center rounded-full bg-white px-[22px] py-2.5 text-sm font-semibold text-[#0a0a0a] transition-opacity duration-200 hover:opacity-75 min-[430px]:inline-flex ${
            pathname === "/contacto" ? "ring-2 ring-white/45 ring-offset-2 ring-offset-transparent" : ""
          }`}
        >
          Contacto
        </Link>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full border border-cyan-100/25 bg-[#0a2037]/72 text-cyan-50 shadow-[0_8px_28px_rgba(1,13,28,0.28)] backdrop-blur-xl transition-colors hover:border-cyan-100/45 hover:bg-[#102e4b]/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 min-[861px]:hidden"
          aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isOpen}
          aria-controls="mobile-navigation"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>

      {isOpen && (
        <div
          id="mobile-navigation"
          className="absolute left-4 right-4 top-[calc(100%+0.5rem)] overflow-hidden rounded-[1.4rem] border border-cyan-100/20 bg-[linear-gradient(145deg,rgba(7,25,44,0.94),rgba(14,45,72,0.9))] p-2.5 shadow-[0_24px_70px_rgba(1,12,27,0.5)] ring-1 ring-white/5 backdrop-blur-2xl sm:left-auto sm:right-8 sm:w-72 min-[861px]:hidden"
        >
          <div className="pointer-events-none absolute -right-12 -top-16 size-36 rounded-full bg-cyan-200/12 blur-3xl" aria-hidden="true" />
          {[...links, { href: "/contacto", label: "Contacto" }].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`relative flex min-h-12 items-center justify-between rounded-2xl border px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan-100 ${
                pathname === link.href
                  ? "border-cyan-100/30 bg-cyan-100/14 text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "border-transparent text-white/82 hover:border-white/10 hover:bg-white/7 hover:text-white"
              }`}
            >
              {link.label}
              {pathname === link.href && <span className="size-2 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.9)]" aria-hidden="true" />}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
