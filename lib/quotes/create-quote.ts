import "server-only";

import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/db/pool";

export type CreateQuoteInput = {
  clientId: string;
  productId: string;
  existingVehicleId?: string;
  vehicleTypeId?: string;
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  insuredValue?: number;
  vehicleStatus?: "NUEVO" | "USADO";
  use?: "COMERCIAL" | "PARTICULAR" | "CORPORATIVO";
  plate?: string;
  durationYears: number;
  coverageIds: string[];
  assistedBy?: { userId: string; insurerId: string; channelId: string };
  coverageStartDate?: string;
};

type ClientProfile = {
  ciudad_id: string;
  fecha_nacimiento: string;
  genero: "HOMBRE" | "MUJER";
  estado_civil: string;
};

type Vehicle = {
  id: string;
  tipo_vehiculo_id: string;
  marca: string;
  modelo: string;
  color: string;
  valor_asegurado: string;
  estado_vh: "NUEVO" | "USADO";
  uso: "COMERCIAL" | "PARTICULAR" | "CORPORATIVO";
};

export class QuoteConfigurationError extends Error {}

async function one<T>(client: PoolClient, sql: string, values: unknown[], label: string): Promise<T> {
  const result = await client.query<T & Record<string, unknown>>(sql, values);
  if (result.rowCount !== 1) throw new QuoteConfigurationError(`No existe configuración para ${label}.`);
  return result.rows[0] as T;
}

export async function createSelfServiceQuote(input: CreateQuoteInput) {
  if (input.assistedBy && !input.coverageStartDate) throw new QuoteConfigurationError("Define la fecha de inicio de vigencia.");
  const connection = await getDbPool().connect();
  try {
    await connection.query("begin");

    const profile = await one<ClientProfile>(connection, `
      select ciudad_id, fecha_nacimiento, genero, estado_civil
      from cliente
      where id=$1 and activo=true and estado_registro = any($2::text[])
        and identificacion is not null and telefono is not null
        and ciudad_id is not null and fecha_nacimiento is not null
        and genero is not null and estado_civil is not null
      for update
    `, [input.clientId, input.assistedBy ? ["ACTIVO","SIN_ACCESO"] : ["ACTIVO"]], "el perfil completo del cliente");

    const product = await one<{ aseguradora_id: string; canal_id: string }>(connection, `
      select p.aseguradora_id,p.canal_id
      from producto p
      join aseguradora a on a.id=p.aseguradora_id and a.activo=true
      join canal c on c.id=p.canal_id and c.activo=true
      join aseguradora_ramo ar on ar.id=p.aseguradora_ramo_id and ar.activo=true
      join ramo_base rb on rb.id=ar.ramo_base_id and rb.nombre='VEHICULO'
      where p.id=$1 and p.activo=true
        and ($3::uuid is null or p.aseguradora_id=$3)
        and ($4::uuid is null or p.canal_id=$4)
        and ($4::uuid is not null or c.nombre='INDIVIDUAL')
        and (p.aplica_todas_ciudades=true or exists (
          select 1 from producto_ciudad pc where pc.producto_id=p.id and pc.ciudad_id=$2
        ))
    `, [input.productId, profile.ciudad_id, input.assistedBy?.insurerId || null, input.assistedBy?.channelId || null], "un producto disponible para el canal y la ciudad del cliente");

    if (input.assistedBy) {
      await one(connection, `select 1 from canal_cliente where canal_id=$1 and cliente_id=$2`, [input.assistedBy.channelId,input.clientId], "la vinculación del cliente con el canal");
    }

    let vehicle: Vehicle;
    if (input.existingVehicleId) {
      vehicle = await one<Vehicle>(connection, `
        select v.id,v.tipo_vehiculo_id,v.marca,v.modelo,v.color,v.valor_asegurado,v.estado_vh,v.uso
        from vehiculo v join tipo_vehiculo tv on tv.id=v.tipo_vehiculo_id and tv.producto_id=$3
        where v.id=$1 and v.cliente_id=$2 and v.color is not null
      `, [input.existingVehicleId, input.clientId, input.productId], "el vehículo seleccionado para este producto");
    } else {
      const inserted = await connection.query<Vehicle>(`
        insert into vehiculo (
          cliente_id,tipo_vehiculo_id,marca,modelo,anio,color,valor_asegurado,estado_vh,uso,placa
        )
        select $1,tv.id,$3,$4,$5,$6,$7,$8,$9,nullif($10,'')
        from tipo_vehiculo tv where tv.id=$2 and tv.producto_id=$11
        returning id,tipo_vehiculo_id,marca,modelo,color,valor_asegurado,estado_vh,uso
      `, [input.clientId, input.vehicleTypeId, input.brand, input.model, input.year, input.color,
        input.insuredValue, input.vehicleStatus, input.use, input.plate || "", input.productId]);
      if (inserted.rowCount !== 1) throw new QuoteConfigurationError("El tipo de vehículo no pertenece al producto seleccionado.");
      vehicle = inserted.rows[0];
    }

    const ageResult = await one<{ edad: number }>(connection,
      "select extract(year from age(current_date,$1::date))::int as edad",
      [profile.fecha_nacimiento], "la edad del cliente");
    if (ageResult.edad < 16) throw new QuoteConfigurationError("El titular debe tener al menos 16 años para cotizar.");

    const [modelRisk, cityRisk, genderRisk, useRisk, amountRisk, colorRisk, maritalRisk, ageRisk] = await Promise.all([
      one<{ nivel_riesgo: number }>(connection, `select nivel_riesgo from riesgo_modelo where producto_id=$1 and lower(marca)=lower($2) and lower(modelo)=lower($3) limit 1`, [input.productId, vehicle.marca, vehicle.modelo], "el modelo del vehículo"),
      one<{ nivel_riesgo: number }>(connection, `select nivel_riesgo from riesgo_ciudad where producto_id=$1 and ciudad_id=$2`, [input.productId, profile.ciudad_id], "la ciudad"),
      one<{ nivel_riesgo: number }>(connection, `select nivel_riesgo from riesgo_genero where producto_id=$1 and genero=$2`, [input.productId, profile.genero], "el género"),
      one<{ nivel_riesgo: number }>(connection, `select nivel_riesgo from riesgo_uso where producto_id=$1 and uso=$2`, [input.productId, vehicle.uso], "el uso del vehículo"),
      one<{ nivel_riesgo: number }>(connection, `select nivel_riesgo from riesgo_monto_asegurado where producto_id=$1 and monto_desde <= $2 and (monto_hasta is null or monto_hasta >= $2) order by monto_desde desc limit 1`, [input.productId, vehicle.valor_asegurado], "el valor asegurado"),
      one<{ nivel_riesgo: number }>(connection, `select nivel_riesgo from riesgo_color where producto_id=$1 and upper(color)=upper($2)`, [input.productId, vehicle.color], "el color"),
      one<{ nivel_riesgo: number }>(connection, `select nivel_riesgo from riesgo_estado_civil where producto_id=$1 and upper(estado_civil)=upper($2)`, [input.productId, profile.estado_civil], "el estado civil"),
      one<{ nivel_riesgo: number }>(connection, `select nivel_riesgo from riesgo_edad where producto_id=$1 and edad_desde <= $2 and (edad_hasta is null or edad_hasta >= $2) order by edad_desde desc limit 1`, [input.productId, ageResult.edad], "la edad"),
    ]);

    const levels = [modelRisk, useRisk, cityRisk, genderRisk, colorRisk, maritalRisk, ageRisk, amountRisk]
      .map((item) => Number(item.nivel_riesgo));
    const rateRows = await connection.query<{ nivel_riesgo: number; tasa: string }>(
      "select nivel_riesgo,tasa from tasa_por_nivel_riesgo where producto_id=$1", [input.productId]);
    const rates = new Map(rateRows.rows.map((row) => [Number(row.nivel_riesgo), Number(row.tasa)]));
    const sharedRates = levels.map((level) => rates.get(level));
    if (sharedRates.some((rate) => rate === undefined)) throw new QuoteConfigurationError("Falta la escala de tasas del producto.");

    const timeBand = input.durationYears <= 2 ? "HASTA 2 AÑOS" : "HASTA 3 A 5 AÑOS";
    const baseRate = await one<{ tasa: string }>(connection, `
      select tasa from tarifa_base
      where producto_id=$1 and tipo_vehiculo_id=$2
        and tiempo_credito in ($3,'DE 1 A 5 AÑOS')
        and riesgo_marca=$4 and riesgo_ciudad=$5 and riesgo_genero=$6 and riesgo_uso=$7
      order by case when tiempo_credito=$3 then 0 else 1 end limit 1
    `, [input.productId, vehicle.tipo_vehiculo_id, timeBand, modelRisk.nivel_riesgo,
      cityRisk.nivel_riesgo, genderRisk.nivel_riesgo, useRisk.nivel_riesgo], "la tarifa base");
    const averageRate = ([...(sharedRates as number[]), Number(baseRate.tasa)]).reduce((sum, rate) => sum + rate, 0) / 9;

    const params = await one<{ super_bancos_pct: string; seguro_campesino_pct: string; derechos_emision_valor: string; iva_pct: string }>(connection,
      "select super_bancos_pct,seguro_campesino_pct,derechos_emision_valor,iva_pct from parametro_modelo_mensual where producto_id=$1",
      [input.productId], "los parámetros mensuales");
    const depreciationRows = await connection.query<{ tipo: string; porcentaje: string }>(
      "select tipo,porcentaje from tabla_depreciacion where producto_id=$1", [input.productId]);
    const depreciation = new Map(depreciationRows.rows.map((row) => [row.tipo, Number(row.porcentaje)]));
    const annualRateRows = await connection.query<{ numero_anio: number; tasa: string }>(
      "select numero_anio,tasa from tasa_anual_producto where producto_id=$1 order by numero_anio", [input.productId]);
    const annualRates = new Map(annualRateRows.rows.map((row) => [Number(row.numero_anio), Number(row.tasa)]));

    const firstDepKey = `${vehicle.estado_vh}_1ER_ANIO`;
    const laterDepKey = `${vehicle.estado_vh}_DESDE_2DO`;
    if (!depreciation.has(firstDepKey) || !depreciation.has(laterDepKey)) throw new QuoteConfigurationError("Falta la tabla de depreciación del producto.");

    let lastConfiguredRate = averageRate;
    let yearStartValue = Number(vehicle.valor_asegurado);
    const monthlyRows: Array<Record<string, number>> = [];
    for (let year = 1; year <= input.durationYears; year += 1) {
      const configuredRate = year === 1 ? averageRate : annualRates.get(year);
      if (configuredRate !== undefined) lastConfiguredRate = configuredRate;
      const annualRate = configuredRate ?? lastConfiguredRate;
      const depreciationRate = depreciation.get(year === 1 ? firstDepKey : laterDepKey)!;
      const monthlyDepreciation = yearStartValue * depreciationRate / 12;
      for (let monthInYear = 0; monthInYear < 12; monthInYear += 1) {
        const insuredValue = yearStartValue - monthlyDepreciation * monthInYear;
        const netPremium = insuredValue * annualRate / 12;
        const banks = netPremium * Number(params.super_bancos_pct);
        const farmerInsurance = netPremium * Number(params.seguro_campesino_pct);
        const issuance = Number(params.derechos_emision_valor);
        const subtotal = netPremium + banks + farmerInsurance + issuance;
        const vat = subtotal * Number(params.iva_pct);
        monthlyRows.push({ insuredValue, netPremium, banks, farmerInsurance, issuance, subtotal, vat, total: subtotal + vat });
      }
      yearStartValue -= yearStartValue * depreciationRate;
    }
    const fixedPayment = monthlyRows.reduce((sum, row) => sum + row.total, 0) / monthlyRows.length;

    const coverageResult = await connection.query<{ id: string; valor_o_porcentaje: string | null }>(`
      select id,valor_o_porcentaje from producto_cobertura
      where producto_id=$1 and activo=true and id=any($2::uuid[])
    `, [input.productId, input.coverageIds]);
    if (coverageResult.rowCount !== input.coverageIds.length) throw new QuoteConfigurationError("Una de las coberturas seleccionadas ya no está disponible.");

    const quoteResult = await connection.query<{ id: string }>(`
      insert into cotizacion (
        aseguradora_id,producto_id,cliente_id,vehiculo_id,usuario_id,canal_id,ciudad_id,origen,
        anios_vigencia,tasa_promedio,nivel_riesgo,cuota_fija_mensual,
        fecha_inicio_vigencia,fecha_fin_vigencia,estado
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::date,
        case when $13::date is null then null else ($13::date + make_interval(years=>$9) - interval '1 day')::date end,
        'PENDIENTE') returning id
    `, [product.aseguradora_id, input.productId, input.clientId, vehicle.id,
      input.assistedBy?.userId || null,input.assistedBy?.channelId || null,profile.ciudad_id,
      input.assistedBy ? "CANAL" : "AUTOGESTION",input.durationYears, averageRate, modelRisk.nivel_riesgo, fixedPayment,
      input.coverageStartDate || null]);
    const quoteId = quoteResult.rows[0].id;

    const quoteCoverageIds: string[] = [];
    for (const coverage of coverageResult.rows) {
      const insertedCoverage = await connection.query<{ id: string }>(`
        insert into cotizacion_cobertura (cotizacion_id,producto_cobertura_id,valor_aplicado)
        values ($1,$2,$3) returning id
      `, [quoteId, coverage.id, coverage.valor_o_porcentaje]);
      quoteCoverageIds.push(insertedCoverage.rows[0].id);
    }

    const deductibleRows = await connection.query<{ id: string; producto_cobertura_id: string | null; valor: string }>(`
      select id,producto_cobertura_id,valor from producto_deducible
      where producto_id=$1 and activo=true
        and (producto_cobertura_id is null or producto_cobertura_id=any($2::uuid[]))
    `, [input.productId, input.coverageIds]);
    for (const deductible of deductibleRows.rows) {
      const coverageIndex = deductible.producto_cobertura_id ? input.coverageIds.indexOf(deductible.producto_cobertura_id) : -1;
      await connection.query(`
        insert into cotizacion_deducible (
          cotizacion_id,producto_deducible_id,cotizacion_cobertura_id,valor_aplicado
        ) values ($1,$2,$3,$4)
      `, [quoteId, deductible.id, coverageIndex >= 0 ? quoteCoverageIds[coverageIndex] : null, deductible.valor]);
    }

    let accumulated = 0;
    for (let index = 0; index < monthlyRows.length; index += 1) {
      const row = monthlyRows[index];
      const difference = fixedPayment - row.total;
      accumulated += difference;
      await connection.query(`
        insert into amortizacion_mensual (
          cotizacion_id,mes,valor_asegurado_mes,prima_neta_mes,super_bancos,
          seguro_campesino,derechos_emision,subtotal,iva,prima_total_mes,
          cuota_fija,diferencia,nivelacion_acumulada
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `, [quoteId,index+1,row.insuredValue,row.netPremium,row.banks,row.farmerInsurance,
        row.issuance,row.subtotal,row.vat,row.total,fixedPayment,difference,accumulated]);
    }

    await connection.query(`
      insert into auditoria (entidad,entidad_id,accion,datos_nuevos,usuario_id)
      values ('COTIZACION',$1,'CREACION',jsonb_build_object(
        'origen',$3::text,'cliente_id',$2::text,'canal_id',$4::text,'estado','PENDIENTE'
      ),$5)
    `, [quoteId, input.clientId,input.assistedBy ? "CANAL" : "AUTOGESTION",input.assistedBy?.channelId || null,input.assistedBy?.userId || null]);

    await connection.query("commit");
    return quoteId;
  } catch (error) {
    await connection.query("rollback");
    throw error;
  } finally {
    connection.release();
  }
}
