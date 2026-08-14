-- Recuperación segura de contraseña para CLIENTE y USUARIO.

alter table intento_autenticacion
  drop constraint if exists intento_autenticacion_accion_check;
alter table intento_autenticacion
  add constraint intento_autenticacion_accion_check
  check (accion in ('REGISTRO','LOGIN','REENVIO_ACTIVACION','RECUPERACION_CONTRASENA'));

create table if not exists token_recuperacion_contrasena (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique check (char_length(token_hash) = 64),
  tipo_actor  text not null check (tipo_actor in ('CLIENTE','USUARIO')),
  cliente_id  uuid references cliente(id) on delete cascade,
  usuario_id  uuid references usuario(id) on delete cascade,
  expira_en   timestamptz not null,
  usado_en    timestamptz,
  creado_en   timestamptz not null default now(),
  check (
    (tipo_actor = 'CLIENTE' and cliente_id is not null and usuario_id is null)
    or
    (tipo_actor = 'USUARIO' and usuario_id is not null and cliente_id is null)
  )
);

create index if not exists idx_token_recuperacion_cliente
  on token_recuperacion_contrasena(cliente_id, creado_en desc);
create index if not exists idx_token_recuperacion_usuario
  on token_recuperacion_contrasena(usuario_id, creado_en desc);
create index if not exists idx_token_recuperacion_vigente
  on token_recuperacion_contrasena(expira_en)
  where usado_en is null;

create or replace function restablecer_contrasena(
  p_token_hash text,
  p_password_hash text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_token token_recuperacion_contrasena%rowtype;
begin
  select * into v_token
  from token_recuperacion_contrasena
  where token_hash = p_token_hash
    and usado_en is null
    and expira_en > now()
  for update;

  if not found then
    raise exception 'TOKEN_INVALIDO_O_EXPIRADO' using errcode = 'P0001';
  end if;

  if v_token.tipo_actor = 'CLIENTE' then
    update cliente set
      password_hash = p_password_hash,
      intentos_fallidos = 0,
      bloqueado_hasta = null
    where id = v_token.cliente_id and activo = true;
    if not found then
      raise exception 'CUENTA_NO_DISPONIBLE' using errcode = 'P0001';
    end if;

    update token_recuperacion_contrasena set usado_en = now()
    where cliente_id = v_token.cliente_id and usado_en is null;
    update sesion_autenticacion set revocado_en = now()
    where cliente_id = v_token.cliente_id and revocado_en is null;
  else
    update usuario set
      password_hash = p_password_hash,
      intentos_fallidos = 0,
      bloqueado_hasta = null
    where id = v_token.usuario_id and activo = true;
    if not found then
      raise exception 'CUENTA_NO_DISPONIBLE' using errcode = 'P0001';
    end if;

    update token_recuperacion_contrasena set usado_en = now()
    where usuario_id = v_token.usuario_id and usado_en is null;
    update sesion_autenticacion set revocado_en = now()
    where usuario_id = v_token.usuario_id and revocado_en is null;
  end if;

  return v_token.tipo_actor;
end;
$$;

revoke all on function restablecer_contrasena(text,text) from public;
grant execute on function restablecer_contrasena(text,text) to service_role;

alter table token_recuperacion_contrasena enable row level security;
revoke all on token_recuperacion_contrasena from anon, authenticated;
