import "server-only";

import { getDbPool } from "@/lib/db/pool";

export class PolicyEmissionError extends Error {}

type QuoteRow = {
  id: string;
  estado: string;
  anios_vigencia: number;
  cuota_fija_mensual: string;
  comision_canal_pct: string | null;
  fecha_inicio_vigencia: string | null;
  fecha_fin_vigencia: string | null;
};

/**
 * Emite la póliza de una cotización PENDIENTE de la aseguradora indicada.
 * La aseguradora sólo aporta el número de póliza; todo lo demás sale de la
 * cotización. Antes de generar la tabla de cobranza revalida que el cálculo
 * completo —incluida la comisión del canal— esté generado. Todo ocurre en una
 * sola transacción: si algo falla no se escribe nada.
 */
export async function emitPolicy(input: { quoteId: string; policyNumber: string; insurerId: string; userId: string }) {
  const number = input.policyNumber.trim();
  if (number.length < 3 || number.length > 40) {
    throw new PolicyEmissionError("El número de póliza debe tener entre 3 y 40 caracteres.");
  }

  const conn = await getDbPool().connect();
  try {
    await conn.query("begin");

    const quoteResult = await conn.query<QuoteRow>(
      `select id, estado, anios_vigencia, cuota_fija_mensual, comision_canal_pct,
              fecha_inicio_vigencia, fecha_fin_vigencia
       from cotizacion
       where id = $1 and aseguradora_id = $2
       for update`,
      [input.quoteId, input.insurerId],
    );
    if (quoteResult.rowCount !== 1) {
      throw new PolicyEmissionError("La cotización no existe o no pertenece a tu aseguradora.");
    }
    const quote = quoteResult.rows[0];

    if (quote.estado !== "PENDIENTE") {
      throw new PolicyEmissionError(`La cotización está en estado ${quote.estado}; sólo se pueden emitir cotizaciones pendientes.`);
    }

    const already = await conn.query("select 1 from poliza where cotizacion_id = $1", [input.quoteId]);
    if (already.rowCount) {
      throw new PolicyEmissionError("Esta cotización ya tiene una póliza emitida.");
    }

    // Revalidar que todo el cálculo (incluida la comisión del canal) esté generado.
    if (quote.comision_canal_pct === null) {
      throw new PolicyEmissionError(
        "La cotización se generó antes del cálculo de comisión del canal. Vuelve a generarla antes de emitir la póliza.",
      );
    }
    const expectedMonths = quote.anios_vigencia * 12;
    const checkResult = await conn.query<{ meses: string; sin_comision: string; descuadre: string }>(
      `select count(*)::text meses,
              count(*) filter (where comision_canal is null)::text sin_comision,
              count(*) filter (where abs(comision_canal - round(prima_neta_mes * $2::numeric, 4)) > 0.01)::text descuadre
       from amortizacion_mensual
       where cotizacion_id = $1`,
      [input.quoteId, quote.comision_canal_pct],
    );
    const check = checkResult.rows[0];
    if (Number(check.meses) !== expectedMonths) {
      throw new PolicyEmissionError(
        `El cronograma de la cotización está incompleto (${check.meses}/${expectedMonths} meses). Vuelve a generar la cotización.`,
      );
    }
    if (Number(check.sin_comision) > 0 || Number(check.descuadre) > 0) {
      throw new PolicyEmissionError(
        "El cálculo de comisión no coincide con la cotización. Vuelve a generar la cotización antes de emitir.",
      );
    }

    let policyId: string;
    let startDate: string;
    try {
      const inserted = await conn.query<{ id: string; fecha_inicio_vigencia: string }>(
        `insert into poliza (cotizacion_id, numero_poliza, fecha_emision, fecha_inicio_vigencia, fecha_fin_vigencia)
         values (
           $1, $2, current_date,
           coalesce($3::date, current_date),
           coalesce($4::date, (coalesce($3::date, current_date) + make_interval(years => $5::int) - interval '1 day')::date)
         )
         returning id, fecha_inicio_vigencia`,
        [input.quoteId, number, quote.fecha_inicio_vigencia, quote.fecha_fin_vigencia, quote.anios_vigencia],
      );
      policyId = inserted.rows[0].id;
      startDate = inserted.rows[0].fecha_inicio_vigencia;
    } catch (error) {
      if (error && typeof error === "object" && (error as { code?: string }).code === "23505") {
        throw new PolicyEmissionError("Ese número de póliza ya está registrado.");
      }
      throw error;
    }

    await conn.query(
      `insert into tabla_cobranza (poliza_id, numero_cuota, fecha_vencimiento, monto)
       select $1, n, ($2::date + make_interval(months => n))::date, $3::numeric
       from generate_series(1, $4::int) n`,
      [policyId, startDate, quote.cuota_fija_mensual, expectedMonths],
    );

    await conn.query("update cotizacion set estado = 'ACEPTADA', fecha_aceptacion = now() where id = $1", [input.quoteId]);

    await conn.query(
      `insert into auditoria (entidad, entidad_id, accion, datos_nuevos, usuario_id) values
         ('POLIZA', $1::uuid, 'CREACION', jsonb_build_object('numero_poliza', $2::text, 'cotizacion_id', $3::uuid::text), $4::uuid),
         ('COTIZACION', $3::uuid, 'CAMBIO_ESTADO', jsonb_build_object('estado', 'ACEPTADA', 'poliza_id', $1::uuid::text), $4::uuid)`,
      [policyId, number, input.quoteId, input.userId],
    );

    await conn.query("commit");
    return { policyId };
  } catch (error) {
    await conn.query("rollback");
    throw error;
  } finally {
    conn.release();
  }
}
