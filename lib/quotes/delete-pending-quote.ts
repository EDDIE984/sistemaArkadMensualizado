import "server-only";

import { getDbPool } from "@/lib/db/pool";
import { INSPECCION_BUCKET } from "@/lib/inspeccion/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeCertificateFiles } from "@/lib/certificates/issue";

export class QuoteDeletionError extends Error {}

/**
 * Elimina físicamente una cotización asistida PENDIENTE del canal (regla en
 * PLATAFORMA_SEGUROS_MODELO_ER.md, punto 7). Coberturas, deducibles,
 * amortización e inspección caen por `on delete cascade`; las fotos de la
 * inspección y el PDF del certificado se borran de Storage después del commit.
 */
export async function deletePendingChannelQuote(input: { quoteId: string; channelId: string }) {
  const connection = await getDbPool().connect();
  let storagePaths: string[] = [];
  let certificatePaths: string[] = [];
  try {
    await connection.query("begin");
    const quote = await connection.query<{ estado: string; tiene_poliza: boolean }>(
      `select c.estado, exists(select 1 from poliza p where p.cotizacion_id = c.id) as tiene_poliza
       from cotizacion c
       where c.id = $1 and c.canal_id = $2
       for update`,
      [input.quoteId, input.channelId],
    );
    if (quote.rowCount !== 1) throw new QuoteDeletionError("La Orden de Emisión no existe o no pertenece a tu canal.");
    const { estado, tiene_poliza } = quote.rows[0];
    if (estado !== "PENDIENTE") throw new QuoteDeletionError(`Solo se pueden eliminar Órdenes de Emisión pendientes (estado actual: ${estado}).`);
    if (tiene_poliza) throw new QuoteDeletionError("La Orden de Emisión ya tiene una póliza emitida y no puede eliminarse.");

    const photos = await connection.query<{ storage_path: string; analizada_storage_path: string | null }>(
      `select f.storage_path, f.analizada_storage_path
       from inspeccion_foto f join inspeccion i on i.id = f.inspeccion_id
       where i.cotizacion_id = $1`,
      [input.quoteId],
    );
    storagePaths = photos.rows.flatMap((p) => [p.storage_path, p.analizada_storage_path]).filter((p): p is string => Boolean(p));

    const certs = await connection.query<{ storage_path: string }>(
      "select storage_path from certificado_cobertura where cotizacion_id = $1",
      [input.quoteId],
    );
    certificatePaths = certs.rows.map((c) => c.storage_path);

    await connection.query("delete from cotizacion where id = $1", [input.quoteId]);
    await connection.query("commit");
  } catch (error) {
    await connection.query("rollback");
    throw error;
  } finally {
    connection.release();
  }

  await removeCertificateFiles(certificatePaths);
  if (storagePaths.length) {
    const { error } = await createAdminClient().storage.from(INSPECCION_BUCKET).remove(storagePaths);
    if (error) console.error("No se pudieron borrar las fotos de inspección", input.quoteId, error.message);
  }
}
