import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-ui";
import { BulkUpload, type BulkProduct } from "@/components/channel/bulk-upload";
import { requireChannelUser } from "@/lib/auth/session";
import { getDbPool } from "@/lib/db/pool";

// Validar/guardar hasta 100 órdenes ejecuta el motor de cálculo por fila.
export const maxDuration = 300;

export const metadata: Metadata = { title: "Carga masiva de Órdenes de Emisión | Kuantix", robots: { index: false, follow: false } };

export default async function Page() {
  const s = await requireChannelUser();
  const { rows } = await getDbPool().query<BulkProduct>(
    `select p.id, p.nombre as name, a.nombre_comercial as "insurerName",
            coalesce(json_agg(json_build_object('id', pc.id, 'name', cb.nombre) order by cb.nombre)
                     filter (where pc.id is not null), '[]') as coverages
     from producto p
     join aseguradora a on a.id = p.aseguradora_id and a.activo
     left join producto_cobertura pc on pc.producto_id = p.id and pc.activo
     left join cobertura_base cb on cb.id = pc.cobertura_base_id and cb.activo
     where p.activo and p.aseguradora_id = $1 and p.canal_id = $2
     group by p.id, a.nombre_comercial
     order by p.nombre`,
    [s.insurerId, s.channelId],
  );

  return (
    <AdminPage
      eyebrow="Registrar seguros"
      title="Carga masiva"
      description="Registra varias Órdenes de Emisión a la vez a partir de la plantilla en Excel. Nada se guarda hasta que confirmes."
      action={
        <Link href="/canal/cotizaciones" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-surface-muted">
          <ArrowLeft className="size-4" />Órdenes de Emisión
        </Link>
      }
    >
      <BulkUpload products={rows} />
    </AdminPage>
  );
}
