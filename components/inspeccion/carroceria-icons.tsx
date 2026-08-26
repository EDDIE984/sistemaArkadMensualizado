import type { Carroceria } from "@/lib/inspeccion/slots";

// Ilustraciones de perfil por tipo de carrocería, al estilo de la referencia
// (line-art azul). Se usan en el selector de carrocería de la inspección.

const svg = {
  viewBox: "0 0 200 112",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FRONT_WHEEL = 52;
const REAR_WHEEL = 150;

function Chassis() {
  return (
    <>
      {/* Guardafangos */}
      <path d={`M${FRONT_WHEEL - 18} 82 A 18 18 0 0 0 ${FRONT_WHEEL + 18} 82`} />
      <path d={`M${REAR_WHEEL - 18} 82 A 18 18 0 0 0 ${REAR_WHEEL + 18} 82`} />
      {/* Faldón entre ejes y voladizos */}
      <path d={`M${FRONT_WHEEL + 18} 82 L${REAR_WHEEL - 18} 82`} />
      <path d="M20 78 L34 82" />
      <path d="M180 78 L184 82" />
      {/* Ruedas */}
      <circle cx={FRONT_WHEEL} cy={88} r={13} />
      <circle cx={FRONT_WHEEL} cy={88} r={4.5} />
      <circle cx={REAR_WHEEL} cy={88} r={13} />
      <circle cx={REAR_WHEEL} cy={88} r={4.5} />
    </>
  );
}

const BODY: Record<Carroceria, string> = {
  SEDAN:
    "M20 80 L20 73 Q21 69 28 68 L46 65 Q53 50 68 46 L104 45 Q118 46 126 50 L138 65 L176 68 Q183 69 183 75 L183 80",
  SUV: "M18 80 L18 70 Q19 65 27 64 L44 61 Q50 46 64 41 L150 40 Q167 41 173 49 L177 63 L183 65 L183 80",
  STATION_WAGON:
    "M20 80 L20 73 Q21 69 28 68 L46 65 Q53 50 68 46 L152 45 Q172 46 176 54 L178 66 L184 68 L184 80",
  HATCHBACK:
    "M24 80 L24 72 Q25 68 32 67 L48 64 Q55 49 70 45 L118 44 Q140 45 150 57 L162 74 Q164 78 170 79 L170 80",
  LCV: "M16 80 L16 56 Q17 47 25 45 L41 43 L46 36 Q47 32 55 31 L182 30 Q187 31 187 37 L187 80",
  CAMIONETA:
    "M20 80 L20 73 Q21 69 28 68 L44 65 Q50 50 64 45 L96 44 Q106 45 110 53 L112 66 L112 62 L182 62 L182 80",
  MINIVAN:
    "M16 80 Q16 55 25 49 Q31 40 48 38 L62 36 Q73 30 100 30 L150 31 Q179 34 185 53 L187 72 Q187 79 182 80",
};

const WINDOWS: Record<Carroceria, string> = {
  SEDAN: "M50 61 L133 61 M66 47 L57 61 M97 45 L97 61 M126 50 L131 61",
  SUV: "M46 61 L178 61 M64 42 L54 61 M150 41 L176 61 M104 40 L104 61",
  STATION_WAGON: "M46 61 L178 61 M68 47 L57 61 M176 55 L178 61 M112 45 L112 61",
  HATCHBACK: "M48 61 L160 61 M70 46 L58 61 M150 58 L160 61 M108 44 L108 61",
  LCV: "M44 58 L44 39 L92 38 L92 58 Z",
  CAMIONETA: "M46 61 L110 61 M64 46 L54 61 M110 55 L110 61 M88 44 L88 61",
  MINIVAN: "M40 61 L184 61 M48 38 L38 61 M100 31 L100 61 M150 33 L182 55",
};

export function CarroceriaIcon({ carroceria, className }: { carroceria: Carroceria; className?: string }) {
  return (
    <svg {...svg} className={className} role="presentation" aria-hidden="true">
      <path d={BODY[carroceria]} />
      <path d={WINDOWS[carroceria]} strokeWidth={2.6} />
      <Chassis />
    </svg>
  );
}
