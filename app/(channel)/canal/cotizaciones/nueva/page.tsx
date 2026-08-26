import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuoteWizard } from "@/components/quotes/quote-wizard";
import { NewQuoteStart } from "@/components/channel/new-quote-start";
import { requireChannelUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuoteFormData } from "@/lib/quotes/data";

export const metadata: Metadata = { title: "Nueva cotización asistida | Arkad", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const s = await requireChannelUser();
  const { cliente } = await searchParams;
  const db = createAdminClient();

  if (!cliente) {
    const [{ data: links }, { data: cities }] = await Promise.all([
      db.from("canal_cliente").select("cliente(id,nombre_razon_social,identificacion,email)").eq("canal_id", s.channelId!).order("creado_en", { ascending: false }),
      db.from("ciudad").select("id,nombre").order("nombre"),
    ]);
    const clients = (links || []).map((x) => (Array.isArray(x.cliente) ? x.cliente[0] : x.cliente)).filter((c): c is NonNullable<typeof c> => Boolean(c));
    return <NewQuoteStart clients={clients} cities={cities || []} />;
  }

  const { data: link } = await db
    .from("canal_cliente")
    .select("cliente(id,nombre_razon_social,identificacion,telefono,ciudad_id,fecha_nacimiento,genero,estado_civil)")
    .eq("canal_id", s.channelId!)
    .eq("cliente_id", cliente)
    .maybeSingle();
  const client = first(link?.cliente || null);
  if (!client) redirect("/canal/clientes");

  const complete = Boolean(
    client.identificacion && client.telefono && client.ciudad_id && client.fecha_nacimiento && client.genero && client.estado_civil,
  );
  if (!complete) redirect("/canal/clientes?incompleto=1");

  const data = await getQuoteFormData(client.id, { insurerId: s.insurerId!, channelId: s.channelId! });
  return (
    <main className="relative z-10 mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-7 lg:px-10">
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-100/65">Cotización asistida</p>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.035em]">Cotizar para {client.nombre_razon_social}</h1>
      <p className="mt-2 text-sm text-white/58">Productos disponibles exclusivamente para tu canal y aseguradora.</p>
      <QuoteWizard data={data} mode="channel" clientId={client.id} />
    </main>
  );
}

function first<T>(v: T | T[] | null) {
  return Array.isArray(v) ? v[0] || null : v;
}
