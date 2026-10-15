-- Conciliación de pagos por la aseguradora: marca interna, no cambia montos ni estados.
alter table pago
    add column conciliado_en     timestamptz,
    add column conciliado_por_id uuid references usuario(id);

create index idx_pago_fecha on pago(fecha_pago);
