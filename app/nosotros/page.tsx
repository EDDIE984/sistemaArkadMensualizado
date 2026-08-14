import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Nosotros | Confia",
  description:
    "Conoce cómo Confia simplifica la búsqueda y comparación de seguros vehiculares para ayudarte a elegir con mayor claridad.",
};

export default function AboutPage() {
  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#0a0a0a]">
      <div className="absolute inset-0 h-full w-full overflow-hidden animate-[zoomFade_1.6s_ease-out_both]">
        <video
          src="https://res.cloudinary.com/urml6fcu/video/upload/v1786571912/kling_20260813_Image_to_Video_de_la_imag_1485_0.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-full min-h-full w-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover object-center bg-[#0a0a0a]"
        />
      </div>

      <div className="absolute inset-0 animate-[fadeIn_1.2s_ease-out_both] bg-[linear-gradient(100deg,rgba(6,6,8,0.86)_0%,rgba(6,6,8,0.68)_34%,rgba(6,6,8,0.32)_58%,rgba(6,6,8,0.16)_76%,rgba(6,6,8,0.36)_100%)]" />

      <SiteNav />

      <section className="relative z-[2] flex min-h-0 max-w-[650px] flex-1 flex-col justify-center gap-[18px] overflow-hidden px-14 max-[860px]:px-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.12s_both]">
          Sobre nosotros
        </p>

        <h1 className="m-0 flex flex-col text-[48px] font-bold leading-[1.08] tracking-[-0.02em] text-white max-[860px]:text-[42px]">
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.2s_both]">Seguros más simples.</span>
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.33s_both]">Decisiones con</span>
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.46s_both]">más confianza.</span>
        </h1>

        <p className="m-0 max-w-[560px] text-[15.5px] font-normal leading-[1.55] text-white/75 animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.58s_both]">
          En Confia acercamos a las personas a distintas alternativas de seguro vehicular en un solo lugar. Simplificamos la comparación y presentamos la información de forma clara para que cada cliente pueda encontrar una opción acorde con su vehículo y sus necesidades.
        </p>

        <div className="flex items-center gap-3.5 max-[860px]:flex-wrap animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.7s_both]">
          <Link href="/planes" className="inline-flex min-h-11 items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0a0a0a] transition-opacity duration-200 hover:opacity-75">
            Conocer los planes
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-white/35 bg-white/8 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/14">
            Volver al inicio
          </Link>
        </div>

        <div className="grid max-w-[570px] grid-cols-3 gap-8 animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.84s_both] max-[860px]:gap-[18px]">
          <div className="flex flex-col gap-1">
            <span className="text-xl font-bold tracking-[-0.01em] text-white sm:text-2xl">Simple</span>
            <span className="text-[12px] font-medium leading-4 text-white/65">Información fácil de entender</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xl font-bold tracking-[-0.01em] text-white sm:text-2xl">Claro</span>
            <span className="text-[12px] font-medium leading-4 text-white/65">Opciones para comparar</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xl font-bold tracking-[-0.01em] text-white sm:text-2xl">Cercano</span>
            <span className="text-[12px] font-medium leading-4 text-white/65">Acompañamiento en el proceso</span>
          </div>
        </div>
      </section>
    </main>
  );
}
