-- ============================================================================
-- CARGA DE CSV DE PARAMETRIZACIÓN — resuelve UUIDs automáticamente
-- ============================================================================
-- CÓMO USAR ESTE SCRIPT (con psql, conectado a tu proyecto de Supabase):
--
--   1) Crea primero tu aseguradora/canal/producto (o usa seed_caso_prueba.sql).
--   2) Copia todos los .csv de la carpeta csv_parametrizacion/ a la máquina
--      donde vas a correr psql.
--   3) Entra a esa carpeta (cd csv_parametrizacion) — el script usa rutas
--      relativas, así que debes ejecutarlo estando parado ahí adentro.
--   4) Conéctate y define el producto_id destino, luego corre este archivo:
--
--        cd csv_parametrizacion
--        psql "postgresql://...tu-connection-string-de-supabase..." \
--          -v producto_id="'TU-UUID-DE-PRODUCTO-AQUI'" \
--          -f ../cargar_parametrizacion_desde_csv.sql
--
--      (reemplaza TU-UUID-DE-PRODUCTO-AQUI por el id real de tu fila en
--      la tabla `producto` — con comillas simples dentro de las dobles,
--      tal como está arriba)
--
-- Qué hace: crea tablas temporales (staging) con las mismas columnas de
-- texto que traen los CSV, las carga con \copy, y luego inserta en las
-- tablas reales resolviendo ciudad_id / tipo_vehiculo_id por nombre.
-- ============================================================================

\set ON_ERROR_STOP on

-- ----------------------------------------------------------------------------
-- 1. TIPO_VEHICULO (no depende de otros catálogos)
-- ----------------------------------------------------------------------------
create temp table stg_tipo_vehiculo (descripcion text);
\copy stg_tipo_vehiculo from 'tipo_vehiculo.csv' with (format csv, header true)

insert into tipo_vehiculo (producto_id, descripcion)
select :producto_id::uuid, descripcion from stg_tipo_vehiculo;

-- ----------------------------------------------------------------------------
-- 2. RIESGO_MODELO
-- ----------------------------------------------------------------------------
create temp table stg_riesgo_modelo (marca text, modelo text, nivel_riesgo int);
\copy stg_riesgo_modelo from 'riesgo_modelo.csv' with (format csv, header true)

insert into riesgo_modelo (producto_id, marca, modelo, nivel_riesgo)
select :producto_id::uuid, marca, modelo, nivel_riesgo from stg_riesgo_modelo;

-- ----------------------------------------------------------------------------
-- 3. RIESGO_CIUDAD (resuelve ciudad_id por nombre contra la tabla ciudad)
-- ----------------------------------------------------------------------------
create temp table stg_riesgo_ciudad (ciudad text, nivel_riesgo int);
\copy stg_riesgo_ciudad from 'riesgo_ciudad.csv' with (format csv, header true)

insert into riesgo_ciudad (producto_id, ciudad_id, nivel_riesgo)
select :producto_id::uuid, c.id, s.nivel_riesgo
from stg_riesgo_ciudad s
join ciudad c on c.nombre = s.ciudad;

-- ----------------------------------------------------------------------------
-- 4. RIESGO_GENERO, RIESGO_USO, RIESGO_MONTO_ASEGURADO
-- ----------------------------------------------------------------------------
create temp table stg_riesgo_genero (genero text, porcentaje_participacion numeric, nivel_riesgo int);
\copy stg_riesgo_genero from 'riesgo_genero.csv' with (format csv, header true)
insert into riesgo_genero (producto_id, genero, porcentaje_participacion, nivel_riesgo)
select :producto_id::uuid, genero, porcentaje_participacion, nivel_riesgo from stg_riesgo_genero;

create temp table stg_riesgo_uso (uso text, nivel_riesgo int);
\copy stg_riesgo_uso from 'riesgo_uso.csv' with (format csv, header true)
insert into riesgo_uso (producto_id, uso, nivel_riesgo)
select :producto_id::uuid, uso, nivel_riesgo from stg_riesgo_uso;

create temp table stg_riesgo_monto (monto_desde numeric, monto_hasta numeric, nivel_riesgo int);
\copy stg_riesgo_monto from 'riesgo_monto_asegurado.csv' with (format csv, header true)
insert into riesgo_monto_asegurado (producto_id, monto_desde, monto_hasta, nivel_riesgo)
select :producto_id::uuid, monto_desde, monto_hasta, nivel_riesgo from stg_riesgo_monto;

-- ----------------------------------------------------------------------------
-- 5. RIESGO_COLOR, RIESGO_ESTADO_CIVIL, RIESGO_EDAD
-- ----------------------------------------------------------------------------
create temp table stg_riesgo_color (color text, nivel_riesgo int);
\copy stg_riesgo_color from 'riesgo_color.csv' with (format csv, header true)
insert into riesgo_color (producto_id, color, nivel_riesgo)
select :producto_id::uuid, color, nivel_riesgo from stg_riesgo_color;

create temp table stg_riesgo_edo_civil (estado_civil text, nivel_riesgo int);
\copy stg_riesgo_edo_civil from 'riesgo_estado_civil.csv' with (format csv, header true)
insert into riesgo_estado_civil (producto_id, estado_civil, nivel_riesgo)
select :producto_id::uuid, estado_civil, nivel_riesgo from stg_riesgo_edo_civil;

create temp table stg_riesgo_edad (edad_desde int, edad_hasta int, nivel_riesgo int);
\copy stg_riesgo_edad from 'riesgo_edad.csv' with (format csv, header true)
insert into riesgo_edad (producto_id, edad_desde, edad_hasta, nivel_riesgo)
select :producto_id::uuid, edad_desde, edad_hasta, nivel_riesgo from stg_riesgo_edad;

-- ----------------------------------------------------------------------------
-- 6. TASA_POR_NIVEL_RIESGO (la escala compartida Alto/Moderado/Bajo)
-- ----------------------------------------------------------------------------
create temp table stg_tasa_nivel (nivel_riesgo int, tasa numeric);
\copy stg_tasa_nivel from 'tasa_por_nivel_riesgo.csv' with (format csv, header true)
insert into tasa_por_nivel_riesgo (producto_id, nivel_riesgo, tasa)
select :producto_id::uuid, nivel_riesgo, tasa from stg_tasa_nivel;

-- ----------------------------------------------------------------------------
-- 7. TABLA_DEPRECIACION, TABLA_PERDIDAS
-- ----------------------------------------------------------------------------
create temp table stg_deprec (tipo text, porcentaje numeric);
\copy stg_deprec from 'tabla_depreciacion.csv' with (format csv, header true)
insert into tabla_depreciacion (producto_id, tipo, porcentaje)
select :producto_id::uuid, tipo, porcentaje from stg_deprec;

create temp table stg_perdidas (nivel_riesgo int, perdidas_parciales text, perdidas_totales text);
\copy stg_perdidas from 'tabla_perdidas.csv' with (format csv, header true)
insert into tabla_perdidas (producto_id, nivel_riesgo, perdidas_parciales, perdidas_totales)
select :producto_id::uuid, nivel_riesgo, perdidas_parciales, perdidas_totales from stg_perdidas;

-- ----------------------------------------------------------------------------
-- 8. TARIFA_BASE (resuelve tipo_vehiculo_id por descripción, ya insertado en el paso 1)
-- ----------------------------------------------------------------------------
create temp table stg_tarifa_base (
    tipo_vehiculo text, tiempo_credito text, riesgo_marca int, riesgo_ciudad int,
    riesgo_genero int, riesgo_uso int, depreciacion numeric, tasa numeric
);
\copy stg_tarifa_base from 'tarifa_base.csv' with (format csv, header true)

insert into tarifa_base (producto_id, tipo_vehiculo_id, tiempo_credito, riesgo_marca, riesgo_ciudad, riesgo_genero, riesgo_uso, depreciacion, tasa)
select :producto_id::uuid, tv.id, s.tiempo_credito, s.riesgo_marca, s.riesgo_ciudad, s.riesgo_genero, s.riesgo_uso, s.depreciacion, s.tasa
from stg_tarifa_base s
join tipo_vehiculo tv on tv.descripcion = s.tipo_vehiculo and tv.producto_id = :producto_id::uuid;

-- ----------------------------------------------------------------------------
-- 9. PARAMETRO_MODELO_MENSUAL, TASA_ANUAL_PRODUCTO
-- ----------------------------------------------------------------------------
create temp table stg_param_mensual (super_bancos_pct numeric, seguro_campesino_pct numeric, derechos_emision_valor numeric, iva_pct numeric);
\copy stg_param_mensual from 'parametro_modelo_mensual.csv' with (format csv, header true)
insert into parametro_modelo_mensual (producto_id, super_bancos_pct, seguro_campesino_pct, derechos_emision_valor, iva_pct)
select :producto_id::uuid, super_bancos_pct, seguro_campesino_pct, derechos_emision_valor, iva_pct from stg_param_mensual;

create temp table stg_tasa_anual (numero_anio int, tasa numeric);
\copy stg_tasa_anual from 'tasa_anual_producto.csv' with (format csv, header true)
insert into tasa_anual_producto (producto_id, numero_anio, tasa)
select :producto_id::uuid, numero_anio, tasa from stg_tasa_anual;

-- ============================================================================
-- FIN — resumen de lo cargado
-- ============================================================================
select 'tipo_vehiculo' as tabla, count(*) from tipo_vehiculo where producto_id = :producto_id::uuid
union all select 'riesgo_modelo', count(*) from riesgo_modelo where producto_id = :producto_id::uuid
union all select 'riesgo_ciudad', count(*) from riesgo_ciudad where producto_id = :producto_id::uuid
union all select 'riesgo_genero', count(*) from riesgo_genero where producto_id = :producto_id::uuid
union all select 'riesgo_uso', count(*) from riesgo_uso where producto_id = :producto_id::uuid
union all select 'riesgo_monto_asegurado', count(*) from riesgo_monto_asegurado where producto_id = :producto_id::uuid
union all select 'riesgo_color', count(*) from riesgo_color where producto_id = :producto_id::uuid
union all select 'riesgo_estado_civil', count(*) from riesgo_estado_civil where producto_id = :producto_id::uuid
union all select 'riesgo_edad', count(*) from riesgo_edad where producto_id = :producto_id::uuid
union all select 'tasa_por_nivel_riesgo', count(*) from tasa_por_nivel_riesgo where producto_id = :producto_id::uuid
union all select 'tabla_depreciacion', count(*) from tabla_depreciacion where producto_id = :producto_id::uuid
union all select 'tabla_perdidas', count(*) from tabla_perdidas where producto_id = :producto_id::uuid
union all select 'tarifa_base', count(*) from tarifa_base where producto_id = :producto_id::uuid
union all select 'parametro_modelo_mensual', count(*) from parametro_modelo_mensual where producto_id = :producto_id::uuid
union all select 'tasa_anual_producto', count(*) from tasa_anual_producto where producto_id = :producto_id::uuid;
