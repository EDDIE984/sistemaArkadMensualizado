-- Fase 3: revisión del inspector de la aseguradora.
-- Regla 16 del ER model. Informativo: NO condiciona cotizacion.estado,
-- la aceptación ni la emisión de póliza.

-- 1. Estado de revisión en la cabecera de la inspección.
alter table inspeccion add column if not exists estado_revision text not null default 'PENDIENTE'
  check (estado_revision in ('PENDIENTE','APROBADA','RECHAZADA'));
alter table inspeccion add column if not exists revisado_por_usuario_id uuid references usuario(id);
alter table inspeccion add column if not exists revisado_en     timestamptz;
alter table inspeccion add column if not exists revision_motivo  text;
create index if not exists idx_inspeccion_revision on inspeccion(estado_revision);

-- 2. Observación del técnico por foto (junto a las descripciones de la IA).
alter table inspeccion_foto add column if not exists observacion_tecnico text;

-- 3. Override de gravedad por daño (null = se usa la severidad de la IA).
alter table inspeccion_dano add column if not exists severidad_revisada text
  check (severidad_revisada is null or severidad_revisada in ('LEVE','MODERADA','GRAVE'));
alter table inspeccion_dano add column if not exists dano_revisado_en timestamptz;
