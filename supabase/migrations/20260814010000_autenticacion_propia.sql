-- Autenticación propia: registro por correo, activación de un solo uso y sesiones opacas.

alter table cliente
    alter column identificacion drop not null,
    add column if not exists estado_registro text not null default 'ACTIVO'
        check (estado_registro in ('ACTIVO','BLOQUEADO')),
    add column if not exists email_verificado_en timestamptz,
    add column if not exists intentos_fallidos int not null default 0,
    add column if not exists bloqueado_hasta timestamptz,
    add column if not exists ultimo_acceso_en timestamptz;

alter table usuario
    add column if not exists intentos_fallidos int not null default 0,
    add column if not exists bloqueado_hasta timestamptz,
    add column if not exists ultimo_acceso_en timestamptz;

create table registro_cliente_pendiente (
    id                uuid primary key default gen_random_uuid(),
    nombre            text not null check (char_length(trim(nombre)) between 2 and 120),
    email             text not null,
    estado            text not null default 'PENDIENTE_CONFIRMACION'
                          check (estado in ('PENDIENTE_CONFIRMACION','COMPLETADO','EXPIRADO','CANCELADO')),
    intentos_envio    int not null default 1 check (intentos_envio >= 0),
    ultimo_envio_en   timestamptz not null default now(),
    expira_en         timestamptz not null,
    creado_en         timestamptz not null default now()
);
create unique index uq_registro_cliente_pendiente_email_activo
    on registro_cliente_pendiente (lower(email))
    where estado = 'PENDIENTE_CONFIRMACION';
create index idx_registro_cliente_pendiente_expira
    on registro_cliente_pendiente (expira_en)
    where estado = 'PENDIENTE_CONFIRMACION';

create table token_activacion (
    id                     uuid primary key default gen_random_uuid(),
    registro_pendiente_id  uuid not null references registro_cliente_pendiente(id) on delete cascade,
    token_hash             text not null unique check (char_length(token_hash) = 64),
    expira_en              timestamptz not null,
    usado_en               timestamptz,
    creado_en              timestamptz not null default now()
);
create index idx_token_activacion_registro
    on token_activacion (registro_pendiente_id, creado_en desc);

create table sesion_autenticacion (
    id              uuid primary key default gen_random_uuid(),
    token_hash      text not null unique check (char_length(token_hash) = 64),
    tipo_actor      text not null check (tipo_actor in ('CLIENTE','USUARIO')),
    cliente_id      uuid references cliente(id) on delete cascade,
    usuario_id      uuid references usuario(id) on delete cascade,
    expira_en       timestamptz not null,
    ultimo_uso_en   timestamptz not null default now(),
    revocado_en     timestamptz,
    ip_hash         text,
    user_agent      text,
    creado_en       timestamptz not null default now(),
    check (
        (tipo_actor = 'CLIENTE' and cliente_id is not null and usuario_id is null)
        or
        (tipo_actor = 'USUARIO' and usuario_id is not null and cliente_id is null)
    )
);
create index idx_sesion_autenticacion_cliente on sesion_autenticacion(cliente_id);
create index idx_sesion_autenticacion_usuario on sesion_autenticacion(usuario_id);
create index idx_sesion_autenticacion_vigente
    on sesion_autenticacion(expira_en)
    where revocado_en is null;

create table intento_autenticacion (
    id          bigint generated always as identity primary key,
    accion      text not null check (accion in ('REGISTRO','LOGIN','REENVIO_ACTIVACION')),
    email_hash  text,
    ip_hash     text,
    exitoso     boolean not null default false,
    creado_en   timestamptz not null default now()
);
create index idx_intento_autenticacion_ip on intento_autenticacion(ip_hash, creado_en desc);
create index idx_intento_autenticacion_email on intento_autenticacion(email_hash, creado_en desc);

create or replace function activar_registro_cliente(
    p_token_hash text,
    p_password_hash text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_registro registro_cliente_pendiente%rowtype;
    v_cliente_id uuid;
begin
    select r.*
      into v_registro
      from token_activacion t
      join registro_cliente_pendiente r on r.id = t.registro_pendiente_id
     where t.token_hash = p_token_hash
       and t.usado_en is null
       and t.expira_en > now()
       and r.estado = 'PENDIENTE_CONFIRMACION'
       and r.expira_en > now()
     for update of t, r;

    if not found then
        raise exception 'TOKEN_INVALIDO_O_EXPIRADO' using errcode = 'P0001';
    end if;

    if exists (select 1 from cliente where lower(email) = lower(v_registro.email)) then
        raise exception 'CORREO_YA_REGISTRADO' using errcode = 'P0001';
    end if;

    insert into cliente (
        tipo_cliente,
        nombre_razon_social,
        identificacion,
        email,
        password_hash,
        activo,
        estado_registro,
        email_verificado_en
    ) values (
        'INDIVIDUAL',
        v_registro.nombre,
        null,
        lower(v_registro.email),
        p_password_hash,
        true,
        'ACTIVO',
        now()
    ) returning id into v_cliente_id;

    update token_activacion
       set usado_en = now()
     where registro_pendiente_id = v_registro.id
       and usado_en is null;

    update registro_cliente_pendiente
       set estado = 'COMPLETADO'
     where id = v_registro.id;

    return v_cliente_id;
end;
$$;

revoke all on function activar_registro_cliente(text, text) from public;
grant execute on function activar_registro_cliente(text, text) to service_role;

alter table registro_cliente_pendiente enable row level security;
alter table token_activacion enable row level security;
alter table sesion_autenticacion enable row level security;
alter table intento_autenticacion enable row level security;

-- Estas tablas se acceden únicamente desde el backend con service_role.
revoke all on registro_cliente_pendiente, token_activacion,
    sesion_autenticacion, intento_autenticacion from anon, authenticated;
