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

      <nav className="relative z-[2] flex items-center justify-between px-14 max-[860px]:px-5 pt-5 shrink-0 animate-[navDrop_0.8s_cubic-bezier(0.16,1,0.3,1)_both]">
        <div className="flex items-center gap-2.5">
          <span className="w-[9px] h-[9px] rounded-full bg-white" />
          <span className="text-[17px] font-bold text-white tracking-[-0.01em]">PulseIQ</span>
        </div>
        <div className="flex items-center gap-8 max-[860px]:hidden">
          <a href="#" className="text-[14.5px] font-medium text-white/85 hover:opacity-75">Nosotros</a>
          <a href="#" className="text-[14.5px] font-medium text-white/85 hover:opacity-75">Insights</a>
          <a href="#" className="text-[14.5px] font-medium text-white/85 hover:opacity-75">Reportes</a>
          <a href="#" className="text-[14.5px] font-medium text-white/85 hover:opacity-75">Integraciones</a>
          <a href="#" className="text-[14.5px] font-medium text-white/85 hover:opacity-75">Precios</a>
        </div>
        <a href="#" className="bg-white text-[#0a0a0a] text-sm font-semibold px-[22px] py-2.5 rounded-full hover:opacity-75">
          Contacto
        </a>
      </nav>

      <div className="relative z-[2] flex-1 flex flex-col justify-center px-14 max-[860px]:px-5 max-w-[600px] gap-[18px] min-h-0 overflow-hidden">
        <h1 className="m-0 flex flex-col text-[48px] max-[860px]:text-[42px] leading-[1.08] font-bold tracking-[-0.02em] text-white">
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.15s_both]">Insights más inteligentes</span>
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.28s_both]">Para un mejor</span>
          <span className="animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.41s_both]">rendimiento</span>
        </h1>

        <p className="m-0 text-[15.5px] leading-[1.5] text-white/75 max-w-[480px] font-normal animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.55s_both]">
          Rastrea ingresos, clics, interacción y conversiones en un panel potente y fácil de usar, hecho para creadores y emprendedores.
        </p>

        <div className="flex items-center gap-3.5 max-[860px]:flex-wrap animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.68s_both]">
          <a href="#" className="bg-white text-[#0a0a0a] text-sm font-semibold px-6 py-3 rounded-full inline-block hover:opacity-75">
            Empezar a analizar
          </a>
          <a href="#" className="bg-white/8 text-white text-sm font-semibold px-6 py-3 rounded-full border border-white/35 inline-block hover:opacity-75">
            Ver demo
          </a>
        </div>

        <div className="flex items-center gap-2.5 animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.8s_both]">
          <span className="text-white text-[15px] tracking-[2px]">★★★★★</span>
          <span className="text-sm text-white/70 font-medium">5.0 &nbsp;|&nbsp; Nuevas calificaciones de usuarios</span>
        </div>

        <div className="grid grid-cols-[repeat(3,auto)] gap-8 max-[860px]:grid-cols-[repeat(3,1fr)] max-[860px]:gap-[18px] animate-[fadeUp_0.9s_cubic-bezier(0.16,1,0.3,1)_0.92s_both]">
          <div className="flex flex-col gap-0.5">
            <div className="text-2xl max-[860px]:text-[26px] font-bold text-white tracking-[-0.01em]">83%</div>
            <div className="text-[12.5px] text-white/65 font-medium">Toman decisiones más rápido</div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-2xl max-[860px]:text-[26px] font-bold text-white tracking-[-0.01em]">52%</div>
            <div className="text-[12.5px] text-white/65 font-medium">Monitorean conversiones</div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-2xl max-[860px]:text-[26px] font-bold text-white tracking-[-0.01em]">41%</div>
            <div className="text-[12.5px] text-white/65 font-medium">Exportan reportes</div>
          </div>
        </div>
      </div>
    </section>
  );
}
