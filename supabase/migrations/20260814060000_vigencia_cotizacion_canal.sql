-- Vigencia exacta para cotizaciones asistidas, sin períodos parciales.

alter table cotizacion
  add column if not exists fecha_inicio_vigencia date,
  add column if not exists fecha_fin_vigencia date,
  add column if not exists total_dias int generated always as (
    case when fecha_inicio_vigencia is null or fecha_fin_vigencia is null then null
         else fecha_fin_vigencia - fecha_inicio_vigencia + 1 end
  ) stored;

alter table cotizacion drop constraint if exists cotizacion_vigencia_canal_check;
alter table cotizacion add constraint cotizacion_vigencia_canal_check check (
  (origen = 'AUTOGESTION' and fecha_inicio_vigencia is null and fecha_fin_vigencia is null)
  or
  (origen = 'CANAL'
    and fecha_inicio_vigencia is not null
    and fecha_fin_vigencia = (fecha_inicio_vigencia + make_interval(years => anios_vigencia) - interval '1 day')::date
    and total_dias > 0)
);

create index if not exists idx_cotizacion_vigencia_canal
  on cotizacion(canal_id, fecha_inicio_vigencia, fecha_fin_vigencia)
  where origen = 'CANAL';
