-- Fase 2: análisis de daños con IA sobre las fotos de la inspección.
-- Regla 16 del ER model. Se dispara al pasar la inspección a COMPLETADA.
-- Es informativo: NO condiciona cotizacion.estado, la aceptación ni la emisión.

-- 1. El bucket debe admitir el PNG anotado (hoy sólo jpeg/webp).
update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/webp','image/png']
 where id = 'inspecciones';

-- 2. Estado de análisis por foto + puntero a la imagen anotada + rollup por foto.
alter table inspeccion_foto add column if not exists analisis_estado text not null default 'PENDIENTE'
  check (analisis_estado in ('PENDIENTE','ANALIZANDO','ANALIZADA','SIN_DANOS','ERROR'));
alter table inspeccion_foto add column if not exists analisis_iniciado_en   timestamptz;
alter table inspeccion_foto add column if not exists analizada_en           timestamptz;
alter table inspeccion_foto add column if not exists analisis_error         text;
alter table inspeccion_foto add column if not exists analisis_modelo        text;
alter table inspeccion_foto add column if not exists analizada_storage_path text;
alter table inspeccion_foto add column if not exists danos_total int not null default 0 check (danos_total >= 0);
alter table inspeccion_foto add column if not exists dano_peor text
  check (dano_peor is null or dano_peor in ('LEVE','MODERADA','GRAVE'));
create index if not exists idx_inspeccion_foto_analisis on inspeccion_foto(inspeccion_id, analisis_estado);

-- 3. Un daño detectado por fila (bbox normalizado 0..1 respecto a la imagen analizada).
create table if not exists inspeccion_dano (
    id                  uuid primary key default gen_random_uuid(),
    inspeccion_foto_id  uuid not null references inspeccion_foto(id) on delete cascade,
    tipo                text not null check (tipo in (
                          'RAYON','ABOLLADURA','HUNDIMIENTO','FISURA','PIEZA_ROTA','PIEZA_FALTANTE',
                          'DESALINEACION','CRISTAL_ROTO','PINTURA_SALTADA','CORROSION','LLANTA','OTRO')),
    severidad           text not null check (severidad in ('LEVE','MODERADA','GRAVE')),
    accion_recomendada  text not null check (accion_recomendada in ('PULIR','PINTAR','REPARAR','REEMPLAZAR','REVISAR')),
    pieza               text,
    descripcion         text,
    bbox_x              numeric(6,5) not null check (bbox_x >= 0 and bbox_x <= 1),
    bbox_y              numeric(6,5) not null check (bbox_y >= 0 and bbox_y <= 1),
    bbox_w              numeric(6,5) not null check (bbox_w >  0 and bbox_w <= 1),
    bbox_h              numeric(6,5) not null check (bbox_h >  0 and bbox_h <= 1),
    confianza           numeric(4,3) check (confianza is null or (confianza >= 0 and confianza <= 1)),
    creado_en           timestamptz not null default now()
);
create index if not exists idx_inspeccion_dano_foto on inspeccion_dano(inspeccion_foto_id);

-- 4. Rollup de análisis en la cabecera de la inspección.
alter table inspeccion add column if not exists analisis_estado text not null default 'PENDIENTE'
  check (analisis_estado in ('PENDIENTE','EN_PROCESO','COMPLETADO','CON_ERRORES'));
alter table inspeccion add column if not exists calificacion_dano text
  check (calificacion_dano is null or calificacion_dano in ('SIN_DANOS','LEVE','MODERADA','GRAVE'));
alter table inspeccion add column if not exists analisis_completado_en timestamptz;

-- 5. Tabla sensible: RLS sin políticas + revoke (sólo service_role).
alter table inspeccion_dano enable row level security;
revoke all on inspeccion_dano from anon, authenticated;
