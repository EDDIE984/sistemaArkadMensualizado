-- Cancelación por pérdida total (regla 19 del ER): fecha de siniestro, reclamo
-- y desglose interno de la nivelación (prima pendiente hasta fin del año en curso).
alter table cancelacion_poliza
    add column tipo            text not null default 'NORMAL' check (tipo in ('NORMAL','PERDIDA_TOTAL')),
    add column fecha_siniestro date,
    add column numero_reclamo  text,
    add constraint cancelacion_siniestro_chk check ((tipo = 'PERDIDA_TOTAL') = (fecha_siniestro is not null));

alter table nivelacion
    add column tipo                 text not null default 'NORMAL' check (tipo in ('NORMAL','PERDIDA_TOTAL')),
    add column prima_pendiente      numeric(12,4),
    add column nivelacion_acumulada numeric(12,4);
