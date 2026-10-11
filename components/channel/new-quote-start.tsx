"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import { ArrowRight, LoaderCircle, Search, UserPlus, Users } from "lucide-react";
import { AssistedClientForm } from "@/components/channel/client-form";
import { buscarClienteGlobal, linkExistingClient, type ClienteGlobalMatch } from "@/app/actions/channel";

type LinkedClient = { id: string; nombre_razon_social: string; identificacion: string | null; email: string };

const EXACT = /^\d{10}(\d{3})?$/;
const isExactTerm = (t: string) => EXACT.test(t) || t.includes("@");

export function NewQuoteStart({ clients, cities }: { clients: LinkedClient[]; cities: { id: string; nombre: string }[] }) {
  const [mode, setMode] = useState<"existing" | "new">(clients.length ? "existing" : "new");
  const [query, setQuery] = useState("");
  const [globalMatch, setGlobalMatch] = useState<ClienteGlobalMatch | null>(null);
  const [searching, startSearch] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const term = query.trim();
  const filtered = term
    ? clients.filter(
        (c) =>
          c.nombre_razon_social.toLowerCase().includes(term.toLowerCase()) ||
          (c.identificacion ?? "").includes(term) ||
          c.email.toLowerCase().includes(term.toLowerCase()),
      )
    : clients;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function handleQueryChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const next = value.trim();
    if (!isExactTerm(next)) {
      setGlobalMatch(null);
      return;
    }
    timer.current = setTimeout(() => {
      startSearch(async () => {
        setGlobalMatch(await buscarClienteGlobal(next));
      });
    }, 400);
  }

  const showGlobal = globalMatch && !filtered.some((c) => c.id === globalMatch.id);

  return (
    <main className="relative z-10 mx-auto w-full max-w-[980px] px-4 py-8 sm:px-7 lg:px-10">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-text/80">Cotización asistida</p>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.035em]">Nueva cotización</h1>
      <p className="mt-2 text-sm text-ink-muted">Busca un cliente ya registrado o crea uno nuevo para continuar con la cotización.</p>

      <div className="mt-6 inline-flex rounded-full border border-line bg-surface-muted p-1 text-sm font-bold">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`min-h-10 rounded-full px-4 ${mode === "existing" ? "bg-brand text-ink" : "text-ink-muted"}`}
        >
          Cliente existente
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`min-h-10 rounded-full px-4 ${mode === "new" ? "bg-brand text-ink" : "text-ink-muted"}`}
        >
          Cliente nuevo
        </button>
      </div>

      {mode === "existing" ? (
        <div className="mt-6 grid gap-3">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
            <span className="sr-only">Buscar cliente</span>
            <input
              value={query}
              onChange={handleQueryChange}
              placeholder="Nombre del cliente, o cédula / RUC / correo exacto"
              className="min-h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm text-ink outline-none focus:border-brand/60"
            />
          </label>

          {searching && (
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <LoaderCircle className="size-3 animate-spin" />Buscando en la red…
            </span>
          )}

          {showGlobal && globalMatch && (
            <div className="flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold">{globalMatch.nombre}</p>
                <p className="mt-1 text-xs text-ink-subtle">{globalMatch.identificacion} · {globalMatch.email}</p>
                {!globalMatch.linked && <p className="mt-1 text-[11px] text-amber-700">Aún no está vinculado a tu canal.</p>}
              </div>
              {globalMatch.linked ? (
                <Link
                  href={`/canal/cotizaciones/nueva?cliente=${globalMatch.id}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-4 text-xs font-bold text-ink"
                >
                  Cotizar <ArrowRight className="size-4" />
                </Link>
              ) : (
                <form action={linkExistingClient}>
                  <input type="hidden" name="clientId" value={globalMatch.id} />
                  <input type="hidden" name="identification" value={globalMatch.identificacion || ""} />
                  <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-4 text-xs font-bold text-ink">
                    <UserPlus className="size-4" />Vincular y cotizar
                  </button>
                </form>
              )}
            </div>
          )}

          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/canal/cotizaciones/nueva?cliente=${c.id}`}
              className="glass-panel flex min-h-20 items-center justify-between gap-4 p-5"
            >
              <div>
                <p className="font-bold">{c.nombre_razon_social}</p>
                <p className="mt-1 text-xs text-ink-subtle">{c.identificacion} · {c.email}</p>
              </div>
              <ArrowRight className="size-5 text-brand" />
            </Link>
          ))}

          {!filtered.length && !showGlobal && !searching && (
            <div className="glass-panel p-8 text-center">
              <Users className="mx-auto size-7 text-brand" />
              <p className="mt-4 font-bold">
                {clients.length ? "Ningún cliente vinculado coincide" : "Aún no tienes clientes vinculados"}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Búscalo por cédula / RUC o correo exacto, o crea un cliente nuevo.
              </p>
              <button
                type="button"
                onClick={() => setMode("new")}
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-bold text-white"
              >
                Crear cliente nuevo
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <AssistedClientForm cities={cities} />
        </div>
      )}
    </main>
  );
}
