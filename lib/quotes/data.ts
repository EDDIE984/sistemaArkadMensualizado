import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { QuoteFormData } from "@/lib/quotes/types";

export async function getQuoteFormData(clientId: string, scope?: { insurerId: string; channelId: string }): Promise<QuoteFormData> {
  const db = createAdminClient();
  let productQuery = db
    .from("producto")
    .select(`
      id,nombre,aseguradora!inner(nombre_comercial,activo),canal!inner(nombre,activo),
      aseguradora_ramo!inner(activo,ramo_base!inner(nombre)),
      tipo_vehiculo(id,descripcion),
      riesgo_modelo(marca,modelo),
      riesgo_color(color),
      producto_cobertura(id,valor_o_porcentaje,activo,cobertura_base(nombre,descripcion_generica,activo))
    `)
    .eq("activo", true)
    .eq("canal.activo", true)
    .eq("aseguradora.activo", true)
    .eq("aseguradora_ramo.activo", true)
    .eq("aseguradora_ramo.ramo_base.nombre", "VEHICULO");
  productQuery = scope
    ? productQuery.eq("aseguradora_id", scope.insurerId).eq("canal_id", scope.channelId)
    : productQuery.eq("canal.nombre", "INDIVIDUAL");
  const { data: products, error } = await productQuery;
  if (error) throw error;

  const { data: vehicles, error: vehicleError } = await db
    .from("vehiculo")
    .select("id,tipo_vehiculo_id,marca,modelo,anio,color,valor_asegurado,estado_vh,uso,placa")
    .eq("cliente_id", clientId)
    .order("marca");
  if (vehicleError) throw vehicleError;

  return {
    products: (products || []).map((product) => {
      const insurer = Array.isArray(product.aseguradora) ? product.aseguradora[0] : product.aseguradora;
      return {
        id: product.id,
        name: product.nombre,
        insurerName: insurer?.nombre_comercial || "Aseguradora",
        vehicleTypes: (product.tipo_vehiculo || []).map((item) => ({ id: item.id, description: item.descripcion })),
        models: (product.riesgo_modelo || []).map((item) => ({ brand: item.marca, model: item.modelo })),
        colors: (product.riesgo_color || []).map((item) => item.color).sort(),
        coverages: (product.producto_cobertura || [])
          .filter((item) => item.activo && item.cobertura_base)
          .map((item) => {
            const coverage = Array.isArray(item.cobertura_base) ? item.cobertura_base[0] : item.cobertura_base;
            return {
              id: item.id,
              name: coverage?.nombre || "Cobertura",
              description: coverage?.descripcion_generica || null,
              value: item.valor_o_porcentaje === null ? null : Number(item.valor_o_porcentaje),
            };
          }),
      };
    }),
    vehicles: (vehicles || []).map((vehicle) => ({
      id: vehicle.id,
      typeId: vehicle.tipo_vehiculo_id,
      brand: vehicle.marca,
      model: vehicle.modelo,
      year: vehicle.anio,
      color: vehicle.color,
      insuredValue: Number(vehicle.valor_asegurado),
      status: vehicle.estado_vh,
      use: vehicle.uso,
      plate: vehicle.placa,
    })),
  };
}
