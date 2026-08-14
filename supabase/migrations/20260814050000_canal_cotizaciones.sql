-- Cotización asistida por USUARIO_CANAL y relación segura canal-cliente.

alter table cotizacion add column if not exists canal_id uuid references canal(id);
create index if not exists idx_cotizacion_canal on cotizacion(canal_id, creado_en desc);

alter table cliente alter column password_hash drop not null;
alter table cliente drop constraint if exists cliente_estado_registro_check;
alter table cliente add constraint cliente_estado_registro_check
  check (estado_registro in ('ACTIVO','BLOQUEADO','SIN_ACCESO'));

create table if not exists canal_cliente (
  canal_id                 uuid not null references canal(id) on delete cascade,
  cliente_id               uuid not null references cliente(id) on delete cascade,
  creado_por_usuario_id    uuid references usuario(id),
  creado_en                timestamptz not null default now(),
  primary key (canal_id, cliente_id)
);
create index if not exists idx_canal_cliente_cliente on canal_cliente(cliente_id);

alter table canal_cliente enable row level security;
revoke all on canal_cliente from anon, authenticated;

alter table cotizacion drop constraint if exists cotizacion_origen_actor_check;
alter table cotizacion add constraint cotizacion_origen_actor_check check (
  (origen='AUTOGESTION' and usuario_id is null and canal_id is null)
  or (origen='CANAL' and usuario_id is not null and canal_id is not null)
);
