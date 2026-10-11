-- Certificado de cobertura obligatorio para cotizaciones asistidas por canal.
-- Regla 17 del ER model (supabase/PLATAFORMA_SEGUROS_MODELO_ER.md): la cotización,
-- su certificado y el envío al cliente se confirman en una sola transacción.

create sequence if not exists certificado_cobertura_seq;

create table if not exists certificado_cobertura (
    id                      uuid primary key default gen_random_uuid(),
    cotizacion_id           uuid not null unique references cotizacion(id) on delete cascade,
    numero                  text not null unique,
    storage_path            text not null,
    canal_envio             text not null check (canal_envio in ('CORREO','WHATSAPP')),
    destino                 text not null,
    proveedor_mensaje_id    text,
    enviado_por_usuario_id  uuid references usuario(id),
    enviado_en              timestamptz not null default now(),
    creado_en               timestamptz not null default now()
);
-- Limitador de WhatsApp: consulta el último envío por canal.
create index if not exists idx_certificado_canal_enviado on certificado_cobertura(canal_envio, enviado_en desc);

-- Datos personales del asegurado: solo service_role (mismo patrón que canal_cliente).
alter table certificado_cobertura enable row level security;
revoke all on certificado_cobertura from anon, authenticated;
revoke all on sequence certificado_cobertura_seq from anon, authenticated;

-- Bucket privado para los PDF (workflow del repo = SQL manual contra la BD hosteada).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificados', 'certificados', false, 2097152, array['application/pdf'])
on conflict (id) do nothing;
