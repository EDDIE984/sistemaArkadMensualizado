import type { SlotCode } from "@/lib/inspeccion/slots";

type Props = { className?: string };

const base = {
  viewBox: "0 0 200 120",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Frame({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg {...base} className={className} role="presentation" aria-hidden="true">
      {children}
    </svg>
  );
}

function FrontOrRear({ className }: Props) {
  return (
    <Frame className={className}>
      <path d="M40 82 Q40 46 70 42 L130 42 Q160 46 160 82" />
      <path d="M32 82 h136" />
      <rect x="58" y="52" width="28" height="16" rx="3" />
      <rect x="114" y="52" width="28" height="16" rx="3" />
      <rect x="86" y="88" width="28" height="10" rx="2" />
      <circle cx="62" cy="92" r="9" />
      <circle cx="138" cy="92" r="9" />
    </Frame>
  );
}

function Side({ className, door }: Props & { door?: "front" | "rear" }) {
  return (
    <Frame className={className}>
      <path d="M20 84 L40 84 Q46 58 70 54 L120 50 Q150 52 168 74 L182 78 L182 84 L20 84" />
      <circle cx="58" cy="86" r="12" />
      <circle cx="150" cy="86" r="12" />
      <path d="M70 54 L84 78 M110 52 L110 78 M140 54 L134 78" />
      {door === "front" && <rect x="86" y="55" width="22" height="22" rx="2" strokeWidth={4} />}
      {door === "rear" && <rect x="112" y="54" width="20" height="23" rx="2" strokeWidth={4} />}
    </Frame>
  );
}

function EngineBay({ className }: Props) {
  return (
    <Frame className={className}>
      <path d="M30 30 L170 30 L170 34 Q170 40 150 40 L50 40 Q30 40 30 34 Z" />
      <rect x="40" y="52" width="120" height="46" rx="6" />
      <path d="M56 66 h40 M56 80 h60 M120 60 l24 30 M150 62 v30" />
    </Frame>
  );
}

function Trunk({ className }: Props) {
  return (
    <Frame className={className}>
      <path d="M34 26 Q60 12 100 12 Q140 12 166 26" />
      <rect x="40" y="44" width="120" height="58" rx="6" />
      <path d="M40 70 h120 M100 44 v58" />
    </Frame>
  );
}

function Dashboard({ className }: Props) {
  return (
    <Frame className={className}>
      <path d="M20 78 Q60 40 100 40 Q140 40 180 78" />
      <circle cx="70" cy="70" r="16" />
      <circle cx="118" cy="70" r="10" />
      <rect x="140" y="60" width="26" height="20" rx="3" />
      <path d="M52 92 q18 -14 36 0" />
    </Frame>
  );
}

function Seats({ className, row }: Props & { row: "front" | "rear" }) {
  return (
    <Frame className={className}>
      {row === "front" ? (
        <>
          <path d="M48 96 V64 q0 -14 16 -14 q16 0 16 14 V96" />
          <path d="M40 96 h48 M40 82 q8 -8 16 0" />
          <path d="M120 96 V64 q0 -14 16 -14 q16 0 16 14 V96" />
          <path d="M112 96 h48 M112 82 q8 -8 16 0" />
        </>
      ) : (
        <>
          <path d="M40 96 V60 q0 -12 20 -12 h80 q20 0 20 12 V96" />
          <path d="M32 96 h136 M70 48 v48 M130 48 v48" />
        </>
      )}
    </Frame>
  );
}

function DoorPanel({ className }: Props) {
  return (
    <Frame className={className}>
      <rect x="36" y="20" width="128" height="80" rx="10" />
      <path d="M36 58 h128" />
      <rect x="118" y="34" width="34" height="12" rx="4" />
      <path d="M54 74 h52 M54 86 h36" />
    </Frame>
  );
}

export function Silhouette({ slot, className }: { slot: SlotCode; className?: string }) {
  switch (slot) {
    case "FRENTE":
    case "ATRAS":
      return <FrontOrRear className={className} />;
    case "MOTOR":
      return <EngineBay className={className} />;
    case "CAJUELA":
      return <Trunk className={className} />;
    case "INTERIOR_TABLERO":
      return <Dashboard className={className} />;
    case "ASIENTOS_DELANTEROS":
      return <Seats className={className} row="front" />;
    case "ASIENTOS_TRASEROS":
      return <Seats className={className} row="rear" />;
    case "PUERTA_INT_DELANTERA_IZQ":
    case "PUERTA_INT_DELANTERA_DER":
    case "PUERTA_INT_TRASERA_IZQ":
    case "PUERTA_INT_TRASERA_DER":
      return <DoorPanel className={className} />;
    default:
      return <Side className={className} />;
  }
}
