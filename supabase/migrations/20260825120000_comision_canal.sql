-- Comisión del canal: corte interno de la prima neta mensual que le corresponde
-- al canal dueño de cada producto. NO afecta cuota_fija_mensual, prima_total_mes,
-- subtotal, iva ni ningún valor que ve el cliente (regla 15 del ER model).

-- 1. Porcentaje configurable por producto (0..1, convención decimal del proyecto).
alter table producto
  add column if not exists comision_canal_pct numeric(6,4) not null default 0;

alter table producto drop constraint if exists producto_comision_canal_pct_check;
alter table producto add constraint producto_comision_canal_pct_check
  check (comision_canal_pct >= 0 and comision_canal_pct <= 1);

-- 2. Snapshot histórico en la cotización (nullable: NULL = cotización previa al feature).
alter table cotizacion
  add column if not exists comision_canal_pct numeric(6,4);

alter table cotizacion drop constraint if exists cotizacion_comision_canal_pct_check;
alter table cotizacion add constraint cotizacion_comision_canal_pct_check
  check (comision_canal_pct is null or (comision_canal_pct >= 0 and comision_canal_pct <= 1));

-- 3. Desglose mes a mes = prima_neta_mes * cotizacion.comision_canal_pct.
--    Escala 4 para alinear con prima_neta_mes numeric(12,4) y evitar deriva de
--    redondeo al sumar en el panel de la aseguradora.
alter table amortizacion_mensual
  add column if not exists comision_canal numeric(12,4) not null default 0;
