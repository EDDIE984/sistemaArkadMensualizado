"use client";

import { useEffect, useRef } from "react";

const VIDEO_SRC =
  "https://res.cloudinary.com/urml6fcu/video/upload/v1786673694/kling_20260814_Image_to_Video_Animaci_nE_2609_0.mp4";

/**
 * Fondo de video del login. Es un client component porque `autoPlay` no vuelve
 * a arrancar cuando se llega a /login por navegación del lado del cliente (p. ej.
 * después de cerrar sesión o activar la cuenta) — solo arrancaba con recarga
 * completa. El efecto fuerza `play()` en cada montaje.
 */
export function LoginBgVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const start = () => {
      const p = video.play();
      if (p) p.catch(() => {});
    };
    // Si ya hay datos, reproducir de una; si no, esperar a que pueda.
    if (video.readyState >= 2) start();
    else video.addEventListener("loadeddata", start, { once: true });
    return () => video.removeEventListener("loadeddata", start);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#0a0a0a] animate-[zoomFade_1.6s_ease-out_both]">
      <video
        ref={ref}
        src={VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-full min-h-full w-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover object-center"
      />
    </div>
  );
}
