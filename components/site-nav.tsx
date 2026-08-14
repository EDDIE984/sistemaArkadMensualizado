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
          className="inline-flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur-md transition-colors hover:bg-black/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white min-[861px]:hidden"
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
          className="absolute left-5 right-5 top-[calc(100%+0.5rem)] overflow-hidden rounded-2xl border border-white/20 bg-[#111]/95 p-2 shadow-[0_18px_55px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:left-auto sm:right-8 sm:w-72 min-[861px]:hidden"
        >
          {[...links, { href: "/contacto", label: "Contacto" }].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`flex min-h-12 items-center justify-between rounded-xl px-4 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white ${
                pathname === link.href ? "bg-white text-[#111] hover:bg-white" : ""
              }`}
            >
              {link.label}
              {pathname === link.href && <span className="size-1.5 rounded-full bg-[#111]" aria-hidden="true" />}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
