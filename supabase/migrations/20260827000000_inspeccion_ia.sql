-- Inspección fotográfica de la cotización (fase 1: informativa, sin IA).
-- Regla 16 del ER model (supabase/PLATAFORMA_SEGUROS_MODELO_ER.md).
-- NO condiciona cotizacion.estado, la aceptación ni la emisión de póliza.

-- 1. Cabecera: una inspección por cotización.
create table if not exists inspeccion (
    id             uuid primary key default gen_random_uuid(),
    cotizacion_id  uuid not null unique references cotizacion(id) on delete cascade,
    carroceria     text not null check (carroceria in
                     ('SEDAN','SUV','STATION_WAGON','HATCHBACK','LCV','CAMIONETA','MINIVAN')),
    estado         text not null default 'EN_PROGRESO'
                     check (estado in ('EN_PROGRESO','COMPLETADA')),
    origen         text not null check (origen in ('AUTOGESTION','CANAL')),
    creado_en      timestamptz not null default now(),
    completada_en  timestamptz
);
create index if not exists idx_inspeccion_estado on inspeccion(estado);

-- 2. Una fila por foto capturada. Re-toma = reemplazo (unique por slot), sin historial.
--    El binario vive en Storage; aquí sólo storage_path + metadatos + geolocalización.
create table if not exists inspeccion_foto (
    id                uuid primary key default gen_random_uuid(),
    inspeccion_id     uuid not null references inspeccion(id) on delete cascade,
    slot              text not null check (slot in (
                        'FRENTE','ATRAS','LATERAL_DERECHO','LATERAL_IZQUIERDO',
                        'MOTOR','CAJUELA','INTERIOR_TABLERO',
                        'ASIENTOS_DELANTEROS','ASIENTOS_TRASEROS',
                        'PUERTA_INT_DELANTERA_IZQ','PUERTA_INT_DELANTERA_DER',
                        'PUERTA_INT_TRASERA_IZQ','PUERTA_INT_TRASERA_DER')),
    storage_path      text not null,
    mime              text not null check (mime in ('image/jpeg','image/webp')),
    bytes             int  not null check (bytes > 0 and bytes <= 12582912),
    ancho             int  check (ancho is null or (ancho between 1 and 20000)),
    alto              int  check (alto  is null or (alto  between 1 and 20000)),
    lat               numeric(9,6),
    lng               numeric(9,6),
    precision_m       numeric(9,2) check (precision_m is null or precision_m >= 0),
    geo_capturado_en  timestamptz,
    capturado_con     text not null check (capturado_con in ('CAMARA','ARCHIVO')),
    creado_en         timestamptz not null default now(),
    unique (inspeccion_id, slot)
);
create index if not exists idx_inspeccion_foto_inspeccion on inspeccion_foto(inspeccion_id);

-- 3. Tablas sensibles (fotos del vehículo + geolocalización del titular):
--    RLS activado sin políticas + revoke; sólo service_role las toca
--    (mismo patrón que sesion_autenticacion / token_activacion).
alter table inspeccion       enable row level security;
alter table inspeccion_foto  enable row level security;
revoke all on inspeccion      from anon, authenticated;
revoke all on inspeccion_foto from anon, authenticated;

-- 4. Bucket privado de Storage (workflow del repo = SQL manual contra la BD hosteada).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspecciones', 'inspecciones', false, 12582912, array['image/jpeg','image/webp'])
on conflict (id) do nothing;
