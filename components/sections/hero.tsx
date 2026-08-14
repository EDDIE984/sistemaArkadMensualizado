import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export function Hero() {
  return (
    <section className="relative w-full h-screen overflow-hidden flex flex-col bg-[#0a0a0a]">
      <div className="absolute inset-0 w-full h-full overflow-hidden animate-[zoomFade_1.6s_ease-out_both]">
        <video
          src="https://res.cloudinary.com/urml6fcu/video/upload/kling_20260810_Image_to_Video_Hand_holdi_2841_0.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-1/2 left-1/2 w-full h-full min-w-full min-h-full -translate-x-1/2 -translate-y-1/2 object-cover object-center pointer-events-none bg-[#0a0a0a]"
        />
      </div>

      <div className="absolute inset-0 animate-[fadeIn_1.2s_ease-out_both] bg-[linear-gradient(100deg,rgba(6,6,8,0.82)_0%,rgba(6,6,8,0.62)_32%,rgba(6,6,8,0.28)_55%,rgba(6,6,8,0.15)_75%,rgba(6,6,8,0.35)_100%)]" />

      <SiteNav />

      <div className="relative z-[2] flex-1 flex flex-col justify-center px-14 max-[860px]:px-5 max-w-[600px] gap-[18px] min-h-0 overflow-hidden">
        <h1 className="m-0 flex flex-col text-[48px] max-[860px]:text-[42px] leading-[1.08] font-bold tracking-[-0.02em] text-white">
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.15s_both]">Protección para tu auto</span>
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.28s_both]">simple, flexible</span>
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.41s_both]">y mensual</span>
        </h1>

        <p className="m-0 text-[15.5px] leading-[1.5] text-white/75 max-w-[480px] font-normal animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.55s_both]">
          Compara planes mensuales de seguro vehicular y encuentra una alternativa acorde con tu auto, tus necesidades y tu perfil de riesgo.
        </p>

        <div className="flex items-center gap-3.5 max-[860px]:flex-wrap animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.68s_both]">
          <Link href="/planes" className="inline-flex min-h-11 items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0a0a0a] transition-opacity duration-200 hover:opacity-75">
            Conocer los planes
          </Link>
        </div>

        <div className="flex items-center gap-2.5 animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.8s_both]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-white" />
          <span className="text-sm font-medium text-white/70">Opciones de distintas aseguradoras en un solo lugar</span>
        </div>

        <div className="grid grid-cols-[repeat(3,auto)] gap-8 max-[860px]:grid-cols-[repeat(3,1fr)] max-[860px]:gap-[18px] animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.92s_both]">
          <div className="flex flex-col gap-0.5">
            <div className="text-2xl max-[860px]:text-[22px] font-bold text-white tracking-[-0.01em]">Mensual</div>
            <div className="text-[12.5px] text-white/65 font-medium">Cuotas pensadas para tu presupuesto</div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-2xl max-[860px]:text-[22px] font-bold text-white tracking-[-0.01em]">Flexible</div>
            <div className="text-[12.5px] text-white/65 font-medium">Compara niveles de protección</div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-2xl max-[860px]:text-[22px] font-bold text-white tracking-[-0.01em]">Claro</div>
            <div className="text-[12.5px] text-white/65 font-medium">Conoce coberturas y deducibles</div>
          </div>
        </div>
      </div>
    </section>
  );
}
