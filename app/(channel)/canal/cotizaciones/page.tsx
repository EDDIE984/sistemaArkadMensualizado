import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FilePlus2, Search } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { requireChannelUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Cotizaciones del canal | Arkad", robots: { index: false, follow: false } };

const ESTADOS = ["PENDIENTE", "ACEPTADA", "RECHAZADA", "EXPIRADA"];
const FILTROS: [string, string][] = [["", "Todas"], ["PENDIENTE", "Pendientes"], ["ACEPTADA", "Aceptadas"], ["RECHAZADA", "Rechazadas"]];

export default async function Page({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  const s = await requireChannelUser();
  const { estado = "", q = "" } = await searchParams;
  const term = q.trim();

  let query = createAdminClient()
    .from("cotizacion")
    .select("id,creado_en,estado,anios_vigencia,cuota_fija_mensual,cliente!inner(nombre_razon_social,identificacion),vehiculo(marca,modelo),producto(nombre),usuario(nombre)")
    .eq("canal_id", s.channelId!)
    .order("creado_en", { ascending: false });
  if (ESTADOS.includes(estado)) query = query.eq("estado", estado);
  if (term) query = query.ilike("cliente.nombre_razon_social", `%${term}%`);
  const { data } = await query;

  const hrefFor = (value: string) => {
    const p = new URLSearchParams();
    if (value) p.set("estado", value);
    if (term) p.set("q", term);
    const qs = p.toString();
    return qs ? `?${qs}` : "/canal/cotizaciones";
  };

  return (
    <AdminPage
      eyebrow="Producción del canal"
      title="Cotizaciones"
      description="Consulta las cotizaciones asistidas registradas desde este canal."
      action={
        <Link href="/canal/cotizaciones/nueva" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#071426]">
          <FilePlus2 className="size-4" />Nueva cotización
        </Link>
      }
    >
      <form className="mt-7 flex flex-col gap-3 sm:flex-row">
        {ESTADOS.includes(estado) && <input type="hidden" name="estado" value={estado} />}
        <label className="min-w-0 flex-1">
          <span className="sr-only">Buscar por nombre del cliente</span>
          <input name="q" defaultValue={term} placeholder="Buscar por nombre del cliente" className="min-h-12 w-full rounded-xl border border-white/15 bg-[#061323]/65 px-4 text-sm text-white outline-none focus:border-cyan-100/55" />
        </label>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#071426]">
          <Search className="size-4" />Buscar
        </button>
        {term && (
          <Link href={ESTADOS.includes(estado) ? `?estado=${estado}` : "/canal/cotizaciones"} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/14 px-5 text-sm font-bold text-white/70">
            Limpiar
          </Link>
        )}
      </form>

      <nav className="mt-4 flex flex-wrap gap-2">
        {FILTROS.map(([value, label]) => (
          <Link
            key={value}
            href={hrefFor(value)}
            className={`min-h-10 rounded-full border px-4 py-2.5 text-xs font-bold ${estado === value || (!estado && !value) ? "border-cyan-100/40 bg-cyan-100/10" : "border-white/12"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <section className="mt-4 grid gap-3">
        {(data || []).map((x) => (
          <Link key={x.id} href={`/canal/cotizaciones/${x.id}`} className="glass-panel grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-bold">{rel(x.cliente, "nombre_razon_social")}</p>
              <p className="mt-1 text-sm text-white/55">{rel(x.vehiculo, "marca")} {rel(x.vehiculo, "modelo")} · {rel(x.producto, "nombre")}</p>
              <p className="mt-2 text-xs text-white/38">{new Date(x.creado_en).toLocaleDateString("es-EC")} · Agente: {rel(x.usuario, "nombre")}</p>
            </div>
            <div className="flex items-center justify-between gap-4 sm:text-right">
              <div>
                <p className="text-xs text-white/42">Cuota mensual</p>
                <p className="mt-1 text-lg font-bold">{money(x.cuota_fija_mensual)}</p>
                <p className="mt-1 text-[10px] font-bold text-cyan-100/65">{x.estado}</p>
              </div>
              <ArrowRight className="size-5 text-white/35" />
            </div>
          </Link>
        ))}
        {!data?.length && (
          <div className="glass-panel p-8 text-center text-sm text-white/50">
            {term ? `No hay cotizaciones para "${term}".` : "No existen cotizaciones con este filtro."}
          </div>
        )}
      </section>
    </AdminPage>
  );
}

function rel(v: unknown, k: string) {
  const r = Array.isArray(v) ? v[0] : v;
  return r && typeof r === "object" && k in r ? String((r as Record<string, unknown>)[k]) : "—";
}
function money(v: number | string) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(v));
}
