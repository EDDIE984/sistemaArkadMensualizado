import type { Carroceria } from "@/lib/inspeccion/slots";

// Ilustraciones de perfil por tipo de carrocería (archivos en public/carrocerias/).

const SLUG: Record<Carroceria, string> = {
  SEDAN: "sedan",
  SUV: "suv",
  STATION_WAGON: "station-wagon",
  HATCHBACK: "hatchback",
  LCV: "lcv",
  CAMIONETA: "camioneta",
  MINIVAN: "minivan",
};

export function CarroceriaIcon({ carroceria, className }: { carroceria: Carroceria; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/carrocerias/${SLUG[carroceria]}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      className={className}
    />
  );
}
