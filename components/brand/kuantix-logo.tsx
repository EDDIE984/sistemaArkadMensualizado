import Image from "next/image";

/** Logo completo de Kuantix (K + "uantix" + "Tecnología confiable"). */
export function KuantixLogo({ className = "h-9 w-auto" }: { className?: string }) {
  return <Image src="/images/logo-kuantix.png" alt="Kuantix" width={930} height={285} priority className={className} />;
}

/** Solo la "K" de Kuantix, para espacios reducidos (menú lateral contraído). */
export function KuantixMark({ className = "size-9" }: { className?: string }) {
  return <Image src="/images/logo-kuantix-mark.png" alt="Kuantix" width={256} height={258} priority className={className} />;
}
