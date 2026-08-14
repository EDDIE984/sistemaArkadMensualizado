"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function MobileNavigationMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const close = () => detailsRef.current?.removeAttribute("open");

  useEffect(() => {
    close();
  }, [pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <details ref={detailsRef} className="shrink-0">
      <summary
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-white/15 bg-white/5"
        aria-label={label}
      >
        <Menu className="size-5" aria-hidden="true" />
      </summary>
      <div onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) close();
      }}>
        {children}
      </div>
    </details>
  );
}
