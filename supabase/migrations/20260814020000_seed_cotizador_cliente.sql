-- Configuración idempotente del producto demo para cotización en autogestión.
-- No crea clientes, cotizaciones, pólizas ni pagos.

do $$
declare
    v_aseg uuid;
    v_plan uuid;
    v_ramo uuid;
    v_aseg_ramo uuid;
    v_canal uuid;
    v_producto uuid;
    v_tipo_particular uuid;
    v_tipo_alta_gama uuid;
    v_tipo_alquiler uuid;
    v_cobertura_total uuid;
    v_cobertura_rc uuid;
    v_deducible uuid;
begin
    select id into v_plan from plan_suscripcion where nombre = 'ENTERPRISE';
    select id into v_ramo from ramo_base where nombre = 'VEHICULO';

    insert into aseguradora (nombre_comercial, razon_social, ruc)
    values ('Aseguradora Demo', 'Aseguradora Demo S.A.', '0999999999001')
    on conflict (ruc) do update set activo = true
    returning id into v_aseg;

    if not exists (
        select 1 from aseguradora_suscripcion
        where aseguradora_id = v_aseg and estado = 'ACTIVA'
    ) then
        insert into aseguradora_suscripcion (aseguradora_id, plan_suscripcion_id)
        values (v_aseg, v_plan);
    end if;

    insert into aseguradora_ramo (aseguradora_id, ramo_base_id, activo)
    values (v_aseg, v_ramo, true)
    on conflict (aseguradora_id, ramo_base_id) do update set activo = true
    returning id into v_aseg_ramo;

    insert into canal (aseguradora_id, nombre, descripcion, activo)
    values (v_aseg, 'INDIVIDUAL', 'Cotización directa para clientes', true)
    on conflict (aseguradora_id, nombre) do update set activo = true
    returning id into v_canal;

    select id into v_producto from producto
    where aseguradora_id = v_aseg and canal_id = v_canal
      and nombre = 'Vehicular Individual'
    order by creado_en limit 1;

    if v_producto is null then
        insert into producto (
            aseguradora_id, canal_id, aseguradora_ramo_id, nombre,
            aplica_todas_ciudades, activo
        ) values (
            v_aseg, v_canal, v_aseg_ramo, 'Vehicular Individual', true, true
        ) returning id into v_producto;
    else
        update producto set activo = true, aplica_todas_ciudades = true,
            aseguradora_ramo_id = v_aseg_ramo
        where id = v_producto;
    end if;

    insert into tipo_vehiculo (producto_id, descripcion)
    select v_producto, x.descripcion
    from (values
        ('VH USADOS Y NUEVOS LIVIANOS PARTICULARES'),
        ('VH LIVIANOS NUEVOS Y USADOS ALTA GAMA (40.000.00 EN ADELANTE)'),
        ('VH DE ALQUILER')
    ) x(descripcion)
    where not exists (
        select 1 from tipo_vehiculo t
        where t.producto_id = v_producto and t.descripcion = x.descripcion
    );

    select id into v_tipo_particular from tipo_vehiculo
    where producto_id = v_producto and descripcion = 'VH USADOS Y NUEVOS LIVIANOS PARTICULARES' limit 1;
    select id into v_tipo_alta_gama from tipo_vehiculo
    where producto_id = v_producto and descripcion like 'VH LIVIANOS NUEVOS Y USADOS ALTA GAMA%' limit 1;
    select id into v_tipo_alquiler from tipo_vehiculo
    where producto_id = v_producto and descripcion = 'VH DE ALQUILER' limit 1;

    insert into riesgo_modelo (producto_id, marca, modelo, nivel_riesgo)
    select v_producto, x.marca, x.modelo, x.nivel
    from (values
        ('Chevrolet','Sail',1), ('Chevrolet','Aveo',1), ('Chevrolet','D-Max',1),
        ('Suzuki','Grand Vitara',1), ('Kia','Sportage',1), ('Hyundai','Tucson',1),
        ('Hyundai','Accent',1), ('Kia','Rio',1), ('Nissan','Sentra',1),
        ('Suzuki','Vitara SZ',1), ('Mitsubishi','Montero',1), ('Mazda','BT50',1),
        ('Volkswagen','Amarok',1), ('Ford','F150',1),
        ('Volkswagen','T-Cross',2), ('Volkswagen','Nuevo Virtus',2),
        ('Volkswagen','Nivus',2), ('Toyota','Corolla',2), ('Nissan','Qashqai',2),
        ('Mitsubishi','Outlander',2), ('Kia','K3',2), ('Kia','K3 Cross',2),
        ('Chevrolet','Tracker',2), ('Volvo','(genérico)',3), ('BMW','(genérico)',3),
        ('Mercedes-Benz','(genérico)',3), ('Audi','(genérico)',3),
        ('Honda','(genérico)',3), ('Subaru','(genérico)',3), ('BYD','(genérico)',3),
        ('Geely','(genérico)',3), ('Volkswagen','Passat',3), ('Mazda','CX-80',3),
        ('Audi','Q6 e-tron',3), ('Zeekr','X',3), ('Maxus','eTERRON 9',3)
    ) x(marca, modelo, nivel)
    where not exists (
        select 1 from riesgo_modelo r where r.producto_id = v_producto
          and lower(r.marca) = lower(x.marca) and lower(r.modelo) = lower(x.modelo)
    );

    insert into riesgo_ciudad (producto_id, ciudad_id, nivel_riesgo)
    select v_producto, c.id,
        case
          when c.nombre in ('Guayaquil','Quito','Santo Domingo','Babahoyo','Quevedo','La Maná','Manta','Chone','Portoviejo','Machala') then 1
          when c.nombre in ('Cuenca','Ambato','Ibarra','Riobamba','Latacunga','Guaranda') then 2
          else 3
        end
    from ciudad c
    on conflict (producto_id, ciudad_id) do update set nivel_riesgo = excluded.nivel_riesgo;

    insert into riesgo_genero (producto_id, genero, porcentaje_participacion, nivel_riesgo)
    values (v_producto,'HOMBRE',85,1), (v_producto,'MUJER',15,2)
    on conflict (producto_id, genero) do update set
      porcentaje_participacion = excluded.porcentaje_participacion,
      nivel_riesgo = excluded.nivel_riesgo;

    insert into riesgo_uso (producto_id, uso, nivel_riesgo)
    values (v_producto,'COMERCIAL',1), (v_producto,'PARTICULAR',2), (v_producto,'CORPORATIVO',3)
    on conflict (producto_id, uso) do update set nivel_riesgo = excluded.nivel_riesgo;

    if not exists (select 1 from riesgo_monto_asegurado where producto_id = v_producto) then
      insert into riesgo_monto_asegurado (producto_id,monto_desde,monto_hasta,nivel_riesgo)
      values (v_producto,0,20000,1), (v_producto,20000,30000,2), (v_producto,30000,null,3);
    end if;

    insert into riesgo_color (producto_id,color,nivel_riesgo)
    values
      (v_producto,'NEGRO',1),(v_producto,'AMARILLO TAXI',1),(v_producto,'MARRON',1),
      (v_producto,'AZUL',1),(v_producto,'VERDE',1),(v_producto,'ROJO',2),
      (v_producto,'GRIS OSCURO',2),(v_producto,'BLANCO',3),(v_producto,'PLATA',3)
    on conflict (producto_id,color) do update set nivel_riesgo = excluded.nivel_riesgo;

    insert into riesgo_estado_civil (producto_id,estado_civil,nivel_riesgo)
    values
      (v_producto,'SOLTERO',1),(v_producto,'CASADO',2),(v_producto,'DIVORCIADO',2),
      (v_producto,'VIUDO',3),(v_producto,'UNION_DE_HECHO',2),
      (v_producto,'SOLTERO/A',1),(v_producto,'CASADO/A',2)
    on conflict (producto_id,estado_civil) do update set nivel_riesgo = excluded.nivel_riesgo;

    if not exists (select 1 from riesgo_edad where producto_id = v_producto) then
      insert into riesgo_edad (producto_id,edad_desde,edad_hasta,nivel_riesgo)
      values (v_producto,16,24,1),(v_producto,25,44,2),(v_producto,45,null,3);
    end if;

    insert into tasa_por_nivel_riesgo (producto_id,nivel_riesgo,tasa)
    values (v_producto,1,0.042),(v_producto,2,0.036),(v_producto,3,0.029)
    on conflict (producto_id,nivel_riesgo) do update set tasa = excluded.tasa;

    insert into tabla_depreciacion (producto_id,tipo,porcentaje)
    values
      (v_producto,'NUEVO_1ER_ANIO',0.10),(v_producto,'NUEVO_DESDE_2DO',0.15),
      (v_producto,'USADO_1ER_ANIO',0.15),(v_producto,'USADO_DESDE_2DO',0.18)
    on conflict (producto_id,tipo) do update set porcentaje = excluded.porcentaje;

    insert into tabla_perdidas (producto_id,nivel_riesgo,perdidas_parciales,perdidas_totales)
    values
      (v_producto,1,'20% DEL VALOR DEL SINIESTRO MÍNIMO 700','20% DEL VALOR ASEGURADO'),
      (v_producto,2,'15% DEL VALOR DEL SINIESTRO MÍNIMO 500','18% DEL VALOR ASEGURADO'),
      (v_producto,3,'10% DEL VALOR DEL SINIESTRO MÍNIMO 300','15% DEL VALOR ASEGURADO')
    on conflict (producto_id,nivel_riesgo) do update set
      perdidas_parciales = excluded.perdidas_parciales,
      perdidas_totales = excluded.perdidas_totales;

    -- Completa la matriz 3⁴ del producto demo. La banda se determina por el
    -- promedio redondeado de sus cuatro niveles de riesgo.
    insert into tarifa_base (
      producto_id,tipo_vehiculo_id,tiempo_credito,riesgo_marca,riesgo_ciudad,
      riesgo_genero,riesgo_uso,depreciacion,tasa
    )
    select v_producto, tv.id, tramo.nombre, rm, rc, rg, ru,
      case round((rm+rc+rg+ru)::numeric/4)::int when 1 then 0.18 when 2 then 0.15 else 0.10 end,
      case
        when tv.id = v_tipo_particular and tramo.nombre = 'HASTA 2 AÑOS' then
          case round((rm+rc+rg+ru)::numeric/4)::int when 1 then 0.036 when 2 then 0.034 else 0.032 end
        when tv.id = v_tipo_particular then
          case round((rm+rc+rg+ru)::numeric/4)::int when 1 then 0.035 when 2 then 0.033 else 0.031 end
        when tv.id = v_tipo_alta_gama then
          case round((rm+rc+rg+ru)::numeric/4)::int when 1 then 0.029 when 2 then 0.027 else 0.025 end
        else
          case round((rm+rc+rg+ru)::numeric/4)::int when 1 then 0.049 when 2 then 0.046 else 0.044 end
      end
    from (values (v_tipo_particular),(v_tipo_alta_gama),(v_tipo_alquiler)) tv(id)
    cross join lateral (
      select nombre from (values
        ('HASTA 2 AÑOS'),('HASTA 3 A 5 AÑOS')
      ) p(nombre) where tv.id = v_tipo_particular
      union all
      select 'DE 1 A 5 AÑOS' where tv.id <> v_tipo_particular
    ) tramo
    cross join generate_series(1,3) rm
    cross join generate_series(1,3) rc
    cross join generate_series(1,3) rg
    cross join generate_series(1,3) ru
    on conflict (producto_id,tipo_vehiculo_id,tiempo_credito,riesgo_marca,riesgo_ciudad,riesgo_genero,riesgo_uso)
    do update set tasa = excluded.tasa, depreciacion = excluded.depreciacion;

    insert into parametro_modelo_mensual (
      producto_id,super_bancos_pct,seguro_campesino_pct,derechos_emision_valor,iva_pct
    ) values (v_producto,0.035,0.005,0.5,0.15)
    on conflict (producto_id) do update set
      super_bancos_pct=excluded.super_bancos_pct,
      seguro_campesino_pct=excluded.seguro_campesino_pct,
      derechos_emision_valor=excluded.derechos_emision_valor,
      iva_pct=excluded.iva_pct;

    insert into tasa_anual_producto (producto_id,numero_anio,tasa)
    values (v_producto,2,0.0352),(v_producto,3,0.0352),(v_producto,4,0.0352),(v_producto,5,0.0352)
    on conflict (producto_id,numero_anio) do update set tasa=excluded.tasa;

    select id into v_cobertura_total from cobertura_base where nombre='Pérdida total' limit 1;
    if v_cobertura_total is null then
      insert into cobertura_base (nombre,descripcion_generica)
      values ('Pérdida total','Protección ante pérdida total del vehículo')
      returning id into v_cobertura_total;
    else
      update cobertura_base set activo=true where id=v_cobertura_total;
    end if;
    select id into v_cobertura_rc from cobertura_base where nombre='Responsabilidad civil' limit 1;
    if v_cobertura_rc is null then
      insert into cobertura_base (nombre,descripcion_generica)
      values ('Responsabilidad civil','Daños ocasionados a terceros')
      returning id into v_cobertura_rc;
    else
      update cobertura_base set activo=true where id=v_cobertura_rc;
    end if;

    insert into producto_cobertura (producto_id,cobertura_base_id,valor_o_porcentaje,orden,activo)
    values (v_producto,v_cobertura_total,100,1,true),(v_producto,v_cobertura_rc,20000,2,true)
    on conflict (producto_id,cobertura_base_id) do update set activo=true,
      valor_o_porcentaje=excluded.valor_o_porcentaje,orden=excluded.orden;

    select id into v_deducible from deducible_base where nombre='Deducible general' limit 1;
    if v_deducible is null then
      insert into deducible_base (nombre,tipo_calculo,descripcion)
      values ('Deducible general','PORCENTAJE','Porcentaje aplicable según el nivel de riesgo')
      returning id into v_deducible;
    else
      update deducible_base set activo=true where id=v_deducible;
    end if;

    if not exists (
      select 1 from producto_deducible
      where producto_id=v_producto and deducible_base_id=v_deducible
        and producto_cobertura_id is null
    ) then
      insert into producto_deducible (producto_id,deducible_base_id,valor,activo)
      values (v_producto,v_deducible,10,true);
    end if;
end $$;
