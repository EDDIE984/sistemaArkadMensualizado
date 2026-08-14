-- Completa la relación entre los planes iniciales y los ramos disponibles.
insert into plan_suscripcion_ramo(plan_suscripcion_id,ramo_base_id)
select p.id,r.id from plan_suscripcion p join ramo_base r on
  (p.nombre='BASICO' and r.nombre='VEHICULO') or
  (p.nombre='PROFESIONAL' and r.nombre in ('VEHICULO','VIDA','HOGAR')) or
  (p.nombre='ENTERPRISE')
on conflict do nothing;
