import type { Metadata } from "next";
import { Clock3, Mail, MapPin, Phone } from "lucide-react";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Contacto | Confia",
  description:
    "Comunícate con Confia para recibir información sobre seguros vehiculares, planes mensuales y alternativas de protección.",
};

const contactItems = [
  {
    icon: MapPin,
    label: "Visítanos",
    value: "Av. Los Guaytambos 04-102 y Montalvo, Ambato, Ecuador",
  },
  {
    icon: Phone,
    label: "Llámanos",
    value: "+593 3 242 1603 · +593 99 452 5315",
  },
  {
    icon: Mail,
    label: "Escríbenos",
    value: "info@grupoconfia.com",
  },
  {
    icon: Clock3,
    label: "Horario",
    value: "Lunes a jueves 08:30–17:30 · Viernes 08:00–16:30",
  },
];

export default function ContactPage() {
  return (
    <main className="contact-page relative min-h-dvh overflow-x-hidden bg-[#0a0a0a] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#0a0a0a] animate-[zoomFade_1.6s_ease-out_both]">
        <video
          src="https://res.cloudinary.com/urml6fcu/video/upload/v1786672480/kling_20260814_Image_to_Video_necesito_q_2470_0.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-full min-h-full w-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover object-center"
        />
      </div>

      <div
        className="pointer-events-none fixed inset-0 animate-[fadeIn_1.2s_ease-out_both] bg-[linear-gradient(100deg,rgba(6,6,8,0.88)_0%,rgba(6,6,8,0.72)_38%,rgba(6,6,8,0.5)_62%,rgba(6,6,8,0.34)_100%)]"
        aria-hidden="true"
      />

      <SiteNav />

      <section className="relative z-[1] mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-[1180px] items-center gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-14 lg:py-10">
        <div className="animate-[fadeUp_0.8s_cubic-bezier(0.16,1,0.3,1)_both]">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">HABLEMOS</p>
          <h1 className="mt-3 max-w-[520px] text-balance text-[42px] font-bold leading-[1.08] tracking-[-0.02em] text-white sm:text-[48px]">
            Estamos listos para ayudarte.
          </h1>
          <p className="mt-4 max-w-[520px] text-pretty text-[15.5px] leading-[1.55] text-white/75">
            Cuéntanos qué necesitas y nuestro equipo podrá orientarte sobre planes mensuales y alternativas de seguro para tu vehículo.
          </p>

          <address className="mt-8 grid gap-4 not-italic sm:grid-cols-2 lg:grid-cols-1">
            {contactItems.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex max-w-[520px] items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-sm">
                  <Icon className="size-4 text-white" aria-hidden="true" />
                </span>
                <span className="pt-0.5">
                  <span className="block text-xs font-bold uppercase tracking-[0.08em] text-white">{label}</span>
                  <span className="mt-1 block text-sm leading-5 text-white/72">{value}</span>
                </span>
              </div>
            ))}
          </address>
        </div>

        <form
          aria-describedby="contact-form-status"
          className="animate-[fadeUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.16s_both] rounded-[24px] border border-white/30 bg-black/18 p-5 text-white shadow-[0_20px_45px_rgba(0,0,0,0.24)] backdrop-blur-md sm:p-7"
        >
          <div className="grid gap-5">
            <div>
              <label htmlFor="contact-name" className="mb-2 block text-sm font-semibold">Nombre</label>
              <input
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Tu nombre completo"
                className="min-h-12 w-full rounded-xl border border-white/20 bg-black/20 px-4 text-sm text-white outline-none transition-colors placeholder:text-white/45 focus:border-white/60 focus:bg-black/30"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="mb-2 block text-sm font-semibold">Correo electrónico</label>
              <input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@correo.com"
                className="min-h-12 w-full rounded-xl border border-white/20 bg-black/20 px-4 text-sm text-white outline-none transition-colors placeholder:text-white/45 focus:border-white/60 focus:bg-black/30"
              />
            </div>

            <div>
              <label htmlFor="contact-comments" className="mb-2 block text-sm font-semibold">Comentarios</label>
              <textarea
                id="contact-comments"
                name="comments"
                rows={5}
                placeholder="Cuéntanos cómo podemos ayudarte"
                className="w-full resize-none rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-white/45 focus:border-white/60 focus:bg-black/30"
              />
            </div>

            <button
              type="button"
              className="min-h-12 rounded-full bg-white px-6 text-sm font-semibold text-black shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Enviar mensaje
            </button>

            <p id="contact-form-status" className="text-center text-xs leading-5 text-white/65">
              La función de envío por correo se habilitará próximamente.
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
