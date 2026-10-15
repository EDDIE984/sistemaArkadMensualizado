-- Datos de empresa del canal (todos opcionales).
alter table canal
    add column ruc             text check (ruc is null or ruc ~ '^\d{13}$'),
    add column direccion       text,
    add column telefono        text,
    add column contacto_nombre text;
