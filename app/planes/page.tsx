import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Planes de seguro vehicular | Confia",
  description:
    "Conoce planes mensuales referenciales para proteger tu vehículo y elige el nivel de respaldo que se ajusta a ti.",
};

const plans = [
  {
    name: "Esencial",
    price: "25",
    description: "Una alternativa sencilla para contar con respaldo en los imprevistos más comunes.",
    features: [
      "Responsabilidad civil",
      "Asistencia vial básica",
      "Soporte para gestión de incidentes",
    ],
  },
  {
    name: "Protección",
    price: "50",
    description: "Más tranquilidad para el día a día, con un nivel de protección pensado para uso frecuente.",
    features: [
      "Todo lo incluido en Esencial",
      "Protección referencial ante robo",
      "Asistencia vial ampliada",
      "Auto sustituto sujeto a condiciones",
    ],
    featured: true,
  },
  {
    name: "Total",
    price: "75",
    description: "El respaldo más completo del ejemplo para quienes quieren conducir con mayor confianza.",
    features: [
      "Todo lo incluido en Protección",
      "Daños propios referenciales",
      "Asistencia vial premium",
      "Atención prioritaria",
    ],
  },
];

export default function PlansPage() {
  return (
    <main className="plans-page relative h-dvh overflow-x-hidden overflow-y-auto bg-[#0a0a0a] text-[var(--plans-text)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#0a0a0a] animate-[zoomFade_1.6s_ease-out_both]">
        <video
          src="https://res.cloudinary.com/urml6fcu/video/upload/v1786672480/kling_20260814_Image_to_Video_Utiliza_la_2503_0.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-full min-h-full w-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover object-center"
        />
      </div>

      <div
        className="pointer-events-none fixed inset-0 animate-[fadeIn_1.2s_ease-out_both] bg-[linear-gradient(100deg,rgba(6,6,8,0.82)_0%,rgba(6,6,8,0.64)_44%,rgba(6,6,8,0.42)_72%,rgba(6,6,8,0.5)_100%)]"
        aria-hidden="true"
      />

      <SiteNav />

      <section className="relative z-[1] mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[1180px] flex-col px-5 pb-3 pt-1 sm:px-8 lg:px-14">
        <header className="mx-auto max-w-3xl text-center animate-[fadeUp_0.8s_cubic-bezier(0.16,1,0.3,1)_both]">
          <p className="mb-2 text-[11px] font-bold tracking-[0.2em] text-white/70">PROTECCIÓN A TU MEDIDA</p>
          <h1 className="text-balance text-[42px] font-bold leading-[1.08] tracking-[-0.02em] text-white sm:text-[48px]">
            Un plan para cada camino.
          </h1>
          <p className="mx-auto mt-2 max-w-[610px] text-pretty text-[15.5px] leading-[1.5] text-white/75">
            Elige un nivel de protección mensual de ejemplo y cotiza según tu vehículo, ciudad y perfil de riesgo.
          </p>
        </header>

        <div className="plans-track mt-3 grid min-h-[27rem] flex-1 snap-x snap-mandatory auto-cols-[86vw] grid-flow-col items-stretch gap-4 overflow-x-auto pb-1 md:min-h-[24rem] md:auto-cols-auto md:grid-flow-row md:grid-cols-3 md:overflow-visible lg:gap-5">
          {plans.map((plan, index) => (
            <article
              key={plan.name}
              className={`plan-card relative flex min-h-0 snap-center flex-col overflow-hidden border p-1.5 text-white opacity-0 backdrop-blur-md ${
                plan.featured
                  ? "border-white/45 bg-white/18"
                  : "border-white/25 bg-black/18"
              }`}
              style={{ animationDelay: `${0.18 + index * 0.12}s` }}
            >
              <div className={`rounded-[1.1rem] border border-white/10 p-4 ${plan.featured ? "bg-white/14" : "bg-black/16"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold tracking-[0.08em] text-black">
                    {plan.name.toUpperCase()}
                  </span>
                </div>
                <h2 className="sr-only">Plan {plan.name}</h2>
                <p className="mt-8 flex items-end gap-1">
                  <span className="text-[40px] font-bold leading-none tracking-[-0.04em]">${plan.price}</span>
                  <span className="pb-1 text-xs text-white/65">/mes</span>
                </p>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-3 pb-4 pt-3">
                <p className="min-h-10 text-[12px] leading-[1.45] text-white/72">{plan.description}</p>
                <Link
                  href="/"
                  className="mt-3 flex min-h-11 items-center justify-center gap-3 rounded-full bg-white px-4 text-[12px] font-semibold text-black shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Cotizar este plan
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <ul className="mt-5 space-y-3" aria-label={`Beneficios del plan ${plan.name}`}>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-[12px] leading-5">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-white/65" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-2 max-w-4xl px-2 text-center text-[10px] font-medium leading-4 text-white/70">
          Valores y beneficios mostrados únicamente como ejemplo. La prima, coberturas, límites y deducibles finales dependen de la aseguradora, el vehículo y la evaluación de riesgo.
        </p>
      </section>
    </main>
  );
}
