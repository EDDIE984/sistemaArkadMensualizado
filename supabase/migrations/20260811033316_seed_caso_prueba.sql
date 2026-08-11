-- ============================================================================
-- SEED: Caso de prueba del Excel original (COTIZACIÓN!C10:G22)
-- Cliente: JUANITO | Vehículo: Chevrolet Aveo (modelo AMAROK) | Manta
-- 4 años de vigencia | Valor asegurado $40.000 | USADO | PARTICULAR
-- Resultado esperado: tasa_promedio ≈ 0.035556 | cuota_fija ≈ $101,77 | riesgo ALTO
-- ============================================================================
-- Requiere haber corrido antes supabase_schema.sql (usa sus catálogos CIUDAD,
-- PERFIL, RAMO_BASE, PLAN_SUSCRIPCION ya sembrados).
-- ============================================================================

do $$
declare
    v_aseg_id uuid;
    v_plan_id uuid;
    v_aseg_ramo_id uuid;
    v_canal_id uuid;
    v_prod_id uuid;
    v_ciudad_manta uuid;
    v_tipo_veh_particular uuid;
    v_tipo_veh_altagama uuid;
    v_tipo_veh_alquiler uuid;
    v_cliente_id uuid;
    v_vehiculo_id uuid;
    v_cotizacion_id uuid;
    v_poliza_id uuid;
    v_cid uuid;   -- variable temporal para ids de ciudad en loops
begin
    select id into v_ciudad_manta from ciudad where nombre = 'Manta';
    select id into v_plan_id from plan_suscripcion where nombre = 'ENTERPRISE';

    -- 1. Aseguradora, suscripción, ramo, canal, producto ---------------------
    insert into aseguradora (nombre_comercial, razon_social, ruc)
    values ('Aseguradora Demo', 'Aseguradora Demo S.A.', '0999999999001')
    returning id into v_aseg_id;

    insert into aseguradora_suscripcion (aseguradora_id, plan_suscripcion_id)
    values (v_aseg_id, v_plan_id);

    insert into aseguradora_ramo (aseguradora_id, ramo_base_id)
    select v_aseg_id, id from ramo_base where nombre = 'VEHICULO'
    returning id into v_aseg_ramo_id;

    insert into canal (aseguradora_id, nombre)
    values (v_aseg_id, 'INDIVIDUAL')
    returning id into v_canal_id;

    insert into producto (aseguradora_id, canal_id, aseguradora_ramo_id, nombre, aplica_todas_ciudades)
    values (v_aseg_id, v_canal_id, v_aseg_ramo_id, 'Vehicular Individual', true)
    returning id into v_prod_id;

    -- 2. Tipos de vehículo (según TARIFICACIÓN) ------------------------------
    insert into tipo_vehiculo (producto_id, descripcion)
    values (v_prod_id, 'VH USADOS Y NUEVOS LIVIANOS PARTICULARES')
    returning id into v_tipo_veh_particular;

    insert into tipo_vehiculo (producto_id, descripcion)
    values (v_prod_id, 'VH LIVIANOS NUEVOS Y USADOS ALTA GAMA (40.000.00 EN ADELANTE)')
    returning id into v_tipo_veh_altagama;

    insert into tipo_vehiculo (producto_id, descripcion)
    values (v_prod_id, 'VH DE ALQUILER')
    returning id into v_tipo_veh_alquiler;

    -- 3. RIESGO_MODELO (catálogo completo de PARAMETRIZACIÓN!E9:E11) --------
    insert into riesgo_modelo (producto_id, marca, modelo, nivel_riesgo) values
        (v_prod_id, 'Chevrolet', 'Sail', 1),
        (v_prod_id, 'Chevrolet', 'Aveo', 1),
        (v_prod_id, 'Chevrolet', 'D-Max', 1),
        (v_prod_id, 'Suzuki', 'Grand Vitara', 1),
        (v_prod_id, 'Kia', 'Sportage', 1),
        (v_prod_id, 'Hyundai', 'Tucson', 1),
        (v_prod_id, 'Hyundai', 'Accent', 1),
        (v_prod_id, 'Kia', 'Rio', 1),
        (v_prod_id, 'Nissan', 'Sentra', 1),
        (v_prod_id, 'Suzuki', 'Vitara SZ', 1),
        (v_prod_id, 'Mitsubishi', 'Montero', 1),
        (v_prod_id, 'Mazda', 'BT50', 1),
        (v_prod_id, 'Volkswagen', 'Amarok', 1),
        (v_prod_id, 'Ford', 'F150', 1),
        (v_prod_id, 'Volkswagen', 'T-Cross', 2),
        (v_prod_id, 'Volkswagen', 'Nuevo Virtus', 2),
        (v_prod_id, 'Volkswagen', 'Nivus', 2),
        (v_prod_id, 'Toyota', 'Corolla', 2),
        (v_prod_id, 'Nissan', 'Qashqai', 2),
        (v_prod_id, 'Mitsubishi', 'Outlander', 2),
        (v_prod_id, 'Kia', 'K3', 2),
        (v_prod_id, 'Kia', 'K3 Cross', 2),
        (v_prod_id, 'Chevrolet', 'Tracker', 2),
        (v_prod_id, 'Volvo', '(genérico)', 3),
        (v_prod_id, 'BMW', '(genérico)', 3),
        (v_prod_id, 'Mercedes-Benz', '(genérico)', 3),
        (v_prod_id, 'Audi', '(genérico)', 3),
        (v_prod_id, 'Honda', '(genérico)', 3),
        (v_prod_id, 'Subaru', '(genérico)', 3),
        (v_prod_id, 'BYD', '(genérico)', 3),
        (v_prod_id, 'Geely', '(genérico)', 3),
        (v_prod_id, 'Volkswagen', 'Passat', 3),
        (v_prod_id, 'Mazda', 'CX-80', 3),
        (v_prod_id, 'Audi', 'Q6 e-tron', 3),
        (v_prod_id, 'Zeekr', 'X', 3),
        (v_prod_id, 'Maxus', 'eTERRON 9', 3);

    -- 4. RIESGO_CIUDAD (las 21 ciudades ya sembradas en ciudad) -------------
    insert into riesgo_ciudad (producto_id, ciudad_id, nivel_riesgo)
    select v_prod_id, id, 1 from ciudad where nombre in
        ('Guayaquil','Quito','Santo Domingo','Babahoyo','Quevedo','La Maná','Manta','Chone','Portoviejo','Machala');
    insert into riesgo_ciudad (producto_id, ciudad_id, nivel_riesgo)
    select v_prod_id, id, 2 from ciudad where nombre in
        ('Cuenca','Ambato','Ibarra','Riobamba','Latacunga','Guaranda');
    insert into riesgo_ciudad (producto_id, ciudad_id, nivel_riesgo)
    select v_prod_id, id, 3 from ciudad where nombre in
        ('Loja','Tulcán','Baños','Tena','Galápagos');

    -- 5. RIESGO_GENERO, RIESGO_USO, RIESGO_MONTO_ASEGURADO ------------------
    insert into riesgo_genero (producto_id, genero, porcentaje_participacion, nivel_riesgo) values
        (v_prod_id, 'HOMBRE', 85, 1),
        (v_prod_id, 'MUJER', 15, 2);

    insert into riesgo_uso (producto_id, uso, nivel_riesgo) values
        (v_prod_id, 'COMERCIAL', 1),
        (v_prod_id, 'PARTICULAR', 2),
        (v_prod_id, 'CORPORATIVO', 3);

    insert into riesgo_monto_asegurado (producto_id, monto_desde, monto_hasta, nivel_riesgo) values
        (v_prod_id, 0, 20000, 1),
        (v_prod_id, 20001, 30000, 2),
        (v_prod_id, 30001, null, 3);

    -- 6. RIESGO_COLOR, RIESGO_ESTADO_CIVIL, RIESGO_EDAD ----------------------
    -- Nota: "AZUL" aparecía en ALTO y MODERADO en el Excel original; se
    -- conserva solo en ALTO (nivel 1), que es el primero que encuentra el
    -- MATCH de Excel.
    insert into riesgo_color (producto_id, color, nivel_riesgo) values
        (v_prod_id, 'NEGRO', 1), (v_prod_id, 'AMARILLO TAXI', 1), (v_prod_id, 'MARRON', 1),
        (v_prod_id, 'AZUL', 1), (v_prod_id, 'VERDE', 1),
        (v_prod_id, 'ROJO', 2), (v_prod_id, 'GRIS OSCURO', 2),
        (v_prod_id, 'BLANCO', 3), (v_prod_id, 'PLATA', 3);

    insert into riesgo_estado_civil (producto_id, estado_civil, nivel_riesgo) values
        (v_prod_id, 'SOLTERO/A', 1),
        (v_prod_id, 'CASADO/A', 2);

    insert into riesgo_edad (producto_id, edad_desde, edad_hasta, nivel_riesgo) values
        (v_prod_id, 16, 25, 1),
        (v_prod_id, 25, 44, 2),
        (v_prod_id, 45, null, 3);

    -- 7. Escala compartida de tasa por nivel de riesgo (PARAMETRIZACIÓN!B9:B11) --
    insert into tasa_por_nivel_riesgo (producto_id, nivel_riesgo, tasa) values
        (v_prod_id, 1, 0.042),
        (v_prod_id, 2, 0.036),
        (v_prod_id, 3, 0.029);

    -- 8. Depreciación y pérdidas ---------------------------------------------
    insert into tabla_depreciacion (producto_id, tipo, porcentaje) values
        (v_prod_id, 'NUEVO_1ER_ANIO', 0.10),
        (v_prod_id, 'NUEVO_DESDE_2DO', 0.15),
        (v_prod_id, 'USADO_1ER_ANIO', 0.15),
        (v_prod_id, 'USADO_DESDE_2DO', 0.18);

    insert into tabla_perdidas (producto_id, nivel_riesgo, perdidas_parciales, perdidas_totales) values
        (v_prod_id, 1, '20% DEL VALOR DEL SINIESTRO MÍNIMO 700', '20% DEL VALOR ASEGURADO'),
        (v_prod_id, 2, '15% DEL VALOR DEL SINIESTRO MÍNIMO 500', '18% DEL VALOR ASEGURADO'),
        (v_prod_id, 3, '10% DEL VALOR DEL SINIESTRO MÍNIMO 300', '15% DEL VALOR ASEGURADO');

    -- 9. TARIFA_BASE (las 12 filas completas de TARIFICACIÓN) ---------------
    insert into tarifa_base (producto_id, tipo_vehiculo_id, tiempo_credito, riesgo_marca, riesgo_ciudad, riesgo_genero, riesgo_uso, depreciacion, tasa) values
        (v_prod_id, v_tipo_veh_particular, 'HASTA 2 AÑOS', 1, 1, 1, 1, 0.18, 0.036),
        (v_prod_id, v_tipo_veh_particular, 'HASTA 2 AÑOS', 2, 2, 2, 2, 0.15, 0.034),
        (v_prod_id, v_tipo_veh_particular, 'HASTA 2 AÑOS', 3, 3, 3, 3, 0.10, 0.032),
        (v_prod_id, v_tipo_veh_particular, 'HASTA 3 A 5 AÑOS', 1, 1, 1, 1, 0.18, 0.035),
        (v_prod_id, v_tipo_veh_particular, 'HASTA 3 A 5 AÑOS', 2, 2, 2, 2, 0.15, 0.033),
        (v_prod_id, v_tipo_veh_particular, 'HASTA 3 A 5 AÑOS', 3, 3, 3, 3, 0.10, 0.031),
        (v_prod_id, v_tipo_veh_altagama,   'DE 1 A 5 AÑOS',    1, 1, 1, 1, 0.15, 0.029),
        (v_prod_id, v_tipo_veh_altagama,   'DE 1 A 5 AÑOS',    2, 2, 2, 2, 0.15, 0.027),
        (v_prod_id, v_tipo_veh_altagama,   'DE 1 A 5 AÑOS',    3, 3, 3, 3, 0.15, 0.025),
        (v_prod_id, v_tipo_veh_alquiler,   'DE 1 A 5 AÑOS',    1, 1, 1, 1, 0.18, 0.049),
        (v_prod_id, v_tipo_veh_alquiler,   'DE 1 A 5 AÑOS',    2, 2, 2, 1, 0.15, 0.046),
        (v_prod_id, v_tipo_veh_alquiler,   'DE 1 A 5 AÑOS',    3, 3, 3, 1, 0.12, 0.044);

    -- 10. Parámetros del modelo mensual y tasas por año 2-5 ------------------
    insert into parametro_modelo_mensual (producto_id, super_bancos_pct, seguro_campesino_pct, derechos_emision_valor, iva_pct)
    values (v_prod_id, 0.035, 0.005, 0.5, 0.15);

    insert into tasa_anual_producto (producto_id, numero_anio, tasa) values
        (v_prod_id, 2, 0.0352), (v_prod_id, 3, 0.0352), (v_prod_id, 4, 0.0352), (v_prod_id, 5, 0.0352);

    -- 11. Cliente y vehículo del caso de prueba ------------------------------
    insert into cliente (tipo_cliente, nombre_razon_social, identificacion, email, password_hash, ciudad_id, fecha_nacimiento, genero, estado_civil)
    values ('INDIVIDUAL', 'JUANITO', '0999999999', 'juanito@test.com', 'hash_demo', v_ciudad_manta, '1975-06-15', 'HOMBRE', 'CASADO/A')
    returning id into v_cliente_id;
    -- Nota: fecha_nacimiento=1975-06-15 da 50 años en 2026, igual que el Excel (EDAD=50).

    insert into vehiculo (cliente_id, tipo_vehiculo_id, marca, modelo, color, valor_asegurado, estado_vh, uso)
    values (v_cliente_id, v_tipo_veh_particular, 'Chevrolet', 'Amarok', 'PLATA', 40000, 'USADO', 'PARTICULAR')
    returning id into v_vehiculo_id;
    -- Nota: en el Excel, MARCA (display) = "Chevrolet Aveo" y MODELO (el que
    -- realmente dispara el riesgo) = "AMAROK". Aquí se refleja como marca
    -- Chevrolet / modelo Amarok para que el riesgo calce con RIESGO_MODELO
    -- nivel 1 (0.042), igual que el Excel.

    -- 12. Cotización (con los resultados ya calculados y validados en Python) --
    insert into cotizacion (aseguradora_id, producto_id, cliente_id, vehiculo_id, ciudad_id, origen, anios_vigencia, tasa_promedio, nivel_riesgo, cuota_fija_mensual, estado, fecha_aceptacion)
    values (v_aseg_id, v_prod_id, v_cliente_id, v_vehiculo_id, v_ciudad_manta, 'AUTOGESTION', 4, 0.035556, 1, 101.77, 'ACEPTADA', now())
    returning id into v_cotizacion_id;

    -- 13. Amortización mensual (48 filas, calculadas mes a mes) -------------
insert into amortizacion_mensual
  (cotizacion_id, mes, valor_asegurado_mes, prima_neta_mes, super_bancos, seguro_campesino, derechos_emision, subtotal, iva, prima_total_mes, cuota_fija, diferencia, nivelacion_acumulada)
select v_cotizacion_id, * from (values
    (1, 40000.000000, 118.518519, 4.148148, 0.592593, 0.500000, 123.759259, 18.563889, 142.323148, 101.768041, -40.555107, -40.555107),
    (2, 39500.000000, 117.037037, 4.096296, 0.585185, 0.500000, 122.218519, 18.332778, 140.551296, 101.768041, -38.783256, -79.338363),
    (3, 39000.000000, 115.555556, 4.044444, 0.577778, 0.500000, 120.677778, 18.101667, 138.779444, 101.768041, -37.011404, -116.349767),
    (4, 38500.000000, 114.074074, 3.992593, 0.570370, 0.500000, 119.137037, 17.870556, 137.007593, 101.768041, -35.239552, -151.589319),
    (5, 38000.000000, 112.592593, 3.940741, 0.562963, 0.500000, 117.596296, 17.639444, 135.235741, 101.768041, -33.467700, -185.057019),
    (6, 37500.000000, 111.111111, 3.888889, 0.555556, 0.500000, 116.055556, 17.408333, 133.463889, 101.768041, -31.695848, -216.752867),
    (7, 37000.000000, 109.629630, 3.837037, 0.548148, 0.500000, 114.514815, 17.177222, 131.692037, 101.768041, -29.923996, -246.676863),
    (8, 36500.000000, 108.148148, 3.785185, 0.540741, 0.500000, 112.974074, 16.946111, 129.920185, 101.768041, -28.152144, -274.829008),
    (9, 36000.000000, 106.666667, 3.733333, 0.533333, 0.500000, 111.433333, 16.715000, 128.148333, 101.768041, -26.380293, -301.209300),
    (10, 35500.000000, 105.185185, 3.681481, 0.525926, 0.500000, 109.892593, 16.483889, 126.376481, 101.768041, -24.608441, -325.817741),
    (11, 35000.000000, 103.703704, 3.629630, 0.518519, 0.500000, 108.351852, 16.252778, 124.604630, 101.768041, -22.836589, -348.654330),
    (12, 34500.000000, 102.222222, 3.577778, 0.511111, 0.500000, 106.811111, 16.021667, 122.832778, 101.768041, -21.064737, -369.719067),
    (13, 34000.000000, 99.733333, 3.490667, 0.498667, 0.500000, 104.222667, 15.633400, 119.856067, 101.768041, -18.088026, -387.807093),
    (14, 33490.000000, 98.237333, 3.438307, 0.491187, 0.500000, 102.666827, 15.400024, 118.066851, 101.768041, -16.298810, -404.105903),
    (15, 32980.000000, 96.741333, 3.385947, 0.483707, 0.500000, 101.110987, 15.166648, 116.277635, 101.768041, -14.509594, -418.615497),
    (16, 32470.000000, 95.245333, 3.333587, 0.476227, 0.500000, 99.555147, 14.933272, 114.488419, 101.768041, -12.720378, -431.335875),
    (17, 31960.000000, 93.749333, 3.281227, 0.468747, 0.500000, 97.999307, 14.699896, 112.699203, 101.768041, -10.931162, -442.267037),
    (18, 31450.000000, 92.253333, 3.228867, 0.461267, 0.500000, 96.443467, 14.466520, 110.909987, 101.768041, -9.141946, -451.408983),
    (19, 30940.000000, 90.757333, 3.176507, 0.453787, 0.500000, 94.887627, 14.233144, 109.120771, 101.768041, -7.352730, -458.761713),
    (20, 30430.000000, 89.261333, 3.124147, 0.446307, 0.500000, 93.331787, 13.999768, 107.331555, 101.768041, -5.563514, -464.325227),
    (21, 29920.000000, 87.765333, 3.071787, 0.438827, 0.500000, 91.775947, 13.766392, 105.542339, 101.768041, -3.774298, -468.099525),
    (22, 29410.000000, 86.269333, 3.019427, 0.431347, 0.500000, 90.220107, 13.533016, 103.753123, 101.768041, -1.985082, -470.084607),
    (23, 28900.000000, 84.773333, 2.967067, 0.423867, 0.500000, 88.664267, 13.299640, 101.963907, 101.768041, -0.195866, -470.280473),
    (24, 28390.000000, 83.277333, 2.914707, 0.416387, 0.500000, 87.108427, 13.066264, 100.174691, 101.768041, 1.593350, -468.687123),
    (25, 27880.000000, 81.781333, 2.862347, 0.408907, 0.500000, 85.552587, 12.832888, 98.385475, 101.768041, 3.382566, -465.304557),
    (26, 27461.800000, 80.554613, 2.819411, 0.402773, 0.500000, 84.276798, 12.641520, 96.918318, 101.768041, 4.849723, -460.454834),
    (27, 27043.600000, 79.327893, 2.776476, 0.396639, 0.500000, 83.001009, 12.450151, 95.451160, 101.768041, 6.316880, -454.137954),
    (28, 26625.400000, 78.101173, 2.733541, 0.390506, 0.500000, 81.725220, 12.258783, 93.984003, 101.768041, 7.784037, -446.353916),
    (29, 26207.200000, 76.874453, 2.690606, 0.384372, 0.500000, 80.449431, 12.067415, 92.516846, 101.768041, 9.251195, -437.102722),
    (30, 25789.000000, 75.647733, 2.647671, 0.378239, 0.500000, 79.173643, 11.876046, 91.049689, 101.768041, 10.718352, -426.384370),
    (31, 25370.800000, 74.421013, 2.604735, 0.372105, 0.500000, 77.897854, 11.684678, 89.582532, 101.768041, 12.185509, -414.198861),
    (32, 24952.600000, 73.194293, 2.561800, 0.365971, 0.500000, 76.622065, 11.493310, 88.115375, 101.768041, 13.652666, -400.546196),
    (33, 24534.400000, 71.967573, 2.518865, 0.359838, 0.500000, 75.346276, 11.301941, 86.648218, 101.768041, 15.119823, -385.426373),
    (34, 24116.200000, 70.740853, 2.475930, 0.353704, 0.500000, 74.070487, 11.110573, 85.181061, 101.768041, 16.586980, -368.839392),
    (35, 23698.000000, 69.514133, 2.432995, 0.347571, 0.500000, 72.794699, 10.919205, 83.713903, 101.768041, 18.054137, -350.785255),
    (36, 23279.800000, 68.287413, 2.390059, 0.341437, 0.500000, 71.518910, 10.727836, 82.246746, 101.768041, 19.521294, -331.263961),
    (37, 22861.600000, 67.060693, 2.347124, 0.335303, 0.500000, 70.243121, 10.536468, 80.779589, 101.768041, 20.988451, -310.275509),
    (38, 22518.676000, 66.054783, 2.311917, 0.330274, 0.500000, 69.196974, 10.379546, 79.576520, 101.768041, 22.191520, -288.083989),
    (39, 22175.752000, 65.048873, 2.276711, 0.325244, 0.500000, 68.150827, 10.222624, 78.373452, 101.768041, 23.394589, -264.689400),
    (40, 21832.828000, 64.042962, 2.241504, 0.320215, 0.500000, 67.104681, 10.065702, 77.170383, 101.768041, 24.597658, -240.091742),
    (41, 21489.904000, 63.037052, 2.206297, 0.315185, 0.500000, 66.058534, 9.908780, 75.967314, 101.768041, 25.800727, -214.291015),
    (42, 21146.980000, 62.031141, 2.171090, 0.310156, 0.500000, 65.012387, 9.751858, 74.764245, 101.768041, 27.003796, -187.287220),
    (43, 20804.056000, 61.025231, 2.135883, 0.305126, 0.500000, 63.966240, 9.594936, 73.561176, 101.768041, 28.206864, -159.080355),
    (44, 20461.132000, 60.019321, 2.100676, 0.300097, 0.500000, 62.920093, 9.438014, 72.358107, 101.768041, 29.409933, -129.670422),
    (45, 20118.208000, 59.013410, 2.065469, 0.295067, 0.500000, 61.873947, 9.281092, 71.155039, 101.768041, 30.613002, -99.057420),
    (46, 19775.284000, 58.007500, 2.030262, 0.290037, 0.500000, 60.827800, 9.124170, 69.951970, 101.768041, 31.816071, -67.241349),
    (47, 19432.360000, 57.001589, 1.995056, 0.285008, 0.500000, 59.781653, 8.967248, 68.748901, 101.768041, 33.019140, -34.222209),
    (48, 19089.436000, 55.995679, 1.959849, 0.279978, 0.500000, 58.735506, 8.810326, 67.545832, 101.768041, 34.222209, 0.000000)
) as t(mes, valor_asegurado_mes, prima_neta_mes, super_bancos, seguro_campesino, derechos_emision, subtotal, iva, prima_total_mes, cuota_fija, diferencia, nivelacion_acumulada);

    -- 14. Póliza y cronograma de cobranza ------------------------------------
    insert into poliza (cotizacion_id, numero_poliza, fecha_inicio_vigencia, fecha_fin_vigencia)
    values (v_cotizacion_id, 'POL-DEMO-0001', current_date, current_date + interval '4 years')
    returning id into v_poliza_id;

    insert into tabla_cobranza (poliza_id, numero_cuota, fecha_vencimiento, monto)
    select v_poliza_id, n, current_date + (n || ' months')::interval, 101.77
    from generate_series(1, 48) n;

    raise notice 'Caso de prueba cargado OK — cotizacion_id=%, poliza_id=%', v_cotizacion_id, v_poliza_id;
end $$;
