-- ============================================================================
-- PLATAFORMA MULTI-ASEGURADORA DE COTIZACIÓN ("Netflix de los Seguros")
-- Script DDL para Supabase (PostgreSQL)
-- Generado a partir de PLATAFORMA_SEGUROS_MODELO_ER.md
-- ============================================================================
-- Cómo correrlo: Supabase Dashboard > SQL Editor > pegar y ejecutar completo,
-- o vía CLI: supabase db push / psql -f supabase_schema.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONES
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ============================================================================
-- 1. CATÁLOGOS GLOBALES DE PLATAFORMA (compartidos por todas las aseguradoras)
-- ============================================================================

create table ciudad (
    id          uuid primary key default gen_random_uuid(),
    nombre      text not null,
    provincia   text,
    creado_en   timestamptz not null default now(),
    unique (nombre)
);

create table perfil (
    id          uuid primary key default gen_random_uuid(),
    codigo      text not null unique
                    check (codigo in ('ADMIN_PLATAFORMA','ADMIN_ASEGURADORA','USUARIO_CANAL')),
    descripcion text
);

create table ramo_base (
    id          uuid primary key default gen_random_uuid(),
    nombre      text not null unique,               -- VEHICULO | VIDA | ASISTENCIA_MEDICA | HOGAR...
    descripcion text,
    activo      boolean not null default true
);

create table plan_suscripcion (
    id                  uuid primary key default gen_random_uuid(),
    nombre              text not null unique,        -- BASICO | PROFESIONAL | ENTERPRISE
    descripcion         text,
    max_ramos           int,                         -- null = ilimitado
    precio_mensual      numeric(12,2),
    activo              boolean not null default true
);

create table plan_suscripcion_ramo (
    plan_suscripcion_id uuid not null references plan_suscripcion(id) on delete cascade,
    ramo_base_id         uuid not null references ramo_base(id) on delete cascade,
    primary key (plan_suscripcion_id, ramo_base_id)
);

create table cobertura_base (
    id                  uuid primary key default gen_random_uuid(),
    nombre              text not null,
    descripcion_generica text,
    activo              boolean not null default true
);

create table clausula_base (
    id             uuid primary key default gen_random_uuid(),
    titulo         text not null,
    texto_generico text,
    activo         boolean not null default true
);

create table deducible_base (
    id           uuid primary key default gen_random_uuid(),
    nombre       text not null,
    tipo_calculo text not null check (tipo_calculo in ('PORCENTAJE','VALOR_FIJO')),
    descripcion  text,
    activo       boolean not null default true
);

-- ============================================================================
-- 2. TENANT: ASEGURADORA, SUSCRIPCIÓN, RAMOS ACTIVADOS, CANALES, PRODUCTOS
-- ============================================================================

create table aseguradora (
    id               uuid primary key default gen_random_uuid(),
    nombre_comercial text not null,
    razon_social     text not null,
    ruc              text not null unique,
    logo_url         text,
    activo           boolean not null default true,
    creado_en        timestamptz not null default now()
);

create table aseguradora_suscripcion (
    id                   uuid primary key default gen_random_uuid(),
    aseguradora_id       uuid not null references aseguradora(id) on delete cascade,
    plan_suscripcion_id  uuid not null references plan_suscripcion(id),
    fecha_inicio         date not null default current_date,
    fecha_fin            date,                        -- null = vigente
    estado               text not null default 'ACTIVA'
                             check (estado in ('ACTIVA','VENCIDA','CANCELADA'))
);
create index idx_aseguradora_suscripcion_aseguradora on aseguradora_suscripcion(aseguradora_id);

create table aseguradora_ramo (
    id                uuid primary key default gen_random_uuid(),
    aseguradora_id    uuid not null references aseguradora(id) on delete cascade,
    ramo_base_id      uuid not null references ramo_base(id),
    activo            boolean not null default true,
    fecha_activacion  timestamptz not null default now(),
    unique (aseguradora_id, ramo_base_id)
);
create index idx_aseguradora_ramo_aseguradora on aseguradora_ramo(aseguradora_id);

create table canal (
    id              uuid primary key default gen_random_uuid(),
    aseguradora_id  uuid not null references aseguradora(id) on delete cascade,
    nombre          text not null,                     -- EMPRESAS | INDIVIDUAL | personalizado
    descripcion     text,
    activo          boolean not null default true,
    unique (aseguradora_id, nombre)
);
create index idx_canal_aseguradora on canal(aseguradora_id);

create table producto (
    id                      uuid primary key default gen_random_uuid(),
    aseguradora_id          uuid not null references aseguradora(id) on delete cascade,
    canal_id                uuid not null references canal(id),
    aseguradora_ramo_id     uuid not null references aseguradora_ramo(id),
    nombre                  text not null,
    aplica_todas_ciudades   boolean not null default true,
    activo                  boolean not null default true,
    creado_en               timestamptz not null default now()
);
create index idx_producto_aseguradora on producto(aseguradora_id);
create index idx_producto_canal on producto(canal_id);

create table producto_ciudad (
    producto_id uuid not null references producto(id) on delete cascade,
    ciudad_id   uuid not null references ciudad(id) on delete cascade,
    primary key (producto_id, ciudad_id)
);

-- ============================================================================
-- 3. CONFIGURACIÓN DEL PRODUCTO (100% independiente por aseguradora/producto)
-- ============================================================================

create table tipo_vehiculo (
    id          uuid primary key default gen_random_uuid(),
    producto_id uuid not null references producto(id) on delete cascade,
    descripcion text not null                -- LIVIANOS PARTICULARES | ALTA GAMA | ALQUILER...
);
create index idx_tipo_vehiculo_producto on tipo_vehiculo(producto_id);

create table riesgo_modelo (
    id            uuid primary key default gen_random_uuid(),
    producto_id   uuid not null references producto(id) on delete cascade,
    marca         text not null,
    modelo        text not null,
    nivel_riesgo  int not null check (nivel_riesgo in (1,2,3)),   -- 1 Alto 2 Moderado 3 Bajo
    justificacion text
);
create index idx_riesgo_modelo_producto on riesgo_modelo(producto_id);
create index idx_riesgo_modelo_modelo on riesgo_modelo(producto_id, modelo);

create table riesgo_ciudad (
    id            uuid primary key default gen_random_uuid(),
    producto_id   uuid not null references producto(id) on delete cascade,
    ciudad_id     uuid not null references ciudad(id),
    nivel_riesgo  int not null check (nivel_riesgo in (1,2,3)),
    justificacion text,
    unique (producto_id, ciudad_id)
);
create index idx_riesgo_ciudad_producto on riesgo_ciudad(producto_id);

create table riesgo_genero (
    id                       uuid primary key default gen_random_uuid(),
    producto_id              uuid not null references producto(id) on delete cascade,
    genero                   text not null check (genero in ('HOMBRE','MUJER')),
    porcentaje_participacion numeric(5,2),
    nivel_riesgo             int not null check (nivel_riesgo in (1,2,3)),
    unique (producto_id, genero)
);

create table riesgo_uso (
    id           uuid primary key default gen_random_uuid(),
    producto_id  uuid not null references producto(id) on delete cascade,
    uso          text not null check (uso in ('COMERCIAL','PARTICULAR','CORPORATIVO')),
    nivel_riesgo int not null check (nivel_riesgo in (1,2,3)),
    unique (producto_id, uso)
);

create table riesgo_monto_asegurado (
    id           uuid primary key default gen_random_uuid(),
    producto_id  uuid not null references producto(id) on delete cascade,
    monto_desde  numeric(12,2) not null,
    monto_hasta  numeric(12,2),                -- null = sin tope superior
    nivel_riesgo int not null check (nivel_riesgo in (1,2,3))
);
create index idx_riesgo_monto_producto on riesgo_monto_asegurado(producto_id);

create table tasa_por_nivel_riesgo (
    id           uuid primary key default gen_random_uuid(),
    producto_id  uuid not null references producto(id) on delete cascade,
    nivel_riesgo int not null check (nivel_riesgo in (1,2,3)),
    tasa         numeric(8,6) not null,
    unique (producto_id, nivel_riesgo)
);

create table riesgo_color (
    id           uuid primary key default gen_random_uuid(),
    producto_id  uuid not null references producto(id) on delete cascade,
    color        text not null,
    nivel_riesgo int not null check (nivel_riesgo in (1,2,3)),
    unique (producto_id, color)
);

create table riesgo_estado_civil (
    id           uuid primary key default gen_random_uuid(),
    producto_id  uuid not null references producto(id) on delete cascade,
    estado_civil text not null,
    nivel_riesgo int not null check (nivel_riesgo in (1,2,3)),
    unique (producto_id, estado_civil)
);

create table riesgo_edad (
    id           uuid primary key default gen_random_uuid(),
    producto_id  uuid not null references producto(id) on delete cascade,
    edad_desde   int not null,
    edad_hasta   int,                          -- null = sin tope superior
    nivel_riesgo int not null check (nivel_riesgo in (1,2,3))
);
create index idx_riesgo_edad_producto on riesgo_edad(producto_id);

create table tabla_depreciacion (
    id          uuid primary key default gen_random_uuid(),
    producto_id uuid not null references producto(id) on delete cascade,
    tipo        text not null check (tipo in
                    ('NUEVO_1ER_ANIO','NUEVO_DESDE_2DO','USADO_1ER_ANIO','USADO_DESDE_2DO')),
    porcentaje  numeric(5,4) not null,
    unique (producto_id, tipo)
);

create table tabla_perdidas (
    id                  uuid primary key default gen_random_uuid(),
    producto_id         uuid not null references producto(id) on delete cascade,
    nivel_riesgo        int not null check (nivel_riesgo in (1,2,3)),
    perdidas_parciales  text not null,
    perdidas_totales    text not null,
    unique (producto_id, nivel_riesgo)
);

create table tarifa_base (
    id                 uuid primary key default gen_random_uuid(),
    producto_id        uuid not null references producto(id) on delete cascade,
    tipo_vehiculo_id   uuid not null references tipo_vehiculo(id),
    tiempo_credito     text not null,   -- 'HASTA 2 AÑOS' | 'HASTA 3 A 5 AÑOS' | 'DE 1 A 5 AÑOS'
                                          -- (este último aplica a cualquier tiempo de crédito;
                                          -- el backend debe tratarlo como comodín)
    riesgo_marca       int not null check (riesgo_marca in (1,2,3)),
    riesgo_ciudad      int not null check (riesgo_ciudad in (1,2,3)),
    riesgo_genero      int not null check (riesgo_genero in (1,2,3)),
    riesgo_uso         int not null check (riesgo_uso in (1,2,3)),
    depreciacion       numeric(5,4),
    tasa               numeric(8,6) not null,
    unique (producto_id, tipo_vehiculo_id, tiempo_credito, riesgo_marca, riesgo_ciudad, riesgo_genero, riesgo_uso)
);
create index idx_tarifa_base_producto on tarifa_base(producto_id);

create table parametro_modelo_mensual (
    id                      uuid primary key default gen_random_uuid(),
    producto_id             uuid not null unique references producto(id) on delete cascade,
    super_bancos_pct        numeric(6,4) not null default 0.035,
    seguro_campesino_pct    numeric(6,4) not null default 0.005,
    derechos_emision_valor  numeric(10,2) not null default 0.5,
    iva_pct                 numeric(6,4) not null default 0.15
);

create table tasa_anual_producto (
    id           uuid primary key default gen_random_uuid(),
    producto_id  uuid not null references producto(id) on delete cascade,
    numero_anio  int not null check (numero_anio between 2 and 5),
    tasa         numeric(8,6) not null,
    unique (producto_id, numero_anio)
);

-- Personalización de catálogos base por producto ---------------------------

create table producto_cobertura (
    id                  uuid primary key default gen_random_uuid(),
    producto_id         uuid not null references producto(id) on delete cascade,
    cobertura_base_id   uuid not null references cobertura_base(id),
    valor_o_porcentaje  numeric(12,2),
    orden               int not null default 0,
    activo              boolean not null default true,
    unique (producto_id, cobertura_base_id)
);
create index idx_producto_cobertura_producto on producto_cobertura(producto_id);

create table producto_clausula (
    id                   uuid primary key default gen_random_uuid(),
    producto_id          uuid not null references producto(id) on delete cascade,
    clausula_base_id     uuid not null references clausula_base(id),
    texto_personalizado  text,               -- null = usa el texto_generico del catálogo
    orden                int not null default 0,
    activo               boolean not null default true,
    unique (producto_id, clausula_base_id)
);
create index idx_producto_clausula_producto on producto_clausula(producto_id);

create table producto_deducible (
    id                      uuid primary key default gen_random_uuid(),
    producto_id             uuid not null references producto(id) on delete cascade,
    deducible_base_id       uuid not null references deducible_base(id),
    producto_cobertura_id   uuid references producto_cobertura(id) on delete cascade,
                                -- null = deducible general del producto/póliza
                                -- con valor = deducible específico de esa cobertura
    valor                   numeric(12,2) not null,
    activo                  boolean not null default true
);
create index idx_producto_deducible_producto on producto_deducible(producto_id);
create index idx_producto_deducible_cobertura on producto_deducible(producto_cobertura_id);

-- ============================================================================
-- 4. USUARIOS INTERNOS (autenticación por tabla propia)
-- ============================================================================

create table usuario (
    id             uuid primary key default gen_random_uuid(),
    perfil_id      uuid not null references perfil(id),
    aseguradora_id uuid references aseguradora(id),     -- null solo para ADMIN_PLATAFORMA
    canal_id       uuid references canal(id),           -- solo para USUARIO_CANAL
    nombre         text not null,
    email          text not null unique,
    password_hash  text not null,
    activo         boolean not null default true,
    creado_en      timestamptz not null default now()
);
create index idx_usuario_aseguradora on usuario(aseguradora_id);
create index idx_usuario_canal on usuario(canal_id);

-- ============================================================================
-- 5. CLIENTES Y VEHÍCULOS (la plataforma es marketplace: cliente no
--    pertenece a una sola aseguradora)
-- ============================================================================

create table cliente (
    id                   uuid primary key default gen_random_uuid(),
    tipo_cliente         text not null check (tipo_cliente in ('INDIVIDUAL','EMPRESA')),
    nombre_razon_social  text not null,
    identificacion       text not null unique,          -- cédula | RUC
    email                text not null unique,
    password_hash        text not null,
    telefono             text,
    ciudad_id            uuid references ciudad(id),
    direccion            text,
    fecha_nacimiento     date,                           -- solo individual; la edad se calcula, no se guarda
    genero               text check (genero in ('HOMBRE','MUJER')),   -- solo individual
    estado_civil         text,                           -- solo individual
    representante_legal  text,                           -- solo empresa
    activo               boolean not null default true,
    fecha_registro       timestamptz not null default now()
);

create table vehiculo (
    id                uuid primary key default gen_random_uuid(),
    cliente_id        uuid not null references cliente(id) on delete cascade,
    tipo_vehiculo_id  uuid references tipo_vehiculo(id),
    marca             text not null,
    modelo            text not null,
    anio              int,
    color             text,
    valor_asegurado   numeric(12,2) not null,
    estado_vh         text not null check (estado_vh in ('NUEVO','USADO')),
    uso               text not null check (uso in ('COMERCIAL','PARTICULAR','CORPORATIVO')),
    placa             text
);
create index idx_vehiculo_cliente on vehiculo(cliente_id);

-- ============================================================================
-- 6. OPERACIÓN: COTIZAR → ACEPTAR → EMITIR PÓLIZA → COBRAR → PAGAR
-- ============================================================================

create table cotizacion (
    id                   uuid primary key default gen_random_uuid(),
    aseguradora_id       uuid not null references aseguradora(id),
    producto_id          uuid not null references producto(id),
    cliente_id           uuid not null references cliente(id),
    vehiculo_id          uuid not null references vehiculo(id),
    usuario_id           uuid references usuario(id),     -- null si fue autogestión del cliente
    ciudad_id            uuid not null references ciudad(id),
    origen               text not null check (origen in ('AUTOGESTION','CANAL')),
    anios_vigencia       int not null check (anios_vigencia between 1 and 5),
    tasa_promedio        numeric(8,6) not null,
    nivel_riesgo         int not null check (nivel_riesgo in (1,2,3)),
    cuota_fija_mensual   numeric(12,2) not null,
    estado               text not null default 'PENDIENTE'
                             check (estado in ('PENDIENTE','ACEPTADA','RECHAZADA','EXPIRADA')),
    creado_en            timestamptz not null default now(),
    fecha_aceptacion     timestamptz
);
create index idx_cotizacion_aseguradora on cotizacion(aseguradora_id);
create index idx_cotizacion_cliente on cotizacion(cliente_id);
create index idx_cotizacion_producto on cotizacion(producto_id);
create index idx_cotizacion_estado on cotizacion(estado);

create table cotizacion_cobertura (
    id                     uuid primary key default gen_random_uuid(),
    cotizacion_id          uuid not null references cotizacion(id) on delete cascade,
    producto_cobertura_id  uuid not null references producto_cobertura(id),
    valor_aplicado         numeric(12,2)
);
create index idx_cotizacion_cobertura_cotizacion on cotizacion_cobertura(cotizacion_id);

create table cotizacion_deducible (
    id                        uuid primary key default gen_random_uuid(),
    cotizacion_id             uuid not null references cotizacion(id) on delete cascade,
    producto_deducible_id     uuid not null references producto_deducible(id),
    cotizacion_cobertura_id   uuid references cotizacion_cobertura(id) on delete cascade,
                                  -- null = deducible general de la cotización
    valor_aplicado            numeric(12,2) not null
);
create index idx_cotizacion_deducible_cotizacion on cotizacion_deducible(cotizacion_id);

create table amortizacion_mensual (
    id                     uuid primary key default gen_random_uuid(),
    cotizacion_id          uuid not null references cotizacion(id) on delete cascade,
    mes                    int not null,                  -- 1..60
    valor_asegurado_mes    numeric(12,2) not null,
    prima_neta_mes         numeric(12,4) not null,
    super_bancos           numeric(12,4) not null,
    seguro_campesino       numeric(12,4) not null,
    derechos_emision       numeric(12,4) not null,
    subtotal               numeric(12,4) not null,
    iva                    numeric(12,4) not null,
    prima_total_mes        numeric(12,4) not null,
    cuota_fija             numeric(12,2) not null,
    diferencia             numeric(12,4) not null,
    nivelacion_acumulada   numeric(12,4) not null,
    unique (cotizacion_id, mes)
);
create index idx_amortizacion_cotizacion on amortizacion_mensual(cotizacion_id);

create table poliza (
    id                      uuid primary key default gen_random_uuid(),
    cotizacion_id           uuid not null unique references cotizacion(id),
    numero_poliza           text not null unique,
    fecha_emision           date not null default current_date,
    fecha_inicio_vigencia   date not null,
    fecha_fin_vigencia      date not null,
    estado                  text not null default 'VIGENTE'
                                check (estado in ('VIGENTE','VENCIDA','CANCELADA'))
);
create index idx_poliza_estado on poliza(estado);

create table tabla_cobranza (
    id                  uuid primary key default gen_random_uuid(),
    poliza_id           uuid not null references poliza(id) on delete cascade,
    numero_cuota        int not null,
    fecha_vencimiento   date not null,
    monto               numeric(12,2) not null,
    estado              text not null default 'PENDIENTE'
                            check (estado in ('PENDIENTE','PAGADO','VENCIDO')),
    unique (poliza_id, numero_cuota)
);
create index idx_cobranza_poliza on tabla_cobranza(poliza_id);
create index idx_cobranza_estado on tabla_cobranza(estado);

create table pago (
    id                     uuid primary key default gen_random_uuid(),
    cobranza_id            uuid not null references tabla_cobranza(id),
    fecha_pago             date not null default current_date,
    monto_pagado           numeric(12,2) not null,
    metodo_pago            text,
    referencia             text,
    usuario_registro_id    uuid references usuario(id),
    estado                 text not null default 'REGISTRADO'
                               check (estado in ('REGISTRADO','ANULADO'))
);
create index idx_pago_cobranza on pago(cobranza_id);

-- ============================================================================
-- 7. AUDITORÍA GENÉRICA
-- ============================================================================

create table auditoria (
    id               uuid primary key default gen_random_uuid(),
    entidad          text not null,          -- 'COTIZACION' | 'POLIZA' | 'TARIFA_BASE' | ...
    entidad_id       uuid not null,
    accion           text not null check (accion in ('CREACION','EDICION','CAMBIO_ESTADO')),
    datos_anteriores jsonb,
    datos_nuevos     jsonb,
    usuario_id       uuid references usuario(id),
    creado_en        timestamptz not null default now()
);
create index idx_auditoria_entidad on auditoria(entidad, entidad_id);
create index idx_auditoria_usuario on auditoria(usuario_id);

-- ============================================================================
-- 8. SEED DATA — catálogos base de arranque
-- ============================================================================

insert into perfil (codigo, descripcion) values
    ('ADMIN_PLATAFORMA', 'Administrador de la plataforma (equipo de sistemas)'),
    ('ADMIN_ASEGURADORA', 'Administrador de una aseguradora tenant'),
    ('USUARIO_CANAL', 'Agente de canal (empresas o individual) de una aseguradora');

insert into ciudad (nombre, provincia) values
    ('Guayaquil', 'Guayas'),
    ('Quito', 'Pichincha'),
    ('Santo Domingo', 'Santo Domingo de los Tsáchilas'),
    ('Babahoyo', 'Los Ríos'),
    ('Quevedo', 'Los Ríos'),
    ('La Maná', 'Cotopaxi'),
    ('Manta', 'Manabí'),
    ('Chone', 'Manabí'),
    ('Portoviejo', 'Manabí'),
    ('Machala', 'El Oro'),
    ('Cuenca', 'Azuay'),
    ('Ambato', 'Tungurahua'),
    ('Ibarra', 'Imbabura'),
    ('Riobamba', 'Chimborazo'),
    ('Latacunga', 'Cotopaxi'),
    ('Guaranda', 'Bolívar'),
    ('Loja', 'Loja'),
    ('Tulcán', 'Carchi'),
    ('Baños', 'Tungurahua'),
    ('Tena', 'Napo'),
    ('Galápagos', 'Galápagos');

insert into ramo_base (nombre, descripcion) values
    ('VEHICULO', 'Seguro vehicular'),
    ('VIDA', 'Seguro de vida'),
    ('ASISTENCIA_MEDICA', 'Asistencia médica'),
    ('HOGAR', 'Seguro de hogar');

insert into plan_suscripcion (nombre, descripcion, max_ramos, precio_mensual) values
    ('BASICO', 'Plan de entrada, hasta 1 ramo activo', 1, 0),
    ('PROFESIONAL', 'Hasta 3 ramos activos', 3, 0),
    ('ENTERPRISE', 'Ramos ilimitados', null, 0);

-- Nota: precio_mensual queda en 0 como placeholder — ajustar según el
-- modelo comercial real antes de producción.

-- COBERTURA_BASE, CLAUSULA_BASE y DEDUCIBLE_BASE se dejan sin semilla:
-- su contenido depende de definiciones legales/comerciales que debe
-- aportar el negocio antes de cargarlas.

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
