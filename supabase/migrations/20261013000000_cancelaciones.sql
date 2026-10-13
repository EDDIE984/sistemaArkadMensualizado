-- Cancelación de pólizas por el canal y nivelación.
-- Reglas 18 y 19 del ER model (supabase/PLATAFORMA_SEGUROS_MODELO_ER.md).

-- Cuotas canceladas: nuevo estado en la tabla de cobranza.
alter table tabla_cobranza drop constraint if exists tabla_cobranza_estado_check;
alter table tabla_cobranza add constraint tabla_cobranza_estado_check
    check (estado in ('PENDIENTE','PAGADO','VENCIDO','CANCELADA'));

-- Fecha desde la que la póliza queda cancelada (primer día del mes de cancelación).
alter table poliza add column if not exists fecha_cancelacion date;

create table if not exists cancelacion_poliza (
    id                  uuid primary key default gen_random_uuid(),
    poliza_id           uuid not null unique references poliza(id) on delete cascade,
    canal_id            uuid not null references canal(id),
    mes_cancelacion     date not null check (extract(day from mes_cancelacion) = 1),
    cuota_desde         int not null check (cuota_desde >= 1),
    cuotas_canceladas   int not null check (cuotas_canceladas >= 1),
    motivo              text,
    origen              text not null check (origen in ('INDIVIDUAL','EXCEL')),
    usuario_id          uuid references usuario(id),
    creado_en           timestamptz not null default now()
);
create index if not exists idx_cancelacion_canal on cancelacion_poliza(canal_id, creado_en desc);

-- Movimiento interno generado por cada cancelación (no visible para canal/cliente).
create table if not exists nivelacion (
    id              uuid primary key default gen_random_uuid(),
    cancelacion_id  uuid not null unique references cancelacion_poliza(id) on delete cascade,
    poliza_id       uuid not null references poliza(id) on delete cascade,
    cuota_desde     int not null,
    cuota_hasta     int not null,
    valor           numeric(12,4) not null,
    estado          text not null default 'PENDIENTE' check (estado in ('PENDIENTE')),
    creado_en       timestamptz not null default now(),
    check (cuota_hasta >= cuota_desde)
);
create index if not exists idx_nivelacion_poliza on nivelacion(poliza_id);

-- Solo service_role (mismo patrón que certificado_cobertura).
alter table cancelacion_poliza enable row level security;
alter table nivelacion enable row level security;
revoke all on cancelacion_poliza from anon, authenticated;
revoke all on nivelacion from anon, authenticated;
