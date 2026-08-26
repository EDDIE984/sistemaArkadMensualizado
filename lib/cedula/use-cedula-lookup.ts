"use client";

import { useCallback, useRef, useState } from "react";
import { consultarCedula, type CedulaLookupResult } from "@/app/actions/cedula";

export type CedulaFound = Extract<CedulaLookupResult, { status: "found" }>;
export type CedulaLookupStatus = "idle" | "loading" | "not-found" | "error";

// Normaliza a 10 dígitos: quita separadores y, si es un RUC de 13, toma los primeros 10.
function toCedula(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const cedula = digits.length === 13 ? digits.slice(0, 10) : digits;
  return /^\d{10}$/.test(cedula) ? cedula : null;
}

export function useCedulaLookup(onFound: (data: CedulaFound) => void) {
  const [status, setStatus] = useState<CedulaLookupStatus>("idle");
  const lastQueried = useRef<string | null>(null);

  const run = useCallback(
    async (raw: string) => {
      const cedula = toCedula(raw);
      if (!cedula || lastQueried.current === cedula) return;
      lastQueried.current = cedula;
      setStatus("loading");
      try {
        const result = await consultarCedula(cedula);
        if (result.status === "found") {
          onFound(result);
          setStatus("idle");
        } else {
          setStatus(result.status);
        }
      } catch {
        setStatus("error");
      }
    },
    [onFound],
  );

  return { status, run };
}
