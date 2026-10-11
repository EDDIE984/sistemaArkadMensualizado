import "server-only";

import type { PoolClient } from "pg";

export type CertificateData = {
  quoteId: string;
  number: string;
  issuedAt: Date;
  insurer: string;
  product: string;
  channel: string;
  client: { name: string; identification: string; email: string; phone: string; city: string };
  vehicle: { brand: string; model: string; year: number; color: string; plate: string | null; use: string; status: string; insuredValue: number };
  term: { years: number; start: string | null; end: string | null; installments: number };
  coverages: { name: string; value: number | null }[];
  monthlyPayment: number;
  totalTerm: number;
};

/**
 * Lee los datos del certificado con la conexión/transacción en curso, para
 * poder generarlo antes de confirmar la cotización.
 */
export async function loadCertificateData(conn: PoolClient, quoteId: string, number: string): Promise<CertificateData> {
  const { rows } = await conn.query(
    `select c.id, c.anios_vigencia, c.fecha_inicio_vigencia::text as inicio, c.fecha_fin_vigencia::text as fin,
            c.cuota_fija_mensual,
            a.nombre_comercial as aseguradora, p.nombre as producto, coalesce(ca.nombre, '') as canal,
            cl.nombre_razon_social, cl.identificacion, cl.email, cl.telefono, ci.nombre as ciudad,
            v.marca, v.modelo, v.anio, v.color, v.placa, v.uso, v.estado_vh, v.valor_asegurado,
            (select count(*) from amortizacion_mensual m where m.cotizacion_id = c.id)::int as cuotas,
            (select coalesce(sum(m.cuota_fija), 0) from amortizacion_mensual m where m.cotizacion_id = c.id) as total
     from cotizacion c
     join aseguradora a on a.id = c.aseguradora_id
     join producto p on p.id = c.producto_id
     left join canal ca on ca.id = c.canal_id
     join cliente cl on cl.id = c.cliente_id
     left join ciudad ci on ci.id = coalesce(cl.ciudad_id, c.ciudad_id)
     join vehiculo v on v.id = c.vehiculo_id
     where c.id = $1`,
    [quoteId],
  );
  if (!rows.length) throw new Error("No existe la cotización para el certificado.");
  const r = rows[0];
  const coverages = await conn.query<{ name: string; value: string | null }>(
    `select cb.nombre as name, coalesce(cc.valor_aplicado, pc.valor_o_porcentaje) as value
     from cotizacion_cobertura cc
     join producto_cobertura pc on pc.id = cc.producto_cobertura_id
     join cobertura_base cb on cb.id = pc.cobertura_base_id
     where cc.cotizacion_id = $1
     order by pc.orden, cb.nombre`,
    [quoteId],
  );
  return {
    quoteId,
    number,
    issuedAt: new Date(),
    insurer: r.aseguradora,
    product: r.producto,
    channel: r.canal,
    client: { name: r.nombre_razon_social, identification: r.identificacion ?? "", email: r.email ?? "", phone: r.telefono ?? "", city: r.ciudad ?? "" },
    vehicle: {
      brand: r.marca, model: r.modelo, year: Number(r.anio), color: r.color ?? "", plate: r.placa,
      use: r.uso ?? "", status: r.estado_vh ?? "", insuredValue: Number(r.valor_asegurado),
    },
    term: { years: Number(r.anios_vigencia), start: r.inicio, end: r.fin, installments: Number(r.cuotas) },
    coverages: coverages.rows.map((c) => ({ name: c.name, value: c.value === null ? null : Number(c.value) })),
    monthlyPayment: Number(r.cuota_fija_mensual),
    totalTerm: Number(r.total),
  };
}
