"use client";

import { useEffect, useState } from "react";

/**
 * Maqueta de demostración del módulo de cobranzas asistido por IA.
 *
 * Es un prototipo desechable para mostrar al cliente. El HTML/CSS/JS vive como
 * documento independiente en `public/demos/cobranzas-ia.html` y se incrusta en un
 * <iframe srcDoc> aislado (sandbox) para que sus estilos globales no afecten a la
 * app. No hay backend, envíos ni persistencia: todos los datos son ficticios.
 *
 * Para retirarlo: borrar este archivo, `public/demos/cobranzas-ia.html`, la ruta
 * `app/(insurer-admin)/aseguradora/cobranzas-ia/` y su entrada en `insurer-shell.tsx`.
 */
export function CobranzasIaDemo() {
  const [doc, setDoc] = useState<string | null>(null);
  const [height, setHeight] = useState(1200);

  useEffect(() => {
    let alive = true;
    fetch("/demos/cobranzas-ia.html")
      .then((res) => res.text())
      .then((html) => {
        if (alive) setDoc(html);
      })
      .catch(() => {
        if (alive) setDoc(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { __cbzH?: number } | null;
      if (data && typeof data.__cbzH === "number" && data.__cbzH > 0) {
        setHeight(Math.min(Math.max(Math.round(data.__cbzH) + 2, 600), 24000));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (doc === null) {
    return (
      <div className="flex min-h-64 items-center justify-center px-6 py-12 text-center text-sm text-white/50">
        No se pudo cargar la demostración. Recarga la página para reintentar.
      </div>
    );
  }

  return (
    <iframe
      title="Demostración · Cobranzas asistidas por IA"
      srcDoc={doc}
      sandbox="allow-scripts"
      loading="lazy"
      style={{ width: "100%", height, border: 0, display: "block", background: "#071426" }}
    />
  );
}
