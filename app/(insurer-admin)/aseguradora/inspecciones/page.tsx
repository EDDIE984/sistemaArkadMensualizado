import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, ClipboardList, ThumbsDown, ThumbsUp } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { InspeccionFiltros } from "@/components/insurer/inspeccion-filtros";
import { requireInsurerAdmin } from "@/lib/auth/session";
import { loadInspeccionesListForInsurer, type InspeccionFiltro } from "@/lib/inspeccion/data";
import { CARROCERIA_LABELS } from "@/lib/inspeccion/slots";
import { SEV_COLOR, SEVERIDAD_LABEL } from "@/lib/inspeccion/labels";

export const metadata: Metadata = { title: "Inspecciones | Arkad", robots: { index: false, follow: false } };

function rangoToFechas(rango: string | undefined): { desde: string | null; hasta: string | null } {
  const hoy = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (rango === "hoy") return { desde: iso(hoy), hasta: iso(hoy) };
  if (rango === "semana") {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 6);
    return { desde: iso(d), hasta: iso(hoy) };
  }
  if (rango === "mes") {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 29);
    return { desde: iso(d), hasta: iso(hoy) };
  }
  return { desde: null, hasta: null };
}

export default async function InspeccionesPage({ searchParams }: PageProps<"/aseguradora/inspecciones">) {
  const session = await requireInsurerAdmin();
  const sp = await searchParams;
  const rango = typeof sp.rango === "string" ? sp.rango : undefined;
  const explicit = { desde: typeof sp.desde === "string" ? sp.desde : null, hasta: typeof sp.hasta === "string" ? sp.hasta : null };
  const byRango = rangoToFechas(rango);
  const revisionRaw = typeof sp.revision === "string" ? sp.revision : null;
  const revision = revisionRaw === "PENDIENTE" || revisionRaw === "APROBADA" || revisionRaw === "RECHAZADA" ? revisionRaw : null;

  const filtro: InspeccionFiltro = {
    desde: explicit.desde ?? byRango.desde,
    hasta: explicit.hasta ?? byRango.hasta,
    revision,
    placa: typeof sp.placa === "string" ? sp.placa : null,
  };

  const { items, kpis } = await loadInspeccionesListForInsurer(session.insurerId!, filtro);

  return (
    <AdminPage
      eyebrow="Control de calidad"
      title="Inspecciones"
      description="Revisa y aprueba las inspecciones fotográficas de tus cotizaciones."
    >
      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<ClipboardList />} label="Totales" value={kpis.totales} />
        <Stat icon={<ClipboardCheck />} label="Pendientes" value={kpis.pendientes} tone="amber" />
        <Stat icon={<ThumbsUp />} label="Aprobadas" value={kpis.aprobadas} tone="emerald" />
        <Stat icon={<ThumbsDown />} label="Rechazadas" value={kpis.rechazadas} tone="rose" />
      </section>

      <InspeccionFiltros
        selected={{
          rango: rango ?? null,
          desde: explicit.desde,
          hasta: explicit.hasta,
          revision,
          placa: filtro.placa ?? null,
        }}
      />

      <section className="glass-panel mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-white/40">
              <tr>
                {["Vehículo", "Carrocería", "Análisis", "Revisión", "Daños", "Gravedad", "Completada", "Creado por"].map((h) => (
                  <th key={h} className="px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-white/[0.03]">
                  <td className="px-3 py-3">
                    <Link href={`/aseguradora/inspecciones/${it.id}`} className="flex items-center gap-3">
                      {it.miniaturaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.miniaturaUrl} alt="" className="size-10 rounded-lg object-cover" />
                      ) : (
                        <span className="size-10 rounded-lg bg-white/8" />
                      )}
                      <span className="font-bold text-cyan-100">{it.placa || "Sin placa"}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-white/72">{CARROCERIA_LABELS[it.carroceria]}</td>
                  <td className="px-3 py-3">{analisisLabel(it.analisisEstado, it.danosTotal)}</td>
                  <td className="px-3 py-3">{revisionBadge(it.estadoRevision)}</td>
                  <td className="px-3 py-3 text-white/72">{it.danosTotal}</td>
                  <td className="px-3 py-3">
                    {it.gravedadPeor ? (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          color: SEV_COLOR[it.gravedadPeor],
                          borderColor: `${SEV_COLOR[it.gravedadPeor]}55`,
                          background: `${SEV_COLOR[it.gravedadPeor]}18`,
                        }}
                      >
                        {SEVERIDAD_LABEL[it.gravedadPeor]}
                      </span>
                    ) : (
                      <span className="text-white/35">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-white/55">
                    {it.completadaEn ? new Date(it.completadaEn).toLocaleDateString("es-EC") : "—"}
                  </td>
                  <td className="px-3 py-3 text-white/55">{it.creadoPor}</td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-white/45">
                    No hay inspecciones completadas con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPage>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "amber" | "emerald" | "rose";
}) {
  const color =
    tone === "amber" ? "text-amber-200" : tone === "emerald" ? "text-emerald-200" : tone === "rose" ? "text-rose-200" : "text-cyan-100";
  return (
    <article className="glass-panel min-w-0 p-5">
      <span className={`${color} [&_svg]:size-5`}>{icon}</span>
      <p className="mt-6 text-3xl font-bold tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-white/42">{label}</p>
    </article>
  );
}

function pill(text: string, tone: string) {
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}>{text}</span>;
}
function analisisLabel(estado: string, danos: number) {
  if (estado === "COMPLETADO") return pill(danos ? `${danos} daño(s)` : "Sin daños", "border-white/15 bg-white/6 text-white/60");
  if (estado === "EN_PROCESO") return pill("Analizando", "border-cyan-100/25 bg-cyan-100/10 text-cyan-50");
  if (estado === "CON_ERRORES") return pill("Con errores", "border-rose-300/25 bg-rose-300/10 text-rose-100");
  return pill("Pendiente", "border-white/15 bg-white/6 text-white/50");
}
function revisionBadge(estado: string) {
  if (estado === "APROBADA") return pill("Aprobada", "border-emerald-300/25 bg-emerald-300/10 text-emerald-100");
  if (estado === "RECHAZADA") return pill("Rechazada", "border-rose-300/25 bg-rose-300/10 text-rose-100");
  return pill("Pendiente", "border-amber-200/25 bg-amber-200/10 text-amber-100");
}
