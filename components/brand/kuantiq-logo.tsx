import Image from "next/image";

/** Logo completo de Kuantiq (K + "uantiq"), versión transparente para fondos claros. */
export function KuantiqLogo({ className = "h-9 w-auto" }: { className?: string }) {
  return <Image src="/images/logo-kuantiq.png" alt="Kuantiq" width={1192} height={327} priority className={className} />;
}

/** Solo la "K" de Kuantiq, para espacios reducidos (menú lateral contraído). */
export function KuantiqMark({ className = "size-9" }: { className?: string }) {
  return <Image src="/images/logo-kuantiq-mark.png" alt="Kuantiq" width={256} height={256} priority className={className} />;
}
